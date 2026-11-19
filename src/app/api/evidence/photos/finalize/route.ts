import { activeApiUser, jsonError, sameOrigin } from "@/features/evidence/server/http";
import { createClient } from "@/lib/supabase/server";
import { finalizePhotoUpload } from "@/features/evidence/server/photo-finalize";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const user = await activeApiUser();
  if (!user) return jsonError("Sesi berakhir. Masuk kembali untuk melanjutkan upload.", 401, "SESSION_EXPIRED");
  return finalizePhotoUpload(request, user, await createClient());
}
