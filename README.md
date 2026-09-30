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

Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan URL proyek dan publishable key Supabase. Phase 2 tidak memerlukan service-role key, Google Drive, atau GitHub OAuth. Simpan `.env.local` hanya di komputer sendiri; file ini diabaikan Git.

Proyek Supabase cloud untuk pengembangan ini bernama **InternFlow** (`hsaddesgavcoygxdlwsm`). Migrasi di `supabase/migrations/` sudah diterapkan berurutan dari database kosong. Uji RLS berbasis pgTAP ada di `supabase/tests/database/` dan dijalankan dalam transaksi yang di-rollback.

2. Jalankan development server:
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
