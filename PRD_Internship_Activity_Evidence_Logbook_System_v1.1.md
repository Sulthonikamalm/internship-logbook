
# Product Requirements Document (PRD)
## Internship Activity, Evidence, Todo & Logbook Management System

**Document version:** 1.1  
**Status:** Baseline Product + Engineering Requirement  
**Platform:** Responsive Web Application (Mobile + Desktop)  
**Primary deployment target:** Vercel  
**Primary database/auth target:** Supabase  
**Primary file storage target:** Google Drive  
**Optional external integration:** GitHub  
**Initial scale:** 10 active users  
**Primary output:** Logbook table + Excel export with evidence links  
**Language of application:** Indonesian first; architecture must not block future i18n  
**Frontend baseline:** Next.js + React + TypeScript  
**UI baseline:** Tailwind CSS + shadcn/ui + Lucide Icons  
**Backend/data baseline:** Supabase Auth + PostgreSQL + Row Level Security  
**Primary file storage:** Google Drive API  
**Optional developer evidence:** GitHub OAuth + GitHub API  
**Excel generation:** ExcelJS  
**Deployment/CI:** Vercel + GitHub  
**Primary visual identity:** Biru-putih, dengan biru sebagai warna brand dominan  

---

# 0. Executive Summary

Sistem ini dibuat untuk menyelesaikan masalah utama pencatatan magang: pengguna sebenarnya melakukan banyak pekerjaan setiap hari, tetapi tidak konsisten menulis logbook, lupa detail pekerjaan, bukti pekerjaan tersebar, foto memenuhi memori perangkat, dan pekerjaan coding sulit dirangkum kembali ketika laporan dibutuhkan.

Sistem harus memungkinkan pengguna mencatat aktivitas **secara langsung dari HP maupun laptop** tanpa diwajibkan membuat Todo terlebih dahulu. Aktivitas dapat dibuat hanya dengan **foto + keterangan**, teks saja, atau keterangan + beberapa evidence.

Todo adalah fitur tambahan yang membantu pekerjaan yang memang perlu dilacak prosesnya. Todo harus berbentuk **Kanban interaktif** dengan drag-and-drop. Perpindahan proses harus mengikuti business rule dan evidence gate sehingga sebuah pekerjaan tidak dapat dinyatakan selesai tanpa bukti yang valid.

Evidence terdiri dari minimal:

1. Foto yang diunggah ke Google Drive.
2. GitHub commit yang dipilih pengguna apabila pengguna menghubungkan GitHub.
3. Link eksternal.
4. File/dokumen lain pada fase lanjutan.

GitHub bersifat **opsional**. Pengguna yang tidak menghubungkan GitHub tetap dapat menggunakan seluruh fungsi utama sistem.

Setiap pengguna hanya dapat melihat foto yang ia unggah sendiri. Google Drive bertindak sebagai storage pusat, sedangkan ownership, authorization, metadata, dan relasi evidence dikelola oleh aplikasi dan Supabase.

Logbook dibentuk dari Activity, bukan dari Todo. Todo dapat mempermudah pembentukan keterangan Activity, tetapi tidak menjadi sumber wajib.

---

# 1. Product Vision

Membuat web application yang menjadi **single source of truth aktivitas magang**, di mana pengguna dapat:

- mencatat apa yang sedang/baru dikerjakan,
- menyimpan evidence tanpa membebani storage perangkat,
- menghubungkan pekerjaan coding dengan GitHub bila diperlukan,
- melacak pekerjaan terencana melalui Todo Kanban,
- melihat histori aktivitas berdasarkan tanggal,
- dan menghasilkan logbook/Excel tanpa menulis ulang seluruh riwayat dari awal.

Prinsip desain utama:

> **Capture first, organize later, evidence always traceable, report generated from structured activity data.**

---

# 2. Problem Statement

## 2.1 Pencatatan tidak konsisten

### Kondisi
Pengguna bekerja sepanjang hari tetapi menunda pengisian logbook.

### Dampak
- lupa apa yang dilakukan,
- deskripsi menjadi terlalu umum,
- tanggal tidak akurat,
- evidence sulit dicocokkan,
- pengisian logbook menumpuk.

### Solusi produk
- Quick Activity dari mobile.
- Draft otomatis.
- Timeline harian.
- Reminder visual untuk hari kosong.
- Evidence pool yang dapat dipilih kembali.

---

## 2.2 Foto memenuhi storage perangkat

### Kondisi
Dokumentasi magang disimpan lokal di HP.

### Dampak
- memori perangkat cepat penuh,
- foto tercecer,
- rawan terhapus,
- pencarian ulang sulit.

### Solusi produk
Foto diunggah ke Google Drive melalui aplikasi. Setelah upload sukses, user dapat menghapus salinan lokal jika mau. Aplikasi menyimpan metadata dan file reference, bukan binary gambar di database.

---

## 2.3 Evidence tersebar

Evidence dapat berupa:
- foto,
- screenshot,
- GitHub commit,
- dokumen,
- URL deployment,
- hasil pengujian.

### Solusi
Evidence Library terpusat per user dan dapat ditempelkan ke Activity/Todo.

---

## 2.4 Todo dan logbook tidak seharusnya sama

Todo mewakili **rencana/proses pekerjaan**.

Activity mewakili **hal yang benar-benar dikerjakan pada tanggal tertentu**.

Satu Todo dapat menghasilkan:
- 0 Activity,
- 1 Activity,
- atau banyak Activity.

Activity juga dapat dibuat tanpa Todo.

---

# 3. Product Goals

## 3.1 Goals

Sistem harus:

1. Memungkinkan Activity dibuat < 15 detik pada alur cepat.
2. Memungkinkan upload foto dari HP/laptop.
3. Menyimpan foto di Google Drive.
4. Membatasi akses foto berdasarkan pemilik.
5. Mendukung 10 user sejak versi pertama.
6. Menyediakan Todo Kanban drag-and-drop.
7. Mewajibkan evidence sesuai gate sebelum Todo dapat melewati tahap tertentu.
8. Mendukung GitHub integration secara opsional.
9. Memungkinkan user memilih commit tertentu sebagai evidence.
10. Menampilkan logbook dalam bentuk tabel.
11. Menghasilkan Excel dari logbook.
12. Menempatkan evidence foto sebagai link Google Drive pada Excel.
13. Menghindari duplikasi data karena double click/retry.
14. Mampu pulih dari kegagalan jaringan pada proses penting.
15. Menjaga data antar-user terisolasi.

---

# 4. Non-Goals Versi Awal

Versi awal tidak perlu menjadi:

- ERP.
- HRIS.
- payroll.
- sistem absensi perusahaan.
- repository code.
- replacement GitHub.
- replacement Google Drive.
- project management enterprise.
- chat team.
- full offline-first application.
- mobile native application.

PWA dapat dipertimbangkan, tetapi aplikasi utama tetap web responsive.

---

# 5. User & Role Model

## 5.1 Role: User

User merupakan pengguna utama sistem.

User dapat:
- login,
- mengelola profil sendiri,
- membuat/edit/hapus Activity milik sendiri,
- membuat/edit/hapus Todo milik sendiri,
- upload foto milik sendiri,
- melihat foto milik sendiri,
- menghubungkan GitHub milik sendiri,
- memilih commit milik GitHub yang terhubung,
- membuat link evidence,
- generate report pribadi,
- export Excel pribadi.

User tidak dapat:
- melihat foto user lain,
- membuka metadata private user lain,
- mengedit Activity user lain,
- menggunakan commit milik koneksi GitHub user lain,
- menghapus evidence user lain.

---

## 5.2 Role: Supervisor — Optional Phase

Jika supervisor digunakan, akses harus berbasis assignment.

Supervisor dapat:
- melihat Activity user yang ditugaskan kepadanya,
- melihat evidence yang secara eksplisit boleh direview,
- memberi komentar,
- memberi review status.

Supervisor tidak otomatis mendapat akses ke semua user.

---

## 5.3 Role: Admin

Admin bertugas mengelola sistem.

Default privacy principle:

> Admin teknis tidak otomatis boleh melihat isi foto pribadi kecuali requirement bisnis secara eksplisit mengaktifkan privilege tersebut.

Admin dapat:
- create/disable user,
- melihat health/usage metadata,
- mengelola periode magang,
- mengelola konfigurasi aplikasi,
- melakukan troubleshooting metadata.

Admin content access harus menjadi permission terpisah:
- `content_read_all = false` secara default.

---

# 6. Permission Matrix

| Resource | Owner User | Other User | Supervisor Assigned | Admin Default |
|---|---:|---:|---:|---:|
| Own Profile | CRUD | No | Read minimal | Read minimal |
| Own Activity | CRUD | No | Read if assigned | Metadata |
| Own Todo | CRUD | No | Read if assigned | Metadata |
| Own Photo | CRUD | No | Read if review permission | No raw content |
| Own GitHub Evidence | CRUD link | No | Read evidence link | Metadata |
| Own Report | Generate | No | Read if shared | Metadata |
| Other User Photo | No | No | Conditional | No by default |

---

# 7. Core Domain Model

Entity utama:

```text
User
 ├── Activity
 │    ├── Evidence Link
 │    ├── Photo Evidence
 │    ├── GitHub Evidence
 │    └── External Link Evidence
 │
 ├── Todo
 │    ├── Todo Stage History
 │    ├── Todo Evidence
 │    └── Related Activities
 │
 ├── Photo Library
 ├── GitHub Connection
 │    └── GitHub Commit Cache
 │
 └── Report / Export
```

