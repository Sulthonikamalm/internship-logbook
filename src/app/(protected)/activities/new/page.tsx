import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { QuickPhotoActivity } from "@/features/evidence/components/quick-photo-activity";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const user = await requireActiveUser();
  const quick = (await searchParams).quick === "1";
  return quick ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="quick-title"
        className="max-h-[95vh] w-full overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl sm:max-w-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div><h1 id="quick-title" className="text-xl font-bold">Catat cepat</h1>
            <p className="text-sm text-muted-foreground">Simpan pekerjaan dalam beberapa detik.</p></div>
          <Link href="/activities" aria-label="Tutup" className="px-2 text-2xl">×</Link>
        </div>
        <div className="mb-4"><QuickPhotoActivity /></div>
        <div className="my-4 border-t pt-4"><h2 className="mb-3 font-semibold">Atau catat dengan teks</h2>
          <ActivityForm userId={user.userId} timezone={user.timezone} quick /></div>
      </section>
    </div>
  ) : <section className="mx-auto max-w-2xl space-y-6">
    <div><Link href="/activities" className="text-sm text-primary underline">← Aktivitas</Link>
      <h1 className="mt-2 text-2xl font-bold">Buat aktivitas</h1></div>
    <ActivityForm userId={user.userId} timezone={user.timezone} />
  </section>;
}
