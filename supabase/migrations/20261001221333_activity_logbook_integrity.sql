-- Activity creation, Todo association and idempotency belong to one transaction.
ALTER TABLE public.mutation_idempotency ADD COLUMN request_payload jsonb;
CREATE OR REPLACE FUNCTION private.guard_activity_todo_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.todo_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.todo_id IS DISTINCT FROM OLD.todo_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.todos WHERE id = NEW.todo_id AND user_id = NEW.user_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Todo unavailable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_activity_todo_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_activity_todo_owner BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION private.guard_activity_todo_owner();

CREATE OR REPLACE FUNCTION public.create_activity(
  p_key text, p_title text, p_description text, p_activity_date date,
  p_start_time time, p_end_time time, p_source text, p_status text, p_todo_id uuid DEFAULT NULL
) RETURNS public.activities LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  payload jsonb;
  previous public.mutation_idempotency;
  result public.activities;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND NOT is_disabled) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR p_title IS NULL
    OR p_activity_date IS NULL OR p_source IS NULL OR p_source NOT IN ('manual','quick_capture','todo')
    OR p_status IS NULL OR p_status NOT IN ('DRAFT','READY') THEN
    RAISE EXCEPTION 'Invalid activity' USING ERRCODE = '22023';
  END IF;
  IF (p_source = 'todo') IS DISTINCT FROM (p_todo_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid Todo source' USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object('title',nullif(trim(p_title),''),'description',nullif(trim(p_description),''),
    'date',p_activity_date,'start',p_start_time,'end',p_end_time,'source',p_source,'status',p_status,'todo',p_todo_id);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || ':activity:' || p_key, 0));
  SELECT * INTO previous FROM public.mutation_idempotency WHERE user_id = actor AND key = p_key AND operation = 'activity.create';
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO result FROM public.activities WHERE id = previous.resource_id AND user_id = actor AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE = '42501'; END IF;
    RETURN result;
  END IF;
  IF p_todo_id IS NOT NULL THEN
    PERFORM 1 FROM public.todos WHERE id = p_todo_id AND user_id = actor AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Todo unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.activities(user_id,title,description,activity_date,start_time,end_time,source,status,todo_id)
    VALUES (actor,nullif(trim(p_title),''),nullif(trim(p_description),''),p_activity_date,p_start_time,p_end_time,p_source,p_status,p_todo_id)
    RETURNING * INTO result;
  INSERT INTO public.mutation_idempotency(user_id,key,operation,resource_id,request_payload)
    VALUES (actor,p_key,'activity.create',result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid) TO authenticated;

-- A date overview must not depend on the current page or evidence/search filters.
CREATE FUNCTION public.get_activity_days(p_from date, p_to date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('activity_date',activity_date,'has_ready',has_ready,'draft_id',draft_id) ORDER BY activity_date),'[]'::jsonb)
  FROM (SELECT activity_date, bool_or(status IN ('READY','ARCHIVED')) AS has_ready,
    (array_agg(id ORDER BY created_at DESC,id) FILTER (WHERE status = 'DRAFT'))[1] AS draft_id
    FROM public.activities WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
      AND activity_date BETWEEN p_from AND p_to GROUP BY activity_date) days;
$$;
REVOKE ALL ON FUNCTION public.get_activity_days(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_activity_days(date,date) TO authenticated;

CREATE OR REPLACE VIEW public.logbook_activities WITH (security_invoker = true) AS
SELECT a.id,a.user_id,a.title,a.description,a.activity_date,a.start_time,a.end_time,a.source,a.status,
  a.needs_description,a.version,a.created_at,a.updated_at,a.deleted_at,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'PHOTO')::integer AS photo_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'LINK')::integer AS link_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'BROKEN')::integer AS broken_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL)::integer AS total_evidence_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'GITHUB_COMMIT')::integer AS github_count
FROM public.activities a
LEFT JOIN public.activity_evidences ae ON ae.activity_id = a.id AND ae.attached_by = a.user_id
LEFT JOIN public.evidences e ON e.id = ae.evidence_id AND e.user_id = a.user_id
WHERE a.deleted_at IS NULL GROUP BY a.id;

-- Disabled accounts cannot bypass server actions by writing directly with the public client.
CREATE OR REPLACE FUNCTION private.guard_active_account_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT EXISTS
    (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND NOT is_disabled) THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_active_account_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_active_account BEFORE INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION private.guard_active_account_write();
CREATE TRIGGER guard_active_account BEFORE INSERT OR UPDATE ON public.evidences FOR EACH ROW EXECUTE FUNCTION private.guard_active_account_write();
CREATE TRIGGER guard_active_account BEFORE INSERT OR UPDATE ON public.internship_settings FOR EACH ROW EXECUTE FUNCTION private.guard_active_account_write();
