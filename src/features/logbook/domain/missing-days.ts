import { formatIndonesianDate, getIsoWeekday } from "./filters";
import { workingDayNames } from "./settings-schema";
import type { InternshipSettings, MissingDayItem, MissingDaySummary } from "./types";

export type ActivityDateRecord = {
  id: string;
  activity_date: string;
  status: string;
};

/**
 * Pure evaluation function for missing workdays.
 *
 * Rules:
 * 1. Requires valid internship_settings with start_date and end_date.
 * 2. Iterates each day from start_date to min(end_date, today).
 * 3. Filters to days configured in workingDays (ISO 1..7).
 * 4. Checks against non-deleted activities:
 *    - No activity: MISSING.
 *    - DRAFT exists: not strictly missing, badged as draft.
 *    - READY/ARCHIVED exists: LOGGED.
 * 5. Future dates are NEVER marked as missing.
 */
export function evaluateMissingDays({
  settings,
  activities,
  today,
}: {
  settings: InternshipSettings | null;
  activities: ActivityDateRecord[];
  today: string;
}): MissingDaySummary {
  if (!settings || !settings.startDate || !settings.endDate) {
    return {
      enabled: false,
      reason: "NO_SETTINGS",
      startDate: settings?.startDate ?? null,
      endDate: settings?.endDate ?? null,
      totalWorkdays: 0,
      loggedWorkdays: 0,
      missingCount: 0,
      draftCount: 0,
      missingDays: [],
    };
  }

  const { startDate, endDate, workingDays } = settings;

  if (endDate < startDate) {
    return {
      enabled: false,
      reason: "RANGE_INVALID",
      startDate,
      endDate,
      totalWorkdays: 0,
      loggedWorkdays: 0,
      missingCount: 0,
      draftCount: 0,
      missingDays: [],
    };
  }

  // Group activities by date
  // A date can have multiple activities; prioritize READY over DRAFT
  const activityMap = new Map<string, { hasReady: boolean; draftId?: string }>();
  for (const act of activities) {
    const existing = activityMap.get(act.activity_date) || { hasReady: false };
    if (act.status === "READY" || act.status === "ARCHIVED") {
      existing.hasReady = true;
    } else if (act.status === "DRAFT") {
      if (!existing.draftId) existing.draftId = act.id;
    }
    activityMap.set(act.activity_date, existing);
  }

  // Evaluation upper bound is clamped to today (future dates are not missing)
  const evalEnd = endDate < today ? endDate : today;

  if (evalEnd < startDate) {
    // Internship has not started yet
    return {
      enabled: true,
      startDate,
      endDate,
      totalWorkdays: 0,
      loggedWorkdays: 0,
      missingCount: 0,
      draftCount: 0,
      missingDays: [],
    };
  }

  const missingDays: MissingDayItem[] = [];
  let totalWorkdays = 0;
  let loggedWorkdays = 0;
  let draftCount = 0;

  // Iterate day by day from startDate to evalEnd
  const cur = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${evalEnd}T00:00:00.000Z`);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dayOfWeek = getIsoWeekday(dateStr);

    if (workingDays.includes(dayOfWeek)) {
      totalWorkdays++;
      const record = activityMap.get(dateStr);

      if (record?.hasReady) {
        loggedWorkdays++;
      } else if (record?.draftId) {
        draftCount++;
        // It has a draft, recorded in missingDays list with hasDraft: true
        missingDays.push({
          date: dateStr,
          dayOfWeek,
          dayName: workingDayNames[dayOfWeek] || "",
          formattedDate: formatIndonesianDate(dateStr),
          hasDraft: true,
          draftActivityId: record.draftId,
        });
      } else {
        // Completely missing
        missingDays.push({
          date: dateStr,
          dayOfWeek,
          dayName: workingDayNames[dayOfWeek] || "",
          formattedDate: formatIndonesianDate(dateStr),
          hasDraft: false,
        });
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Sort missing days descending (most recent missing days first)
  missingDays.sort((a, b) => b.date.localeCompare(a.date));

  const missingCount = missingDays.filter((d) => !d.hasDraft).length;

  return {
    enabled: true,
    startDate,
    endDate,
    totalWorkdays,
    loggedWorkdays,
    missingCount,
    draftCount,
    missingDays,
  };
}
