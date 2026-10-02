import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getActivityDays } from "./get-activity-days";
import { localDateAt } from "@/features/activity/domain/date";
import { evaluateMissingDays } from "../domain/missing-days";
import type { MissingDaySummary } from "../domain/types";
import { getInternshipSettings } from "./settings";

export async function getMissingDaysSummary(): Promise<MissingDaySummary> {
  const user = await requireActiveUser();
  const settings = await getInternshipSettings();
  const today = localDateAt(new Date(), user.timezone);

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

  const evalEnd = settings.endDate < today ? settings.endDate : today;

  // If internship starts in the future
  if (evalEnd < settings.startDate) {
    return {
      enabled: true,
      startDate: settings.startDate,
      endDate: settings.endDate,
      totalWorkdays: 0,
      loggedWorkdays: 0,
      missingCount: 0,
      draftCount: 0,
      missingDays: [],
    };
  }

  const days = await getActivityDays(settings.startDate, evalEnd);

  return evaluateMissingDays({
    settings,
    activities: days.flatMap(day => day.has_ready ? [{ id: day.activity_date, activity_date: day.activity_date, status: "READY" }]
      : day.draft_id ? [{ id: day.draft_id, activity_date: day.activity_date, status: "DRAFT" }] : []),
    today,
  });
}
