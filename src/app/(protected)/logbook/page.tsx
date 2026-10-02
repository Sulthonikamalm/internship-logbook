import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, Settings, FileSpreadsheet } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getActivityDays } from "@/features/logbook/server/get-activity-days";
import { getLogbookRows } from "@/features/logbook/server/get-logbook-rows";
import { getInternshipSettings } from "@/features/logbook/server/settings";
import { getMissingDaysSummary } from "@/features/logbook/server/get-missing-days";
import { MissingDaysBanner } from "@/features/logbook/components/missing-days-banner";
import { LogbookFiltersBar } from "@/features/logbook/components/logbook-filters";
import { LogbookDesktopTable } from "@/features/logbook/components/logbook-table";
import { LogbookMobileCards } from "@/features/logbook/components/logbook-cards";
import { LogbookPagination } from "@/features/logbook/components/logbook-pagination";
import { LogbookEmptyState } from "@/features/logbook/components/logbook-empty-state";
import { TimelineDayStrip } from "@/features/logbook/components/timeline-day-strip";
import { InternshipSettingsDialog } from "@/features/logbook/components/internship-settings-dialog";
import type { LogbookFilterInput } from "@/features/logbook/domain/types";
import { CategoryTabs } from "@/features/work/components/category-tabs";
import { parseWorkCategory } from "@/features/work/domain/category";

export const metadata: Metadata = {
  title: "Logbook — InternFlow",
  description: "Histori aktivitas magang, timeline, dan bukti pekerjaan.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LogbookPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireActiveUser();
  const rawParams = await searchParams;

  const filterInput: LogbookFilterInput = {
    category: typeof rawParams.category === "string" ? rawParams.category : undefined,
    preset: typeof rawParams.preset === "string" ? rawParams.preset : undefined,
    from: typeof rawParams.from === "string" ? rawParams.from : undefined,
    to: typeof rawParams.to === "string" ? rawParams.to : undefined,
    month: typeof rawParams.month === "string" ? rawParams.month : undefined,
    q: typeof rawParams.q === "string" ? rawParams.q : typeof rawParams.search === "string" ? rawParams.search : undefined,
    evidenceType: typeof rawParams.evidenceType === "string" ? rawParams.evidenceType : undefined,
    page: typeof rawParams.page === "string" ? rawParams.page : undefined,
    pageSize: typeof rawParams.pageSize === "string" ? rawParams.pageSize : undefined,
  };

  const [logbookData, settings, missingSummary] = await Promise.all([
    getLogbookRows(filterInput),
    getInternshipSettings(),
    getMissingDaysSummary(),
  ]);

  const { rows, count, totalUnfilteredCount, page, pageSize, totalPages, filters } = logbookData;

  // Reconstruct current URL string for safe returnTo navigation
  const currentParams = new URLSearchParams();
  const category = parseWorkCategory(filters.category);
  currentParams.set("category", category);
  if (filters.preset) currentParams.set("preset", filters.preset);
  if (filters.preset === "month" && filters.month) currentParams.set("month", filters.month);
  if (filters.preset === "custom") {
    if (filters.from) currentParams.set("from", filters.from);
    if (filters.to) currentParams.set("to", filters.to);
  }
  if (filters.q) currentParams.set("q", filters.q);
  if (filters.evidenceType && filters.evidenceType !== "all") currentParams.set("evidenceType", filters.evidenceType);
  if (page > 1) currentParams.set("page", String(page));

  const returnToUrl = `/logbook${currentParams.toString() ? `?${currentParams.toString()}` : ""}`;

  const isSingleDateFilter = Boolean(
    filters.from && filters.to && filters.from === filters.to
  );
  const targetDate = isSingleDateFilter ? filters.from : undefined;

  const span = filters.from && filters.to ? (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000 + 1 : 0;
  const allDays = filters.from && filters.to && span > 0 && span <= 31 ? await getActivityDays(filters.from, filters.to, category) : [];
  const activityDates = new Set(allDays.map(day => day.activity_date));
  const missingDates = new Set<string>(category === "INTERNSHIP" ? missingSummary.missingDays.map((d) => d.date) : []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader title="Logbook" description="Pekerjaan dan bukti, tersusun per hari." action={<div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/reports?category=${category}`}>
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              <span>Excel</span>
            </Link>
          </Button>
          <InternshipSettingsDialog
            settings={settings}
            trigger={
              <Button variant="outline" aria-label="Atur periode magang">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Periode</span>
              </Button>
            }
          />
          <Button asChild className="gap-2">
            <Link href={`/activities/new?category=${category}&returnTo=${encodeURIComponent(returnToUrl)}`}>
              <PlusCircle className="h-4 w-4" />
              <span>Catat</span>
            </Link>
          </Button>
        </div>} />

      {/* Missing-Day Detection & Settings Banner */}
      <CategoryTabs value={category} href="/logbook" />
      {category === "INTERNSHIP" && <MissingDaysBanner summary={missingSummary} settings={settings} />}
      {category === "PERSONAL" && <Link href="/calendar?category=PERSONAL" className="inline-flex min-h-11 items-center text-sm text-primary">Lihat pekerjaan Personal yang selesai di Kalender →</Link>}

      {/* Filter Controls Bar */}
      <LogbookFiltersBar key={JSON.stringify(filters)} filters={filters} />

      {/* Timeline Day Summary Strip */}
      <TimelineDayStrip
        filters={filters}
        activityDates={activityDates}
        missingDates={missingDates}
        baseFilterUrl={returnToUrl}
      />

      {/* Logbook Content Area */}
      {rows.length === 0 ? (
        <LogbookEmptyState
          totalUnfilteredCount={totalUnfilteredCount}
          isSingleDateFilter={isSingleDateFilter}
          targetDate={targetDate}
          returnToUrl={returnToUrl}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <LogbookDesktopTable
            rows={rows}
            page={page}
            pageSize={pageSize}
            returnToUrl={returnToUrl}
          />

          {/* Mobile Card View */}
          <LogbookMobileCards
            rows={rows}
            page={page}
            pageSize={pageSize}
            returnToUrl={returnToUrl}
          />

          {/* Pagination */}
          <LogbookPagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={count}
            pageSize={pageSize}
            baseUrl={returnToUrl}
          />
        </div>
      )}
    </div>
  );
}
