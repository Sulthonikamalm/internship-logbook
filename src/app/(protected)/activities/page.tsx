import Link from "next/link";
import { listActivities } from "@/features/activity/server/list-activities";

type Search = { page?: string; search?: string; date?: string; status?: string };
export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const filters = {
    page: Number(search.page) || 1,
    search: search.search ?? "",
    date: search.date ?? "",
    status: search.status ?? "",
  };
  const { activities, count, page, pageSize } = await listActivities(filters);
  const pageUrl = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.date) params.set("date", filters.date);
    if (filters.status) params.set("status", filters.status);
    params.set("page", String(nextPage));
    return `/activities?${params.toString()}`;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Aktivitas</h1>
          <p className="text-sm text-muted-foreground">Catatan pekerjaan aktual Anda.</p></div>
        <Link href="/activities/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Buat aktivitas</Link>
      </div>
      <form method="get" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><label htmlFor="activity-search" className="mb-1 block text-sm">Cari judul</label>
          <input id="activity-search" name="search" defaultValue={filters.search} maxLength={100}
            className="w-full rounded-md border border-input bg-background px-3 py-2" /></div>
        <div><label htmlFor="activity-filter-date" className="mb-1 block text-sm">Tanggal</label>
          <input id="activity-filter-date" name="date" type="date" defaultValue={filters.date}
            className="w-full rounded-md border border-input bg-background px-3 py-2" /></div>
        <div><label htmlFor="activity-filter-status" className="mb-1 block text-sm">Status</label>
          <select id="activity-filter-status" name="status" defaultValue={filters.status}
            className="w-full rounded-md border border-input bg-background px-3 py-2">
            <option value="">Aktif</option><option value="DRAFT">Draf</option>
            <option value="READY">Siap</option><option value="ARCHIVED">Arsip</option>
          </select></div>
        <div className="flex items-end gap-2"><button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Terapkan</button>
          <Link href="/activities" className="text-sm text-muted-foreground underline">Reset</Link></div>
      </form>
      {activities.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <h2 className="font-semibold">Belum ada aktivitas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mulai catat pekerjaan yang Anda lakukan.</p>
          <Link href="/activities/new?quick=1" className="mt-4 inline-block text-sm font-semibold text-primary underline">Catat cepat</Link>
        </div>
      ) : <>
        <div className="space-y-3 md:hidden">
          {activities.map((item) => <Link key={item.id} href={`/activities/${item.id}`}
            className="block rounded-lg border bg-card p-4">
            <div className="flex justify-between gap-3"><h2 className="font-semibold">{item.title}</h2>
              <span className="text-xs text-muted-foreground">{item.status}</span></div>
            <p className="mt-2 text-sm text-muted-foreground">{item.activity_date}</p>
            {item.description && <p className="mt-2 line-clamp-2 text-sm">{item.description}</p>}
          </Link>)}</div>
        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr>
            <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Aktivitas</th>
            <th className="px-4 py-3">Status</th><th className="px-4 py-3">Sumber</th>
          </tr></thead><tbody>{activities.map((item) => <tr key={item.id} className="border-t">
            <td className="px-4 py-3">{item.activity_date}</td>
            <td className="px-4 py-3"><Link href={`/activities/${item.id}`} className="font-medium text-primary hover:underline">{item.title}</Link></td>
            <td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item.source}</td>
          </tr>)}</tbody></table>
        </div>
      </>}
      <div className="flex items-center justify-between text-sm">
        <span>{count} aktivitas</span><div className="flex gap-4">
          {page > 1 && <Link href={pageUrl(page - 1)} className="text-primary underline">Sebelumnya</Link>}
          {page * pageSize < count && <Link href={pageUrl(page + 1)} className="text-primary underline">Berikutnya</Link>}
        </div></div>
    </section>
  );
}
