-- All synthetic users/data roll back. Run after the workspace-v2 migrations.
BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); photo uuid;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 VALUES(a,'workspace-a-'||a||'@example.invalid','{}','{}'),(b,'workspace-b-'||b||'@example.invalid','{}','{}');
 INSERT INTO public.evidences(user_id,type,status,upload_id) VALUES(a,'PHOTO','UPLOADING',gen_random_uuid()) RETURNING id INTO photo;
 INSERT INTO public.photo_evidences(evidence_id,drive_file_id,drive_folder_id,stored_filename,mime_type,size_bytes,checksum) VALUES(photo,'qa-file-'||photo,'qa-folder','qa.png','image/png',10,repeat('a',64));
 UPDATE public.evidences SET status='AVAILABLE' WHERE id=photo;
 PERFORM set_config('qa.photo',photo::text,true);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 PERFORM set_config('qa.owner',a::text,true); PERFORM set_config('qa.other',b::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE owner_id uuid:=current_setting('qa.owner')::uuid; backlog uuid; done uuid; review uuid;
 personal uuid; internship uuid; thesis uuid; manual uuid; proof uuid; result jsonb; created_activity uuid; completion_id uuid; capture uuid; replay uuid; new_todo uuid;
BEGIN
 SELECT id INTO backlog FROM public.todo_stages WHERE code='BACKLOG';
 SELECT id INTO done FROM public.todo_stages WHERE code='DONE';
 SELECT id INTO review FROM public.todo_stages WHERE code='REVIEW';
 SELECT id INTO new_todo FROM public.create_todo('create-once','Retry task',NULL,'MEDIUM',NULL,backlog,'PERSONAL',true);
 SELECT id INTO replay FROM public.create_todo('create-once','Retry task',NULL,'MEDIUM',NULL,backlog,'PERSONAL',true);
 IF replay<>new_todo OR (SELECT count(*) FROM public.todos WHERE title='Retry task')<>1 THEN RAISE EXCEPTION 'Todo creation retry duplicated'; END IF;
 BEGIN PERFORM public.create_todo('create-once','Changed task',NULL,'MEDIUM',NULL,backlog,'PERSONAL',true); RAISE EXCEPTION 'Todo key accepted changed payload'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.create_todo('terminal','Bypass',NULL,'MEDIUM',NULL,done,'PERSONAL',false); RAISE EXCEPTION 'RPC created terminal Todo'; EXCEPTION WHEN check_violation THEN NULL; END;
 SELECT id INTO capture FROM public.create_photo_only_activity('capture-once',current_setting('qa.photo')::uuid,current_date,'THESIS');
 SELECT id INTO replay FROM public.create_photo_only_activity('capture-once',current_setting('qa.photo')::uuid,current_date,'THESIS');
 IF capture<>replay OR NOT EXISTS(SELECT 1 FROM public.activities WHERE id=capture AND work_category='THESIS') THEN RAISE EXCEPTION 'Categorized capture/retry failed'; END IF;
 BEGIN PERFORM public.create_photo_only_activity('capture-once',current_setting('qa.photo')::uuid,current_date,'PERSONAL'); RAISE EXCEPTION 'Capture category key reuse accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO public.todos(user_id,title,current_stage_id,work_category) VALUES(owner_id,'Personal selesai',backlog,'PERSONAL') RETURNING id INTO personal;
 IF EXISTS(SELECT 1 FROM public.todos WHERE id=personal AND auto_record_activity) THEN RAISE EXCEPTION 'Personal auto-record was enabled'; END IF;
 result:=public.transition_todo(personal,done,1,'personal-complete');
 IF NOT (result->>'ok')::boolean OR result->>'activityId' IS NOT NULL THEN RAISE EXCEPTION 'Personal completion failed: %',result; END IF;
 IF EXISTS(SELECT 1 FROM public.activities WHERE todo_id=personal) THEN RAISE EXCEPTION 'Personal contaminated internship logbook'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.todo_transitions WHERE todo_id=personal AND work_category='PERSONAL' AND completion_snapshot->>'title'='Personal selesai') THEN RAISE EXCEPTION 'Personal calendar snapshot missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.todos WHERE id=personal AND evidence_health='OK') THEN RAISE EXCEPTION 'Personal health requires evidence'; END IF;
 INSERT INTO public.todos(user_id,title,current_stage_id,work_category) VALUES(owner_id,'Magang selesai',backlog,'INTERNSHIP') RETURNING id INTO internship;
 INSERT INTO public.todos(user_id,title,current_stage_id,work_category) VALUES(owner_id,'Tugas akhir selesai',backlog,'THESIS') RETURNING id INTO thesis;
 result:=public.transition_todo(internship,done,1,'missing-proof');
 IF result->>'code'<>'EVIDENCE_REQUIRED' OR EXISTS(SELECT 1 FROM public.todo_transitions WHERE todo_id=internship) THEN RAISE EXCEPTION 'Internship completion bypassed gate'; END IF;
 result:=public.transition_todo(thesis,done,1,'missing-thesis-proof');
 IF result->>'code'<>'EVIDENCE_REQUIRED' THEN RAISE EXCEPTION 'Thesis completion bypassed gate'; END IF;
 INSERT INTO public.evidences(user_id,type,title,status) VALUES(owner_id,'LINK','Proof','AVAILABLE') RETURNING id INTO proof;
 INSERT INTO public.link_evidences(evidence_id,url) VALUES(proof,'https://example.org/proof');
 INSERT INTO public.todo_evidences(todo_id,evidence_id,attached_by) VALUES(internship,proof,owner_id),(thesis,proof,owner_id);
 result:=public.transition_todo(internship,done,1,'internship-complete');
 IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Internship completion failed: %',result; END IF;
 created_activity:=(result->>'activityId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.activities WHERE id=created_activity AND work_category='INTERNSHIP' AND status='READY' AND completion_transition_id IS NOT NULL) THEN RAISE EXCEPTION 'Atomic internship Activity missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.activity_evidences ae WHERE ae.activity_id=created_activity AND ae.evidence_id=proof) THEN RAISE EXCEPTION 'Completion evidence missing'; END IF;
 result:=public.transition_todo(internship,done,1,'internship-complete');
 IF NOT (result->>'replayed')::boolean OR (SELECT count(*) FROM public.activities WHERE todo_id=internship)<>1 THEN RAISE EXCEPTION 'Replay duplicated completion'; END IF;
 result:=public.transition_todo(thesis,done,1,'thesis-complete');
 IF NOT (result->>'ok')::boolean OR NOT EXISTS(SELECT 1 FROM public.activities WHERE id=(result->>'activityId')::uuid AND work_category='THESIS') THEN RAISE EXCEPTION 'Thesis Activity category wrong'; END IF;
 INSERT INTO public.todos(user_id,title,current_stage_id,work_category,auto_record_activity) VALUES(owner_id,'Manual recording',backlog,'THESIS',false) RETURNING id INTO manual;
 INSERT INTO public.todo_evidences(todo_id,evidence_id,attached_by) VALUES(manual,proof,owner_id);
 result:=public.transition_todo(manual,done,1,'manual-complete');
 IF NOT (result->>'ok')::boolean OR EXISTS(SELECT 1 FROM public.activities WHERE todo_id=manual) THEN RAISE EXCEPTION 'Auto-record opt-out ignored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.todo_transitions WHERE todo_id=manual AND completion_snapshot IS NOT NULL) THEN RAISE EXCEPTION 'Opt-out calendar completion missing'; END IF;
 BEGIN UPDATE public.todos SET work_category='PERSONAL' WHERE id=thesis; RAISE EXCEPTION 'Done category changed'; EXCEPTION WHEN check_violation THEN NULL; END;
 SELECT completion_transition_id INTO completion_id FROM public.activities WHERE id=created_activity;
 BEGIN INSERT INTO public.activities(user_id,title,activity_date,source,status,completion_transition_id) VALUES(owner_id,'Forged completion',current_date,'manual','DRAFT',completion_id); RAISE EXCEPTION 'Browser forged completion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result:=public.transition_todo(internship,review,2,'reopen');
 IF NOT (result->>'ok')::boolean THEN RAISE EXCEPTION 'Reopen failed'; END IF;
 result:=public.transition_todo(internship,done,3,'complete-again');
 IF NOT (result->>'ok')::boolean OR (SELECT count(*) FROM public.activities WHERE todo_id=internship)<>2 THEN RAISE EXCEPTION 'New completion after reopening missing'; END IF;
 result:=public.transition_todo(internship,review,4,'reopen-category');
 UPDATE public.todos SET work_category='PERSONAL' WHERE id=internship;
 UPDATE public.activities SET description='Historical edit',version=version+1 WHERE id=created_activity;
 IF NOT EXISTS(SELECT 1 FROM public.activities WHERE id=created_activity AND work_category='INTERNSHIP' AND description='Historical edit') THEN RAISE EXCEPTION 'History was blocked/recategorized by reopened Todo'; END IF;
 PERFORM set_config('qa.internship',internship::text,true);
END $$;
RESET ROLE;
DO $$
DECLARE result jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa.other'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.other'),'role','authenticated')::text,true);
 result:=public.transition_todo(current_setting('qa.internship')::uuid,(SELECT id FROM public.todo_stages WHERE code='DONE'),1,'foreign-complete');
 IF result->>'code'<>'NOT_FOUND' THEN RAISE EXCEPTION 'Cross-owner completion accepted'; END IF;
END $$;
SELECT 'workspace_v2_integrity: passed' AS result;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
