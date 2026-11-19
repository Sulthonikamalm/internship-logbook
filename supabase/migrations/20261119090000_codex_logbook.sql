-- User sessions, including the local Codex client, remain subject to RLS.
ALTER TABLE public.activities DROP CONSTRAINT activities_source_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_source_check CHECK (source IN ('manual','quick_capture','todo','codex'));

CREATE TABLE public.logbook_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  request_payload jsonb NOT NULL CHECK (jsonb_typeof(request_payload)='object'),
  plan_payload jsonb NOT NULL CHECK (jsonb_typeof(plan_payload)='object'),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'SAVED' CHECK (status IN ('SAVED','PARTIAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id), UNIQUE(user_id,id)
);
CREATE INDEX logbook_generation_owner_date ON public.logbook_generation_runs(user_id,created_at DESC,id);
ALTER TABLE public.logbook_generation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY generation_owner_select ON public.logbook_generation_runs FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY generation_owner_insert ON public.logbook_generation_runs FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND is_active));
GRANT SELECT,INSERT ON public.logbook_generation_runs TO authenticated;

CREATE TABLE public.logbook_generated_items (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  fingerprint text NOT NULL,
  activity_id uuid NOT NULL,
  source_refs jsonb NOT NULL CHECK (jsonb_typeof(source_refs)='array'),
  PRIMARY KEY(user_id,fingerprint),
  FOREIGN KEY(user_id,activity_id) REFERENCES public.activities(user_id,id)
);
CREATE TABLE public.logbook_photo_allocations (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  activity_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,checksum),
  FOREIGN KEY(user_id,activity_id) REFERENCES public.activities(user_id,id),
  FOREIGN KEY(user_id,evidence_id) REFERENCES public.evidences(user_id,id)
);
CREATE TABLE public.logbook_activity_sources (
  user_id uuid NOT NULL REFERENCES public.profiles(id), source_kind text NOT NULL, source_id uuid NOT NULL,
  activity_date date NOT NULL, work_category text NOT NULL, activity_id uuid NOT NULL,
  PRIMARY KEY(user_id,source_kind,source_id,activity_date,work_category),
  FOREIGN KEY(user_id,activity_id) REFERENCES public.activities(user_id,id)
);
CREATE INDEX logbook_activity_sources_activity ON public.logbook_activity_sources(activity_id);
ALTER TABLE public.logbook_activity_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_sources_owner ON public.logbook_activity_sources TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
GRANT SELECT,INSERT ON public.logbook_activity_sources TO authenticated;
REVOKE ALL ON public.logbook_activity_sources FROM anon;
CREATE INDEX logbook_allocations_activity ON public.logbook_photo_allocations(activity_id);
CREATE INDEX logbook_allocations_evidence ON public.logbook_photo_allocations(evidence_id);
ALTER TABLE public.logbook_generated_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_photo_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY generated_items_owner ON public.logbook_generated_items TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY allocations_owner ON public.logbook_photo_allocations TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
GRANT SELECT,INSERT ON public.logbook_generated_items,public.logbook_photo_allocations TO authenticated;
REVOKE ALL ON public.logbook_generation_runs,public.logbook_generated_items,public.logbook_photo_allocations FROM anon;

CREATE VIEW public.logbook_photo_inventory WITH (security_invoker=true) AS
SELECT e.id,e.user_id,e.title,e.note,e.status,e.captured_at,e.created_at,e.deleted_at,e.metadata,
  p.original_filename,p.checksum,a.activity_id AS allocated_activity_id,
  (a.activity_id IS NOT NULL OR EXISTS(
    SELECT 1 FROM public.photo_evidences copy JOIN public.evidences ce ON ce.id=copy.evidence_id
    WHERE ce.user_id=e.user_id AND copy.checksum=p.checksum AND (
      EXISTS(SELECT 1 FROM public.activity_evidences ae WHERE ae.evidence_id=copy.evidence_id)
      OR EXISTS(SELECT 1 FROM public.todo_evidences te WHERE te.evidence_id=copy.evidence_id)))) AS used
FROM public.evidences e JOIN public.photo_evidences p ON p.evidence_id=e.id
LEFT JOIN public.logbook_photo_allocations a ON a.user_id=e.user_id AND a.checksum=p.checksum
WHERE e.type='PHOTO';
GRANT SELECT ON public.logbook_photo_inventory TO authenticated;
REVOKE ALL ON public.logbook_photo_inventory FROM PUBLIC,anon;

