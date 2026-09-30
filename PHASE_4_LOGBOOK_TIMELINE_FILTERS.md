# Phase 4 — Logbook, Timeline, Filters & Missing-Day Detection


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

Bangun logbook sebagai projection/query dari Activity. Tidak ada duplicate logbook source-of-truth.

## 2. Entry

- Phase 3 pass.
- Activity/Evidence stable.

## 3. Immutable Rules

1. One row = one Activity.
2. Todo tidak menghasilkan row langsung.
3. evidence adalah attachment.
4. deleted Activity excluded.
5. broken evidence tidak menghapus Activity.
6. filter date menggunakan activity_date.
7. deterministic ordering.

## 4. In Scope

- `/logbook`.
- desktop table.
- mobile cards.
- date/month/custom filter.
- keyword.
- evidence type.
- evidence summary.
- missing workday.
- internship settings.
- pagination.
- URL search params.

## 5. Internship Settings

```sql
internship_settings (
 user_id uuid primary key references profiles(id),
 start_date date null,
 end_date date null,
 working_days smallint[] not null default array[1,2,3,4,5],
 created_at timestamptz,
 updated_at timestamptz
)
```

RLS owner.

ISO day 1–7.

Validation:
- end >= start.
- working_days unique and 1..7.

IF no dates:
- logbook works.
- missing-day disabled with settings CTA.

## 6. Missing-Day Logic

Expected date:
- within internship range.
- weekday configured.
- up to today for missing evaluation.

IF no non-deleted Activity:
- missing.

DRAFT exists:
- not missing, but can badge `Draft`.

Future dates:
- do not mark missing.

## 7. Query Service

`getLogbookRows(params, auth)`

Inputs:
- from.
- to.
- month.
- q.
- evidenceType.
- page/pageSize.

Validate:
- from<=to.
- page >=1.
- pageSize cap.
- sensible max range.

Owner injected from auth.

## 8. Query Efficiency

No N+1.

Use relational/batched evidence.

No photo binary.

DTO excludes Drive file ID.

## 9. Ordering

UI default:
- activity_date DESC.
- start_time DESC NULL LAST.
- created_at DESC tie.

Export later:
chronological ASC.

## 10. Desktop Table

Columns:
- No.
- Tanggal.
- Waktu.
- Aktivitas.
- Keterangan.
- Evidence.

Requirements:
- wrap.
- sensible widths.
- row detail/edit.
- accessible header.
- skeleton.

## 11. Mobile

Use cards, not forced wide table.

Card:
- date/time.
- title.
- description excerpt.
- evidence count/badges.
- detail action.

Filters sheet.

## 12. Evidence Summary

PHOTO:
- badge/count/optional protected thumbnail.

LINK:
- safe link.

BROKEN:
- warning badge.

Future GitHub component plugs into same interface.

## 13. Filters

Presets:
- today.
- week.
- month.
- custom.

Keyword title/description.
Evidence type.
Date.

Use URL query params.

Invalid query:
- normalize.
- no crash.

Debounce search.

## 14. Pagination

Server-side.
No unlimited rows.

Stable numbering within filtered set.

## 15. Empty States

No Activity:
`Belum ada Activity untuk logbook.`

Filtered:
`Tidak ada Activity yang cocok.`

Missing date:
`Belum ada Activity pada tanggal ini.`

CTA `Tambah Activity`.

## 16. Timeline/Calendar Summary

Lightweight day summary allowed.
Date click filters.

Do not add heavy calendar feature beyond need.

## 17. Edit Integration

Logbook edit navigates Activity edit.
No separate logbook record.

Preserve safe filter query on return.

## 18. Forbidden Data Duplication

Do NOT create:
- `logbook_rows` table copy.
- sync job Activity→Logbook.

Logbook always derives Activity.

## 19. Defects

- date edit moves row automatically.
- evidence deleted updates summary.
- broken displays.
- timezone no date drift.
- null time `—`.
- invalid date param reset.
- from>to field error.
- no internship setting disables missing.
- future internship dates not missing.
- same day stable ordering.
- deleted excluded.
- other owner denied.

## 20. Tests

Unit:
- missing-day.
- working day.
- filter parser.
- sorting.
- future clamp.

Integration:
- owner.
- evidence join.
- deleted exclusion.
- keyword/date.

E2E:
- desktop.
- mobile.
- month.
- missing day.
- broken.
- edit return.

## 21. Do Not Implement

- Excel.
- Todo.
- GitHub.
- duplicate table.
- public photo URL.

## 22. Exit Gate

- [x] derived Activity only.
- [x] filters.
- [x] mobile/desktop.
- [x] evidence summary.
- [x] missing-day.
- [x] no N+1.
- [x] RLS.
- [x] test/build.

No Phase 5 before pass.
