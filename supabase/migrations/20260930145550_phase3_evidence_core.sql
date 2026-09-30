CREATE TABLE public.evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('PHOTO', 'LINK')),
  title TEXT NULL CHECK (title IS NULL OR length(trim(title)) BETWEEN 1 AND 160),
  note TEXT NULL CHECK (note IS NULL OR length(note) <= 10000),
  status TEXT NOT NULL CHECK (status IN
    ('UPLOADING', 'AVAILABLE', 'FAILED', 'ORPHANED', 'BROKEN', 'DELETE_PENDING', 'DELETED')),
  upload_id UUID NULL,
  captured_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  UNIQUE (user_id, id),
  UNIQUE (user_id, upload_id),
  CONSTRAINT evidence_initial_type_status CHECK
    (type = 'PHOTO' OR status <> 'UPLOADING')
);
CREATE INDEX evidences_owner_date_idx ON public.evidences (user_id, created_at DESC, id DESC);
CREATE INDEX evidences_owner_type_status_idx ON public.evidences (user_id, type, status);
CREATE INDEX evidences_owner_deleted_idx ON public.evidences (user_id, deleted_at);

CREATE TABLE public.photo_evidences (
  evidence_id UUID PRIMARY KEY REFERENCES public.evidences(id) ON DELETE RESTRICT,
  drive_file_id TEXT NOT NULL UNIQUE,
  drive_folder_id TEXT NOT NULL,
  original_filename TEXT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 15728640),
  checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  width INTEGER NULL CHECK (width IS NULL OR width > 0),
  height INTEGER NULL CHECK (height IS NULL OR height > 0),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photo_evidences_folder_idx ON public.photo_evidences (drive_folder_id);

CREATE TABLE public.link_evidences (
  evidence_id UUID PRIMARY KEY REFERENCES public.evidences(id) ON DELETE RESTRICT,
  url TEXT NOT NULL CHECK (url ~* '^https?://[^[:space:]]+$' AND length(url) <= 2048)
);

CREATE TABLE public.photo_upload_sessions (
  evidence_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  expected_size BIGINT NOT NULL CHECK (expected_size BETWEEN 1 AND 15728640),
  expected_mime TEXT NOT NULL CHECK (expected_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  original_filename TEXT NULL,
  stored_filename TEXT NOT NULL,
  drive_folder_id TEXT NULL,
  session_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  FOREIGN KEY (user_id, evidence_id) REFERENCES public.evidences(user_id, id),
  UNIQUE (user_id, upload_id)
);
CREATE INDEX photo_upload_sessions_owner_expiry_idx
  ON public.photo_upload_sessions (user_id, expires_at);

CREATE TABLE public.activity_evidences (
  activity_id UUID NOT NULL,
  evidence_id UUID NOT NULL,
  attached_by UUID NOT NULL,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, evidence_id),
  FOREIGN KEY (attached_by, activity_id) REFERENCES public.activities(user_id, id),
  FOREIGN KEY (attached_by, evidence_id) REFERENCES public.evidences(user_id, id)
);
CREATE INDEX activity_evidences_evidence_idx ON public.activity_evidences (evidence_id, activity_id);
CREATE INDEX activity_evidences_owner_idx ON public.activity_evidences (attached_by, attached_at DESC);

CREATE TABLE public.storage_reconciliation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  evidence_id UUID NOT NULL REFERENCES public.evidences(id),
  drive_file_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('UPLOAD_FINALIZE_FAILED', 'DRIVE_DELETE_FAILED')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evidence_id, drive_file_id, reason)
);
CREATE INDEX storage_reconciliation_pending_idx
  ON public.storage_reconciliation_jobs (status, created_at) WHERE status <> 'RESOLVED';

