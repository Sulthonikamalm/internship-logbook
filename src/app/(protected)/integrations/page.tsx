import { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import {
  getGitHubConnection,
  listGitHubCommits,
  listUserGitHubRepos,
} from "@/features/integrations/github/server/queries";
import { ConnectionCard } from "@/features/integrations/github/components/connection-card";
import { SyncedCommitsCard } from "@/features/integrations/github/components/synced-commits-card";
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Integrasi GitHub & Layanan | InternFlow",
  description: "Kelola koneksi akun GitHub dan gunakan riwayat commit sebagai bukti logbook magang.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireActiveUser();
  const params = await searchParams;

  const [connection, commitsData, repos] = await Promise.all([
    getGitHubConnection(),
    listGitHubCommits({ limit: 50 }),
    listUserGitHubRepos(),
  ]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner Alert from URL params */}
      {params.success === "connected" && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Akun GitHub berhasil terhubung! Anda sekarang dapat menggunakan riwayat commit sebagai Evidence.</span>
        </div>
      )}

      {params.error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            {params.error === "state_mismatch"
              ? "Validasi keamanan OAuth gagal (state tidak cocok). Silakan coba lagi."
              : params.error === "oauth_not_configured"
              ? "Konfigurasi OAuth GitHub belum disiapkan di server (GITHUB_CLIENT_ID / SECRET)."
              : `Gagal menghubungkan GitHub: ${params.error}`}
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrasi Layanan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan alat pengembangan eksternal untuk memperkaya portofolio bukti magang Anda secara otomatis.
        </p>
      </div>

      {/* Connection Card */}
      <ConnectionCard connection={connection} />

      {/* Synced Commits Section */}
      <SyncedCommitsCard commits={commitsData.items} repos={repos} />

      {/* Security & Privacy Guarantee */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-3 text-xs text-muted-foreground">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Kebijakan Privasi & Batas Keamanan GitHub (Zero Code Storage)</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1">
            <span className="font-medium text-foreground">1. Tanpa Kode Sumber</span>
            <p>
              Sistem InternFlow tidak pernah membaca, menyalin, atau menyimpan isi file kode sumber dari repositori Anda.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-medium text-foreground">2. Hanya Metadata Terbatas</span>
            <p>
              Hanya identitas commit (SHA hash, pesan commit, repositori, dan tanggal) yang disimpan sebagai referensi bukti.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-medium text-foreground">3. Perlindungan Bukti Historis</span>
            <p>
              Jika Anda memutuskan koneksi GitHub di kemudian hari, bukti commit yang sudah terlampir pada logbook tidak akan terhapus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
