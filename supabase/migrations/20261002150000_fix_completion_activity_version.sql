-- Completion may reuse an existing automatic Activity for the same Todo/day.
-- Updating its transition link must still satisfy the Activity optimistic-version guard.
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
    RETURN jsonb_build_object('ok',false,'code','EVIDENCE_REQUIRED','minimum',dst.minimum_evidence_count,'current',available,'allowedTypes',dst.allowed_evidence_types,'message','Tambahkan evidence untuk tahap ini.'); END IF;
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
    SELECT id INTO activity_id FROM public.activities
      WHERE user_id=actor AND todo_id=t.id AND activity_date=(now_at AT TIME ZONE zone)::date
        AND completion_transition_id IS NOT NULL AND deleted_at IS NULL
      ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
    IF activity_id IS NULL THEN
      INSERT INTO public.activities(user_id,title,description,activity_date,source,status,todo_id,work_category,completion_transition_id)
        VALUES(actor,left(t.title,160),coalesce(nullif(btrim(t.description),''),'Selesai: '||t.title),(now_at AT TIME ZONE zone)::date,'todo','READY',t.id,t.work_category,transition_id)
        RETURNING id INTO activity_id;
    ELSE
      UPDATE public.activities SET completion_transition_id=transition_id, version=version+1, updated_at=now_at WHERE id=activity_id;
    END IF;
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
NOTIFY pgrst, 'reload schema';
