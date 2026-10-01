-- =============================================================================
-- Migration: Phase 6 — Interactive Todo Kanban & Evidence Gates
-- =============================================================================

-- 1. Todo Stages Reference Table
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

-- Seed default stages idempotently
INSERT INTO public.todo_stages (code, name, position, requires_evidence_on_enter, requires_evidence_on_exit, minimum_evidence_count, allowed_evidence_types, requires_note, is_terminal)
VALUES
  ('BACKLOG',     'Backlog',     10, false, false, 0, NULL, false, false),
  ('TODO',        'To Do',       20, false, false, 0, NULL, false, false),
  ('IN_PROGRESS', 'In Progress', 30, false, false, 0, NULL, false, false),
  ('REVIEW',      'Review',      40, true,  false, 1, array['PHOTO', 'LINK'], false, false),
  ('DONE',        'Done',        50, true,  false, 1, array['PHOTO', 'LINK'], false, true)
ON CONFLICT (code) DO NOTHING;

-- RLS for todo_stages
ALTER TABLE public.todo_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY todo_stages_read_authenticated ON public.todo_stages
  FOR SELECT TO authenticated
  USING (true);


-- 2. Todos Table
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

-- Indexes for Todos
CREATE INDEX IF NOT EXISTS idx_todos_user_stage_sort ON public.todos (user_id, current_stage_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date   ON public.todos (user_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_deleted    ON public.todos (user_id, deleted_at);

-- Trigger for updated_at on todos
CREATE TRIGGER set_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS for todos
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY todos_owner_select ON public.todos
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY todos_owner_insert ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY todos_owner_update ON public.todos
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY todos_owner_delete ON public.todos
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- 3. Todo Transitions History (Immutable audit)
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

-- RLS for todo_transitions: users can SELECT own history and INSERT through service, no UPDATE/DELETE
ALTER TABLE public.todo_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY todo_transitions_owner_select ON public.todo_transitions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY todo_transitions_owner_insert ON public.todo_transitions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));


-- 4. Todo Evidences (Stage-specific or overall proof of work)
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

-- RLS for todo_evidences
ALTER TABLE public.todo_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY todo_evidences_owner_select ON public.todo_evidences
  FOR SELECT TO authenticated
  USING (
    attached_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id AND t.user_id = (SELECT auth.uid())
    )
  );

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

CREATE POLICY todo_evidences_owner_delete ON public.todo_evidences
  FOR DELETE TO authenticated
  USING (
    attached_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id AND t.user_id = (SELECT auth.uid())
    )
  );


-- 5. Activity linkage: optional todo_id reference
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS todo_id UUID NULL REFERENCES public.todos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_todo_id ON public.activities (todo_id);
