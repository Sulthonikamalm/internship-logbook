import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "./types";
import { parseRole, parseTimezone } from "./types";

/**
 * Retrieves the current authenticated user and their profile.
 * Returns null if no session or no profile found.
 *
 * Uses server-side Supabase client — identity comes from the session cookie,
 * NEVER from browser-supplied user_id.
 */
export async function getCurrentUser(): Promise<AuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role, is_active, timezone, content_read_all")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Profile should exist via provisioning trigger.
    // If missing, return null so caller can handle gracefully.
    console.error(
      `[getCurrentUser] Profile missing for user ${user.id}. Trigger may have failed.`
    );
    return null;
  }

  return {
    userId: user.id,
    displayName: profile.display_name,
    role: parseRole(profile.role),
    isActive: Boolean(profile.is_active),
    timezone: parseTimezone(profile.timezone),
    contentReadAll: Boolean(profile.content_read_all),
  };
}
