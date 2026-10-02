# InternFlow — hasil overhaul dan QA

Tanggal: 2 Oktober 2026. Acuan: PRD v1.1, docs Phase 1/4/5/6/7, outline Phase 0–8, source/migrasi. Skill animate-expo, apple-design, dan emil-design-eng dibaca; karena proyek adalah Next.js web, implementasi motion memakai CSS web dan prinsip restraint, interruption, serta reduced motion. Tidak ada dependency React Native yang ditambahkan.

## 1. Audit Summary

Fondasi owner-scoped data, checksum/resumable Drive upload, validasi foto, Activity draft/idempotensi/versi, logbook, dan sanitasi Excel dipertahankan. Risiko utama berada di transaksi Todo yang terpisah, grants GitHub yang tidak cocok dengan server client, commit browser yang dapat dipalsukan, race sync/disconnect, query yang terpotong, stale board/drawer, dan navigation mobile yang menyembunyikan fitur.

Prioritas critical/major dan keputusan refactor tersedia di OVERHAUL_AUDIT.md. Shell, Home, board orchestration, dan batas integrasi dirombak. Transport/validasi Drive dan Excel builder dibersihkan pada bug yang terbukti. Business rules tidak ditukar demi layout yang lebih sederhana.

## 2. Changes Implemented

- Foundation: semantic tokens, controlled glass, Button Slot, Badge/Input/Card, PageHeader, EmptyState/Feedback, PageSkeleton/PageError, Modal/Sheet, satu Toaster, Brand, shared navigation/AppShell.
- Home: data Supabase nyata, quick Activity/upload/Todo/export, draft server/perangkat termasuk draft dari Todo/edit, recent Activity/active Todo, semua tools, status konfigurasi integrasi.
- Activity: list tunggal responsif, quick sheet, advanced fields, autosave 4 detik + persist sebelum request/unload, stale draft merge eksplisit, atomic Todo linkage, ownership validation, detail/edit/delete state.
- Evidence: preview/progress, selector terkunci saat transfer, duplicate/retry, awaiting attachment, paginated reusable picker, confirmation yang menghitung Activity dan Todo, preview fallback, route detail privat untuk tautan Excel. Mapper library dikonsolidasikan; batas 30 lampiran Activity dihapus; pagination deterministik.
- Todo: board dengan fresh RSC props/optimistic state, satu mutation lock, keyboard/touch fallback, stale detail protection, required-note dialog, gate evidence, current-stage visibility pada mobile termasuk Todo baru, edit version conflict, lampiran/history dan confirmation.
- Logbook: date aggregation independen dari pagination/search, GitHub evidence terlihat, missing/draft days akurat, filter Apply/Reset, mobile rows dan target sentuh, pagination ringkas, shared preview. Skeleton lama dan DTO evidence yang tidak dipakai dihapus.
- Reports/Settings: date presets akurat, result persisten, private-link explanation, seluruh pagination ekspor (regresi 1.105 Activity), profile/timezone/periode magang nyata.
- Auth: semua area terlindungi mempertahankan destination query setelah login; cookie refresh dan cache headers disalin saat redirect agar session tidak hilang. QA production juga menemukan redirect login selalu menuju Home; server redirect kini mempertahankan tujuan/query dan menolak login loop, tanpa client push/refresh yang berlomba.

Inventaris berkas berada pada OVERHAUL_FILES.md. Logo original pengguna dan perubahan awal di landing/migrasi tetap dipertahankan/adaptasi.

## 3. UI/UX Improvements

Biru/off-white konsisten; kaca hanya pada chrome/quick actions/floating surfaces, data memakai solid reading surfaces. Copy diringkas, details membuka field/informasi lanjutan, hierarki menonjolkan tindakan dan pekerjaan. Mobile bottom navigation: Home, Activity, Todo, Evidence, More. Home dan More menjangkau Logbook, Reports, Integrasi, Settings, Library dan export.

Press feedback 120ms; panel sekitar 220ms/exit 160ms memakai transform/opacity. Reduced motion, reduced transparency, contrast fallback, keyboard focus, focus trap/return, Escape dan busy dismissal diterapkan. QA dasar tidak menggantikan audit WCAG formal atau pengujian VoiceOver/TalkBack pada device.

Bukti visual production: qa/home-mobile-viewport.jpg, qa/home-mobile-tools.jpg, qa/home-desktop.jpg. Regresi tujuan login dicatat pada qa/login-destination-production.jpg. Logbook preview juga dicatat pada qa/logbook-evidence-mobile.jpg (development). Lebar CSS 390px mobile dan 1440px desktop diperiksa; scrollWidth tidak melebihi viewport. Home mobile diuji akses More → Logbook.

## 4. Integration Improvements

GitHub: OAuth state opaque per-user/one-use/expiry, S256 PKCE, canonical-origin callback, secure HttpOnly cookie, public scope default dan private-scope disclosure, encrypted token server-only, account replacement eksplisit, connection/reconnect/disconnect, manual bounded sync/repo filter, lease nonce+version, revoked/rate/unavailable/partial errors, persisted cache, picker, atomic owned-cache conversion, Activity/Todo attachment, historical retention.