Prinsip:

- Activity = fakta aktivitas kerja.
- Todo = rencana/proses kerja.
- Evidence = bukti.
- Report = output dari Activity.
- GitHub = source evidence optional.
- Google Drive = storage external.
- Supabase = identity + structured data + authorization.

---

# 8. High-Level Architecture

```text
Browser Mobile/Desktop
        |
        v
Next.js Web Application
        |
        +-----------------------+
        |                       |
        v                       v
Supabase                    Server-side API
Auth + Postgres                 |
+ RLS                           +------ Google Drive API
                                |
                                +------ GitHub API
```

## 8.1 Critical security rule

Credential Google Drive dan GitHub secret **tidak boleh berada pada browser/client bundle**.

Sensitive operations harus terjadi server-side.


## 8.2 Technology Stack — Mandatory Baseline

Bagian ini merupakan **engineering baseline**. Developer tidak boleh mengganti komponen inti tanpa Architecture Decision Record (ADR) atau persetujuan product owner karena perubahan stack dapat memengaruhi authorization, integrasi Google Drive, kompatibilitas Vercel, dan struktur database.

### 8.2.1 Frontend Application

| Area | Technology | Status | Responsibility |
|---|---|---|---|
| Web Framework | **Next.js (App Router)** | Mandatory | routing, SSR/RSC, server route handler, application shell |
| UI Runtime | **React** | Mandatory | interactive component state |
| Language | **TypeScript** | Mandatory | type safety end-to-end |
| Styling | **Tailwind CSS** | Mandatory | global utility styling dan responsive design |
| Component Base | **shadcn/ui** | Recommended baseline | dialog, sheet, dropdown, form primitive, table, toast |
| Icons | **Lucide React** | Mandatory default | iconography konsisten |
| Forms | **React Hook Form** | Recommended | form state yang efisien |
| Validation | **Zod** | Mandatory | schema validation client/server |
| Drag & Drop | **dnd-kit** | Mandatory for Kanban | drag/drop desktop + accessible sensor |
| Date Utility | **date-fns** | Recommended | formatting dan date manipulation |
| Data Fetching | Native Next.js fetch + server actions/route handlers; TanStack Query only where client caching is needed | Controlled | hindari dua sumber cache yang tidak perlu |

### 8.2.2 Backend & Data

| Area | Technology | Status | Responsibility |
|---|---|---|---|
| Authentication | **Supabase Auth** | Mandatory | login/session/user identity |
| Relational Database | **Supabase PostgreSQL** | Mandatory | Activity, Todo, Evidence metadata, report metadata |
| Authorization | **Supabase Row Level Security (RLS)** | Mandatory | isolasi data antar-user |
| Database Function/Trigger | PostgreSQL/Supabase | As needed | constraint, audit, integrity rule |
| Realtime | Supabase Realtime | Optional | hanya jika benar-benar diperlukan untuk multi-device live update |
| Original Photo Storage | **Google Drive API** | Mandatory | binary foto/evidence asli |
| Supabase Storage | Not used for original evidence photos | Restricted | boleh dipakai hanya untuk aset aplikasi kecil jika disetujui |

### 8.2.3 External Integrations

| Integration | Technology | Rule |
|---|---|---|
| Google Drive | Google Drive API + OAuth 2.0 server-side | storage evidence pusat |
| GitHub | GitHub OAuth + GitHub REST/GraphQL API | opsional per user; read scope minimum |
| Excel | **ExcelJS** | generate `.xlsx`, hyperlink, worksheet styling |
| Deployment | **Vercel** | production + preview deployment |
| Source Control | **GitHub** | repository aplikasi + PR workflow |

### 8.2.4 Testing & Quality Stack

Recommended baseline:

- **Vitest** untuk unit test utility/business rules.
- **React Testing Library** untuk component behavior.
- **Playwright** untuk end-to-end browser testing.
- ESLint untuk static lint.
- Prettier untuk formatting.
- TypeScript strict mode untuk type checking.

CI minimum sebelum merge ke production branch:

```text
lint
  ↓
typecheck
  ↓
unit test
  ↓
build
  ↓
critical E2E smoke test
```

IF salah satu mandatory check gagal  
THEN production deployment harus diblokir.

---

## 8.3 Package Manager & Repository Standard

Default package manager: **pnpm**.

Repository minimum:

```text
internflow/
├── app/
├── components/
├── features/
│   ├── activity/
│   ├── todo/
│   ├── evidence/
│   ├── github/
│   └── reports/
├── lib/
│   ├── supabase/
│   ├── google-drive/
│   ├── github/
│   ├── validation/
│   └── excel/
├── types/
├── public/
├── tests/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── docs/
```

Business logic tidak boleh tersebar langsung di page component. Logic harus dikelompokkan berdasarkan domain/feature.

---

## 8.4 Supabase Responsibility Rules

Supabase harus digunakan untuk:

- authentication,
- profiles,
- Activity,
- Todo,
- Todo stage/history,
- evidence metadata,
- photo metadata,
- GitHub connection metadata,
- GitHub commit cache,
- relations,
- audit metadata,
- report/export metadata bila dibutuhkan.

Supabase **tidak menjadi lokasi utama binary foto**.

### BR-STACK-SUPA-001

IF developer mengupload foto original ke Supabase Storage tanpa requirement baru  
THEN implementation dianggap tidak sesuai arsitektur.

Reason:
- storage utama yang disepakati adalah Google Drive 5 TB,
- menghindari duplikasi file dan quota yang tidak perlu.

### BR-STACK-SUPA-002

Semua table milik user wajib memiliki ownership strategy yang dapat divalidasi melalui RLS.

### BR-STACK-SUPA-003

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh digunakan server-side.

IF key terdeteksi pada client bundle/public environment variable  
THEN deployment dianggap security blocker dan tidak boleh dirilis.

---

## 8.5 Google Drive Integration Architecture

Google Drive berfungsi sebagai **central private evidence storage**.

Prinsip:

1. 10 user tidak perlu mendapat akses folder Drive utama.
2. Aplikasi mencatat `user_id` pemilik file pada database.
3. Akses foto diverifikasi oleh aplikasi sebelum file diberikan.
4. `drive_file_id` bukan authorization mechanism.
5. File tidak dibuat `Anyone with the link` secara default.

Recommended folder structure:

```text
InternFlow/
└── evidence/
    ├── <user_uuid_A>/
    │   └── 2026/
    │       └── 09/
    └── <user_uuid_B>/
        └── 2026/
            └── 09/
```

Folder hanya alat organisasi. Database tetap source of truth ownership.

### Google credential rule

Credential OAuth/refresh token akun Drive pusat harus disimpan sebagai secret server-side, misalnya Vercel Environment Variable atau secure secret mechanism.

Tidak boleh:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_GOOGLE_REFRESH_TOKEN
```

### Photo upload transport rule

Karena aplikasi dideploy ke Vercel, implementasi upload harus memperhitungkan batas request/function platform.

Engineering spike wajib memvalidasi strategi final:

1. direct/resumable upload session ke Google Drive yang diinisiasi server, atau
2. server-side streaming/proxy yang tetap berada dalam limit Vercel yang dipakai.

Developer **tidak boleh** berasumsi file 15 MB aman diproxy melalui function tanpa menguji limit deployment nyata.

IF ukuran foto melebihi jalur upload yang didukung  
THEN client harus melakukan compression/resizing atau memilih resumable strategy; jangan menerima upload lalu gagal tanpa penjelasan.

---

## 8.6 GitHub Integration Architecture

GitHub bersifat **optional per user**.

Application core tidak boleh bergantung pada GitHub availability.

Data yang disimpan hanya metadata yang dibutuhkan sebagai evidence:

- repository ID/name,
- commit SHA,
- message,
- commit timestamp,
- author identity snapshot,
- commit URL,
- sync timestamp.

Source code repository tidak disalin ke Supabase.

Token GitHub:
- server-side only,
- minimum permission,
- encrypted/protected at rest according to implementation capability,
- tidak pernah dikirim kembali ke browser.

---

## 8.7 Vercel Deployment Architecture

Environment minimum:

- Local Development
- Preview
- Production

Preview deployment harus menggunakan environment variable non-production bila integration provider memungkinkan.

### Deployment rule

Production deploy berasal dari protected production branch.

Recommended flow:

```text
feature branch
   ↓
Pull Request
   ↓
Preview Vercel
   ↓
CI checks
   ↓
Review
   ↓
merge main
   ↓
Production Vercel
```

### Environment Variables

Minimum variable groups:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # server only

GOOGLE_CLIENT_ID                  # server
GOOGLE_CLIENT_SECRET              # server
GOOGLE_REFRESH_TOKEN              # server / if central-drive approach
GOOGLE_DRIVE_ROOT_FOLDER_ID       # server

GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET              # server

APP_BASE_URL
APP_ENV
```

Secret variable tidak boleh dicetak pada server log.

---

## 8.8 Excel Generation Stack

Library baseline: **ExcelJS**.

Reason:
- worksheet creation,
- hyperlink,
- styling,
- column width,
- multi-sheet support,
- buffer generation di server.

Excel generation terjadi server-side.

IF export dataset kecil (target awal 10 user)  
THEN synchronous generation diperbolehkan selama berada dalam function time/memory limit.

IF kelak dataset besar membuat export melewati platform limit  
THEN architecture harus berubah ke queued/background export service; jangan memaksa request synchronous tanpa batas.

