import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Upload, ListPlus, FileDown, ArrowUpRight, ChevronRight, BookOpen, FileSpreadsheet, GitBranch, Settings, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Feedback } from "@/components/ui/feedback";
import { getHomeData } from "@/features/home/server/get-home-data";
import { LocalDraftShortcut } from "@/features/home/components/local-draft-shortcut";
import { getServerEnv } from "@/lib/env/server";

export const metadata: Metadata = { title: "Home — InternFlow" };
const actions = [
  { label: "Catat activity", href: "/activities/new?quick=1", icon: Plus, primary: true },
  { label: "Upload foto", href: "/evidence?upload=1", icon: Upload },
  { label: "Buat todo", href: "/todos?new=1", icon: ListPlus },
  { label: "Ekspor laporan", href: "/reports", icon: FileDown },
];
const tools = [
  { label: "Logbook", href: "/logbook", icon: BookOpen },
  { label: "Reports", href: "/reports", icon: FileSpreadsheet },
  { label: "GitHub", href: "/integrations", icon: GitBranch },
  { label: "Library", href: "/evidence", icon: Images },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default async function DashboardPage() {
  const data = await getHomeData();
  const env = getServerEnv();
  const driveReady = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN && env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${data.today}T12:00:00Z`));
  const name = data.user.displayName?.trim().split(/\s+/)[0];
  const githubStatus = data.githubError ? "Gagal memuat" : data.github?.connection_status === "CONNECTED" ? `@${data.github.github_username}` : data.github?.connection_status === "REAUTH_REQUIRED" ? "Hubungkan ulang" : "Belum terhubung";
  return <div className="space-y-7 lg:space-y-9">
    <header className="flex items-end justify-between gap-4"><div className="min-w-0"><p className="mb-2 text-xs font-medium text-muted-foreground">{date}</p><h1 className="break-words text-[1.8rem] font-semibold leading-tight sm:text-3xl">Halo{name ? `, ${name}` : ""}.</h1><p className="mt-2 text-sm text-muted-foreground">Apa yang kamu kerjakan hari ini?</p></div><Link href="/activities/new" className="hidden items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-primary shadow-sm sm:flex">Activity baru<Plus size={18} /></Link></header>
    <section aria-label="Aksi cepat" className="glass-panel rounded-3xl p-4 shadow-[var(--shadow-glass)] sm:p-6">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Mulai di sini</h2></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(action => <Link key={action.href} href={action.href} className={`pressable flex min-h-28 flex-col justify-between gap-5 rounded-2xl p-4 sm:p-5 ${action.primary ? "bg-primary text-white shadow-sm" : "border border-white/80 bg-white/75 text-foreground hover:bg-white"}`}><action.icon size={24} strokeWidth={1.8} aria-hidden="true" /><span className="flex items-center justify-between gap-1 text-sm font-medium">{action.label}<ArrowUpRight size={16} aria-hidden="true" /></span></Link>)}
      </div>
      <dl className="mt-5 grid grid-cols-3 divide-x divide-border/70 border-t border-white/80 pt-5">
        {[{ label: "Activity bulan ini", value: data.monthlyCount }, { label: "Todo aktif", value: data.activeTodoCount }, { label: "Evidence siap", value: data.evidenceCount }].map(stat => <div key={stat.label} className="px-3 first:pl-0"><dd className="text-2xl font-semibold tabular-nums">{stat.value ?? "—"}</dd><dt className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{stat.label}</dt></div>)}
      </dl>
    </section>
    <LocalDraftShortcut userId={data.user.userId} />
    {data.draft && <Link href={`/activities/${data.draft.id}/edit`} className="pressable surface flex items-center gap-3 p-4"><Badge variant="warning">Draft</Badge><span className="min-w-0 flex-1 truncate text-sm font-medium">{data.draft.title}</span><span className="text-xs text-primary">Lanjutkan</span><ChevronRight size={16} /></Link>}
    <div className="grid gap-7 xl:grid-cols-[1.2fr_1fr]">
      <section aria-labelledby="recent-title"><SectionHeading id="recent-title" title="Activity terbaru" href="/activities" />
        <div className="surface overflow-hidden">
          {data.activitiesError ? <div className="p-4"><Feedback>Activity belum dapat dimuat. Buka Activity untuk mencoba lagi.</Feedback></div> : data.activities.length ? data.activities.map(activity => <Link href={`/activities/${activity.id}`} key={activity.id} className="flex min-h-20 items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0 hover:bg-muted/40"><div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-primary"><span className="text-lg font-semibold leading-none">{activity.activity_date.slice(8)}</span><span className="mt-1 text-[10px]">{new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(new Date(`${activity.activity_date}T12:00:00Z`))}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{activity.title}</p><p className="mt-1 text-xs text-muted-foreground">{activity.status === "DRAFT" ? "Draft" : activity.status === "READY" ? "Siap dilaporkan" : "Diarsipkan"}</p></div><ChevronRight size={17} className="shrink-0 text-muted-foreground" /></Link>) : <div className="p-6"><p className="text-sm font-medium">Mulai catatan pertamamu</p><Link href="/activities/new?quick=1" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary">Catat activity<Plus size={17} /></Link></div>}
        </div>
      </section>
      <section aria-labelledby="todos-title"><SectionHeading id="todos-title" title="Todo aktif" href="/todos" />
        <div className="surface overflow-hidden">
          {data.todosError ? <div className="p-4"><Feedback>Todo belum dapat dimuat.</Feedback></div> : data.todos.length ? data.todos.map(todo => <Link key={todo.id} href={`/todos?todo=${todo.id}`} className="flex min-h-20 items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0 hover:bg-muted/40"><span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-primary/30" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{todo.title}</p><p className="mt-1 text-xs text-muted-foreground">{todo.due_date ? `Tenggat ${todo.due_date}` : "Tanpa tenggat"}</p></div>{(todo.priority === "HIGH" || todo.priority === "URGENT") && <Badge variant="warning">Prioritas</Badge>}<ChevronRight size={17} className="shrink-0 text-muted-foreground" /></Link>) : <div className="p-6"><p className="text-sm font-medium">Ruang untuk rencana berikutnya</p><Link href="/todos?new=1" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary">Buat todo<ListPlus size={17} /></Link></div>}
        </div>
      </section>
    </div>
    <section aria-labelledby="tools-title"><h2 id="tools-title" className="mb-4 text-base font-semibold">Workspace kamu</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">{tools.map(tool => <Link key={tool.label} href={tool.href} className="pressable surface flex min-h-24 flex-col items-center justify-center gap-3 p-3 text-xs font-medium sm:text-sm"><tool.icon size={22} strokeWidth={1.8} className="text-primary" aria-hidden="true" />{tool.label}</Link>)}</div></section>
    <section aria-label="Status integrasi" className="flex flex-col gap-2 rounded-2xl bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Drive · {driveReady ? "Siap upload" : "Perlu konfigurasi"}</p><Link href="/integrations" className="flex min-h-11 items-center gap-2 text-xs font-medium"><GitBranch size={16} />{githubStatus}<ChevronRight size={15} /></Link></section>
  </div>;
}
function SectionHeading({ id, title, href }: { id: string; title: string; href: string }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className="text-base font-semibold">{title}</h2><Link href={href} className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary" aria-label={`Lihat semua ${title.toLowerCase()}`}>Lihat semua<ChevronRight size={15} /></Link></div>;
}
