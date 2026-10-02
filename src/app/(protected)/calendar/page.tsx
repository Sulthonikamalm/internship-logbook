import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt, isRealDate } from "@/features/activity/domain/date";
import { getWorkRecords } from "@/features/work/server/get-work-records";
import { CategoryTabs } from "@/features/work/components/category-tabs";
import { categoryLabels, workCategorySchema } from "@/features/work/domain/category";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kalender — InternFlow" };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; category?: string }> }) {
  const [user, params] = await Promise.all([requireActiveUser(), searchParams]);
  const today = localDateAt(new Date(), user.timezone);
  const month = params.month && isRealDate(`${params.month}-01`) ? params.month : today.slice(0, 7);
  const from = `${month}-01`; const first = new Date(`${from}T12:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const to = last.toISOString().slice(0, 10);
  const selected = params.date && isRealDate(params.date) && params.date.slice(0, 7) === month ? params.date : today.slice(0, 7) === month ? today : from;
  const parsed = workCategorySchema.safeParse(params.category); const category = parsed.success ? parsed.data : "ALL";
  const { records } = await getWorkRecords(from, to, category === "ALL" ? undefined : category);
  const daily = records.filter(row => row.date === selected);
  const occupied = new Set(records.map(row => row.date));
  const href = (date: Date) => `/calendar?month=${date.toISOString().slice(0, 7)}&category=${category}`;
  const previous = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1, 12));
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1, 12));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const dayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${selected}T12:00:00Z`));
  return <div className="space-y-6">
    <PageHeader title="Kalender" description="Aktivitas dan pekerjaan yang sudah selesai." action={<Button asChild variant="outline"><Link href={`/calendar?date=${today}&month=${today.slice(0, 7)}&category=${category}`}>Hari ini</Link></Button>} />
    <CategoryTabs value={category} href="/calendar" params={{ month, date: selected }} all />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="surface p-4 sm:p-6" aria-label="Kalender bulanan">
        <div className="mb-5 flex items-center justify-between"><Button variant="ghost" size="icon" asChild><Link href={href(previous)} aria-label="Bulan sebelumnya"><ChevronLeft size={20} /></Link></Button><h2 className="text-base font-semibold capitalize">{monthLabel}</h2><Button variant="ghost" size="icon" asChild><Link href={href(next)} aria-label="Bulan berikutnya"><ChevronRight size={20} /></Link></Button></div>
        <div className="grid grid-cols-7 gap-1 text-center"><div className="contents">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(day => <span key={day} className="pb-2 text-xs text-muted-foreground">{day}</span>)}</div>
          {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: last.getUTCDate() }, (_, index) => { const date = `${month}-${String(index + 1).padStart(2, "0")}`;
            return <Link key={date} href={`/calendar?month=${month}&date=${date}&category=${category}`} scroll={false} aria-label={`${index + 1} ${monthLabel}${occupied.has(date) ? ", ada kegiatan" : ""}`} aria-current={date === selected ? "date" : undefined}
              className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors sm:min-h-16", date === selected ? "bg-primary font-semibold text-white shadow-sm" : date === today ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}><span>{index + 1}</span><span className={cn("size-1 rounded-full", occupied.has(date) ? date === selected ? "bg-white" : "bg-primary" : "bg-transparent")} /></Link>;
          })}
        </div>
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">{records.length} catatan bulan ini · titik biru menandai kegiatan.</p>
      </section>
      <section className="min-w-0 space-y-4" aria-label="Kegiatan tanggal terpilih">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold capitalize">{dayLabel}</h2><span className="text-sm text-muted-foreground">{daily.length} kegiatan</span></div>
        {daily.length ? <div className="surface divide-y">{daily.map(record => <Link key={record.id} href={record.href} className="flex min-w-0 items-start gap-3 p-4 transition-colors hover:bg-primary/5 sm:p-5"><CheckCircle2 size={20} className={cn("mt-0.5 shrink-0", record.status === "DRAFT" ? "text-muted-foreground" : record.isCompletion ? "text-emerald-600" : "text-primary")} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{record.title}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-md bg-primary/5 px-2 py-1 text-primary">{categoryLabels[record.category]}</span><span className="py-1">{record.startTime?.slice(0, 5) ?? (record.status === "DRAFT" ? "Draft" : record.isCompletion ? "Selesai" : "Tercatat")}</span></div></div><ChevronRight size={17} className="mt-1 shrink-0 text-muted-foreground" /></Link>)}</div> : <EmptyState icon={CalendarDays} title="Belum ada catatan" description="Tugas selesai muncul otomatis di sini." action={<Button asChild variant="outline"><Link href={`/todos?new=1&category=${category === "ALL" ? "INTERNSHIP" : category}`}><Plus size={16} />Tambah tugas</Link></Button>} />}
        <Button asChild variant="outline" className="w-full"><Link href={`/reports?category=${category === "ALL" ? "INTERNSHIP" : category}&from=${from}&to=${to}`}>Ekspor kegiatan bulan ini</Link></Button>
      </section>
    </div>
  </div>;
}
