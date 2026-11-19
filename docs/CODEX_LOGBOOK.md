# Logbook melalui Codex

Codex menyusun laporan dalam chat menggunakan akun aplikasi: membaca Activity,
Todo, absensi, foto Library, dan commit dari repository yang disebut dalam
perintah. Backend memvalidasi sumber, mengalokasikan foto, menyimpan kegiatan,
dan membuat Excel. Tidak diperlukan API key model tambahan.

## Aktivasi

1. Terapkan migrasi baru `20261119090000_codex_logbook.sql` melalui alur migrasi
   Supabase proyek. Jangan menjalankan ulang migrasi yang sudah tercatat.
2. Jalankan aplikasi lokal atau deploy perubahan aplikasi. Environment Google
   Drive dan GitHub tetap menggunakan konfigurasi aplikasi yang sudah ada.
3. Dari root repository, jalankan `npm run logbook:login` di terminal interaktif.
   Gunakan email/password akun aplikasi; password disembunyikan. Jangan menulis
   password atau token dalam chat, JSON perintah, maupun argumen shell.
4. Konfigurasi MCP project tersedia di `.codex/config.toml`. Buka ulang project
   tepercaya/restart sesi Codex agar server `internflow` dimuat.

CLI membaca `.env.local` untuk alamat Supabase dan public anon key. Alamat
aplikasi berasal dari `LOGBOOK_APP_URL`, lalu `APP_BASE_URL`, atau dapat ditentukan
dalam `.codex/logbook.local.json`. Sesi Windows dilindungi DPAPI milik pengguna
Windows yang login; pada POSIX sesi menggunakan file mode `0600`. Sesi, hasil
Excel, screenshot, dan checkpoint berada di `.codex/local/`, diabaikan Git.
`npm run logbook -- logout` mengakhiri sesi lokal ini.

## Contoh perintah dalam chat

> Buat logbook magang bulanan Oktober 2026 untuk owner/project. Gunakan foto
> Library yang belum dipakai, cocokkan dengan kegiatan per hari. Jika kurang,
> gunakan screenshot versi commit terkait lalu diff. Simpan dan buat Excel.

> Buat laporan mingguan 2–8 November 2026 untuk owner/project.

> Lanjutkan laporan dengan requestId yang tadi terputus dan unduh Excel-nya.

Default: bahasa Indonesia, kategori `INTERNSHIP`, zona waktu profil pengguna,
minggu Senin–Minggu, bulan kalender. Rentang eksplisit dari pengguna diutamakan.
Hari mendatang tidak dibuat sebagai kegiatan dan tidak dihitung kekurangan.
Hari kerja mengikuti pengaturan magang, termasuk tanggal mulai/selesai.

## Cara Codex menjalankan alur

1. Buat UUID `requestId` dan tetapkan repository/periode dari perintah. Sinkronkan
   setiap repository dengan `logbook_sync` bila commit belum mutakhir.
2. Baca `logbook_context`; lanjutkan halaman sampai seluruh bagian
   `hasMore=false`. Context mencakup kegiatan kanonis dan ID buktinya.
3. Pilih kegiatan relevan dengan project. Pertahankan kegiatan yang sudah ada,
   termasuk judul/catatan manual dan versinya. Jangan menganggap Todo yang belum
   dikerjakan atau absensi saja sebagai bukti pekerjaan selesai.
4. Periksa kandidat dengan `logbook_photo`. Tool mengembalikan gambar, bukan
   hanya nama file. Tanggal pengambilan dapat diambil kembali dari EXIF foto lama
   saat gambar dibaca. `created_at` selalu waktu unggah; tanggal yang tidak
   diketahui tidak boleh diasumsikan sama dengan tanggal unggah.
5. Pilih foto yang belum dipakai untuk kegiatan lain. Foto kegiatan yang sama
   boleh muncul dalam laporan harian, mingguan, dan bulanan. Foto dengan checksum
   identik dihitung sebagai gambar yang sama, walaupun diunggah ulang.
6. Jika foto yang sesuai tidak tersedia, baca `logbook_commit`, lalu gunakan
   `logbook_capture`. Sertakan referensi commit dalam `sourceRefs` untuk setiap
   screenshot rekonstruksi. Tanggal commit dalam zona profil harus cocok dengan
   tanggal kegiatan. Jangan mengisi hari kosong dengan cerita rekaan.
7. Panggil `logbook_save` dengan narasi, sumber dan bukti yang dipilih. Semua
   kegiatan dan alokasi foto disimpan dalam satu transaksi. Kekurangan disimpan
   terpisah; kegiatan belum lengkap menjadi draft.
8. Panggil `logbook_export`. Kembalikan tautan file Excel lokal kepada pengguna,
   status lengkap/parsial, dan daftar kekurangan yang masih perlu diisi.

Menambahkan bukti pada kegiatan manual tidak mengganti isi atau status manual.
Untuk menaikkan status draft manual, pengguna dapat menyuntingnya di aplikasi.
Draft yang dibuat Codex dapat menjadi siap ketika bukti tersedia.

## Screenshot versi aplikasi

Salin struktur `.codex/logbook.example.json` ke `.codex/logbook.local.json` dan
sesuaikan `appUrl`, daftar `repositories`, dan `profiles`. File contoh memuat
halaman login sebagai contoh konfigurasi; pilih halaman yang relevan dengan
pekerjaan. Codex dapat menyiapkan profil lokal dari script dan route project
yang memang diminta pengguna.

Setiap profil memuat:

