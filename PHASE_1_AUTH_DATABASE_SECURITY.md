# Phase 1 — Authentication, Database Foundation & Security Boundary


> **Dokumen eksekusi AI Agent — InternFlow**
>
> Dokumen ini adalah turunan implementasi dari PRD InternFlow. PRD tetap menjadi source of truth untuk business rule.
> Prioritas konflik: **Security > Data Integrity > PRD Business Rule > UX Convenience > Implementation Shortcut**.
>
> Aturan global:
> - Jangan skip checklist tanpa alasan teknis yang dapat diverifikasi.
> - Jangan menandai `DONE` hanya karena UI sudah terlihat selesai.
> - Backend, RLS, validation, error path, test, dan build termasuk definisi selesai.
> - Jangan membuat mock permanent untuk dependency produksi.
> - Jangan mengekspos secret ke browser/log.
> - Jangan mengandalkan frontend untuk authorization.
> - Semua migration harus replayable dari database kosong.
> - Semua user-owned resource wajib diuji terhadap IDOR/cross-user access.
> - Semua mutation penting wajib memiliki state loading, success, error, dan recovery.
> - Setelah kelompok perubahan: lint → typecheck → test → build.
> - Jika hard gate phase gagal, agent DILARANG lanjut phase berikutnya.

## 1. Objective

Bangun seluruh fondasi identity, session, database ownership, Row Level Security, protected route, dan authorization helper. Phase berikutnya tidak boleh dibangun di atas auth/RLS yang belum terbukti aman.

## 2. Entry Criteria

- [ ] Phase 0 selesai.
- [ ] Next.js App Router berjalan.
- [ ] TypeScript strict aktif.
- [ ] Tailwind + shadcn aktif.
- [ ] design token blue/white tersedia.
- [ ] lint/typecheck/build Phase 0 hijau.
- [ ] `.env.example` tersedia.

IF salah satu gagal:
- STOP.
- Perbaiki foundation.
- Jangan menggunakan `ignoreBuildErrors`, mematikan lint, atau RLS bypass sebagai jalan pintas.

## 3. In Scope

- Supabase Auth.
- Supabase browser/server/admin client separation.
- session refresh.
- protected layout.
- profiles.
- role baseline.
- account active/disabled.
- timezone profile.
- updated_at trigger.
- audit log foundation.
- RLS profile.
- login/logout.
- safe redirect.
- authorization test harness.
- draft preservation contract ketika session habis.

## 4. Out of Scope

- Activity.
- Todo.
- Evidence.
- Google Drive.
- GitHub.
- Excel.
- Supervisor workflow penuh.

## 5. Immutable Rules

1. Identity berasal dari authenticated session.
2. `user_id` dari browser tidak pernah dipercaya.
3. User A tidak dapat membaca/mengubah resource User B.
4. User tidak dapat menaikkan `role` sendiri.
5. `is_active=false` memblok protected app.
6. Admin tidak otomatis mempunyai `content_read_all`.
7. Supabase service role hanya server.
8. Redirect login harus same-origin/relative.
9. Error auth tidak membocorkan apakah email terdaftar.

## 6. Environment Contract

Minimal:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

Rules:
- service role tidak boleh `NEXT_PUBLIC_*`.
- env divalidasi ketika startup/build.
- log hanya nama env yang hilang, bukan nilainya.
- server-only env tidak boleh diimport Client Component.

## 7. Target Structure

```text
src/
  app/
    (auth)/login/page.tsx
    (protected)/layout.tsx
    (protected)/dashboard/page.tsx
  lib/
    supabase/browser.ts
    supabase/server.ts
    supabase/admin.ts
    auth/get-current-user.ts
    auth/require-user.ts
    auth/require-active-user.ts
    auth/safe-redirect.ts
    env/client.ts
    env/server.ts
  features/auth/
    schemas/
    actions/
    components/
supabase/migrations/
```

Forbidden:
- satu Supabase client dipakai untuk browser/server/admin.
- service role import dari client.
- env secret tersebar di component.

## 8. Migration — profiles

Recommended:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'user',
  is_active boolean not null default true,
  timezone text not null default 'Asia/Jakarta',
  content_read_all boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Check role:
- user
- supervisor
- admin

Validation:
- display_name trim dan non-whitespace.
- timezone IANA.
- role/is_active/content_read_all tidak self-editable.

## 9. Profile Provisioning

Ketika auth user dibuat, profile wajib tersedia.

Recommended DB trigger:
- insert profile.
- `on conflict(id) do nothing`.
- jika nama kosong gunakan metadata/email local-part/fallback `"User"`.

IF trigger gagal:
- provisioning harus terdeteksi.
- jangan membiarkan authenticated user masuk app tanpa profile tanpa handling.

## 10. updated_at

Buat reusable function `set_updated_at()` dan trigger untuk table ber-`updated_at`.

Server/DB timestamp authoritative.

## 11. Audit Log Foundation

```sql
audit_logs (
  id uuid primary key,
  actor_user_id uuid null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  metadata jsonb not null default '{}',
  request_id text null,
  created_at timestamptz not null default now()
)
```

