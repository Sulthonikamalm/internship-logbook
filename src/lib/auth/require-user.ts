import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./get-current-user";
import type { AuthContext } from "./types";

/**
 * Requires an authenticated user with a valid profile.
 * Redirects to login if not authenticated.
 *
 * Does NOT check is_active — use requireActiveUser() for protected app routes.
 */
export async function requireUser(): Promise<AuthContext> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
