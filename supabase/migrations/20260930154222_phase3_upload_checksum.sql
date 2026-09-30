ALTER TABLE public.photo_upload_sessions
  ADD COLUMN expected_checksum TEXT NULL
  CHECK (expected_checksum IS NULL OR expected_checksum ~ '^[0-9a-f]{64}$');
