-- =============================================================================
-- InternFlow: Combined Remaining Migrations (Phase 4, Phase 6, Phase 7)
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

-- =============================================================================
-- SECTION 1: PHASE 4 (Internship Settings & Logbook View)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.internship_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NULL,
  end_date DATE NULL,
  working_days SMALLINT[] NOT NULL DEFAULT array[1,2,3,4,5],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT internship_settings_date_order CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT internship_settings_working_days_range CHECK (
    working_days <@ array[1,2,3,4,5,6,7]::smallint[]
    AND cardinality(working_days) >= 1
    AND cardinality(working_days) <= 7
  )
);

CREATE INDEX IF NOT EXISTS internship_settings_user_idx ON public.internship_settings (user_id);

CREATE OR REPLACE FUNCTION public.guard_internship_settings()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  unique_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Settings owner is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(DISTINCT d) INTO unique_count FROM unnest(NEW.working_days) AS d;
  IF unique_count <> cardinality(NEW.working_days) THEN
    RAISE EXCEPTION 'Working days must be unique' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_internship_settings_write ON public.internship_settings;
CREATE TRIGGER guard_internship_settings_write
  BEFORE INSERT OR UPDATE ON public.internship_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_internship_settings();

DROP TRIGGER IF EXISTS set_internship_settings_updated_at ON public.internship_settings;
CREATE TRIGGER set_internship_settings_updated_at
  BEFORE UPDATE ON public.internship_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.internship_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internship_settings_owner_select ON public.internship_settings;
CREATE POLICY internship_settings_owner_select ON public.internship_settings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS internship_settings_owner_insert ON public.internship_settings;
CREATE POLICY internship_settings_owner_insert ON public.internship_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS internship_settings_owner_update ON public.internship_settings;
CREATE POLICY internship_settings_owner_update ON public.internship_settings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE DELETE ON public.internship_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.internship_settings TO authenticated;

CREATE OR REPLACE VIEW public.logbook_activities WITH (security_invoker = true) AS
SELECT
  a.id,
  a.user_id,
  a.title,
  a.description,
  a.activity_date,
  a.start_time,
  a.end_time,
  a.source,
  a.status,
  a.needs_description,
  a.version,
  a.created_at,
  a.updated_at,
  a.deleted_at,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'PHOTO')::integer AS photo_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.type = 'LINK')::integer AS link_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'BROKEN')::integer AS broken_count,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL)::integer AS total_evidence_count
FROM public.activities a
LEFT JOIN public.activity_evidences ae ON ae.activity_id = a.id AND ae.attached_by = a.user_id
LEFT JOIN public.evidences e ON e.id = ae.evidence_id AND e.user_id = a.user_id
WHERE a.deleted_at IS NULL
GROUP BY a.id;

REVOKE ALL ON public.logbook_activities FROM PUBLIC, anon;
GRANT SELECT ON public.logbook_activities TO authenticated;

