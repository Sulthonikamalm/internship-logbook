-- A reopened task may change category without rewriting older activity records.
CREATE OR REPLACE FUNCTION private.guard_activity_category() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    IF TG_OP='INSERT' AND NEW.completion_transition_id IS NOT NULL THEN RAISE EXCEPTION 'Completion records are created by the server' USING ERRCODE='42501'; END IF;
    IF (TG_OP='INSERT' OR NEW.work_category IS DISTINCT FROM OLD.work_category OR NEW.todo_id IS DISTINCT FROM OLD.todo_id)
      AND NEW.todo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.todos WHERE id=NEW.todo_id AND user_id=NEW.user_id AND work_category=NEW.work_category) THEN
      RAISE EXCEPTION 'Todo category mismatch' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
