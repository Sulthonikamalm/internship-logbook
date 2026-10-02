# InternFlow — kegiatan Magang, Tugas Akhir, dan Personal

Acuan: permintaan pengguna 2 Oktober 2026, PRD v1.1, Phase 1/4/5/6/7, dan implementasi Phase 8. Permintaan terbaru mengubah aturan produk berikut secara eksplisit.

## Diagnosis dan keputusan

- Todo saat ini hanya memiliki prioritas/tahap. Tambahkan kategori INTERNSHIP, THESIS, PERSONAL. Data lama tetap INTERNSHIP.
- Magang/Tugas Akhir membutuhkan evidence AVAILABLE milik sendiri untuk Review/Done; Personal tidak. Tombol Selesaikan boleh menuju Done dari tahap aktif mana pun. Perpindahan biasa tetap mengikuti alur tahap; reopening tetap tersedia.
- Magang/Tugas Akhir memiliki pilihan catat otomatis (default aktif). Done membuat Activity kategori yang sama beserta evidence dalam transaksi database yang sama. Kunci unik per transisi completion mencegah duplikasi retry; completion setelah reopening adalah peristiwa baru. Personal tidak menghasilkan logbook magang.
- Kalender menampilkan Activity dan peristiwa completion semua kategori, termasuk Personal atau Todo dengan pencatatan otomatis dimatikan. Tanggal memakai timezone profil; reopening tidak menghapus sejarah completion.
- Ekspor memilih satu kategori/periode, tidak mencampur pekerjaan. Laporan Magang/Tugas Akhir harus memiliki evidence yang tersedia; laporan Personal tidak membutuhkan evidence. Foto tetap memakai tautan privat aplikasi yang stabil dan dapat dibuka setelah login, tanpa membuka Drive secara publik.
- Permintaan lanjutan: pada ekspor, pemilik dapat memilih **Bagikan ke dosen**. Hanya foto yang terdapat dalam file Excel tersebut dapat dibaca pemegang file tanpa akun melalui token acak unik per ekspor yang disimpan sebagai hash, aktif 30/90/180 hari dan dapat dicabut. Mode standar tetap privat. Tautan memakai fragmen URL sehingga token tidak dikirim dalam permintaan halaman; aplikasi mengirim token dalam POST ke endpoint foto yang memeriksa keanggotaan lampiran, status pemilik, masa berlaku, dan metadata Drive. Untuk akses di perangkat dosen, `APP_BASE_URL` harus berupa alamat HTTPS publik.
- User management hanya untuk identitas Auth terverifikasi sulthon02032019@gmail.com yang aktif, diperiksa ulang pada setiap server operation. Akun baru dibuat dengan password melalui server, tanpa mengirim email atau membuka Supabase dashboard. Role admin tidak dapat diberikan lewat form.
- Kanban desktop menggunakan grid lima kolom yang muat dalam halaman; compact stage view pada layar kecil dan alternatif list. Drag dapat dimulai dari badan card, tindakan di dalam card tetap berfungsi. Completion yang berhasil mendapat confetti kecil sekali, disabled ketika reduced motion.
- Shell mobile memakai scroll container konten tersendiri; bottom navigation berada di luar container dan tetap pada tempatnya. Kalender tersedia di Home/More.
- Login memakai acuan gambar pengguna dan Apple HIG, field terlabel, reveal password, composition biru/off-white yang tenang. Logo lokal asli dipakai di `public/internflow-logo.png`; salinan lama di root dibersihkan tanpa mengubah gambar.

## Urutan implementasi

1. Kategori bersama, migrasi data/transaksi completion, regression SQL.
2. Form Activity/Todo, board/drop/list, catat otomatis, completion feedback.
3. Kalender dan navigation/Home kategori; shell mobile.
4. Export kategori, evidence gate, workbook hierarchy/link/print layout.
5. Super-admin user management, login dan logo.
6. Lint/typecheck/tests/build; database/advisors; browser responsive/flow QA; fixture cleanup.
7. Uji alur dosen dari tautan Excel tanpa login, penolakan foto lain, pencabutan, lalu bersihkan semua akun/file QA.

## Batas keamanan yang dipertahankan

Ownership/RLS, active-account guard, typed AVAILABLE evidence, version conflict, payload-bound idempotency, encrypted GitHub tokens, historical evidence, private Drive storage, dan sanitasi formula Excel tetap berlaku. Confetti hanya sesudah server berhasil, tidak dipakai pada failed/optimistic/replay response.
