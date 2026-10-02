-- Keep Activity idempotency's existing Activity FK; Todo requests need their own FK.
ALTER TABLE public.todos ADD CONSTRAINT todos_user_id_id_key UNIQUE(user_id,id);
CREATE TABLE public.todo_creation_requests (
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 key text NOT NULL CHECK(length(key) BETWEEN 1 AND 128),
 resource_id uuid NOT NULL,
 request_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,key),
 FOREIGN KEY(user_id,resource_id) REFERENCES public.todos(user_id,id) ON DELETE CASCADE
);
CREATE INDEX todo_creation_requests_resource_owner_idx ON public.todo_creation_requests(user_id,resource_id);
ALTER TABLE public.todo_creation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY todo_creation_request_owner_select ON public.todo_creation_requests FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY todo_creation_request_owner_insert ON public.todo_creation_requests FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.todo_creation_requests FROM anon,authenticated;
GRANT SELECT,INSERT ON public.todo_creation_requests TO authenticated;
GRANT ALL ON public.todo_creation_requests TO service_role;
ALTER TABLE public.mutation_idempotency DROP CONSTRAINT mutation_idempotency_operation_check;
ALTER TABLE public.mutation_idempotency ADD CONSTRAINT mutation_idempotency_operation_check CHECK(operation IN ('activity.create','activity.photo_only'));
CREATE OR REPLACE FUNCTION public.create_todo(p_key text,p_title text,p_description text,p_priority text,p_due_date date,p_stage_id uuid,p_work_category text,p_auto_record boolean)
RETURNS public.todos LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); previous public.todo_creation_requests; result public.todos; payload jsonb; stage_id uuid; last_order numeric;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR nullif(btrim(p_title),'') IS NULL OR length(p_title)>200 OR p_work_category IS NULL OR p_work_category NOT IN ('INTERNSHIP','THESIS','PERSONAL') OR p_auto_record IS NULL THEN RAISE EXCEPTION 'Invalid task' USING ERRCODE='22023'; END IF;
  SELECT id INTO stage_id FROM public.todo_stages WHERE (p_stage_id IS NOT NULL AND id=p_stage_id OR p_stage_id IS NULL AND code='BACKLOG') AND code IN ('BACKLOG','TODO');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid starting stage' USING ERRCODE='23514'; END IF;
  payload:=jsonb_build_object('title',btrim(p_title),'description',nullif(btrim(p_description),''),'priority',p_priority,'due',p_due_date,'stage',stage_id,'category',p_work_category,'auto',p_work_category<>'PERSONAL' AND p_auto_record);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':todo-create:'||p_key,0));
  SELECT * INTO previous FROM public.todo_creation_requests WHERE user_id=actor AND key=p_key;
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='23514'; END IF;
    SELECT * INTO result FROM public.todos WHERE id=previous.resource_id AND user_id=actor AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Todo unavailable' USING ERRCODE='42501'; END IF;
    RETURN result;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':todo-order:'||stage_id::text,0));
  SELECT coalesce(max(sort_order),0)+1000 INTO last_order FROM public.todos WHERE user_id=actor AND current_stage_id=stage_id AND deleted_at IS NULL;
  INSERT INTO public.todos(user_id,title,description,priority,due_date,current_stage_id,sort_order,work_category,auto_record_activity)
    VALUES(actor,btrim(p_title),nullif(btrim(p_description),''),p_priority,p_due_date,stage_id,last_order,p_work_category,p_work_category<>'PERSONAL' AND p_auto_record) RETURNING * INTO result;
  INSERT INTO public.todo_creation_requests(user_id,key,resource_id,request_payload) VALUES(actor,p_key,result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_todo(text,text,text,text,date,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_todo(text,text,text,text,date,uuid,text,boolean) TO authenticated;
