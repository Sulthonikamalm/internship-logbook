# Phase 5 — Excel Export, Evidence Links & Report Safety


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

Generate `.xlsx` dari Activity/logbook yang aman, deterministic, hanya memuat data user aktif, mendukung evidence references, dan tidak membuat file corrupt ketika satu evidence bermasalah.

## 2. Entry Criteria

- [ ] Phase 4 complete.
- [ ] Logbook query stable.
- [ ] Evidence resolver stable.
- [ ] owner isolation tested.

## 3. Immutable Rules

1. Report bersumber dari Activity.
2. Export server-side.
3. User hanya export data sendiri.
4. Foto default berupa link/reference, bukan embedded high-res.
5. formula injection wajib dicegah.
6. broken evidence tidak menggagalkan seluruh workbook.
7. private sharing default.
8. export tidak boleh mengubah Drive sharing diam-diam.

## 4. In Scope

- ExcelJS.
- `/reports`.
- export form.
- Sheet Logbook.
- Sheet Evidence Detail.
- APP_PRIVATE evidence URL.
- sanitization.
- report filename.
- audit export.
- duplicate click handling.
- download response.

Out:
- PDF.
- scheduled exports.
- email.
- public Drive bulk sharing.
- Todo sheet sampai Phase 6.

## 5. Input Schema

```ts
type ExportLogbookInput = {
  from: string
  to: string
  includeEvidence: boolean
  evidenceLinkMode: "APP_PRIVATE" | "DRIVE_SHARED"
}
```

Validate:
- ISO date.
- from <= to.
- max range configurable.
- active user.
- supported link mode.

At phase ini:
- APP_PRIVATE production-ready.
- DRIVE_SHARED disabled unless explicit permission lifecycle exists.

## 6. Server Boundary

Flow:
1. require active user.
2. validate input.
3. query owner-scoped Activities.
4. query linked evidence in batch.
5. map DTO.
6. sanitize.
7. build workbook.
8. audit.
9. return xlsx.

Do not build workbook from client-fetched unrestricted JSON.

## 7. Empty Range

IF zero Activity:
- show `Tidak ada Activity pada rentang tanggal ini.`
- default no download.
- optional empty template not required.

## 8. Workbook — Sheet Logbook

Name `Logbook`.

Columns:
1. No
2. Tanggal
3. Jam Mulai
4. Jam Selesai
5. Aktivitas
6. Keterangan
7. Evidence

Style:
- branded blue header.
- white text header.
- freeze row 1.
- wrap text.
- top alignment.
- reasonable width.
- filter optional.
- no excessive decoration.

Ordering:
- chronological ASC.
- start time ASC/null deterministic.

## 9. Evidence in Sheet 1

Robust choice:
- summary string, e.g. `2 Foto, 1 Link`.
- actual hyperlinks in Evidence Detail.

Reason:
multiple hyperlinks per cell can be fragile.

If no evidence:
`—`.

## 10. Sheet Evidence Detail

Columns:
- Evidence ID.
- Activity ID.
- Tanggal.
- Type.
- Nama/Judul.
- URL.
- Status.

PHOTO APP_PRIVATE:
- use stable application evidence route.
- never expose Drive file id as authorization mechanism.

LINK:
- validated external URL.

BROKEN:
- status BROKEN.
- URL may be app detail; no dead unlabeled link.

## 11. APP_PRIVATE

Default.

Link points to protected InternFlow evidence page/route.

Recipient must authenticate and be authorized.

Export UI explains:
`Evidence bersifat private dan membutuhkan akses InternFlow.`

## 12. DRIVE_SHARED

Do not enable until:
- explicit user consent.
- permission mutation implementation.
- revoke mechanism.
- audit.
- security warning.

If selected but unsupported:
- reject with clear UI.
- NEVER silently switch files public.

## 13. Formula Injection

Sanitize user-controlled text if leading significant char:
- `=`
- `+`
- `-`
- `@`

Examples tests:
- `=HYPERLINK("x")`
- `+SUM(1,1)`
- `@cmd`
- leading whitespace then `=`

Write as literal safely.

Apply to:
- title.
- description.
- evidence title.
- profile name in filename/meta.
- future Todo/GitHub text.

## 14. Hyperlink Scheme

Allow:
- https/http for validated external evidence.
- app https.

Reject:
- javascript:
- data:
- file:
- vbscript:

Never convert invalid URL into clickable hyperlink.

## 15. Long Text

Description already app-limited.
Still guard library/cell limits.

IF exceeds:
- truncate deterministically.
- optional marker `[dipotong]`.
- do not crash generation.

## 16. Filename

`InternFlow_Logbook_<display_name>_<from>_<to>.xlsx`

Sanitize:
- slash/backslash.
- colon/wildcards.
- control chars.
- max length.
- whitespace normalization.

Filename must not become path traversal.

## 17. Response

Correct MIME:
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Content-Disposition safe.
Private/no-store headers recommended.

## 18. Reports UI

Fields:
- from/to.
- evidence toggle.
- privacy description.
- Generate.

States:
- idle.
- validating.
- generating.
- ready.
- error.

Disable while generating.

## 19. Audit

`report.excel_exported`

Metadata only:
- date range.
- row count.
- evidence mode.
- evidence included.

No entire logbook content.

## 20. Broken Evidence

IF one broken:
- workbook still generated.
- row status shows BROKEN.
- no exception cascades.

Do not ping every Drive file synchronously if costly; use stored status.

## 21. Stable Evidence Link

Use Evidence UUID app URL:
`/evidence/<uuid>`

Not:
raw Drive ID.

This permits storage backend changes.

## 22. Architecture

```text
features/reports/
  schemas/export.schema.ts
  server/get-export-data.ts
  server/generate-workbook.ts
  excel/sanitize-cell.ts
  excel/build-logbook-sheet.ts
  excel/build-evidence-sheet.ts
  components/export-dialog.tsx
```

Workbook builder receives DTO, not direct DB client.

## 23. Failure Matrix

- zero rows → message.
- formula text → literal.
- invalid link → plain text/status.
- long text → safe.
- weird display name → safe filename.
- expired session → no output.
- B ID/request manipulation → owner A only.
- broken evidence → nonfatal.
- library exception → safe error + request ID.
- double click → one UI generation.
- response interrupted → user retries; no persistent data corruption.
- APP_PRIVATE base URL absent → env validation.
- DRIVE_SHARED unsupported → explicit reject.

## 24. Test

Unit:
- sanitizer.
- filename.
- hyperlink.
- workbook structure.
- date format.
- broken.
- long.

Integration:
- A only A.
- deleted excluded.
- date range.
- evidence mapping.

E2E:
- generate/download.
- parse downloaded workbook.
- headers.
- malicious formula literal.
- second user isolation.
- mobile reports form.

## 25. Do Not Implement

- embed high-res photo.
- silently public Drive.
- PDF.
- Todo sheet yet.
- client-only workbook from unrestricted data.

## 26. Exit Gate

- [ ] valid xlsx opens.
- [ ] correct user only.
- [ ] formula safe.
- [ ] Evidence Detail.
- [ ] APP_PRIVATE stable.
- [ ] broken nonfatal.
- [ ] empty safe.
- [ ] audit.
- [ ] tests/build pass.

No Phase 6 before gate.
