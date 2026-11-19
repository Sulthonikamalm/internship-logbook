# InternFlow MCP untuk Codex

Paket ini menghubungkan **akun InternFlow milikmu** ke Codex untuk menyusun logbook harian, mingguan, dan bulanan. Kamu tidak perlu menjalankan website atau mengatur database sendiri.

## Mulai

1. Pasang Node.js **22.22.2+ pada seri 22**, **24.15.0+ pada seri 24**, atau seri 26+. Siapkan Codex dan akun InternFlow aktif. Bila belum punya akun aplikasi, minta pengelola membuatkannya.
2. Ekstrak ZIP ke folder tetap, misalnya `C:\Tools\internflow-mcp`. Buka terminal di folder yang berisi `package.json`.
3. Jalankan:

   ```powershell
   npm ci
   npm run setup
   npm run login
   ```

   Setup mengambil konfigurasi publik dari website. Login memakai email/password **akun InternFlow**, bukan akun OpenAI. Password disembunyikan; jangan tulis password atau token di chat.
4. Jika Codex CLI tersedia, jalankan:

   ```powershell
   npm run connect:codex
   ```

   Server bernama `internflow` akan didaftarkan ke konfigurasi Codex. Jika hanya memakai Codex desktop, buka **Settings → MCP servers → Add server**, pilih **STDIO**, lalu gunakan `command` dan `args` dari file **`codex-config.toml`** yang dibuat setup. File tersebut juga dapat disalin ke konfigurasi Codex milikmu tanpa menghapus pengaturan server lain.
5. Muat ulang sesi Codex. Hubungkan GitHub di halaman Integrasi InternFlow bila ingin menggunakan riwayat commit. Foto yang sudah kamu unggah tersedia melalui akunmu.

Biarkan folder instalasi tetap di lokasinya. Jika dipindah, jalankan setup dan daftarkan ulang MCP dari lokasi baru.

## Contoh perintah

> Buat logbook magang mingguan untuk owner/repository. Cocokkan foto yang belum dipakai dengan kegiatan per hari. Jika kurang, gunakan riwayat kode yang sesuai. Simpan lalu buat Excel.

> Buat logbook bulanan untuk owner/repository sampai hari ini. Laporkan hari yang belum memiliki bukti.

Ganti `owner/repository` dengan repository pekerjaanmu. Codex menggunakan sumber yang tersedia dalam akun aplikasi dan tidak boleh mengarang kegiatan.

## Akun dan privasi

- Unduhan paket bersifat publik. Akses data tetap memerlukan login dengan akun aplikasi aktif.
- Paket tidak berisi akun, password, sesi login, token Drive/GitHub, atau service-role key pengelola.
- Sesi disimpan di `.codex/local/`. Windows memakai DPAPI pengguna Windows; platform lain memakai file mode `0600`.
- Gunakan `npm run logout` untuk menghapus sesi lokal.
- Seluruh hasil laporan dan screenshot berada di `.codex/local/`, diabaikan Git. Jangan membagikan folder ini.

## Screenshot kode dan aplikasi

Untuk screenshot, pasang Git dan salah satu browser Chromium, Edge, atau Chrome. Bila belum ada browser yang cocok:

```powershell
npx playwright install chromium
```

Tanpa profil aplikasi, MCP dapat membuat screenshot diff commit asli. Untuk merekonstruksi tampilan aplikasi, isi `profiles` di `.codex/logbook.local.json` menggunakan lokasi checkout pekerjaanmu dan route pengujian yang relevan. Contoh tersedia di `.codex/logbook.example.json`; panduan lengkap ada di `docs/CODEX_LOGBOOK.md`.

## Pembaruan dan bantuan

Unduh paket terbaru dari halaman **MCP untuk Codex** di website InternFlow. Ekstrak ke folder baru dan lakukan setup/login, lalu daftarkan ulang server. Pengguna tidak perlu menerima file secara manual dari pengelola.

Jika setup gagal, pastikan situs dapat dibuka. Untuk deployment lain, jalankan `npm run setup -- --url https://alamat-aplikasi.example`. Saat login gagal, periksa email/password akun InternFlow dan status akun di pengelola.

Dokumentasi Codex: https://developers.openai.com/codex/mcp
