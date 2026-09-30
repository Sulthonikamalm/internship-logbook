import "server-only";

import { z } from "zod";
import { clientEnvSchema } from "./client";

/**
 * Server-side environment variables schema.
 * Extends client schema with secrets that MUST NOT be exposed to the browser.
 *
 * Guarded by `server-only` — importing from a Client Component will cause
 * a build-time error.
 */
export const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "test", "preview", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  // Supabase service-role key — strictly server-side
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Google Drive integration secrets
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),

});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates and returns server environment variables.
 * Call ONLY in Server Components, Route Handlers, or Server Actions.
 * Logs only env variable NAMES on failure, never values.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "❌ getServerEnv cannot be called from the browser! Protect secrets from leakage."
    );
  }

  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
    GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join("."));
    console.error(
      "❌ Invalid server environment variables:",
      missing.join(", ")
    );
    throw new Error(
      "Server environment validation failed. Check your environment variables."
    );
  }

  return result.data;
}