Rules:
- password/token/secret dilarang masuk metadata.
- ordinary user tidak UPDATE/DELETE audit.
- audit mutation kritis dibuat server/trusted layer.

## 12. RLS — profiles

Enable RLS.

### SELECT
User membaca profile sendiri.

### UPDATE
Self update hanya:
- display_name
- timezone

User dilarang mengubah:
- id
- role
- is_active
- content_read_all

RLS row policy tidak cukup untuk field-level privilege. Gunakan RPC/trusted server whitelist/column privilege/trigger.

Tests:
- A SELECT A → allowed.
- A SELECT B → denied/no row.
- A update display name → allowed.
- A update role admin → denied.
- A set is_active true setelah disabled → denied.

## 13. Auth Client Separation

### Browser client
Anon key only.

### Server client
Uses request cookies/session.

### Admin client
Service role.
Server-only module with guard (mis. `server-only`).

Forbidden:
- exporting admin client dari barrel file yang bisa diimport browser.
- serializing service role into props.

## 14. Session Handling

- protected layout server-side auth check.
- refresh expired session using supported Supabase SSR flow.
- no protected content flash before redirect.

IF refresh succeeds:
- continue.

IF refresh fails:
- redirect login.
- preserve non-sensitive local draft contract.
- after re-auth restore only draft belonging same user.

## 15. Login UX

Fields:
- email.
- password.

Rules:
- trim email.
- jangan trim password.
- Enter submit.
- loading state.
- disable double submit.
- generic failure copy:
  `Email atau password tidak valid.`

Do not display:
`Email tidak ditemukan`.

## 16. Safe Redirect

Support optional `next`.

Allow:
- `/dashboard`
- `/activities/...`

Reject:
- `https://...`
- `//...`
- javascript scheme
- malformed path

Fallback `/dashboard`.

Unit test parser.

## 17. Logout

Logout:
- Supabase sign out.
- clear sensitive cache.
- redirect login.

IF logout request fails:
- show controlled state.
- jangan menyatakan server session sudah terminated jika belum.
- no data deletion.

## 18. Disabled Account

`profiles.is_active=false`.

`requireActiveUser()` dipakai pada protected server boundary.

IF authenticated but disabled:
- deny app.
- optional forced sign-out.
- route `/account-disabled`.
- no private page rendering.

Check setiap request penting, bukan hanya login.

## 19. Authorization Helper

Create normalized context:

```ts
type AuthContext = {
  userId: string
  role: "user" | "supervisor" | "admin"
  timezone: string
  isActive: boolean
}
```

Helpers:
- `getCurrentUser`
- `requireUser`
- `requireActiveUser`

Jangan setiap feature mengimplementasi auth parsing sendiri.

## 20. Error Contract

Codes:

```text
UNAUTHENTICATED
FORBIDDEN
ACCOUNT_DISABLED
VALIDATION_ERROR
CONFLICT
NOT_FOUND_OR_FORBIDDEN
INTERNAL_ERROR
```

Unknown:
- generate request ID.
- server log safe context.
- UI generic Indonesian copy.
- no stack trace.

## 21. Protected Layout

Server-side:
1. get session.
2. require user.
3. fetch profile.
4. require active.
5. render shell.

Forbidden:
- client `useEffect` baru redirect setelah private UI render.

## 22. Not Found vs Forbidden

Untuk private resource phase berikut:
- query harus owner-scoped.
- jangan mengungkap "ID ini ada tetapi milik orang lain."
- gunakan `NOT_FOUND_OR_FORBIDDEN` convention.

## 23. Draft Contract

Key future:

```text
internflow:draft:<userId>:<feature>:<draftId>
```

Boleh disimpan:
- text draft.
- non-secret form state.

Dilarang:
- session token.
- OAuth token.
- service role.
- external refresh token.

IF user switch:
draft A tidak boleh muncul ke B.

## 24. Test Plan

### Unit
- env.
- safe redirect.
- role parser.
- timezone.
- error mapper.

### Integration
- unauthenticated profiles denied.
- A own access.
- A cannot B.
- A cannot privilege escalate.
- disabled behavior.
- audit immutable to ordinary user.

### E2E
- valid login.
- invalid login.
- protected redirect.
- logout.
- disabled account.
- mobile login.

## 25. Security Checklist

- [ ] no service role browser.
- [ ] no secret in NEXT_PUBLIC.
- [ ] RLS enabled.
- [ ] role field protected.
- [ ] open redirect prevented.
- [ ] protected layout server guarded.
- [ ] logs secret-free.
- [ ] cross-user test automated.

## 26. Do Not Implement

- Activity/Todo/Evidence.
- Drive/GitHub.
- admin bypass query for convenience.
- RLS disabled in development.
- service role for ordinary user queries.
- public exposure of profiles beyond need.

## 27. Hard Exit Gate

- [ ] fresh DB migration replay.
- [ ] profile auto provisioning.
- [ ] login/logout.
- [ ] protected layout.
- [ ] disabled user blocked.
- [ ] A/B RLS test.
- [ ] privilege escalation test.
- [ ] lint.
- [ ] typecheck.
- [ ] test.
- [ ] production build.
- [ ] secret scan clean.

**Jika salah satu critical gagal: jangan lanjut Phase 2.**
