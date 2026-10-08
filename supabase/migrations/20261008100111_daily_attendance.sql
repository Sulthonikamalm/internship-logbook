-- Daily work attendance is independent from individual Activity records.
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  work_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  auto_close_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  auto_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_auto_close_after_start CHECK (auto_close_at > started_at),
  CONSTRAINT attendance_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT attendance_end_before_auto_close CHECK (ended_at IS NULL OR ended_at <= auto_close_at),
  CONSTRAINT attendance_auto_close_has_end CHECK (NOT auto_closed OR ended_at IS NOT NULL),
  CONSTRAINT attendance_one_session_per_day UNIQUE (user_id, work_date)
);

CREATE UNIQUE INDEX attendance_one_open_session_per_user_idx
  ON public.attendance_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX attendance_user_work_date_idx
  ON public.attendance_sessions(user_id, work_date DESC, started_at DESC);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_owner_select ON public.attendance_sessions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.attendance_sessions FROM anon, authenticated;
GRANT SELECT ON public.attendance_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.start_daily_attendance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := auth.uid();
  zone TEXT;
  instant TIMESTAMPTZ := clock_timestamp();
  local_day DATE;
  cutoff TIMESTAMPTZ;
  session public.attendance_sessions;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));

  SELECT p.timezone INTO zone
  FROM public.profiles AS p
  WHERE p.id = actor AND p.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = zone) THEN
    zone := 'Asia/Jakarta';
  END IF;

  local_day := (instant AT TIME ZONE zone)::date;
  cutoff := ((local_day + 1)::timestamp AT TIME ZONE zone);

  -- Recover an unprocessed prior-day session before considering today's start.
  UPDATE public.attendance_sessions AS s
  SET ended_at = s.auto_close_at,
      auto_closed = true
  WHERE s.user_id = actor AND s.ended_at IS NULL
    AND s.auto_close_at <= instant;

  SELECT * INTO session
  FROM public.attendance_sessions AS s
  WHERE s.user_id = actor AND s.work_date = local_day;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'session', to_jsonb(session));
  END IF;

  INSERT INTO public.attendance_sessions(user_id, work_date, timezone, started_at, auto_close_at)
  VALUES (actor, local_day, zone, instant, cutoff)
  RETURNING * INTO session;

  RETURN jsonb_build_object('ok', true, 'session', to_jsonb(session));
END;
$$;

CREATE OR REPLACE FUNCTION public.end_daily_attendance(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := auth.uid();
  instant TIMESTAMPTZ := clock_timestamp();
  session public.attendance_sessions;
  cutoff TIMESTAMPTZ;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));
  SELECT * INTO session
  FROM public.attendance_sessions AS s
  WHERE s.id = p_session_id AND s.user_id = actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF session.ended_at IS NULL THEN
    cutoff := session.auto_close_at;
    IF cutoff <= instant THEN
      UPDATE public.attendance_sessions AS s
      SET ended_at = cutoff, auto_closed = true
      WHERE s.id = session.id
      RETURNING * INTO session;
    ELSE
      UPDATE public.attendance_sessions AS s
      SET ended_at = instant
      WHERE s.id = session.id
      RETURNING * INTO session;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'session', to_jsonb(session));
END;
$$;

CREATE OR REPLACE FUNCTION public.close_expired_attendance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  UPDATE public.attendance_sessions AS s
  SET ended_at = s.auto_close_at,
      auto_closed = true
  WHERE s.ended_at IS NULL
    AND s.auto_close_at <= clock_timestamp();
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.start_daily_attendance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_daily_attendance(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_expired_attendance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_daily_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_daily_attendance(UUID) TO authenticated;

-- Supabase Cron runs this every minute; the stored end time is the user's exact local midnight.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'close-expired-daily-attendance';
SELECT cron.schedule(
  'close-expired-daily-attendance',
  '* * * * *',
  'SELECT public.close_expired_attendance()'
);

NOTIFY pgrst, 'reload schema';
