"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { internshipSettingsSchema } from "../domain/settings-schema";
import type { InternshipSettings } from "../domain/types";

export type SettingsActionResult =
  | { ok: true; settings: InternshipSettings }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function saveInternshipSettingsAction(
  input: unknown
): Promise<SettingsActionResult> {
  const user = await requireActiveUser();
  const parsed = internshipSettingsSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      fieldErrors[field] = issue.message;
    }
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Pengaturan tidak valid.",
      fieldErrors,
    };
  }

  const { startDate, endDate, workingDays } = parsed.data;
  const supabase = await createClient();

  const payload = {
    user_id: user.userId,
    start_date: startDate,
    end_date: endDate,
    working_days: workingDays,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("internship_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error(`[settings.save] database code=${error.code} message=${error.message}`);
    if (error.code === "23514") {
      return { ok: false, message: "Validasi tanggal atau hari kerja tidak terpenuhi di database." };
    }
    return { ok: false, message: "Pengaturan gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/logbook");

  return {
    ok: true,
    settings: {
      userId: data.user_id,
      startDate: data.start_date,
      endDate: data.end_date,
      workingDays: data.working_days,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}
