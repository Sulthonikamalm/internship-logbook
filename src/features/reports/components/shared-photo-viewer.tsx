"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, ImageOff } from "lucide-react";

export function SharedPhotoViewer({ shareId, evidenceId, initialOwnerName = "" }: { shareId: string; evidenceId: string; initialOwnerName?: string }) {
  const [photo, setPhoto] = useState<{ url: string; width: number; height: number } | null>(null);
  const [ownerName, setOwnerName] = useState(initialOwnerName);
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
      body: JSON.stringify({ shareId, evidenceId, token, maxWidth: window.innerWidth <= 640 ? 960 : 1920 }), signal: controller.signal,
      cache: "no-store", referrerPolicy: "no-referrer",
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? "Tautan berakhir, dicabut, atau foto tidak tersedia." : "Foto belum dapat dimuat. Coba lagi.");
      if (controller.signal.aborted) return;
      const name = response.headers.get("X-InternFlow-Owner-Name");
      if (name) setOwnerName(decodeURIComponent(name));
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Foto tidak tersedia.");
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setPhoto({ url: objectUrl, width: Number(response.headers.get("X-InternFlow-Photo-Width")) || 1200,
        height: Number(response.headers.get("X-InternFlow-Photo-Height")) || 900 });
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Foto belum dapat dimuat."); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [shareId, evidenceId]);
  const title = `Foto lampiran laporan${ownerName ? ` ${ownerName}` : ""}`;
  return <main className="app-canvas flex min-h-dvh items-center justify-center p-4 sm:p-8">
    <section className="surface w-full max-w-4xl p-5 sm:p-8" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Image src="/internflow-logo.png" width={163} height={55} alt="InternFlow" className="h-auto w-36 object-contain" preload />
        <span className="text-sm font-medium text-muted-foreground">by Sulthonika</span>
      </div>
      <h1 className="mt-8 break-words text-2xl font-semibold tracking-tight">{title}</h1>
      {photo ? <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card"><Image src={photo.url} width={photo.width} height={photo.height} unoptimized loading="eager" fetchPriority="high" alt={title} className="mx-auto h-auto max-h-[75dvh] w-auto max-w-full object-contain" onError={() => { setPhoto(null); setError("Foto belum dapat ditampilkan. Coba lagi."); }} /></div>
        : error ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border p-5 text-sm text-muted-foreground"><ImageOff size={20} className="shrink-0" /><p>{error}</p></div>
        : <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-5 text-sm text-muted-foreground"><Loader2 size={20} className="animate-spin" /><p>Memuat foto…</p></div>}
      <p className="mt-5 text-xs text-muted-foreground">Tautan dari pemilik laporan. Akses berakhir sesuai masa berlaku atau saat dicabut.</p>
    </section>
  </main>;
}
