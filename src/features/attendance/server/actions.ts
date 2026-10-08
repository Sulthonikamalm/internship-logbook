"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceActionResult, AttendanceSession } from "../domain/types";

const sessionIdSchema = z.uuid();

function actionFailure(): AttendanceActionResult {
  return { ok: false, message: "Absen belum tersimpan. Periksa koneksi lalu coba lagi." };
}

function sessionFromRpc(payload: unknown): AttendanceSession | null {
  if (!payload || typeof payload !== "object") return null;
  const session = (payload as { session?: unknown }).session;
  if (!session || typeof session !== "object") return null;
  return session as AttendanceSession;
}

export async function startAttendance(): Promise<AttendanceActionResult> {
  await requireActiveUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_daily_attendance");
  if (error) {
    console.error(`[attendance.start] database code=${error.code}`);
    return actionFailure();
  }
  const session = sessionFromRpc(data);
  if (!session) return actionFailure();
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  return { ok: true, session };
}

export async function endAttendance(id: string): Promise<AttendanceActionResult> {
  await requireActiveUser();
  const parsed = sessionIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Sesi absen tidak valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_daily_attendance", { p_session_id: parsed.data });
  if (error) {
    console.error(`[attendance.end] database code=${error.code}`);
    return actionFailure();
  }
  const payload = data as { ok?: boolean; code?: string; session?: AttendanceSession } | null;
  const session = sessionFromRpc(payload);
  if (!payload?.ok || !session) {
    return { ok: false, message: payload?.code === "NOT_FOUND" ? "Sesi absen tidak ditemukan." : "Absen belum dapat diakhiri. Coba lagi." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  return { ok: true, session };
}
