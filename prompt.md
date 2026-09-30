Anda adalah **Senior Full-Stack Engineer, Software Architect, UI/UX Engineer, Database Engineer, Security Engineer, dan QA Engineer** yang bertanggung jawab membangun aplikasi bernama **InternFlow** berdasarkan PRD yang tersedia di repository.

Baca terlebih dahulu seluruh file:

`PRD_Internship_Activity_Evidence_Logbook_System_v1.1.md`

Jadikan PRD tersebut sebagai **single source of truth** untuk:
- business rule,
- permission,
- data ownership,
- workflow,
- validation,
- error handling,
- state transition,
- defect handling,
- UI/UX,
- security,
- dan acceptance criteria.

Jangan menghilangkan requirement hanya untuk mempercepat implementasi.

Jika ditemukan bagian PRD yang ambigu, gunakan keputusan teknis yang:
1. paling aman terhadap data,
2. paling sederhana untuk dipelihara,
3. tidak merusak requirement utama,
4. scalable untuk minimal 10 user,
5. dan dokumentasikan keputusan tersebut.

Jangan membuat fitur di luar scope secara berlebihan.

---

# TUJUAN PRODUK

Bangun responsive web application untuk pencatatan aktivitas magang.

Masalah utama yang diselesaikan:

- user sering lupa mencatat pekerjaan;
- pekerjaan sebenarnya banyak tetapi logbook tidak terisi;
- foto dokumentasi memenuhi storage HP;
- evidence pekerjaan tersebar;
- pekerjaan coding sulit dicari kembali;
- pembuatan laporan dilakukan secara manual.

Konsep utama:

`Activity` adalah pusat sistem.

Todo bukan requirement untuk membuat Activity.

GitHub juga bukan requirement untuk menggunakan aplikasi.

Flow utamanya:

User bekerja  
→ mencatat Activity  
→ menambahkan Evidence  
→ Activity masuk logbook  
→ data dapat diekspor menjadi Excel.

Evidence dapat berasal dari:

- foto;
- GitHub commit;
- link;
- source evidence lain yang dapat dikembangkan kemudian.

Todo hanya berfungsi sebagai workflow helper.

---

# NAMA APLIKASI

Gunakan:

**InternFlow**

Repository dapat menggunakan:

`internflow`

---

# TARGET PLATFORM

Aplikasi harus berupa:

**Responsive Web Application**

Harus nyaman digunakan pada:

- smartphone;
- tablet;
- laptop;
- desktop.

Mobile bukan sekadar desktop layout yang diperkecil.

Prioritaskan mobile-first karena pencatatan cepat dan upload foto kemungkinan besar dilakukan melalui HP.

Desktop digunakan untuk:

- review Activity;
- pengelolaan Todo;
- melihat Evidence;
- logbook;
- editing detail;
- dan generate laporan.

---

# TECH STACK WAJIB

Gunakan stack berikut kecuali terdapat alasan teknis yang sangat kuat untuk tidak menggunakannya.

## Frontend / Full-stack Framework

- Next.js
- App Router
- React
- TypeScript strict mode

Jangan menggunakan JavaScript biasa untuk source utama.

---

## Styling

Gunakan:

- Tailwind CSS
- shadcn/ui
- Lucide React untuk icon

Gunakan reusable component.

Jangan membuat setiap halaman mempunyai button/input/card sendiri-sendiri apabila bisa menggunakan global component.

---

## Form

Gunakan:

- React Hook Form
- Zod

Zod menjadi schema validation untuk input penting.

Validasi frontend tidak menggantikan validasi server.

Semua business rule penting harus divalidasi kembali server-side.

---

## Drag and Drop

Gunakan:

`dnd-kit`

Digunakan untuk Todo Kanban.

Drag-and-drop harus mempunyai fallback untuk mobile:

`Pindahkan ke...`

karena fitur inti tidak boleh bergantung pada drag gesture saja.

---

## Database & Authentication

Gunakan:

**Supabase**

Komponen:

- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security / RLS

Supabase menjadi tempat:

- user;
- profile;
- Activity;
- Todo;
- Todo Stage;
- Todo Transition;
- Evidence metadata;
- GitHub metadata/cache;
- relationship Activity-Evidence;
- relationship Todo-Evidence;
- audit metadata;
- konfigurasi sistem yang diperlukan.

---

# STORAGE FOTO

JANGAN menggunakan Supabase Storage sebagai storage utama foto.

Gunakan:

**Google Drive API**

