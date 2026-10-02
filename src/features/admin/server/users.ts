"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createManagedUserSchema } from "../schemas/user";

export async function createManagedUser(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await getCurrentUser();
  if (!actor?.isActive || !actor.isSuperAdmin) return { ok: false, message: "Akses pengelolaan pengguna tidak tersedia." };
  const parsed = createManagedUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Periksa data pengguna." };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { name: parsed.data.name } });
  if (error || !data.user) {
    console.error(`[admin.createUser] code=${error?.code ?? "unknown"}`);
    return { ok: false, message: error?.code === "email_exists" ? "Email ini sudah terdaftar." : "Pengguna belum dapat dibuat. Periksa email dan coba lagi." };
  }
  // Verify provisioning before reporting success. No credentials go into logs or audit metadata.
  const profile = await admin.from("profiles").select("id").eq("id", data.user.id).single();
  if (profile.error || !profile.data) {
    const rollback = await admin.auth.admin.deleteUser(data.user.id);
    console.error(`[admin.provisioning] profile=${profile.error?.code ?? "missing"} rollback=${rollback.error?.code ?? "ok"}`);
    return { ok: false, message: "Profil belum dapat disiapkan. Coba lagi." };
  }
  const audit = await admin.from("audit_logs").insert({ actor_user_id: actor.userId, entity_type: "profile", entity_id: data.user.id, action: "user.created", metadata: { method: "dashboard" } });
  if (audit.error) console.error(`[admin.audit] code=${audit.error.code}`);
  revalidatePath("/admin/users");
  return { ok: true };
}
