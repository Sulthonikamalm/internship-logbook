# InternFlow — overhaul lanjutan, 2 Oktober 2026

## 1. Audit Summary

PRD v1.1, dokumen Phase 1–8, serta implementasi lama menjadi acuan. Fondasi ownership/RLS, Drive privat, evidence bertipe, GitHub opsional, ekspor Excel, dan audit log dipertahankan. Kekurangan utama: Todo belum membedakan magang, tugas akhir, dan personal; penyelesaian Todo belum otomatis masuk Activity/kalender; Kanban sulit dipakai pada layar kecil; tautan foto laporan hanya bisa dibuka pemilik; dan pengelolaan pengguna memerlukan Supabase dashboard. Prioritas implementasi: transaksi kategori dan completion, navigasi/Home, laporan, akses dosen, admin, QA.

## 2. Changes Implemented

- Migrasi `20261002040028`–`20261002045652`: kategori, snapshot completion, Activity otomatis yang idempoten, gate evidence akademik, query histori dan Todo creation yang aman dari retry. Migrasi `20261002080948` dan `20261002083007`: grant foto per ekspor, hanya tersedia melalui server, dengan indeks FK.
- Domain dan halaman baru di `src/features/work/`, `src/app/(protected)/calendar/`, serta admin pengguna di `src/app/(protected)/admin/users/` dan `src/features/admin/`.
- `src/features/todos/`: Kanban lima kolom pada desktop, tahap ringkas pada mobile, tampilan List, drag dari badan card, target drop luas, penyelesaian langsung, dan confetti halus sesudah server mengonfirmasi.
- `src/features/reports/`: pemisahan laporan Magang/Tugas Akhir/Personal, gate evidence, workbook empat sheet (atau tiga tanpa lampiran), tautan foto, catatan panjang yang diteruskan ke baris berikutnya, serta daftar tautan dosen yang dapat dicabut.
- `src/app/api/reports/shared-photo/` dan `src/app/shared/evidence/`: penerima Excel membuka foto tanpa login menggunakan token yang hanya berlaku untuk foto dalam ekspor itu. Token disimpan sebagai SHA-256, tidak masuk URL permintaan halaman karena diletakkan pada fragmen, dan diverifikasi ulang terhadap masa berlaku, revokasi, keaktifan pemilik, keanggotaan foto, serta metadata Drive.

## 3. UI/UX Improvements

- Home mobile memiliki kategori, empat aksi cepat, enam pintasan Workspace, kegiatan terbaru, Todo aktif, dan status integrasi. Bottom navigation tetap pada tempatnya saat konten digulir.
- Login memakai logo InternFlow baru, komposisi biru/off-white, label jelas, dan password reveal. Sistem glass dipakai pada permukaan penting dengan animasi ringan dan dukungan reduced motion.
- Daftar Activity, Todo, Evidence, Logbook, Reports, kalender, dan Settings menggunakan copy lebih ringkas serta representasi mobile yang tidak memaksa tabel lebar. Akses foto dosen dijelaskan sebelum ekspor; mode standar tetap privat.
- Bukti tampilan: [Home mobile](qa/workspace-v2/home-mobile.png), [Kanban desktop](qa/workspace-v2/kanban-desktop.png), [Laporan](qa/workspace-v2/report-sharing.png), [Pembaca foto](qa/workspace-v2/shared-photo-reader.png).

## 4. Integration Improvements

- Supabase: delapan migrasi baru telah diterapkan; riwayat cloud disamakan dengan nama file lokal. Akun asli tidak dipakai sebagai fixture. Akses tambah pengguna ditentukan ulang dari identitas Auth terverifikasi `sulthon02032019@gmail.com`, bukan dari role yang bisa diubah pengguna. Akun biasa ditolak di halaman admin; unit server menguji pembuatan dan rollback provisioning.
- Drive: upload foto dan pembukaan lampiran privat benar-benar diuji. Foto tetap di folder Drive privat; endpoint dosen memvalidasi ID evidence/user/folder, nama, MIME, dan ukuran sebelum mengalirkan byte gambar.
- GitHub: akun utama terdeteksi terhubung dan pernah sync pada pemeriksaan read-only. GitHub tetap opsional; perubahan ini tidak mengubah token atau data GitHub pengguna.
- **Batas rilis eksternal:** `APP_BASE_URL` lokal saat QA adalah `http://localhost:3000`; tautan dari Excel lokal hanya berfungsi di komputer penguji. Agar dosen bisa membuka dari perangkat lain, deployment harus memakai alamat HTTPS publik pada `APP_BASE_URL`, lalu laporan diekspor ulang. Belum ada URL deployment publik yang diverifikasi dalam pekerjaan ini.

## 5. Bug Fixes / Hardening

- Completion akademik memerlukan evidence AVAILABLE milik sendiri dan otomatis membuat Activity satu kali per transisi; Personal tidak membutuhkan evidence dan tidak mengotori logbook magang. Riwayat tetap ada setelah reopen, edit, atau soft delete Todo. Akses foto yang dicabut/expired atau di luar ekspor ditolak.
- Idempotensi, ownership, konflik versi, browser-write guard, anti formula injection di Excel, akses super admin segar dari Auth, dan RLS/grant server-only diuji. Tampilan desktop/mobile diuji pada lebar 320, 390, 768, 1024, dan 1440 px; pengguliran horizontal halaman utama tidak ditemukan pada rute yang diuji.
- Advisor Supabase: tabel berbagi memiliki RLS aktif dan tidak memberikan SELECT/INSERT kepada `anon` atau `authenticated`. Info "RLS tanpa policy" disengaja karena hanya service role server yang boleh mengakses. Dua fungsi definer lama tetap memerlukan izin `authenticated` karena menjadi RPC aplikasi dan diuji ownership-nya. Peringatan lama **leaked password protection disabled** masih memerlukan pengaturan di Supabase Auth: [panduan Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 6. Validation

- Lint, typecheck, 209 tes dalam 17 file, dan build Next.js 16.3.7 berhasil. Browser QA memeriksa Home, login, Kanban drag/keyboard/list, penyelesaian Todo, kalender, responsivitas, ekspor tiga kategori, dan foto privat.
- Excel berbagi diuji lewat API nyata: HTTP 200, workbook dibaca ExcelJS dengan sheet Ringkasan/Logbook/Evidence Detail/Todos dan hyperlink foto berisi grant ekspor. Browser tanpa login berhasil memuat foto (640 px), bukti lain ditolak, tombol **Cabut akses** mengubah status dan URL yang sama sesudahnya ditolak. Tidak ada error console pada sesi itu.
- Dua suite SQL berbasis transaksi (`supabase/tests/workspace_v2_integrity.sql` dan `phase8_integrity.sql`) lulus di cloud. Replay migrasi pada database kosong belum dapat dijalankan karena daemon Docker tidak tersedia.
- Akun QA `Nadia QA`, seluruh baris terkait di Supabase, lima grant uji, serta satu file foto Drive dihapus setelah pemeriksaan ownership; folder QA dipindahkan ke Trash. Data akun utama tidak dipakai untuk tes tulis.