Google Drive bertindak sebagai central evidence storage.

Foto asli disimpan di Google Drive.

Supabase hanya menyimpan metadata seperti:

- owner;
- evidence ID;
- Google Drive file ID;
- file name;
- MIME;
- size;
- checksum;
- upload status;
- captured date;
- relationship Activity/Todo.

Google Drive menggunakan kapasitas akun Drive utama yang telah disediakan.

---

# GOOGLE DRIVE SECURITY

Google Drive tidak boleh menjadi authorization layer utama.

Jangan membagikan folder Drive utama kepada 10 user.

User mengakses foto melalui aplikasi.

Contoh:

User A upload foto A.

Database:

photo.user_id = User A.

Ketika User A meminta foto:

server:

1. validasi session;
2. ambil user ID dari session;
3. cek ownership metadata;
4. apabila owner sama, ambil file dari Drive;
5. apabila berbeda, tolak.

User B tidak boleh dapat melihat foto User A walaupun mengetahui:

- ID evidence;
- URL internal;
- UUID;
- Google Drive file ID.

Cegah IDOR.

Jangan percaya `user_id` yang dikirim frontend.

Owner harus berasal dari authenticated session:

`auth.uid()`.

---

# GITHUB

Integrasi GitHub bersifat:

**OPTIONAL**

Aplikasi harus tetap berfungsi penuh apabila user tidak pernah menghubungkan GitHub.

Jika user memilih Connect GitHub:

gunakan:

- GitHub OAuth;
- GitHub API.

Request permission seminimal mungkin.

Untuk MVP, kita hanya membutuhkan read access terhadap informasi yang diperlukan.

Jangan meminta permission write ke repository apabila tidak diperlukan.

---

# GITHUB EVIDENCE FLOW

GitHub tidak boleh otomatis memasukkan seluruh commit ke logbook.

Flow:

Connect GitHub  
→ Sync repository/commit  
→ tampilkan Commit Picker  
→ user memilih commit  
→ commit menjadi Evidence  
→ Evidence dapat ditempelkan ke Activity/Todo.

Contoh:

Repository:
`internflow`

Commit:

`a82d1fe`

`feat: implement photo evidence upload`

User dapat memilih:

`Jadikan Evidence`

Metadata minimal yang disimpan:

- GitHub user ID;
- username;
- repository ID;
- repository name;
- SHA;
- message;
- commit date;
- commit URL;
- source status;
- sync timestamp.

Jangan copy seluruh source code repository ke database.

---

# DESIGN SYSTEM

Gunakan desain:

**Blue + White**

Biru adalah warna dominan.

Gunakan UI modern, bersih, profesional, dan terasa seperti productivity application.

Hindari desain terlalu ramai.

---

# GLOBAL COLOR

Primary:

`#2563EB`

Blue 600.

Gunakan sebagai warna utama:

- primary button;
- active navigation;
- link;
- focus;
- selected state;
- progress;
- important accent;
- sidebar/header branding.

Palette:

Blue 50:
`#EFF6FF`

Blue 100:
`#DBEAFE`

Blue 200:
`#BFDBFE`

Blue 300:
`#93C5FD`

Blue 400:
`#60A5FA`

Blue 500:
`#3B82F6`

Blue 600:
`#2563EB`

Blue 700:
`#1D4ED8`

Blue 800:
`#1E40AF`

Blue 900:
`#1E3A8A`

---

# NEUTRAL COLOR

White:

`#FFFFFF`

Main application background:

`#F8FAFC`

Primary surface:

`#FFFFFF`

Border:

`#E2E8F0`

Primary text:

`#0F172A`

Secondary text:

`#475569`

Muted text:

`#64748B`

---

# SEMANTIC COLOR

Semantic color diperbolehkan walaupun branding utama biru.

Success:
hijau.

Warning:
amber/orange.

Error:
merah.

Info:
biru.

Jangan menggunakan warna sebagai satu-satunya indikator status.

Gunakan icon/text juga.

Contoh:

jangan hanya:

`merah`

tetapi:

`⚠ Upload gagal`

---

# COLOR IMPLEMENTATION RULE

Semua warna harus menjadi design token.

Jangan hardcode warna berkali-kali di component.

Definisikan secara global.

Contoh semantic token:

- background
- foreground
- primary
- primary-foreground
- secondary
- muted
- border
- destructive
- success
- warning

Apabila theme berubah, component tidak perlu diedit satu per satu.

---

# UI STYLE

Gunakan:

