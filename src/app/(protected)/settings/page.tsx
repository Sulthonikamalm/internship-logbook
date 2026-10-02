import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { InternshipSettingsDialog } from "@/features/logbook/components/internship-settings-dialog";
import { getInternshipSettings } from "@/features/logbook/server/settings";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { LogoutButton } from "@/features/auth/components/logout-button";

export const metadata: Metadata = { title: "Settings — InternFlow" };
export default async function SettingsPage() {
  const user = await requireActiveUser();
  const settings = await getInternshipSettings();
  return <div className="max-w-4xl space-y-7"><PageHeader title="Settings" description="Sesuaikan workspace dengan rutinitasmu." />
    <div className="grid gap-5 md:grid-cols-2"><section className="surface p-6"><h2 className="mb-5 text-base font-semibold">Profil</h2><ProfileForm displayName={user.displayName} timezone={user.timezone} /></section>
      <div className="space-y-5"><section className="surface p-6"><h2 className="text-base font-semibold">Magang</h2><p className="mt-2 mb-5 text-sm text-muted-foreground">{settings?.startDate ? `${settings.startDate} — ${settings.endDate ?? "berlangsung"}` : "Periode belum diatur"}</p><InternshipSettingsDialog settings={settings} /></section><section className="surface p-6"><h2 className="text-base font-semibold">Akses & privasi</h2><p className="mt-2 mb-4 text-sm leading-relaxed text-muted-foreground">Foto memerlukan login InternFlow. Bukti commit tetap tersimpan setelah GitHub diputus.</p><Link href="/integrations" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Kelola integrasi →</Link></section></div>
    </div>{user.isSuperAdmin && <Link href="/admin/users" className="surface flex min-h-16 items-center justify-between p-5 text-sm font-medium text-primary">Kelola pengguna<span>→</span></Link>}<LogoutButton />
  </div>;
}