CREATE FUNCTION private.audit_logbook_generation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_user_id,entity_type,entity_id,action,metadata)
    VALUES(NEW.user_id,'report',NEW.id,'report.codex_saved',jsonb_build_object('entries',jsonb_array_length(NEW.snapshot->'activities'),'status',NEW.status));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_logbook_generation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_logbook_generation AFTER INSERT ON public.logbook_generation_runs FOR EACH ROW EXECUTE FUNCTION private.audit_logbook_generation();

-- Serializes ordinary attachments with automatic claims, including duplicate uploads.
CREATE FUNCTION private.guard_logbook_photo_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=NEW.attached_by; checksum_value text; claimed uuid; target public.activities;
BEGIN
  SELECT p.checksum INTO checksum_value FROM public.photo_evidences p JOIN public.evidences e ON e.id=p.evidence_id WHERE p.evidence_id=NEW.evidence_id AND e.user_id=actor;
  IF checksum_value IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':photo-claim:'||checksum_value,0));
  SELECT activity_id INTO claimed FROM public.logbook_photo_allocations WHERE user_id=actor AND checksum=checksum_value;
  IF claimed IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO target FROM public.activities WHERE id=claimed AND user_id=actor;
  IF TG_TABLE_NAME='activity_evidences' THEN
    IF NEW.activity_id=claimed OR EXISTS(SELECT 1 FROM public.activities a WHERE a.id=NEW.activity_id AND a.user_id=actor AND a.todo_id IS NOT NULL AND a.todo_id=target.todo_id AND a.activity_date=target.activity_date) THEN RETURN NEW; END IF;
  ELSE
    IF NEW.todo_id=target.todo_id THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'PHOTO_ALREADY_USED' USING ERRCODE='23514';
END;
$$;
REVOKE ALL ON FUNCTION private.guard_logbook_photo_claim() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_logbook_photo_claim BEFORE INSERT ON public.activity_evidences FOR EACH ROW EXECUTE FUNCTION private.guard_logbook_photo_claim();
CREATE TRIGGER guard_logbook_photo_claim BEFORE INSERT ON public.todo_evidences FOR EACH ROW EXECUTE FUNCTION private.guard_logbook_photo_claim();

