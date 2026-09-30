BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(29);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase3-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'phase3-b@example.invalid', '', now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a3', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.evidences (id, user_id, type, status, upload_id)
VALUES ('00000000-0000-4000-8000-0000000000e3',
  '00000000-0000-4000-8000-0000000000a3', 'PHOTO', 'UPLOADING',
  '00000000-0000-4000-8000-0000000000c3');
INSERT INTO public.photo_upload_sessions
  (evidence_id, user_id, upload_id, expected_size, expected_mime,
   original_filename, stored_filename, drive_folder_id)
VALUES ('00000000-0000-4000-8000-0000000000e3',
  '00000000-0000-4000-8000-0000000000a3',
  '00000000-0000-4000-8000-0000000000c3',
  100, 'image/png', 'test.png', 'safe.png', 'private-folder');
SELECT lives_ok($$SELECT public.finalize_photo_evidence(
  '00000000-0000-4000-8000-0000000000e3', 'drive-photo-a', 'private-folder',
  'image/png', 100, repeat('a', 64), 10, 10)$$, 'A finalizes own photo');
SELECT is((SELECT status FROM public.evidences WHERE id = '00000000-0000-4000-8000-0000000000e3'),
  'AVAILABLE', 'photo only available after metadata');
SELECT lives_ok($$SELECT public.create_link_evidence('Reference', NULL, 'https://example.com')$$,
  'A creates link evidence');
SELECT is((SELECT count(*) FROM public.link_evidences), 1::bigint, 'link subtype saved');
INSERT INTO public.activities (id, user_id, title, activity_date)
VALUES ('00000000-0000-4000-8000-0000000000d3',
  '00000000-0000-4000-8000-0000000000a3', 'A Activity', current_date);
SELECT lives_ok($$INSERT INTO public.activity_evidences
  (activity_id, evidence_id, attached_by)
  VALUES ('00000000-0000-4000-8000-0000000000d3',
    '00000000-0000-4000-8000-0000000000e3',
    '00000000-0000-4000-8000-0000000000a3')$$, 'A attaches own photo');
SELECT is((SELECT count(*) FROM public.activity_evidences), 1::bigint, 'one relation exists');
SELECT lives_ok($$DELETE FROM public.activity_evidences
  WHERE activity_id = '00000000-0000-4000-8000-0000000000d3'
    AND evidence_id = '00000000-0000-4000-8000-0000000000e3'$$, 'A detaches own photo');
SELECT is((SELECT count(*) FROM public.evidences WHERE id = '00000000-0000-4000-8000-0000000000e3'),
  1::bigint, 'detach retains evidence');
SELECT lives_ok($$SELECT public.create_photo_only_activity(
  'phase3-photo-only', '00000000-0000-4000-8000-0000000000e3', current_date)$$,
  'A creates photo-only Activity');
SELECT is((SELECT count(*) FROM public.activities WHERE needs_description = true),
  1::bigint, 'photo-only Activity needs description');
SELECT lives_ok($$SELECT public.create_photo_only_activity(
  'phase3-photo-only', '00000000-0000-4000-8000-0000000000e3', current_date)$$,
  'photo-only retry returns original');
SELECT is((SELECT count(*) FROM public.activities WHERE needs_description = true),
  1::bigint, 'photo-only retry creates no duplicate');
SELECT is((SELECT count(*) FROM public.evidence_library), 2::bigint,
  'A sees only own library items');
SELECT is((SELECT blocked_count FROM public.begin_evidence_delete(
  '00000000-0000-4000-8000-0000000000e3', false)), 1,
  'assigned photo requires explicit detach');
SELECT is((SELECT status FROM public.evidences
  WHERE id = '00000000-0000-4000-8000-0000000000e3'), 'AVAILABLE',
  'blocked delete preserves available state');
SELECT throws_ok($$UPDATE public.evidences SET status = 'FAILED'
  WHERE id = '00000000-0000-4000-8000-0000000000e3'$$, '23514');
SELECT is((SELECT status FROM public.begin_evidence_delete(
  '00000000-0000-4000-8000-0000000000e3', true)), 'DELETE_PENDING',
  'explicit detach begins pending delete');
SELECT throws_ok($$UPDATE public.evidences SET status = 'AVAILABLE'
  WHERE id = '00000000-0000-4000-8000-0000000000e3'$$, '23514');
SELECT is((SELECT count(*) FROM public.activity_evidences), 0::bigint,
  'pending delete leaves no relation');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b3', true);
SELECT is((SELECT count(*) FROM public.evidences), 0::bigint, 'B cannot list A evidence');
SELECT is((SELECT count(*) FROM public.evidence_library), 0::bigint, 'B cannot list A library');
SELECT is((SELECT count(*) FROM public.begin_evidence_delete(
  '00000000-0000-4000-8000-0000000000e3', true)), 0::bigint,
  'B cannot begin deleting A evidence');
SELECT is((SELECT count(*) FROM public.photo_evidences), 0::bigint, 'B cannot list A photo metadata');
SELECT is((SELECT count(*) FROM public.photo_upload_sessions), 0::bigint, 'B cannot list A upload session');
SELECT is((SELECT count(*) FROM public.activity_evidences), 0::bigint, 'B cannot list A relations');
SELECT throws_ok($$INSERT INTO public.activity_evidences
  (activity_id, evidence_id, attached_by)
  VALUES ('00000000-0000-4000-8000-0000000000d3',
    '00000000-0000-4000-8000-0000000000e3',
    '00000000-0000-4000-8000-0000000000b3')$$, '42501');
SELECT throws_ok($$SELECT public.finalize_photo_evidence(
  '00000000-0000-4000-8000-0000000000e3', 'drive-photo-b', 'private-folder',
  'image/png', 100, repeat('b', 64), 10, 10)$$, '42501');
SELECT throws_ok($$SELECT * FROM public.storage_reconciliation_jobs$$, '42501');
SELECT throws_ok($$DELETE FROM public.evidences
  WHERE id = '00000000-0000-4000-8000-0000000000e3'$$, '42501');

SELECT * FROM finish(true);
ROLLBACK;
