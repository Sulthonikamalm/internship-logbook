"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function revokeReportPhotoShare(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user?.isActive) return { ok: false, message: "Sesi berakhir. Masuk kembali." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Tautan tidak tersedia." };
  const admin = createAdminClient();
  const result = await admin.from("report_photo_shares").update({ revoked_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.userId).not("activated_at", "is", null).is("revoked_at", null)
    .select("id").maybeSingle();
  if (result.error || !result.data) return { ok: false, message: "Tautan sudah tidak aktif." };
  await admin.from("audit_logs").insert({ actor_user_id: user.userId, entity_type: "report", entity_id: id, action: "report.share_revoked", metadata: {} });
  revalidatePath("/reports");
  return { ok: true };
}
