"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { endAttendance, startAttendance } from "../server/actions";
import { elapsedSeconds, formatDuration } from "../domain/duration";
import type { AttendanceSession } from "../domain/types";

type Props = { initialSession: AttendanceSession | null; loadError?: boolean };

function timeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone,
  }).format(new Date(value));
}

export function AttendanceCard({ initialSession, loadError = false }: Props) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(Boolean(initialSession));
  const lock = useRef(false);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cutoff = session ? new Date(session.auto_close_at).getTime() : Number.POSITIVE_INFINITY;
  const active = Boolean(session && !session.ended_at);
  const effectiveEnd = session?.ended_at ?? (session && now !== null && now >= cutoff ? session.auto_close_at : null);
  const duration = session
    ? formatDuration(elapsedSeconds(session.started_at, Math.min(now ?? Date.parse(session.started_at), cutoff), effectiveEnd))
    : null;

  async function toggleAttendance() {
    if (lock.current || pending || loadError) return;
    lock.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = active && session
        ? await endAttendance(session.id)
        : await startAttendance();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSession(result.session);
      setExpanded(true);
      toast.success(result.session.auto_closed
        ? "Absen ditutup otomatis pada tengah malam."
        : result.session.ended_at ? "Absen kerja diakhiri." : "Absen kerja dimulai.");
      router.refresh();
    } catch {
      setMessage("Absen belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return <section aria-labelledby="attendance-title" className="surface rounded-2xl p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 size={21} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="attendance-title" className="font-semibold">Absen hari ini</h2>
          {loadError ? <p className="mt-1 text-sm text-muted-foreground">Status absen belum dapat dimuat.</p>
            : active ? <p className="mt-1 text-sm text-muted-foreground">Sedang bekerja · <span className="font-mono tabular-nums text-foreground">{duration}</span></p>
              : session ? <p className="mt-1 text-sm text-muted-foreground">Selesai · total <span className="font-mono tabular-nums text-foreground">{duration}</span></p>
                : <p className="mt-1 text-sm text-muted-foreground">Belum mulai bekerja</p>}
        </div>
      </div>
      {!loadError && (active || !session) && <Button type="button" onClick={toggleAttendance} disabled={pending} variant={active ? "destructive" : "default"}>
        {pending ? "Menyimpan…" : active ? "Akhiri kerja" : "Mulai kerja"}
      </Button>}
    </div>

    {session && <>
      <button type="button" className="mt-4 flex min-h-11 w-full items-center justify-between border-t border-border/60 pt-3 text-left text-sm font-medium" aria-expanded={expanded} aria-controls="attendance-details" onClick={() => setExpanded(value => !value)}>
        <span>{active ? "Rincian absen aktif" : session.auto_closed ? "Rincian absen · ditutup otomatis" : "Rincian absen"}</span>
        <ChevronDown size={17} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded && <dl id="attendance-details" className="grid grid-cols-2 gap-4 pb-1 pt-2 sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Mulai</dt><dd className="mt-1 text-sm font-medium tabular-nums">{timeLabel(session.started_at, session.timezone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Selesai</dt><dd className="mt-1 text-sm font-medium tabular-nums">{session.ended_at && effectiveEnd ? timeLabel(effectiveEnd, session.timezone) : active ? "Berlangsung" : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total durasi</dt><dd className="mt-1 text-sm font-medium font-mono tabular-nums">{duration}</dd></div>
      </dl>}
    </>}

    {message && <div className="mt-3"><Feedback>{message}</Feedback></div>}
    {session?.ended_at && !session.auto_closed && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={14} aria-hidden="true" />Sesi kerja hari ini sudah dicatat.</p>}
    <div className="mt-3 border-t border-border/60 pt-2"><Link href="/attendance" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">Lihat riwayat absen</Link></div>
  </section>;
}
