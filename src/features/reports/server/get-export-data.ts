import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { readAllRows, relatedOne } from "@/lib/supabase/read-all-rows";
import type { ExportLogbookInput } from "../schemas/export.schema";
import type { ExportEvidenceSummaryItem, ExportActivityRow } from "../excel/build-logbook-sheet";
import type { ExportDetailEvidenceItem } from "../excel/build-evidence-sheet";
import type { ExportTodoRow } from "../excel/build-todo-sheet";

export type ExportDataResult = { user: { userId: string; displayName: string; timezone: string }; activities: ExportActivityRow[]; evidenceDetails: ExportDetailEvidenceItem[]; todos?: ExportTodoRow[] };
async function batches<T>(ids: string[], fetch: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  const output: T[] = []; for (let index = 0; index < ids.length; index += 150) output.push(...await fetch(ids.slice(index, index + 150))); return output;
}
export async function getExportData(input: ExportLogbookInput): Promise<ExportDataResult> {
  const user = await requireActiveUser(); const supabase = await createClient();
  const rawActivities = await readAllRows((from, to) => supabase.from("activities").select("id,activity_date,start_time,end_time,title,description,created_at").eq("user_id", user.userId).gte("activity_date", input.from).lte("activity_date", input.to).is("deleted_at", null).order("activity_date", { ascending: true }).order("start_time", { ascending: true, nullsFirst: true }).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to), "Activity untuk laporan gagal dimuat.");
  const relations = await batches(rawActivities.map(row => row.id), ids => readAllRows((from, to) => supabase.from("activity_evidences").select("activity_id,evidence_id,attached_at").in("activity_id", ids).eq("attached_by", user.userId).order("attached_at", { ascending: true }).order("evidence_id", { ascending: true }).range(from, to), "Lampiran laporan gagal dimuat."));
  const evidenceIds = [...new Set(relations.map(row => row.evidence_id))];
  const evidence = await batches(evidenceIds, ids => readAllRows((from, to) => supabase.from("evidences").select("id,type,title,status,link_evidences(url),github_evidences(commit_url)").in("id", ids).eq("user_id", user.userId).is("deleted_at", null).order("id", { ascending: true }).range(from, to), "Evidence laporan gagal dimuat."));
  type Evidence = { id: string; type: "PHOTO" | "LINK" | "GITHUB_COMMIT"; title: string | null; status: string; link_evidences?: { url: string } | { url: string }[]; github_evidences?: { commit_url: string } | { commit_url: string }[] };
  const byId = new Map((evidence as unknown as Evidence[]).map(item => [item.id, item]));
  const activityMap = new Map(rawActivities.map(item => [item.id, item]));
  const evidenceMap = new Map<string, ExportEvidenceSummaryItem[]>(); const evidenceDetails: ExportDetailEvidenceItem[] = [];
  for (const rel of relations) {
    const item = byId.get(rel.evidence_id); const parent = activityMap.get(rel.activity_id); if (!item || !parent) continue;
    const url = relatedOne(item.link_evidences)?.url ?? relatedOne(item.github_evidences)?.commit_url;
    const list = evidenceMap.get(rel.activity_id) ?? []; list.push({ id: item.id, type: item.type, title: item.title, status: item.status, url }); evidenceMap.set(rel.activity_id, list);
    evidenceDetails.push({ evidenceId: item.id, activityId: rel.activity_id, activityDate: parent.activity_date, type: item.type, title: item.title, status: item.status, url: url ?? null });
  }
  const activities: ExportActivityRow[] = rawActivities.map(row => ({ id: row.id, activityDate: row.activity_date, startTime: row.start_time, endTime: row.end_time, title: row.title, description: row.description, evidences: evidenceMap.get(row.id) ?? [] }));
  const rawTodos = await readAllRows((from, to) => supabase.from("todos").select("id,title,priority,due_date,current_stage_id,started_at,completed_at,evidence_health").eq("user_id", user.userId).is("deleted_at", null).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to), "Todo untuk laporan gagal dimuat.");
  const todos: ExportTodoRow[] = [];
  if (rawTodos.length) {
    const stages = await supabase.from("todo_stages").select("id,name"); if (stages.error) throw new Error("Tahap Todo gagal dimuat.");
    const stageMap = new Map((stages.data ?? []).map(row => [row.id, row.name]));
    const todoIds = rawTodos.map(row => row.id);
    const todoEvidence = await batches(todoIds, ids => readAllRows((from, to) => supabase.from("todo_evidences").select("todo_id,evidence_id").in("todo_id", ids).eq("attached_by", user.userId).order("todo_id").order("evidence_id").range(from, to), "Bukti Todo gagal dimuat."));
    const availableEvidence = await batches([...new Set(todoEvidence.map(row => row.evidence_id))], ids => readAllRows((from, to) => supabase.from("evidences").select("id").in("id", ids).eq("user_id", user.userId).eq("status", "AVAILABLE").is("deleted_at", null).order("id").range(from, to), "Status bukti Todo gagal dimuat."));
    const available = new Set(availableEvidence.map(row => row.id)); const distinct = new Set<string>(); const evidenceCount = new Map<string, number>();
    for (const rel of todoEvidence) { const key = `${rel.todo_id}:${rel.evidence_id}`; if (available.has(rel.evidence_id) && !distinct.has(key)) { distinct.add(key); evidenceCount.set(rel.todo_id, (evidenceCount.get(rel.todo_id) ?? 0) + 1); } }
    const linked = await batches(todoIds, ids => readAllRows((from, to) => supabase.from("activities").select("id,todo_id").in("todo_id", ids).eq("user_id", user.userId).is("deleted_at", null).order("id").range(from, to), "Catatan Todo gagal dimuat."));
    const activityCount = new Map<string, number>(); for (const row of linked) if (row.todo_id) activityCount.set(row.todo_id, (activityCount.get(row.todo_id) ?? 0) + 1);
    for (const row of rawTodos) todos.push({ id: row.id, title: row.title, priority: row.priority, dueDate: row.due_date, stageName: stageMap.get(row.current_stage_id) ?? "Tahap tidak tersedia", startedAt: row.started_at, completedAt: row.completed_at, evidenceCount: evidenceCount.get(row.id) ?? 0, evidenceHealth: row.evidence_health, activityCount: activityCount.get(row.id) ?? 0 });
  }
  return { user: { userId: user.userId, displayName: user.displayName, timezone: user.timezone }, activities, evidenceDetails, todos };
}
