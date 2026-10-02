# internship-logbook

# InternFlow — Internship Activity & Evidence Logbook System

Sistem pencatatan aktivitas magang dan evidence berbasis Next.js, Tailwind CSS, Base UI, Supabase, Google Drive, dan GitHub opsional.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS v4, semantic tokens, Base UI dialogs, Radix Slot, Sonner
- **Database & Auth**: Supabase (@supabase/ssr)
- **Central Storage**: Google Drive API
- **Testing**: Vitest & React Testing Library

## Getting Started

1. Pasang dependency dan salin environment file:
```bash
npm install
cp .env.example .env.local
```

Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan URL proyek dan publishable key Supabase. Simpan `.env.local` hanya di komputer sendiri; file ini diabaikan Git.

Proyek Supabase cloud untuk pengembangan ini bernama **InternFlow** (`hsaddesgavcoygxdlwsm`). Migrasi Phase 3 telah diterapkan pada proyek tersebut, tetapi replay dari database kosong belum diverifikasi. Uji RLS berbasis pgTAP ada di `supabase/tests/database/` dan dijalankan dalam transaksi yang di-rollback.

### Phase 3: foto Google Drive

Folder evidence adalah `FOLDER FOTO MAGANG` dengan ID `1wkcd8F6FHIFFTQaOsIffHNZCCPrp_7L5`. Akses umumnya harus **Dibatasi** dan hanya akun penyimpanan yang memiliki izin langsung. Server memeriksa izin folder sebelum membuka sesi upload. Foto diunggah melalui sesi resumable Drive, lalu server mengunduh dan memeriksa isi file sebelum menyimpan metadata `AVAILABLE` di Supabase. Pengguna melihat foto melalui route privat `/api/media/evidence/[id]`.

Konektor Google Drive di Codex hanya memberi akses kepada agent saat bekerja; aplikasi Next.js tidak mewarisi token konektor itu. Untuk menjalankan upload nyata:

