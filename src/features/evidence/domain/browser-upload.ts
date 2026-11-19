import { prepareBrowserPhoto } from "./browser-photo";
class SessionExpiredError extends Error {}
async function serverJson(url: string, body: object) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (response.status === 401) throw new Error("Sesi berakhir. Masuk kembali, lalu coba dengan foto yang sama.");
  const payload = await response.json() as Record<string, unknown>;
  if (response.status === 429) throw new Error(`Batas upload tercapai. Coba lagi setelah ${payload.retryAt || "beberapa saat"}.`);
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


export async function uploadBrowserPhoto(file: File, uploadId: string, options: {
  decision?: "use_existing" | "upload_again"; capturedAt?: string;
  onProgress: (percent: number) => void; onFinalizing: () => void;
}): Promise<{ evidenceId: string } | { duplicateId: string }> {
  const prepared = await prepareBrowserPhoto(file);
  const { response, payload } = await serverJson("/api/evidence/photos/start", {
    uploadId, size: prepared.size, mimeType: prepared.mimeType,
    originalFilename: file.name, checksum: prepared.checksum,
    duplicateDecision: options.decision, capturedAt: options.capturedAt,
  });
  if (response.status === 409 && payload.code === "DUPLICATE")
    return { duplicateId: String(payload.duplicateEvidenceId) };
  if (!response.ok) throw new Error(String(payload.message || "Upload gagal dimulai."));
  const evidenceId = String(payload.evidenceId);
  if (payload.kind !== "EXISTING") {
    const driveFileId = payload.kind === "FINALIZE" ? String(payload.driveFileId)
      : await putToDrive(String(payload.sessionUrl), file, prepared.mimeType, options.onProgress);
    options.onFinalizing();
    const final = await serverJson("/api/evidence/photos/finalize", { uploadId, driveFileId });
    if (!final.response.ok) throw new Error(String(final.payload.message || "Finalisasi foto gagal."));
  }
  return { evidenceId };
}
