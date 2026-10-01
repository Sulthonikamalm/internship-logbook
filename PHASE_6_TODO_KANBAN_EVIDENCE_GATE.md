# Phase 6 — Interactive Todo Kanban, Drag & Drop & Evidence Gates


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

Bangun Todo optional dengan Kanban interaktif, server-authoritative transition, evidence gate, stage-specific evidence, immutable history, optimistic locking, mobile fallback, dan Todo→Activity helper.

## 2. Entry Criteria

- Phase 5 pass.
- Activity/Evidence stable.
- generic EvidencePicker reusable.

## 3. Immutable Rules

1. Todo optional.
2. Activity tetap independent.
3. Logbook dari Activity.
4. drag bukan source of truth.
5. transition selalu server validated.
6. only AVAILABLE evidence counts.
7. broken/failed/uploading invalid for gate.
8. history immutable.
9. mobile fallback mandatory.
10. DONE tidak auto-reopen jika evidence kemudian rusak; flag health.

## 4. todo_stages

```sql
todo_stages (
 id uuid pk,
 code text unique not null,
 name text not null,
 position int not null,
 requires_evidence_on_enter boolean not null default false,
 requires_evidence_on_exit boolean not null default false,
 minimum_evidence_count int not null default 0,
 allowed_evidence_types text[] null,
 requires_note boolean not null default false,
 is_terminal boolean not null default false,
 created_at timestamptz
)
```

Seed idempotent:
- BACKLOG
- TODO
- IN_PROGRESS
- REVIEW
- DONE

Default:
- IN_PROGRESS→REVIEW minimum 1.
- REVIEW→DONE minimum 1.

## 5. todos

```sql
todos (
 id uuid pk,
 user_id uuid not null,
 title text not null,
 description text null,
 priority text not null default 'MEDIUM',
 due_date date null,
 current_stage_id uuid not null,
 sort_order numeric not null default 1000,
 evidence_health text not null default 'OK',
 version int not null default 1,
 started_at timestamptz null,
 completed_at timestamptz null,
 created_at timestamptz,
 updated_at timestamptz,
 deleted_at timestamptz
)
```

Priority:
LOW/MEDIUM/HIGH/URGENT.

Indexes user+stage+sort, due date.

## 6. todo_transitions

```sql
todo_transitions (
 id uuid pk,
 todo_id uuid not null,
 user_id uuid not null,
 from_stage_id uuid,
 to_stage_id uuid not null,
 note text,
 evidence_count int not null default 0,
 idempotency_key text not null,
 created_at timestamptz not null,
 unique(user_id,idempotency_key)
)
```

History ordinary user cannot update/delete.

## 7. todo_evidences

```sql
todo_evidences (
 todo_id uuid,
 evidence_id uuid,
 stage_id uuid null,
 attached_by uuid,
 attached_at timestamptz,
 primary key(todo_id,evidence_id,stage_id)
)
```

Cross-owner guard.

stage_id null = Todo overall.
stage-specific = process proof.

## 8. Activity Link

Add nullable `activities.todo_id` FK.

Guard:
Activity owner == Todo owner.

Delete Todo soft; Activity retained.

## 9. Todo CRUD

Create:
- title required <=200.
- description.
- priority.
- due.
- initial BACKLOG.

Update uses version.

Delete soft.

No direct owner input.

## 10. RLS

todos owner.
todo evidence owner through parent.
transitions owner SELECT; mutation through trusted transition service.
stages authenticated read, no ordinary mutation.

Direct API cross-user tests.

## 11. Board Query

Fetch:
- stages.
- owner Todos.
- valid evidence count summary.
- related Activity count optional.

No full Evidence payload for every card.

## 12. dnd-kit

Desktop:
- pointer activation distance.
- keyboard sensor.
- DragOverlay.
- valid target highlight.
- invalid target disabled.

Mobile:
- touch activation constraint/long press.
- scrolling must remain usable.
- fallback `Pindahkan ke...` mandatory.

## 13. Transition Matrix

Explicit server matrix, e.g.:

- BACKLOG↔TODO
- TODO↔IN_PROGRESS
- IN_PROGRESS↔REVIEW
- REVIEW↔DONE

Direct BACKLOG→DONE forbidden.

Backward one stage allowed.

DONE→REVIEW can serve reopen if product permits; recommended allowed.

Do not infer validity solely from column index.

## 14. Authoritative Service

One mutation:
`transitionTodo(input)`

Input:
- todoId.
- targetStageId.
- expectedVersion.
- idempotencyKey.
- note optional.

Server sequence:
1. auth.
2. owner Todo.
3. version.
4. source/target.
5. matrix.
6. evidence gate.
7. note gate.
8. DB transaction.
9. timestamp.
10. history.
11. audit.
12. response new version.

