"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { resolveActivityDate } from "../domain/date";
import type { Activity, ActivityActionResult } from "../domain/types";
import { updateActivitySchema, type UpdateActivityInput } from "../schemas/activity";
import { activityConflict, domainFailure, internalFailure, missingActivity, validationFailure } from "./result";

export async function updateActivity(id: string, input: UpdateActivityInput): Promise<ActivityActionResult> {
  const user = await requireActiveUser();
  const parsed = updateActivitySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  let activityDate: string;
  try {
    activityDate = resolveActivityDate(parsed.data.activityDate, user.timezone);
  } catch (error) {
    return domainFailure(error instanceof Error ? error.message : "Tanggal tidak valid.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").update({
    title: parsed.data.title,
    description: parsed.data.description,
    activity_date: activityDate,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    status: parsed.data.status,
    work_category: parsed.data.workCategory,
    version: parsed.data.expectedVersion + 1,
  }).eq("id", id).eq("user_id", user.userId).eq("version", parsed.data.expectedVersion)
    .is("deleted_at", null).select("*").maybeSingle();
  if (error) return internalFailure("update", error.code);
  if (!data) {
    const { data: existing } = await supabase.from("activities").select("version")
      .eq("id", id).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
    return existing ? activityConflict : missingActivity;
  }
  revalidatePath("/activities");
  revalidatePath(`/activities/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/logbook");
  revalidatePath("/todos");
  revalidatePath("/calendar");
  return { ok: true, activity: data as Activity };
}
