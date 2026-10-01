/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type {
  TodoDetailItem,
  TodoEvidenceItem,
  TodoRelatedActivity,
  TodoStage,
  TodoTransition,
} from "../domain/types";

export async function getTodoDetail(todoId: string): Promise<TodoDetailItem | null> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  // 1. Fetch Todo
  const { data: todoData, error: todoError } = await supabase
    .from("todos")
    .select("*")
    .eq("id", todoId)
    .eq("user_id", user.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (todoError || !todoData) {
    return null;
  }

  // 2. Fetch stage
  const { data: stageData } = await supabase
    .from("todo_stages")
    .select("*")
    .eq("id", todoData.current_stage_id)
    .single();

  const stage: TodoStage = {
    id: stageData?.id ?? todoData.current_stage_id,
    code: stageData?.code ?? "BACKLOG",
    name: stageData?.name ?? "Backlog",
    position: stageData?.position ?? 10,
    requiresEvidenceOnEnter: Boolean(stageData?.requires_evidence_on_enter),
    requiresEvidenceOnExit: Boolean(stageData?.requires_evidence_on_exit),
    minimumEvidenceCount: stageData?.minimum_evidence_count ?? 0,
    allowedEvidenceTypes: stageData?.allowed_evidence_types ?? null,
    requiresNote: Boolean(stageData?.requires_note),
    isTerminal: Boolean(stageData?.is_terminal),
  };

  // 3. Fetch attached evidences
  const evidences: TodoEvidenceItem[] = [];
  try {
    const { data: rels } = await supabase
      .from("todo_evidences")
      .select("id, evidence_id, stage_id, attached_at")
      .eq("todo_id", todoId)
      .eq("attached_by", user.userId)
      .order("attached_at", { ascending: false });

    const evidenceIds = rels?.map((r: any) => r.evidence_id) ?? [];
    if (evidenceIds.length > 0) {
      const { data: evItems } = await supabase
        .from("evidences")
        .select("id, type, title, status, link_evidences(url)")
        .in("id", evidenceIds)
        .eq("user_id", user.userId)
        .is("deleted_at", null);

      const evMap = new Map((evItems ?? []).map((e: any) => [e.id, e]));

      for (const r of rels ?? []) {
        const item: any = evMap.get(r.evidence_id);
        if (item) {
          evidences.push({
            id: r.id,
            todoId,
            evidenceId: item.id,
            stageId: r.stage_id,
            attachedAt: r.attached_at,
            title: item.title,
            type: item.type,
            status: item.status,
            url: item.type === "LINK" ? item.link_evidences?.[0]?.url : null,
          });
        }
      }
    }
  } catch (err) {
    console.error("[todos.getTodoDetail] evidence join error:", err);
  }

  // 4. Fetch linked activities
  const activities: TodoRelatedActivity[] = [];
  try {
    const { data: actRows } = await supabase
      .from("activities")
      .select("id, title, activity_date, start_time, end_time")
      .eq("todo_id", todoId)
      .eq("user_id", user.userId)
      .is("deleted_at", null)
      .order("activity_date", { ascending: false });

    for (const a of actRows ?? []) {
      activities.push({
        id: a.id,
        title: a.title,
        activityDate: a.activity_date,
        startTime: a.start_time,
        endTime: a.end_time,
      });
    }
  } catch (err) {
    console.error("[todos.getTodoDetail] activity join error:", err);
  }

  // 5. Fetch transition history
  const transitions: TodoTransition[] = [];
  try {
    const { data: transRows } = await supabase
      .from("todo_transitions")
      .select("id, todo_id, user_id, from_stage_id, to_stage_id, note, evidence_count, idempotency_key, created_at")
      .eq("todo_id", todoId)
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false });

    // Fetch stage names map
    const { data: allStages } = await supabase.from("todo_stages").select("id, name");
    const stageNameMap = new Map((allStages ?? []).map((s: any) => [s.id, s.name]));

    for (const t of transRows ?? []) {
      transitions.push({
        id: t.id,
        todoId: t.todo_id,
        userId: t.user_id,
        fromStageId: t.from_stage_id,
        toStageId: t.to_stage_id,
        note: t.note,
        evidenceCount: t.evidence_count,
        idempotencyKey: t.idempotency_key,
        createdAt: t.created_at,
        fromStageName: t.from_stage_id ? stageNameMap.get(t.from_stage_id) : undefined,
        toStageName: stageNameMap.get(t.to_stage_id) ?? "Unknown",
      });
    }
  } catch (err) {
    console.error("[todos.getTodoDetail] transition join error:", err);
  }

  return {
    id: todoData.id,
    userId: todoData.user_id,
    title: todoData.title,
    description: todoData.description,
    priority: todoData.priority,
    dueDate: todoData.due_date,
    currentStageId: todoData.current_stage_id,
    sortOrder: Number(todoData.sort_order),
    evidenceHealth: todoData.evidence_health,
    version: todoData.version,
    startedAt: todoData.started_at,
    completedAt: todoData.completed_at,
    createdAt: todoData.created_at,
    updatedAt: todoData.updated_at,
    deletedAt: todoData.deleted_at,
    evidenceCount: evidences.length,
    activityCount: activities.length,
    stage,
    evidences,
    activities,
    transitions,
  };
}
