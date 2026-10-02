"use server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { toTodoItem, type TodoRow } from "../domain/row";
import { toTodoStage, type StageRow } from "../domain/stage-row";
import { readAllRows, relatedOne } from "@/lib/supabase/read-all-rows";
import type { TodoDetailItem, TodoEvidenceItem, TodoTransition } from "../domain/types";

export async function getTodoDetail(todoId: string): Promise<TodoDetailItem | null> {
  const user = await requireActiveUser(); if (!z.uuid().safeParse(todoId).success) return null;
  const supabase = await createClient();
  const todo = await supabase.from("todos").select("*").eq("id", todoId).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
  if (todo.error) throw new Error("Detail Todo gagal dimuat."); if (!todo.data) return null;
  const [stages, evidenceRows, activityRows, history] = await Promise.all([
    supabase.from("todo_stages").select("*"),
    readAllRows((from, to) => supabase.from("todo_evidences").select("id,evidence_id,stage_id,attached_at,evidences!inner(id,type,title,status,link_evidences(url),github_evidences(commit_url))").eq("todo_id", todoId).eq("attached_by", user.userId).eq("evidences.user_id", user.userId).is("evidences.deleted_at", null).order("attached_at", { ascending: false }).order("id").range(from, to), "Lampiran Todo gagal dimuat."),
    readAllRows((from, to) => supabase.from("activities").select("id,title,activity_date,start_time,end_time").eq("todo_id", todoId).eq("user_id", user.userId).is("deleted_at", null).order("activity_date", { ascending: false }).order("id").range(from, to), "Activity terkait gagal dimuat."),
    readAllRows((from, to) => supabase.from("todo_transitions").select("id,todo_id,user_id,from_stage_id,to_stage_id,note,evidence_count,idempotency_key,created_at").eq("todo_id", todoId).eq("user_id", user.userId).order("created_at", { ascending: false }).order("id").range(from, to), "Histori Todo gagal dimuat."),
  ]);
  if (stages.error) throw new Error("Tahapan Todo gagal dimuat.");
  const stageRows = stages.data as StageRow[]; const currentStage = stageRows.find(row => row.id === todo.data.current_stage_id); if (!currentStage) throw new Error("Tahap Todo tidak tersedia.");
  const names = new Map(stageRows.map(row => [row.id, row.name]));
  type EvidenceRow = { id: string; evidence_id: string; stage_id: string | null; attached_at: string; evidences: { id: string; type: TodoEvidenceItem["type"]; title: string | null; status: TodoEvidenceItem["status"]; link_evidences?: { url: string } | { url: string }[]; github_evidences?: { commit_url: string } | { commit_url: string }[] } };
  const evidences: TodoEvidenceItem[] = (evidenceRows as unknown as EvidenceRow[]).flatMap(row => { const item = relatedOne(row.evidences); return item ? [{ id: row.id, todoId, evidenceId: item.id, stageId: row.stage_id, attachedAt: row.attached_at, title: item.title, type: item.type, status: item.status, url: relatedOne(item.link_evidences)?.url ?? relatedOne(item.github_evidences)?.commit_url ?? null }] : []; });
  const activities = activityRows.map(row => ({ id: row.id, title: row.title, activityDate: row.activity_date, startTime: row.start_time, endTime: row.end_time }));
  const transitions: TodoTransition[] = history.map(row => ({ id: row.id, todoId: row.todo_id, userId: row.user_id, fromStageId: row.from_stage_id, toStageId: row.to_stage_id, note: row.note, evidenceCount: row.evidence_count, idempotencyKey: row.idempotency_key, createdAt: row.created_at, fromStageName: names.get(row.from_stage_id), toStageName: names.get(row.to_stage_id) ?? "Tahap tidak tersedia" }));
  return { ...toTodoItem(todo.data as TodoRow), evidenceCount: new Set(evidences.filter(item => item.status === "AVAILABLE").map(item => item.evidenceId)).size, activityCount: activities.length, stage: toTodoStage(currentStage), evidences, activities, transitions };
}
