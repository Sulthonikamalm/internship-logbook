-- Cover composite ownership FKs and duplicate-photo lookups used by Codex.
CREATE INDEX logbook_sources_owner_activity_idx
  ON public.logbook_activity_sources(user_id,activity_id);
CREATE INDEX logbook_generated_owner_activity_idx
  ON public.logbook_generated_items(user_id,activity_id);
CREATE INDEX logbook_allocations_owner_activity_idx
  ON public.logbook_photo_allocations(user_id,activity_id);
CREATE INDEX logbook_allocations_owner_evidence_idx
  ON public.logbook_photo_allocations(user_id,evidence_id);
CREATE INDEX photo_evidences_checksum_evidence_idx
  ON public.photo_evidences(checksum,evidence_id);
