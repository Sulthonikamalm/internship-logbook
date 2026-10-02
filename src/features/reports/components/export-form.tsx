"use client";
import { useRef, useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/ui/feedback";

export function ExportForm({ initialToday }: { initialToday: string }) {
  const [from, setFrom] = useState(initialToday.slice(0, 7) + "-01");
  const [to, setTo] = useState(initialToday);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lock = useRef(false);
  function preset(value: "month" | "previous" | "90days") {
    const today = new Date(`${initialToday}T12:00:00Z`);
    if (value === "month") { setFrom(initialToday.slice(0, 7) + "-01"); setTo(initialToday); }
    if (value === "previous") {
      setFrom(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 10));
      setTo(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).toISOString().slice(0, 10));
    }
    if (value === "90days") { today.setUTCDate(today.getUTCDate() - 89); setFrom(today.toISOString().slice(0, 10)); setTo(initialToday); }
    setError(""); setSuccess("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    if (!from || !to || from > to) { setError("Periksa kembali rentang tanggal."); return; }
    lock.current = true; setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/reports/export-excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, includeEvidence, evidenceLinkMode: "APP_PRIVATE" }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(response.status === 401 ? "Sesi berakhir. Masuk kembali untuk mengunduh laporan." : body.message || "Laporan belum dapat dibuat. Coba lagi."); return;
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : `InternFlow_${from}_${to}.xlsx`;
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      // Allow the browser to start consuming the download before releasing the URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("Laporan siap. Unduhan dimulai."); toast.success("Laporan siap diunduh");
    } catch { setError("Koneksi terputus. Coba unduh lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <section className="surface max-w-2xl p-5 sm:p-7"><h2 className="text-lg font-semibold">Ekspor logbook</h2><p className="mt-2 mb-6 text-sm text-muted-foreground">Pilih periode, lalu unduh sebagai Excel.</p>
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => preset("month")}>Bulan ini</Button><Button type="button" variant="outline" size="sm" onClick={() => preset("previous")}>Bulan lalu</Button><Button type="button" variant="outline" size="sm" onClick={() => preset("90days")}>90 hari</Button></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Dari</span><Input type="date" required value={from} onChange={e => { setFrom(e.target.value); setSuccess(""); }} /></label><label className="block space-y-2 text-sm font-medium"><span>Sampai</span><Input type="date" required min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setSuccess(""); }} /></label></div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={includeEvidence} onChange={e => setIncludeEvidence(e.target.checked)} className="size-5 accent-primary" />Sertakan detail evidence</label>
      </fieldset>
      <div className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><Lock size={16} className="shrink-0" />Foto memerlukan login InternFlow. Commit privat memerlukan akses repo GitHub.</div>
      {error && <Feedback>{error}{error.startsWith("Sesi") && <a href="/login?next=%2Freports" className="ml-2 underline">Masuk kembali</a>}</Feedback>}
      {success && <Feedback tone="success">{success}</Feedback>}
      <Button disabled={pending} className="w-full gap-2 sm:w-auto">{pending ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}{pending ? "Menyiapkan laporan…" : "Unduh Excel"}</Button>
    </form>
  </section>;
}