GitHub adapter dan OAuth diuji unit; ownership, conversion, lease/disconnect dan retensi diuji pada PostgreSQL nyata. **Consent/callback dan sync terhadap akun GitHub pengguna secara live belum dijalankan.** Konektor akun Codex bukan koneksi OAuth aplikasi per pengguna. Kredensial provider terkonfigurasi, tetapi akun QA terpisah sengaja tidak dihubungkan ke akun GitHub pengguna.

Drive: dua foto sintetis berhasil di-upload dari browser, divalidasi server, tersimpan AVAILABLE, dibaca via thumbnail privat, dan dilampirkan ke Activity/Todo. QA menemukan file sudah berhasil diterima Drive tetapi response tidak dapat dibaca browser. Origin kini diteruskan saat membuat sesi resumable; Content-Range eksplisit, dan setiap retry server memeriksa COMPLETE sebelum upload ulang. Upload baru berikutnya berhasil tanpa retry. Hak akses folder pusat tetap privat.

## 5. Bug Fixes / Hardening

Atomic Todo transition/version/payload-bound idempotency/history; direct bypass grants ditolak; owned AVAILABLE typed evidence gate; Done kehilangan evidence tetap Done dengan health incomplete. GitHub browser fabrication ditolak, snapshot historis tetap ada, token dihapus ketika disconnect/reauth, stale sync tidak dapat memulihkan koneksi.

Atomic create Activity + Todo + idempotensi, direct foreign linkage ditolak, active-account write guards, export/link consistency, underlying query error tidak menjadi angka nol/404 palsu, double submit guards, upload busy/retry, attachment failure feedback, session redirect cookies, focus/44px controls, safe errors dan privacy links diperbaiki. Tests baru berfokus pada regresi bermakna, bukan salinan layout.

Empat migrasi hardening diterapkan ke proyek InternFlow hsaddesgavcoygxdlwsm. Advisor performance kini hanya INFO unused indexes; missing FK indexes dan auth.uid per-row warnings sudah dibereskan. Token table RLS tanpa browser policy disengaja. Dua authenticated SECURITY DEFINER RPC disengaja karena transisi/conversion membutuhkan protected columns; keduanya actor-active/owner-bound, locked search_path dan grants terbatas, diuji database.

Setting **leaked password protection** Supabase masih disabled dan tidak memiliki tool konfigurasi Auth pada sesi ini: [remediation resmi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Ini perlu diaktifkan di pengaturan proyek sesuai plan yang mendukungnya.

## 6. Validation

- Node 24.19.0; lint lulus; typecheck lulus; production build berhasil dengan 22 generated pages.
- 183 tests / 14 files lulus. OAuth origin/callback, crypto tamper, provider errors, SQL boundary calls, >1.000 row export, focus/busy/draft, Drive retry, dan session-cookie redirects tercakup.
- npm audit: 0 vulnerabilities. ExcelJS uuid di-override ke versi CommonJS-compatible 11.1.1; Excel/production build lulus.
- phase8_integrity.sql dijalankan pada PostgreSQL cloud setelah migrasi terakhir: passed, seluruh fixtures rollback.
- Browser QA login/profile/quick Activity/Todo stages/evidence gate/attachment/Logbook preview/mobile More/export/status/confirmation; production Home mobile+desktop diperiksa; redirect login kembali ke Integrasi diverifikasi setelah perbaikan.
- Live API Excel: HTTP 200, workbook 9.543 byte terbuka dengan Logbook, Evidence Detail, Todos; tautan foto APP_PRIVATE mengarah ke route detail yang tersedia. Thumbnail pemilik HTTP 200 image/webp, tamu 401, akun lain 404.
- Browser menampilkan success export, tetapi event download dari adapter IAB timeout; isi workbook dibuktikan terpisah lewat authenticated API dan ExcelJS. Jangan mengklaim lokasi download browser terverifikasi.

### Batas yang masih terbuka

1. OAuth GitHub live memerlukan pengguna login InternFlow dan memberi consent ke GitHub; token provider pengguna tidak dipinjam dari konektor Codex.
2. Fresh migration replay belum dijalankan: Docker CLI ada, daemon tidak aktif, Docker Desktop executable tidak tersedia pada path standar. Database regression terhadap schema terpasang sudah lulus.
3. History cloud Phase 4/6/7 lama belum direkonsiliasi dengan CLI. Schema sudah ada dari penerapan manual; jangan db push/replay creates/policies ke cloud sebelum schema comparison + history repair. Prosedur ada di README.
4. Aktifkan leaked password protection melalui pengaturan Supabase. Security advisor exceptions untuk RPC/token RLS sudah dijelaskan di atas.

QA memakai akun dan file sintetis terpisah. Seluruh akun QA dan data Supabase-nya sudah dibersihkan. Dua foto serta folder khusus QA telah dipindahkan ke Trash Drive setelah pemeriksaan appProperties/ownership. Data pengguna asli tidak dipakai atau dihapus untuk fixtures. Secret scan terhadap source/docs perubahan bersih.
