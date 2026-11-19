import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/env/client";
import { parseRole, parseTimezone, type AuthContext } from "@/lib/auth/types";

export type AgentActor = { db: SupabaseClient; user: AuthContext };
export class AgentError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID_REQUEST") { super(message); }
}
export async function authenticateAgent(request: Request): Promise<AgentActor> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.match(/^Bearer [^\s]+$/)) throw new AgentError("Login lokal diperlukan.", 401, "UNAUTHENTICATED");
  const env = getClientEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new AgentError("Sesi lokal berakhir. Login kembali.", 401, "UNAUTHENTICATED");
  const result = await db.from("profiles").select("display_name,role,is_active,timezone,content_read_all").eq("id", data.user.id).single();
  if (result.error || !result.data?.is_active) throw new AgentError("Akun tidak tersedia atau dinonaktifkan.", 403, "FORBIDDEN");
  return { db, user: { userId: data.user.id, displayName: result.data.display_name, role: parseRole(result.data.role),
    timezone: parseTimezone(result.data.timezone), isActive: true, contentReadAll: false } };
}
