import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityStatus } from "../domain/types";
import { isRealDate } from "../domain/date";

export type ActivityFilters = { page?: number; search?: string; date?: string; status?: string };
export async function listActivities(filters: ActivityFilters) {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const page = Math.max(1, Math.min(10000, Math.floor(filters.page || 1)));
  const pageSize = 20;
  let query = supabase.from("activities").select("*", { count: "exact" })
    .eq("user_id", user.userId).is("deleted_at", null)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.search?.trim()) {
    const term = filters.search.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
    query = query.ilike("title", `%${term}%`);
  }
  if (filters.date && isRealDate(filters.date)) query = query.eq("activity_date", filters.date);
  if (filters.status && ["DRAFT", "READY", "ARCHIVED"].includes(filters.status)) {
    query = query.eq("status", filters.status as ActivityStatus);
  } else {
    query = query.neq("status", "ARCHIVED");
  }
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    console.error(`[activity.list] database code=${error.code}`);
    throw new Error("Aktivitas gagal dimuat.");
  }
  return { activities: (data ?? []) as Activity[], count: count ?? 0, page, pageSize };
}
