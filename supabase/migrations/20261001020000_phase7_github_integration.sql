-- =============================================================================
-- Migration: Phase 7 — Optional GitHub Integration & Commit Evidence
-- =============================================================================

-- 1. Extend evidences type check constraint
ALTER TABLE public.evidences DROP CONSTRAINT IF EXISTS evidences_type_check;
ALTER TABLE public.evidences ADD CONSTRAINT evidences_type_check
  CHECK (type IN ('PHOTO', 'LINK', 'GITHUB_COMMIT'));

-- 2. Update default todo_stages allowed_evidence_types to include GITHUB_COMMIT
UPDATE public.todo_stages
SET allowed_evidence_types = array['PHOTO', 'LINK', 'GITHUB_COMMIT']
WHERE code IN ('REVIEW', 'DONE');

-- 3. github_connections table
CREATE TABLE IF NOT EXISTS public.github_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user_id      TEXT NOT NULL,
  github_username     TEXT NOT NULL,
  connection_status   TEXT NOT NULL CHECK (connection_status IN ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR')),
  scopes              TEXT[] NULL,
  connected_at        TIMESTAMPTZ NULL,
  last_synced_at      TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_connections_user ON public.github_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_status ON public.github_connections (connection_status);

-- RLS for github_connections
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_connections_select_own ON public.github_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY github_connections_update_own ON public.github_connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. github_tokens table (Strictly Server-Only / Service Role)
CREATE TABLE IF NOT EXISTS public.github_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token        TEXT NOT NULL,
  token_type          TEXT NOT NULL DEFAULT 'bearer',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Complete lockdown of tokens from any client access
ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.github_tokens FROM anon, authenticated, public;

-- 5. github_commits table
CREATE TABLE IF NOT EXISTS public.github_commits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_connection_id UUID NOT NULL REFERENCES public.github_connections(id) ON DELETE CASCADE,
  repository_id       TEXT NOT NULL,
  repository_name     TEXT NOT NULL,
  sha                 TEXT NOT NULL,
  message             TEXT NULL,
  commit_url          TEXT NULL,
  branch              TEXT NULL,
  author_date         TIMESTAMPTZ NULL,
  source_status       TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (source_status IN ('AVAILABLE', 'SOURCE_UNAVAILABLE', 'STALE')),
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_github_commits_user_repo_sha UNIQUE (user_id, repository_id, sha)
);

CREATE INDEX IF NOT EXISTS idx_github_commits_user_date ON public.github_commits (user_id, author_date DESC);
CREATE INDEX IF NOT EXISTS idx_github_commits_repo ON public.github_commits (user_id, repository_name);

-- RLS for github_commits
ALTER TABLE public.github_commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_commits_select_own ON public.github_commits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 6. github_evidences subtype table
CREATE TABLE IF NOT EXISTS public.github_evidences (
  evidence_id         UUID PRIMARY KEY REFERENCES public.evidences(id) ON DELETE CASCADE,
  github_commit_id    UUID NULL REFERENCES public.github_commits(id) ON DELETE SET NULL,
  commit_url          TEXT NOT NULL CHECK (commit_url ~* '^https?://[^[:space:]]+$' AND length(commit_url) <= 2048),
  repository_name     TEXT NOT NULL,
  sha                 TEXT NOT NULL CHECK (length(sha) >= 7 AND length(sha) <= 40),
  message             TEXT NULL,
  author_date         TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_github_evidences_commit ON public.github_evidences (github_commit_id);

-- RLS for github_evidences
ALTER TABLE public.github_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_evidences_select_own ON public.github_evidences
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = auth.uid()
  ));

CREATE POLICY github_evidences_insert_own ON public.github_evidences
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = auth.uid()
  ));

-- 7. Update public.evidence_library view to surface commit details
DROP VIEW IF EXISTS public.evidence_library;
CREATE OR REPLACE VIEW public.evidence_library WITH (security_invoker = true) AS
SELECT
  e.id,
  e.user_id,
  e.type,
  e.title,
  e.note,
  e.status,
  e.captured_at,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  p.mime_type,
  p.size_bytes,
  p.width,
  p.height,
  COALESCE(l.url, ge.commit_url) AS url,
  ge.repository_name,
  ge.sha,
  ge.message AS commit_message,
  (SELECT count(*)::integer FROM public.activity_evidences ae
   WHERE ae.evidence_id = e.id) AS assignment_count
FROM public.evidences e
LEFT JOIN public.photo_evidences p ON p.evidence_id = e.id
LEFT JOIN public.link_evidences l ON l.evidence_id = e.id
LEFT JOIN public.github_evidences ge ON ge.evidence_id = e.id;

REVOKE ALL ON public.evidence_library FROM PUBLIC, anon;
GRANT SELECT ON public.evidence_library TO authenticated;