---

## 8.9 Architecture Source-of-Truth Matrix

| Data | Source of Truth |
|---|---|
| Identity / Session | Supabase Auth |
| User Profile | Supabase PostgreSQL |
| Activity | Supabase PostgreSQL |
| Todo & Workflow | Supabase PostgreSQL |
| Evidence ownership/relations | Supabase PostgreSQL |
| Original Photo Binary | Google Drive |
| GitHub Commit Original Source | GitHub |
| Cached GitHub Evidence Snapshot | Supabase PostgreSQL |
| Generated Excel | generated on demand; persistence optional |
| UI Theme Tokens | application code / Tailwind CSS variables |

---

## 8.10 Stack-Level Defect & Failure Rules

### DEF-STACK-001 Supabase unavailable

IF database/auth dependency unavailable  
THEN:
- jangan melakukan fake success,
- tampilkan dependency error,
- simpan draft lokal untuk form yang sedang dikerjakan bila aman,
- retry setelah service pulih.

### DEF-STACK-002 Google Drive unavailable

IF Activity text dapat disimpan tetapi photo upload gagal  
THEN:
- Activity boleh disimpan sebagai draft,
- evidence upload diberi status FAILED/PENDING,
- user dapat retry tanpa menulis ulang Activity.

### DEF-STACK-003 GitHub unavailable

IF GitHub down/rate-limited  
THEN aplikasi selain GitHub tetap normal.

### DEF-STACK-004 Vercel request timeout

IF long-running export/upload melebihi execution window  
THEN jangan retry otomatis secara membabi-buta yang menimbulkan duplikasi. Gunakan idempotency dan tampilkan status gagal yang dapat diretry.

### DEF-STACK-005 Environment variable missing

IF mandatory production secret tidak tersedia saat boot/deploy  
THEN fail fast untuk fitur terkait dan tulis error konfigurasi yang aman pada log.

UI user tidak boleh menerima raw secret/configuration detail.

### DEF-STACK-006 Database migration mismatch

IF application version membutuhkan schema baru tetapi migration belum dijalankan  
THEN deployment harus dihentikan/rollback, bukan membiarkan runtime error pada user.

---

## 8.11 Dependency Upgrade Rule

Tidak melakukan automatic major-version upgrade langsung ke production.

Upgrade dependency harus:

1. dilakukan di branch terpisah,
2. melewati typecheck/test/build,
3. diuji terhadap Activity, Kanban, upload Drive, GitHub, dan Excel,
4. menggunakan preview deployment,
5. baru masuk production setelah lulus.

---

## 8.12 Engineering Decision Summary

Stack final baseline:

```text
Next.js + React + TypeScript
        |
        +-- Tailwind CSS + shadcn/ui + Lucide
        +-- React Hook Form + Zod
        +-- dnd-kit (Kanban)
        +-- ExcelJS (Excel export)
        |
        +-- Supabase Auth
        +-- Supabase PostgreSQL
        +-- Supabase RLS
        |
        +-- Google Drive API (photo/file evidence)
        +-- GitHub OAuth/API (optional commit evidence)
        |
        +-- Vercel (deployment)
        +-- GitHub (source control)
```

---

# 9. Global UX Requirements

## 9.1 Global Visual Direction

Visual identity wajib menggunakan **biru + putih**, dengan **biru sebagai warna brand dominan**.

Interpretasi "biru dominan":

- biru mendominasi brand chrome: sidebar/top navigation, primary CTA, active navigation, hero/login area, focus state, progress indicator, dan key interactive element;
- putih digunakan sebagai content surface agar Activity, form, tabel, dan evidence tetap mudah dibaca;
- semantic color seperti merah/hijau/oranye hanya dipakai untuk error/success/warning, bukan sebagai warna dekoratif utama;
- satu halaman tidak boleh menggunakan warna aksen acak yang merusak identitas biru-putih.

MVP menggunakan **light theme**. Dark mode tidak termasuk MVP agar visual dan QA tidak bercabang terlalu dini.

### 9.1.1 Brand Character

UI harus terasa:

- modern,
- bersih,
- produktif,
- ringan,
- terpercaya,
- interaktif,
- bukan seperti form administrasi lama.

Avoid:

- gradient berlebihan,
- terlalu banyak warna status,
- shadow berat,
- card dengan terlalu banyak border,
- font dekoratif,
- halaman penuh tabel tanpa hierarchy.

### 9.1.2 Global Color Tokens

Primary blue palette:

| Token | Hex | Usage |
|---|---|---|
| `blue-50` | `#EFF6FF` | selected background ringan |
| `blue-100` | `#DBEAFE` | hover/subtle chip |
| `blue-200` | `#BFDBFE` | disabled primary border |
| `blue-300` | `#93C5FD` | subtle indicator |
| `blue-400` | `#60A5FA` | secondary interactive highlight |
| `blue-500` | `#3B82F6` | standard accent |
| `blue-600` | `#2563EB` | **primary brand / primary button** |
| `blue-700` | `#1D4ED8` | hover / active primary |
| `blue-800` | `#1E40AF` | strong navigation/pressed |
| `blue-900` | `#1E3A8A` | deep brand area |

Neutral palette:

| Token | Hex | Usage |
|---|---|---|
| `white` | `#FFFFFF` | card/form/content surface |
| `background` | `#F8FAFC` | page background |
| `surface-muted` | `#F1F5F9` | muted block |
| `border` | `#E2E8F0` | default divider/border |
| `text-primary` | `#0F172A` | main text |
| `text-secondary` | `#475569` | supporting text |
| `text-muted` | `#64748B` | metadata/placeholder |

Semantic colors:

| Token | Hex | Rule |
|---|---|---|
| `success` | `#16A34A` | hanya success/completed |
| `warning` | `#D97706` | warning/overdue |
| `danger` | `#DC2626` | destructive/error |
| `info` | `#0284C7` | informational state bila primary blue tidak cocok |

### 9.1.3 Mandatory CSS Theme Tokens

Implement global theme melalui CSS variables/Tailwind theme. Component tidak boleh menyimpan warna brand sebagai hex berulang.

Recommended baseline:

```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;

  --card: #ffffff;
  --card-foreground: #0f172a;

  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --primary-hover: #1d4ed8;
  --primary-active: #1e40af;

  --secondary: #dbeafe;
  --secondary-foreground: #1e3a8a;

  --muted: #f1f5f9;
  --muted-foreground: #64748b;

  --border: #e2e8f0;
  --ring: #3b82f6;

  --success: #16a34a;
  --warning: #d97706;
  --destructive: #dc2626;
}
```

### BR-DESIGN-001 No hardcoded brand color

IF developer membutuhkan warna primary pada component  
THEN gunakan semantic token/class seperti `bg-primary`, bukan `#2563EB` hardcoded pada banyak file.

Exception hanya untuk token definition atau asset khusus yang terdokumentasi.

### 9.1.4 Color Usage by UI Area

#### Sidebar Desktop

Default recommendation:

- background: `blue-800` atau `blue-700`,
- logo/text utama: putih,
- inactive item: white dengan opacity terkendali,
- active item: white/blue-50 surface dengan blue-800 text ATAU translucent white panel,
- destructive item tidak boleh menyerupai primary navigation.

#### Mobile Header

- putih atau `blue-700` bergantung screen,
- primary action tetap biru,
- gunakan satu pattern konsisten per application shell.

#### Primary Button

```text
Default   blue-600 + white text
Hover     blue-700
Pressed   blue-800
Focus     blue ring
Disabled  blue-200 + muted text; no misleading hover
```

#### Secondary Button

- white/blue-50 background,
- blue-700 text,
- blue-200 border.

#### Destructive Button

- danger red hanya ketika benar-benar destructive.

#### Card

- white surface,
- subtle border,
- minimal shadow,
- blue indicator untuk selected/important state.

### 9.1.5 Kanban Visual Rules

Kanban tetap mengikuti brand blue-white.

Jangan memberikan warna pelangi berbeda untuk setiap column.

Recommended:

- Board background: `#F8FAFC`.
- Column surface: `blue-50` atau neutral-white mix.
- Column title: text-primary dengan blue accent line/icon.
- Todo card: white.
- Dragging card: blue ring + elevated shadow ringan.
- Valid drop target: `blue-100` + `blue-500` border.
- Invalid drop target: muted; cursor/action disabled.
- DONE boleh memiliki success indicator kecil, tetapi card tetap bagian dari system blue-white.

### 9.1.6 Evidence Visual Rules

Photo evidence:
- thumbnail pada white card,
- selected state menggunakan blue border/ring,
- broken evidence menggunakan danger icon/badge saja, bukan seluruh card merah.

GitHub evidence:
- boleh menggunakan GitHub mark/icon neutral,
- action/select state tetap primary blue.

### 9.1.7 Typography

Default application font:

**Inter**, dengan fallback:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

IF external font loading tidak diinginkan  
THEN gunakan system sans stack dan jaga metric konsisten.

Recommended hierarchy:

| Style | Size | Weight |
|---|---:|---:|
| Page Title | 28–32px | 700 |
| Section Title | 20–24px | 600–700 |
| Card Title | 16–18px | 600 |
| Body | 14–16px | 400 |
| Label | 13–14px | 500–600 |
| Metadata | 12–13px | 400–500 |

Mobile typography boleh turun satu step tetapi tidak di bawah 14px untuk body utama.

### 9.1.8 Spacing & Radius

Use 4px spacing grid.

