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
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND is_active) THEN
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
CREATE OR REPLACE FUNCTION private.guard_active_account_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT EXISTS
    (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_active) THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
