import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

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

  // Fetch only non-deleted activities for date evaluation
  const { data: activities, error } = await supabase
    .from("activities")
    .select("id, activity_date, status")
    .eq("user_id", user.userId)
    .is("deleted_at", null)
    .gte("activity_date", settings.startDate)
    .lte("activity_date", evalEnd);

  if (error) {
    console.error(`[missing-days] error querying activities: ${error.message}`);
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

  return evaluateMissingDays({
    settings,
    activities: activities ?? [],
    today,
  });
}