- `localPath`: checkout lokal; origin harus cocok dengan repository perintah.
- `install`: array executable/argumen instalasi; boleh dihilangkan bila tidak perlu.
- `start`: array executable/argumen server, dengan placeholder `{port}`.
- `routes`: halaman yang diizinkan; setiap halaman memiliki `path` dan
  `readySelector` yang membuktikan kontennya sudah muncul.
- `env`: hanya konfigurasi pengujian yang diperlukan untuk rekonstruksi.

Runner membuat arsip SHA asli dalam direktori terpisah. Branch dan file kerja
checkout asal tidak diganti. Environment aplikasi aktif tidak diwariskan;
credential produksi tidak otomatis dibawa. Browser hanya mengizinkan pembacaan
GET/HEAD/OPTIONS dari server rekonstruksi localhost. Halaman yang perlu login,
backend eksternal, atau data khusus perlu profil pengujian yang sesuai; jika
tidak siap, runner beralih ke gambar kode/diff.

Instal browser jika Chromium/Edge/Chrome belum tersedia:

```powershell
npx playwright install chromium
```

Screenshot diberi label **Rekonstruksi**, repository, SHA, tanggal commit, dan
waktu pembuatan gambar. Metadata evidence menyimpan file atau route asal.
Screenshot kode/diff menggunakan patch asli dari GitHub, menandai cuplikan jika
panjang, dan tidak merender file credential seperti `.env` atau private key.

## CLI dan kontrak JSON

CLI dan MCP menggunakan layanan yang sama:

```powershell
npm run logbook -- context context.json
npm run logbook -- sync sync.json
npm run logbook -- commit commit.json
npm run logbook -- capture capture.json
npm run logbook -- save save.json
npm run logbook -- export export.json
npm run logbook -- resume resume.json
npm run logbook -- runs
```

Contoh `context.json`:

```json
{
  "request": {
    "requestId": "10000000-0000-4000-8000-000000000001",
    "period": "monthly",
    "from": "2026-10-01",
    "to": "2026-10-31",
    "category": "INTERNSHIP",
    "repositories": ["owner/project"]
  },
  "page": 1
}
```

`save.json` memiliki `request` yang sama serta `plan`:

```json
{
  "entries": [{
    "date": "2026-10-01",
    "title": "Implementasi fitur berdasarkan sumber pekerjaan",
    "description": "Uraian pekerjaan yang didukung sumber.",
    "evidenceIds": ["20000000-0000-4000-8000-000000000001"],
    "sourceRefs": [{"kind": "photo", "id": "20000000-0000-4000-8000-000000000001"}]
  }],
  "gaps": [{"date": "2026-10-02", "reason": "Belum ada sumber yang mendukung kegiatan."}],
  "summary": "Ringkasan pekerjaan dalam periode ini."
}
```

UUID contoh harus diganti dengan ID asli dari context. Untuk kegiatan yang sudah
ada, sertakan `activityId` dan `expectedVersion`. Jenis referensi sumber:
`activity`, `todo`, `photo`, `commit`, `attendance`. Jam `startTime`/`endTime`
opsional menggunakan `HH:mm` dalam zona profil, hanya berdasarkan sumber waktu
yang tersedia. Absensi saja tidak cukup sebagai sumber isi kegiatan.
`export.json` berisi `{"runId":"UUID"}`;
`resume.json` berisi `{"requestId":"UUID"}`. `capture.json` berisi `commitId`,
`repository`, serta `path` diff atau `route` profil bila ingin memilihnya.
`sync.json` berisi `repository`; `commit.json` berisi `commitId`, `repository`,
dan `page` opsional. CLI `upload` menerima `file`, `uploadId` dan `capturedAt`
opsional; ini menggunakan upload resumable yang sama.

Retry memakai `requestId` dan isi yang sama. Isi berbeda dengan UUID yang sama
ditolak. Checkpoint lokal ditulis sebelum request penyimpanan, sehingga respons
yang hilang dapat diputar ulang. Permintaan periode lain menggunakan UUID baru;
sumber pekerjaan yang sama pada tanggal yang sama tetap mengarah ke kegiatan
yang sudah dibuat. Jika kegiatan berubah di perangkat lain atau foto sudah
diambil proses lain, muat ulang context sebelum menyusun ulang permintaan.

## Hasil dan pemulihan

Excel memuat Ringkasan, Logbook, Evidence Detail, Dokumentasi, dan Perlu
Dilengkapi. Hanya kegiatan siap dengan bukti yang masuk detail laporan hasil
Codex. Thumbnail ikut tersimpan di file Excel; tautan asli tetap privat dan
memerlukan login. Aturan akses tautan tidak menarik kembali salinan thumbnail
yang sudah ada dalam file.

Satu laporan menerima hingga 500 kegiatan dan 500 bukti unik dalam rentang hingga
367 hari. Unduhan Excel menggunakan respons streaming agar kumpulan thumbnail
tidak terkena batas respons buffer serverless. Untuk volume lebih besar, bagi
menjadi beberapa periode.

Riwayat tersedia pada halaman Laporan. Unduhan ulang menggunakan snapshot
kegiatan yang tersimpan; bukti asli yang kemudian hilang ditandai pada hasil
ekspor. Screenshot dan upload yang selesai sebelum kegagalan penyimpanan tetap
berada di Library dan dapat digunakan saat melanjutkan proses.

Pengujian:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
node scripts/logbook/verify-capture.mjs
```

Tes database memutar ulang seluruh migrasi dengan PostgreSQL PGlite dan adapter
identitas Supabase untuk fixture. Scheduler `pg_cron` tidak dijalankan dalam
PGlite; extension tersebut tetap diperlukan pada deployment Supabase sebenarnya.
Pemeriksaan screenshot menggunakan repository fixture dan commit historis,
tanpa membaca akun atau menulis kegiatan pengguna.
