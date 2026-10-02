import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
export async function listManagedUsers(page: number) {
  const actor = await getCurrentUser();
  if (!actor?.isActive || !actor.isSuperAdmin) notFound();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 });
  if (error) throw new Error("Daftar pengguna gagal dimuat.");
  const users = data.users;
  const profiles = users.length ? await admin.from("profiles").select("id,display_name,is_active").in("id", users.map(user => user.id)) : { data: [], error: null };
  if (profiles.error) throw new Error("Profil pengguna gagal dimuat.");
  const byId = new Map(profiles.data?.map(profile => [profile.id, profile]));
  return { total: data.total, nextPage: data.nextPage, users: users.map(user => ({ id: user.id, email: user.email ?? "—", name: byId.get(user.id)?.display_name ?? "Pengguna", active: byId.get(user.id)?.is_active ?? false, createdAt: user.created_at, lastSignIn: user.last_sign_in_at ?? null })) };
}
