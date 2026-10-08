import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceHistoryResult, AttendanceSession } from "../domain/types";

const PAGE_SIZE = 20;

export async function getAttendanceHistory(pageInput = 1): Promise<AttendanceHistoryResult> {
  const user = await requireActiveUser();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(pageInput) || 1)));
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("attendance_sessions")
    .select("id,user_id,work_date,timezone,started_at,auto_close_at,ended_at,auto_closed,created_at", { count: "exact" })
    .eq("user_id", user.userId)
    .order("work_date", { ascending: false })
    .order("started_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) {
    console.error(`[attendance.history] database code=${error.code}`);
    throw new Error("Riwayat absen gagal dimuat.");
  }
  const total = count ?? 0;
  return {
    sessions: (data ?? []) as AttendanceSession[],
    count: total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    asOf: new Date().toISOString(),
  };
}
