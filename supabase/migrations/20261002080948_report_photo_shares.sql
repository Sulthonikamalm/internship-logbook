-- A report can grant access only to the photos explicitly included in that export.
-- Raw bearer tokens are never persisted; no browser role may query these tables.
CREATE TABLE public.report_photo_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  work_category text NOT NULL CHECK (work_category IN ('INTERNSHIP','THESIS','PERSONAL')),
  period_from date NOT NULL,
  period_to date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT report_share_period_valid CHECK (period_from <= period_to),
  CONSTRAINT report_share_expiry_valid CHECK (expires_at > created_at AND expires_at <= created_at + interval '180 days'),
  UNIQUE(user_id,id)
);
CREATE INDEX report_photo_shares_owner_created_idx ON public.report_photo_shares(user_id,created_at DESC);

CREATE TABLE public.report_photo_share_evidences (
  share_id uuid NOT NULL,
  user_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  PRIMARY KEY(share_id,evidence_id),
  FOREIGN KEY(user_id,share_id) REFERENCES public.report_photo_shares(user_id,id) ON DELETE CASCADE,
  FOREIGN KEY(user_id,evidence_id) REFERENCES public.evidences(user_id,id) ON DELETE CASCADE
);
CREATE INDEX report_photo_share_evidences_owner_idx ON public.report_photo_share_evidences(user_id,evidence_id);

ALTER TABLE public.report_photo_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_photo_share_evidences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_photo_shares, public.report_photo_share_evidences FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.report_photo_shares, public.report_photo_share_evidences TO service_role;
