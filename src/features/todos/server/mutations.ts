"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { createTodoSchema, updateTodoSchema, reorderTodoSchema, attachTodoEvidenceSchema, type CreateTodoInput, type UpdateTodoInput, type ReorderTodoInput, type AttachTodoEvidenceInput } from "../schemas/todo.schema";
import { toTodoItem } from "../domain/row";
import type { TodoItem } from "../domain/types";

export type MutationResponse<T = TodoItem | null> = { ok: true; data: T; message: string } | { ok: false; code: string; message: string };
function refresh() { revalidatePath("/todos"); revalidatePath("/dashboard"); revalidatePath("/evidence"); }
export async function createTodo(rawInput: CreateTodoInput): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const parsed = createTodoSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0].message };
  const db = await createClient();
  let query = db.from("todo_stages").select("id,code");
  query = parsed.data.stageId ? query.eq("id", parsed.data.stageId) : query.eq("code", "BACKLOG");
  const { data: stage } = await query.maybeSingle();
  if (!stage || !["BACKLOG", "TODO"].includes(stage.code)) return { ok: false, code: "INVALID_STAGE", message: "Todo baru dimulai dari Backlog atau To Do." };
  const { data: last, error: orderError } = await db.from("todos").select("sort_order").eq("user_id", user.userId).eq("current_stage_id", stage.id).is("deleted_at", null).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return { ok: false, code: "ERROR", message: "Todo belum dapat dibuat. Coba lagi." };
  const { data, error } = await db.from("todos").insert({ user_id: user.userId, title: parsed.data.title, description: parsed.data.description, priority: parsed.data.priority, due_date: parsed.data.dueDate, current_stage_id: stage.id, sort_order: Number(last?.sort_order ?? 0) + 1000 }).select().single();
  if (error || !data) return { ok: false, code: "ERROR", message: "Todo belum tersimpan. Coba lagi." };
  refresh(); return { ok: true, data: toTodoItem(data), message: "Todo dibuat." };
}
export async function updateTodo(rawInput: UpdateTodoInput): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const parsed = updateTodoSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0].message };
  const input = parsed.data; const db = await createClient();
  const { data, error } = await db.from("todos").update({ title: input.title, description: input.description, priority: input.priority, due_date: input.dueDate }).eq("id", input.id).eq("user_id", user.userId).eq("version", input.expectedVersion).is("deleted_at", null).select().maybeSingle();
  if (error || !data) return { ok: false, code: "CONFLICT", message: "Todo berubah atau tidak tersedia. Muat ulang sebelum menyimpan." };
  refresh(); return { ok: true, data: toTodoItem(data), message: "Todo disimpan." };
}
export async function deleteTodo(todoId: string): Promise<MutationResponse> {
  const user = await requireActiveUser();
  if (!z.uuid().safeParse(todoId).success) return { ok: false, code: "NOT_FOUND", message: "Todo tidak tersedia." };
  const db = await createClient();
  const { data, error } = await db.from("todos").update({ deleted_at: new Date().toISOString() }).eq("id", todoId).eq("user_id", user.userId).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, code: "NOT_FOUND", message: "Todo tidak tersedia atau belum dapat dihapus." };
  refresh(); return { ok: true, data: null, message: "Todo dihapus." };
}
export async function reorderTodo(rawInput: ReorderTodoInput): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const parsed = reorderTodoSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "Urutan tidak valid." };
  const input = parsed.data; const db = await createClient();
  const { data, error } = await db.from("todos").update({ sort_order: input.newSortOrder }).eq("id", input.todoId).eq("user_id", user.userId).eq("current_stage_id", input.stageId).eq("version", input.expectedVersion).is("deleted_at", null).select().maybeSingle();
  if (error || !data) return { ok: false, code: "CONFLICT", message: "Urutan berubah di perangkat lain. Muat ulang untuk melanjutkan." };
  refresh(); return { ok: true, data: toTodoItem(data), message: "Urutan disimpan." };
}
export async function attachTodoEvidence(rawInput: AttachTodoEvidenceInput): Promise<MutationResponse> {
  const user = await requireActiveUser();
  const parsed = attachTodoEvidenceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "Lampiran tidak valid." };
  const db = await createClient(); const input = parsed.data;
  const { error } = await db.from("todo_evidences").upsert({ todo_id: input.todoId, evidence_id: input.evidenceId, stage_id: input.stageId ?? null, attached_by: user.userId }, { onConflict: "todo_id,evidence_id,stage_id", ignoreDuplicates: true });
  if (error) return { ok: false, code: "ERROR", message: "Evidence tidak tersedia atau belum dapat dilampirkan." };
  refresh(); return { ok: true, data: null, message: "Evidence dilampirkan." };
}
export async function detachTodoEvidence(relationId: string): Promise<MutationResponse> {
  const user = await requireActiveUser();
  if (!z.uuid().safeParse(relationId).success) return { ok: false, code: "NOT_FOUND", message: "Lampiran tidak tersedia." };
  const db = await createClient();
  const { data, error } = await db.from("todo_evidences").delete().eq("id", relationId).eq("attached_by", user.userId).select("id").maybeSingle();
  if (error || !data) return { ok: false, code: "ERROR", message: "Lampiran belum dapat dilepas. Coba lagi." };
  refresh(); return { ok: true, data: null, message: "Lampiran dilepas." };
}