CREATE OR REPLACE FUNCTION public.guard_evidence_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.type = 'PHOTO' AND (NEW.status <> 'UPLOADING' OR NEW.upload_id IS NULL))
       OR (NEW.type = 'LINK' AND (NEW.status <> 'AVAILABLE' OR NEW.upload_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'Invalid initial evidence state' USING ERRCODE = '23514';
    END IF;
    IF NEW.type = 'PHOTO' THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 537));
      IF (SELECT count(*) FROM public.evidences
          WHERE user_id = NEW.user_id AND type = 'PHOTO' AND status = 'UPLOADING'
            AND created_at > now() - interval '1 hour') >= 3 THEN
        RAISE EXCEPTION 'Too many concurrent uploads' USING ERRCODE = 'P0001';
      END IF;
      IF (SELECT count(*) FROM public.evidences
          WHERE user_id = NEW.user_id AND type = 'PHOTO'
            AND created_at > now() - interval '1 hour') >= 30 THEN
        RAISE EXCEPTION 'Photo upload rate limit' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.upload_id IS DISTINCT FROM OLD.upload_id THEN
      RAISE EXCEPTION 'Evidence identity is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Deleted evidence is unavailable' USING ERRCODE = '23514';
    END IF;
    IF NEW.type = 'PHOTO' AND NEW.status = 'AVAILABLE'
       AND NOT EXISTS (SELECT 1 FROM public.photo_evidences WHERE evidence_id = NEW.id) THEN
      RAISE EXCEPTION 'Photo metadata required before availability' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'DELETED' AND NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Deleted evidence must have deleted_at' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_evidence_write BEFORE INSERT OR UPDATE ON public.evidences
  FOR EACH ROW EXECUTE FUNCTION public.guard_evidence_write();
CREATE TRIGGER set_evidence_updated_at BEFORE UPDATE ON public.evidences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_reconciliation_updated_at BEFORE UPDATE ON public.storage_reconciliation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_evidence_subtype()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent_type TEXT; parent_status TEXT;
BEGIN
  SELECT type, status INTO parent_type, parent_status FROM public.evidences WHERE id = NEW.evidence_id;
  IF parent_type IS DISTINCT FROM TG_ARGV[0]
     OR (parent_type = 'PHOTO' AND parent_status <> 'UPLOADING')
     OR (parent_type = 'LINK' AND parent_status <> 'AVAILABLE') THEN
    RAISE EXCEPTION 'Evidence subtype mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_photo_subtype BEFORE INSERT ON public.photo_evidences
  FOR EACH ROW EXECUTE FUNCTION public.guard_evidence_subtype('PHOTO');
CREATE TRIGGER guard_link_subtype BEFORE INSERT ON public.link_evidences
  FOR EACH ROW EXECUTE FUNCTION public.guard_evidence_subtype('LINK');

CREATE OR REPLACE FUNCTION public.guard_activity_evidence_attach()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE activity_owner UUID; evidence_owner UUID; activity_deleted TIMESTAMPTZ;
  evidence_deleted TIMESTAMPTZ; evidence_status TEXT;
BEGIN
  SELECT user_id, deleted_at INTO activity_owner, activity_deleted
    FROM public.activities WHERE id = NEW.activity_id FOR UPDATE;
  SELECT user_id, deleted_at, status INTO evidence_owner, evidence_deleted, evidence_status
    FROM public.evidences WHERE id = NEW.evidence_id FOR UPDATE;
  IF activity_owner IS DISTINCT FROM NEW.attached_by
     OR evidence_owner IS DISTINCT FROM NEW.attached_by
     OR NEW.attached_by IS DISTINCT FROM auth.uid()
     OR activity_deleted IS NOT NULL OR evidence_deleted IS NOT NULL
     OR evidence_status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'Evidence or activity unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_activity_evidence_attach BEFORE INSERT ON public.activity_evidences
  FOR EACH ROW EXECUTE FUNCTION public.guard_activity_evidence_attach();

