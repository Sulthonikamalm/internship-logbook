import { activeApiUser, jsonError } from "@/features/evidence/server/http";
import { createClient } from "@/lib/supabase/server";
import { getDriveMetadata } from "@/lib/google-drive/metadata";
import { downloadDriveBytes, downloadDriveFile } from "@/lib/google-drive/download";
import { DriveError } from "@/lib/google-drive/errors";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await activeApiUser();
  if (!user) return jsonError("Masuk kembali untuk melihat foto.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Foto tidak tersedia.", 404);
  const supabase = await createClient();
  const { data: evidence, error: evidenceError } = await supabase.from("evidences")
    .select("id,status").eq("id", id).eq("user_id", user.userId)
    .eq("type", "PHOTO").is("deleted_at", null).maybeSingle();
  if (evidenceError) return jsonError("Foto gagal dimuat.", 503);
  if (!evidence || evidence.status !== "AVAILABLE") return jsonError("Foto tidak tersedia.", 404);
  const { data: photo, error: photoError } = await supabase.from("photo_evidences")
    .select("drive_file_id,drive_folder_id,mime_type,size_bytes,stored_filename")
    .eq("evidence_id", id).maybeSingle();
  if (photoError) return jsonError("Foto gagal dimuat.", 503);
  if (!photo) return jsonError("Foto tidak tersedia.", 404);

  try {
    const remote = await getDriveMetadata(photo.drive_file_id);
    if (remote.appProperties?.internflowEvidenceId !== id
        || remote.appProperties?.internflowUserId !== user.userId
        || remote.parents?.includes(photo.drive_folder_id) !== true
        || remote.name !== photo.stored_filename
        || remote.mimeType !== photo.mime_type
        || Number(remote.size) !== photo.size_bytes) {
      return jsonError("Foto tidak tersedia.", 404);
    }
    if (new URL(request.url).searchParams.get("thumb") === "1") {
      const bytes = await downloadDriveBytes(photo.drive_file_id, 15 * 1024 * 1024);
      const thumbnail = await sharp(Buffer.from(bytes), { failOn: "error", limitInputPixels: 40_000_000 })
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      return new Response(new Uint8Array(thumbnail), { headers: {
        "Content-Type": "image/webp", "Content-Length": String(thumbnail.length),
        "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      } });
    }
    const stream = await downloadDriveFile(photo.drive_file_id);
    if (!stream.body) return jsonError("Foto gagal dimuat.", 503);
    return new Response(stream.body, { status: 200, headers: {
      "Content-Type": photo.mime_type,
      "Content-Length": String(photo.size_bytes),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    if (error instanceof DriveError && error.code === "NOT_FOUND") {
      await supabase.from("evidences").update({ status: "BROKEN" })
        .eq("id", id).eq("user_id", user.userId).eq("status", "AVAILABLE");
      return jsonError("Foto sudah tidak ada di Drive.", 404, "BROKEN");
    }
    return jsonError("Foto belum dapat dimuat. Coba lagi.", 503);
  }
}
