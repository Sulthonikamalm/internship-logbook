-- Quick capture binds retries to the photo, date and category.
UPDATE public.mutation_idempotency m SET request_payload=jsonb_build_object(
  'photo', (SELECT ae.evidence_id FROM public.activity_evidences ae WHERE ae.activity_id=a.id ORDER BY ae.attached_at,ae.evidence_id LIMIT 1),
  'date',a.activity_date,'category',a.work_category)
FROM public.activities a WHERE m.operation='activity.photo_only' AND m.request_payload IS NULL AND a.id=m.resource_id AND a.user_id=m.user_id;
DROP FUNCTION public.create_photo_only_activity(text,uuid,date);
CREATE FUNCTION public.create_photo_only_activity(p_key text,p_evidence_id uuid,p_activity_date date,p_work_category text DEFAULT 'INTERNSHIP')
RETURNS public.activities LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); payload jsonb; previous public.mutation_idempotency; result public.activities;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR p_activity_date IS NULL OR p_work_category IS NULL OR p_work_category NOT IN ('INTERNSHIP','THESIS','PERSONAL') THEN
    RAISE EXCEPTION 'Invalid capture' USING ERRCODE='22023';
  END IF;
  payload:=jsonb_build_object('photo',p_evidence_id,'date',p_activity_date,'category',p_work_category);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':photo:'||p_key,0));
  SELECT * INTO previous FROM public.mutation_idempotency WHERE user_id=actor AND key=p_key AND operation='activity.photo_only';
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='23514'; END IF;
    SELECT * INTO result FROM public.activities WHERE id=previous.resource_id AND user_id=actor AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE='42501'; END IF;
    RETURN result;
  END IF;
  PERFORM 1 FROM public.evidences WHERE id=p_evidence_id AND user_id=actor AND type='PHOTO' AND status='AVAILABLE' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Photo unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.activities(user_id,title,activity_date,source,status,needs_description,work_category)
    VALUES(actor,'Aktivitas tanpa judul',p_activity_date,'quick_capture','DRAFT',true,p_work_category) RETURNING * INTO result;
  INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) VALUES(result.id,p_evidence_id,actor);
  INSERT INTO public.mutation_idempotency(user_id,key,operation,resource_id,request_payload) VALUES(actor,p_key,'activity.photo_only',result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_photo_only_activity(text,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_photo_only_activity(text,uuid,date,text) TO authenticated;
