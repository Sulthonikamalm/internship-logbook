/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { BoardData, TodoItem, TodoStage } from "../domain/types";

/**
 * Fetches stages and user-owned Todos for the Kanban Board.
 * Excludes soft-deleted items, aggregates evidence counts and activity counts efficiently.
 */
export async function getBoardData(): Promise<BoardData> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  // 1. Fetch stages
  const { data: stagesData, error: stagesError } = await supabase
    .from("todo_stages")
    .select("*")
    .order("position", { ascending: true });

  if (stagesError) {
    console.error("[todos.getBoardData] stages error:", stagesError.message);
    throw new Error("Gagal memuat tahapan Todo.");
  }

  const stages: TodoStage[] = (stagesData ?? []).map((s: any) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    position: s.position,
    requiresEvidenceOnEnter: Boolean(s.requires_evidence_on_enter),
    requiresEvidenceOnExit: Boolean(s.requires_evidence_on_exit),
    minimumEvidenceCount: s.minimum_evidence_count ?? 0,
    allowedEvidenceTypes: s.allowed_evidence_types ?? null,
    requiresNote: Boolean(s.requires_note),
    isTerminal: Boolean(s.is_terminal),
  }));

  // 2. Fetch owner todos
  const { data: todosData, error: todosError } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.userId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (todosError) {
    console.error("[todos.getBoardData] todos error:", todosError.message);
    throw new Error("Gagal memuat data Todo.");
  }

  const rawTodos = todosData ?? [];
  if (rawTodos.length === 0) {
    return { stages, todos: [] };
  }

  const todoIds = rawTodos.map((t: any) => t.id);

  // 3. Batched evidence count for the cards (only AVAILABLE valid evidence counts!)
  const evidenceCountMap = new Map<string, number>();
  try {
    const { data: rels } = await supabase
      .from("todo_evidences")
      .select("todo_id, evidence_id")
      .in("todo_id", todoIds)
      .eq("attached_by", user.userId);

    const relEvIds = Array.from(new Set(rels?.map((r: any) => r.evidence_id) ?? []));
    let availableSet = new Set<string>();
    if (relEvIds.length > 0) {
      const { data: availableEvs } = await supabase
        .from("evidences")
        .select("id")
        .in("id", relEvIds)
        .eq("user_id", user.userId)
        .eq("status", "AVAILABLE")
        .is("deleted_at", null);

      availableSet = new Set((availableEvs ?? []).map((e: any) => e.id));
    }

    const distinctEvidences = new Set<string>();
    for (const r of rels ?? []) {
      if (availableSet.has(r.evidence_id)) {
        const key = `${r.todo_id}:${r.evidence_id}`;
        if (!distinctEvidences.has(key)) {
          distinctEvidences.add(key);
          evidenceCountMap.set(r.todo_id, (evidenceCountMap.get(r.todo_id) ?? 0) + 1);
        }
      }
    }
  } catch (err) {
    console.error("[todos.getBoardData] evidence count join error:", err);
  }

  // 4. Batched activity count for the cards
  const activityCountMap = new Map<string, number>();
  try {
    const { data: acts } = await supabase
      .from("activities")
      .select("id, todo_id")
      .in("todo_id", todoIds)
      .eq("user_id", user.userId)
      .is("deleted_at", null);

    for (const a of acts ?? []) {
      if (a.todo_id) {
        activityCountMap.set(a.todo_id, (activityCountMap.get(a.todo_id) ?? 0) + 1);
      }
    }
  } catch (err) {
    console.error("[todos.getBoardData] activity count join error:", err);
  }

  const todos: TodoItem[] = rawTodos.map((t: any) => {
    const evCount = evidenceCountMap.get(t.id) ?? 0;
    const stage = stages.find((s) => s.id === t.current_stage_id);
    let health = t.evidence_health;
    if (stage && (stage.code === "DONE" || stage.code === "REVIEW")) {
      health = evCount < (stage.minimumEvidenceCount || 1) ? "EVIDENCE_INCOMPLETE" : "OK";
    }

    return {
      id: t.id,
      userId: t.user_id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dueDate: t.due_date,
      currentStageId: t.current_stage_id,
      sortOrder: Number(t.sort_order),
      evidenceHealth: health,
      version: t.version,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      deletedAt: t.deleted_at,
      evidenceCount: evCount,
      activityCount: activityCountMap.get(t.id) ?? 0,
    };
  });

  return { stages, todos };
}
