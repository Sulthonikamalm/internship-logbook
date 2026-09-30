import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Creates an elevated Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * STRICTLY SERVER-SIDE ONLY.
 * NEVER call or expose to browser.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("❌ createAdminClient cannot be called from the browser!");
  }

  const env = getServerEnv();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "❌ SUPABASE_SERVICE_ROLE_KEY is required for admin client operations but is not defined in environment variables."
    );
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
