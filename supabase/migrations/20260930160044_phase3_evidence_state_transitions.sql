CREATE OR REPLACE FUNCTION public.guard_evidence_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'UPLOADING' AND NEW.status IN ('AVAILABLE', 'FAILED', 'ORPHANED'))
    OR (OLD.status = 'FAILED' AND NEW.status IN ('UPLOADING', 'DELETE_PENDING'))
    OR (OLD.status = 'ORPHANED' AND NEW.status = 'FAILED')
    OR (OLD.status = 'AVAILABLE' AND NEW.status IN ('BROKEN', 'DELETE_PENDING'))
    OR (OLD.status = 'BROKEN' AND NEW.status = 'DELETE_PENDING')
    OR (OLD.status = 'DELETE_PENDING' AND NEW.status = 'DELETED')
  ) THEN
    RAISE EXCEPTION 'Invalid evidence status transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_evidence_status_transition
  BEFORE UPDATE ON public.evidences FOR EACH ROW
  EXECUTE FUNCTION public.guard_evidence_status_transition();
