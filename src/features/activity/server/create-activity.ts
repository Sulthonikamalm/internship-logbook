"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { resolveActivityDate } from "../domain/date";
import type { Activity, ActivityActionResult } from "../domain/types";
import { createActivitySchema, type CreateActivityInput } from "../schemas/activity";
import { domainFailure, internalFailure, validationFailure } from "./result";

export async function createActivity(input: CreateActivityInput): Promise<ActivityActionResult> {
  const user = await requireActiveUser();
  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let activityDate: string;
  try {
    activityDate = resolveActivityDate(parsed.data.activityDate, user.timezone);
  } catch (error) {
    return domainFailure(error instanceof Error ? error.message : "Tanggal tidak valid.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_activity_idempotent", {
    p_key: parsed.data.idempotencyKey,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_activity_date: activityDate,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_source: parsed.data.source,
    p_status: parsed.data.status,
  });
  if (error || !data) return internalFailure("create", error?.code);
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  return { ok: true, activity: data as Activity };
}
