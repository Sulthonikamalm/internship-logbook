-- Phase 4: Internship Settings & Logbook Derived View

-- 1. Internship Settings Table
CREATE TABLE public.internship_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NULL,
  end_date DATE NULL,
  working_days SMALLINT[] NOT NULL DEFAULT array[1,2,3,4,5],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT internship_settings_date_order CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT internship_settings_working_days_range CHECK (
    working_days <@ array[1,2,3,4,5,6,7]::smallint[]
    AND cardinality(working_days) >= 1
    AND cardinality(working_days) <= 7
  )
);

CREATE INDEX internship_settings_user_idx ON public.internship_settings (user_id);

-- Guard trigger to ensure working_days has no duplicates and user_id is immutable
CREATE OR REPLACE FUNCTION public.guard_internship_settings()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  unique_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Settings owner is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Ensure working_days has unique elements
  SELECT count(DISTINCT d) INTO unique_count FROM unnest(NEW.working_days) AS d;
  IF unique_count <> cardinality(NEW.working_days) THEN
    RAISE EXCEPTION 'Working days must be unique' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_internship_settings_write
  BEFORE INSERT OR UPDATE ON public.internship_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_internship_settings();

CREATE TRIGGER set_internship_settings_updated_at
  BEFORE UPDATE ON public.internship_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on internship_settings
ALTER TABLE public.internship_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY internship_settings_owner_select ON public.internship_settings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY internship_settings_owner_insert ON public.internship_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY internship_settings_owner_update ON public.internship_settings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE DELETE ON public.internship_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.internship_settings TO authenticated;

-- 2. Derived View: Logbook Activities
-- Pure projection over activities with evidence counts.
-- No duplicate logbook table is created. Security invoker ensures RLS is respected.
CREATE OR REPLACE VIEW public.logbook_activities WITH (security_invoker = true) AS
SELECT
  a.id,
  a.user_id,
  a.title,
  a.description,
  a.activity_date,
  a.start_time,
  a.end_time,
  a.source,
  a.status,
  a.needs_description,
  a.version,
  a.created_at,
  a.updated_at,
  a.deleted_at,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'PHOTO')::integer AS photo_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'LINK')::integer AS link_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'BROKEN')::integer AS broken_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL)::integer AS total_evidence_count
FROM public.activities a
LEFT JOIN public.activity_evidences ae ON ae.activity_id = a.id AND ae.attached_by = a.user_id
LEFT JOIN public.evidences e ON e.id = ae.evidence_id AND e.user_id = a.user_id
WHERE a.deleted_at IS NULL
GROUP BY a.id;

REVOKE ALL ON public.logbook_activities FROM PUBLIC, anon;
GRANT SELECT ON public.logbook_activities TO authenticated;
