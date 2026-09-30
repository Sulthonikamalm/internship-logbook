"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorCode, createAppError, type AppError } from "@/lib/errors";

export type LogoutState = {
  success: boolean;
  error?: AppError;
};

/**
 * Server Action: logout the current user.
 *
 * - Signs out via Supabase
 * - On success, redirects to /login
 * - On failure, returns controlled error state
 *   (does NOT claim session terminated if it wasn't)
 * - No data deletion on failure
 */
export async function logoutAction(): Promise<LogoutState> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.INTERNAL_ERROR,
          `Logout failed: ${error.message}`
        ),
      };
    }
  } catch (err) {
    // Don't claim logout succeeded if it didn't
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: createAppError(ErrorCode.INTERNAL_ERROR, `Logout exception: ${message}`),
    };
  }

  // Only redirect after confirmed sign-out
  redirect("/login");
}
