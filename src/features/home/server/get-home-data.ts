import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";

export async function getHomeData() {
  const user = await requireActiveUser();
  const db = await createClient();
  const today = localDateAt(new Date(), user.timezone);
  const month = today.slice(0, 7) + "-01";
  const monthEnd = new Date(`${month}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const results = await Promise.all([
    db.from("activities").select("id,title,activity_date,status").eq("user_id", user.userId).is("deleted_at", null).order("activity_date", { ascending: false }).order("created_at", { ascending: false }).limit(4),
    db.from("activities").select("id", { count: "exact", head: true }).eq("user_id", user.userId).is("deleted_at", null).gte("activity_date", month).lt("activity_date", monthEnd.toISOString().slice(0, 10)),
    db.from("activities").select("id,title,activity_date").eq("user_id", user.userId).is("deleted_at", null).eq("status", "DRAFT").order("updated_at", { ascending: false }).limit(1),
    db.from("todos").select("id,title,due_date,priority,todo_stages!inner(name,is_terminal)", { count: "exact" }).eq("user_id", user.userId).is("deleted_at", null).eq("todo_stages.is_terminal", false).order("due_date", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false }).limit(3),
    db.from("evidences").select("id", { count: "exact", head: true }).eq("user_id", user.userId).is("deleted_at", null).eq("status", "AVAILABLE"),
    db.from("github_connections").select("connection_status,github_username,last_synced_at").eq("user_id", user.userId).maybeSingle(),
  ]);
  const [recent, monthly, drafts, todos, evidence, github] = results;
  return {
    user, today,
    activities: recent.data ?? [], activitiesError: Boolean(recent.error),
    monthlyCount: monthly.error ? null : monthly.count ?? 0,
    draft: drafts.data?.[0] ?? null,
    todos: todos.data ?? [], todosError: Boolean(todos.error), activeTodoCount: todos.error ? null : todos.count ?? 0,
    evidenceCount: evidence.error ? null : evidence.count ?? 0,
    github: github.data, githubError: Boolean(github.error),
  };
}
