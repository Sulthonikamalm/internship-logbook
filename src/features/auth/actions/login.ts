"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginSchema } from "../schemas/login";
import { safeLoginRedirect } from "@/lib/auth/safe-redirect";
import { ErrorCode, createAppError, mapToAppError, type AppError } from "@/lib/errors";

export type LoginState = {
  success: boolean;
  error?: AppError;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

/**
 * Server Action: login with email and password.
 *
 * Security:
 * - Generic error message on auth failure (no email enumeration)
 * - Trim email, do NOT trim password
 * - Validate with Zod before hitting Supabase
 * - Returns safe redirect path
 */
export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error: createAppError(ErrorCode.VALIDATION_ERROR),
      fieldErrors: {
        email: fieldErrors.email,
        password: fieldErrors.password,
      },
    };
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Generic failure — never reveal if email exists
      return {
        success: false,
        error: {
          code: ErrorCode.UNAUTHENTICATED,
          message: "Email atau password tidak valid.",
        },
      };
    }

  } catch (err) {
    return {
      success: false,
      error: mapToAppError(err),
    };
  }

  // Next redirects throw; keep this outside error handling and let the action
  // navigate after persisting cookies, without a competing client refresh.
  redirect(safeLoginRedirect(formData.get("next")));
}
