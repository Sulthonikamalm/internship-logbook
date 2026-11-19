"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { compressBrowserPhoto } from "../domain/browser-photo";
import { uploadBrowserPhoto } from "../domain/browser-upload";
import { MAX_PHOTO_BYTES } from "../domain/photo-signature";
import { MAX_UPLOAD_BATCH, processUploadQueue } from "../domain/upload-queue";
import { parseCaptureTime } from "../domain/capture-time";

type Stage = "QUEUED" | "VALIDATING" | "UPLOADING" | "FINALIZING" | "SUCCESS" | "FAILED" | "DUPLICATE" | "ATTACH_FAILED";
type Item = { id: string; file: File; preview: string; stage: Stage; progress: number; message?: string;
  evidenceId?: string; capturedAt: string };
type Props = { onUploaded?: (id: string) => void | Promise<void>; onBusyChange?: (busy: boolean) => void; compact?: boolean };

export function PhotoUploader({ onUploaded, onBusyChange, compact = false }: Props) {
  const router = useRouter(); const inputId = useId();
  const [items, setItems] = useState<Item[]>([]); const itemsRef = useRef<Item[]>([]);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const callbacks = useRef({ onUploaded, onBusyChange });
  useEffect(() => { callbacks.current = { onUploaded, onBusyChange }; }, [onUploaded, onBusyChange]);
  useEffect(() => () => { itemsRef.current.forEach(item => URL.revokeObjectURL(item.preview)); }, []);
  function update(id: string, changes: Partial<Item>) {
    itemsRef.current = itemsRef.current.map(item => item.id === id ? { ...item, ...changes } : item);
    setItems(itemsRef.current);
  }
  function select(files: File[]) {
    if (busyRef.current || !files.length) return;
    const remaining = MAX_UPLOAD_BATCH - itemsRef.current.length;
    setMessage(files.length > remaining ? `Maksimal ${MAX_UPLOAD_BATCH} foto per antrean. ${files.length - Math.max(0, remaining)} file belum ditambahkan.` : "");
    const added = files.slice(0, Math.max(0, remaining)).map(file => ({ id: crypto.randomUUID(), file,
      preview: URL.createObjectURL(file), stage: "QUEUED" as const, progress: 0, capturedAt: "" }));
    itemsRef.current = [...itemsRef.current, ...added]; setItems(itemsRef.current);
  }
  useEffect(() => {
    function paste(event: ClipboardEvent) {
      const target = event.target;
      if (busyRef.current || target instanceof HTMLElement && target.isContentEditable) return;
      if (target instanceof HTMLInputElement && target.type !== "file") return;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const files = Array.from(event.clipboardData?.items ?? []).filter(item => item.kind === "file" && item.type.startsWith("image/"))
        .flatMap(item => { const file = item.getAsFile(); return file ? [file] : []; });
      if (files.length) { event.preventDefault(); select(files); }
    }
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, []);
  function lock(value: boolean) { busyRef.current = value; setBusy(value); callbacks.current.onBusyChange?.(value); }
  async function compress(item: Item) {
    if (busyRef.current) return; lock(true);
    try {
      let capturedAt = item.capturedAt;
      if (!capturedAt) {
        const exif = await import("exifr").then(module => module.default.parse(item.file, { pick: ["DateTimeOriginal", "OffsetTimeOriginal"], reviveValues: false })).catch(() => null);
        const instant = parseCaptureTime(exif?.DateTimeOriginal, exif?.OffsetTimeOriginal, Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (instant) { const date = new Date(instant); capturedAt = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      }
      const file = await compressBrowserPhoto(item.file); URL.revokeObjectURL(item.preview);
      update(item.id, { file, preview: URL.createObjectURL(file), capturedAt, stage: "QUEUED", message: undefined });
    } catch (error) { update(item.id, { message: error instanceof Error ? error.message : "Kompresi gagal." }); }
    finally { lock(false); }
  }
  async function upload(onlyId?: string, decision?: "use_existing" | "upload_again") {
    if (busyRef.current) return;
    const selected = itemsRef.current.filter(item => onlyId ? item.id === onlyId : ["QUEUED", "FAILED", "ATTACH_FAILED"].includes(item.stage));
    if (!selected.length) return; lock(true); setMessage("");
    // Pickers have a mutation lock; upload two files, but serialize attachments.
    let attachments = Promise.resolve(); let saved = 0;
    try {
      await processUploadQueue(selected, async item => {
        let evidenceId = item.evidenceId;
        try {
          if (!evidenceId) {
            update(item.id, { stage: "VALIDATING", message: undefined });
            const result = await uploadBrowserPhoto(item.file, item.id, { decision,
              capturedAt: item.capturedAt ? new Date(item.capturedAt).toISOString() : undefined,
              onProgress: progress => update(item.id, { stage: "UPLOADING", progress }),
              onFinalizing: () => update(item.id, { stage: "FINALIZING" }),
            });
            if ("duplicateId" in result) { update(item.id, { stage: "DUPLICATE" }); return; }
            evidenceId = result.evidenceId; update(item.id, { evidenceId });
          }
          const id = evidenceId;
          const attachment = attachments.then(() => callbacks.current.onUploaded?.(id));
          attachments = attachment.then(() => undefined, () => undefined);
          await attachment;
          update(item.id, { stage: "SUCCESS", progress: 100, message: undefined }); saved++;
        } catch (error) {
          update(item.id, { evidenceId, stage: evidenceId ? "ATTACH_FAILED" : "FAILED",
            message: evidenceId ? "Foto tersimpan, tetapi belum terlampir. Coba lampirkan lagi."
              : error instanceof Error ? error.message : "Upload gagal. Coba lagi." });
        }
      });
      if (saved) toast.success(`${saved} foto siap digunakan`);
      router.refresh();
    } finally { lock(false); }
  }
  function remove(item: Item) {
    URL.revokeObjectURL(item.preview);
    itemsRef.current = itemsRef.current.filter(row => row.id !== item.id); setItems(itemsRef.current);
  }
  const remaining = items.filter(item => ["QUEUED", "FAILED", "ATTACH_FAILED"].includes(item.stage)).length;
  const complete = items.filter(item => item.stage === "SUCCESS").length;
  return <div className="space-y-4" aria-busy={busy}>
    <div className="rounded-xl border border-dashed bg-muted/30 p-4">
      <label htmlFor={inputId} className="mb-2 flex items-center gap-2 text-sm font-medium"><ImagePlus size={18} />Pilih beberapa foto atau tempel gambar</label>
      <input id={inputId} disabled={busy} type="file" multiple accept="image/jpeg,image/png,image/webp"
        onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }}
        className="block w-full min-w-0 text-base file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-3" />
      {compact && <label className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <Camera size={18} />Kamera<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} className="sr-only" />
      </label>}
      <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP · Maks. 15 MB per foto · 100 foto per antrean · Privat</p>
      <p className="mt-1 text-xs text-muted-foreground">Tempel tangkapan layar dengan Ctrl+V atau Command+V.</p>
    </div>
    {message && <Feedback>{message}</Feedback>}
    {items.length > 0 && <p role="status" className="text-sm text-muted-foreground">{complete} dari {items.length} foto siap{busy ? " · Mengunggah…" : ""}</p>}
    <div className="max-h-[40dvh] space-y-3 overflow-y-auto overscroll-contain">
      {items.map(item => <div key={item.id} className="rounded-xl border p-3">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" src={item.preview} alt={`Pratinjau ${item.file.name}`} className="h-16 w-16 shrink-0 rounded-lg object-contain bg-muted" />
          <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{item.file.name}</p><p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
            <p className="mt-1 text-xs">{({ QUEUED: "Dalam antrean", VALIDATING: "Memeriksa…", UPLOADING: `Mengunggah ${item.progress}%`, FINALIZING: "Menyimpan…", SUCCESS: "Siap digunakan", FAILED: "Gagal", DUPLICATE: "Foto ini sudah ada", ATTACH_FAILED: "Tersimpan, belum terlampir" })[item.stage]}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={`Hapus ${item.file.name} dari antrean`} disabled={busy} onClick={() => remove(item)}><X size={16} /></Button>
        </div>
        {["VALIDATING", "UPLOADING", "FINALIZING"].includes(item.stage) && <progress value={item.progress} max={100} aria-label={`Progres ${item.file.name}`} className="mt-2 w-full accent-primary" />}
        {item.stage !== "SUCCESS" && !item.evidenceId && <details className="mt-2 text-xs text-muted-foreground">
          <summary className="flex min-h-11 cursor-pointer items-center">Koreksi waktu pengambilan</summary>
          <label>Waktu pengambilan (opsional)<input type="datetime-local" value={item.capturedAt} disabled={busy} onChange={event => update(item.id, { capturedAt: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-base" /></label>
          <p>Metadata foto digunakan bila tersedia.</p>
        </details>}
        {item.message && <p role="alert" className="mt-2 text-sm text-destructive">{item.message}</p>}
        {item.file.size > MAX_PHOTO_BYTES && <Button variant="outline" disabled={busy} onClick={() => compress(item)} className="mt-2">Kompres foto</Button>}
        {item.stage === "DUPLICATE" && <div className="mt-2 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => upload(item.id, "use_existing")}>Gunakan yang ada</Button><Button variant="outline" disabled={busy} onClick={() => upload(item.id, "upload_again")}>Unggah lagi</Button></div>}
        {["FAILED", "ATTACH_FAILED"].includes(item.stage) && <Button variant="outline" disabled={busy} onClick={() => upload(item.id)} className="mt-2">{item.evidenceId ? "Lampirkan lagi" : "Lanjutkan upload"}</Button>}
      </div>)}
    </div>
    {remaining > 0 && <Button disabled={busy} onClick={() => upload()} className="w-full">{busy ? "Mengunggah…" : `Unggah / lanjutkan ${remaining} foto`}</Button>}
    {items.length > 0 && complete === items.length && <Feedback tone="success">Semua foto siap digunakan.</Feedback>}
  </div>;
}