-- =============================================================================
-- SECTION 2: PHASE 6 (Interactive Todo Kanban & Evidence Gates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.todo_stages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT UNIQUE NOT NULL,
  name                        TEXT NOT NULL,
  position                    INT NOT NULL,
  requires_evidence_on_enter  BOOLEAN NOT NULL DEFAULT false,
  requires_evidence_on_exit   BOOLEAN NOT NULL DEFAULT false,
  minimum_evidence_count      INT NOT NULL DEFAULT 0,
  allowed_evidence_types      TEXT[] NULL,
  requires_note               BOOLEAN NOT NULL DEFAULT false,
  is_terminal                 BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.todo_stages (code, name, position, requires_evidence_on_enter, requires_evidence_on_exit, minimum_evidence_count, allowed_evidence_types, requires_note, is_terminal)
VALUES
  ('BACKLOG',     'Backlog',     10, false, false, 0, NULL, false, false),
  ('TODO',        'To Do',       20, false, false, 0, NULL, false, false),
  ('IN_PROGRESS', 'In Progress', 30, false, false, 0, NULL, false, false),
  ('REVIEW',      'Review',      40, true,  false, 1, array['PHOTO', 'LINK'], false, false),
  ('DONE',        'Done',        50, true,  false, 1, array['PHOTO', 'LINK'], false, true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.todo_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS todo_stages_read_authenticated ON public.todo_stages;
CREATE POLICY todo_stages_read_authenticated ON public.todo_stages
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.todos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NULL,
  priority         TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_date         DATE NULL,
  current_stage_id UUID NOT NULL REFERENCES public.todo_stages(id),
  sort_order       NUMERIC NOT NULL DEFAULT 1000,
  evidence_health  TEXT NOT NULL DEFAULT 'OK' CHECK (evidence_health IN ('OK', 'EVIDENCE_INCOMPLETE')),
  version          INT NOT NULL DEFAULT 1,
  started_at       TIMESTAMPTZ NULL,
  completed_at     TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_user_stage_sort ON public.todos (user_id, current_stage_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date   ON public.todos (user_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_deleted    ON public.todos (user_id, deleted_at);

DROP TRIGGER IF EXISTS set_todos_updated_at ON public.todos;
CREATE TRIGGER set_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS todos_owner_select ON public.todos;
CREATE POLICY todos_owner_select ON public.todos
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS todos_owner_insert ON public.todos;
CREATE POLICY todos_owner_insert ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS todos_owner_update ON public.todos;
CREATE POLICY todos_owner_update ON public.todos
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS todos_owner_delete ON public.todos;
CREATE POLICY todos_owner_delete ON public.todos
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.todo_transitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id         UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stage_id   UUID NULL REFERENCES public.todo_stages(id),
  to_stage_id     UUID NOT NULL REFERENCES public.todo_stages(id),
  note            TEXT NULL,
  evidence_count  INT NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_todo_transitions_user_idempotency UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_todo_transitions_todo ON public.todo_transitions (todo_id, created_at DESC);

ALTER TABLE public.todo_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS todo_transitions_owner_select ON public.todo_transitions;
CREATE POLICY todo_transitions_owner_select ON public.todo_transitions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS todo_transitions_owner_insert ON public.todo_transitions;
CREATE POLICY todo_transitions_owner_insert ON public.todo_transitions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.todo_evidences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id     UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES public.evidences(id) ON DELETE CASCADE,
  stage_id    UUID NULL REFERENCES public.todo_stages(id) ON DELETE CASCADE,
  attached_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_todo_evidence_stage UNIQUE NULLS NOT DISTINCT (todo_id, evidence_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_todo_evidences_todo ON public.todo_evidences (todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_evidences_evidence ON public.todo_evidences (evidence_id);

ALTER TABLE public.todo_evidences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS todo_evidences_owner_select ON public.todo_evidences;
CREATE POLICY todo_evidences_owner_select ON public.todo_evidences
  FOR SELECT TO authenticated
  USING (
    attached_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id AND t.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS todo_evidences_owner_insert ON public.todo_evidences;
CREATE POLICY todo_evidences_owner_insert ON public.todo_evidences
  FOR INSERT TO authenticated
  WITH CHECK (
    attached_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id AND t.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.evidences e
      WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS todo_evidences_owner_delete ON public.todo_evidences;
CREATE POLICY todo_evidences_owner_delete ON public.todo_evidences
  FOR DELETE TO authenticated
  USING (
    attached_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id AND t.user_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS todo_id UUID NULL REFERENCES public.todos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_todo_id ON public.activities (todo_id);

-- =============================================================================
-- SECTION 3: PHASE 7 (GitHub Integration & Tokens Table)
-- =============================================================================

ALTER TABLE public.evidences DROP CONSTRAINT IF EXISTS evidences_type_check;
ALTER TABLE public.evidences ADD CONSTRAINT evidences_type_check
  CHECK (type IN ('PHOTO', 'LINK', 'GITHUB_COMMIT'));

UPDATE public.todo_stages
SET allowed_evidence_types = array['PHOTO', 'LINK', 'GITHUB_COMMIT']
WHERE code IN ('REVIEW', 'DONE');

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

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS github_connections_select_own ON public.github_connections;
CREATE POLICY github_connections_select_own ON public.github_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS github_connections_update_own ON public.github_connections;
CREATE POLICY github_connections_update_own ON public.github_connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The critical github_tokens table
CREATE TABLE IF NOT EXISTS public.github_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token        TEXT NOT NULL,
  token_type          TEXT NOT NULL DEFAULT 'bearer',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.github_tokens FROM anon, authenticated, public;

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

ALTER TABLE public.github_commits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS github_commits_select_own ON public.github_commits;
CREATE POLICY github_commits_select_own ON public.github_commits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

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

ALTER TABLE public.github_evidences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS github_evidences_select_own ON public.github_evidences;
CREATE POLICY github_evidences_select_own ON public.github_evidences
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS github_evidences_insert_own ON public.github_evidences;
CREATE POLICY github_evidences_insert_own ON public.github_evidences
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evidences e
    WHERE e.id = evidence_id AND e.user_id = auth.uid()
  ));

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
