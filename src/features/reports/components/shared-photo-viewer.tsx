"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, ImageOff } from "lucide-react";

export function SharedPhotoViewer({ shareId, evidenceId }: { shareId: string; evidenceId: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = window.location.hash.slice(1);
    const controller = new AbortController();
    let objectUrl: string | null = null;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      queueMicrotask(() => { if (!controller.signal.aborted) setError("Tautan foto tidak lengkap. Buka dari file Excel."); });
      return () => controller.abort();
    }
    fetch("/api/reports/shared-photo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, evidenceId, token }), signal: controller.signal,
      cache: "no-store", referrerPolicy: "no-referrer",
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? "Tautan berakhir, dicabut, atau foto tidak tersedia." : "Foto belum dapat dimuat. Coba lagi.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Foto tidak tersedia.");
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Foto belum dapat dimuat."); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [shareId, evidenceId]);
  return <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_15%_10%,#dbeafe_0%,transparent_40%),#f7f9fd] p-4 sm:p-8">
    <section className="surface w-full max-w-4xl p-5 sm:p-8" aria-live="polite">
      <Image src="/internflow-logo.png" width={163} height={55} alt="InternFlow" className="h-auto w-36 object-contain" priority />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Foto lampiran laporan</h1>
      {photoUrl ? <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white"><Image src={photoUrl} width={1200} height={900} unoptimized alt="Foto lampiran laporan" className="mx-auto h-auto max-h-[75dvh] w-auto max-w-full object-contain" /></div>
        : error ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border p-5 text-sm text-muted-foreground"><ImageOff size={20} className="shrink-0" /><p>{error}</p></div>
        : <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-5 text-sm text-muted-foreground"><Loader2 size={20} className="animate-spin" /><p>Memuat foto…</p></div>}
      <p className="mt-5 text-xs text-muted-foreground">Tautan dari pemilik laporan. Akses berakhir sesuai masa berlaku atau saat dicabut.</p>
    </section>
  </main>;
}
