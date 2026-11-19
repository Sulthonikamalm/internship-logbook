import { activeApiUser, jsonError, sameOrigin } from "@/features/evidence/server/http";
import { createClient } from "@/lib/supabase/server";
import { startPhotoUpload } from "@/features/evidence/server/photo-start";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const user = await activeApiUser();
  if (!user) return jsonError("Sesi berakhir. Masuk kembali untuk melanjutkan upload.", 401, "SESSION_EXPIRED");
  return startPhotoUpload(request, user, await createClient());
}
