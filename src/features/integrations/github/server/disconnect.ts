import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function disconnectGitHub(): Promise<{ ok: boolean; message: string }> {
  const user = await requireActiveUser();
  const userClient = await createClient();
  const adminClient = createAdminClient();

  const now = new Date().toISOString();

  // 1. Delete token from secure github_tokens table
  const { error: tokenDeleteError } = await adminClient
    .from("github_tokens")
    .delete()
    .eq("user_id", user.userId);

  if (tokenDeleteError) {
    console.error("Failed to delete github token on disconnect:", tokenDeleteError.message);
  }

  // 2. Update connection status to DISCONNECTED (retaining connection ID and metadata)
  const { error: connError } = await userClient
    .from("github_connections")
    .update({
      connection_status: "DISCONNECTED",
      updated_at: now,
    })
    .eq("user_id", user.userId);

  if (connError) {
    return { ok: false, message: "Gagal memutuskan koneksi GitHub. Coba lagi." };
  }

  // 3. Log audit event
  try {
    await userClient.from("audit_logs").insert({
      user_id: user.userId,
      action: "GITHUB_DISCONNECTED",
      details: {
        retained_historical_evidence: true,
      },
      created_at: now,
    });
  } catch {
    // Non-critical audit failure
  }

  return {
    ok: true,
    message: "Koneksi GitHub berhasil diputuskan. Bukti commit yang sudah terlampir tetap tersimpan aman.",
  };
}
