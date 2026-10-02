"use client";

import Link from "next/link";
import { getIsoWeekday } from "../domain/filters";
import type { NormalizedLogbookFilters } from "../domain/types";

type DaySummaryItem = {
  date: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string;
  hasActivity: boolean;
  isMissing: boolean;
  isSelected: boolean;
};

type Props = {
  filters: NormalizedLogbookFilters;
  activityDates: Set<string>;
  missingDates: Set<string>;
  baseFilterUrl: string;
};

const shortDayNames: Record<number, string> = {
  1: "Sen",
  2: "Sel",
  3: "Rab",
  4: "Kam",
  5: "Jum",
  6: "Sab",
  7: "Min",
};

export function TimelineDayStrip({
  filters,
  activityDates,
  missingDates,
  baseFilterUrl,
}: Props) {
  // Only render day summary if date range is defined and <= 31 days
  if (!filters.from || !filters.to) return null;

  const start = new Date(`${filters.from}T00:00:00.000Z`);
  const end = new Date(`${filters.to}T00:00:00.000Z`);
  const dayCount = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (dayCount < 1 || dayCount > 31) return null;

  const days: DaySummaryItem[] = [];
  const cur = new Date(start);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dayOfWeek = getIsoWeekday(dateStr);
    const isSelected = filters.from === filters.to && filters.from === dateStr;

    days.push({
      date: dateStr,
      dayNum: cur.getUTCDate(),
      dayName: shortDayNames[dayOfWeek] || "",
      hasActivity: activityDates.has(dateStr),
      isMissing: missingDates.has(dateStr),
      isSelected,
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  function getDayUrl(date: string) {
    const url = new URL(baseFilterUrl, "http://localhost");
    url.searchParams.set("preset", "custom");
    url.searchParams.set("from", date);
    url.searchParams.set("to", date);
    url.searchParams.delete("page");
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-foreground">
          {days.length} hari
        </span>
        <span>Pilih tanggal</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {days.map((item) => (
          <Link
            key={item.date}
            href={getDayUrl(item.date)}
            aria-current={item.isSelected ? "date" : undefined}
            className={`flex min-h-14 min-w-11 flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border text-center ${
              item.isSelected
                ? "border-primary bg-primary text-primary-foreground font-bold"
                : item.hasActivity
                ? "border-border bg-secondary text-primary"
                : item.isMissing
                ? "border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/60"
            }`}
            title={`${item.dayName}, ${item.date} ${
              item.hasActivity ? "(Ada Aktivitas)" : item.isMissing ? "(Belum Diisi)" : ""
            }`}
          >
            <span className="text-[10px] uppercase opacity-80 leading-none">
              {item.dayName}
            </span>
            <span className="text-xs font-semibold mt-0.5 leading-none">
              {item.dayNum}
            </span>
            <div className="h-1.5 w-1.5 rounded-full mt-1">
              {item.isSelected ? (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              ) : item.hasActivity ? (
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ) : item.isMissing ? (
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