- border radius konsisten;
- white card;
- subtle shadow;
- blue accent;
- whitespace cukup;
- typography jelas;
- tidak terlalu banyak border tebal.

Card harus mudah dipindai.

CTA utama harus jelas.

Primary CTA maksimal satu yang paling dominan dalam satu context.

---

# APPLICATION SHELL

Desktop:

Sidebar kiri.

Contoh menu:

- Dashboard
- Activity
- Todo
- Evidence
- Logbook
- Reports
- Integrasi
- Settings

Mobile:

gunakan bottom navigation untuk menu utama.

Contoh:

- Home
- Activity
- Todo
- Evidence
- More

Header mobile dibuat compact.

---

# AUTHENTICATION

Implementasikan menggunakan Supabase Auth.

Minimal:

- login;
- logout;
- session handling;
- protected route.

Jika session expired saat user sedang menulis Activity:

IF draft belum tersimpan

THEN:

- simpan local draft;
- arahkan login;
- setelah login berhasil tawarkan restore draft.

Jangan kehilangan tulisan user karena session timeout.

---

# USER ISOLATION

Sistem awal digunakan sekitar 10 user.

Semua data private harus mempunyai owner.

Contoh:

activities.user_id

todos.user_id

evidences.user_id

github_connections.user_id

Setiap user secara default hanya boleh membaca data miliknya.

Gunakan RLS.

Jangan hanya mengandalkan:

```typescript
.eq("user_id", user.id)
```

dari frontend.

Database harus tetap memblokir access apabila frontend dimanipulasi.

---

# ACTIVITY

Activity merupakan core entity.

Activity dapat dibuat:

1. manual;
2. Quick Activity;
3. dari Todo.

Todo tidak wajib.

---

# QUICK ACTIVITY

Ini merupakan salah satu fitur terpenting.

User pada HP harus dapat:

1. tekan `+ Activity`;
2. ambil/pilih foto;
3. tulis keterangan singkat;
4. save.

Buat flow secepat mungkin.

Target:

< 15 detik untuk pencatatan sederhana.

Allowed:

- teks saja;
- foto saja;
- foto + teks.

Jika foto saja:

buat placeholder seperti:

`Aktivitas tanpa judul`

dan tandai:

`NEEDS_DESCRIPTION`

agar user bisa melengkapinya nanti.

---

# ACTIVITY FIELD

Minimal:

- id;
- user_id;
- title;
- description;
- activity_date;
- start_time;
- end_time;
- source;
- todo_id nullable;
- status;
- version;
- created_at;
- updated_at;
- deleted_at.

Owner tidak boleh dapat diubah.

---

# ACTIVITY STATUS

Jangan membuat Activity serumit Todo.

Gunakan:

- DRAFT
- READY
- ARCHIVED

Todo yang mempunyai workflow process.

Activity adalah journal pekerjaan.

---

# ACTIVITY DATE

Gunakan user timezone.

Database timestamp tetap UTC.

Jangan membuat bug:

user tanggal 30 September pukul malam tetapi Activity masuk 29 September karena UTC conversion.

`activity_date` harus merepresentasikan tanggal kerja user.

---

# AUTOSAVE

Pada form Activity:

jika form dirty:

autosave local draft kira-kira setiap 3–5 detik.

Jika browser close/reload sebelum submit:

ketika kembali:

`Draft aktivitas sebelumnya ditemukan.`

Actions:

- Pulihkan
- Hapus Draft

---

# DOUBLE SUBMISSION

Semua create penting harus tahan double click.

Frontend:

disable button ketika submitting.

Backend:

gunakan idempotency key.

IF request yang sama terkirim dua kali

THEN:

return hasil pertama.

Jangan membuat Activity duplicate.

---

# CONCURRENT EDIT

Activity/Todo menggunakan:

`version`

untuk optimistic locking.

Example:

Client membuka version 3.

Perangkat lain update menjadi version 4.

Client pertama mencoba update version 3.

Server:

return conflict.

UI:

`Data ini telah diperbarui dari perangkat lain.`

Actions:

- Muat versi terbaru
- Simpan sebagai salinan jika relevan

Jangan silently overwrite.

---

# EVIDENCE

Evidence menjadi generic domain.

Types MVP:

- PHOTO
- GITHUB_COMMIT
- LINK

Future:

- FILE
- DOCUMENT
- GITHUB_PR
- GITHUB_ISSUE
- VIDEO
- other providers.

Jangan merancang Evidence hanya khusus GitHub.

---

