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

  // Validate todo ownership if todoId is provided
  if (parsed.data.todoId) {
    const { data: todo } = await supabase
      .from("todos")
      .select("id")
      .eq("id", parsed.data.todoId)
      .eq("user_id", user.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!todo) {
      return domainFailure("Todo tidak ditemukan, bukan milik Anda, atau telah dihapus.");
    }
  }

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

  if (parsed.data.todoId && data?.id) {
    await supabase
      .from("activities")
      .update({ todo_id: parsed.data.todoId })
      .eq("id", data.id)
      .eq("user_id", user.userId);
  }

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/todos");
  return { ok: true, activity: data as Activity };
}
