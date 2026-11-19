import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Download, ArrowRight, FileSpreadsheet, Images, GitBranch, Terminal, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import clientPackage from "../../../mcp-client/package.json";

export const metadata: Metadata = {
  title: "Unduh MCP untuk Codex — InternFlow",
  description: "Unduh penghubung InternFlow ke Codex. Susun logbook dengan foto dan riwayat pekerjaan dari akunmu sendiri.",
};

const features = [
  { icon: FileSpreadsheet, title: "Laporan dari percakapan", text: "Minta logbook harian, mingguan, atau bulanan, lalu unduh hasil Excel." },
  { icon: Images, title: "Foto yang sesuai kegiatan", text: "Codex memeriksa foto di Library dan membantu memilih bukti yang belum terpakai." },
  { icon: GitBranch, title: "Terhubung ke pekerjaanmu", text: "Gunakan riwayat commit dan screenshot kode ketika dokumentasi foto belum cukup." },
];
const steps = [
  { title: "Unduh dan ekstrak paket", text: "Pasang Node.js 22 atau 24 serta Codex. Ekstrak ZIP ke folder tetap, lalu buka terminal pada folder yang berisi package.json." },
  { title: "Pasang penghubung", text: "Jalankan perintah berikut. Setup mengambil konfigurasi aplikasi dari website secara otomatis.", command: "npm ci\nnpm run setup" },
  { title: "Masuk dengan akunmu", text: "Gunakan email dan password akun InternFlow sendiri. Password disembunyikan saat diketik.", command: "npm run login" },
  { title: "Tambahkan ke Codex", text: "Jika Codex CLI tersedia, jalankan perintah berikut. Untuk aplikasi desktop, tambahkan server STDIO pada Settings → MCP servers menggunakan command dan args di file codex-config.toml hasil setup. Setelah itu, muat ulang sesi Codex.", command: "npm run connect:codex" },
];

export default function McpDownloadPage() {
  return <main className="app-canvas min-h-dvh px-5 py-6 sm:px-8 sm:py-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="InternFlow Home" prefetch={false}><Image src="/internflow-logo.png" alt="InternFlow" width={170} height={57} preload className="h-auto w-36 sm:w-40" /></Link>
        <Button asChild variant="outline"><Link href="/login">Masuk ke aplikasi<ArrowRight size={16} /></Link></Button>
      </header>

      <section className="py-14 sm:py-20" aria-labelledby="mcp-title">
        <p className="eyebrow text-primary">InternFlow × Codex</p>
        <h1 id="mcp-title" className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Susun logbook langsung<br className="hidden sm:block" /> dari percakapanmu.</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">Unduh penghubung MCP, masuk ke akun InternFlow milikmu, lalu minta Codex menyusun laporan dari kegiatan, foto, dan riwayat pekerjaanmu.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg"><a href="/downloads/internflow-mcp.zip" download="internflow-mcp.zip"><Download size={19} />Unduh MCP (.zip)</a></Button>
          <Button asChild variant="outline" size="lg"><a href="#pemasangan">Cara memasang</a></Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Versi {clientPackage.version} · Windows, macOS, Linux · Unduhan publik</p>
        <a href="/downloads/internflow-mcp.sha256" download className="mt-2 inline-flex min-h-10 items-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Unduh checksum SHA-256</a>
      </section>

      <section aria-label="Yang bisa dilakukan" className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => <article key={title} className="surface p-6"><Icon size={23} className="text-primary" aria-hidden="true" /><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}
      </section>

      <section id="pemasangan" aria-labelledby="install-title" className="scroll-mt-8 py-14 sm:py-20">
        <div className="mb-7 flex items-center gap-3"><Terminal size={24} className="text-primary" aria-hidden="true" /><h2 id="install-title" className="text-2xl font-semibold tracking-tight">Pasang sekali, gunakan dari Codex.</h2></div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, index) => <li key={step.title} className="surface min-w-0 p-6"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">{index + 1}</span><h3 className="mt-4 font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>{step.command && <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-sm leading-7"><code>{step.command}</code></pre>}</li>)}
        </ol>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Node.js minimum 22.22.2 pada seri 22 atau 24.15.0 pada seri 24. Panduan lengkap, contoh konfigurasi screenshot, dan bantuan login tersedia di README dalam ZIP. Folder paket perlu tetap di lokasi pemasangannya.</p>
      </section>

      <section className="surface p-6 sm:p-8" aria-labelledby="try-title">
        <p className="eyebrow text-primary">Coba setelah terhubung</p><h2 id="try-title" className="mt-3 text-xl font-semibold">Sebutkan laporan dan repository pekerjaanmu.</h2>
        <blockquote className="mt-4 border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-muted-foreground">Buat logbook magang mingguan untuk owner/repository. Cocokkan foto yang belum dipakai dengan kegiatan per hari. Jika kurang, gunakan riwayat kode yang sesuai. Simpan lalu buat Excel.</blockquote>
      </section>

      <section className="flex items-start gap-3 py-8 text-sm leading-relaxed text-muted-foreground" aria-label="Akun dan privasi"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-medium text-foreground">Unduh bebas, data tetap milik akun masing-masing.</p><p className="mt-1">Paket tidak membawa kredensial pengelola. Akun InternFlow aktif tetap diperlukan untuk mengakses kegiatan dan foto. Belum punya akun? Minta pengelola membuatkannya. Hubungkan GitHub milikmu dari halaman Integrasi untuk menggunakan riwayat commit.</p></div></section>
      <footer className="border-t border-border py-6 text-xs text-muted-foreground">InternFlow by Sulthonika</footer>
    </div>
  </main>;
}