# EVIDENCE STATE

Gunakan minimal:

- UPLOADING
- AVAILABLE
- FAILED
- ORPHANED
- BROKEN
- DELETED

Evidence hanya dapat memenuhi completion gate jika valid.

Default valid state:

`AVAILABLE`

UPLOADING tidak dihitung sebagai completed evidence.

FAILED tidak dihitung.

BROKEN tidak dihitung sebagai evidence valid untuk gate.

---

# PHOTO UPLOAD

Flow:

User pilih foto  
→ preview  
→ client validation  
→ authenticated server endpoint  
→ server validation  
→ upload Google Drive  
→ Drive mengembalikan file ID  
→ insert metadata Supabase  
→ return Evidence AVAILABLE.

Tampilkan upload progress.

Jangan mengatakan upload sukses sebelum:

Drive sukses

DAN

metadata Supabase sukses.

---

# PHOTO FORMAT

MVP:

- JPEG;
- PNG;
- WEBP.

HEIC:

implementasikan behavior deterministik.

Prefer:

HEIC → convert JPEG jika memungkinkan.

Pertahankan captured timestamp jika dapat dilakukan.

---

# PHOTO SIZE

Gunakan configurable max size.

Initial target:

15 MB per foto.

Foto besar dapat dikompresi.

Tetapi:

screenshot berisi teks jangan dikompresi sampai tidak terbaca.

---

# DUPLICATE PHOTO

Jika checksum foto yang sama sudah ada untuk user tersebut:

tampilkan:

`Foto yang sama tampaknya sudah pernah diunggah.`

Actions:

- Gunakan yang sudah ada
- Upload lagi

Jangan memblokir absolut.

---

# GOOGLE DRIVE FAILURE

Implementasikan failure handling secara eksplisit.

CASE:

Drive upload sukses.

Supabase insert gagal.

THEN:

coba hapus file Drive tadi.

IF hapus Drive juga gagal:

buat reconciliation record/log sehingga orphan dapat dibersihkan.

Jangan meninggalkan file orphan tanpa tracking.

---

# DRIVE FILE MISSING

Jika metadata Supabase ada tetapi Drive mengembalikan 404:

set evidence:

`BROKEN`

UI jangan crash.

Tampilkan placeholder:

`Evidence tidak tersedia.`

Actions:

- ganti evidence;
- detach;
- hapus metadata jika sesuai.

---

# EVIDENCE LIBRARY

Buat halaman Evidence.

User hanya melihat Evidence sendiri.

Filters:

- semua;
- foto;
- GitHub;
- link;
- tanggal;
- assigned;
- unassigned;
- broken.

Photo card:

- thumbnail;
- tanggal;
- assigned state;
- status.

GitHub card:

- repo;
- SHA singkat;
- commit message;
- date.

Evidence dapat dipilih untuk ditempel ke Activity.

---

# TODO

Todo adalah fitur tambahan.

Tidak wajib untuk membuat Activity.

Todo cocok untuk pekerjaan yang mempunyai progress.

Gunakan Kanban.

Default:

BACKLOG  
→ TO DO  
→ IN PROGRESS  
→ REVIEW  
→ DONE

Namun desain database Todo Stage dibuat data-driven agar bisa dikembangkan.

---

# TODO DRAG AND DROP

Desktop:

drag card antar-column.

Valid drop target:

highlight.

Invalid target:

disable/dim.

Jika user drop ke transition ilegal:

animate kembali.

Tampilkan alasan.

Contoh:

`Todo tidak dapat langsung dipindahkan dari Backlog ke Done.`

---

# TODO MOBILE

Support drag-and-drop.

Tetapi WAJIB memiliki action:

`Pindahkan ke...`

Jangan membuat user mobile harus drag card untuk menjalankan fitur.

---

# EVIDENCE GATE

Todo process dapat meminta evidence.

Stage mempunyai configuration:

- requires_evidence_on_enter;
- requires_evidence_on_exit;
- minimum_evidence_count;
- allowed_evidence_types;
- requires_note;
- is_terminal.

Default behavior:

BACKLOG → TO DO

evidence tidak wajib.

TO DO → IN PROGRESS

evidence tidak wajib.

IN PROGRESS → REVIEW

minimal 1 valid evidence.

REVIEW → DONE

minimal 1 valid evidence dan seluruh completion rule terpenuhi.

---

# TODO COMPLETE RULE

Pseudo logic:

