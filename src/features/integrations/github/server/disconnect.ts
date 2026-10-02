import "server-only";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createAdminClient } from "@/lib/supabase/admin";
export async function disconnectGitHub(): Promise<{ ok: boolean; message: string }> {
  const user = await requireActiveUser();
  const { error } = await createAdminClient().rpc("disconnect_github", { p_user_id: user.userId });
  if (error) return { ok: false, message: "Koneksi belum diputus. Coba lagi." };
  revalidatePath("/integrations"); revalidatePath("/dashboard");
  return { ok: true, message: "GitHub diputus. Evidence historis tetap tersimpan." };
}
