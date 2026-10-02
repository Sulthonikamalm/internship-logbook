"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { compressBrowserPhoto, prepareBrowserPhoto } from "../domain/browser-photo";
import { MAX_PHOTO_BYTES } from "../domain/photo-signature";

type Stage = "IDLE" | "QUEUED" | "VALIDATING" | "UPLOADING" | "FINALIZING" | "SUCCESS" | "FAILED";
type Props = { onUploaded?: (id: string) => void | Promise<void>; onBusyChange?: (busy: boolean) => void; compact?: boolean };
class SessionExpiredError extends Error {}

async function serverJson(url: string, body: object) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (response.status === 401) throw new Error("Sesi berakhir. Masuk kembali, lalu coba dengan foto yang sama.");
  const payload = await response.json() as Record<string, unknown>;
  return { response, payload };
}

async function putToDrive(sessionUrl: string, file: File, mimeType: string, onProgress: (percent: number) => void): Promise<string> {
  const session = new URL(sessionUrl);
  if (session.protocol !== "https:" || session.hostname !== "www.googleapis.com"
    || session.pathname !== "/upload/drive/v3/files" || !session.searchParams.get("upload_id")) throw new Error("Sesi upload tidak valid.");
  const status = await fetch(sessionUrl, { method: "PUT", credentials: "omit",
    headers: { "Content-Range": `bytes */${file.size}` }, cache: "no-store" });
  if (status.status === 404) throw new SessionExpiredError("Sesi upload berakhir. Coba lagi dengan foto yang sama.");
  if (status.ok) { const completed = await status.json() as { id?: string }; if (completed.id) return completed.id; }
  if (status.status !== 308) throw new Error("Status upload gagal diperiksa. Coba lagi.");
  const received = Number(status.headers.get("Range")?.split("-")[1] ?? -1) + 1;
  const start = Number.isFinite(received) && received >= 0 && received < file.size ? received : 0;
  onProgress(Math.floor(start / file.size * 100));
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", sessionUrl); request.withCredentials = false; request.timeout = 180000;
    request.setRequestHeader("Content-Type", mimeType);
    request.setRequestHeader("Content-Range", `bytes ${start}-${file.size - 1}/${file.size}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(100, Math.floor((start + event.loaded) / file.size * 100))); };
    request.onerror = request.ontimeout = () => reject(new Error("Koneksi upload terputus. Coba lagi untuk melanjutkan."));
    request.onload = () => {
      if (request.status === 404) { reject(new SessionExpiredError("Sesi upload berakhir. Coba lagi dengan foto yang sama.")); return; }
      if (request.status < 200 || request.status >= 300) { reject(new Error("Upload belum selesai. Coba lagi untuk melanjutkan.")); return; }
      try { const value = JSON.parse(request.responseText) as { id?: string }; if (!value.id) throw new Error(); resolve(value.id); }
      catch { reject(new Error("Drive belum mengirim ID file. Coba lagi.")); }
    };
    request.send(file.slice(start));
  });
}

export function PhotoUploader({ onUploaded, onBusyChange, compact = false }: Props) {
  const router = useRouter(); const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(""); const previewRef = useRef("");
  const [stage, setStage] = useState<Stage>("IDLE");
  const [message, setMessage] = useState(""); const [progress, setProgress] = useState(0);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const resetSession = useRef(false); const uploadId = useRef(crypto.randomUUID()); const locked = useRef(false);
  const busy = ["VALIDATING", "UPLOADING", "FINALIZING"].includes(stage);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function select(selected: File | null) {
    if (locked.current) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = selected ? URL.createObjectURL(selected) : ""; setPreview(previewRef.current);
    setFile(selected); setStage(selected ? "QUEUED" : "IDLE"); setMessage(""); setProgress(0);
    setDuplicateId(null); resetSession.current = false; uploadId.current = crypto.randomUUID();
  }
  function lock(value: boolean) { locked.current = value; onBusyChange?.(value); }
  async function compress() {
    if (!file || locked.current) return; lock(true); setStage("VALIDATING"); setMessage("");
    try { const compressed = await compressBrowserPhoto(file); lock(false); select(compressed); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Kompresi gagal."); setStage("FAILED"); }
    finally { lock(false); }
  }
  async function upload(decision?: "use_existing" | "upload_again") {
    if (!file || locked.current) return; lock(true); setStage("VALIDATING"); setMessage("");
    let savedId: string | null = null;
    try {
      const prepared = await prepareBrowserPhoto(file);
      const { response, payload } = await serverJson("/api/evidence/photos/start", {
        uploadId: uploadId.current, size: prepared.size, mimeType: prepared.mimeType,
        originalFilename: file.name, checksum: prepared.checksum, duplicateDecision: decision, resetSession: resetSession.current,
      });
      if (response.status === 409 && payload.code === "DUPLICATE") {
        setDuplicateId(String(payload.duplicateEvidenceId)); setStage("QUEUED"); return;
      }
      if (!response.ok) throw new Error(String(payload.message || "Upload gagal dimulai."));
      const evidenceId = String(payload.evidenceId);
      if (payload.kind !== "EXISTING") {
        let driveFileId: string;
        if (payload.kind === "FINALIZE") driveFileId = String(payload.driveFileId);
        else {
          setStage("UPLOADING");
          try { driveFileId = await putToDrive(String(payload.sessionUrl), file, prepared.mimeType, setProgress); }
          catch (error) { resetSession.current = true; throw error; }
        }
        resetSession.current = false; setStage("FINALIZING");
        const final = await serverJson("/api/evidence/photos/finalize", { uploadId: uploadId.current, driveFileId });
        if (!final.response.ok) throw new Error(String(final.payload.message || "Finalisasi foto gagal."));
      }
      savedId = evidenceId; setStage("SUCCESS"); setDuplicateId(null);
      await onUploaded?.(evidenceId); toast.success("Foto tersimpan"); router.refresh();
    } catch (error) {
      if (savedId) { setStage("SUCCESS"); setMessage("Foto tersimpan, tetapi belum terlampir. Pilih dari Evidence Library."); router.refresh(); }
      else {
        if (error instanceof SessionExpiredError) resetSession.current = true;
        setMessage(error instanceof Error ? error.message : "Upload gagal. Coba lagi."); setStage("FAILED");
      }
    } finally { lock(false); }
  }
  return <div className="space-y-4">
    <div className="relative rounded-xl border border-dashed bg-muted/30 p-4">
      {preview && <div className="mb-4 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {/* Browser-only preview; never sent to a public image host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Pratinjau foto yang dipilih" className="h-full w-full object-contain" />
      </div>}
      <label htmlFor={inputId} className="mb-2 flex items-center gap-2 text-sm font-medium"><ImagePlus size={18} /> Pilih foto</label>
      <input id={inputId} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp"
        onChange={(event) => select(event.target.files?.[0] ?? null)} className="block w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-3" />
      {compact && <label className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <Camera size={18} /> Kamera <input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          onChange={(event) => select(event.target.files?.[0] ?? null)} className="sr-only" />
      </label>}
      <p className="mt-2 truncate text-xs text-muted-foreground">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "JPG, PNG, WebP · Maks. 15 MB · Tersimpan privat"}</p>
    </div>
    {file && file.size > MAX_PHOTO_BYTES && <Feedback>Foto melebihi 15 MB. <Button variant="outline" onClick={compress} disabled={busy}>Kompres foto</Button></Feedback>}
    {duplicateId && <div className="space-y-3 rounded-xl bg-muted p-4"><p className="text-sm">Foto ini sudah ada.</p><div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => upload("use_existing")}>Gunakan yang ada</Button><Button variant="outline" disabled={busy} onClick={() => upload("upload_again")}>Unggah lagi</Button>
    </div></div>}
    {message && <Feedback tone={stage === "SUCCESS" ? "info" : "error"}>{message}</Feedback>}
    {stage === "SUCCESS" && !message && <Feedback tone="success">Foto siap digunakan.</Feedback>}
    {busy && <div role="status" className="space-y-2 text-sm text-muted-foreground">
      {stage === "VALIDATING" ? "Memeriksa foto…" : stage === "UPLOADING" ? `Mengunggah · ${progress}%` : "Menyimpan foto…"}
      {stage === "UPLOADING" && <progress value={progress} max={100} aria-label="Progres upload foto" className="h-1.5 w-full accent-primary" />}
    </div>}
    {file && !duplicateId && stage !== "SUCCESS" && file.size <= MAX_PHOTO_BYTES && <Button disabled={busy} onClick={() => upload()} className="w-full">
      {busy ? "Mengunggah…" : stage === "FAILED" ? "Lanjutkan upload" : "Unggah foto"}
    </Button>}
  </div>;
}
