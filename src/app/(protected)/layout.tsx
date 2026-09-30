import { requireActiveUser } from "@/lib/auth/require-active-user";
import { AppShell } from "@/components/layout/app-shell";
import type { AuthContext } from "@/lib/auth/types";
import React from "react";

/**
 * React context for auth data within the protected layout.
 * Passed from server layout to client components via serializable props.
 */
export type ProtectedLayoutContext = {
  user: AuthContext;
};

/**
 * Protected layout — server-side auth boundary.
 *
 * Flow:
 * 1. Get session
 * 2. Require authenticated user
 * 3. Check is_active
 * 4. Render app shell
 *
 * If unauthenticated → redirect /login
 * If disabled → redirect /account-disabled
 * No client-side useEffect redirect after private UI renders.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check — runs before ANY protected content renders
  const user = await requireActiveUser();

  return (
    <AppShell>
      {/* Pass user context to children via cloneElement or context provider */}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{ user?: AuthContext }>,
            { user }
          );
        }
        return child;
      })}
    </AppShell>
  );
}
