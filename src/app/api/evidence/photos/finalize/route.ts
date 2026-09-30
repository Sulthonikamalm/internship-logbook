import { z } from "zod";
import { activeApiUser, jsonError, sameOrigin } from "@/features/evidence/server/http";
import { inspectPhoto, MAX_PHOTO_BYTES } from "@/features/evidence/domain/photo";
import { createClient } from "@/lib/supabase/server";
import { getDriveMetadata } from "@/lib/google-drive/metadata";
import { downloadDriveBytes } from "@/lib/google-drive/download";
import { deleteDriveFile } from "@/lib/google-drive/delete";
import { DriveError, driveMessage } from "@/lib/google-drive/errors";

export const runtime = "nodejs";

const inputSchema = z.object({
  uploadId: z.uuid(), driveFileId: z.string().min(1).max(256),
}).strict();

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const user = await activeApiUser();
  if (!user) return jsonError("Sesi berakhir. Masuk kembali untuk menyelesaikan upload.", 401, "SESSION_EXPIRED");
  if (Number(request.headers.get("content-length")) > 1024) return jsonError("Permintaan terlalu besar.", 413);
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Permintaan tidak valid.", 400); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Data upload tidak valid.", 400);
  const { uploadId, driveFileId } = parsed.data;
  const supabase = await createClient();
  const { data: evidence, error: evidenceError } = await supabase.from("evidences")
    .select("id,status").eq("user_id", user.userId).eq("upload_id", uploadId)
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
    return Response.json({ ok: true, evidenceId: evidence.id },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DriveError && error.code === "NOT_FOUND") {
      await supabase.from("evidences").update({ status: "FAILED" })
        .eq("id", evidence.id).eq("user_id", user.userId);
      return jsonError("File upload tidak ditemukan di Drive. Pilih ulang foto.", 404);
    }
    const message = error instanceof DriveError ? driveMessage(error.code) : "Finalisasi foto gagal. Coba lagi.";
    return jsonError(message, 503, "DRIVE_UNAVAILABLE");
  }
}
