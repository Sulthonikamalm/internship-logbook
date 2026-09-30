-- =============================================================================
-- Migration: audit_logs table
-- Foundation for tracking critical mutations.
-- Ordinary users cannot UPDATE or DELETE audit records.
-- =============================================================================

CREATE TABLE public.audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     UUID        NULL,
  action        TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  request_id    TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX idx_audit_logs_actor    ON public.audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_entity   ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created  ON public.audit_logs (created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Append-only audit trail. Password/token/secret values MUST NEVER be stored in metadata.';

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Ordinary users: SELECT only their own audit logs
CREATE POLICY "Users can read own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (actor_user_id = auth.uid());

-- No UPDATE/DELETE for ordinary users — policies are deny-by-default
-- INSERT is handled by server/trusted layer only (service role bypasses RLS)
