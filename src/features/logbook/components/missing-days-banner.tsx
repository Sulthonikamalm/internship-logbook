"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileEdit,
  PlusCircle,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InternshipSettings, MissingDaySummary } from "../domain/types";
import { InternshipSettingsDialog } from "./internship-settings-dialog";

type Props = {
  summary: MissingDaySummary;
  settings: InternshipSettings | null;
};

export function MissingDaysBanner({ summary, settings }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Settings disabled / not configured
  if (!summary.enabled) {
    return (
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 sm:p-5 text-blue-900 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-primary shrink-0 mt-0.5 sm:mt-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-blue-950">
                Deteksi Hari Kosong Belum Aktif
              </h3>
              <p className="text-xs sm:text-sm text-blue-700/90 mt-0.5">
                Atur tanggal mulai, selesai, dan hari kerja magang untuk memantau hari kerja yang belum diisi logbook secara otomatis.
              </p>
            </div>
          </div>
          <div className="shrink-0 pl-10 sm:pl-0">
            <InternshipSettingsDialog
              settings={settings}
              trigger={
                <Button size="sm" className="gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Atur Periode Magang</span>
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. Active with missing workdays or drafts
  const hasMissing = summary.missingCount > 0;
  const hasDrafts = summary.draftCount > 0;

  if (hasMissing || hasDrafts) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 text-amber-950 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-amber-950">
                  {summary.missingCount} Hari Kerja Belum Diisi Logbook
                </h3>
                {hasDrafts && (
                  <Badge variant="warning" className="text-[11px] font-medium bg-amber-200 text-amber-900 border-none">
                    {summary.draftCount} hari berstatus draf
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-amber-800/90 mt-0.5">
                Dari total {summary.totalWorkdays} hari kerja terjadwal hingga hari ini, {summary.loggedWorkdays} hari telah tercatat selesai.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pl-10 sm:pl-0">
            <InternshipSettingsDialog
              settings={settings}
              trigger={
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-amber-300 bg-white/70 hover:bg-white text-amber-900">
                  <Settings className="h-3 w-3" />
                  <span>Ubah Periode</span>
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 text-xs gap-1.5 border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 font-medium"
            >
              <span>{isExpanded ? "Tutup Rincian" : "Lihat Tanggal"}</span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Expandable list of missing dates */}
        {isExpanded && (
          <div className="pt-3 border-t border-amber-200/80 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {summary.missingDays.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200/90 bg-white/90 shadow-2xs hover:border-amber-300 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800">
                        {item.dayName}, {item.date}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {item.formattedDate}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {item.hasDraft && item.draftActivityId ? (
                      <Link
                        href={`/activities/${item.draftActivityId}/edit?returnTo=/logbook`}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 transition-colors"
                      >
                        <FileEdit className="h-3 w-3" />
                        <span>Draf</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/activities/new?date=${item.date}&returnTo=/logbook`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                      >
                        <PlusCircle className="h-3 w-3" />
                        <span>Catat</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. All caught up (0 missing workdays)
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-emerald-950">
              Logbook Lengkap!
            </h3>
            <p className="text-xs text-emerald-750 mt-0.5">
              Semua {summary.totalWorkdays} hari kerja terjadwal hingga hari ini telah tercatat dengan rapi.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <InternshipSettingsDialog
            settings={settings}
            trigger={
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-emerald-300 bg-white/70 hover:bg-white text-emerald-900">
                <Settings className="h-3 w-3" />
                <span>Pengaturan Periode</span>
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
