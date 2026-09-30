ALTER TABLE public.mutation_idempotency
  DROP CONSTRAINT mutation_idempotency_operation_check;
ALTER TABLE public.mutation_idempotency
  ADD CONSTRAINT mutation_idempotency_operation_check
  CHECK (operation IN ('activity.create', 'activity.photo_only'));

CREATE OR REPLACE FUNCTION public.finalize_photo_evidence(
  p_evidence_id UUID,
  p_drive_file_id TEXT,
  p_drive_folder_id TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT,
  p_checksum TEXT,
  p_width INTEGER,
  p_height INTEGER
) RETURNS public.evidences
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); record_row public.evidences;
  upload_row public.photo_upload_sessions;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO record_row FROM public.evidences
    WHERE id = p_evidence_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND OR record_row.type <> 'PHOTO' OR record_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Evidence unavailable' USING ERRCODE = '42501';
  END IF;
  IF record_row.status = 'AVAILABLE' THEN RETURN record_row; END IF;
  IF record_row.status <> 'UPLOADING' THEN
    RAISE EXCEPTION 'Upload is not active' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO upload_row FROM public.photo_upload_sessions
    WHERE evidence_id = p_evidence_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND OR upload_row.drive_folder_id IS DISTINCT FROM p_drive_folder_id
     OR upload_row.expected_mime IS DISTINCT FROM p_mime_type
     OR upload_row.expected_size IS DISTINCT FROM p_size_bytes
     OR p_drive_file_id IS NULL OR length(p_drive_file_id) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'Upload metadata mismatch' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.photo_evidences
    (evidence_id, drive_file_id, drive_folder_id, original_filename, stored_filename,
     mime_type, size_bytes, checksum, width, height)
  VALUES
    (p_evidence_id, p_drive_file_id, p_drive_folder_id, upload_row.original_filename,
     upload_row.stored_filename, p_mime_type, p_size_bytes, p_checksum, p_width, p_height);
  UPDATE public.evidences SET status = 'AVAILABLE' WHERE id = p_evidence_id
    RETURNING * INTO record_row;
  RETURN record_row;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_photo_evidence(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_photo_evidence(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, INTEGER, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_link_evidence(
  p_title TEXT, p_note TEXT, p_url TEXT
) RETURNS public.evidences
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); record_row public.evidences;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_url IS NULL OR p_url !~* '^https?://[^[:space:]]+$' OR length(p_url) > 2048 THEN
    RAISE EXCEPTION 'Invalid link URL' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.evidences (user_id, type, title, note, status)
  VALUES (actor, 'LINK', NULLIF(trim(p_title), ''), NULLIF(trim(p_note), ''), 'AVAILABLE')
  RETURNING * INTO record_row;
  INSERT INTO public.link_evidences (evidence_id, url) VALUES (record_row.id, p_url);
  RETURN record_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_link_evidence(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_link_evidence(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_photo_only_activity(
  p_key TEXT, p_evidence_id UUID, p_activity_date DATE
) RETURNS public.activities
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); activity_id UUID; result_row public.activities;
  photo_row public.evidences;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO photo_row FROM public.evidences
    WHERE id = p_evidence_id AND user_id = actor AND type = 'PHOTO'
      AND status = 'AVAILABLE' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Photo unavailable' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.mutation_idempotency (user_id, key, operation, resource_id)
  VALUES (actor, p_key, 'activity.photo_only', gen_random_uuid())
  ON CONFLICT DO NOTHING RETURNING resource_id INTO activity_id;
  IF activity_id IS NULL THEN
    SELECT resource_id INTO activity_id FROM public.mutation_idempotency
      WHERE user_id = actor AND key = p_key AND operation = 'activity.photo_only';
    SELECT * INTO result_row FROM public.activities
      WHERE id = activity_id AND user_id = actor;
    RETURN result_row;
  END IF;

  INSERT INTO public.activities
    (id, user_id, title, activity_date, source, status, needs_description)
  VALUES (activity_id, actor, 'Aktivitas tanpa judul', p_activity_date,
    'quick_capture', 'DRAFT', true)
  RETURNING * INTO result_row;
  INSERT INTO public.activity_evidences (activity_id, evidence_id, attached_by)
  VALUES (activity_id, p_evidence_id, actor);
  RETURN result_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_photo_only_activity(TEXT, UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_photo_only_activity(TEXT, UUID, DATE) TO authenticated;
