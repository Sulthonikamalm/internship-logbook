# internship-logbook

# InternFlow — Internship Activity & Evidence Logbook System

Sistem pencatatan aktivitas magang dan evidence berbasis Next.js, Tailwind CSS, shadcn/ui, Supabase, dan Google Drive.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui design tokens
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

Login teman tetap melalui Supabase. Phase 3 tidak memasang integrasi GitHub atau token GitHub pemilik ke aplikasi. Koneksi GitHub milik Codex dipakai untuk mengelola kode/PR saja; bila integrasi commit dibuat pada fase berikutnya, setiap teman harus mengotorisasi akun GitHub mereka sendiri.

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
