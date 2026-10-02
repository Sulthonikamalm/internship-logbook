import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readAllRows, relatedOne } from "@/lib/supabase/read-all-rows";
import { getWorkRecords } from "@/features/work/server/get-work-records";
import type { WorkCategory } from "@/features/work/domain/category";
import type { ExportLogbookInput } from "../schemas/export.schema";
import type { ExportEvidenceSummaryItem, ExportActivityRow } from "../excel/build-logbook-sheet";
import type { ExportDetailEvidenceItem } from "../excel/build-evidence-sheet";
import type { ExportTodoRow } from "../excel/build-todo-sheet";

export type ExportDataResult = { user: { userId: string; displayName: string; timezone: string }; activities: ExportActivityRow[]; evidenceDetails: ExportDetailEvidenceItem[]; todos?: ExportTodoRow[]; category?: WorkCategory; from?: string; to?: string };
async function batches<T>(ids: string[], fetch: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  const output: T[] = []; for (let index = 0; index < ids.length; index += 150) output.push(...await fetch(ids.slice(index, index + 150))); return output;
}
export async function getExportData(input: Omit<ExportLogbookInput, "shareExpiresDays">): Promise<ExportDataResult> {
  const { user, records } = await getWorkRecords(input.from, input.to, input.category);
  const db = await createClient();
  const activityIds = records.flatMap(row => row.activityId ? [row.activityId] : []);
  const todoIds = [...new Set(records.flatMap(row => row.todoId && row.isCompletion ? [row.todoId] : []))];
  const [activityRelations, todoRelations] = await Promise.all([
    batches(activityIds, ids => readAllRows((from, to) => db.from("canonical_activity_evidences").select("activity_id,evidence_id").in("activity_id", ids).eq("attached_by", user.userId).order("activity_id").order("evidence_id").range(from, to), "Lampiran aktivitas gagal dimuat.")),
    batches(todoIds, ids => readAllRows((from, to) => db.from("todo_evidences").select("todo_id,evidence_id").in("todo_id", ids).eq("attached_by", user.userId).order("todo_id").order("evidence_id").range(from, to), "Lampiran tugas gagal dimuat.")),
  ]);
  const evidenceIds = [...new Set([...activityRelations, ...todoRelations].map(row => row.evidence_id))];
  const evidence = await batches(evidenceIds, ids => readAllRows((from, to) => db.from("evidences").select("id,type,title,status,photo_evidences(evidence_id),link_evidences(url),github_evidences(commit_url)").in("id", ids).eq("user_id", user.userId).is("deleted_at", null).order("id").range(from, to), "Bukti laporan gagal dimuat."));
  type Evidence = { id: string; type: "PHOTO" | "LINK" | "GITHUB_COMMIT"; title: string | null; status: string; photo_evidences?: { evidence_id: string } | { evidence_id: string }[]; link_evidences?: { url: string } | { url: string }[]; github_evidences?: { commit_url: string } | { commit_url: string }[] };
  const byId = new Map((evidence as unknown as Evidence[]).map(item => [item.id, item]));
  const byActivity = new Map<string, typeof activityRelations>(); const byTodo = new Map<string, typeof todoRelations>();
  for (const row of activityRelations) { const list = byActivity.get(row.activity_id) ?? []; list.push(row); byActivity.set(row.activity_id, list); }
  for (const row of todoRelations) { const list = byTodo.get(row.todo_id) ?? []; list.push(row); byTodo.set(row.todo_id, list); }
  const evidenceDetails: ExportDetailEvidenceItem[] = [];
  const activities = records.map(record => {
    // Evidence can be attached before completion or later from the Todo drawer.
    // Both relationships belong to the same completed work item.
    const relations = [...(record.activityId ? byActivity.get(record.activityId) ?? [] : []), ...(record.todoId && record.isCompletion ? byTodo.get(record.todoId) ?? [] : [])];
    const seen = new Set<string>(); const items: ExportEvidenceSummaryItem[] = [];
    for (const rel of relations) {
      const item = byId.get(rel.evidence_id); if (!item || seen.has(item.id)) continue; seen.add(item.id);
      const url = relatedOne(item.link_evidences)?.url ?? relatedOne(item.github_evidences)?.commit_url;
      const typed = item.type === "PHOTO" ? Boolean(relatedOne(item.photo_evidences)) : Boolean(url);
      const status = typed ? item.status : "BROKEN";
      items.push({ id: item.id, type: item.type, title: item.title, status, url });
      evidenceDetails.push({ evidenceId: item.id, activityId: record.id, activityDate: record.date, activityTitle: record.title, type: item.type, title: item.title, status, url: url ?? null });
    }
    return { id: record.id, activityDate: record.date, startTime: record.startTime, endTime: record.endTime, title: record.title, description: record.description, evidences: items, status: record.status, href: record.href };
  });
  // This sheet contains completed tasks in the selected period, never the user's entire board.
  const exported = new Map(activities.map(row => [row.id, row]));
  const todos: ExportTodoRow[] = records.filter(row => row.todoId && row.isCompletion).map(record => ({ id: record.todoId!, title: record.title, priority: "", dueDate: null, stageName: "Selesai", startedAt: null, completedAt: record.date,
    evidenceCount: (exported.get(record.id)?.evidences ?? []).filter(item => item.status === "AVAILABLE").length, evidenceHealth: "OK", activityCount: record.activityId ? 1 : 0 }));
  return { user: { userId: user.userId, displayName: user.displayName, timezone: user.timezone }, activities, evidenceDetails, todos, category: input.category, from: input.from, to: input.to };
}
