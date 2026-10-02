import { createAdminClient } from "@/lib/supabase/admin";
import { hashReportToken } from "@/features/reports/server/report-photo-shares";
import { verifyDrivePhoto } from "@/features/evidence/server/verify-drive-photo";
import { downloadDriveFile } from "@/lib/google-drive/download";
import { DriveError } from "@/lib/google-drive/errors";

export const runtime = "nodejs";
const notAvailable = () => Response.json({ message: "Tautan berakhir, dicabut, atau foto tidak tersedia." }, { status: 404, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenFormat = /^[A-Za-z0-9_-]{43}$/;

/** A recipient needs only the grant contained in their exported workbook. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1024) return notAvailable();
    const raw = await request.text();
    if (raw.length > 1024) return notAvailable();
    const body = JSON.parse(raw) as Record<string, unknown>;
    const { shareId, evidenceId, token } = body;
    if (typeof shareId !== "string" || !uuid.test(shareId) || typeof evidenceId !== "string" || !uuid.test(evidenceId)
      || typeof token !== "string" || !tokenFormat.test(token)) return notAvailable();
    const admin = createAdminClient();
    const share = await admin.from("report_photo_shares").select("id,user_id")
      .eq("id", shareId).eq("token_hash", hashReportToken(token)).is("revoked_at", null)
      .not("activated_at", "is", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (share.error || !share.data) return notAvailable();
    const ownerId = share.data.user_id;
    const [owner, member, evidence, photo] = await Promise.all([
      admin.from("profiles").select("id").eq("id", ownerId).eq("is_active", true).maybeSingle(),
      admin.from("report_photo_share_evidences").select("evidence_id").eq("share_id", shareId).eq("user_id", ownerId).eq("evidence_id", evidenceId).maybeSingle(),
      admin.from("evidences").select("id").eq("id", evidenceId).eq("user_id", ownerId).eq("type", "PHOTO").eq("status", "AVAILABLE").is("deleted_at", null).maybeSingle(),
      admin.from("photo_evidences").select("drive_file_id,drive_folder_id,mime_type,size_bytes,stored_filename").eq("evidence_id", evidenceId).maybeSingle(),
    ]);
    if (owner.error || !owner.data || member.error || !member.data || evidence.error || !evidence.data || photo.error || !photo.data) return notAvailable();
    if (!await verifyDrivePhoto(evidenceId, ownerId, photo.data)) return notAvailable();
    const remote = await downloadDriveFile(photo.data.drive_file_id);
    if (!remote.body) return notAvailable();
    return new Response(remote.body, { headers: {
      "Content-Type": photo.data.mime_type, "Content-Length": String(photo.data.size_bytes),
      "Content-Disposition": "inline", "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DriveError && error.code === "NOT_FOUND") return notAvailable();
    return Response.json({ message: "Foto belum dapat dimuat. Coba lagi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