Recommended spacing tokens:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Recommended radius:

```text
input/button: 8px
card: 12px
modal/sheet: 16px
pill/badge: 9999px
```

### 9.1.9 Shadow

Use shadow sparingly.

- default card: border-first, minimal/no shadow,
- floating dialog/dropdown: medium shadow,
- dragging Todo: temporary stronger shadow.

### 9.1.10 Accessibility Contrast

Semua text/action kritis harus memenuhi WCAG AA where applicable.

IF blue shade + white text gagal contrast  
THEN pilih blue shade yang lebih gelap, bukan memaksa identitas warna.

Status tidak boleh dibedakan hanya berdasarkan warna; gunakan icon/text/badge.

---

## 9.2 Mobile First

Pada mobile:

- tombol `+ Activity` harus mudah dijangkau dengan satu tangan,
- upload foto harus dapat menggunakan camera/gallery picker,
- form Quick Activity tidak boleh memaksa terlalu banyak field,
- drag-and-drop Todo harus memiliki fallback tap-action karena drag pada touch device bisa tidak presisi,
- semua critical action harus punya confirmation atau undo apabila destructive.

## 9.3 Desktop

Desktop dapat menampilkan:
- sidebar,
- Kanban multi-column,
- tabel logbook,
- evidence picker side panel,
- bulk selection.


## 9.4 Responsive Breakpoints

Use Tailwind breakpoint baseline:

```text
sm  >= 640px
md  >= 768px
lg  >= 1024px
xl  >= 1280px
2xl >= 1536px
```

Product behavior:

- `< 768px`: mobile navigation, drawer/sheet, stacked forms.
- `768–1023px`: tablet hybrid.
- `>= 1024px`: persistent sidebar and multi-column workspace.

Breakpoints tidak boleh hanya mengubah ukuran; interaction pattern juga harus disesuaikan.

---

## 9.5 Application Shell

### Desktop

Recommended:

```text
┌─────────────────────────────────────────────────────┐
│ Blue Sidebar │ Top Header                           │
│              ├──────────────────────────────────────┤
│ Dashboard    │ Main white/light content surface     │
│ Activity     │                                      │
│ Todo         │                                      │
│ Evidence     │                                      │
│ Logbook      │                                      │
│ Report       │                                      │
└─────────────────────────────────────────────────────┘
```

### Mobile

```text
┌─────────────────────────┐
│ Header / page title      │
├─────────────────────────┤
│                         │
│ Main content            │
│                         │
├─────────────────────────┤
│ Bottom Navigation       │
└─────────────────────────┘
```

Floating `+` button diperbolehkan untuk Quick Activity apabila tidak menutupi navigation/evidence control.

---

## 9.6 Global Interaction States

Semua interactive component harus mendefinisikan:

- default,
- hover (desktop),
- focus-visible,
- pressed/active,
- loading,
- disabled,
- error bila relevan.

### Loading rule

IF action sedang submit  
THEN:
- tampilkan spinner/progress,
- disable duplicate submission,
- pertahankan label yang menjelaskan action.

Jangan hanya mengubah text menjadi `Loading...` jika user kehilangan konteks action.

---

## 9.7 Skeleton & Empty State

Data page wajib memiliki:

- loading skeleton,
- empty state,
- error state.

Example Evidence empty state:

```text
Belum ada evidence.
Upload foto atau hubungkan GitHub untuk mulai menambahkan bukti aktivitas.
[Upload Foto]
```

Empty state harus menawarkan next action, bukan halaman kosong.

---

## 9.8 Global Design Defect Rules

### DEF-UI-001 Random color drift

IF component baru menggunakan warna brand di luar token global  
THEN review harus meminta refactor ke theme token.

### DEF-UI-002 Primary and destructive action indistinguishable

IF destructive button terlihat sama dengan primary action  
THEN use danger semantic style + confirmation.

### DEF-UI-003 Blue dominance hurts readability

IF large blue surface berisi dense table/form dan readability turun  
THEN content surface harus kembali putih sementara blue tetap dominan pada shell, navigation, CTA, focus, dan accent.

### DEF-UI-004 Mobile Kanban drag unreliable

IF drag gesture gagal/bertabrakan dengan scroll  
THEN user harus tetap dapat memindahkan Todo melalui menu `Pindahkan ke...`.

### DEF-UI-005 Theme mismatch

IF third-party component memiliki warna default unthemed  
THEN override melalui global theme/component variant sebelum release.

### DEF-UI-006 Insufficient contrast

IF accessibility test menemukan contrast gagal  
THEN darker blue/text token must be used; visual preference tidak mengalahkan accessibility.

---

# 10. Navigation

Minimum navigation:

1. Dashboard
2. Activity
3. Todo
4. Evidence
5. Logbook
6. Reports / Export
7. GitHub Integration
8. Profile / Settings

Mobile dapat menggunakan bottom navigation untuk item paling sering dipakai:
- Home
- Activity
- Todo
- Evidence
- More

---

# 11. Authentication Requirements

## FR-AUTH-001 Login

User login menggunakan email/password atau auth provider yang dipilih sistem.

### Required behavior
IF credential valid  
THEN create authenticated session and redirect dashboard.

IF credential invalid  
THEN reject without menyebut apakah email atau password yang salah secara terlalu spesifik jika ingin mencegah account enumeration.

### Error messages
Prefer:
`Email atau password tidak valid.`

---

## FR-AUTH-002 Session

IF access token expired  
THEN attempt token refresh.

IF refresh succeeds  
THEN continue session.

IF refresh fails  
THEN:
- preserve unsaved local draft,
- redirect login,
- after login restore draft.

---

## FR-AUTH-003 Logout

Logout must:
- invalidate current local session,
- clear sensitive client cache,
- not delete server data.

---

# 12. Dashboard Requirements

Dashboard bertujuan menunjukkan "apa yang harus diperhatikan sekarang", bukan hanya angka.

Components:

- Greeting + current date.
- Quick Add Activity.
- Quick Upload Photo.
- Todo summary.
- Activity today.
- Missing logbook days.
- Unassigned evidence.
- GitHub sync card only if GitHub connected.
- Recent activities.
- Export shortcut.

Example widgets:

```text
Hari ini
3 Activity
4 Foto
2 Todo selesai

Perlu perhatian
- 2 foto belum terkait Activity
- 1 Todo belum punya evidence
- 1 hari logbook kosong
```

---

# 13. Activity Module

## 13.1 Activity Definition

Activity adalah catatan pekerjaan aktual pada suatu tanggal.

Activity tidak membutuhkan Todo.

### Minimal valid Activity

Activity valid jika:
- `title` tersedia, OR
- minimal 1 photo evidence tersedia.

Jika hanya foto:
- sistem dapat menggunakan placeholder title `Aktivitas tanpa judul`,
- activity harus ditandai `NEEDS_DESCRIPTION`.

---

## 13.2 Activity Fields

| Field | Type | Required | Rule |
|---|---|---:|---|
| id | UUID | Yes | generated server-side |
| user_id | UUID | Yes | immutable owner |
| title | varchar | Conditional | required if no photo |
| description | text | No | max length defined |
| activity_date | date | Yes | default today |
| start_time | time | No | |
| end_time | time | No | end >= start |
| source | enum | Yes | manual/todo/quick_capture |
| todo_id | UUID | No | must belong to same user |
| status | enum | Yes | draft/ready/archived |
| created_at | timestamptz | Yes | server |
| updated_at | timestamptz | Yes | server |
| version | integer | Yes | optimistic locking |

Recommended Activity status is intentionally simple:

- `DRAFT`
- `READY`
- `ARCHIVED`

Activity is not project workflow. Workflow belongs to Todo.

---

## 13.3 Create Activity

### Normal mode

Fields:
- title,
- date,
- description,
- time,
- evidence,
- optional Todo link.

### Quick mode

User can:
- take/upload photo,
- add short note,
- save.

Quick mode should require <= 2 meaningful user actions after selecting photo.

---

## BR-ACT-001 Ownership

When Activity created:

`activity.user_id = auth.uid()`

Client-provided `user_id` must be ignored.

---

## BR-ACT-002 Date

IF no date supplied  
THEN use user-local current date.

Do not use UTC date directly for displayed work date.

---

## BR-ACT-003 Future date

Default:
- future Activity date allowed up to configurable limit, e.g. +7 days,
- but UI warns if date is future.

Reason:
User may prefill planned notes accidentally; however Activity ideally represents actual work.

---

## BR-ACT-004 Time validation

IF `start_time` and `end_time` exist AND `end_time < start_time`  
THEN reject unless `spans_midnight = true`.

For internship context, default `spans_midnight = false`.

---

## BR-ACT-005 Duplicate prevention

Frontend:
- disable submit during request.

Backend:
- accept `idempotency_key`.

IF same authenticated user sends same idempotency key  
THEN return original result rather than create duplicate.

---

## DEF-ACT-001 Network failure during create

IF request times out before confirmation  
THEN UI must not blindly create a second record.

Client keeps local `pending_submission_id`.

On retry:
- resend same idempotency key.

---

## DEF-ACT-002 Browser closes while typing

Autosave local draft every 3–5 seconds when form dirty.

IF browser reopened  
THEN offer:
`Pulihkan draft sebelumnya?`

Do not automatically overwrite a newer server version.

---

## DEF-ACT-003 Concurrent edit

Each Activity has `version`.

IF client sends update with version 4 but DB version is 5  
THEN return `409 Conflict`.

