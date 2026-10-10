import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getGitHubConnection, listGitHubCommits } from "@/features/integrations/github/server/queries";
import { ConnectionCard } from "@/features/integrations/github/components/connection-card";
import { SyncedCommitsCard } from "@/features/integrations/github/components/synced-commits-card";
import { PageHeader } from "@/components/ui/page-header";
import { Feedback } from "@/components/ui/feedback";
import { DriveConnectionCard, DriveConnectionFallback } from "@/features/integrations/drive/components/connection-card";
export const metadata: Metadata = { title: "Integrasi — InternFlow" };
const errors: Record<string,string> = { state_mismatch: "Sesi koneksi tidak cocok. Coba hubungkan ulang.", state_expired: "Sesi koneksi berakhir. Coba lagi.", user_mismatch: "Akun InternFlow berubah. Coba lagi.", oauth_not_configured: "GitHub belum dikonfigurasi oleh pengelola.", callback_not_configured: "Alamat callback GitHub perlu disesuaikan oleh pengelola.", encryption_not_configured: "Penyimpanan token GitHub belum dikonfigurasi.", authorization_cancelled: "Otorisasi GitHub dibatalkan.", account_change_required: "Akun GitHub berbeda. Pilih izinkan ganti akun saat menghubungkan ulang." };
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireActiveUser();
  const params = await searchParams;
  const [connection, commits] = await Promise.all([getGitHubConnection(), listGitHubCommits({ limit: 20 })]);
  return <div className="max-w-5xl space-y-7"><PageHeader title="Integrasi" description="Hubungkan alat kerja, kumpulkan bukti." />
    {params.success === "connected" && <Feedback tone="success">GitHub terhubung. Sync untuk memuat commit pilihanmu.</Feedback>}
    {params.error && <Feedback>{errors[params.error] ?? "GitHub belum terhubung. Coba hubungkan lagi."}</Feedback>}
    <ConnectionCard connection={connection} />
    {(commits.count > 0 || connection?.connectionStatus === "CONNECTED") && <SyncedCommitsCard key={`${connection?.id}-${connection?.lastSyncedAt}`} commits={commits.items} count={commits.count} />}
    <Suspense fallback={<DriveConnectionFallback />}><DriveConnectionCard /></Suspense>
    <details className="text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer">Privasi evidence</summary><p className="mt-2">Commit tidak otomatis menjadi Activity. Token hanya digunakan server. Evidence yang sudah dipilih tetap tersimpan saat koneksi atau akses repo berubah.</p></details>
  </div>;
}
