"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, Loader2, Lock, BriefcaseBusiness, GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/ui/feedback";
import { WORK_CATEGORIES, categoryLabels, requiresWorkEvidence, type WorkCategory } from "@/features/work/domain/category";
import { cn } from "@/lib/utils";
const icons = { INTERNSHIP: BriefcaseBusiness, THESIS: GraduationCap, PERSONAL: Sparkles };
export function ExportForm({ initialToday, initialCategory = "INTERNSHIP", initialFrom, initialTo, localPhotoLinks = false }: { initialToday: string; initialCategory?: WorkCategory; initialFrom?: string; initialTo?: string; localPhotoLinks?: boolean }) {
  const [from, setFrom] = useState(initialFrom ?? initialToday.slice(0, 7) + "-01"); const [to, setTo] = useState(initialTo ?? initialToday);
  const [category, setCategory] = useState(initialCategory); const [includeEvidence, setIncludeEvidence] = useState(true);
  const [sharePhotos, setSharePhotos] = useState(false); const [shareExpiresDays, setShareExpiresDays] = useState<30 | 90 | 180>(90);
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [missing, setMissing] = useState<{ title: string; href: string }[]>([]); const lock = useRef(false);
  const router = useRouter();
  function clear() { setError(""); setSuccess(""); setMissing([]); }
  function preset(value: "month" | "previous" | "90days") {
    const today = new Date(`${initialToday}T12:00:00Z`);
    if (value === "month") { setFrom(initialToday.slice(0, 7) + "-01"); setTo(initialToday); }
    if (value === "previous") { setFrom(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 10)); setTo(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).toISOString().slice(0, 10)); }
    if (value === "90days") { today.setUTCDate(today.getUTCDate() - 89); setFrom(today.toISOString().slice(0, 10)); setTo(initialToday); }
    clear();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    if (!from || !to || from > to) { setError("Periksa kembali rentang tanggal."); return; }
    lock.current = true; setPending(true); clear();
    try {
      const response = await fetch("/api/reports/export-excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, category, includeEvidence: requiresWorkEvidence(category) || includeEvidence, evidenceLinkMode: sharePhotos ? "REPORT_SHARED" : "APP_PRIVATE", shareExpiresDays }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(response.status === 401 ? "Sesi berakhir. Masuk kembali untuk mengunduh laporan." : body.message || "Laporan belum dapat dibuat. Coba lagi.");
        if (Array.isArray(body.missing)) setMissing(body.missing.filter((row: { href?: unknown }) => typeof row.href === "string" && /^\/(activities|todos)(\/|\?)/.test(row.href)));
        return;
      }
      const disposition = response.headers.get("Content-Disposition") ?? ""; const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : `InternFlow_${category}_${from}_${to}.xlsx`;
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const shared = response.headers.get("X-InternFlow-Photo-Links") === "shared";
      setSuccess(shared ? `Laporan siap. Foto dapat dibuka penerima selama ${shareExpiresDays} hari.` : "Laporan siap. Unduhan dimulai."); toast.success("Laporan siap diunduh");
      if (shared) router.refresh();
    } catch { setError("Koneksi terputus. Coba unduh lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <section className="surface max-w-3xl p-5 sm:p-7"><form onSubmit={submit} className="space-y-6" aria-busy={pending}>
    <fieldset disabled={pending} className="space-y-6"><legend className="sr-only">Pilihan laporan</legend>
      <div><h2 className="mb-3 text-sm font-semibold">Kategori laporan</h2><div className="grid gap-3 sm:grid-cols-3">{WORK_CATEGORIES.map(value => { const Icon = icons[value]; return <label key={value} className={cn("relative flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors sm:flex-col sm:items-start", category === value ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/50")}><input type="radio" name="category" value={value} checked={category === value} onChange={() => { setCategory(value); if (requiresWorkEvidence(value)) setIncludeEvidence(true); clear(); }} className="size-4 accent-primary sm:absolute sm:top-4 sm:right-4" /><Icon size={23} className="shrink-0 text-primary" /><span><span className="block text-sm font-medium">{categoryLabels[value]}</span><span className="mt-1 block text-xs text-muted-foreground">{requiresWorkEvidence(value) ? "Bukti wajib" : "Non magang / non tugas akhir"}</span></span></label>; })}</div></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => preset("month")}>Bulan ini</Button><Button type="button" variant="outline" size="sm" onClick={() => preset("previous")}>Bulan lalu</Button><Button type="button" variant="outline" size="sm" onClick={() => preset("90days")}>90 hari</Button></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Dari</span><Input type="date" required value={from} onChange={e => { setFrom(e.target.value); clear(); }} /></label><label className="block space-y-2 text-sm font-medium"><span>Sampai</span><Input type="date" required value={to} min={from} onChange={e => { setTo(e.target.value); clear(); }} /></label></div>
      {!requiresWorkEvidence(category) && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={includeEvidence} onChange={event => { setIncludeEvidence(event.target.checked); if (!event.target.checked) setSharePhotos(false); clear(); }} className="size-4 accent-primary" />Sertakan lampiran yang tersedia</label>}
      {(requiresWorkEvidence(category) || includeEvidence) && <div className="space-y-3 rounded-2xl border border-border/70 p-4 sm:p-5"><p className="text-sm font-semibold">Akses foto</p><div className="grid gap-2 sm:grid-cols-2"><label className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm", !sharePhotos ? "border-primary/60 bg-primary/5" : "border-border")}><input type="radio" name="photoAccess" checked={!sharePhotos} onChange={() => { setSharePhotos(false); clear(); }} className="size-4 accent-primary" />Hanya saya</label><label className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm", sharePhotos ? "border-primary/60 bg-primary/5" : "border-border")}><input type="radio" name="photoAccess" checked={sharePhotos} onChange={() => { setSharePhotos(true); clear(); }} className="size-4 accent-primary" />Bagikan ke dosen</label></div>{sharePhotos && <div className="space-y-2"><label htmlFor="share-days" className="text-xs font-medium">Berlaku selama</label><select id="share-days" value={shareExpiresDays} onChange={event => { setShareExpiresDays(Number(event.target.value) as 30 | 90 | 180); clear(); }} className="flex min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm sm:max-w-48"><option value={30}>30 hari</option><option value={90}>90 hari</option><option value={180}>180 hari</option></select><p className="text-xs leading-relaxed text-muted-foreground">Siapa pun yang memiliki file Excel bisa membuka foto hingga akses berakhir atau dicabut.</p></div>}</div>}
    </fieldset>
    <p className="flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground"><Lock size={16} className="shrink-0 text-primary" />{sharePhotos ? localPhotoLinks ? "Alamat situs masih lokal. Tautan dosen baru dapat dibuka dari perangkat lain setelah situs memakai alamat publik." : "Tautan foto ada di Excel. File di Drive tetap privat." : "Foto dapat dibuka lewat tautan di Excel setelah masuk ke akun pemilik."}</p>
    {error && <Feedback>{error}</Feedback>}{missing.length > 0 && <div className="surface divide-y">{missing.map((row, index) => <Link key={`${row.href}-${index}`} href={row.href} className="flex min-h-12 items-center justify-between gap-3 p-3 text-sm"><span className="min-w-0 break-words">{row.title}</span><span className="shrink-0 text-xs text-primary">Tambah bukti →</span></Link>)}</div>}
    {success && <Feedback tone="success">{success}</Feedback>}
    <Button type="submit" disabled={pending} className="w-full gap-2 sm:w-auto">{pending ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}{pending ? "Menyiapkan laporan…" : "Unduh Excel"}</Button>
  </form></section>;
}
