BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(12);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a9', 'authenticated', 'authenticated', 'attendance-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-0000000000b9', 'authenticated', 'authenticated', 'attendance-b@example.invalid', '', now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a9', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok($$SELECT public.start_daily_attendance()$$, 'A can start attendance');
SELECT set_config('qa.attendance_id', (public.start_daily_attendance()->'session'->>'id'), true);
SELECT is((public.start_daily_attendance()->'session'->>'id'), current_setting('qa.attendance_id'), 'retry returns the same daily session');
SELECT is((SELECT count(*) FROM public.attendance_sessions), 1::bigint, 'owner sees one daily session');
SELECT is((public.end_daily_attendance(current_setting('qa.attendance_id')::uuid)->>'ok')::boolean, true, 'A can end attendance');
SELECT ok((SELECT ended_at IS NOT NULL AND NOT auto_closed FROM public.attendance_sessions WHERE id=current_setting('qa.attendance_id')::uuid), 'manual end stores a server timestamp');
SELECT is(((public.end_daily_attendance(current_setting('qa.attendance_id')::uuid)->'session'->>'ended_at')::timestamptz), (SELECT ended_at FROM public.attendance_sessions WHERE id=current_setting('qa.attendance_id')::uuid), 'end retry is idempotent');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b9', true);
SELECT is((SELECT count(*) FROM public.attendance_sessions), 0::bigint, 'B cannot read A attendance');
SELECT is((public.end_daily_attendance(current_setting('qa.attendance_id')::uuid)->>'code'), 'NOT_FOUND', 'B cannot end A attendance');
SELECT throws_ok($$INSERT INTO public.attendance_sessions(user_id,work_date,timezone,started_at,auto_close_at)
  VALUES('00000000-0000-4000-8000-0000000000b9',current_date,'Asia/Jakarta',now(),now()+interval '1 day')$$,
  '42501', NULL, 'authenticated users cannot insert rows directly');
RESET ROLE;

INSERT INTO public.attendance_sessions(user_id,work_date,timezone,started_at,auto_close_at)
VALUES (
  '00000000-0000-4000-8000-0000000000a9',
  current_date - 2,
  'Asia/Jakarta',
  ((current_date - 2)::timestamp + time '08:00') AT TIME ZONE 'Asia/Jakarta',
  ((current_date - 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
);
SELECT is(public.close_expired_attendance(), 1, 'cron processor closes an expired session');
SELECT ok((SELECT ended_at = auto_close_at AND auto_closed FROM public.attendance_sessions WHERE user_id='00000000-0000-4000-8000-0000000000a9' AND work_date=current_date-2), 'automatic end is stored at local midnight');
SELECT throws_ok($$INSERT INTO public.attendance_sessions(user_id,work_date,timezone,started_at,auto_close_at)
  VALUES('00000000-0000-4000-8000-0000000000a9',current_date-2,'Asia/Jakarta',now(),now()+interval '1 day')$$,
  '23505', NULL, 'database prevents a second session on the same local date');

SELECT * FROM finish(true);
ROLLBACK;
