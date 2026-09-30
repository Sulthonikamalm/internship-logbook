CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NULL CHECK (title IS NULL OR (length(trim(title)) BETWEEN 1 AND 160)),
  description TEXT NULL CHECK (description IS NULL OR length(description) <= 10000),
  activity_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'quick_capture', 'todo')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'ARCHIVED')),
  needs_description BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT activities_title_required_phase2 CHECK (title IS NOT NULL),
  CONSTRAINT activities_time_order CHECK (
    (end_time IS NULL OR start_time IS NOT NULL)
    AND (end_time IS NULL OR end_time >= start_time)
  )
);

CREATE INDEX activities_user_date_idx ON public.activities (user_id, activity_date DESC, created_at DESC);
CREATE INDEX activities_user_deleted_idx ON public.activities (user_id, deleted_at);
CREATE INDEX activities_user_status_idx ON public.activities (user_id, status);

CREATE OR REPLACE FUNCTION public.guard_activity_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  user_timezone TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Activity owner is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Deleted activity is unavailable' USING ERRCODE = '23514';
    END IF;
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'Activity version must advance by one' USING ERRCODE = '23514';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Soft delete cannot be reversed' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT timezone INTO user_timezone FROM public.profiles WHERE id = NEW.user_id;
  IF NEW.activity_date > (timezone(COALESCE(user_timezone, 'Asia/Jakarta'), now())::date + 7) THEN
    RAISE EXCEPTION 'Activity date exceeds future limit' USING ERRCODE = '22007';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_activities_write BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.guard_activity_write();
CREATE TRIGGER set_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_activity_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_action := 'activity.created';
  ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    event_action := 'activity.soft_deleted';
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ARCHIVED' THEN
    event_action := 'activity.archived';
  ELSE
    event_action := 'activity.updated';
  END IF;
  INSERT INTO public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  VALUES ((SELECT auth.uid()), 'activity', NEW.id, event_action,
    jsonb_build_object('version', NEW.version, 'status', NEW.status));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_activity_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_activities_change AFTER INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.audit_activity_change();

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_owner_select ON public.activities FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY activities_owner_insert ON public.activities FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY activities_owner_update ON public.activities FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE DELETE ON public.activities FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.activities TO authenticated;

CREATE TABLE public.mutation_idempotency (
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 128),
  operation TEXT NOT NULL CHECK (operation IN ('activity.create')),
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key, operation)
);
CREATE INDEX mutation_idempotency_created_idx ON public.mutation_idempotency (created_at);
ALTER TABLE public.mutation_idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_owner_select ON public.mutation_idempotency FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY idempotency_owner_insert ON public.mutation_idempotency FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT ON public.mutation_idempotency TO authenticated;
REVOKE UPDATE, DELETE ON public.mutation_idempotency FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_activity_idempotent(
  p_key TEXT,
  p_title TEXT,
  p_description TEXT,
  p_activity_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_source TEXT,
  p_status TEXT
)
RETURNS public.activities
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  activity_id UUID;
  result_row public.activities;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('manual', 'quick_capture') OR p_status NOT IN ('DRAFT', 'READY') THEN
    RAISE EXCEPTION 'Invalid activity source or status' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.mutation_idempotency (user_id, key, operation, resource_id)
  VALUES (actor_id, p_key, 'activity.create', gen_random_uuid())
  ON CONFLICT DO NOTHING
  RETURNING resource_id INTO activity_id;

  IF activity_id IS NULL THEN
    SELECT resource_id INTO activity_id FROM public.mutation_idempotency
      WHERE user_id = actor_id AND key = p_key AND operation = 'activity.create';
    SELECT * INTO result_row FROM public.activities
      WHERE id = activity_id AND user_id = actor_id;
    RETURN result_row;
  END IF;

  INSERT INTO public.activities
    (id, user_id, title, description, activity_date, start_time, end_time, source, status)
  VALUES
    (activity_id, actor_id, NULLIF(trim(p_title), ''), NULLIF(trim(p_description), ''),
     p_activity_date, p_start_time, p_end_time, p_source, p_status)
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_activity_idempotent(TEXT, TEXT, TEXT, DATE, TIME, TIME, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_activity_idempotent(TEXT, TEXT, TEXT, DATE, TIME, TIME, TEXT, TEXT) TO authenticated;
