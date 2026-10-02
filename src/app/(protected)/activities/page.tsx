import Link from "next/link";
import { Plus, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listActivities } from "@/features/activity/server/list-activities";
import { CategoryTabs } from "@/features/work/components/category-tabs";
import { categoryLabels, parseWorkCategory, workCategorySchema } from "@/features/work/domain/category";

type Search = { page?: string; search?: string; date?: string; status?: string; category?: string };
const statusLabel = { DRAFT: "Draft", READY: "Siap", ARCHIVED: "Arsip" };
export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const selected = workCategorySchema.safeParse(search.category); const category = selected.success ? selected.data : "ALL";
  const filters = { page: Number(search.page) || 1, search: search.search ?? "", date: search.date ?? "", status: search.status ?? "", category };
  const { activities, count, page, pageSize } = await listActivities(filters);
  const pageUrl = (next: number) => { const params = new URLSearchParams(); for (const field of ["search","date","status","category"] as const) if (filters[field]) params.set(field, filters[field]); params.set("page", String(next)); return `/activities?${params}`; };
  return <section className="space-y-6"><PageHeader title="Activity" description="Catatan pekerjaan Anda." action={<><Button asChild variant="outline"><Link href={`/activities/new?quick=1&category=${category === "ALL" ? "INTERNSHIP" : category}`}>Catat cepat</Link></Button><Button asChild className="gap-2"><Link href={`/activities/new?category=${category === "ALL" ? "INTERNSHIP" : category}`}><Plus size={18} />Buat Activity</Link></Button></>} />
    <CategoryTabs value={category} href="/activities" all />
    <form method="get" className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="category" value={category} /><div><label htmlFor="activity-search" className="mb-1.5 block text-sm">Cari</label><input id="activity-search" name="search" defaultValue={filters.search} maxLength={100} placeholder="Judul aktivitas" className="w-full rounded-lg border bg-background px-3 py-2" /></div>
      <div><label htmlFor="activity-filter-date" className="mb-1.5 block text-sm">Tanggal</label><input id="activity-filter-date" name="date" type="date" defaultValue={filters.date} className="w-full rounded-lg border bg-background px-3 py-2" /></div>
      <div><label htmlFor="activity-filter-status" className="mb-1.5 block text-sm">Status</label><select id="activity-filter-status" name="status" defaultValue={filters.status} className="w-full rounded-lg border bg-background px-3 py-2"><option value="">Aktif</option><option value="DRAFT">Draft</option><option value="READY">Siap</option><option value="ARCHIVED">Arsip</option></select></div><div className="flex items-end gap-2"><Button type="submit">Terapkan</Button><Button asChild variant="ghost"><Link href="/activities">Reset</Link></Button></div>
    </form>
    {activities.length === 0 ? <EmptyState icon={Activity} title={filters.search || filters.date || filters.status ? "Tidak ada hasil" : "Mulai catat pekerjaan"} description="Catatan singkat pun cukup untuk mulai." action={<Button asChild><Link href={`/activities/new?quick=1&category=${category === "ALL" ? "INTERNSHIP" : category}`}>Catat cepat</Link></Button>} /> : <div className="surface divide-y divide-border/60 overflow-hidden">{activities.map(item => <Link key={item.id} href={`/activities/${item.id}`} className="surface-link flex items-center gap-4 px-4 py-5 sm:px-6"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><time dateTime={item.activity_date} className="text-xs text-muted-foreground">{new Date(`${item.activity_date}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time><Badge variant="secondary">{statusLabel[item.status]}</Badge><span className="category-chip" data-category={parseWorkCategory(item.work_category)}>{categoryLabels[parseWorkCategory(item.work_category)]}</span></div><h2 className="break-words text-sm font-semibold sm:text-base">{item.title}</h2>{item.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.description}</p>}</div><ChevronRight size={18} className="shrink-0 text-muted-foreground" /></Link>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{count} Activity</span><div className="flex gap-2">{page > 1 && <Button asChild variant="outline"><Link href={pageUrl(page - 1)}>Sebelumnya</Link></Button>}{page * pageSize < count && <Button asChild variant="outline"><Link href={pageUrl(page + 1)}>Berikutnya</Link></Button>}</div></div>
  </section>;
}
