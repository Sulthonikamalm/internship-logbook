/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTodoSchema,
  updateTodoSchema,
  reorderTodoSchema,
  attachTodoEvidenceSchema,
  type CreateTodoInput,
  type UpdateTodoInput,
  type ReorderTodoInput,
  type AttachTodoEvidenceInput,
} from "../schemas/todo.schema";
import { calculateEvidenceHealth } from "../domain/health";

export type MutationResponse<T = any> =
  | { ok: true; data: T; message: string }
  | { ok: false; code: string; message: string };

/**
 * Creates a new Todo in the specified stage (defaults to BACKLOG).
 */
export async function createTodo(rawInput: CreateTodoInput): Promise<MutationResponse> {
  const parseResult = createTodoSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parseResult.error.issues[0]?.message || "Input Todo tidak valid.",
    };
  }

  const user = await requireActiveUser();
  const supabase = await createClient();
  const input = parseResult.data;

  // Resolve stage ID (fallback to BACKLOG if not supplied)
  let targetStageId = input.stageId;
  if (!targetStageId) {
    const { data: backlogStage } = await supabase
      .from("todo_stages")
      .select("id")
      .eq("code", "BACKLOG")
      .single();

    targetStageId = backlogStage?.id;
  }

  if (!targetStageId) {
    return { ok: false, code: "STAGE_NOT_FOUND", message: "Tahap Backlog tidak ditemukan." };
  }

  // Get max sort order in this stage
  const { data: maxOrderRow } = await supabase
    .from("todos")
    .select("sort_order")
    .eq("user_id", user.userId)
    .eq("current_stage_id", targetStageId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (Number(maxOrderRow?.sort_order) || 0) + 1000;

  const { data: newTodo, error: insertError } = await supabase
    .from("todos")
    .insert({
      user_id: user.userId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_date: input.dueDate,
      current_stage_id: targetStageId,
      sort_order: nextSortOrder,
      evidence_health: "OK",
      version: 1,
      deleted_at: null,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[todos.createTodo] Insert error:", insertError.message);
    return { ok: false, code: "ERROR", message: "Gagal membuat Todo." };
  }

  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_user_id: user.userId,
      entity_type: "todo",
      entity_id: newTodo.id,
      action: "todo.created",
      metadata: { title: input.title, priority: input.priority },
    });
  } catch (err) {
    console.warn("[todos.createTodo] Audit log warning:", err);
  }

  revalidatePath("/todos");
  return { ok: true, data: newTodo, message: "Todo berhasil dibuat." };
}

/**
 * Updates Todo details with optimistic version check.
 */
export async function updateTodo(rawInput: UpdateTodoInput): Promise<MutationResponse> {
  const parseResult = updateTodoSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parseResult.error.issues[0]?.message || "Input edit Todo tidak valid.",
    };
  }

  const user = await requireActiveUser();
  const supabase = await createClient();
  const input = parseResult.data;

  const { data: updated, error: updateError } = await supabase
    .from("todos")
    .update({
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_date: input.dueDate,
      version: input.expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("user_id", user.userId)
    .eq("version", input.expectedVersion)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Todo telah diubah di perangkat lain atau tidak ditemukan.",
    };
  }

  revalidatePath("/todos");
  return { ok: true, data: updated, message: "Todo berhasil diperbarui." };
}

/**
 * Soft deletes a Todo.
 */
export async function deleteTodo(todoId: string): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("todos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", todoId)
    .eq("user_id", user.userId);

  if (delError) {
    console.error("[todos.deleteTodo] Delete error:", delError.message);
    return { ok: false, code: "ERROR", message: "Gagal menghapus Todo." };
  }

  revalidatePath("/todos");
  return { ok: true, data: null, message: "Todo berhasil dihapus." };
}

/**
 * Reorders a Todo within the same stage.
 */
export async function reorderTodo(rawInput: ReorderTodoInput): Promise<MutationResponse> {
  const parseResult = reorderTodoSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Input urutan tidak valid." };
  }

  const user = await requireActiveUser();
  const supabase = await createClient();
  const input = parseResult.data;

  const { error: updateError } = await supabase
    .from("todos")
    .update({
      sort_order: input.newSortOrder,
      version: input.expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.todoId)
    .eq("user_id", user.userId)
    .eq("version", input.expectedVersion);

  if (updateError) {
    console.error("[todos.reorderTodo] Error:", updateError.message);
    return { ok: false, code: "CONFLICT", message: "Gagal memperbarui urutan kartu." };
  }

  revalidatePath("/todos");
  return { ok: true, data: null, message: "Urutan Todo diperbarui." };
}

/**
 * Attaches an evidence to a Todo.
 */
