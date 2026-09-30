CREATE POLICY reconciliation_owner_insert ON public.storage_reconciliation_jobs
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.evidences e
      WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid()) AND e.type = 'PHOTO'
    )
  );
GRANT INSERT ON public.storage_reconciliation_jobs TO authenticated;

ALTER FUNCTION public.record_storage_reconciliation(UUID, TEXT, TEXT, TEXT)
  SECURITY INVOKER;

CREATE INDEX activity_evidences_owner_activity_idx
  ON public.activity_evidences (attached_by, activity_id);
CREATE INDEX activity_evidences_owner_evidence_idx
  ON public.activity_evidences (attached_by, evidence_id);
CREATE INDEX photo_upload_sessions_owner_evidence_idx
  ON public.photo_upload_sessions (user_id, evidence_id);
CREATE INDEX storage_reconciliation_owner_idx
  ON public.storage_reconciliation_jobs (user_id);
