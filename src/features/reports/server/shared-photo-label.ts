import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The unguessable report/photo URL identifies its display label only.
 * Image bytes still require the separate bearer token, checked on every request.
 * Do not cache grants: revoked, expired, disabled and deleted records disappear immediately. */
export async function getSharedPhotoLabel(shareId: string, evidenceId: string): Promise<string> {
  if (!uuid.test(shareId) || !uuid.test(evidenceId)) return "";
  const result = await createAdminClient().from("report_photo_share_evidences").select(`
    share:report_photo_shares!inner(owner:profiles!inner(display_name)), evidence:evidences!inner(id)
  `).eq("share_id", shareId).eq("evidence_id", evidenceId)
    .is("share.revoked_at", null).not("share.activated_at", "is", null)
    .gt("share.expires_at", new Date().toISOString()).eq("share.owner.is_active", true)
    .eq("evidence.type", "PHOTO").eq("evidence.status", "AVAILABLE").is("evidence.deleted_at", null)
    .maybeSingle<{ share: { owner: { display_name: string } } }>();
  if (result.error || !result.data) return "";
  return result.data.share.owner.display_name.trim();
}
