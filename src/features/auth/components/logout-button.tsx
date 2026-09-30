"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions/logout";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await logoutAction();
      if (!result.success) setError(result.error?.message ?? "Gagal keluar. Coba lagi.");
    } catch {
      setError("Gagal keluar. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        aria-label={compact ? "Keluar" : undefined}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {!compact && (pending ? "Memproses..." : "Keluar")}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