UI:
- show server version vs local change,
- offer `Reload` or `Save as copy`,
- do not silently overwrite.

---

# 14. Activity Evidence Linking

Evidence can be attached:
- during Activity creation,
- after Activity created,
- from Evidence Library,
- from GitHub commit picker.

One evidence can optionally be reused by multiple Activities, but system should warn when reused.

Default recommendation:
- photo evidence may attach to multiple activities,
- deletion must consider existing links.

---

# 15. Evidence Module

## 15.1 Evidence Types

MVP:
- PHOTO
- GITHUB_COMMIT
- LINK

Phase 2:
- FILE
- DOCUMENT
- GITHUB_PR
- GITHUB_ISSUE
- VIDEO

---

## 15.2 Evidence Common Fields

| Field | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| type | enum |
| title | text |
| note | text nullable |
| captured_at | timestamptz nullable |
| created_at | timestamptz |
| source_status | enum |
| metadata | jsonb |

---

## 15.3 Evidence State

Possible states:

- `UPLOADING`
- `AVAILABLE`
- `FAILED`
- `ORPHANED`
- `BROKEN`
- `DELETED`

### AVAILABLE
Evidence dapat dipilih.

### ORPHANED
File sudah ada, tetapi belum terkait Activity/Todo.

### BROKEN
Metadata masih ada tetapi external source tidak dapat diakses.

---

# 16. Photo Evidence

## 16.1 Storage Model

Binary image disimpan di Google Drive.

Supabase menyimpan metadata:

```text
photo_id
user_id
drive_file_id
drive_folder_id
original_name
stored_name
mime_type
size_bytes
width
height
captured_at
uploaded_at
checksum
status
```

---

## 16.2 Privacy Rule

User A hanya dapat melihat metadata foto dengan:

`photos.user_id = auth.uid()`

Untuk file binary:
- request masuk ke protected application endpoint,
- server verifies ownership,
- server fetches/streams file or returns a controlled short-lived representation.

Raw Google Drive folder tidak dibagikan ke 10 user.

---

## 16.3 Upload Flow

```text
1. User chooses/takes photo
2. Client validates basic type/size
3. Client sends upload request
4. Server verifies session
5. Server validates MIME + file signature
6. Server uploads to Google Drive
7. Drive returns file ID
8. Server inserts metadata into Supabase
9. Server returns Evidence object
10. UI marks upload complete
```

---

## 16.4 Allowed Format

MVP:
- image/jpeg
- image/png
- image/webp

Optional HEIC:
- either supported directly,
- or converted before upload.

The product must choose one deterministic behavior.

Recommended:
- detect HEIC,
- convert to JPEG client/server,
- preserve original captured timestamp metadata if possible.

---

## 16.5 Upload Size

Configurable.

Recommended MVP:
- default maximum 15 MB/image.

If image > max:
- offer compression,
- do not silently discard quality without user feedback.

---

## 16.6 Compression

Optional client compression:

IF image > threshold, e.g. 3 MB  
THEN compress while preserving readable documentation.

Do not compress screenshots so heavily that text becomes unreadable.

---

## 16.7 File Naming

Do not trust original filename as unique.

Stored filename pattern:

`{user_uuid}/{yyyy}/{mm}/{uuid}.{ext}`

Display original filename separately.

---

## 16.8 Duplicate Photo Detection

Use checksum where possible.

IF same checksum already uploaded by same user:
- show warning:
`Foto yang sama tampaknya sudah pernah diunggah.`

Options:
- use existing,
- upload anyway.

Do not block duplicates absolutely because same image may intentionally be reused.

---

# 17. Photo Failure & Recovery Rules

## DEF-PHOTO-001 Drive upload succeeds, DB insert fails

Risk: orphan file on Drive.

Rule:

IF Drive upload succeeded AND DB insert failed  
THEN system attempts immediate Drive deletion.

IF deletion also fails  
THEN write reconciliation log containing:
- drive_file_id,
- attempted owner,
- timestamp,
- failure reason.

A scheduled/manual reconciliation process can remove orphaned files later.

---

## DEF-PHOTO-002 DB row exists but Drive file missing

IF user requests photo AND Drive returns 404  
THEN:
- set evidence status `BROKEN`,
- show placeholder,
- allow user to remove broken evidence,
- do not crash Activity page.

---

## DEF-PHOTO-003 Upload interrupted

Use resumable upload if implementation supports it.

IF not:
- mark upload FAILED,
- keep local preview,
- show Retry.

Retry must not create duplicate Drive files without checking previous upload state.

---

## DEF-PHOTO-004 User deletes photo that is used by Activity

IF evidence link count > 0  
THEN do not hard delete immediately.

Show:
`Foto ini digunakan oleh 3 aktivitas.`

Options:
- cancel,
- detach from selected Activities,
- delete everywhere.

Hard deletion requires explicit confirmation.

---

## DEF-PHOTO-005 User deletes Drive file manually outside application

Next access:
- detect 404,
- mark BROKEN,
- show report warning.

Excel export:
- include broken link marker or empty link with `Evidence unavailable`.

---

# 18. Evidence Library

Evidence Library shows only current user's evidence.

Filters:
- date,
- type,
- assigned/unassigned,
- Activity,
- Todo,
- broken,
- uploaded recently.

Photo cards show:
- thumbnail,
- captured date,
- uploaded date,
- assigned indicator.

GitHub cards show:
- repo,
- commit message,
- short SHA,
- commit date.

---

# 19. Todo Module

## 19.1 Purpose

Todo adalah fitur tambahan untuk membantu pekerjaan yang:
- punya proses,
- punya deadline,
- perlu dipindahkan antar tahap,
- perlu evidence per tahap.

Todo tidak wajib digunakan untuk Activity.

---

## 19.2 Todo Fields

| Field | Type | Required |
|---|---|---:|
| id | UUID | Yes |
| user_id | UUID | Yes |
| title | text | Yes |
| description | text | No |
| priority | enum | No |
| due_date | date | No |
| current_stage_id | UUID | Yes |
| created_at | timestamp | Yes |
| completed_at | timestamp | No |
| version | integer | Yes |

Priority:
- LOW
- MEDIUM
- HIGH
- URGENT

---

# 20. Todo Kanban Workflow

Default board:

```text
BACKLOG
   |
   v
TO DO
   |
   v
IN PROGRESS
   |
   v
REVIEW
   |
   v
DONE
```

However stage design should be data-driven rather than hard-coded where practical.

Each stage can have:

```text
requires_evidence_on_enter
requires_evidence_on_exit
minimum_evidence_count
allowed_evidence_types
requires_note
```

This makes "harus ada evidence untuk menyelesaikan proses" implementable cleanly.

---

# 21. Drag-and-Drop Rules

## FR-KANBAN-001 Desktop Drag

User can drag Todo card between valid columns.

During drag:
- target valid stage highlighted.
- invalid target dimmed/disabled.

---

## FR-KANBAN-002 Mobile

Because mobile drag can be unreliable:
- support drag gesture,
- also provide `Pindahkan ke...` action menu.

Functionality must not depend solely on drag.

---

## BR-KANBAN-001 Transition Validation

On drop:

```text
IF target transition is allowed
    evaluate target stage rules
ELSE
    reject and snap card back
```

---

## BR-KANBAN-002 Evidence Gate

Example default rules:

### BACKLOG → TODO
Evidence not required.

### TODO → IN_PROGRESS
Evidence not required.
Set `started_at` if empty.

### IN_PROGRESS → REVIEW
Require at least 1 evidence OR stage-specific evidence rule.

### REVIEW → DONE
Require:
- at least 1 valid evidence,
- no evidence status FAILED/BROKEN being the only evidence,
- optional completion note.

---

## BR-KANBAN-003 Evidence per process

System shall support attaching evidence to a specific **Todo Stage Event**.

Example:

```text
Todo: Implementasi Dashboard

IN PROGRESS evidence:
- screenshot initial UI

REVIEW evidence:
- GitHub commit abc123

DONE evidence:
- deployed page screenshot
```

Thus evidence can prove each process step, not only Todo overall.

---

# 22. Todo Transition History

Every successful stage move writes immutable history:

```text
id
todo_id
from_stage
to_stage
user_id
moved_at
note
evidence_count_at_transition
```

Do not overwrite history.

If move later reverted:
- add another transition record.

---

# 23. Kanban Defect Scenarios

## DEF-KANBAN-001 Invalid drop

IF target stage not allowed  
THEN:
- reject,
- animate card back,
- show reason.

Example:
`Tidak dapat langsung memindahkan BACKLOG ke DONE.`

---

## DEF-KANBAN-002 Evidence missing

IF target stage requires evidence AND valid evidence count < minimum  
THEN:
- reject drop,
- open evidence attach drawer optionally,
- keep card in original stage.

---

## DEF-KANBAN-003 Evidence is broken

IF only evidence has status BROKEN  
THEN it does not satisfy completion gate.

---

## DEF-KANBAN-004 User drags same Todo on two devices

Use optimistic locking.

Request includes Todo `version`.

IF version mismatch  
THEN:
- reject stale move,
- fetch latest Todo state,
- show:
`Todo telah berubah di perangkat lain.`

---

## DEF-KANBAN-005 Network fails after optimistic UI movement

Client may move card optimistically.

IF server update fails:
- rollback card to original stage,
- toast:
`Perubahan belum tersimpan.`

---

## DEF-KANBAN-006 Drop event fires twice

Use transition idempotency key.

Same key must not create two history rows.

---

