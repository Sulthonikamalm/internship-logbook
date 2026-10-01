"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EvidenceTypeFilter, FilterPreset, NormalizedLogbookFilters } from "../domain/types";

type Props = {
  filters: NormalizedLogbookFilters;
};

export function LogbookFiltersBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const preset = filters.preset;
  const from = filters.from || "";
  const to = filters.to || "";
  const month = filters.month || new Date().toISOString().slice(0, 7);
  const evidenceType = filters.evidenceType;

  const [keyword, setKeyword] = useState<string>(filters.q);
  const [prevQ, setPrevQ] = useState<string>(filters.q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync keyword state when prop changes externally (standard React render-time adjustment)
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    setKeyword(filters.q);
  }

  const applyFilters = useCallback(
    (overrides?: {
      preset?: FilterPreset;
      q?: string;
      from?: string;
      to?: string;
      month?: string;
      evidenceType?: EvidenceTypeFilter;
      page?: number;
    }) => {
      const activePreset = overrides?.preset ?? preset;
      const activeQ = overrides?.q !== undefined ? overrides.q : keyword;
      const activeFrom = overrides?.from !== undefined ? overrides.from : from;
      const activeTo = overrides?.to !== undefined ? overrides.to : to;
      const activeMonth = overrides?.month !== undefined ? overrides.month : month;
      const activeEvidence = overrides?.evidenceType ?? evidenceType;
      const activePage = overrides?.page ?? 1;

      const params = new URLSearchParams();

      if (activePreset) params.set("preset", activePreset);

      if (activePreset === "month") {
        if (activeMonth) params.set("month", activeMonth);
      } else if (activePreset === "custom") {
        if (activeFrom) params.set("from", activeFrom);
        if (activeTo) params.set("to", activeTo);
      }

      if (activeQ.trim()) {
        params.set("q", activeQ.trim());
      }

      if (activeEvidence && activeEvidence !== "all") {
        params.set("evidenceType", activeEvidence);
      }

      if (activePage > 1) {
        params.set("page", String(activePage));
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, preset, keyword, from, to, month, evidenceType]
  );

  // Debounced keyword search
  useEffect(() => {
    if (keyword === filters.q) return;

    const timer = setTimeout(() => {
      applyFilters({ q: keyword, page: 1 });
    }, 400);

    return () => clearTimeout(timer);
  }, [keyword, filters.q, applyFilters]);

  function handlePresetChange(newPreset: FilterPreset) {
    applyFilters({ preset: newPreset, page: 1 });
  }

  function handleReset() {
    setKeyword("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const isCustomRangeInvalid = preset === "custom" && from && to && from > to;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-4">
      {/* Top Bar: Search & Preset tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Preset Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/60 self-start md:self-auto overflow-x-auto max-w-full">
          {(
            [
              { key: "today", label: "Hari Ini" },
              { key: "week", label: "Minggu Ini" },
              { key: "month", label: "Bulan Ini" },
              { key: "custom", label: "Kustom" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handlePresetChange(item.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                preset === item.key
                  ? "bg-card text-primary shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search input & Mobile toggle */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari aktivitas atau keterangan..."
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword("");
                  applyFilters({ q: "", page: 1 });
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="md:hidden shrink-0 gap-1.5 h-9"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-xs">Filter</span>
          </Button>
        </div>
      </div>

      {/* Sub-bar: Specific Date Selectors & Evidence Type (Collapsible on mobile) */}
      <div className={`${mobileFiltersOpen ? "block" : "hidden"} md:block pt-3 border-t border-border/60`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* If Month Preset: Show Month Selector */}
            {preset === "month" && (
              <div className="flex items-center gap-2">
                <label htmlFor="logbook-month-picker" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Pilih Bulan:</span>
                </label>
                <input
                  id="logbook-month-picker"
                  type="month"
                  value={month}
                  onChange={(e) => {
                    applyFilters({ month: e.target.value, page: 1 });
                  }}
                  className="rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* If Custom Preset: Show From - To Pickers */}
            {preset === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="logbook-from-date" className="text-xs font-medium text-muted-foreground">
                    Dari:
                  </label>
                  <input
                    id="logbook-from-date"
                    type="date"
                    value={from}
                    onChange={(e) => {
                      applyFilters({ from: e.target.value, page: 1 });
                    }}
                    className={`rounded-md border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 ${
                      isCustomRangeInvalid ? "border-destructive focus:ring-destructive" : "border-input focus:ring-primary"
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label htmlFor="logbook-to-date" className="text-xs font-medium text-muted-foreground">
                    Sampai:
                  </label>
                  <input
                    id="logbook-to-date"
                    type="date"
                    value={to}
                    onChange={(e) => {
                      applyFilters({ to: e.target.value, page: 1 });
                    }}
                    className={`rounded-md border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 ${
                      isCustomRangeInvalid ? "border-destructive focus:ring-destructive" : "border-input focus:ring-primary"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Evidence Type Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="logbook-evidence-type" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span>Evidence:</span>
              </label>
              <select
                id="logbook-evidence-type"
                value={evidenceType}
                onChange={(e) => {
                  const val = e.target.value as EvidenceTypeFilter;
                  applyFilters({ evidenceType: val, page: 1 });
                }}
                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Semua</option>
                <option value="photo">Hanya Foto</option>
                <option value="link">Hanya Tautan</option>
                <option value="github">Hanya GitHub Commit</option>
                <option value="none">Tanpa Evidence</option>
              </select>
            </div>
          </div>

          {/* Reset Filters button */}
          <div className="flex items-center gap-2">
            {(preset !== "month" || keyword || evidenceType !== "all" || filters.month !== new Date().toISOString().slice(0, 7)) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Filter</span>
              </Button>
            )}
          </div>
        </div>

        {/* Field Error for invalid date order */}
        {isCustomRangeInvalid && (
          <p className="mt-2 text-xs text-destructive">
            Tanggal mulai tidak boleh lebih besar dari tanggal selesai.
          </p>
        )}
      </div>
    </div>
  );
}