All clients call same service.

## 15. Evidence Gate

Count evidence where:
- same owner.
- linked Todo.
- status AVAILABLE.
- allowed type.
- stage rule if configured.

Structured reject:

```ts
{
  code: "EVIDENCE_REQUIRED",
  minimum: 1,
  current: 0,
  allowedTypes: ["PHOTO","LINK","GITHUB_COMMIT"]
}
```

UI:
- rollback card.
- open EvidencePicker.

## 16. Stage Evidence

Example:
IN_PROGRESS evidence = screenshot.
REVIEW = commit/photo.
DONE = final evidence.

Evidence can be reused across stages only if relation explicitly permits; duplicate relation rules deterministic.

## 17. Timestamp

First enter IN_PROGRESS:
- set started_at if null.

Enter DONE:
- completed_at now.

Reopen:
- completed_at clear while non-terminal recommended.
- history preserves prior completion.

Recomplete:
- new completed_at.

## 18. Optimistic Lock

Every transition uses expected version.

IF mismatch:
- 409.
- rollback.
- reload latest card.
- message `Todo telah berubah di perangkat lain.`

## 19. Optimistic UI

May move card immediately.

IF server success:
- reconcile.
IF business reject:
- rollback + explanation.
IF network:
- rollback.
IF conflict:
- rollback+refresh.

Never leave visual state that DB rejected.

## 20. Ordering

Same-column drag updates sort_order.

Use fractional ordering or controlled rebalance.

Same-stage reorder:
- no transition history.
- no evidence gate.
- still owner check/version strategy.

## 21. Mobile Move Menu

Only show likely valid targets but server validates.

If target needs evidence:
- EvidencePicker.
- after evidence success, user confirms move.
- do not silently complete just because evidence attached.

## 22. Evidence Attach

Reuse picker/upload.
Server validates Todo+Evidence ownership/status.

Idempotent relation.

## 23. Evidence Health

If DONE evidence becomes BROKEN/deleted:
- Todo stays DONE.
- health EVIDENCE_INCOMPLETE.
- warning.

Attach replacement:
- recalc OK.

Prefer derived calculation unless stored field needed for performance; if stored, ensure lifecycle hooks update it.

## 24. Detail UI

Todo detail:
- title.
- description.
- stage.
- priority.
- due.
- evidence grouped stage.
- related Activities.
- transition history.

Desktop drawer; mobile full sheet/page.

## 25. Todo→Activity

Button `Catat sebagai Activity`.

Prefill:
- Todo title.
- description.
- today.
- todo ID.

User edits.

Creating Activity does NOT mark Todo done.

Later Todo edits do NOT mutate Activity text.

## 26. Due Date

Past due + not terminal → overdue.
Today → due today.

No auto transition.

Use local date.

## 27. Excel Todo Sheet

Now extend Phase 5 optional sheet:
- Todo.
- Priority.
- Due Date.
- Current Status.
- Completed At.
- Related Activities.
- Evidence Count.

Same sanitizer.

## 28. Defects

- invalid jump → rollback.
- missing evidence → reject/picker.
- broken evidence → invalid count.
- two devices → conflict.
- network after optimistic → rollback.
- duplicate drag event → idempotency.
- evidence removed after DONE → incomplete health.
- UPLOADING evidence → invalid.
- stale deleted card → rollback.
- stage config changed → server wins.
- accidental mobile drag → activation constraints.
- B Todo ID → deny.
- activity from deleted stale Todo → reject safely.
- duplicate stage reorder event → stable/idempotent where practical.
- DONE reopen/recomplete → history consistent.

## 29. Tests

Unit:
- matrix.
- gate.
- evidence count.
- timestamps.
- overdue.
- ordering.

Integration:
- RLS.
- transitions/history.
- cross-owner evidence.
- version.
- idempotency.
- evidence health.

E2E:
- desktop drag.
- invalid jump.
- evidence requirement.
- attach photo.
- complete.
- mobile move.
- Todo→Activity.
- Excel Todo sheet.
- keyboard fallback.

## 30. Do Not Implement

- Todo mandatory.
- automatic Activity each stage.
- client-only transition.
- delete history.
- GitHub integration internals.
- auto-reopen DONE on broken evidence.

## 31. Exit Gate

- [x] CRUD.
- [x] drag.
- [x] mobile fallback.
- [x] server matrix.
- [x] evidence gate.
- [x] history.
- [x] conflict.
- [x] evidence health.
- [x] Todo→Activity.
- [x] export optional sheet.
- [x] test/build.

No Phase 7 before pass. Pass confirmed.
