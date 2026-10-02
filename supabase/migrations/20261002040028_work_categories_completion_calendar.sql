-- Work categories and atomic Todo completion, per product request 2026-10-02.
ALTER TABLE public.todos ADD COLUMN work_category text NOT NULL DEFAULT 'INTERNSHIP'
  CHECK (work_category IN ('INTERNSHIP','THESIS','PERSONAL'));
ALTER TABLE public.todos ADD COLUMN auto_record_activity boolean NOT NULL DEFAULT true;
ALTER TABLE public.activities ADD COLUMN work_category text NOT NULL DEFAULT 'INTERNSHIP'
  CHECK (work_category IN ('INTERNSHIP','THESIS','PERSONAL'));
ALTER TABLE public.todo_transitions ADD COLUMN work_category text NOT NULL DEFAULT 'INTERNSHIP'
  CHECK (work_category IN ('INTERNSHIP','THESIS','PERSONAL'));
ALTER TABLE public.todo_transitions ADD COLUMN completion_snapshot jsonb;
ALTER TABLE public.activities ADD COLUMN completion_transition_id uuid UNIQUE REFERENCES public.todo_transitions(id);
CREATE INDEX activities_owner_category_date ON public.activities(user_id,work_category,activity_date) WHERE deleted_at IS NULL;
CREATE INDEX todos_owner_category_stage ON public.todos(user_id,work_category,current_stage_id) WHERE deleted_at IS NULL;
CREATE INDEX todo_transitions_owner_stage_date ON public.todo_transitions(user_id,to_stage_id,created_at);
GRANT UPDATE (work_category,auto_record_activity) ON public.todos TO authenticated;

-- A browser may not fabricate automatic completion records or reassign identity.
REVOKE UPDATE ON public.activities FROM authenticated;
GRANT UPDATE (title,description,activity_date,start_time,end_time,status,version,updated_at,deleted_at,work_category) ON public.activities TO authenticated;
CREATE FUNCTION private.guard_activity_category() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    IF TG_OP='INSERT' AND NEW.completion_transition_id IS NOT NULL THEN
      RAISE EXCEPTION 'Completion records are created by the server' USING ERRCODE='42501';
    END IF;
    IF NEW.todo_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM public.todos WHERE id=NEW.todo_id AND user_id=NEW.user_id AND work_category=NEW.work_category) THEN
      RAISE EXCEPTION 'Todo category mismatch' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_activity_category() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_activity_category BEFORE INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION private.guard_activity_category();

CREATE OR REPLACE FUNCTION private.guard_todo_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE stage_code text; stage public.todo_stages;
BEGIN
  IF NEW.work_category = 'PERSONAL' THEN NEW.auto_record_activity := false; END IF;
  IF TG_OP = 'UPDATE' AND NEW.work_category IS DISTINCT FROM OLD.work_category THEN
    SELECT * INTO stage FROM public.todo_stages WHERE id = OLD.current_stage_id;
    IF stage.is_terminal THEN RAISE EXCEPTION 'Reopen Todo before changing category' USING ERRCODE='23514'; END IF;
    IF NEW.work_category <> 'PERSONAL' AND stage.requires_evidence_on_enter
      AND private.todo_valid_evidence_count(NEW.id,stage.allowed_evidence_types) < stage.minimum_evidence_count THEN
      RAISE EXCEPTION 'Evidence required for this category' USING ERRCODE='23514';
    END IF;
  END IF;
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active) THEN
      RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' THEN
      SELECT code INTO stage_code FROM public.todo_stages WHERE id = NEW.current_stage_id;
      IF stage_code NOT IN ('BACKLOG','TODO') OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.version <> 1 OR NEW.evidence_health <> 'OK' THEN
        RAISE EXCEPTION 'New Todo must start in Backlog or To Do' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutable Todo identity' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.refresh_todo_health(p_todo_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.todos; s public.todo_stages; health text;
BEGIN
  SELECT * INTO t FROM public.todos WHERE id = p_todo_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO s FROM public.todo_stages WHERE id = t.current_stage_id;
  health := CASE WHEN t.work_category <> 'PERSONAL' AND (s.requires_evidence_on_enter OR s.is_terminal) AND private.todo_valid_evidence_count(t.id,s.allowed_evidence_types) < s.minimum_evidence_count THEN 'EVIDENCE_INCOMPLETE' ELSE 'OK' END;
  UPDATE public.todos SET evidence_health = health WHERE id = t.id AND evidence_health IS DISTINCT FROM health;
