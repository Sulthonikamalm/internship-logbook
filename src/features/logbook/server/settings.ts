import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { InternshipSettings } from "../domain/types";

export type SettingsResult =
  | { ok: true; settings: InternshipSettings }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function getInternshipSettings(): Promise<InternshipSettings | null> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("internship_settings")
    .select("user_id, start_date, end_date, working_days, created_at, updated_at")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error) {
    console.error(`[settings.get] database error: ${error.message} (${error.code})`);
    return null;
  }

  if (!data) return null;

  return {
    userId: data.user_id,
    startDate: data.start_date,
    endDate: data.end_date,
    workingDays: data.working_days ?? [1, 2, 3, 4, 5],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export { saveInternshipSettingsAction as saveInternshipSettings } from "./actions";
