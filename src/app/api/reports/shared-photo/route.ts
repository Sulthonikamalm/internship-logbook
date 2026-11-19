import { createAdminClient } from "@/lib/supabase/admin";
import { hashReportToken } from "@/features/reports/server/report-photo-shares";
import type { StoredPhoto } from "@/features/evidence/server/verify-drive-photo";
import { getSharedPhotoPreview } from "@/features/reports/server/shared-photo-preview";
import { DriveError } from "@/lib/google-drive/errors";

export const runtime = "nodejs";
const notAvailable = () => Response.json({ message: "Tautan berakhir, dicabut, atau foto tidak tersedia." }, { status: 404, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenFormat = /^[A-Za-z0-9_-]{43}$/;
type SharedPhotoGrant = {
  share: { user_id: string; owner: { display_name: string } };
  evidence: { id: string; photo: StoredPhoto & { checksum: string } };
};

/** A recipient needs only the grant contained in their exported workbook. */
export async function POST(request: Request): Promise<Response> {
  try {
    const startedAt = performance.now();
    if (Number(request.headers.get("content-length") || 0) > 1024) return notAvailable();
    const raw = await request.text();
    if (raw.length > 1024) return notAvailable();
    const body = JSON.parse(raw) as Record<string, unknown>;
    const { shareId, evidenceId, token } = body;
    const maxWidth = body.maxWidth ?? 1920;
    if (typeof shareId !== "string" || !uuid.test(shareId) || typeof evidenceId !== "string" || !uuid.test(evidenceId)
      || typeof token !== "string" || !tokenFormat.test(token) || (maxWidth !== 960 && maxWidth !== 1920)) return notAvailable();
    const admin = createAdminClient();
    // Composite foreign keys join each grant and photo through the same owner.
    const grant = await admin.from("report_photo_share_evidences").select(`
      share:report_photo_shares!inner(user_id,owner:profiles!inner(display_name)),
      evidence:evidences!inner(id,photo:photo_evidences!inner(drive_file_id,drive_folder_id,mime_type,size_bytes,stored_filename,checksum))
    `).eq("share_id", shareId).eq("evidence_id", evidenceId)
      .eq("share.token_hash", hashReportToken(token)).is("share.revoked_at", null)
      .not("share.activated_at", "is", null).gt("share.expires_at", new Date().toISOString())
      .eq("share.owner.is_active", true).eq("evidence.type", "PHOTO").eq("evidence.status", "AVAILABLE")
      .is("evidence.deleted_at", null).maybeSingle<SharedPhotoGrant>();
    if (grant.error || !grant.data) return notAvailable();
    const authorizedAt = performance.now();
    const preview = await getSharedPhotoPreview(evidenceId, grant.data.share.user_id, grant.data.evidence.photo, maxWidth);
    if (!preview) return notAvailable();
    return new Response(preview.bytes, { headers: {
      "Content-Type": "image/webp", "Content-Length": String(preview.bytes.byteLength),
      "X-InternFlow-Owner-Name": encodeURIComponent(grant.data.share.owner.display_name.trim()),
      "X-InternFlow-Photo-Width": String(preview.width), "X-InternFlow-Photo-Height": String(preview.height),
      "Server-Timing": `grant;dur=${(authorizedAt - startedAt).toFixed(1)}, photo;dur=${(performance.now() - authorizedAt).toFixed(1)}`,
      "Content-Disposition": "inline", "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DriveError && error.code === "NOT_FOUND") return notAvailable();
    return Response.json({ message: "Foto belum dapat dimuat. Coba lagi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
