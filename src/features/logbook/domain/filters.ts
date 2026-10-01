import { isRealDate, localDateAt } from "@/features/activity/domain/date";
import type {
  EvidenceTypeFilter,
  FilterPreset,
  LogbookFilterInput,
  NormalizedLogbookFilters,
} from "./types";

/**
 * Returns ISO weekday number: 1 = Monday, ..., 7 = Sunday.
 */
export function getIsoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Given a reference date, returns { start: Monday, end: Sunday } of that week.
 */
export function getStartAndEndOfWeek(refDateStr: string): { start: string; end: string } {
  const d = new Date(`${refDateStr}T00:00:00.000Z`);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1..7
  const mondayDiff = 1 - isoDay;
  const sundayDiff = 7 - isoDay;

  const monDate = new Date(d);
  monDate.setUTCDate(d.getUTCDate() + mondayDiff);

  const sunDate = new Date(d);
  sunDate.setUTCDate(d.getUTCDate() + sundayDiff);

  return {
    start: monDate.toISOString().slice(0, 10),
    end: sunDate.toISOString().slice(0, 10),
  };
}

/**
 * Given YYYY-MM, returns { start: YYYY-MM-01, end: YYYY-MM-lastDay }.
 */
export function getStartAndEndOfMonth(monthStr: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    const now = new Date();
    monthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10); // 1..12

  const start = `${yearStr}-${monthNumStr.padStart(2, "0")}-01`;
  // Last day of month: day 0 of next month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${yearStr}-${monthNumStr.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { start, end };
}

/**
 * Normalizes filter inputs from URL search params.
 * Resilient: never throws on invalid inputs, clamps bounds, provides field errors when needed.
 */
export function normalizeLogbookFilters(
  raw: LogbookFilterInput,
  userTimezone: string = "Asia/Jakarta"
): NormalizedLogbookFilters {
  const today = localDateAt(new Date(), userTimezone);

  // 1. Evidence Type
  let evidenceType: EvidenceTypeFilter = "all";
  if (raw.evidenceType && ["all", "photo", "link", "github", "none"].includes(raw.evidenceType.toLowerCase())) {
    evidenceType = raw.evidenceType.toLowerCase() as EvidenceTypeFilter;
  }

  // 2. Keyword
  const q = (raw.q ?? "").trim().slice(0, 100);

  // 3. Pagination
  let page = 1;
  if (raw.page) {
    const parsedPage = typeof raw.page === "number" ? raw.page : parseInt(raw.page, 10);
    if (!Number.isNaN(parsedPage) && parsedPage >= 1) {
      page = Math.min(10000, Math.floor(parsedPage));
    }
  }

  let pageSize = 20;
  if (raw.pageSize) {
    const parsedSize = typeof raw.pageSize === "number" ? raw.pageSize : parseInt(raw.pageSize, 10);
    if (!Number.isNaN(parsedSize) && parsedSize >= 1) {
      pageSize = Math.min(100, Math.max(5, Math.floor(parsedSize)));
    }
  }

  // 4. Preset & Date range
  let preset: FilterPreset = "month";
  if (raw.preset && ["today", "week", "month", "custom"].includes(raw.preset.toLowerCase())) {
    preset = raw.preset.toLowerCase() as FilterPreset;
  } else if (raw.from || raw.to) {
    preset = "custom";
  } else if (raw.month) {
    preset = "month";
  }

  let from: string | undefined;
  let to: string | undefined;
  let month: string | undefined;
  let fieldError: NormalizedLogbookFilters["fieldError"] | undefined;

  if (preset === "today") {
    from = today;
    to = today;
  } else if (preset === "week") {
    const weekRange = getStartAndEndOfWeek(today);
    from = weekRange.start;
    to = weekRange.end;
  } else if (preset === "month") {
    if (raw.month && /^\d{4}-\d{2}$/.test(raw.month)) {
      month = raw.month;
    } else {
      month = today.slice(0, 7);
    }
    const monthRange = getStartAndEndOfMonth(month);
    from = monthRange.start;
    to = monthRange.end;
  } else {
    // Custom range
    const rawFrom = raw.from?.trim();
    const rawTo = raw.to?.trim();

    if (rawFrom && isRealDate(rawFrom)) {
      from = rawFrom;
    }
    if (rawTo && isRealDate(rawTo)) {
      to = rawTo;
    }

    if (from && to && from > to) {
      fieldError = {
        field: "from",
        message: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai.",
      };
      // Keep dates visible for correction, but search safely
    }
  }

  return {
    preset,
    from,
    to,
    month,
    q,
    evidenceType,
    page,
    pageSize,
    fieldError,
  };
}

/**
 * Format time range for table & cards display.
 * Displays "—" if start_time is null (Defect requirement).
 */
export function formatTimeDisplay(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "—";
  const start = startTime.slice(0, 5);
  if (!endTime) return start;
  const end = endTime.slice(0, 5);
  return `${start} - ${end}`;
}

/**
 * Format Indonesian date (e.g. "Senin, 28 Sep 2026").
 */
export function formatIndonesianDate(
  dateStr: string,
  options: { includeDayName?: boolean } = { includeDayName: true }
): string {
  if (!isRealDate(dateStr)) return dateStr;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString("id-ID", {
    timeZone: "UTC",
    weekday: options.includeDayName ? "long" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
