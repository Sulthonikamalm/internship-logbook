import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

/**
 * Creates a Supabase client for use in browser Client Components.
 * Uses getClientEnv() to ensure valid Supabase URL and Anon Key.
 */
export function createClient() {
  const env = getClientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
