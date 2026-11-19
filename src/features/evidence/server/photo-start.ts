import { readJsonBody, JsonBodyError } from "@/lib/http/read-json";
import { z } from "zod";
import { jsonError } from "@/features/evidence/server/http";
import { MAX_PHOTO_BYTES, extensionForMime, safeOriginalFilename } from "@/features/evidence/domain/photo";
import { localDateAt } from "@/features/activity/domain/date";
import { photoName } from "@/features/evidence/domain/photo-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUserMonthFolder } from "@/lib/google-drive/metadata";
import { initiatePhotoUpload, isDriveUploadSessionUrl, probePhotoUpload } from "@/lib/google-drive/upload";
import { DriveError, driveMessage, logDriveError } from "@/lib/google-drive/errors";



const inputSchema = z.object({
  uploadId: z.uuid(), size: z.number().int().min(1).max(MAX_PHOTO_BYTES),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  originalFilename: z.string().max(255),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  duplicateDecision: z.enum(["use_existing", "upload_again"]).optional(),
  resetSession: z.boolean().optional(),
  capturedAt: z.iso.datetime({ offset: true }).optional(),
  provenance: z.object({ commitId: z.uuid(), kind: z.enum(["APP_SCREENSHOT", "CODE_DIFF"]), path: z.string().max(512) }).strict().optional(),
}).strict();

