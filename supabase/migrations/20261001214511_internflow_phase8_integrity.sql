-- Phase 8: authoritative transitions; retain historical evidence and cache.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER TABLE public.todo_transitions ADD COLUMN IF NOT EXISTS request_payload jsonb;
ALTER TABLE public.todo_transitions ADD COLUMN IF NOT EXISTS resulting_version integer;
REVOKE INSERT, UPDATE, DELETE ON public.todo_transitions FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.todos FROM authenticated;
GRANT UPDATE (title, description, priority, due_date, sort_order, version, updated_at, deleted_at) ON public.todos TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_todo_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE stage_code text;
BEGIN
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
DROP TRIGGER IF EXISTS guard_todo_write ON public.todos;
CREATE TRIGGER guard_todo_write BEFORE INSERT OR UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION private.guard_todo_write();

CREATE OR REPLACE FUNCTION private.todo_valid_evidence_count(p_todo_id uuid, p_types text[]) RETURNS integer
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT count(DISTINCT e.id)::integer FROM public.todo_evidences te
  JOIN public.todos t ON t.id = te.todo_id JOIN public.evidences e ON e.id = te.evidence_id
  WHERE te.todo_id = p_todo_id AND e.user_id = t.user_id AND e.status = 'AVAILABLE'
    AND e.deleted_at IS NULL AND (p_types IS NULL OR e.type = ANY(p_types));
