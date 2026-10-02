"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { transitionTodoSchema, type TransitionTodoInput } from "../schemas/todo.schema";
export type TransitionResult = { ok: true; newVersion: number; todoId: string; currentStageId: string; message: string; activityId?: string | null; replayed?: boolean } | { ok: false; code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "EVIDENCE_REQUIRED" | "NOTE_REQUIRED" | "VALIDATION_ERROR" | "ERROR"; message: string; minimum?: number; current?: number; allowedTypes?: string[] };
export async function transitionTodo(rawInput: TransitionTodoInput): Promise<TransitionResult> {
  await requireActiveUser();
  const parsed = transitionTodoSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const input = parsed.data;
  const db = await createClient();
  const { data, error } = await db.rpc("transition_todo", { p_todo_id: input.todoId, p_target_stage_id: input.targetStageId, p_expected_version: input.expectedVersion, p_idempotency_key: input.idempotencyKey, p_note: input.note });
  if (error || !data) return { ok: false, code: "ERROR", message: "Todo belum berpindah. Muat ulang dan coba lagi." };
  if (data.ok) { for (const path of ["/todos", "/dashboard", "/activities", "/logbook", "/calendar", "/reports"]) revalidatePath(path); }
  return data as TransitionResult;
}
