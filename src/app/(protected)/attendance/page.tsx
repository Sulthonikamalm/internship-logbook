import Link from "next/link";
import type { Metadata } from "next";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getAttendanceHistory } from "@/features/attendance/server/queries";
import { elapsedSeconds, formatDuration } from "@/features/attendance/domain/duration";

export const metadata: Metadata = {
  title: "Absen — InternFlow",
  description: "Riwayat jam kerja harian.",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function timeLabel(value: string | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", timeZone: timezone,
  }).format(new Date(value));
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const result = await getAttendanceHistory(Number(params.page) || 1);
  const now = Date.parse(result.asOf);
  return <section className="space-y-6">
    <PageHeader title="Riwayat absen" description="Jam mulai, jam selesai, dan total durasi per hari." action={<Button asChild variant="outline"><Link href="/dashboard">Kembali ke Home</Link></Button>} />
    {result.sessions.length === 0 ? <div className="surface rounded-2xl px-6 py-12 text-center">
      <Clock3 size={28} className="mx-auto mb-4 text-primary" aria-hidden="true" />
      <h2 className="font-semibold">Belum ada riwayat absen</h2>
      <p className="mt-2 text-sm text-muted-foreground">Mulai kerja dari dashboard untuk mencatat absen hari ini.</p>
      <Button asChild className="mt-5"><Link href="/dashboard">Buka dashboard</Link></Button>
    </div> : <>
      <div className="surface overflow-hidden divide-y divide-border/60">
        {result.sessions.map((session) => {
          const cutoff = Date.parse(session.auto_close_at);
          const autoClosed = session.auto_closed || (!session.ended_at && now >= cutoff);
          const end = session.ended_at ?? (autoClosed ? session.auto_close_at : null);
          const duration = end
            ? elapsedSeconds(session.started_at, now, end)
            : elapsedSeconds(session.started_at, Math.min(now, cutoff));
          return <article key={session.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,.7fr))] sm:items-center sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{dateLabel(session.work_date)}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{autoClosed ? "Ditutup otomatis pukul 00.00" : end ? "Selesai" : "Sedang bekerja"}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Mulai</p><p className="mt-1 text-sm font-medium tabular-nums">{timeLabel(session.started_at, session.timezone)}</p></div>
            <div><p className="text-xs text-muted-foreground">Selesai</p><p className="mt-1 text-sm font-medium tabular-nums">{timeLabel(end, session.timezone)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total durasi</p><p className="mt-1 font-mono text-sm font-medium tabular-nums">{formatDuration(duration)}</p></div>
          </article>;
        })}
      </div>
      {result.totalPages > 1 && <nav aria-label="Halaman riwayat absen" className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.count)} dari {result.count} hari</p>
        <div className="flex items-center gap-2">
          {result.page > 1 && <Button asChild variant="outline"><Link href={`/attendance?page=${result.page - 1}`}>Sebelumnya</Link></Button>}
          <span className="px-2 text-sm tabular-nums">{result.page} / {result.totalPages}</span>
          {result.page < result.totalPages && <Button asChild variant="outline"><Link href={`/attendance?page=${result.page + 1}`}>Berikutnya</Link></Button>}
        </div>
      </nav>}
    </>}
  </section>;
}
