/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTransitionAllowed } from "../domain/matrix";
import { calculateEvidenceHealth } from "../domain/health";
import { transitionTodoSchema, type TransitionTodoInput } from "../schemas/todo.schema";

export type TransitionResult =
  | {
      ok: true;
      newVersion: number;
      todoId: string;
      currentStageId: string;
      message: string;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "EVIDENCE_REQUIRED" | "NOTE_REQUIRED" | "VALIDATION_ERROR" | "ERROR";
      message: string;
      minimum?: number;
      current?: number;
      allowedTypes?: string[];
    };

/**
 * Server-authoritative transition service for Todos.
 * Evaluates authentication, ownership, optimistic concurrency lock, transition matrix,
 * evidence gates, note gates, timestamps, and persists immutable transition history.
 */
export async function transitionTodo(rawInput: TransitionTodoInput): Promise<TransitionResult> {
  const parseResult = transitionTodoSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parseResult.error.issues[0]?.message || "Input transisi tidak valid.",
    };
  }

  const { todoId, targetStageId, expectedVersion, idempotencyKey, note } = parseResult.data;

  // 1. Auth check
  const user = await requireActiveUser();
  const supabase = await createClient();

  // 2. Fetch user-owned Todo
  const { data: todo, error: todoErr } = await supabase
    .from("todos")
    .select("*")
    .eq("id", todoId)
    .eq("user_id", user.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (todoErr || !todo) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Todo tidak ditemukan atau sudah dihapus.",
    };
  }

  // Check idempotency first: if already processed with this key, return current state
  const { data: existingTransition } = await supabase
    .from("todo_transitions")
    .select("id, to_stage_id")
    .eq("user_id", user.userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingTransition) {
    return {
      ok: true,
      newVersion: todo.version,
      todoId: todo.id,
      currentStageId: todo.current_stage_id,
      message: "Transisi telah tercatat sebelumnya.",
    };
  }

  // 3. Optimistic locking check
  if (todo.version !== expectedVersion) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Todo telah berubah di perangkat lain. Halaman akan diperbarui.",
    };
  }

  // 4. Fetch stages
  const { data: stages } = await supabase
    .from("todo_stages")
    .select("*")
    .in("id", [todo.current_stage_id, targetStageId]);

  const stageMap = new Map((stages ?? []).map((s: any) => [s.id, s]));
  const fromStage = stageMap.get(todo.current_stage_id);
  const toStage = stageMap.get(targetStageId);

  if (!fromStage || !toStage) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Tahap asal atau tahap tujuan tidak valid.",
    };
  }

  // 5. Authoritative Matrix check
  if (!isTransitionAllowed(fromStage.code, toStage.code)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Transisi langsung dari ${fromStage.name} ke ${toStage.name} tidak diizinkan.`,
    };
  }

  // 6. Evidence Gate check
  let validEvidenceCount = 0;
  if (toStage.requires_evidence_on_enter || (toStage.minimum_evidence_count ?? 0) > 0) {
    // Fetch attached evidences
    const { data: attached } = await supabase
      .from("todo_evidences")
      .select("evidence_id")
      .eq("todo_id", todoId)
      .eq("attached_by", user.userId);

    const attachedIds = attached?.map((a: any) => a.evidence_id) ?? [];

    if (attachedIds.length > 0) {
      // Query evidences where status = AVAILABLE and deleted_at is null
      let evQuery = supabase
        .from("evidences")
        .select("id, type, status")
        .in("id", attachedIds)
        .eq("user_id", user.userId)
        .eq("status", "AVAILABLE")
        .is("deleted_at", null);

      if (toStage.allowed_evidence_types && toStage.allowed_evidence_types.length > 0) {
        evQuery = evQuery.in("type", toStage.allowed_evidence_types);
      }

      const { data: validItems } = await evQuery;
      validEvidenceCount = validItems?.length ?? 0;
    }

    const minRequired = toStage.minimum_evidence_count ?? 1;
    if (validEvidenceCount < minRequired) {
      return {
        ok: false,
        code: "EVIDENCE_REQUIRED",
        minimum: minRequired,
        current: validEvidenceCount,
        allowedTypes: toStage.allowed_evidence_types ?? ["PHOTO", "LINK"],
        message: `Tahap ${toStage.name} memerlukan minimal ${minRequired} evidence valid berstatus SIAP. Saat ini tersedia ${validEvidenceCount}.`,
      };
    }
  }

  // 7. Note Gate check
  if (toStage.requires_note && (!note || note.trim().length === 0)) {
    return {
      ok: false,
      code: "NOTE_REQUIRED",
      message: `Catatan transisi wajib diisi untuk berpindah ke tahap ${toStage.name}.`,
    };
  }

  // 8. Determine timestamps
  const nowIso = new Date().toISOString();
  let newStartedAt = todo.started_at;
  let newCompletedAt = todo.completed_at;

  // First time entering IN_PROGRESS
  if (toStage.code === "IN_PROGRESS" && !newStartedAt) {
    newStartedAt = nowIso;
  }

  // Entering DONE
  if (toStage.code === "DONE") {
    newCompletedAt = nowIso;
  } else if (fromStage.code === "DONE" && toStage.code !== "DONE") {
    // Reopening from DONE
    newCompletedAt = null;
  }

  // 9. Compute evidence health
  const newHealth = calculateEvidenceHealth(
    toStage.code,
    validEvidenceCount,
    toStage.minimum_evidence_count ?? 1
  );

  const newVersion = expectedVersion + 1;

  // 10. Update Todo row
  const { error: updateErr } = await supabase
    .from("todos")
    .update({
      current_stage_id: toStage.id,
      version: newVersion,
      started_at: newStartedAt,
      completed_at: newCompletedAt,
      evidence_health: newHealth,
      updated_at: nowIso,
    })
    .eq("id", todoId)
    .eq("user_id", user.userId)
    .eq("version", expectedVersion);

  if (updateErr) {
    console.error("[todos.transition] Update error:", updateErr.message);
    return {
      ok: false,
      code: "ERROR",
      message: "Gagal memperbarui status Todo.",
    };
  }

  // 11. Record immutable transition history
  try {
    await supabase.from("todo_transitions").insert({
      todo_id: todoId,
      user_id: user.userId,
      from_stage_id: fromStage.id,
      to_stage_id: toStage.id,
      note: note || null,
      evidence_count: validEvidenceCount,
      idempotency_key: idempotencyKey,
      created_at: nowIso,
    });
  } catch (transErr) {
    console.warn("[todos.transition] Non-fatal history insert warning:", transErr);
  }

  // 12. Audit log
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_user_id: user.userId,
      entity_type: "todo",
      entity_id: todoId,
      action: "todo.transitioned",
      metadata: {
        from_stage: fromStage.code,
        to_stage: toStage.code,
        version: newVersion,
        evidence_count: validEvidenceCount,
      },
    });
  } catch (auditErr) {
    console.warn("[todos.transition] Audit log warning:", auditErr);
  }

  return {
    ok: true,
    newVersion,
    todoId,
    currentStageId: toStage.id,
    message: `Todo berhasil dipindahkan ke ${toStage.name}.`,
  };
}
