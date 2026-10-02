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

  const { data, error } = await supabase.rpc("create_activity", {
    p_key: parsed.data.idempotencyKey,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_activity_date: activityDate,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_source: parsed.data.todoId ? "todo" : parsed.data.source,
    p_status: parsed.data.status,
    p_todo_id: parsed.data.todoId ?? null,
  });
  if (error?.code === "42501") return domainFailure("Todo atau akun tidak tersedia. Muat ulang sebelum mencoba lagi.");
  if (error?.message?.includes("IDEMPOTENCY_KEY_REUSED")) return domainFailure("Permintaan ini sudah disimpan dengan isi berbeda. Periksa Activity sebelum membuat catatan baru.");
  if (error || !data) return internalFailure("create", error?.code);

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/todos");
  revalidatePath("/logbook");
  return { ok: true, activity: data as Activity };
}