```text
IF todo owner != current user
    DENY

IF transition invalid
    REJECT

IF target requires evidence
    CHECK valid evidence

IF valid evidence < minimum
    REJECT
    SHOW evidence picker

ELSE
    UPDATE stage
    WRITE transition history
```

Validation harus dilakukan server-side.

Drag UI bukan source of truth.

---

# TODO TRANSITION HISTORY

Setiap perpindahan harus dicatat.

Minimal:

- todo_id;
- from stage;
- to stage;
- user;
- timestamp;
- evidence count;
- note;
- idempotency key.

History immutable.

Jika Todo dipindahkan kembali:

buat transition record baru.

Jangan edit history lama.

---

# TODO EVIDENCE PER PROCESS

Evidence dapat ditempelkan pada stage tertentu.

Contoh:

Todo:
`Implementasi Dashboard`

IN PROGRESS:
screenshot development.

REVIEW:
GitHub commit.

DONE:
screenshot final result.

Sehingga evidence dapat membuktikan proses pekerjaan.

---

# TODO → ACTIVITY

Tambahkan action:

`Buat Activity`

Prefill:

- title Todo;
- Todo description;
- current date;
- todo reference.

User tetap dapat mengedit sebelum save.

Todo description hanya menjadi prefill.

Setelah Activity tersimpan:

Activity memiliki description sendiri.

Jika Todo description diubah kemudian:

jangan otomatis mengubah Activity lama.

---

# ACTIVITY ↔ TODO

Satu Todo dapat mempunyai:

- 0 Activity;
- 1 Activity;
- banyak Activity.

Satu Activity dapat mempunyai Todo reference nullable.

Delete Todo tidak boleh otomatis menghapus Activity.

Gunakan soft delete untuk Todo.

---

# LOGBOOK

Logbook dibentuk dari Activity.

Bukan dari Todo.

Buat table:

- No
- Tanggal
- Waktu
- Aktivitas
- Keterangan
- Evidence

Filters:

- tanggal;
- date range;
- bulan;
- keyword;
- evidence type.

---

# MISSING DAY

Jika internship period tersedia:

deteksi hari kerja yang tidak mempunyai Activity.

Display:

`Belum ada Activity`

Jangan otomatis menganggap Sabtu/Minggu sebagai hari kerja.

Working days harus configurable.

---

# EXCEL EXPORT

Gunakan:

`ExcelJS`

Generate `.xlsx`.

User memilih:

- start date;
- end date;
- include evidence;
- optional Todo sheet.

---

# EXCEL SHEET 1

`Logbook`

Columns:

- No
- Tanggal
- Jam Mulai
- Jam Selesai
- Aktivitas
- Keterangan
- Evidence

---

# EXCEL SHEET 2

`Evidence Detail`

Columns:

- Evidence ID
- Activity ID
- Tanggal
- Type
- Nama/Judul
- URL
- Status

---

# EXCEL SHEET 3

Optional:

`Todo`

Columns:

- Todo
- Priority
- Due Date
- Status
- Completed At
- Related Activity
- Evidence Count

---

# FOTO PADA EXCEL

Jangan embed seluruh foto sebagai gambar pada Excel secara default.

Gunakan link.

Format:

`Foto 1`

→ link.

`Foto 2`

→ link.

GitHub:

`Commit a31f82c`

→ GitHub commit URL.

---

# DRIVE LINK PRIVACY

Jangan otomatis menjadikan semua foto:

`Anyone with the link`.

Default lebih aman:

`APP_PRIVATE`.

Jika suatu saat user ingin external reviewer dapat membuka link Drive langsung, buat explicit flow.

Jangan mengubah sharing permission diam-diam.

---

# EXCEL SECURITY

Protect terhadap formula injection.

Jika user input dimulai:

- =
- +
- -
- @

dan itu dimaksudkan sebagai teks:

escape sehingga Excel tidak mengeksekusi formula.

---

# REPORT EMPTY

Jika date range tidak mempunyai Activity:

jangan generate report kosong tanpa informasi.

Tampilkan:

`Tidak ada Activity pada rentang tanggal tersebut.`

---

# DATABASE

Gunakan schema PRD sebagai baseline.

Minimal table:

- profiles
- activities
- todos
- todo_stages
- todo_transitions
- evidences
- photo_evidences
- github_connections
- github_commits
- activity_evidences
- todo_evidences
- audit_logs jika diperlukan.

Gunakan foreign key.

Gunakan index pada query penting.

Gunakan unique constraint untuk mencegah duplicate relationship.

---

# SUPABASE RLS