## DEF-KANBAN-007 Evidence removed after Todo DONE

Business decision:

Default:
- Todo remains DONE,
- but system marks `EVIDENCE_INCOMPLETE`,
- warns user,
- report can flag missing evidence.

Reason:
Historical status should not silently revert when evidence later disappears.

Alternative strict mode can auto-reopen; not recommended for MVP.

---

# 24. Todo → Activity Helper

Todo may help fill Activity.

Action:
`Buat Activity dari Todo`

Pre-fill:
- Activity title from Todo title.
- Activity description from Todo description or completion note.
- activity_date = today.
- link `todo_id`.

User can edit before save.

---

## BR-TODO-ACT-001

Creating Activity from Todo does NOT automatically mark Todo DONE.

---

## BR-TODO-ACT-002

One Todo may have many Activities.

---

## BR-TODO-ACT-003

Deleting Todo must not delete Activity.

Instead:
- set related Activity `todo_id = null` or preserve soft reference depending implementation.

Recommended:
soft-delete Todo so historical relation remains.

---

# 25. GitHub Integration

## 25.1 Optional by Design

GitHub connection must not block:
- login,
- Activity creation,
- photo upload,
- Todo,
- reports.

If GitHub never connected, system remains fully usable.

---

## 25.2 Connect Flow

```text
Settings > GitHub > Connect
        |
        v
GitHub OAuth
        |
        v
Callback
        |
        v
Store connection metadata securely
        |
        v
Sync permitted repositories/activity
```

---

## 25.3 Scope Principle

Request minimum required GitHub permissions.

System should avoid requesting write access unless future feature explicitly needs it.

For commit evidence, read access is sufficient.

---

## 25.4 GitHub Data to Cache

Minimum:
- github_user_id,
- username,
- repository id/name,
- commit SHA,
- commit message,
- author date,
- commit URL,
- branch if available,
- sync timestamp.

Do not copy source code.

---

# 26. GitHub Evidence Picker

User opens:
`Tambah Evidence > GitHub`

Display:
- repository filter,
- date filter,
- recent commits.

Commit card:

```text
Repo: internship-app
SHA: a31f82c
Message: fix activity validation
Date: 30 Sep 2026 14:20

[Add as Evidence]
```

Multiple commits can be selected.

---

## 26.1 GitHub Commit Rules

IF commit already attached to same Activity  
THEN prevent duplicate relation.

IF same commit attached to another Activity  
THEN allow, but optionally warn:
`Commit ini sudah digunakan pada Activity lain.`

---

# 27. GitHub Failure Rules

## DEF-GH-001 Token expired/revoked

IF GitHub returns 401/invalid credential:
- set connection `REAUTH_REQUIRED`,
- retain previously cached evidence,
- show reconnect CTA.

Existing report must not lose past commit metadata.

---

## DEF-GH-002 Repository becomes private/unavailable

Previously attached cached commit remains visible with status:
`SOURCE_UNAVAILABLE`.

Do not delete historical evidence.

---

## DEF-GH-003 Commit force-pushed/deleted

Keep cached:
- SHA,
- message,
- date,
- old URL.

Mark link potentially unavailable.

---

## DEF-GH-004 API rate limit

IF rate limited:
- do not show generic system failure,
- show:
`Sinkronisasi GitHub sementara dibatasi. Coba lagi nanti.`
- retain last successful sync.

---

## DEF-GH-005 Same user reconnects different GitHub account

Require explicit confirmation.

Existing evidence remains attributed to original GitHub identity snapshot.

New sync uses new account.

---

# 28. Activity Table / Logbook

Logbook is generated from Activity records.

Default columns:

| No | Tanggal | Waktu | Aktivitas | Keterangan | Evidence |
|---|---|---|---|---|---|

Optional:
- Todo reference.
- Duration.
- Evidence count.
- Status.

User can filter:
- date range,
- month,
- keyword,
- evidence type.

---

# 29. Description Behavior

Activity description can be:

1. entered manually,
2. copied/pre-filled from Todo,
3. refined later,
4. AI-assisted only if future feature enabled.

Todo description should never silently overwrite a manual Activity description.

IF Activity created from Todo:
- prefill,
- user edits,
- save Activity own copy.

Future Todo changes must not mutate existing Activity unless user explicitly syncs.

---

# 30. Logbook Missing-Day Detection

System may show working-day gaps.

Config:
- internship start date,
- internship end date,
- working days.

IF expected working day has no Activity  
THEN mark:
`Belum ada Activity`.

Do not assume weekends are workdays unless configured.

---

# 31. Report & Excel Export

## 31.1 Export Flow

User selects:
- start date,
- end date,
- include evidence,
- include Todo sheet optional.

Click `Generate Excel`.

Server:
1. fetch authorized user Activities,
2. fetch linked evidence,
3. resolve evidence URLs,
4. generate workbook,
5. return file.

---

# 32. Excel Workbook Structure

## Sheet 1 — Logbook

Columns:

```text
No
Tanggal
Jam Mulai
Jam Selesai
Aktivitas
Keterangan
Evidence
```

Evidence cell behavior:

- If one photo: Google Drive link.
- If multiple: either multiple links separated cleanly or evidence reference codes.
- GitHub: commit link.
- Mixed: each evidence listed with label.

Recommended display:

```text
Foto 1: <link>
Foto 2: <link>
Commit a31f82c: <link>
```

---

## Sheet 2 — Evidence Detail

Columns:

```text
Evidence ID
Activity ID
Tanggal
Type
Nama/Judul
URL
Status
```

---

## Sheet 3 — Todo (optional)

Columns:

```text
Todo
Priority
Due Date
Current Status
Completed At
Related Activities
Evidence Count
```

---

# 33. Google Drive Link Rules for Export

Critical design question:
How should recipient access the exported Drive link?

Possible modes:

### Mode A — Private application-only
Most secure, but Excel recipient cannot open unless logged into app.

### Mode B — Google Drive share link
Useful for external reviewer, but requires file permission.

Recommended product must support explicit export behavior:

`Evidence Link Mode`:
- `APP_PRIVATE`
- `DRIVE_SHARED`

Default: `APP_PRIVATE`.

If user chooses `DRIVE_SHARED`, application must clearly warn that external access permission may change.

Do NOT automatically make all uploaded photos public.

---

# 34. Excel Defect Rules

## DEF-XLSX-001 Link contains invalid/missing source

IF evidence status BROKEN  
THEN write:
`Evidence unavailable`
and not a dead unlabelled value.

---

## DEF-XLSX-002 Description exceeds Excel cell length

System must truncate/export safely according to workbook library limits.

Prefer preserving full text where supported.

---

## DEF-XLSX-003 Special characters/formula injection

User text beginning with:
- `=`
- `+`
- `-`
- `@`

must be escaped when written as a plain data cell to prevent formula injection.

---

## DEF-XLSX-004 No Activity in selected date

Do not generate misleading empty report silently.

Show:
`Tidak ada Activity pada rentang tanggal ini.`

User may still choose `Generate empty template` if desired.

---

## DEF-XLSX-005 Multiple export clicks

Use button loading state.

If same export requested simultaneously:
- deduplicate where feasible,
- at minimum avoid UI confusion.

---

# 35. Database Logical Schema

## profiles

```sql
id uuid PK references auth.users
display_name text
role text
is_active boolean
timezone text
created_at timestamptz
updated_at timestamptz
```

---

## activities

```sql
id uuid PK
user_id uuid NOT NULL
todo_id uuid NULL
title text
description text
activity_date date NOT NULL
start_time time NULL
end_time time NULL
source text NOT NULL
status text NOT NULL
version integer NOT NULL default 1
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz NULL
```

---

## todos

```sql
id uuid PK
user_id uuid NOT NULL
title text NOT NULL
description text
priority text
due_date date
current_stage_id uuid NOT NULL
version integer NOT NULL default 1
started_at timestamptz
completed_at timestamptz
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

---

## todo_stages

```sql
id uuid PK
workspace_id uuid NULL
name text
position integer
requires_evidence_on_enter boolean
requires_evidence_on_exit boolean
minimum_evidence_count integer
requires_note boolean
is_terminal boolean
```

---

## todo_transitions

```sql
id uuid PK
todo_id uuid NOT NULL
user_id uuid NOT NULL
from_stage_id uuid
to_stage_id uuid NOT NULL
note text
evidence_count integer
idempotency_key text
created_at timestamptz
```

---

## evidences

```sql
id uuid PK
user_id uuid NOT NULL
type text NOT NULL
title text
note text
status text NOT NULL
captured_at timestamptz
metadata jsonb
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

---

## photo_evidences

```sql
evidence_id uuid PK
drive_file_id text NOT NULL
drive_folder_id text
original_filename text
stored_filename text
mime_type text
size_bytes bigint
checksum text
width integer
height integer
uploaded_at timestamptz
```

---

## github_connections

```sql
id uuid PK
user_id uuid UNIQUE NOT NULL
github_user_id text
github_username text
connection_status text
created_at timestamptz
updated_at timestamptz
```

Tokens should be stored using secure server-side secret handling; do not expose token columns to client.

---

## github_commits

```sql
id uuid PK
user_id uuid NOT NULL
github_connection_id uuid NOT NULL
repository_id text
repository_name text
sha text NOT NULL
message text
commit_url text
author_date timestamptz
source_status text
synced_at timestamptz

UNIQUE(user_id, repository_id, sha)
```

---

## activity_evidences

