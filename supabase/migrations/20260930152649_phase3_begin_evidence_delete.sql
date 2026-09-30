CREATE OR REPLACE FUNCTION public.begin_evidence_delete(
  p_evidence_id UUID, p_detach_all BOOLEAN DEFAULT false
) RETURNS TABLE(type TEXT, status TEXT, drive_file_id TEXT, blocked_count INTEGER)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); evidence_row public.evidences; assigned INTEGER;
  photo_file_id TEXT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO evidence_row FROM public.evidences
    WHERE id = p_evidence_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF evidence_row.status = 'DELETED' OR evidence_row.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT evidence_row.type, 'DELETED'::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;
  IF evidence_row.status = 'UPLOADING' OR evidence_row.status = 'ORPHANED' THEN
    RAISE EXCEPTION 'Evidence has an active upload or reconciliation' USING ERRCODE = '23514';
  END IF;
  SELECT count(*)::INTEGER INTO assigned FROM public.activity_evidences
    WHERE evidence_id = p_evidence_id AND attached_by = actor;
  IF assigned > 0 AND NOT p_detach_all THEN
    RETURN QUERY SELECT evidence_row.type, evidence_row.status, NULL::TEXT, assigned;
    RETURN;
  END IF;
  IF assigned > 0 THEN
    DELETE FROM public.activity_evidences
      WHERE evidence_id = p_evidence_id AND attached_by = actor;
  END IF;
  SELECT p.drive_file_id INTO photo_file_id FROM public.photo_evidences p
    WHERE p.evidence_id = p_evidence_id;
  IF evidence_row.status <> 'DELETE_PENDING' THEN
    UPDATE public.evidences SET status = 'DELETE_PENDING'
      WHERE id = p_evidence_id AND user_id = actor;
  END IF;
  RETURN QUERY SELECT evidence_row.type, 'DELETE_PENDING'::TEXT, photo_file_id, 0;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_evidence_delete(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_evidence_delete(UUID, BOOLEAN) TO authenticated;
