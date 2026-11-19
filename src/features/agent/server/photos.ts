import "server-only";
import sharp from "sharp";
import { downloadDriveBytes } from "@/lib/google-drive/download";
import { verifyDrivePhoto, type StoredPhoto } from "@/features/evidence/server/verify-drive-photo";
import { MAX_PHOTO_BYTES } from "@/features/evidence/domain/photo-signature";
import { relatedOne } from "@/lib/supabase/read-all-rows";
import { AgentError, type AgentActor } from "./auth";
import exifr from "exifr";
import { parseCaptureTime } from "@/features/evidence/domain/capture-time";

export async function readEvidenceThumbnail(actor: AgentActor, id: string) {
  const result = await actor.db.from("evidences").select("id,captured_at,metadata,photo_evidences(drive_file_id,drive_folder_id,mime_type,size_bytes,stored_filename)")
    .eq("id", id).eq("user_id", actor.user.userId).eq("type", "PHOTO").eq("status", "AVAILABLE").is("deleted_at", null).maybeSingle();
  const photo = relatedOne(result.data?.photo_evidences) as StoredPhoto | undefined;
  if (result.error || !photo || !await verifyDrivePhoto(id, actor.user.userId, photo)) throw new AgentError("Foto tidak tersedia.", 404, "PHOTO_UNAVAILABLE");
  const bytes = await downloadDriveBytes(photo.drive_file_id, MAX_PHOTO_BYTES);
  if (!result.data?.captured_at && result.data?.metadata?.source !== "github_reconstruction") {
    const exif = await exifr.parse(Buffer.from(bytes), { pick: ["DateTimeOriginal", "OffsetTimeOriginal"], reviveValues: false }).catch(() => null);
    const capturedAt = parseCaptureTime(exif?.DateTimeOriginal, exif?.OffsetTimeOriginal, actor.user.timezone);
    if (capturedAt) await actor.db.from("evidences").update({ captured_at: capturedAt, metadata: { ...result.data?.metadata, capturedAtSource: "EXIF" } })
      .eq("id", id).eq("user_id", actor.user.userId).is("captured_at", null);
  }
  return sharp(bytes).rotate().resize({ width: 640, height: 480, fit: "contain", background: "white" }).jpeg({ quality: 75 }).toBuffer();
}