```sql
activity_id uuid NOT NULL
evidence_id uuid NOT NULL
attached_by uuid NOT NULL
attached_at timestamptz
PRIMARY KEY(activity_id, evidence_id)
```

---

## todo_evidences

```sql
todo_id uuid NOT NULL
evidence_id uuid NOT NULL
stage_id uuid NULL
attached_by uuid NOT NULL
attached_at timestamptz
PRIMARY KEY(todo_id, evidence_id, stage_id)
```

---

# 36. Row-Level Security Principles

Every user-owned table must enforce ownership server-side.

Example conceptual rules:

### Activities SELECT
Allowed when:
`user_id = auth.uid()`

### Activities INSERT
Check:
`user_id = auth.uid()`

### Activities UPDATE
Allowed:
`user_id = auth.uid()`

### Evidence SELECT
Allowed:
`user_id = auth.uid()`

### Photo metadata
Same ownership rule.

Client must never be trusted merely because UI hides other records.

---

# 37. Object Ownership Rules

Cross-owner linking must be rejected.

IF:
Activity.owner = User A  
AND Evidence.owner = User B

THEN:
reject `activity_evidences` insert.

Same for:
Todo vs Evidence.

---

# 38. Soft Delete Rules

Use soft delete for:
- Activity,
- Todo,
- Evidence metadata when referenced historically.

Hard delete can be a later cleanup action.

Reason:
- report history,
- accidental deletion recovery,
- audit consistency.

---

# 39. Audit Log

Critical mutations should create audit events:

- create Activity,
- edit Activity,
- delete Activity,
- Todo transition,
- evidence attach/detach,
- GitHub connect/disconnect,
- export report.

Audit event:

```text
event_id
user_id
entity_type
entity_id
action
timestamp
metadata summary
```

Do not store secret token values.

---

# 40. Business Rules Master List

## BR-001
Activity is independent from Todo.

## BR-002
Todo is optional.

## BR-003
GitHub is optional.

## BR-004
Photo upload is not optional globally, but Activity may exist without photo.

## BR-005
Every Todo terminal completion must satisfy stage evidence rules.

## BR-006
User only accesses own evidence unless explicit supervisory permission exists.

## BR-007
Drive folder is not shared directly as the primary access-control mechanism.

## BR-008
GitHub commit does not automatically become logbook row.

## BR-009
GitHub commit only becomes evidence after user attaches/selects it.

## BR-010
Report is generated from Activity.

## BR-011
Todo can prefill Activity description but cannot overwrite it later.

## BR-012
Evidence deletion must respect existing relations.

## BR-013
Broken evidence does not satisfy a completion requirement where evidence validity is required.

## BR-014
Every stage transition is validated server-side.

## BR-015
Drag-drop UI is never the only source of truth; database state is authoritative.

---

# 41. Global Validation Rules

- Trim leading/trailing whitespace.
- Empty whitespace-only title counts as empty.
- Reject invalid UUID/resource ownership.
- Sanitize rendered text.
- Escape spreadsheet formula injection.
- Reject unsupported MIME.
- File extension alone is insufficient validation.
- Max lengths defined for all text fields.
- Date/time interpreted in user timezone.
- Server timestamps use UTC internally.

---

# 42. Global Error UX

Errors categorized:

### Validation
User can fix immediately.
Example:
`Judul wajib diisi.`

### Authorization
Do not leak resource existence.
Example:
`Anda tidak memiliki akses.`

### Dependency failure
Google/GitHub unavailable.
Example:
`Layanan penyimpanan sementara tidak tersedia.`

### Conflict
Another device changed data.
Example:
`Data telah berubah. Muat ulang sebelum melanjutkan.`

### Unknown server error
Provide generic message + trace/reference ID.

Do not expose stack traces.

---

# 43. Offline / Weak Network Behavior

Full offline mode is not mandatory MVP.

However:

- text drafts should survive refresh/crash.
- failed submissions should be retryable.
- photo upload state must be visible.
- user must know whether an Activity is truly saved server-side.

Status indicator:
- `Tersimpan`
- `Menyimpan...`
- `Belum tersinkron`

Never show "saved" when server confirmation not received.

---

# 44. Race Condition Rules

## Scenario: Evidence attach + deletion simultaneously

Server transaction should ensure:
- either link succeeds to available evidence,
- or fails cleanly.

No dangling foreign key.

## Scenario: Todo completion while evidence upload still UPLOADING

UPLOADING does not count as valid evidence.

Completion blocked until AVAILABLE.

## Scenario: Evidence becomes BROKEN after Todo done

Todo remains done but flagged.

---

# 45. Security Requirements

- HTTPS only.
- Secure auth cookie/session configuration.
- RLS enabled for user-owned Supabase tables.
- Google secret/token server-side only.
- GitHub token server-side only.
- no service-role key in browser.
- rate limit upload endpoints.
- validate file content.
- protect against IDOR.
- protect against CSRF where relevant to auth/action architecture.
- output escaping against XSS.
- spreadsheet formula injection protection.
- do not log secrets.
- least privilege OAuth scopes.

---

# 46. Performance Requirements

For 10 active users:

Target interactive page response:
- common metadata actions < 2 seconds under normal connection.

Photo upload:
- progress feedback required for uploads > 1 second.

Kanban:
- drag response perceived immediately,
- server confirmation asynchronous,
- rollback on failure.

Gallery:
- use thumbnails/lazy loading.
- do not fetch full-resolution images for grid.

---

# 47. Accessibility Requirements

- keyboard alternative for drag-drop.
- focus states visible.
- buttons have text/aria labels.
- status not communicated by color only.
- form errors associated with fields.
- mobile touch targets sufficient size.

---

# 48. Notification Requirements

MVP in-app:
- success toast,
- failure toast,
- evidence requirement warning,
- unsaved changes warning.

Optional future:
- reminder to fill daily Activity,
- reminder Todo due date,
- broken evidence alert.

---

# 49. Search & Filter

Activity filters:
- date range,
- keyword,
- Todo,
- evidence type.

Todo filters:
- stage,
- priority,
- due date.

Evidence filters:
- photo/GitHub/link,
- assigned/unassigned,
- date,
- broken.

Search should be scoped to current user.

---

# 50. Deletion Policies

## Activity deletion

IF Activity has evidence:
- deleting Activity removes relation only,
- does not delete evidence by default.

## Todo deletion

Soft delete.

Related Activities retained.

## Evidence deletion

If attached:
- warn.

Hard deleting photo should attempt Drive deletion.

If Drive deletion fails:
- retain metadata with delete pending state.

---

# 51. Real-World Defect Matrix

| ID | Scenario | IF | THEN | Recovery |
|---|---|---|---|---|
| D-001 | Double save Activity | same idempotency key | return existing | no duplicate |
| D-002 | Upload Drive success DB fail | DB insert error | delete Drive file | orphan reconciliation |
| D-003 | DB exists Drive missing | Drive 404 | mark BROKEN | replace/remove evidence |
| D-004 | Drag Todo no evidence | gate fails | rollback | open evidence picker |
| D-005 | GitHub revoked | API 401 | REAUTH_REQUIRED | reconnect |
| D-006 | GitHub rate limit | rate limited | use cached data | retry later |
| D-007 | User guesses photo ID | not owner | 403/404-style denial | no data leak |
| D-008 | Same Todo edited 2 devices | version mismatch | 409 | reload/merge |
| D-009 | Browser closes form | dirty local draft | persist local | restore |
| D-010 | Upload interrupted | network lost | FAILED | retry |
| D-011 | Todo done evidence later deleted | evidence invalid | flag incomplete | attach replacement |
| D-012 | Report range empty | zero Activity | warn | cancel/template |
| D-013 | Excel formula-like text | begins =/+/-/@ | escape | safe export |
| D-014 | User changes timezone | displayed date differs | use profile timezone | recalc display only |
| D-015 | Upload same photo twice | checksum match | warn | reuse/upload |
| D-016 | User disconnects GitHub | cached evidence exists | retain cached | mark source disconnected |
| D-017 | Commit disappears | URL invalid | mark unavailable | keep snapshot |
| D-018 | Drag fires twice | duplicate key | ignore second | stable state |
| D-019 | Evidence still uploading | not AVAILABLE | not valid for gate | wait/retry |
| D-020 | User loses login during edit | session expired | save local | re-auth + restore |
| D-021 | Malicious filename | unsafe chars | sanitize stored name | preserve display name safely |
| D-022 | Oversized image | > limit | reject/compress option | retry |
| D-023 | Wrong MIME extension | signature mismatch | reject | tell supported type |
| D-024 | User deletes Activity with reused evidence | relations exist | remove relation only | evidence retained |
| D-025 | Drive API unavailable | dependency 5xx | queue/retry | keep local pending |
| D-026 | Report evidence private | reviewer cannot access | warn link mode | change sharing intentionally |
| D-027 | User drags mobile accidentally | low confidence/touch | require drop target | undo |
| D-028 | Todo due date past | date passed | overdue badge | still editable |
| D-029 | User enters future Activity | future date | warn | allow within policy |
| D-030 | Two export requests | duplicate click | disable button | one job/result |

---

# 52. Detailed IF / ELSE Examples

## 52.1 Completing Todo

```pseudo
IF todo.owner_id != current_user.id:
    DENY

IF target_stage.is_terminal == false:
    MOVE if transition allowed

ELSE:
    valid_evidence = count(
        evidence attached to todo
        where status == AVAILABLE
        and matches allowed evidence types
    )

    IF valid_evidence < target_stage.minimum_evidence_count:
        REJECT
        SHOW "Tambahkan evidence sebelum menyelesaikan Todo"
    ELSE:
        MOVE
        SET completed_at
        WRITE transition history
```

