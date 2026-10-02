import { requireActiveUser } from "@/lib/auth/require-active-user";
import { AppShell } from "@/components/layout/app-shell";

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
    <AppShell displayName={user.displayName} isSuperAdmin={user.isSuperAdmin}>
      {children}
    </AppShell>
  );
}
