-- Integration regression suite. Fixtures and all mutations roll back.
BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); t uuid; foreign_t uuid; c uuid; cb uuid; backlog uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(a,'phase8-a-'||a||'@example.invalid','{}','{}'),(b,'phase8-b-'||b||'@example.invalid','{}','{}');
  SELECT id INTO backlog FROM public.todo_stages WHERE code='BACKLOG';
  INSERT INTO public.todos(user_id,title,current_stage_id) VALUES(a,'Phase 8 regression',backlog) RETURNING id INTO t;
  INSERT INTO public.todos(user_id,title,current_stage_id) VALUES(b,'Foreign Todo',backlog) RETURNING id INTO foreign_t;
  PERFORM set_config('qa.foreign_todo',foreign_t::text,true);
  PERFORM public.store_github_connection(a,'12345','qa-owner',ARRAY['read:user'],'v1.test.fixture','bearer',false);
  INSERT INTO public.github_commits(user_id,github_connection_id,repository_id,repository_name,sha,message,commit_url)
    SELECT a,id,'10','qa-owner/repo',repeat('a',40),'Test commit','https://github.com/qa-owner/repo/commit/'||repeat('a',40) FROM public.github_connections WHERE user_id=a RETURNING id INTO c;
  PERFORM public.store_github_connection(b,'12346','qa-other',ARRAY['read:user'],'v1.test.fixture','bearer',false);
  INSERT INTO public.github_commits(user_id,github_connection_id,repository_id,repository_name,sha,message,commit_url)
    SELECT b,id,'11','qa-other/repo',repeat('b',40),'Other commit','https://github.com/qa-other/repo/commit/'||repeat('b',40) FROM public.github_connections WHERE user_id=b RETURNING id INTO cb;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  PERFORM set_config('qa.owner',a::text,true); PERFORM set_config('qa.other',b::text,true);
  PERFORM set_config('qa.todo',t::text,true); PERFORM set_config('qa.commit',c::text,true); PERFORM set_config('qa.foreign_commit',cb::text,true);
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE t uuid:=current_setting('qa.todo')::uuid; owner_id uuid:=current_setting('qa.owner')::uuid; st_todo uuid; st_progress uuid; st_review uuid; st_done uuid; result jsonb; proof_id uuid; activity_id uuid; replay_id uuid; item_count integer;
BEGIN
  SELECT id INTO st_todo FROM public.todo_stages WHERE code='TODO';
  SELECT id INTO st_progress FROM public.todo_stages WHERE code='IN_PROGRESS';
  SELECT id INTO st_review FROM public.todo_stages WHERE code='REVIEW';
  SELECT id INTO st_done FROM public.todo_stages WHERE code='DONE';
  BEGIN UPDATE public.todos SET current_stage_id=st_done WHERE id=t; RAISE EXCEPTION 'Direct stage update was allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.todos(user_id,title,current_stage_id) VALUES(owner_id,'Bypass',st_done); RAISE EXCEPTION 'Done creation was allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  result:=public.transition_todo(t,st_done,1,'jump');
  IF result->>'code'<>'INVALID_TRANSITION' THEN RAISE EXCEPTION 'Stage jump accepted: %',result; END IF;
  result:=public.transition_todo(t,st_todo,1,'first');
  IF NOT (result->>'ok')::boolean OR (result->>'newVersion')::integer<>2 THEN RAISE EXCEPTION 'Valid move failed: %',result; END IF;
  result:=public.transition_todo(t,st_todo,1,'first');
  IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Idempotent replay failed: %',result; END IF;
  result:=public.transition_todo(t,st_progress,2,'first');
  IF result->>'code'<>'CONFLICT' THEN RAISE EXCEPTION 'Idempotency key reuse accepted'; END IF;
  result:=public.transition_todo(t,st_progress,1,'stale');
  IF result->>'code'<>'CONFLICT' THEN RAISE EXCEPTION 'Stale version accepted'; END IF;
  result:=public.transition_todo(t,st_progress,2,'second');
  IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Progress move failed'; END IF;
  result:=public.transition_todo(t,st_review,3,'no-evidence');
  IF result->>'code'<>'EVIDENCE_REQUIRED' THEN RAISE EXCEPTION 'Review gate bypassed: %',result; END IF;
  result:=public.select_github_commit_evidence(current_setting('qa.foreign_commit')::uuid,NULL,t);
  IF (result->>'ok')::boolean THEN RAISE EXCEPTION 'Foreign commit selected'; END IF;
  result:=public.select_github_commit_evidence(current_setting('qa.commit')::uuid,NULL,t);
  IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Own commit selection failed: %',result; END IF;
  proof_id:=(result->>'evidenceId')::uuid;
  result:=public.select_github_commit_evidence(current_setting('qa.commit')::uuid,NULL,t);
  IF NOT (result->>'reused')::boolean OR (result->>'evidenceId')::uuid<>proof_id THEN RAISE EXCEPTION 'Duplicate commit evidence'; END IF;
  result:=public.transition_todo(t,st_review,3,'third');
  IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'GitHub evidence did not satisfy gate: %',result; END IF;
  result:=public.transition_todo(t,st_done,4,'fourth');
  IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Done move failed: %',result; END IF;
  SELECT count(*) INTO item_count FROM public.todo_transitions WHERE todo_id=t;
  IF item_count<>4 THEN RAISE EXCEPTION 'History mismatch: %',item_count; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.todos WHERE id=t AND started_at IS NOT NULL AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'Timestamps missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.evidence_library WHERE id=proof_id AND assignment_count=1) THEN RAISE EXCEPTION 'Todo assignment missing from library'; END IF;
  PERFORM public.begin_evidence_delete(proof_id,false);
  IF NOT EXISTS(SELECT 1 FROM public.evidences WHERE id=proof_id AND status='AVAILABLE') THEN RAISE EXCEPTION 'Assigned evidence was deleted without confirmation'; END IF;
  DELETE FROM public.todo_evidences te WHERE te.todo_id=t AND te.evidence_id=proof_id;
  IF NOT EXISTS(SELECT 1 FROM public.todos WHERE id=t AND current_stage_id=st_done AND evidence_health='EVIDENCE_INCOMPLETE') THEN RAISE EXCEPTION 'Done health did not update after detach'; END IF;
  PERFORM set_config('qa.evidence',proof_id::text,true);
  SELECT id INTO activity_id FROM public.create_activity('linked-create','Todo work','Details',current_date,NULL,NULL,'todo','READY',t);
  IF NOT EXISTS(SELECT 1 FROM public.activities WHERE id=activity_id AND todo_id=t AND version=1 AND source='todo') THEN RAISE EXCEPTION 'Atomic Activity Todo association failed'; END IF;
  SELECT id INTO replay_id FROM public.create_activity('linked-create','Todo work','Details',current_date,NULL,NULL,'todo','READY',t);
  IF replay_id<>activity_id THEN RAISE EXCEPTION 'Activity idempotency duplicated'; END IF;
  BEGIN PERFORM public.create_activity('linked-create','Changed work','Details',current_date,NULL,NULL,'todo','READY',t); RAISE EXCEPTION 'Activity key reuse accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN PERFORM public.create_activity('foreign-create','Cross owner','Details',current_date,NULL,NULL,'todo','READY',current_setting('qa.foreign_todo')::uuid); RAISE EXCEPTION 'Foreign Todo Activity creation accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.activities WHERE title='Cross owner') OR EXISTS(SELECT 1 FROM public.mutation_idempotency WHERE key='foreign-create') THEN RAISE EXCEPTION 'Failed create left partial data'; END IF;
  BEGIN UPDATE public.activities SET todo_id=current_setting('qa.foreign_todo')::uuid,version=version+1 WHERE id=activity_id; RAISE EXCEPTION 'Direct cross-owner linking accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) VALUES(activity_id,proof_id,owner_id);
  IF NOT EXISTS(SELECT 1 FROM public.logbook_activities WHERE id=activity_id AND github_count=1 AND photo_count=0 AND total_evidence_count=1) THEN RAISE EXCEPTION 'Logbook GitHub projection is wrong'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_activity_days(current_date,current_date)) day WHERE (day->>'has_ready')::boolean) THEN RAISE EXCEPTION 'Unpaginated day overview missing'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('qa.other'),true);
  IF EXISTS(SELECT 1 FROM public.todos WHERE id=t) THEN RAISE EXCEPTION 'RLS leaked another owner Todo'; END IF;