$$;
CREATE OR REPLACE FUNCTION private.refresh_todo_health(p_todo_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.todos; s public.todo_stages; health text;
BEGIN
  SELECT * INTO t FROM public.todos WHERE id = p_todo_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO s FROM public.todo_stages WHERE id = t.current_stage_id;
  health := CASE WHEN (s.requires_evidence_on_enter OR s.is_terminal) AND private.todo_valid_evidence_count(t.id,s.allowed_evidence_types) < s.minimum_evidence_count THEN 'EVIDENCE_INCOMPLETE' ELSE 'OK' END;
  UPDATE public.todos SET evidence_health = health WHERE id = t.id AND evidence_health IS DISTINCT FROM health;
END;
$$;
CREATE OR REPLACE FUNCTION private.guard_todo_attachment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.todos;
BEGIN
  SELECT * INTO t FROM public.todos WHERE id = CASE WHEN TG_OP='DELETE' THEN OLD.todo_id ELSE NEW.todo_id END FOR UPDATE;
  IF TG_OP = 'INSERT' THEN
    IF t.deleted_at IS NOT NULL OR NEW.attached_by <> t.user_id OR NOT EXISTS (SELECT 1 FROM public.evidences WHERE id=NEW.evidence_id AND user_id=t.user_id AND status='AVAILABLE' AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Evidence unavailable for this Todo' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE OR REPLACE FUNCTION private.on_todo_attachment_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.refresh_todo_health(CASE WHEN TG_OP='DELETE' THEN OLD.todo_id ELSE NEW.todo_id END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS guard_todo_attachment ON public.todo_evidences;
CREATE TRIGGER guard_todo_attachment BEFORE INSERT OR DELETE ON public.todo_evidences FOR EACH ROW EXECUTE FUNCTION private.guard_todo_attachment();
DROP TRIGGER IF EXISTS refresh_todo_attachment_health ON public.todo_evidences;
CREATE TRIGGER refresh_todo_attachment_health AFTER INSERT OR DELETE ON public.todo_evidences FOR EACH ROW EXECUTE FUNCTION private.on_todo_attachment_change();
CREATE OR REPLACE FUNCTION private.on_evidence_health_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    FOR item IN SELECT DISTINCT todo_id FROM public.todo_evidences WHERE evidence_id=NEW.id ORDER BY todo_id LOOP
      PERFORM private.refresh_todo_health(item.todo_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS refresh_evidence_todo_health ON public.evidences;
CREATE TRIGGER refresh_evidence_todo_health AFTER UPDATE OF status,deleted_at ON public.evidences FOR EACH ROW EXECUTE FUNCTION private.on_evidence_health_change();

CREATE OR REPLACE FUNCTION public.transition_todo(p_todo_id uuid, p_target_stage_id uuid, p_expected_version integer, p_idempotency_key text, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=auth.uid(); t public.todos; src public.todo_stages; dst public.todo_stages; previous public.todo_transitions; payload jsonb; available integer; now_at timestamptz:=now();
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  IF p_todo_id IS NULL OR p_target_stage_id IS NULL OR p_expected_version IS NULL OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 100 OR length(coalesce(p_note,'')) > 1000 OR p_expected_version < 1 THEN
    RETURN jsonb_build_object('ok',false,'code','VALIDATION_ERROR','message','Input transisi tidak valid.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_idempotency_key,0));
  SELECT * INTO t FROM public.todos WHERE id=p_todo_id AND user_id=actor AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND','message','Todo tidak ditemukan.'); END IF;
  payload:=jsonb_build_object('todoId',p_todo_id,'targetStageId',p_target_stage_id,'version',p_expected_version,'note',nullif(btrim(p_note),''));
  SELECT * INTO previous FROM public.todo_transitions WHERE user_id=actor AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN RETURN jsonb_build_object('ok',false,'code','CONFLICT','message','Permintaan ini sudah dipakai untuk perubahan lain.'); END IF;
    RETURN jsonb_build_object('ok',true,'todoId',t.id,'currentStageId',t.current_stage_id,'newVersion',t.version,'message','Perubahan sudah tersimpan.');
  END IF;
  IF t.version<>p_expected_version THEN RETURN jsonb_build_object('ok',false,'code','CONFLICT','message','Todo berubah di perangkat lain. Muat ulang untuk melanjutkan.'); END IF;
  SELECT * INTO src FROM public.todo_stages WHERE id=t.current_stage_id;
  SELECT * INTO dst FROM public.todo_stages WHERE id=p_target_stage_id;
  IF NOT FOUND OR NOT ((src.code='BACKLOG' AND dst.code='TODO') OR (src.code='TODO' AND dst.code IN ('BACKLOG','IN_PROGRESS')) OR (src.code='IN_PROGRESS' AND dst.code IN ('TODO','REVIEW')) OR (src.code='REVIEW' AND dst.code IN ('IN_PROGRESS','DONE')) OR (src.code='DONE' AND dst.code='REVIEW')) THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_TRANSITION','message','Pindahkan Todo ke tahap berikutnya atau sebelumnya.');
  END IF;
  IF src.requires_evidence_on_exit THEN
    available:=private.todo_valid_evidence_count(t.id,src.allowed_evidence_types);
    IF available<src.minimum_evidence_count THEN RETURN jsonb_build_object('ok',false,'code','EVIDENCE_REQUIRED','minimum',src.minimum_evidence_count,'current',available,'allowedTypes',src.allowed_evidence_types,'message','Tambahkan evidence sebelum berpindah tahap.'); END IF;
  END IF;
  available:=private.todo_valid_evidence_count(t.id,dst.allowed_evidence_types);
  IF dst.requires_evidence_on_enter AND available<dst.minimum_evidence_count THEN
    RETURN jsonb_build_object('ok',false,'code','EVIDENCE_REQUIRED','minimum',dst.minimum_evidence_count,'current',available,'allowedTypes',dst.allowed_evidence_types,'message','Tambahkan evidence untuk tahap ini.');
  END IF;
  IF dst.requires_note AND nullif(btrim(p_note),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'code','NOTE_REQUIRED','message','Tambahkan catatan untuk tahap ini.'); END IF;
  UPDATE public.todos SET current_stage_id=dst.id, sort_order=(SELECT coalesce(max(sort_order),0)+1000 FROM public.todos WHERE user_id=actor AND current_stage_id=dst.id AND deleted_at IS NULL),
    started_at=CASE WHEN dst.code='IN_PROGRESS' THEN coalesce(t.started_at,now_at) ELSE t.started_at END,
    completed_at=CASE WHEN dst.is_terminal THEN now_at ELSE NULL END, evidence_health='OK'
    WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.todo_transitions(todo_id,user_id,from_stage_id,to_stage_id,note,evidence_count,idempotency_key,request_payload,resulting_version)
    VALUES(t.id,actor,src.id,dst.id,nullif(btrim(p_note),''),available,p_idempotency_key,payload,t.version);
  INSERT INTO public.audit_logs(actor_user_id,entity_type,entity_id,action,metadata) VALUES(actor,'todo',t.id,'todo.transitioned',jsonb_build_object('from',src.code,'to',dst.code,'version',t.version,'evidence_count',available));
  RETURN jsonb_build_object('ok',true,'todoId',t.id,'currentStageId',t.current_stage_id,'newVersion',t.version,'message','Todo dipindahkan.');
END;
$$;
REVOKE ALL ON FUNCTION public.transition_todo(uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_todo(uuid,uuid,integer,text,text) TO authenticated;

-- Browser roles can read GitHub metadata, but only the server can sync it.
REVOKE INSERT,UPDATE,DELETE ON public.github_connections,public.github_commits,public.github_evidences FROM authenticated,anon;
GRANT SELECT ON public.github_connections,public.github_commits,public.github_evidences TO authenticated;
GRANT ALL ON public.github_tokens,public.github_connections,public.github_commits,public.github_evidences TO service_role;
ALTER TABLE public.github_connections ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.github_connections ADD COLUMN IF NOT EXISTS sync_nonce uuid;
ALTER TABLE public.github_connections ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.store_github_connection(p_user_id uuid,p_github_user_id text,p_username text,p_scopes text[],p_ciphertext text,p_token_type text,p_allow_replace boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.github_connections;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id AND is_active) THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('github:'||p_user_id::text,0));
  SELECT * INTO c FROM public.github_connections WHERE user_id=p_user_id FOR UPDATE;
  IF FOUND AND c.github_user_id<>p_github_user_id AND NOT p_allow_replace THEN RAISE EXCEPTION 'ACCOUNT_CHANGE_REQUIRED' USING ERRCODE='23514'; END IF;
  IF p_ciphertext NOT LIKE 'v1.%' OR p_github_user_id !~ '^[0-9]+$' OR p_username !~ '^[A-Za-z0-9-]{1,39}$' THEN RAISE EXCEPTION 'Invalid GitHub identity or token' USING ERRCODE='23514'; END IF;
  INSERT INTO public.github_tokens(user_id,access_token,token_type) VALUES(p_user_id,p_ciphertext,p_token_type) ON CONFLICT(user_id) DO UPDATE SET access_token=excluded.access_token,token_type=excluded.token_type,updated_at=now();
  INSERT INTO public.github_connections(user_id,github_user_id,github_username,scopes,connection_status,connected_at) VALUES(p_user_id,p_github_user_id,p_username,p_scopes,'CONNECTED',now()) ON CONFLICT(user_id) DO UPDATE SET github_user_id=excluded.github_user_id,github_username=excluded.github_username,scopes=excluded.scopes,connection_status='CONNECTED',connected_at=now(),last_synced_at=NULL,version=public.github_connections.version+1,updated_at=now(),sync_nonce=NULL,sync_started_at=NULL RETURNING * INTO c;
  INSERT INTO public.audit_logs(actor_user_id,entity_type,entity_id,action,metadata) VALUES(p_user_id,'integration',c.id,'github.connected',jsonb_build_object('github_username',p_username,'scopes',p_scopes));
  RETURN to_jsonb(c)-'sync_nonce';
END;
$$;
CREATE OR REPLACE FUNCTION public.disconnect_github(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE connection_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('github:'||p_user_id::text,0));
  SELECT id INTO connection_id FROM public.github_connections WHERE user_id=p_user_id FOR UPDATE;
  DELETE FROM public.github_tokens WHERE user_id=p_user_id;
  UPDATE public.github_connections SET connection_status='DISCONNECTED',version=version+1,updated_at=now(),sync_nonce=NULL,sync_started_at=NULL WHERE user_id=p_user_id;
  IF connection_id IS NOT NULL THEN INSERT INTO public.audit_logs(actor_user_id,entity_type,entity_id,action,metadata) VALUES(p_user_id,'integration',connection_id,'github.disconnected','{"historical_evidence_retained":true}'::jsonb); END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.begin_github_sync(p_user_id uuid,p_nonce uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.github_connections;
BEGIN
  SELECT * INTO c FROM public.github_connections WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR c.connection_status<>'CONNECTED' THEN RETURN jsonb_build_object('ok',false,'code','NOT_CONNECTED'); END IF;
  IF c.sync_nonce IS NOT NULL AND c.sync_started_at>now()-interval '3 minutes' THEN RETURN jsonb_build_object('ok',false,'code','SYNC_IN_PROGRESS'); END IF;
  UPDATE public.github_connections SET sync_nonce=p_nonce,sync_started_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'connection',to_jsonb(c)-'sync_nonce');
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_github_sync(p_user_id uuid,p_version integer,p_nonce uuid,p_commits jsonb,p_complete boolean,p_reauth boolean DEFAULT false,p_unavailable_repos text[] DEFAULT '{}') RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.github_connections;
BEGIN
  SELECT * INTO c FROM public.github_connections WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR c.version<>p_version OR c.sync_nonce IS DISTINCT FROM p_nonce OR c.connection_status<>'CONNECTED' THEN RETURN false; END IF;
  INSERT INTO public.github_commits(user_id,github_connection_id,repository_id,repository_name,sha,message,commit_url,branch,author_date,source_status,synced_at)
    SELECT p_user_id,c.id,x.repository_id,x.repository_name,x.sha,x.message,x.commit_url,x.branch,x.author_date,'AVAILABLE',now()
    FROM jsonb_to_recordset(p_commits) AS x(repository_id text,repository_name text,sha text,message text,commit_url text,branch text,author_date timestamptz)
    WHERE x.sha ~ '^[0-9a-f]{40}$' AND x.repository_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' AND x.commit_url='https://github.com/'||x.repository_name||'/commit/'||x.sha
    ON CONFLICT(user_id,repository_id,sha) DO UPDATE SET message=excluded.message,commit_url=excluded.commit_url,branch=excluded.branch,author_date=excluded.author_date,source_status='AVAILABLE',synced_at=now();
  UPDATE public.github_commits SET source_status='SOURCE_UNAVAILABLE' WHERE user_id=p_user_id AND repository_name=ANY(p_unavailable_repos);
  UPDATE public.github_connections SET sync_nonce=NULL,sync_started_at=NULL,last_synced_at=CASE WHEN p_complete THEN now() ELSE last_synced_at END,connection_status=CASE WHEN p_reauth THEN 'REAUTH_REQUIRED' ELSE connection_status END,updated_at=now() WHERE id=c.id;
  IF p_reauth THEN DELETE FROM public.github_tokens WHERE user_id=p_user_id; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.store_github_connection(uuid,text,text,text[],text,text,boolean),public.disconnect_github(uuid),public.begin_github_sync(uuid,uuid),public.finish_github_sync(uuid,integer,uuid,jsonb,boolean,boolean,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_github_connection(uuid,text,text,text[],text,text,boolean),public.disconnect_github(uuid),public.begin_github_sync(uuid,uuid),public.finish_github_sync(uuid,integer,uuid,jsonb,boolean,boolean,text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.select_github_commit_evidence(p_commit_id uuid,p_activity_id uuid DEFAULT NULL,p_todo_id uuid DEFAULT NULL,p_title text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.github_commits; selected_evidence_id uuid; reused boolean:=false; todo_stage uuid;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  IF length(coalesce(p_title,''))>160 OR length(coalesce(p_note,''))>10000 THEN RAISE EXCEPTION 'Invalid evidence text' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM public.github_commits WHERE id=p_commit_id AND user_id=actor FOR UPDATE;
  IF NOT FOUND OR c.source_status<>'AVAILABLE' OR c.commit_url IS DISTINCT FROM 'https://github.com/'||c.repository_name||'/commit/'||c.sha THEN RETURN jsonb_build_object('ok',false,'message','Commit tidak tersedia. Sinkronkan kembali.'); END IF;
  IF p_activity_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.activities WHERE id=p_activity_id AND user_id=actor AND deleted_at IS NULL) THEN RETURN jsonb_build_object('ok',false,'message','Activity tidak ditemukan.'); END IF;
  IF p_todo_id IS NOT NULL THEN
    SELECT current_stage_id INTO todo_stage FROM public.todos WHERE id=p_todo_id AND user_id=actor AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'message','Todo tidak ditemukan.'); END IF;
  END IF;
  SELECT e.id INTO selected_evidence_id FROM public.evidences e JOIN public.github_evidences ge ON ge.evidence_id=e.id
    WHERE ge.github_commit_id=c.id AND e.user_id=actor AND e.deleted_at IS NULL AND e.status='AVAILABLE' ORDER BY e.created_at LIMIT 1;
  reused:=FOUND;
  IF NOT reused THEN
    INSERT INTO public.evidences(user_id,type,title,note,status,captured_at) VALUES(actor,'GITHUB_COMMIT',coalesce(nullif(btrim(p_title),''),left(c.repository_name||'#'||left(c.sha,7),160)),coalesce(nullif(btrim(p_note),''),c.message),'AVAILABLE',coalesce(c.author_date,now())) RETURNING id INTO selected_evidence_id;
    INSERT INTO public.github_evidences(evidence_id,github_commit_id,commit_url,repository_name,sha,message,author_date) VALUES(selected_evidence_id,c.id,c.commit_url,c.repository_name,c.sha,c.message,c.author_date);
  END IF;
  IF p_activity_id IS NOT NULL THEN INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) VALUES(p_activity_id,selected_evidence_id,actor) ON CONFLICT DO NOTHING; END IF;
  IF p_todo_id IS NOT NULL THEN INSERT INTO public.todo_evidences(todo_id,evidence_id,stage_id,attached_by) VALUES(p_todo_id,selected_evidence_id,NULL,actor) ON CONFLICT DO NOTHING; END IF;
  RETURN jsonb_build_object('ok',true,'evidenceId',selected_evidence_id,'reused',reused,'message','Commit disimpan sebagai evidence.');
END;
$$;
REVOKE ALL ON FUNCTION public.select_github_commit_evidence(uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.select_github_commit_evidence(uuid,uuid,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.begin_evidence_delete(p_evidence_id uuid,p_detach_all boolean DEFAULT false)
RETURNS TABLE(type text,status text,drive_file_id text,blocked_count integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); e public.evidences; assigned integer; file_id text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.evidences WHERE id=p_evidence_id AND user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF e.status='DELETED' OR e.deleted_at IS NOT NULL THEN RETURN QUERY SELECT e.type,'DELETED'::text,NULL::text,0; RETURN; END IF;
  IF e.status IN ('UPLOADING','ORPHANED') THEN RAISE EXCEPTION 'Active upload or reconciliation' USING ERRCODE='23514'; END IF;
  SELECT (SELECT count(*) FROM public.activity_evidences WHERE evidence_id=p_evidence_id AND attached_by=actor)+(SELECT count(*) FROM public.todo_evidences WHERE evidence_id=p_evidence_id AND attached_by=actor) INTO assigned;
  IF assigned>0 AND NOT p_detach_all THEN RETURN QUERY SELECT e.type,e.status,NULL::text,assigned; RETURN; END IF;
  IF assigned>0 THEN
    DELETE FROM public.activity_evidences WHERE evidence_id=p_evidence_id AND attached_by=actor;
    DELETE FROM public.todo_evidences WHERE evidence_id=p_evidence_id AND attached_by=actor;
  END IF;
  SELECT p.drive_file_id INTO file_id FROM public.photo_evidences p WHERE p.evidence_id=p_evidence_id;
  UPDATE public.evidences SET status='DELETE_PENDING' WHERE id=p_evidence_id AND user_id=actor;
  RETURN QUERY SELECT e.type,'DELETE_PENDING'::text,file_id,0;
END;
$$;
CREATE OR REPLACE VIEW public.evidence_library WITH(security_invoker=true) AS
SELECT e.id,e.user_id,e.type,e.title,e.note,e.status,e.captured_at,e.created_at,e.updated_at,e.deleted_at,p.mime_type,p.size_bytes,p.width,p.height,coalesce(l.url,ge.commit_url) AS url,ge.repository_name,ge.sha,ge.message AS commit_message,
  ((SELECT count(*) FROM public.activity_evidences ae WHERE ae.evidence_id=e.id)+(SELECT count(*) FROM public.todo_evidences te WHERE te.evidence_id=e.id))::integer AS assignment_count
FROM public.evidences e LEFT JOIN public.photo_evidences p ON p.evidence_id=e.id LEFT JOIN public.link_evidences l ON l.evidence_id=e.id LEFT JOIN public.github_evidences ge ON ge.evidence_id=e.id;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_github_evidence_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.type='GITHUB_COMMIT' AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    RAISE EXCEPTION 'Select an owned cached commit to create evidence' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_github_evidence_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_github_evidence_insert BEFORE INSERT ON public.evidences FOR EACH ROW EXECUTE FUNCTION private.guard_github_evidence_insert();