export async function startPhotoUpload(request: Request, user: { userId: string; timezone: string }, supabase: SupabaseClient): Promise<Response> {
  let raw: unknown;
  try { raw = await readJsonBody(request, 4096); }
  catch (error) { return jsonError(error instanceof JsonBodyError ? error.message : "Permintaan tidak valid.", error instanceof JsonBodyError ? error.status : 400); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Format, ukuran, atau data foto tidak valid.", 400);
  const input = parsed.data;

  const { data: previous, error: previousError } = await supabase.from("evidences")
    .select("id,status,captured_at,metadata").eq("user_id", user.userId).eq("upload_id", input.uploadId).maybeSingle();
  if (previousError) return jsonError("Sesi upload gagal diperiksa.", 503);
  if (previous?.status === "AVAILABLE") {
    return Response.json({ ok: true, kind: "EXISTING", evidenceId: previous.id });
  }
  if (previous && !["UPLOADING", "FAILED"].includes(previous.status)) {
    return jsonError("Sesi upload ini tidak tersedia.", 409);
  }
  if (previous) {
    const { data: saved } = await supabase.from("photo_upload_sessions")
      .select("session_url,expires_at,expected_size,expected_mime,expected_checksum")
      .eq("evidence_id", previous.id).eq("user_id", user.userId).maybeSingle();
    if (saved && (saved.expected_size !== input.size || saved.expected_mime !== input.mimeType
      || saved.expected_checksum !== input.checksum)) {
      return jsonError("Foto untuk percobaan ini berbeda. Pilih ulang file.", 409);
    }
    if (input.capturedAt && previous.captured_at !== input.capturedAt) {
      const corrected = await supabase.from("evidences").update({ captured_at: input.capturedAt,
        metadata: { ...previous.metadata, capturedAtSource: "MANUAL" } }).eq("id", previous.id).eq("user_id", user.userId);
      if (corrected.error) return jsonError("Koreksi tanggal belum tersimpan. Coba lagi.", 503);
    }
    if (previous.status === "UPLOADING" && saved?.session_url
        && isDriveUploadSessionUrl(saved.session_url)) {
      // The upload can finish at Drive even when the browser loses the response.
      // Probe every retry before offering the session again.
        try {
          const state = await probePhotoUpload(saved.session_url, input.size);
          if (state.kind === "COMPLETE") return Response.json({ ok: true, kind: "FINALIZE",
            evidenceId: previous.id, driveFileId: state.fileId },
            { headers: { "Cache-Control": "no-store" } });
          if (state.kind === "ACTIVE") return Response.json({ ok: true, kind: "UPLOAD",
            evidenceId: previous.id, sessionUrl: saved.session_url },
            { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          logDriveError("photo.resume", error);
          return jsonError(error instanceof DriveError ? driveMessage(error.code, error.reason)
            : "Status upload belum dapat diperiksa. Coba lagi.", 503, "DRIVE_UNAVAILABLE");
        }
    }
  }

  if (!previous) {
    const { data: candidates, error: duplicateError } = await supabase.from("photo_evidences")
      .select("evidence_id").eq("checksum", input.checksum).limit(10);
    if (duplicateError) return jsonError("Foto duplikat gagal diperiksa.", 503);
    let duplicateId: string | null = null;
    for (const candidate of candidates ?? []) {
      const { data: evidence } = await supabase.from("evidences")
        .select("id").eq("id", candidate.evidence_id).eq("user_id", user.userId)
        .eq("status", "AVAILABLE").is("deleted_at", null).maybeSingle();
      if (evidence) { duplicateId = evidence.id; break; }
    }
    if (duplicateId && !input.duplicateDecision) {
      return Response.json({ ok: false, code: "DUPLICATE", duplicateEvidenceId: duplicateId,
        message: "Foto yang sama tampaknya sudah pernah diunggah." }, { status: 409 });
    }
    if (duplicateId && input.duplicateDecision === "use_existing") {
      return Response.json({ ok: true, kind: "EXISTING", evidenceId: duplicateId });
    }
  }

  let metadata: Record<string, unknown> = input.capturedAt ? { capturedAtSource: "MANUAL" } : {};
  if (input.provenance) {
    const { data: commit, error } = await supabase.from("github_commits")
      .select("id,repository_name,sha,author_date,commit_url").eq("id", input.provenance.commitId).eq("user_id", user.userId).maybeSingle();
    if (error || !commit) return jsonError("Commit tidak tersedia.", 404);
    metadata = { ...metadata, source: "github_reconstruction", ...input.provenance,
      repository: commit.repository_name, sha: commit.sha, commitDate: commit.author_date,
      commitUrl: commit.commit_url, generatedAt: input.capturedAt ?? new Date().toISOString() };
  }
  const evidenceId = previous?.id ?? crypto.randomUUID();
  const storedFilename = photoName(localDateAt(new Date(), user.timezone), evidenceId, extensionForMime(input.mimeType));
  if (!previous) {
    const { error } = await supabase.from("evidences").insert({
      id: evidenceId, user_id: user.userId, type: "PHOTO", status: "UPLOADING",
      title: input.provenance ? `Rekonstruksi ${metadata.repository} @ ${String(metadata.sha).slice(0, 8)}`.slice(0, 160) : storedFilename,
      captured_at: input.capturedAt ?? null, metadata,
      upload_id: input.uploadId,
    });
    if (error) {
      if (error.message.includes("upload rate limit") || error.message.includes("concurrent uploads")) {
        const retryAt = new Date(Date.now() + (error.message.includes("concurrent") ? 60000 : 3600000)).toISOString();
        return Response.json({ ok: false, code: "UPLOAD_LIMIT", message: "Batas upload tercapai. Coba lagi nanti.", retryAt },
          { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": error.message.includes("concurrent") ? "60" : "3600" } });
      }
      return jsonError("Penyimpanan gagal. Coba lagi.", 503);
    }
    const { error: sessionError } = await supabase.from("photo_upload_sessions").insert({
      evidence_id: evidenceId, user_id: user.userId, upload_id: input.uploadId,
      expected_size: input.size, expected_mime: input.mimeType,
      expected_checksum: input.checksum,
      original_filename: safeOriginalFilename(input.originalFilename), stored_filename: storedFilename,
    });
    if (sessionError) {
      await supabase.from("evidences").update({ status: "FAILED" }).eq("id", evidenceId);
      return jsonError("Sesi upload gagal dibuat.", 503);
    }
  } else if (previous.status === "FAILED") {
    const resumed = await supabase.from("evidences").update({ status: "UPLOADING" })
      .eq("id", evidenceId).eq("user_id", user.userId);
    if (resumed.error) return Response.json({ ok: false, code: "UPLOAD_LIMIT", message: "Upload belum dapat dilanjutkan. Tunggu sesi aktif selesai.", retryAt: new Date(Date.now() + 60000).toISOString() }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }

  let { data: session } = await supabase.from("photo_upload_sessions")
    .select("stored_filename").eq("evidence_id", evidenceId).eq("user_id", user.userId).single();
  if (!session && previous) {
    const { data: created } = await supabase.from("photo_upload_sessions").insert({
      evidence_id: evidenceId, user_id: user.userId, upload_id: input.uploadId,
      expected_size: input.size, expected_mime: input.mimeType,
      expected_checksum: input.checksum,
      original_filename: safeOriginalFilename(input.originalFilename), stored_filename: storedFilename,
    }).select("stored_filename").single();
    session = created;
  }
  if (!session) return jsonError("Sesi upload tidak tersedia.", 503);
  try {
    const folderId = await ensureUserMonthFolder(user.userId, localDateAt(new Date(), user.timezone));
    const sessionUrl = await initiatePhotoUpload({ evidenceId, userId: user.userId,
      folderId, storedFilename: session.stored_filename, mimeType: input.mimeType, size: input.size,
      origin: new URL(request.url).origin });
    const { error } = await supabase.from("photo_upload_sessions")
      .update({ drive_folder_id: folderId, session_url: sessionUrl,
        expires_at: new Date(Date.now() + 6 * 86400000).toISOString() })
      .eq("evidence_id", evidenceId).eq("user_id", user.userId);
    if (error) throw new Error("Session persistence failed");
    return Response.json({ ok: true, kind: "UPLOAD", evidenceId, sessionUrl },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logDriveError("photo.start", error);
    await supabase.from("evidences").update({ status: "FAILED" })
      .eq("id", evidenceId).eq("user_id", user.userId);
    const message = error instanceof DriveError ? driveMessage(error.code, error.reason) : "Sesi upload gagal dibuat. Coba lagi.";
    return jsonError(message, 503, "DRIVE_UNAVAILABLE");
  }
}