RLS WAJIB aktif pada seluruh user-owned table.

Contoh conceptual:

SELECT Activity:

```sql
user_id = auth.uid()
```

INSERT Activity:

owner harus:

```sql
user_id = auth.uid()
```

UPDATE/DELETE:

owner sama.

Relationship juga harus divalidasi.

User A tidak boleh memasangkan:

Activity User A

dengan:

Evidence User B.

Server/database harus menolak.

---

# SOFT DELETE

Gunakan soft delete untuk data yang mempunyai historical relationship:

- Activity;
- Todo;
- Evidence.

Jangan langsung hard-delete.

Field:

`deleted_at`.

Default query tidak menampilkan deleted item.

---

# AUDIT

Catat mutation penting:

- create Activity;
- update Activity;
- delete Activity;
- Todo transition;
- attach evidence;
- detach evidence;
- GitHub connection;
- export report.

Jangan simpan secret pada audit log.

---

# ERROR HANDLING

Bedakan:

Validation error.

Authorization error.

External service failure.

Conflict.

Unknown server error.

User message harus manusiawi dan Bahasa Indonesia.

Jangan tampilkan stack trace.

Unknown error dapat mempunyai safe reference ID.

Contoh:

`Terjadi kesalahan. Kode referensi: ABC123`

---

# WEAK NETWORK

Aplikasi tidak wajib full offline pada MVP.

Tetapi:

- text draft tidak boleh mudah hilang;
- failed submission harus retryable;
- upload status jelas;
- user harus tahu data sudah server-saved atau belum.

State:

`Menyimpan...`

`Tersimpan`

`Belum tersinkron`

Jangan tampilkan:

`Tersimpan`

sebelum server mengonfirmasi.

---

# DEFECT HANDLING

Implementasikan business defect dari PRD.

Jangan hanya implement happy path.

Minimal tangani:

1. double Activity submission;
2. Drive sukses tetapi DB gagal;
3. DB ada tetapi Drive file hilang;
4. Todo dipindah tanpa evidence;
5. GitHub token revoked;
6. GitHub rate limit;
7. user menebak ID foto user lain;
8. Todo diedit dua device;
9. browser tertutup saat form;
10. upload terputus;
11. evidence Todo DONE kemudian hilang;
12. empty report;
13. Excel formula injection;
14. timezone;
15. duplicate photo;
16. GitHub disconnect;
17. commit deleted/force pushed;
18. double drag event;
19. evidence masih UPLOADING;
20. session expired saat edit;
21. malicious filename;
22. oversized image;
23. MIME mismatch;
24. Activity delete dengan reused evidence;
25. Google Drive unavailable;
26. private evidence link;
27. accidental drag mobile;
28. overdue Todo;
29. future Activity;
30. multiple export clicks.

Untuk setiap implementation:

pikirkan:

```text
IF success
    normal flow

ELSE IF known business error
    show specific recoverable UI

ELSE IF dependency error
    retain user state and allow retry

ELSE
    log safely and show generic error
```

---

# LOADING STATE

Jangan membuat UI blank saat loading.

Gunakan:

- skeleton;
- spinner pada button;
- upload progress;
- disabled state.

Hindari global spinner untuk interaction kecil.

---

# EMPTY STATE

Setiap halaman harus mempunyai empty state.

Activity:

`Belum ada aktivitas.`

CTA:

`Tambah Activity`

Evidence:

`Belum ada evidence.`

Todo:

`Belum ada Todo.`

CTA:

`Buat Todo`

GitHub:

`GitHub belum terhubung.`

CTA:

`Hubungkan GitHub`

---

# DELETE CONFIRMATION

Destructive operation harus mempunyai confirmation sesuai dampak.

Contoh:

Evidence digunakan 3 Activity.

Jangan hanya:

`Apakah yakin?`

Tampilkan:

`Foto ini sedang digunakan oleh 3 Activity. Jika dihapus, evidence pada Activity tersebut akan hilang.`

Actions:

- Batal
- Lepaskan
- Hapus

Gunakan destructive styling merah.

---

# ACCESSIBILITY

Pastikan:

- focus state;
- keyboard navigation;
- button accessible name;
- aria label untuk icon-only button;
- drag mempunyai keyboard/fallback alternative;
- error message terhubung ke field;
- touch target cukup besar.

---

# PERFORMANCE

Target awal 10 user.

Tetapi jangan membuat desain yang hanya bisa menangani tepat 10 user.

Metadata interaction target:

< 2 detik pada kondisi normal.