1. Di [Google Cloud Console](https://console.cloud.google.com/), buat/pilih project dan aktifkan Google Drive API. Siapkan OAuth consent screen untuk akun Google pemilik folder. Scope yang dipakai helper adalah `https://www.googleapis.com/auth/drive`, yang memberi akses luas ke Drive akun penyimpanan; sebaiknya gunakan akun khusus evidence jika memungkinkan.
2. Buat OAuth client jenis **Web application** dengan redirect URI persis `http://127.0.0.1:8765/callback`.
3. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` pada `.env.local` di komputer sendiri. `GOOGLE_DRIVE_ROOT_FOLDER_ID` sudah menunjuk ke folder di atas.
4. Jalankan `npm run google:setup`, buka URL yang ditampilkan, dan berikan izin menggunakan akun pemilik folder. Helper memverifikasi izin folder lalu menulis `GOOGLE_REFRESH_TOKEN` ke `.env.local` tanpa mencetak token.
5. Restart server Next.js, kemudian uji satu foto nyata di Evidence Library dan aksesnya dari akun pengguna lain.

Jangan menaruh tiga kredensial itu pada variabel `NEXT_PUBLIC_*`, source code, issue, atau PR. Runtime memakai OAuth akun pusat hanya di server untuk membuat folder, memvalidasi file, membaca foto, dan menghapusnya. Google menyatakan refresh token OAuth untuk consent screen **External/Testing** dapat kedaluwarsa setelah tujuh hari; siapkan status aplikasi yang sesuai sebelum memakai upload terus-menerus. Lihat [panduan OAuth Google](https://developers.google.com/identity/protocols/oauth2) dan [scope Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Pekerjaan rekonsiliasi internal diproses lewat `POST /api/internal/evidence-reconcile` dengan Bearer `EVIDENCE_RECONCILE_SECRET` (minimal 32 karakter) dan memerlukan `SUPABASE_SERVICE_ROLE_KEY` pada server. Jadwalkan atau jalankan endpoint itu hanya dari lingkungan tepercaya. Kegagalan penghapusan Drive mempertahankan metadata sebagai `DELETE_PENDING` hingga job berhasil.

Login pengguna tetap melalui Supabase. Integrasi commit sekarang tersedia secara opsional; setiap pengguna mengotorisasi akun GitHub mereka sendiri.

Jalankan development server:
```bash
npm run dev
```

3. Jalankan testing & lint:
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Overhaul dan Phase 8

Audit dan keputusan implementasi: [docs/OVERHAUL_AUDIT.md](docs/OVERHAUL_AUDIT.md). Hasil QA, batas validasi, dan inventaris perubahan: [docs/OVERHAUL_DELIVERY.md](docs/OVERHAUL_DELIVERY.md).

Gunakan Node **22.22.2+ pada cabang 22**, **24.15+ pada cabang 24**, atau **26+**. Validasi pekerjaan ini memakai Node 24.19.0; Node 22.18 yang terpasang di host terlalu lama untuk jsdom 30. Jalankan `npm run lint`, `npm run typecheck`, `npm test`, dan `npm run build` dengan runtime yang didukung.

### GitHub opsional

Isi `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, dan `GITHUB_CALLBACK_URL` di server. Callback harus tepat `<APP_BASE_URL>/api/integrations/github/callback`, dengan origin yang sama. Untuk development ini, gunakan `http://localhost:3000` secara konsisten. Konektor GitHub Codex tidak menggantikan OAuth per pengguna di InternFlow.

`GITHUB_TOKEN_ENCRYPTION_KEY` adalah 32 byte dalam bentuk 64 karakter hex. Buat dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, simpan di secret environment server, dan pertahankan nilainya antar restart/deployment. Jangan mengganti kunci tanpa prosedur migrasi token atau reconnect; token memakai AES-256-GCM dan kunci tidak pernah dikirim ke browser.

Hubungkan dari Integrasi, pilih akses repo privat hanya jika diperlukan, lalu lakukan sync manual. OAuth publik memakai `read:user`; GitHub OAuth meminta scope `repo` yang luas untuk repo privat, dan UI menjelaskan izin tersebut sebelum pengguna memilihnya. Sync default mengambil hingga 10 repo terbaru dan hingga 100 commit per repo; filter `owner/repository` memungkinkan memilih repo lain. Hanya commit dari identitas akun terhubung yang masuk cache. Pilih commit secara eksplisit sebagai evidence, lalu lampirkan ke Activity atau Todo. Disconnect menghapus token aplikasi dan mempertahankan evidence historis; akses aplikasi dapat dicabut penuh melalui pengaturan GitHub pengguna.

### Migrasi dan regresi database

Migrasi hardening 20261001214511, 20261001221333, 20261001222201, dan 20261002021632 sudah diterapkan ke proyek InternFlow. `supabase/tests/phase8_integrity.sql` membuktikan grants/RLS, gate evidence, versi/idempotensi, linkage Todo–Activity, lease sync, dan retensi historis dalam transaksi yang di-rollback. Skrip ini memerlukan database yang sudah memiliki schema InternFlow; jangan menyamakan hasilnya dengan replay migrasi dari database kosong.

History cloud belum mencatat tiga migrasi lama Phase 4/6/7 meskipun object-nya sudah ada karena penerapan manual sebelumnya. Jangan langsung menjalankan `supabase db push` ke cloud. Setelah membandingkan schema dengan berkas migrasi dan memastikan tidak ada drift, gunakan CLI `supabase migration repair --status applied` untuk versi 20261001000000, 20261001010000, dan 20261001020000 pada proyek yang benar. Repair hanya memperbaiki history, bukan menjalankan SQL. Replay penuh tetap perlu database disposable lokal: aktifkan Docker daemon, jalankan `supabase start`, lalu `supabase db reset --local` dan `supabase test db`. Regresi tambahan dapat dijalankan melalui psql terhadap DB lokal dengan `-v ON_ERROR_STOP=1 -f supabase/tests/phase8_integrity.sql`.