CREATE OR REPLACE FUNCTION public.audit_evidence_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE action_name TEXT;
BEGIN
  IF TG_TABLE_NAME = 'activity_evidences' THEN
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'evidence.attached' ELSE 'evidence.detached' END;
    INSERT INTO public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'evidence', CASE WHEN TG_OP = 'INSERT' THEN NEW.evidence_id ELSE OLD.evidence_id END,
      action_name, jsonb_build_object('activity_id',
        CASE WHEN TG_OP = 'INSERT' THEN NEW.activity_id ELSE OLD.activity_id END));
    RETURN CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
  END IF;
  action_name := CASE WHEN TG_OP = 'INSERT' THEN 'evidence.created'
    WHEN NEW.status = 'AVAILABLE' AND OLD.status <> 'AVAILABLE' THEN 'evidence.available'
    WHEN NEW.status = 'BROKEN' AND OLD.status <> 'BROKEN' THEN 'evidence.broken'
    WHEN NEW.status = 'DELETED' AND OLD.status <> 'DELETED' THEN 'evidence.deleted'
    ELSE 'evidence.updated' END;
  INSERT INTO public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'evidence', NEW.id, action_name,
    jsonb_build_object('type', NEW.type, 'status', NEW.status));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_evidence_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_evidence_change AFTER INSERT OR UPDATE ON public.evidences
  FOR EACH ROW EXECUTE FUNCTION public.audit_evidence_change();
CREATE TRIGGER audit_activity_evidence_detach AFTER DELETE ON public.activity_evidences
  FOR EACH ROW EXECUTE FUNCTION public.audit_evidence_change();
CREATE TRIGGER audit_activity_evidence_attach AFTER INSERT ON public.activity_evidences
  FOR EACH ROW EXECUTE FUNCTION public.audit_evidence_change();

ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_reconciliation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidence_owner_select ON public.evidences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY evidence_owner_insert ON public.evidences FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY evidence_owner_update ON public.evidences FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.evidences TO authenticated;
REVOKE DELETE ON public.evidences FROM anon, authenticated;

CREATE POLICY photo_owner_select ON public.photo_evidences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())));
CREATE POLICY photo_owner_insert ON public.photo_evidences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())));
GRANT SELECT, INSERT ON public.photo_evidences TO authenticated;
REVOKE UPDATE, DELETE ON public.photo_evidences FROM anon, authenticated;

CREATE POLICY link_owner_select ON public.link_evidences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())));
CREATE POLICY link_owner_insert ON public.link_evidences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())));
GRANT SELECT, INSERT ON public.link_evidences TO authenticated;
REVOKE UPDATE, DELETE ON public.link_evidences FROM anon, authenticated;

CREATE POLICY upload_owner_select ON public.photo_upload_sessions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY upload_owner_insert ON public.photo_upload_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY upload_owner_update ON public.photo_upload_sessions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.photo_upload_sessions TO authenticated;
REVOKE DELETE ON public.photo_upload_sessions FROM anon, authenticated;

CREATE POLICY relation_owner_select ON public.activity_evidences FOR SELECT TO authenticated
  USING (attached_by = (SELECT auth.uid()));
CREATE POLICY relation_owner_insert ON public.activity_evidences FOR INSERT TO authenticated
  WITH CHECK (attached_by = (SELECT auth.uid()));
CREATE POLICY relation_owner_delete ON public.activity_evidences FOR DELETE TO authenticated
  USING (attached_by = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON public.activity_evidences TO authenticated;
REVOKE UPDATE ON public.activity_evidences FROM anon, authenticated;

REVOKE ALL ON public.storage_reconciliation_jobs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_storage_reconciliation(
  p_evidence_id UUID, p_drive_file_id TEXT, p_reason TEXT, p_error TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid();
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.evidences
    WHERE id = p_evidence_id AND user_id = actor AND type = 'PHOTO') THEN
    RAISE EXCEPTION 'Evidence unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_drive_file_id IS NULL OR length(p_drive_file_id) NOT BETWEEN 1 AND 256
     OR p_reason NOT IN ('UPLOAD_FINALIZE_FAILED', 'DRIVE_DELETE_FAILED') THEN
    RAISE EXCEPTION 'Invalid reconciliation input' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.storage_reconciliation_jobs
    (user_id, evidence_id, drive_file_id, reason, last_error)
  VALUES (actor, p_evidence_id, p_drive_file_id, p_reason, left(p_error, 256))
  ON CONFLICT (evidence_id, drive_file_id, reason) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_storage_reconciliation(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_storage_reconciliation(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
