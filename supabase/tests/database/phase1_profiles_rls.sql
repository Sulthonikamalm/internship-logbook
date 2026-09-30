BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(14);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'phase1-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'phase1-b@example.invalid', '', now());

SELECT is((SELECT count(*) FROM public.profiles WHERE id IN (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000000b2'
)), 2::bigint, 'new auth users get profiles');

INSERT INTO public.audit_logs (actor_user_id, entity_type, action)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'profile', 'test_a'),
  ('00000000-0000-4000-8000-0000000000b2', 'profile', 'test_b');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is((SELECT count(*) FROM public.profiles), 1::bigint, 'A reads only A');
SELECT is((SELECT count(*) FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000b2'), 0::bigint, 'A cannot read B');
SELECT lives_ok($$UPDATE public.profiles SET display_name = 'User A' WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, 'A updates own display name');
SELECT is((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000a1'), 'User A', 'own update persists');
SELECT is((SELECT count(*) FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000b2'), 0::bigint, 'A cannot query B by ID');
SELECT lives_ok($$UPDATE public.profiles SET display_name = 'HACKED' WHERE id = '00000000-0000-4000-8000-0000000000b2'$$, 'A update against B is filtered by RLS');
SELECT throws_ok($$UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, '42501', 'Cannot modify privileged profile fields', 'A cannot become admin');
SELECT throws_ok($$UPDATE public.profiles SET is_active = false WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, '42501', 'Cannot modify privileged profile fields', 'A cannot disable own account');
SELECT is((SELECT count(*) FROM public.audit_logs), 1::bigint, 'A reads only own audit events');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE actor_user_id = '00000000-0000-4000-8000-0000000000b2'), 0::bigint, 'A cannot read B audit events');
SELECT throws_ok($$INSERT INTO public.audit_logs (actor_user_id, entity_type, action) VALUES ('00000000-0000-4000-8000-0000000000a1', 'profile', 'forged')$$, '42501', NULL, 'A cannot forge audit events');

RESET ROLE;
SELECT isnt((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000b2'), 'HACKED', 'B profile was not modified');
UPDATE public.profiles SET is_active = false WHERE id = '00000000-0000-4000-8000-0000000000a1';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.profiles SET is_active = true WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, '42501', 'Cannot modify privileged profile fields', 'disabled A cannot reactivate');

SELECT * FROM finish(true);
ROLLBACK;
