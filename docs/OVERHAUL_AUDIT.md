# InternFlow — audit & execution plan

Audit date: 2 October 2026. Source: PRD v1.1, Phase 1/4/5/6/7, phase 0–8 outline in `prompt.md`, current source and migrations. Standalone Phase 2/3/8 documents are absent; use their PRD requirements and the implementation outline. Existing local changes to the landing page and Phase 7 migration are preserved/adapted.

## Architecture and product diagnosis

The feature/server/domain boundaries, private photo route, checksum/resumable upload, Activity idempotency, optimistic Activity edits, logbook projection, formula sanitization, and owner-scoped queries are useful foundations. Keep them; no stack rewrite. Drive remains central private storage, Activity remains the source for reports, Todo and GitHub remain optional.

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Todo transition uses separate update/history calls, ignores zero-row update and history errors; authenticated direct writes can bypass gate | Atomic database transition RPC, restricted write columns, owner/active/version/idempotency checks |
| Critical | GitHub connection/cache writes use user client without INSERT policies; mocked tests do not enforce grants | Trusted, authenticated server writes; service-only atomic token/connection RPC; real database regression harness |
| Critical | Commit evidence trusts browser metadata, permits arbitrary URLs, lacks atomic uniqueness and cross-owner cache validation | Convert only an owned cached commit in a transaction; preserve subtype snapshots; unique live commit reuse |
| Major | Sync swallows persistence/rate/repository errors and stamps successful sync anyway | Bounded adapter, header-aware rate limit/backoff, partial results, truthful status, unavailable snapshots |
| Major | OAuth requests `repo` (also write permission), lacks account-switch confirmation, stores plaintext token, leaks raw errors | Public read scope by default; explicit private scope choice, encryption, safe error codes, confirmed replacement |
| Major | Dashboard has fake zero metrics and placeholder; root has unconditional Drive/test claims | Owner-scoped dashboard projection and truthful integration configuration state |
| Major | Mobile navigation hides Todo/Reports/Integrations; Settings is a dead route | Five-tab navigation, accessible More sheet, complete Home shortcuts, real profile settings |
| Major | `Button asChild` renders nested interactive elements | Slot composition shared by all CTA links |
| Major | Board/Drawer/picker state ignores refreshed props; concurrent rollbacks overwrite other mutations | Per-item pending/rollback, refresh reconciliation, request identity checks, explicit loading/error detail |
| Major | Todo evidence picker silent errors and only first page; delete ignores mutation result | Reusable paginated picker and recoverable inline feedback |
| Major | Dialogs lack focus trap, scroll lock, Escape; icon actions undersized; zoom disabled | Accessible primitive, 44px targets, labels, focus indicators, pinch zoom |
| Major | Upload input can change during transfer, repeated IDs, no byte progress/preview | Lock selection, unique IDs, preview cleanup and resumable byte progress |
| Major | Live QA: Drive accepted the file but its browser response lacked the bound origin; retries did not detect completion | Bind resumable session origin, explicit byte range, probe every retry and finalize completed uploads |
| Major | Photo Excel links point to a missing detail route; data readers silently truncate large exports/attachments | Owned private Evidence detail, deterministic paginated reads and batched relations |
| Major | Proxy redirects discard refreshed cookies/cache headers and omit destination query on several protected pages | Preserve session response metadata and complete protected destinations |
| Major | Live QA: cookie update re-renders login and redirects to Home, overriding the intended destination | Server Action redirect outside catch, consistent safe destination in proxy/page, reject login loops |
| Minor | Reports UI exposes implementation jargon, fake "all period" = 180 days, stale timer resets later request | Concise form, truthful presets, persistent result and no reset timer |
| Minor | Missing shared header/state/form/material/motion system; rainbow status drift | Consolidated semantic tokens, shared header/empty/error/loading patterns |

## UI review

| Before | After | Why |
| --- | --- | --- |
| Dense explanatory cards | Short labels, row groups, progressive details | Actions and work take priority |
| Opaque, flat navigation | Frosted chrome + solid reading surfaces | Depth without losing contrast |
| Small or hover-only controls | Visible touch controls, ≥44px hit targets | Mobile and keyboard access |
| `transition-all`, scattered timings | Transform/opacity, 120ms press, 200–240ms dialog, reduced motion/transparency | Predictable feedback and performance |
| Home = static statistics | Quick capture/upload/Todo/report, drafts, current work, all tools | Home restores feature discoverability |

## Execution sequence

1. Design primitives: tokens, Slot button, accessible modal/sheet, toast, page header, states.
2. Responsive shell and navigation (desktop ≥1024px; compact navigation below), real dashboard service and Home hub.
3. Activity/Evidence/Todo/Logbook/Reports/Integrations/Settings cleanup with shared patterns.
4. GitHub OAuth/token/cache/conversion completion; database migrations and setup contract.
5. Phase 8: concurrency, double submit, stale state, upload failures, safe errors, keyboard/focus, privacy, tests.
6. Lint, typecheck, unit/integration tests, production build, mobile/desktop browser QA. Record limitations honestly.

## Refactor boundaries

Rewrite shell/Home and unreliable board orchestration; extract modal/picker/state patterns. Clean forms/logbook/export without replacing their business rules. Keep Drive transport/validation/reconciliation and Excel builders, fixing only proven defects. Avoid new global state/cache framework.

## Validation boundary

Existing tests largely use in-memory mocks; passing them is not proof that PostgreSQL grants/RLS/atomicity work. The database regression suite was therefore run on the attached PostgreSQL instance with isolated fixture IDs inside BEGIN/ROLLBACK. Fresh migration replay still requires a disposable database. Drive was verified live using synthetic photos; GitHub provider consent remains unverified. See OVERHAUL_DELIVERY.md for measured results and remaining boundaries.
