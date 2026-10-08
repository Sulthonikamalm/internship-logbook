import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { getWorkRecords } from "@/features/work/server/get-work-records";
import type { WorkCategory } from "@/features/work/domain/category";
export async function getHomeData(category: WorkCategory = "INTERNSHIP") {
  const user = await requireActiveUser(); const db = await createClient(); const today = localDateAt(new Date(), user.timezone);
  const month = today.slice(0, 7) + "-01"; const recentFrom = new Date(`${today}T12:00:00Z`); recentFrom.setUTCDate(recentFrom.getUTCDate() - 89);
  const [work, drafts, todos, evidence, github, attendance] = await Promise.all([
    getWorkRecords(recentFrom.toISOString().slice(0, 10), today, category).then(result => ({ records: result.records, error: false })).catch(() => ({ records: [], error: true })),
    db.from("activities").select("id,title,activity_date").eq("user_id", user.userId).eq("work_category", category).is("deleted_at", null).eq("status", "DRAFT").order("updated_at", { ascending: false }).limit(1),
    db.from("todos").select("id,title,due_date,priority,todo_stages!inner(name,is_terminal)", { count: "exact" }).eq("user_id", user.userId).eq("work_category", category).is("deleted_at", null).eq("todo_stages.is_terminal", false).order("due_date", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false }).limit(3),
    db.from("evidences").select("id", { count: "exact", head: true }).eq("user_id", user.userId).is("deleted_at", null).eq("status", "AVAILABLE"),
    db.from("github_connections").select("connection_status,github_username,last_synced_at").eq("user_id", user.userId).maybeSingle(),
    db.from("attendance_sessions").select("id,user_id,work_date,timezone,started_at,auto_close_at,ended_at,auto_closed,created_at").eq("user_id", user.userId).eq("work_date", today).maybeSingle(),
  ]);
  return { user, today, activities: [...work.records].reverse().slice(0, 4), activitiesError: work.error, monthlyCount: work.error ? null : work.records.filter(row => row.date >= month).length, draft: drafts.data?.[0] ?? null,
    todos: todos.data ?? [], todosError: Boolean(todos.error), activeTodoCount: todos.error ? null : todos.count ?? 0, evidenceCount: evidence.error ? null : evidence.count ?? 0, github: github.data, githubError: Boolean(github.error), attendance: attendance.data ?? null, attendanceError: Boolean(attendance.error) };
}
