BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(20);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'phase2-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'phase2-b@example.invalid', '', now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok($$SELECT public.create_activity_idempotent(
  'phase2-key', 'Test activity', NULL, timezone('Asia/Jakarta', now())::date,
  NULL, NULL, 'manual', 'DRAFT')$$, 'A creates own activity');
SELECT is((SELECT count(*) FROM public.activities), 1::bigint, 'one activity created');
SELECT set_config('app.phase2_activity_id',
  (SELECT resource_id::text FROM public.mutation_idempotency WHERE key = 'phase2-key'), true);
SELECT lives_ok($$SELECT public.create_activity_idempotent(
  'phase2-key', 'Different retry payload', NULL, timezone('Asia/Jakarta', now())::date,
  NULL, NULL, 'manual', 'DRAFT')$$, 'duplicate key returns original');
SELECT is((SELECT count(*) FROM public.activities), 1::bigint, 'duplicate creates no second activity');
SELECT is((SELECT title FROM public.activities WHERE id = current_setting('app.phase2_activity_id')::uuid),
  'Test activity', 'retry retains original payload');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'activity.created'),
  1::bigint, 'create audit emitted once');
SELECT lives_ok($$UPDATE public.activities SET title = 'Updated', version = 2
  WHERE id = current_setting('app.phase2_activity_id')::uuid AND version = 1$$,
  'A updates with expected version');
SELECT is((SELECT version FROM public.activities WHERE id = current_setting('app.phase2_activity_id')::uuid),
  2, 'version advanced');
SELECT lives_ok($$UPDATE public.activities SET title = 'STALE', version = 2
  WHERE id = current_setting('app.phase2_activity_id')::uuid AND version = 1$$,
  'stale predicate touches no row');
SELECT is((SELECT title FROM public.activities WHERE id = current_setting('app.phase2_activity_id')::uuid),
  'Updated', 'stale update did not overwrite');

SELECT lives_ok($$UPDATE public.activities SET deleted_at = now(), version = 3
  WHERE id = current_setting('app.phase2_activity_id')::uuid AND version = 2$$,
  'soft delete succeeds');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'activity.soft_deleted'),
  1::bigint, 'soft delete audited');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
SELECT is((SELECT count(*) FROM public.activities), 0::bigint, 'B cannot read A activity');
SELECT is((SELECT count(*) FROM public.mutation_idempotency), 0::bigint,
  'B cannot read A idempotency key');
SELECT lives_ok($$UPDATE public.activities SET title = 'B overwrite', version = 4
  WHERE id = current_setting('app.phase2_activity_id')::uuid$$,
  'B update request touches no A row');
SELECT lives_ok($$UPDATE public.activities SET deleted_at = now(), version = 4
  WHERE id = current_setting('app.phase2_activity_id')::uuid$$,
  'B soft delete request touches no A row');
SELECT throws_ok($$DELETE FROM public.activities
  WHERE id = current_setting('app.phase2_activity_id')::uuid$$,
  '42501');
SELECT throws_ok($$INSERT INTO public.activities (user_id, title, activity_date)
  VALUES ('00000000-0000-4000-8000-0000000000a1', 'Forged owner', current_date)$$,
  '42501');
SELECT lives_ok($$SELECT public.create_activity_idempotent(
  'phase2-b-key', 'B activity', NULL, timezone('Asia/Jakarta', now())::date,
  NULL, NULL, 'manual', 'DRAFT')$$, 'B can create own activity');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
SELECT is((SELECT title FROM public.activities WHERE id = current_setting('app.phase2_activity_id')::uuid),
  'Updated', 'B mutations left A activity unchanged');

SELECT * FROM finish(true);
ROLLBACK;
