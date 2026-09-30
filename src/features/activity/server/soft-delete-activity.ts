"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityActionResult } from "../domain/types";
import { activityConflict, internalFailure, missingActivity } from "./result";

export async function softDeleteActivity(id: string): Promise<ActivityActionResult> {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase.from("activities")
    .select("*").eq("id", id).eq("user_id", user.userId).maybeSingle();
  if (readError) return internalFailure("delete.read", readError.code);
  if (!existing) return missingActivity;
  if (existing.deleted_at) return { ok: true, activity: existing as Activity };

  const { data, error } = await supabase.from("activities").update({
    deleted_at: new Date().toISOString(),
    version: existing.version + 1,
  }).eq("id", id).eq("user_id", user.userId).eq("version", existing.version)
    .is("deleted_at", null).select("*").maybeSingle();
  if (error) return internalFailure("delete", error.code);
  if (!data) {
    const { data: current, error: retryError } = await supabase.from("activities")
      .select("*").eq("id", id).eq("user_id", user.userId).maybeSingle();
    if (retryError) return internalFailure("delete.retry", retryError.code);
    if (!current) return missingActivity;
    return current.deleted_at ? { ok: true, activity: current as Activity } : activityConflict;
  }
  revalidatePath("/activities");
  revalidatePath(`/activities/${id}`);
  return { ok: true, activity: data as Activity };
}
