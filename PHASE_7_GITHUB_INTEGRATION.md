# Phase 7 — Optional GitHub Integration & Commit Evidence


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

Tambahkan GitHub sebagai optional evidence source: connect account, sync metadata commit, select commit, convert/reuse generic Evidence, attach ke Activity/Todo, dan mempertahankan historical evidence ketika source berubah/hilang.

## 2. Entry Criteria

- generic Evidence stable.
- Todo/Activity picker reusable.
- Excel generic evidence links.
- server secret boundary proven.

## 3. Immutable Rules

1. GitHub optional.
2. App penuh tanpa GitHub.
3. Commit tidak otomatis jadi Activity/logbook.
4. commit menjadi evidence hanya setelah user select.
5. no source code copied.
6. least privilege.
7. disconnect tidak menghapus historical evidence.
8. user only own cache/connection.
9. no repo visibility mutation.

## 4. Env

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=
```

Server-only secret.

Callback exact per env.

## 5. OAuth Security

- random state.
- bind state to user/session.
- expiry.
- one-time use.
- verify callback.
- PKCE if chosen/supported.
- no token in URL/localStorage.

Invalid state → hard reject.

## 6. github_connections

```sql
github_connections (
 id uuid pk,
 user_id uuid unique not null,
 github_user_id text not null,
 github_username text not null,
 connection_status text not null,
 scopes text[] null,
 connected_at timestamptz,
 last_synced_at timestamptz,
 created_at timestamptz,
 updated_at timestamptz
)
```

Status:
CONNECTED / REAUTH_REQUIRED / DISCONNECTED / ERROR.

## 7. Token Storage

Token not in normal public table response.

Prefer private schema/encrypted server-only storage.

No client grants.
No token logs.
No audit token.

Threat model documented.

## 8. RLS

Connection owner metadata only.
Commits owner.
Token private.
Evidence owner.
Cross-owner existing guard.

## 9. Connect Start

`/api/integrations/github/connect`

1. require active user.
2. random state.
3. store/bind expiry.
4. redirect GitHub.

## 10. Callback

1. state verify.
2. code exchange server.
3. fetch identity.
4. validate scopes.
5. upsert metadata.
6. secure token.
7. CONNECTED.
8. audit.
9. redirect success.

IF exchange fails:
- no false CONNECTED.

## 11. Reconnect Different Account

If new github_user_id differs:
- explicit confirmation.
- old evidence keeps original snapshot.
- do not rewrite old evidence attribution.

## 12. Disconnect

- remove/revoke token as feasible.
- status DISCONNECTED.
- stop sync.
- retain cached commits/evidence.

Core app unaffected.

## 13. github_commits

```sql
github_commits (
 id uuid pk,
 user_id uuid not null,
 github_connection_id uuid not null,
 repository_id text not null,
 repository_name text not null,
 sha text not null,
 message text,
 commit_url text,
 branch text null,
 author_date timestamptz,
 source_status text not null default 'AVAILABLE',
 synced_at timestamptz,
 unique(user_id,repository_id,sha)
)
```

Status:
AVAILABLE / SOURCE_UNAVAILABLE / STALE.

## 14. Sync

MVP manual `Sinkronkan`.

Optional auto refresh when picker stale, not aggressive polling.

Flow:
- auth.
- CONNECTED.
- token.
- fetch bounded repos/commits.
- normalize.
- upsert.
- last_synced.
- telemetry/audit.

Pagination capped.

## 15. Repository Scope

Avoid syncing every huge org repository.

UI can select repository/filter.

Only request data user is authorized to access.

Do not infer authorship solely from display string if API identity uncertain.

## 16. Commit Picker

Filters:
- repository.
- date.
- message search.

Card:
- repo.
- short SHA.
- first-line message.
- date.
- source status.

Multi-select.

## 17. Generic Evidence Conversion

On first selected commit:
- create/reuse Evidence type `GITHUB_COMMIT`.
- owner current.
- AVAILABLE if source cached valid.
- reference to commit subtype.

Optional table:
`github_evidences(evidence_id, github_commit_id)`.

Do not dump full payload.

## 18. Duplicate

Same commit Evidence:
- reuse.

Same commit already same Activity:
- idempotent/no duplicate.

Same commit other Activity:
- allow warning.

## 19. Todo Integration

Same generic EvidencePicker GitHub tab.

Commit can satisfy gate only if Evidence AVAILABLE and type allowed.

If source later unavailable:
Todo completed remains but health may become incomplete according Phase 6 rule.

## 20. Excel

GitHub evidence URL = commit_url.

Private repo:
- label that access may require GitHub permission.
- do not change repo permission.

If source unavailable:
- cached SHA/message/status retained.
- link may be stale.

## 21. Revoked Token

GitHub 401:
- REAUTH_REQUIRED.
- stop sync.
- cached data remains.
- CTA reconnect.
- core app unaffected.

## 22. Rate Limit

Detect status/headers.

UI:
`Sinkronisasi GitHub sementara dibatasi. Data sinkronisasi terakhir tetap tersedia.`

Show last sync.

Backoff.
No aggressive loop.

## 23. Repo Permission Lost

403/404:
- cached commit source status SOURCE_UNAVAILABLE as appropriate.
- retain historical evidence.
- no deletion.

## 24. Commit Force-Pushed/Deleted

Keep:
- SHA.
- message.
- date.
- old URL.

Mark unavailable/stale after verification.

## 25. Security

- OAuth state.
- least scopes.
- token server-only.
- commit text escaped.
- URL https.
- org/SSO failure safe.
- user B cannot cache A.

## 26. GitHub Settings UX

Disconnected:
- explanation.
- Connect.

Connected:
- username.
- last sync.
- Sync.
- Disconnect.

Reauth:
- warning + reconnect.

Do not nag non-coders globally.

## 27. Picker UX

Tabs:
- Foto
- GitHub
- Link

Disconnected GitHub tab:
- CTA Connect.
- other evidence works.

## 28. Defects

- state mismatch → reject.
- repeated callback → reject/idempotent.
- token exchange fail → not connected.
- revoked → reauth.
- rate limit → cached.
- repo lost → snapshot.
- commit deleted → snapshot.
- reconnect different user → confirm.
- duplicate sync → unique upsert.
- duplicate evidence → reuse.
- private URL reviewer no access → label.
- GitHub outage → core works.
- malicious commit HTML → escaped.
- B commit ID → RLS denied.
- session expires OAuth → safe auth restart.

## 29. Tests

Unit:
- state.
- error mapping.
- normalization.
- duplicate/reuse.
- link label.

Integration with adapter:
- callback.
- sync.
- 401.
- rate.
- repo unavailable.
- RLS.

E2E:
- disconnected core.
- connect mock/sandbox.
- sync.
- picker.
- Activity attach.
- Todo attach.
- Excel.
- disconnect historical remains.

## 30. Do Not Implement

- write repo.
- create commits.
- auto attach all.
- mandatory GitHub.
- source code copy.
- visibility changes.
- delete history on disconnect.
- token localStorage.

## 31. Exit Gate

- [x] optional proven.
- [x] OAuth state.
- [x] token secure.
- [x] manual sync.
- [x] picker.
- [x] evidence conversion/reuse.
- [x] historical retention.
- [x] rate/revocation.
- [x] report link.
- [x] RLS.
- [x] tests/build.

Phase 7 complete. Ready for Phase 8.
