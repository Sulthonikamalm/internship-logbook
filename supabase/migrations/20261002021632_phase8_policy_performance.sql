-- Cover owner reads and foreign-key maintenance without removing low-traffic indexes.
CREATE INDEX github_commits_connection_idx ON public.github_commits(github_connection_id);
CREATE INDEX todo_evidences_owner_todo_idx ON public.todo_evidences(attached_by,todo_id);
CREATE INDEX todo_evidences_stage_idx ON public.todo_evidences(stage_id);
CREATE INDEX todo_transitions_from_stage_idx ON public.todo_transitions(from_stage_id);
CREATE INDEX todo_transitions_to_stage_idx ON public.todo_transitions(to_stage_id);
CREATE INDEX todos_stage_idx ON public.todos(current_stage_id);
ALTER POLICY github_connections_select_own ON public.github_connections USING (user_id = (SELECT auth.uid()));
ALTER POLICY github_commits_select_own ON public.github_commits USING (user_id = (SELECT auth.uid()));
ALTER POLICY github_evidences_select_own ON public.github_evidences USING
  (EXISTS(SELECT 1 FROM public.evidences e WHERE e.id = evidence_id AND e.user_id = (SELECT auth.uid())));
-- These writes are intentionally handled by service transactions or a guarded selection RPC.
DROP POLICY github_connections_update_own ON public.github_connections;
DROP POLICY github_evidences_insert_own ON public.github_evidences;