Gallery:

- thumbnail;
- lazy load;
- pagination/infinite list jika dibutuhkan.

Jangan load foto full resolution di gallery grid.

---

# DATE/TIME

Internal timestamp:

UTC.

Display:

user timezone.

Default:

Asia/Jakarta apabila project memang hanya digunakan di WIB, tetapi tetap simpan timezone profile agar tidak hardcoded ke semua logic.

---

# ENVIRONMENT VARIABLES

Pisahkan:

local

preview

production.

Jangan commit `.env`.

Buat:

`.env.example`

tanpa secret value.

Variable minimal mengikuti kebutuhan:

Supabase:
- public URL;
- anon/public key;
- server service role hanya jika memang diperlukan pada trusted server.

Google:
- OAuth/client credentials;
- refresh credential/session mechanism;
- Drive folder configuration.

GitHub:
- client ID;
- client secret;
- callback URL.

Application:
- site URL;
- environment;
- relevant config.

Jangan pernah expose:

- Supabase service role key;
- Google refresh token;
- GitHub access token;
- OAuth client secret

ke browser bundle.

---

# VERCEL

Deployment target:

Vercel.

Pastikan:

- Next.js compatible;
- environment variable compatible;
- server route compatible;
- API upload strategy sesuai limit runtime;
- production URL/callback OAuth configured dengan benar.

Jangan mengasumsikan file upload besar selalu aman melewati satu standard request tanpa mengecek batas deployment architecture.

Jika direct/resumable strategy lebih baik untuk Google Drive, implementasikan secara aman.

---

# CODE QUALITY

Wajib:

- TypeScript strict;
- no careless `any`;
- reusable components;
- clear separation UI/domain/server/integration;
- schema validation;
- meaningful naming;
- no secret hardcode;
- no enormous monolithic component;
- no duplicated business rule di banyak file apabila bisa dibuat centralized service/function.

Pisahkan integration:

```text
lib/
  supabase/
  google-drive/
  github/
  excel/
```

Domain:

```text
features/
  activity/
  evidence/
  todo/
  logbook/
  integrations/
```

Struktur akhir dapat disesuaikan dengan Next.js best practice selama separation of concern jelas.

---

# TESTING

Gunakan:

- Vitest;
- React Testing Library;
- Playwright.

Test minimal:

## Unit

- evidence gate;
- transition validation;
- date logic;
- export sanitization;
- ownership helper;
- duplicate/idempotency logic.

## Integration

- Supabase user isolation;
- Activity CRUD;
- Evidence attachment;
- Todo transition;
- GitHub cached evidence behavior;
- upload error state.

## E2E

1. Login.
2. Create Activity.
3. Upload photo.
4. Attach photo.
5. Open logbook.
6. Create Todo.
7. Drag Todo.
8. Fail transition because no evidence.
9. Add evidence.
10. Move successfully.
11. Connect/simulate GitHub integration.
12. Attach commit.
13. Generate Excel.
14. Verify another user cannot access first user's photo.

---

# IMPLEMENTATION ORDER

Jangan membangun semua fitur secara acak.

Ikuti urutan:

## PHASE 0 — Foundation

- initialize Next.js;
- TypeScript;
- Tailwind;
- shadcn/ui;
- design tokens;
- application shell;
- environment validation;
- Supabase client/server setup.

---

## PHASE 1 — Auth + Database Security

- Supabase Auth;
- profiles;
- protected routes;
- schema;
- migration;
- RLS;
- ownership tests.

Jangan lanjut ke fitur private data sebelum RLS dasar selesai.

---

## PHASE 2 — Activity Core

- Activity CRUD;
- Quick Activity;
- mobile UI;
- draft;
- idempotency;
- optimistic locking;
- Activity table.

---

## PHASE 3 — Google Drive Photo Evidence

- uploader;
- Drive server integration;
- evidence metadata;
- thumbnail/display;
- ownership check;
- Evidence Library;
- attach/detach Activity;
- failure/reconciliation behavior.

---

## PHASE 4 — Logbook

- Activity-based logbook;
- filter;
- missing-day indicator;
- evidence list.

---

## PHASE 5 — Excel Export

- ExcelJS;
- logbook sheet;
- evidence sheet;
- links;
- sanitization;
- date filter.

---

## PHASE 6 — Todo Kanban

- Todo CRUD;
- stages;
- dnd-kit;
- mobile fallback;
- transition rules;
- evidence gate;
- transition history;
- Todo → Activity helper.