END;
$$;
CREATE OR REPLACE FUNCTION public.transition_todo(p_todo_id uuid, p_target_stage_id uuid, p_expected_version integer, p_idempotency_key text, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=auth.uid(); t public.todos; src public.todo_stages; dst public.todo_stages; previous public.todo_transitions; payload jsonb; available integer; now_at timestamptz:=now(); transition_id uuid; activity_id uuid; zone text;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  IF p_todo_id IS NULL OR p_target_stage_id IS NULL OR p_expected_version IS NULL OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 100 OR length(coalesce(p_note,'')) > 1000 OR p_expected_version < 1 THEN
    RETURN jsonb_build_object('ok',false,'code','VALIDATION_ERROR','message','Input transisi tidak valid.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_idempotency_key,0));
  SELECT * INTO t FROM public.todos WHERE id=p_todo_id AND user_id=actor AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND','message','Todo tidak ditemukan.'); END IF;
  payload:=jsonb_build_object('todoId',p_todo_id,'targetStageId',p_target_stage_id,'version',p_expected_version,'note',nullif(btrim(p_note),''));
  SELECT * INTO previous FROM public.todo_transitions WHERE user_id=actor AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN RETURN jsonb_build_object('ok',false,'code','CONFLICT','message','Permintaan ini sudah dipakai untuk perubahan lain.'); END IF;
    RETURN jsonb_build_object('ok',true,'todoId',t.id,'currentStageId',t.current_stage_id,'newVersion',t.version,'replayed',true,'message','Perubahan sudah tersimpan.');
  END IF;
  IF t.version<>p_expected_version THEN RETURN jsonb_build_object('ok',false,'code','CONFLICT','message','Todo berubah di perangkat lain. Muat ulang untuk melanjutkan.'); END IF;
  SELECT * INTO src FROM public.todo_stages WHERE id=t.current_stage_id;
  SELECT * INTO dst FROM public.todo_stages WHERE id=p_target_stage_id;
  IF NOT FOUND OR NOT ((src.code='BACKLOG' AND dst.code='TODO') OR (src.code='TODO' AND dst.code IN ('BACKLOG','IN_PROGRESS')) OR (src.code='IN_PROGRESS' AND dst.code IN ('TODO','REVIEW')) OR (src.code='REVIEW' AND dst.code IN ('IN_PROGRESS','DONE')) OR (src.code='DONE' AND dst.code='REVIEW') OR (src.code IN ('BACKLOG','TODO','IN_PROGRESS') AND dst.code='DONE')) THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_TRANSITION','message','Pindahkan Todo ke tahap berikutnya atau sebelumnya.');
  END IF;
  IF t.work_category <> 'PERSONAL' AND src.requires_evidence_on_exit THEN
    available:=private.todo_valid_evidence_count(t.id,src.allowed_evidence_types);
    IF available<src.minimum_evidence_count THEN RETURN jsonb_build_object('ok',false,'code','EVIDENCE_REQUIRED','minimum',src.minimum_evidence_count,'current',available,'allowedTypes',src.allowed_evidence_types,'message','Tambahkan evidence sebelum berpindah tahap.'); END IF;
  END IF;
  available:=private.todo_valid_evidence_count(t.id,dst.allowed_evidence_types);
  IF t.work_category <> 'PERSONAL' AND dst.requires_evidence_on_enter AND available<dst.minimum_evidence_count THEN
    RETURN jsonb_build_object('ok',false,'code','EVIDENCE_REQUIRED','minimum',dst.minimum_evidence_count,'current',available,'allowedTypes',dst.allowed_evidence_types,'message','Tambahkan evidence untuk tahap ini.');
  END IF;
  IF dst.requires_note AND nullif(btrim(p_note),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'code','NOTE_REQUIRED','message','Tambahkan catatan untuk tahap ini.'); END IF;
  UPDATE public.todos SET current_stage_id=dst.id, sort_order=(SELECT coalesce(max(sort_order),0)+1000 FROM public.todos WHERE user_id=actor AND current_stage_id=dst.id AND deleted_at IS NULL),
    started_at=CASE WHEN dst.code='IN_PROGRESS' THEN coalesce(t.started_at,now_at) ELSE t.started_at END,
    completed_at=CASE WHEN dst.is_terminal THEN now_at ELSE NULL END, evidence_health='OK'
    WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.todo_transitions(todo_id,user_id,from_stage_id,to_stage_id,note,evidence_count,idempotency_key,request_payload,resulting_version,work_category,completion_snapshot)
    VALUES(t.id,actor,src.id,dst.id,nullif(btrim(p_note),''),available,p_idempotency_key,payload,t.version,t.work_category,CASE WHEN dst.is_terminal THEN jsonb_build_object('title',t.title,'description',t.description,'category',t.work_category) ELSE NULL END)
    RETURNING id INTO transition_id;
  IF dst.is_terminal AND t.work_category <> 'PERSONAL' AND t.auto_record_activity THEN
    SELECT timezone INTO zone FROM public.profiles WHERE id=actor;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone) THEN zone:='Asia/Jakarta'; END IF;
    INSERT INTO public.activities(user_id,title,description,activity_date,source,status,todo_id,work_category,completion_transition_id)
      VALUES(actor,left(t.title,160),coalesce(nullif(btrim(t.description),''),'Selesai: '||t.title),(now_at AT TIME ZONE zone)::date,'todo','READY',t.id,t.work_category,transition_id)
      RETURNING id INTO activity_id;
    INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by)
      SELECT activity_id,e.id,actor FROM public.todo_evidences te JOIN public.evidences e ON e.id=te.evidence_id
      WHERE te.todo_id=t.id AND e.user_id=actor AND e.status='AVAILABLE' AND e.deleted_at IS NULL
      GROUP BY e.id ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.audit_logs(actor_user_id,entity_type,entity_id,action,metadata) VALUES(actor,'todo',t.id,'todo.transitioned',jsonb_build_object('from',src.code,'to',dst.code,'version',t.version,'evidence_count',available));
  RETURN jsonb_build_object('ok',true,'todoId',t.id,'currentStageId',t.current_stage_id,'newVersion',t.version,'activityId',activity_id,'replayed',false,'message',CASE WHEN activity_id IS NOT NULL THEN 'Selesai dan tercatat sebagai Activity.' ELSE 'Todo dipindahkan.' END);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_todo(uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_todo(uuid,uuid,integer,text,text) TO authenticated;

-- Preserve retries of pre-category Activity creation requests.
UPDATE public.mutation_idempotency SET request_payload=request_payload||jsonb_build_object('category','INTERNSHIP')
WHERE operation='activity.create' AND request_payload IS NOT NULL AND NOT (request_payload ? 'category');
DROP FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid);
CREATE OR REPLACE FUNCTION public.create_activity(
  p_key text, p_title text, p_description text, p_activity_date date,
  p_start_time time, p_end_time time, p_source text, p_status text, p_todo_id uuid DEFAULT NULL, p_work_category text DEFAULT 'INTERNSHIP'
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
    OR p_status IS NULL OR p_status NOT IN ('DRAFT','READY') OR p_work_category IS NULL OR p_work_category NOT IN ('INTERNSHIP','THESIS','PERSONAL') THEN
    RAISE EXCEPTION 'Invalid activity' USING ERRCODE = '22023';
  END IF;
  IF (p_source = 'todo') IS DISTINCT FROM (p_todo_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid Todo source' USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object('title',nullif(trim(p_title),''),'description',nullif(trim(p_description),''),
    'date',p_activity_date,'start',p_start_time,'end',p_end_time,'source',p_source,'status',p_status,'todo',p_todo_id,'category',p_work_category);
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
    PERFORM 1 FROM public.todos WHERE id = p_todo_id AND user_id = actor AND deleted_at IS NULL AND work_category=p_work_category FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Todo unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.activities(user_id,title,description,activity_date,start_time,end_time,source,status,todo_id,work_category)
    VALUES (actor,nullif(trim(p_title),''),nullif(trim(p_description),''),p_activity_date,p_start_time,p_end_time,p_source,p_status,p_todo_id,p_work_category)
    RETURNING * INTO result;
  INSERT INTO public.mutation_idempotency(user_id,key,operation,resource_id,request_payload)
    VALUES (actor,p_key,'activity.create',result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid,text) TO authenticated;

CREATE OR REPLACE VIEW public.logbook_activities WITH (security_invoker = true) AS
SELECT a.id,a.user_id,a.title,a.description,a.activity_date,a.start_time,a.end_time,a.source,a.status,
  a.needs_description,a.version,a.created_at,a.updated_at,a.deleted_at,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'PHOTO')::integer AS photo_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'LINK')::integer AS link_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'BROKEN')::integer AS broken_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL)::integer AS total_evidence_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'GITHUB_COMMIT')::integer AS github_count, a.work_category
FROM public.activities a
LEFT JOIN public.activity_evidences ae ON ae.activity_id = a.id AND ae.attached_by = a.user_id
LEFT JOIN public.evidences e ON e.id = ae.evidence_id AND e.user_id = a.user_id
WHERE a.deleted_at IS NULL GROUP BY a.id;
DROP FUNCTION public.get_activity_days(date,date);
CREATE FUNCTION public.get_activity_days(p_from date,p_to date,p_category text DEFAULT 'INTERNSHIP') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('activity_date',activity_date,'has_ready',has_ready,'draft_id',draft_id) ORDER BY activity_date),'[]'::jsonb)
 FROM (SELECT activity_date,bool_or(status IN ('READY','ARCHIVED')) AS has_ready,
   (array_agg(id ORDER BY created_at DESC,id) FILTER (WHERE status='DRAFT'))[1] AS draft_id
   FROM public.activities WHERE user_id=(SELECT auth.uid()) AND deleted_at IS NULL AND work_category=p_category
   AND activity_date BETWEEN p_from AND p_to GROUP BY activity_date) days;
$$;
REVOKE ALL ON FUNCTION public.get_activity_days(date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_activity_days(date,date,text) TO authenticated;
