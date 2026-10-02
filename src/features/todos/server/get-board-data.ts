import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all-rows";
import { toTodoItem, type TodoRow } from "../domain/row";
import { toTodoStage, type StageRow } from "../domain/stage-row";
import type { BoardData } from "../domain/types";

export async function getBoardData(): Promise<BoardData> {
  const user = await requireActiveUser(); const supabase = await createClient();
  const [stageResult, rawTodos] = await Promise.all([
    supabase.from("todo_stages").select("*").order("position", { ascending: true }),
    readAllRows((from, to) => supabase.from("todos").select("*").eq("user_id", user.userId).is("deleted_at", null).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to), "Todo gagal dimuat."),
  ]);
  if (stageResult.error || !stageResult.data?.length) throw new Error("Tahapan Todo belum dapat dimuat.");
  const stages = (stageResult.data as StageRow[]).map(toTodoStage);
  if (!rawTodos.length) return { stages, todos: [] };
  const todoIds = new Set(rawTodos.map(row => row.id));
  const [evidences, activities] = await Promise.all([
    readAllRows((from, to) => supabase.from("todo_evidences").select("todo_id,evidence_id,evidences!inner(id)").eq("attached_by", user.userId).eq("evidences.user_id", user.userId).eq("evidences.status", "AVAILABLE").is("evidences.deleted_at", null).order("todo_id").order("evidence_id").range(from, to), "Bukti Todo belum dapat dimuat."),
    readAllRows((from, to) => supabase.from("activities").select("id,todo_id").eq("user_id", user.userId).is("deleted_at", null).not("todo_id", "is", null).order("id").range(from, to), "Catatan Todo belum dapat dimuat."),
  ]);
  const evidenceCount = new Map<string, number>(); const activityCount = new Map<string, number>(); const seen = new Set<string>();
  for (const row of evidences) { const key = `${row.todo_id}:${row.evidence_id}`; if (todoIds.has(row.todo_id) && !seen.has(key)) { seen.add(key); evidenceCount.set(row.todo_id, (evidenceCount.get(row.todo_id) ?? 0) + 1); } }
  for (const row of activities) if (todoIds.has(row.todo_id)) activityCount.set(row.todo_id, (activityCount.get(row.todo_id) ?? 0) + 1);
  return { stages, todos: (rawTodos as TodoRow[]).map(row => ({ ...toTodoItem(row), evidenceCount: evidenceCount.get(row.id) ?? 0, activityCount: activityCount.get(row.id) ?? 0 })) };
}
