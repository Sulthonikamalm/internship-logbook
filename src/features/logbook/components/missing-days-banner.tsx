"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { InternshipSettings, MissingDaySummary } from "../domain/types";
import { InternshipSettingsDialog } from "./internship-settings-dialog";

export function MissingDaysBanner({ summary, settings }: { summary: MissingDaySummary; settings: InternshipSettings | null }) {
  if (!summary.enabled) return <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm">Pantau kelengkapan hari kerja.</p><InternshipSettingsDialog settings={settings} trigger={<Button variant="outline">Atur periode magang</Button>} /></div>;
  return <div className="surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{summary.totalWorkdays === 0 ? "Periode belum dimulai" : `${summary.loggedWorkdays}/${summary.totalWorkdays} hari tercatat`}</p><p className="mt-1 text-xs text-muted-foreground">{summary.missingCount} belum diisi · {summary.draftCount} draft</p></div><InternshipSettingsDialog settings={settings} trigger={<Button variant="ghost">Ubah periode</Button>} /></div>
    {summary.missingDays.length > 0 && <details className="mt-3 border-t border-border/60"><summary className="min-h-11 cursor-pointer py-3 text-sm text-primary">Lihat tanggal yang perlu dilengkapi</summary><div className="max-h-64 space-y-1 overflow-y-auto">{summary.missingDays.map(day => <div key={day.date} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1"><span className="text-sm">{day.dayName}, {day.formattedDate}</span><Button asChild variant="ghost"><Link href={day.hasDraft && day.draftActivityId ? `/activities/${day.draftActivityId}/edit?returnTo=/logbook` : `/activities/new?date=${day.date}&returnTo=/logbook`}>{day.hasDraft ? "Lanjutkan draft" : "Catat"}</Link></Button></div>)}</div></details>}
  </div>;
}
