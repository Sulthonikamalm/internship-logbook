import { readJsonBody, JsonBodyError } from "@/lib/http/read-json";
import { z } from "zod";
import { jsonError } from "@/features/evidence/server/http";
import { inspectPhoto, MAX_PHOTO_BYTES } from "@/features/evidence/domain/photo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriveMetadata } from "@/lib/google-drive/metadata";
import { downloadDriveBytes } from "@/lib/google-drive/download";
import { deleteDriveFile } from "@/lib/google-drive/delete";
import { DriveError, driveMessage, logDriveError } from "@/lib/google-drive/errors";
import exifr from "exifr";
import { parseCaptureTime } from "../domain/capture-time";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeReportPreviews } from "@/lib/photos/report-preview-storage.mjs";



const inputSchema = z.object({
  uploadId: z.uuid(), driveFileId: z.string().min(1).max(256),
}).strict();

export async function finalizePhotoUpload(request: Request, user: { userId: string; timezone: string }, supabase: SupabaseClient): Promise<Response> {
  let raw: unknown;
  try { raw = await readJsonBody(request, 1024); }
  catch (error) { return jsonError(error instanceof JsonBodyError ? error.message : "Permintaan tidak valid.", error instanceof JsonBodyError ? error.status : 400); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Data upload tidak valid.", 400);
  const { uploadId, driveFileId } = parsed.data;
  const { data: evidence, error: evidenceError } = await supabase.from("evidences")
    .select("id,status,captured_at,metadata").eq("user_id", user.userId).eq("upload_id", uploadId)
    .eq("type", "PHOTO").is("deleted_at", null).maybeSingle();
  if (evidenceError) return jsonError("Upload gagal diperiksa.", 503);
  if (!evidence) return jsonError("Upload tidak tersedia.", 404);
  if (evidence.status === "AVAILABLE") {
    const { data: photo } = await supabase.from("photo_evidences")
      .select("drive_file_id").eq("evidence_id", evidence.id).maybeSingle();
    if (photo?.drive_file_id === driveFileId) {
      return Response.json({ ok: true, evidenceId: evidence.id },
        { headers: { "Cache-Control": "no-store" } });
    }
    return jsonError("Upload ini sudah selesai dengan file lain.", 409);
  }
  if (evidence.status !== "UPLOADING") return jsonError("Upload tidak aktif.", 409);
  const { data: session, error: sessionError } = await supabase.from("photo_upload_sessions")
    .select("expected_size,expected_mime,expected_checksum,stored_filename,drive_folder_id")
    .eq("evidence_id", evidence.id).eq("user_id", user.userId).maybeSingle();
  if (sessionError || !session?.drive_folder_id) return jsonError("Sesi upload tidak tersedia.", 409);
  const evidenceId = evidence.id;
  const userId = user.userId;

  let verified = false;
  async function cleanUp(reason: string): Promise<Response> {
    if (!verified) return jsonError("File upload tidak sesuai dengan sesi Anda.", 404);
    try {
      await deleteDriveFile(driveFileId);
      await supabase.from("evidences").update({ status: "FAILED" })
        .eq("id", evidenceId).eq("user_id", userId);
      return jsonError(reason, 422, "UPLOAD_FAILED");
    } catch {
      await supabase.from("evidences").update({ status: "ORPHANED",
        metadata: { pending_drive_file_id: driveFileId } })
        .eq("id", evidenceId).eq("user_id", userId);
      const { error: jobError } = await supabase.rpc("record_storage_reconciliation", {
        p_evidence_id: evidenceId, p_drive_file_id: driveFileId,
        p_reason: "UPLOAD_FINALIZE_FAILED", p_error: reason,
      });
      if (jobError) console.error(`[evidence.reconciliation] database code=${jobError.code}`);
      return jsonError("Foto tersimpan di Drive, tetapi finalisasi gagal. Pengelola perlu merekonsiliasi file.",
        503, "RECONCILIATION_REQUIRED");
    }
  }

  try {
    const remote = await getDriveMetadata(driveFileId);
    verified = remote.appProperties?.internflowEvidenceId === evidence.id
      && remote.appProperties?.internflowUserId === user.userId
      && remote.parents?.includes(session.drive_folder_id) === true
      && remote.name === session.stored_filename;
    if (!verified) return jsonError("File upload tidak sesuai dengan sesi Anda.", 404);
    if (Number(remote.size) !== session.expected_size || remote.mimeType !== session.expected_mime) {
      return cleanUp("Ukuran atau format foto berubah saat upload.");
    }
    const bytes = await downloadDriveBytes(driveFileId, MAX_PHOTO_BYTES);
    let inspection: Awaited<ReturnType<typeof inspectPhoto>>;
    try { inspection = await inspectPhoto(bytes, session.expected_mime); }
    catch { return cleanUp("Isi foto tidak valid atau rusak."); }
    if (!session.expected_checksum || inspection.checksum !== session.expected_checksum) {
      return cleanUp("Isi foto berubah selama upload.");
    }
    if (!evidence.captured_at) {
      const exif = await exifr.parse(Buffer.from(bytes), { pick: ["DateTimeOriginal", "OffsetTimeOriginal"], reviveValues: false }).catch(() => null);
      const capturedAt = parseCaptureTime(exif?.DateTimeOriginal, exif?.OffsetTimeOriginal, user.timezone);
      if (capturedAt) {
        const result = await supabase.from("evidences").update({ captured_at: capturedAt,
          metadata: { ...evidence.metadata, capturedAtSource: "EXIF" } }).eq("id", evidence.id).eq("user_id", user.userId);
        if (result.error) return jsonError("Tanggal foto belum tersimpan. Coba finalisasi lagi.", 503);
      }
    }
    const { error } = await supabase.rpc("finalize_photo_evidence", {
      p_evidence_id: evidence.id, p_drive_file_id: driveFileId,
      p_drive_folder_id: session.drive_folder_id, p_mime_type: inspection.mime,
      p_size_bytes: bytes.length, p_checksum: inspection.checksum,
      p_width: inspection.width, p_height: inspection.height,
    });
    if (error) {
      console.error(`[evidence.finalize] database code=${error.code}`);
      return cleanUp("Metadata foto gagal disimpan.");
    }
    after(async () => {
      try { await storeReportPreviews(createAdminClient(), userId, evidenceId, inspection.checksum, bytes); }
      catch { console.error("[report.preview] Background preview generation failed; it can be retried on demand."); }
    });
    return Response.json({ ok: true, evidenceId: evidence.id },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logDriveError("photo.finalize", error);
    if (error instanceof DriveError && error.code === "NOT_FOUND") {
      await supabase.from("evidences").update({ status: "FAILED" })
        .eq("id", evidence.id).eq("user_id", user.userId);
      return jsonError("File upload tidak ditemukan di Drive. Pilih ulang foto.", 404);
    }
    const message = error instanceof DriveError ? driveMessage(error.code, error.reason) : "Finalisasi foto gagal. Coba lagi.";
    return jsonError(message, 503, "DRIVE_UNAVAILABLE");
  }
}