export async function attachTodoEvidence(rawInput: AttachTodoEvidenceInput): Promise<MutationResponse> {
  const parseResult = attachTodoEvidenceSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Input lampiran tidak valid." };
  }

  const user = await requireActiveUser();
  const supabase = await createClient();
  const input = parseResult.data;

  // 1. Verify Todo belongs to user and is not deleted
  const { data: todo } = await supabase
    .from("todos")
    .select("id, current_stage_id, evidence_health")
    .eq("id", input.todoId)
    .eq("user_id", user.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!todo) {
    return { ok: false, code: "NOT_FOUND", message: "Todo tidak ditemukan atau sudah dihapus." };
  }

  // 2. Verify evidence belongs to user and is AVAILABLE
  const { data: evItem } = await supabase
    .from("evidences")
    .select("id, status")
    .eq("id", input.evidenceId)
    .eq("user_id", user.userId)
    .eq("status", "AVAILABLE")
    .is("deleted_at", null)
    .maybeSingle();

  if (!evItem) {
    return { ok: false, code: "NOT_FOUND", message: "Evidence tidak ditemukan atau belum berstatus SIAP." };
  }

  // 3. Attach evidence to Todo
  const { error: insertError } = await supabase.from("todo_evidences").insert({
    todo_id: input.todoId,
    evidence_id: input.evidenceId,
    stage_id: input.stageId || null,
    attached_by: user.userId,
  });

  if (insertError) {
    console.error("[todos.attachEvidence] Insert error:", insertError.message);
    return { ok: false, code: "ERROR", message: "Gagal melampirkan evidence ke Todo." };
  }

  // 4. Recalculate health: if Todo is in DONE or REVIEW, recalculate
  const { data: stage } = await supabase
    .from("todo_stages")
    .select("code, minimum_evidence_count")
    .eq("id", todo.current_stage_id)
    .maybeSingle();

  if (stage && (stage.code === "DONE" || stage.code === "REVIEW")) {
    const { data: rels } = await supabase
      .from("todo_evidences")
      .select("evidence_id")
      .eq("todo_id", todo.id)
      .eq("attached_by", user.userId);

    const relIds = rels?.map((r: any) => r.evidence_id) ?? [];
    let validCount = 0;
    if (relIds.length > 0) {
      const { data: validEvs } = await supabase
        .from("evidences")
        .select("id")
        .in("id", relIds)
        .eq("user_id", user.userId)
        .eq("status", "AVAILABLE")
        .is("deleted_at", null);
      validCount = validEvs?.length ?? 0;
    }

    const health = calculateEvidenceHealth(stage.code, validCount, stage.minimum_evidence_count ?? 1);
    await supabase.from("todos").update({ evidence_health: health }).eq("id", todo.id);
  }

  revalidatePath("/todos");
  return { ok: true, data: null, message: "Evidence berhasil dilampirkan ke Todo." };
}

/**
 * Detaches an evidence from a Todo.
 */
export async function detachTodoEvidence(relationId: string): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const { data: rel } = await supabase
    .from("todo_evidences")
    .select("todo_id")
    .eq("id", relationId)
    .eq("attached_by", user.userId)
    .maybeSingle();

  if (!rel) {
    return { ok: false, code: "NOT_FOUND", message: "Lampiran evidence tidak ditemukan." };
  }

  const { error: delError } = await supabase
    .from("todo_evidences")
    .delete()
    .eq("id", relationId)
    .eq("attached_by", user.userId);

  if (delError) {
    return { ok: false, code: "ERROR", message: "Gagal melepas evidence." };
  }

  // Recalculate health for Todo
  const { data: todo } = await supabase
    .from("todos")
    .select("id, current_stage_id")
    .eq("id", rel.todo_id)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (todo) {
    const { data: stage } = await supabase
      .from("todo_stages")
      .select("code, minimum_evidence_count")
      .eq("id", todo.current_stage_id)
      .maybeSingle();

    if (stage && (stage.code === "DONE" || stage.code === "REVIEW")) {
      const { data: rels } = await supabase
        .from("todo_evidences")
        .select("evidence_id")
        .eq("todo_id", todo.id)
        .eq("attached_by", user.userId);

      const relIds = rels?.map((r: any) => r.evidence_id) ?? [];
      let validCount = 0;
      if (relIds.length > 0) {
        const { data: validEvs } = await supabase
          .from("evidences")
          .select("id")
          .in("id", relIds)
          .eq("user_id", user.userId)
          .eq("status", "AVAILABLE")
          .is("deleted_at", null);
        validCount = validEvs?.length ?? 0;
      }

      const health = calculateEvidenceHealth(stage.code, validCount, stage.minimum_evidence_count ?? 1);
      await supabase.from("todos").update({ evidence_health: health }).eq("id", todo.id);
    }
  }

  revalidatePath("/todos");
  return { ok: true, data: null, message: "Evidence dilepas dari Todo." };
}
