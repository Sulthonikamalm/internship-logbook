"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressBrowserPhoto, prepareBrowserPhoto } from "../domain/browser-photo";
import { MAX_PHOTO_BYTES } from "../domain/photo-signature";

type Stage = "IDLE" | "QUEUED" | "VALIDATING" | "UPLOADING" | "FINALIZING" | "SUCCESS" | "FAILED";
type Props = { onUploaded?: (id: string) => void; compact?: boolean };
class SessionExpiredError extends Error {}

async function serverJson(url: string, body: object) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const payload = await response.json() as Record<string, unknown>;
  return { response, payload };
}

async function putToDrive(sessionUrl: string, file: File, mimeType: string): Promise<string> {
  const session = new URL(sessionUrl);
  if (session.protocol !== "https:" || session.hostname !== "www.googleapis.com"
      || session.pathname !== "/upload/drive/v3/files" || !session.searchParams.get("upload_id")) {
    throw new Error("Sesi upload tidak valid.");
  }
  const status = await fetch(sessionUrl, { method: "PUT", credentials: "omit",
    headers: { "Content-Range": `bytes */${file.size}` }, cache: "no-store" });
  if (status.status === 404) throw new SessionExpiredError("Sesi upload berakhir. Coba lagi dengan foto yang sama.");
  if (status.ok) {
    const completed = await status.json() as { id?: string };
    if (completed.id) return completed.id;
  }
  if (status.status !== 308 && !status.ok) {
    throw new Error("Status upload gagal diperiksa. Coba lagi.");
  }
  const received = status.status === 308 ? Number(status.headers.get("Range")?.split("-")[1] ?? -1) + 1 : 0;
  const start = Number.isFinite(received) && received >= 0 && received < file.size ? received : 0;
  const headers: Record<string, string> = { "Content-Type": mimeType };
  if (start > 0) headers["Content-Range"] = `bytes ${start}-${file.size - 1}/${file.size}`;
  const response = await fetch(sessionUrl, { method: "PUT", credentials: "omit",
    headers, body: file.slice(start), cache: "no-store" });
  if (response.status === 404) throw new SessionExpiredError("Sesi upload berakhir. Coba lagi dengan foto yang sama.");
  if (!response.ok) throw new Error("Upload Drive belum selesai. Coba lagi dengan foto yang sama.");
  const completed = await response.json() as { id?: string };
  if (!completed.id) throw new Error("Drive belum mengirim ID file. Coba lagi.");
  return completed.id;
}

export function PhotoUploader({ onUploaded, compact = false }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("IDLE");
  const [message, setMessage] = useState("");
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [resetSession, setResetSession] = useState(false);
  const uploadId = useRef(crypto.randomUUID());
  const busy = ["VALIDATING", "UPLOADING", "FINALIZING"].includes(stage);

  function select(selected: File | null) {
    setFile(selected); setStage(selected ? "QUEUED" : "IDLE"); setMessage("");
    setDuplicateId(null); setUploadedId(null); setResetSession(false); uploadId.current = crypto.randomUUID();
  }

  async function compress() {
    if (!file || busy) return;
    setStage("VALIDATING"); setMessage("");
    try { select(await compressBrowserPhoto(file)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Kompresi gagal."); setStage("FAILED"); }
  }

  async function upload(decision?: "use_existing" | "upload_again") {
    if (!file || busy) return;
    setStage("VALIDATING"); setMessage("");
    try {
      const prepared = await prepareBrowserPhoto(file);
      const { response, payload } = await serverJson("/api/evidence/photos/start", {
        uploadId: uploadId.current, size: prepared.size, mimeType: prepared.mimeType,
        originalFilename: file.name, checksum: prepared.checksum, duplicateDecision: decision,
        resetSession,
      });
      if (response.status === 409 && payload.code === "DUPLICATE") {
        setDuplicateId(String(payload.duplicateEvidenceId)); setStage("QUEUED"); return;
      }
      if (!response.ok) throw new Error(String(payload.message || "Upload gagal dimulai."));
      const evidenceId = String(payload.evidenceId);
      if (payload.kind === "EXISTING") {
        setUploadedId(evidenceId); setStage("SUCCESS"); onUploaded?.(evidenceId); router.refresh(); return;
      }
      let driveFileId: string;
      if (payload.kind === "FINALIZE") driveFileId = String(payload.driveFileId);
      else {
        setStage("UPLOADING");
        driveFileId = await putToDrive(String(payload.sessionUrl), file, prepared.mimeType);
      }
      setResetSession(false);
      setStage("FINALIZING");
      const final = await serverJson("/api/evidence/photos/finalize", {
        uploadId: uploadId.current, driveFileId,
      });
      if (!final.response.ok) throw new Error(String(final.payload.message || "Finalisasi foto gagal."));
      setUploadedId(evidenceId); setStage("SUCCESS"); onUploaded?.(evidenceId); router.refresh();
    } catch (error) {
      if (error instanceof SessionExpiredError) setResetSession(true);
      setMessage(error instanceof Error ? error.message : "Upload gagal. Coba lagi.");
      setStage("FAILED");
    }
  }

  return <div className="space-y-3 rounded-lg border bg-card p-4">
    <label className="block text-sm font-medium" htmlFor="evidence-photo">{compact ? "Ambil atau pilih foto" : "Foto evidence"}</label>
    <input id="evidence-photo" type="file" accept="image/jpeg,image/png,image/webp"
      onChange={(event) => select(event.target.files?.[0] ?? null)}
      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2" />
    {compact && <label className="inline-block cursor-pointer rounded-md border px-3 py-2 text-sm">
      Buka kamera
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
        onChange={(event) => select(event.target.files?.[0] ?? null)} className="sr-only" />
    </label>}
    {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
    {file && file.size > MAX_PHOTO_BYTES && <div className="space-y-2 text-sm">
      <p>Foto lebih besar dari 15 MB. Kompresi dapat mengecilkan gambar; periksa keterbacaan teks setelahnya.</p>
      <button type="button" disabled={busy} onClick={compress} className="text-primary underline">Kompres foto</button>
    </div>}
    {duplicateId && <div role="alert" className="rounded-md bg-secondary p-3 text-sm">
      <p>Foto yang sama sudah ada di Evidence Library.</p>
      <div className="mt-2 flex gap-3">
        <button type="button" disabled={busy} onClick={() => upload("use_existing")} className="font-semibold text-primary">Gunakan yang ada</button>
        <button type="button" disabled={busy} onClick={() => upload("upload_again")} className="font-semibold text-primary">Unggah lagi</button>
      </div>
    </div>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    {stage === "SUCCESS" && <p role="status" className="text-sm text-primary">Foto siap digunakan.{uploadedId && !onUploaded && " Tersimpan di Evidence Library."}</p>}
    {busy && <p role="status" className="text-sm text-muted-foreground">
      {stage === "VALIDATING" ? "Memeriksa foto..." : stage === "UPLOADING" ? "Mengunggah ke Drive..." : "Menyelesaikan metadata..."}
    </p>}
    {file && !duplicateId && stage !== "SUCCESS" && file.size <= MAX_PHOTO_BYTES &&
      <button type="button" disabled={busy} onClick={() => upload()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {stage === "FAILED" ? "Coba lagi" : "Unggah foto"}
      </button>}
  </div>;
}
