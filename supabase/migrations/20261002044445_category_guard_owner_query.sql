-- Keep the trigger invoker-scoped; no public access to private helper functions.
CREATE OR REPLACE FUNCTION private.guard_todo_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE stage_code text; stage public.todo_stages; valid_count integer;
BEGIN
  IF NEW.work_category = 'PERSONAL' THEN NEW.auto_record_activity := false; NEW.evidence_health := 'OK'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.work_category IS DISTINCT FROM OLD.work_category THEN
    SELECT * INTO stage FROM public.todo_stages WHERE id = OLD.current_stage_id;
    IF stage.is_terminal THEN RAISE EXCEPTION 'Reopen Todo before changing category' USING ERRCODE='23514'; END IF;
    IF NEW.work_category <> 'PERSONAL' AND stage.requires_evidence_on_enter THEN
      SELECT count(DISTINCT e.id) INTO valid_count FROM public.todo_evidences te JOIN public.evidences e ON e.id=te.evidence_id
        WHERE te.todo_id=NEW.id AND e.user_id=NEW.user_id AND e.status='AVAILABLE' AND e.deleted_at IS NULL
        AND (stage.allowed_evidence_types IS NULL OR e.type=ANY(stage.allowed_evidence_types));
      IF valid_count < stage.minimum_evidence_count THEN RAISE EXCEPTION 'Evidence required for this category' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active) THEN
      RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' THEN
      SELECT code INTO stage_code FROM public.todo_stages WHERE id = NEW.current_stage_id;
      IF stage_code NOT IN ('BACKLOG','TODO') OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.version <> 1 OR NEW.evidence_health <> 'OK' THEN
        RAISE EXCEPTION 'New Todo must start in Backlog or To Do' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutable Todo identity' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END;
$$;
