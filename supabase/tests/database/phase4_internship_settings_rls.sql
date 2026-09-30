BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(14);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'phase4-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', 'phase4-b@example.invalid', '', now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a4', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- 1. User A creates own internship settings
SELECT lives_ok($$INSERT INTO public.internship_settings (user_id, start_date, end_date, working_days)
  VALUES ('00000000-0000-4000-8000-0000000000a4', '2026-09-01', '2026-12-31', array[1,2,3,4,5])$$,
  'User A creates own settings');

SELECT is((SELECT count(*) FROM public.internship_settings), 1::bigint, 'one settings row created');

-- 2. User A can update own settings
SELECT lives_ok($$UPDATE public.internship_settings SET working_days = array[1,2,3,4,5,6]
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  'User A updates own working days');

-- 3. Constraint: end_date >= start_date
SELECT throws_ok($$UPDATE public.internship_settings SET start_date = '2026-12-31', end_date = '2026-09-01'
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  '23514', NULL, 'date order constraint triggers when end < start');

-- 4. Constraint: working_days values must be 1..7
SELECT throws_ok($$UPDATE public.internship_settings SET working_days = array[0, 8]::smallint[]
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  '23514', NULL, 'working days must be 1..7');

-- 5. Trigger: working_days must be unique
SELECT throws_ok($$UPDATE public.internship_settings SET working_days = array[1, 1, 2]::smallint[]
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  '23514', NULL, 'duplicate working days rejected');

-- 6. User A cannot forge owner
SELECT throws_ok($$INSERT INTO public.internship_settings (user_id, start_date, end_date)
  VALUES ('00000000-0000-4000-8000-0000000000b4', '2026-09-01', '2026-12-31')$$,
  '42501', NULL, 'User A cannot insert settings for User B');

-- 7. Switch to User B
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b4', true);

-- User B cannot see User A's settings
SELECT is((SELECT count(*) FROM public.internship_settings), 0::bigint, 'User B cannot read User A settings');

-- User B cannot update User A's settings
SELECT lives_ok($$UPDATE public.internship_settings SET working_days = array[1,2,3]
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  'User B update touches 0 rows');

SELECT is((SELECT count(*) FROM public.internship_settings WHERE user_id = '00000000-0000-4000-8000-0000000000a4'),
  0::bigint, 'User A settings still hidden from User B');

-- DELETE is revoked
SELECT throws_ok($$DELETE FROM public.internship_settings
  WHERE user_id = '00000000-0000-4000-8000-0000000000a4'$$,
  '42501', NULL, 'DELETE is revoked on internship_settings');

-- User B can create their own settings
SELECT lives_ok($$INSERT INTO public.internship_settings (user_id, start_date, end_date, working_days)
  VALUES ('00000000-0000-4000-8000-0000000000b4', '2026-10-01', '2026-11-30', array[1,2,3,4,5])$$,
  'User B creates own settings');

SELECT is((SELECT count(*) FROM public.internship_settings), 1::bigint, 'User B sees only 1 row');

SELECT * FROM finish();
ROLLBACK;