---

## PHASE 7 — GitHub

- OAuth;
- connection state;
- sync;
- repository filter;
- commit picker;
- attach evidence;
- revoked/rate-limit handling.

---

## PHASE 8 — Hardening

- defect matrix;
- edge cases;
- accessibility;
- mobile;
- performance;
- security;
- E2E;
- error observability.

---

# WORKING METHOD

Sebelum coding:

1. baca seluruh PRD;
2. pahami domain;
3. buat implementation checklist;
4. identifikasi database migration;
5. identifikasi environment variables;
6. identifikasi dependency;
7. identifikasi security boundary.

Kemudian implementasikan phase-by-phase.

Setelah setiap phase:

1. lint;
2. typecheck;
3. test;
4. audit business rule;
5. audit responsive layout;
6. pastikan tidak merusak phase sebelumnya.

Jangan menunda seluruh testing sampai akhir.

---

# IMPORTANT

Jangan membuat mock-only application dan menganggap pekerjaan selesai.

UI harus dihubungkan dengan real domain logic secara bertahap.

Jika credential Google/GitHub belum tersedia:

buat integration boundary/interface dan development mock yang mudah diganti.

Tetapi jangan mengubah architecture menjadi mock permanent.

---

# DATABASE FIRST RULE

Sebelum membuat UI yang mengandalkan:

- Activity;
- Todo;
- Evidence;
- ownership;

pastikan schema dan RLS sudah dirancang.

Jangan membuat authorization hanya di frontend.

---

# DO NOT DO

Jangan:

- menyimpan foto utama ke Supabase Storage tanpa alasan;
- membuat Drive folder public secara otomatis;
- membiarkan user memilih user_id sendiri;
- mengekspos service role key;
- mengekspos Google token;
- mengekspos GitHub token;
- mengandalkan frontend authorization;
- membuat GitHub mandatory;
- membuat Todo mandatory;
- menghasilkan logbook dari Todo;
- membuat semua commit otomatis menjadi Activity;
- membuat Todo DONE tanpa memenuhi evidence rule;
- menghapus historical evidence diam-diam;
- hardcode warna per halaman;
- membuat desain desktop-only;
- mengabaikan loading/error/empty state;
- mengabaikan defect scenario di PRD.

---

# PRIORITAS SOURCE OF TRUTH

Jika ada konflik antara asumsi Anda dengan PRD:

PRD menang.

Jika terdapat conflict antara visual convenience dengan security rule:

security rule menang.

Jika terdapat conflict antara optimistic UI dengan server state:

server/database state menang.

Jika external API gagal:

jangan mengorbankan data user.

---

# HASIL YANG SAYA INGINKAN

Saya tidak hanya ingin prototype.

Saya ingin aplikasi yang secara bertahap menjadi production-ready.

Untuk setiap phase, berikan:

1. file yang dibuat/diubah;
2. migration;
3. business logic;
4. security/RLS;
5. UI;
6. error handling;
7. test;
8. environment/config yang diperlukan;
9. hal yang belum dapat dijalankan karena credential eksternal.

Jika Anda memiliki kemampuan menjalankan terminal:

jalankan sendiri:

- install;
- lint;
- typecheck;
- test;
- build;

dan perbaiki error sebelum melanjutkan.

Jangan hanya memberi instruksi kepada saya apabila Anda dapat melakukannya sendiri.

---

# STARTING TASK

Mulai dengan:

**Phase 0 + Phase 1 terlebih dahulu.**

Kerjakan:

1. audit repository;
2. baca PRD sepenuhnya;
3. setup Next.js App Router + TypeScript;
4. setup Tailwind;
5. setup shadcn/ui;
6. setup global blue/white design system;
7. setup application structure;
8. setup Supabase;
9. buat database migration awal;
10. buat authentication;
11. buat profile;
12. implement RLS;
13. buat protected dashboard shell;
14. buat responsive desktop sidebar + mobile navigation;
15. buat environment validation;
16. buat `.env.example`;
17. tulis test kritikal untuk auth/ownership;
18. jalankan lint/typecheck/test/build.

Setelah Phase 0 + Phase 1 benar-benar stabil, lanjutkan Phase 2.

Jangan skip phase dan jangan membuat fitur berikutnya di atas foundation yang belum aman.

Tujuan akhirnya adalah membangun **InternFlow** sesuai seluruh PRD dengan arsitektur yang aman, maintainable, responsive, interaktif, dan siap digunakan oleh minimal 10 user nyata.