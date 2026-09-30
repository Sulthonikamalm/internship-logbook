import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./get-current-user";
import type { AuthContext } from "./types";

/**
 * Requires an authenticated AND active user.
 * Used on all protected app boundaries.
 *
 * - Unauthenticated → redirect /login
 * - Authenticated but disabled → redirect /account-disabled
 * - Authenticated and active → returns AuthContext
 *
 * This check runs on EVERY protected request, not just at login time.
 */
export async function requireActiveUser(): Promise<AuthContext> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isActive) {
    redirect("/account-disabled");
  }

  return user;
}
