"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GitHubConnection } from "../types";
import { syncGitHubCommitsAction, disconnectGitHubAction } from "../server/actions";

export function ConnectionCard({ connection }: { connection: GitHubConnection | null }) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(
    null
  );

  const isConnected = connection?.connectionStatus === "CONNECTED";
  const isReauth = connection?.connectionStatus === "REAUTH_REQUIRED";

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncGitHubCommitsAction();
      if (!res.ok) {
        if (res.code === "RATE_LIMITED") {
          setFeedback({
            type: "warning",
            text: res.message,
          });
        } else if (res.code === "REAUTH_REQUIRED") {
          setFeedback({
            type: "error",
            text: res.message,
          });
        } else {
          setFeedback({
            type: "error",
            text: res.message || "Gagal menyinkronkan commit.",
          });
        }
      } else {
        setFeedback({
          type: "success",
          text: res.message || "Sinkronisasi commit berhasil.",
        });
      }
      router.refresh();
    } catch {
      setFeedback({ type: "error", text: "Terjadi kesalahan saat menyinkronkan commit." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setFeedback(null);
    try {
      const res = await disconnectGitHubAction();
      setShowDisconnectModal(false);
      if (!res.ok) {
        setFeedback({ type: "error", text: res.message });
      } else {
        setFeedback({ type: "success", text: res.message });
      }
      router.refresh();
    } catch {
      setFeedback({ type: "error", text: "Terjadi kesalahan saat memutuskan koneksi." });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-muted border border-border text-foreground shrink-0">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">GitHub Integration</h2>
              {isConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Terhubung
                </span>
              )}
              {isReauth && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Perlu Otorisasi Ulang
                </span>
              )}
              {(!connection || connection.connectionStatus === "DISCONNECTED") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Belum Terhubung
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Hubungkan akun GitHub Anda untuk melampirkan commit riwayat sebagai bukti (evidence) aktivitas
              dan Todo secara opsional tanpa menyimpan kode sumber repositori.
            </p>
          </div>
        </div>

        <div>
          {!isConnected && !isReauth && (
            <Button asChild className="gap-2 shrink-0">
              <a href="/api/integrations/github/connect">
                <GitBranch className="h-4 w-4" />
                Hubungkan dengan GitHub
              </a>
            </Button>
          )}

          {isReauth && (
            <Button asChild variant="destructive" className="gap-2 shrink-0">
              <a href="/api/integrations/github/connect">
                <AlertTriangle className="h-4 w-4" />
                Hubungkan Ulang Akun
              </a>
            </Button>
          )}

          {isConnected && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-primary" : ""}`} />
                <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDisconnectModal(true)}
                className="text-destructive hover:bg-destructive/10 gap-1.5"
              >
                <Unlink className="h-4 w-4" />
                <span>Putuskan</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Account Info Details */}
      {isConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 text-primary" />
            <span>Akun GitHub:</span>
            <a
              href={`https://github.com/${connection.githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
            >
              @{connection.githubUsername}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>Terakhir Disinkronkan:</span>
            <span className="font-medium text-foreground">
              {connection.lastSyncedAt
                ? new Date(connection.lastSyncedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Belum pernah"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>Akses Keamanan:</span>
            <span className="font-medium text-foreground">Hanya Metadata Commit</span>
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          role="alert"
          className={`p-3 rounded-lg text-xs leading-relaxed ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
              : feedback.type === "warning"
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
                <Unlink className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Putuskan Koneksi GitHub?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Otorisasi akun GitHub Anda akan dihapus dan sinkronisasi otomatis akan dihentikan.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Catatan Keamanan Bukti (Evidence):</strong> Semua bukti commit yang
              sudah pernah Anda lampirkan pada Aktivitas atau Todo <span className="text-foreground font-semibold">TIDAK AKAN DIHAPUS</span>.
              Riwayat lampiran Anda tetap utuh untuk penilaian magang.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnecting}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? "Memutuskan..." : "Ya, Putuskan Koneksi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