---

## 52.2 Attaching Photo to Activity

```pseudo
IF activity.owner != current_user:
    DENY

IF evidence.owner != current_user:
    DENY

IF evidence.status != AVAILABLE:
    REJECT

IF relation already exists:
    RETURN existing relation

ELSE:
    CREATE relation
```

---

## 52.3 Generate Excel Evidence Link

```pseudo
FOR each activity:
    FOR each evidence:
        IF PHOTO:
            IF evidence.status == AVAILABLE:
                resolve configured link mode
            ELSE:
                write "Evidence unavailable"

        IF GITHUB_COMMIT:
            IF commit_url exists:
                write commit URL
            ELSE:
                write cached SHA without URL
```

---

# 53. Acceptance Criteria by Core Feature

## Activity

- User can create Activity without Todo.
- User can create Activity with photo + short note.
- Activity belongs only to authenticated user.
- Double submit does not create duplicate.
- Draft survives accidental refresh where feasible.

## Photo

- Photo stored in Drive.
- Metadata stored in Supabase.
- Other users cannot list/view photo.
- Broken Drive file does not crash app.
- Failed metadata write does not silently orphan file.

## Todo

- Card can be dragged.
- Invalid transition rejected.
- Evidence-required transition cannot pass without valid evidence.
- Transition history saved.
- Mobile has non-drag fallback.

## GitHub

- Connection optional.
- User can select commits.
- Selected commit becomes evidence.
- Revoked GitHub does not delete historical evidence.

## Report

- Activity shown as logbook rows.
- Excel can be generated for date range.
- Photo evidence represented by link.
- GitHub evidence represented by commit link.
- User only exports own data.

---

# 54. Suggested MVP Scope

## MVP-1
- Auth.
- User isolation.
- Activity CRUD.
- Quick Activity.
- Photo upload to Drive.
- Evidence Library.
- Logbook table.
- Excel export.

## MVP-2
- Todo Kanban.
- Evidence gating.
- transition history.
- Activity from Todo.

## MVP-3
- GitHub OAuth.
- Commit sync.
- Commit evidence picker.

## MVP-4
- supervisor review.
- advanced reminders.
- AI writing assistance.
- analytics.

---

# 55. Recommended Pages

```text
/login
/dashboard

/activities
/activities/new
/activities/:id

/todos
/todos/:id

/evidence
/evidence/photos

/logbook

/reports

/integrations/github

/settings/profile
/settings/privacy
```

---

# 56. UI Component Requirements

All reusable components must consume global design tokens defined in Section 9 and must not create an independent visual language.

Component implementation baseline:
- shadcn/ui primitive where appropriate,
- Tailwind CSS variants,
- Lucide icon set,
- semantic color tokens,
- responsive behavior defined per component,
- loading/disabled/error/focus states included before component is considered complete.

Reusable components:

- ActivityCard
- ActivityForm
- QuickCaptureModal
- PhotoUploader
- UploadProgress
- EvidencePicker
- EvidenceCard
- KanbanBoard
- KanbanColumn
- TodoCard
- TodoDetailDrawer
- GitHubCommitPicker
- LogbookTable
- DateRangeFilter
- ExportDialog
- ConfirmDialog
- ConflictDialog
- OfflinePendingBadge

---

# 57. Analytics / Product Telemetry

Optional but useful:

Track:
- Activity create success/failure,
- upload failure,
- Todo transition failure reasons,
- export success,
- GitHub sync failure.

Do not collect photo contents in analytics.

---

# 58. Observability

Server errors should include:
- request ID,
- user ID internally,
- endpoint,
- dependency,
- error code.

User sees only safe reference:
`Terjadi kesalahan. Kode: ABC123`

---

# 59. Data Retention

Must define before production:

- duration evidence kept,
- deleted data grace period,
- what happens after internship ends,
- whether Drive files archived.

Recommended:
soft deleted records retained for configurable period before permanent cleanup.

---

# 60. Backup / Recovery

Supabase:
- database backup strategy based on available plan/features.

Google Drive:
- application metadata should be sufficient to identify file references.

Application should provide reconciliation utility:
- DB photo row with missing Drive file,
- Drive orphan file not represented in DB where detectable.

---

# 61. Future Extension Rules

Architecture should allow future:
- multiple internship groups/workspaces,
- supervisor assignment,
- different report templates,
- other evidence sources such as GitLab/Jira/Figma,
- AI description generation,
- mobile PWA.

Do not hard-code GitHub as the only developer evidence provider in generic Evidence domain.

---

# 62. Definition of Done — Product Level

The product can be considered ready for first real usage when all conditions are met:

1. Ten user accounts can use the system independently.
2. User A cannot access User B photo through UI or direct API manipulation.
3. Activity can be created from mobile and desktop.
4. Photo upload succeeds to Google Drive and returns usable evidence.
5. Todo Kanban works with evidence gating.
6. GitHub can remain disconnected without affecting core flows.
7. Connected GitHub user can select commit as evidence.
8. Logbook table correctly reflects Activity data.
9. Excel export contains correct Activity descriptions and evidence links.
10. Failure of Google Drive/GitHub produces recoverable UX instead of data loss.
11. Double-submit and stale updates are handled.
12. Critical user actions have QA test coverage.

---

# 63. Pre-Production QA Checklist

## Technology / Configuration
- [ ] Next.js production build succeeds.
- [ ] TypeScript strict typecheck succeeds.
- [ ] Supabase migrations match production schema.
- [ ] RLS enabled on all user-owned tables.
- [ ] Supabase service-role key absent from client bundle.
- [ ] Google credential absent from client bundle.
- [ ] GitHub secret absent from client bundle.
- [ ] Production environment variables validated.
- [ ] Google Drive upload strategy tested against actual Vercel limits.
- [ ] Excel generation tested on production-like runtime.
- [ ] Design tokens are applied globally; no major component uses rogue brand colors.
- [ ] Blue/white contrast passes accessibility checks for primary flows.


## Authentication
- [ ] Login valid.
- [ ] Login invalid.
- [ ] Session expiry.
- [ ] Logout.
- [ ] Draft restore after login expiration.

## Authorization
- [ ] User A cannot access User B Activity.
- [ ] User A cannot access User B Todo.
- [ ] User A cannot access User B Evidence.
- [ ] guessed UUID does not leak data.

## Activity
- [ ] Create text only.
- [ ] Create photo only quick capture.
- [ ] Create photo + description.
- [ ] Double submit.
- [ ] edit conflict.
- [ ] soft delete.

## Photo
- [ ] JPEG.
- [ ] PNG.
- [ ] WEBP.
- [ ] oversized.
- [ ] corrupted.
- [ ] wrong MIME.
- [ ] interrupted upload.
- [ ] Drive failure.
- [ ] DB failure after Drive upload.
- [ ] external Drive deletion.

## Todo
- [ ] valid drag.
- [ ] invalid drag.
- [ ] evidence-gated drag.
- [ ] mobile move menu.
- [ ] concurrent change.
- [ ] history record.
- [ ] evidence removed after DONE.

## GitHub
- [ ] not connected.
- [ ] connect.
- [ ] sync.
- [ ] select commit.
- [ ] duplicate attach.
- [ ] token revoked.
- [ ] repo unavailable.
- [ ] rate limit.

## Excel
- [ ] valid date range.
- [ ] no data.
- [ ] photo link.
- [ ] GitHub link.
- [ ] broken evidence.
- [ ] formula injection.
- [ ] long description.
- [ ] multi-evidence.

---

# 64. Final Product Flow

```text
USER LOGIN
    |
    v
DASHBOARD
    |
    +----------------------------+
    |                            |
    v                            v
QUICK ACTIVITY                 TODO BOARD
    |                            |
    |                       Drag process
    |                            |
    |                      Evidence gates
    |                            |
    +-----------+----------------+
                |
                v
           EVIDENCE LAYER
        /         |          \
     PHOTO      GITHUB       LINK
       |           |
 Google Drive   Optional
        \         /
         \       /
          v     v
           ACTIVITY
              |
              v
           LOGBOOK
              |
              v
        EXCEL / REPORT
```

---

# 64.1 Architecture & Design Baseline Added in v1.1

Version 1.1 menetapkan baseline yang sebelumnya belum eksplisit:

- Next.js + React + TypeScript,
- Tailwind CSS + shadcn/ui + Lucide,
- Supabase Auth + PostgreSQL + RLS,
- Google Drive API sebagai storage evidence utama,
- GitHub integration opsional,
- dnd-kit untuk Todo Kanban,
- ExcelJS untuk export,
- Vercel untuk deployment,
- GitHub untuk source control,
- global brand biru-putih dengan `#2563EB` sebagai primary blue baseline,
- light mode sebagai MVP,
- design token wajib dan warna hardcoded dilarang pada component umum.

---

# 65. Final Product Principle

Sistem tidak boleh membuat user bekerja untuk logbook.

Sistem harus menangkap pekerjaan user sedikit demi sedikit, menyimpan evidence dengan aman, lalu mengubah data tersebut menjadi logbook ketika dibutuhkan.

**Activity is the source of truth.  
Todo is an optional workflow helper.  
Evidence proves work.  
GitHub is optional evidence.  
Google Drive stores files.  
Supabase controls identity and structured data.  
Reports are generated outputs.**