CREATE FUNCTION public.create_photo_batch_activity(p_key text,p_evidence_ids uuid[],p_activity_date date,p_work_category text DEFAULT 'INTERNSHIP')
RETURNS public.activities LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); result public.activities; eid uuid; previous public.mutation_idempotency; payload jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR cardinality(p_evidence_ids) NOT BETWEEN 1 AND 100 OR p_activity_date IS NULL OR p_work_category NOT IN ('INTERNSHIP','THESIS','PERSONAL') THEN RAISE EXCEPTION 'Invalid capture' USING ERRCODE='22023'; END IF;
  SELECT jsonb_build_object('photos',jsonb_agg(id ORDER BY id),'date',p_activity_date,'category',p_work_category) INTO payload FROM (SELECT DISTINCT unnest(p_evidence_ids) id) ids;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':photo:'||p_key,0));
  SELECT * INTO previous FROM public.mutation_idempotency WHERE user_id=actor AND key=p_key AND operation='activity.photo_only';
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='23514'; END IF;
    SELECT * INTO result FROM public.activities WHERE id=previous.resource_id AND user_id=actor AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE='42501'; END IF;
    RETURN result;
  END IF;
  FOREACH eid IN ARRAY p_evidence_ids LOOP
    PERFORM 1 FROM public.evidences WHERE id=eid AND user_id=actor AND type='PHOTO' AND status='AVAILABLE' AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Photo unavailable' USING ERRCODE='42501'; END IF;
  END LOOP;
  INSERT INTO public.activities(user_id,title,activity_date,source,status,needs_description,work_category)
    VALUES(actor,'Aktivitas tanpa judul',p_activity_date,'quick_capture','DRAFT',true,p_work_category) RETURNING * INTO result;
  INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) SELECT result.id,id,actor FROM (SELECT DISTINCT unnest(p_evidence_ids) id) ids;
  INSERT INTO public.mutation_idempotency(user_id,key,operation,resource_id,request_payload) VALUES(actor,p_key,'activity.photo_only',result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_photo_batch_activity(text,uuid[],date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_photo_batch_activity(text,uuid[],date,text) TO authenticated;

-- All entries, claims, and the immutable export snapshot commit together.
CREATE FUNCTION public.save_logbook_generation(p_request jsonb,p_plan jsonb) RETURNS public.logbook_generation_runs
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); result public.logbook_generation_runs; item jsonb; ref jsonb; act public.activities;
  e public.evidences; eid uuid; photo_hash text; fingerprint_value text; refs jsonb; rows jsonb:='[]'; evs jsonb;
  existing_id uuid; local_today date; zone text; snap_status text; source_count integer;
BEGIN
  SELECT timezone INTO zone FROM public.profiles WHERE id=actor AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  local_today:=timezone(coalesce(zone,'Asia/Jakarta'),now())::date;
  IF jsonb_typeof(p_request)<>'object' OR jsonb_typeof(p_plan->'entries')<>'array' OR jsonb_array_length(p_plan->'entries')>500
    OR jsonb_typeof(p_request->'repositories')<>'array' OR jsonb_array_length(p_request->'repositories')<1
    OR p_request->>'category' NOT IN ('INTERNSHIP','THESIS','PERSONAL') OR p_request->>'period' NOT IN ('daily','weekly','monthly','custom')
    OR (p_request->>'from')::date>(p_request->>'to')::date OR (p_request->>'to')::date-(p_request->>'from')::date>366 THEN
    RAISE EXCEPTION 'Invalid generation' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT evidence_id) FROM jsonb_array_elements(p_plan->'entries') entry CROSS JOIN LATERAL jsonb_array_elements_text(entry->'evidenceIds') evidence_id)>500 THEN
    RAISE EXCEPTION 'Too many evidence files' USING ERRCODE='22023';
  END IF;
  -- Owner-wide serialization also prevents cross-request source duplication.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':logbook-generation',0));
  SELECT * INTO result FROM public.logbook_generation_runs WHERE user_id=actor AND request_id=(p_request->>'requestId')::uuid;
  IF FOUND THEN
    IF result.request_payload IS DISTINCT FROM p_request OR result.plan_payload IS DISTINCT FROM p_plan THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='23514'; END IF;
    RETURN result;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_plan->'entries') LOOP
    IF (item->>'date')::date NOT BETWEEN (p_request->>'from')::date AND least((p_request->>'to')::date,local_today)
      OR length(coalesce(item->>'title','')) NOT BETWEEN 1 AND 160 OR jsonb_array_length(item->'sourceRefs')<1
      OR jsonb_typeof(item->'evidenceIds')<>'array' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item->'sourceRefs') source WHERE source->>'kind'<>'attendance') THEN RAISE EXCEPTION 'Invalid entry' USING ERRCODE='22023'; END IF;
    SELECT jsonb_agg(value ORDER BY value->>'kind',value->>'id') INTO refs FROM jsonb_array_elements(item->'sourceRefs');
    FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
      IF NOT (CASE ref->>'kind'
        WHEN 'activity' THEN EXISTS(SELECT 1 FROM public.activities WHERE id=(ref->>'id')::uuid AND user_id=actor AND deleted_at IS NULL AND activity_date=(item->>'date')::date AND work_category=p_request->>'category')
        WHEN 'todo' THEN EXISTS(SELECT 1 FROM public.todos WHERE id=(ref->>'id')::uuid AND user_id=actor AND deleted_at IS NULL AND work_category=p_request->>'category')
        WHEN 'photo' THEN EXISTS(SELECT 1 FROM public.evidences WHERE id=(ref->>'id')::uuid AND user_id=actor AND type='PHOTO' AND status='AVAILABLE' AND deleted_at IS NULL)
        WHEN 'commit' THEN EXISTS(SELECT 1 FROM public.github_commits WHERE id=(ref->>'id')::uuid AND user_id=actor AND lower(repository_name) IN(SELECT lower(jsonb_array_elements_text(p_request->'repositories'))) AND timezone(coalesce(zone,'Asia/Jakarta'),author_date)::date=(item->>'date')::date)
        WHEN 'attendance' THEN EXISTS(SELECT 1 FROM public.attendance_sessions WHERE id=(ref->>'id')::uuid AND user_id=actor AND work_date=(item->>'date')::date)
        ELSE false END) THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='42501'; END IF;
    END LOOP;
    fingerprint_value:=md5(jsonb_build_object('refs',refs,'date',item->>'date','category',p_request->>'category')::text);
    existing_id:=NULL;
    IF item->>'activityId' IS NOT NULL THEN
      SELECT * INTO act FROM public.activities WHERE id=(item->>'activityId')::uuid AND user_id=actor AND deleted_at IS NULL AND activity_date=(item->>'date')::date AND work_category=p_request->>'category' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE='42501'; END IF;
      IF act.version IS DISTINCT FROM (item->>'expectedVersion')::integer THEN RAISE EXCEPTION 'ACTIVITY_VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
      existing_id:=act.id;
    ELSE
      SELECT activity_id INTO existing_id FROM public.logbook_generated_items WHERE user_id=actor AND fingerprint=fingerprint_value;
      IF existing_id IS NULL THEN
        SELECT count(DISTINCT s.activity_id),min(s.activity_id::text)::uuid INTO source_count,existing_id
        FROM public.logbook_activity_sources s JOIN jsonb_array_elements(refs) r ON s.source_kind=r->>'kind' AND s.source_id=(r->>'id')::uuid
        WHERE s.user_id=actor AND s.activity_date=(item->>'date')::date AND s.work_category=p_request->>'category' AND s.source_kind<>'attendance';
        IF source_count>1 THEN RAISE EXCEPTION 'SOURCE_ACTIVITY_CONFLICT' USING ERRCODE='23514'; END IF;
      END IF;
      IF existing_id IS NOT NULL THEN
        SELECT * INTO act FROM public.activities WHERE id=existing_id AND user_id=actor AND deleted_at IS NULL FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Source activity removed; select explicitly' USING ERRCODE='23514'; END IF;
      END IF;
    END IF;
    IF existing_id IS NULL THEN
      INSERT INTO public.activities(user_id,title,description,activity_date,start_time,end_time,source,status,work_category)
        VALUES(actor,item->>'title',nullif(item->>'description',''),(item->>'date')::date,nullif(item->>'startTime','')::time,nullif(item->>'endTime','')::time,'codex','DRAFT',p_request->>'category') RETURNING * INTO act;
      INSERT INTO public.logbook_generated_items(user_id,fingerprint,activity_id,source_refs) VALUES(actor,fingerprint_value,act.id,refs);
    END IF;
    INSERT INTO public.logbook_activity_sources(user_id,source_kind,source_id,activity_date,work_category,activity_id)
      SELECT actor,r->>'kind',(r->>'id')::uuid,act.activity_date,act.work_category,act.id FROM jsonb_array_elements(refs) r
      ON CONFLICT DO NOTHING;
    FOR eid IN SELECT value::uuid FROM jsonb_array_elements_text(item->'evidenceIds') LOOP
      SELECT * INTO e FROM public.evidences WHERE id=eid AND user_id=actor AND deleted_at IS NULL AND status='AVAILABLE' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Evidence unavailable' USING ERRCODE='42501'; END IF;
      IF e.type='GITHUB_COMMIT' AND NOT EXISTS(SELECT 1 FROM public.github_evidences WHERE evidence_id=eid AND lower(repository_name) IN(SELECT lower(jsonb_array_elements_text(p_request->'repositories')))) THEN RAISE EXCEPTION 'Repository outside request' USING ERRCODE='42501'; END IF;
      IF e.metadata->>'source'='github_reconstruction' THEN
        IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_request->'repositories') repository WHERE lower(repository)=lower(e.metadata->>'repository')) THEN RAISE EXCEPTION 'Repository outside request' USING ERRCODE='42501'; END IF;
        IF timezone(coalesce(zone,'Asia/Jakarta'),(e.metadata->>'commitDate')::timestamptz)::date IS DISTINCT FROM (item->>'date')::date
          OR NOT refs @> jsonb_build_array(jsonb_build_object('kind','commit','id',e.metadata->>'commitId')) THEN
          RAISE EXCEPTION 'Screenshot commit/date must match its source' USING ERRCODE='23514';
        END IF;
      END IF;
      IF e.type='PHOTO' THEN
        SELECT checksum INTO photo_hash FROM public.photo_evidences WHERE evidence_id=eid;
        IF photo_hash IS NULL THEN RAISE EXCEPTION 'Photo metadata unavailable' USING ERRCODE='23514'; END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':photo-claim:'||photo_hash,0));
        IF EXISTS(SELECT 1 FROM public.logbook_photo_allocations WHERE user_id=actor AND checksum=photo_hash AND activity_id<>act.id)
          OR EXISTS(SELECT 1 FROM public.photo_evidences p JOIN public.evidences pe ON pe.id=p.evidence_id JOIN public.activity_evidences ae ON ae.evidence_id=p.evidence_id JOIN public.activities a ON a.id=ae.activity_id WHERE pe.user_id=actor AND p.checksum=photo_hash AND a.deleted_at IS NULL AND a.id<>act.id AND NOT (a.todo_id IS NOT NULL AND a.todo_id IS NOT DISTINCT FROM act.todo_id AND a.activity_date=act.activity_date))
          OR EXISTS(SELECT 1 FROM public.photo_evidences p JOIN public.evidences pe ON pe.id=p.evidence_id JOIN public.todo_evidences te ON te.evidence_id=p.evidence_id JOIN public.todos t ON t.id=te.todo_id WHERE pe.user_id=actor AND p.checksum=photo_hash AND t.deleted_at IS NULL AND te.todo_id IS DISTINCT FROM act.todo_id)
          THEN RAISE EXCEPTION 'PHOTO_ALREADY_USED' USING ERRCODE='23514'; END IF;
        INSERT INTO public.logbook_photo_allocations(user_id,checksum,activity_id,evidence_id) VALUES(actor,photo_hash,act.id,eid) ON CONFLICT(user_id,checksum) DO NOTHING;
      END IF;
      INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) VALUES(act.id,eid,actor) ON CONFLICT DO NOTHING;
    END LOOP;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',ev.id,'type',ev.type,'title',ev.title,'status',ev.status,'url',coalesce(l.url,g.commit_url),'provenance',ev.metadata) ORDER BY ev.id),'[]') INTO evs
      FROM public.canonical_activity_evidences ae JOIN public.evidences ev ON ev.id=ae.evidence_id LEFT JOIN public.link_evidences l ON l.evidence_id=ev.id LEFT JOIN public.github_evidences g ON g.evidence_id=ev.id
      WHERE ae.activity_id=act.id AND ae.attached_by=actor AND ev.user_id=actor AND ev.deleted_at IS NULL;
    IF act.source='codex' AND act.status='DRAFT' AND EXISTS(SELECT 1 FROM jsonb_array_elements(evs) v WHERE v->>'status'='AVAILABLE') THEN
      UPDATE public.activities SET status='READY',version=version+1 WHERE id=act.id AND user_id=actor RETURNING * INTO act;
    END IF;
    snap_status:=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(evs) v WHERE v->>'status'='AVAILABLE') THEN act.status ELSE 'DRAFT' END;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE r->>'id'=act.id::text) THEN
      rows:=rows||jsonb_build_array(jsonb_build_object('id',act.id,'activityDate',act.activity_date,'startTime',act.start_time,'endTime',act.end_time,'title',act.title,'description',act.description,'status',snap_status,'evidences',evs));
    END IF;
  END LOOP;
  INSERT INTO public.logbook_generation_runs(user_id,request_id,request_payload,plan_payload,snapshot,status)
    VALUES(actor,(p_request->>'requestId')::uuid,p_request,p_plan,jsonb_build_object('activities',rows,'gaps',coalesce(p_plan->'gaps','[]'::jsonb),'summary',p_plan->>'summary'),
      CASE WHEN jsonb_array_length(coalesce(p_plan->'gaps','[]'::jsonb))>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE r->>'status'='DRAFT') OR jsonb_array_length(rows)=0 THEN 'PARTIAL' ELSE 'SAVED' END)
    RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_logbook_generation(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_logbook_generation(jsonb,jsonb) TO authenticated;

-- Batch uploads retain the existing state machine and concurrent-session guard.
CREATE OR REPLACE FUNCTION public.guard_evidence_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.type = 'PHOTO' AND (NEW.status <> 'UPLOADING' OR NEW.upload_id IS NULL))
       OR (NEW.type = 'LINK' AND (NEW.status <> 'AVAILABLE' OR NEW.upload_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'Invalid initial evidence state' USING ERRCODE = '23514';
    END IF;
    IF NEW.type = 'PHOTO' THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 537));
      IF (SELECT count(*) FROM public.evidences
          WHERE user_id = NEW.user_id AND type = 'PHOTO' AND status = 'UPLOADING'
            AND created_at > now() - interval '1 hour') >= 3 THEN
        RAISE EXCEPTION 'Too many concurrent uploads' USING ERRCODE = 'P0001';
      END IF;
      IF (SELECT count(*) FROM public.evidences
          WHERE user_id = NEW.user_id AND type = 'PHOTO'
            AND created_at > now() - interval '1 hour') >= 300 THEN
        RAISE EXCEPTION 'Photo upload rate limit' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    IF NEW.type='PHOTO' AND NEW.status='UPLOADING' AND OLD.status<>'UPLOADING' THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text,537));
      IF (SELECT count(*) FROM public.evidences WHERE user_id=NEW.user_id AND type='PHOTO' AND status='UPLOADING' AND id<>NEW.id AND created_at>now()-interval '1 hour')>=3 THEN
        RAISE EXCEPTION 'Too many concurrent uploads' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.upload_id IS DISTINCT FROM OLD.upload_id THEN
      RAISE EXCEPTION 'Evidence identity is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Deleted evidence is unavailable' USING ERRCODE = '23514';
    END IF;
    IF NEW.type = 'PHOTO' AND NEW.status = 'AVAILABLE'
       AND NOT EXISTS (SELECT 1 FROM public.photo_evidences WHERE evidence_id = NEW.id) THEN
      RAISE EXCEPTION 'Photo metadata required before availability' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'DELETED' AND NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Deleted evidence must have deleted_at' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_activity(
  p_key text, p_title text, p_description text, p_activity_date date,
  p_start_time time, p_end_time time, p_source text, p_status text, p_todo_id uuid DEFAULT NULL, p_work_category text DEFAULT 'INTERNSHIP'
) RETURNS public.activities LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  payload jsonb;
  previous public.mutation_idempotency;
  result public.activities;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND is_active) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR p_title IS NULL
    OR p_activity_date IS NULL OR p_source IS NULL OR p_source NOT IN ('manual','quick_capture','todo','codex')
    OR p_status IS NULL OR p_status NOT IN ('DRAFT','READY') OR p_work_category IS NULL OR p_work_category NOT IN ('INTERNSHIP','THESIS','PERSONAL') THEN
    RAISE EXCEPTION 'Invalid activity' USING ERRCODE = '22023';
  END IF;
  IF (p_source = 'todo') IS DISTINCT FROM (p_todo_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid Todo source' USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object('title',nullif(trim(p_title),''),'description',nullif(trim(p_description),''),
    'date',p_activity_date,'start',p_start_time,'end',p_end_time,'source',p_source,'status',p_status,'todo',p_todo_id,'category',p_work_category);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || ':activity:' || p_key, 0));
  SELECT * INTO previous FROM public.mutation_idempotency WHERE user_id = actor AND key = p_key AND operation = 'activity.create';
  IF FOUND THEN
    IF previous.request_payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO result FROM public.activities WHERE id = previous.resource_id AND user_id = actor AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE = '42501'; END IF;
    RETURN result;
  END IF;
  IF p_todo_id IS NOT NULL THEN
    PERFORM 1 FROM public.todos WHERE id = p_todo_id AND user_id = actor AND deleted_at IS NULL AND work_category=p_work_category FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Todo unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.activities(user_id,title,description,activity_date,start_time,end_time,source,status,todo_id,work_category)
    VALUES (actor,nullif(trim(p_title),''),nullif(trim(p_description),''),p_activity_date,p_start_time,p_end_time,p_source,p_status,p_todo_id,p_work_category)
    RETURNING * INTO result;
  INSERT INTO public.mutation_idempotency(user_id,key,operation,resource_id,request_payload)
    VALUES (actor,p_key,'activity.create',result.id,payload);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text,text,text,date,time,time,text,text,uuid,text) TO authenticated;
