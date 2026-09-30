import { z } from "zod";

/**
 * Client-side environment variables schema.
 * All client variables MUST be prefixed with NEXT_PUBLIC_.
 * Safe to import from Client Components.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates and returns client environment variables.
 * Safe to call from client and server components.
 * Logs only env variable NAMES on failure, never values.
 */
export function getClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join("."));
    console.error(
      "❌ Invalid client environment variables:",
      missing.join(", ")
    );
    throw new Error(
      "Client environment validation failed. Check your environment variables."
    );
  }

  return result.data;
}