END;
$$;
RESET ROLE;
DO $$
DECLARE a uuid:=current_setting('qa.owner')::uuid; nonce uuid:=gen_random_uuid(); lease jsonb; original_version integer;
BEGIN
  lease:=public.begin_github_sync(a,nonce);
  IF NOT (lease->>'ok')::boolean THEN RAISE EXCEPTION 'Sync lease failed'; END IF;
  original_version:=(lease->'connection'->>'version')::integer;
  lease:=public.begin_github_sync(a,gen_random_uuid());
  IF lease->>'code'<>'SYNC_IN_PROGRESS' THEN RAISE EXCEPTION 'Parallel sync accepted'; END IF;
  BEGIN PERFORM public.store_github_connection(a,'99999','qa-changed',ARRAY['read:user'],'v1.test.fixture','bearer',false); RAISE EXCEPTION 'Account replacement accepted without confirmation'; EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.disconnect_github(a);
  IF public.finish_github_sync(a,original_version,nonce,'[]',true,false,'{}') THEN RAISE EXCEPTION 'Stale sync survived disconnect'; END IF;
  IF EXISTS(SELECT 1 FROM public.github_tokens WHERE user_id=a) THEN RAISE EXCEPTION 'Token survived disconnect'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.github_evidences WHERE evidence_id=current_setting('qa.evidence')::uuid) THEN RAISE EXCEPTION 'Disconnect removed historical evidence'; END IF;
END;
$$;
ROLLBACK;
SELECT 'Phase 8 database regression suite passed; all fixtures rolled back.' AS result;
