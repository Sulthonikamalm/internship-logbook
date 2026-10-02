import "server-only";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { attachCommitSchema, type AttachCommitInput } from "../schemas/github.schema";
export interface AttachCommitResult { ok: boolean; evidenceId?: string; reused?: boolean; message?: string }
export async function attachCommitEvidence(rawInput: AttachCommitInput): Promise<AttachCommitResult> {
  await requireActiveUser();
  const parsed = attachCommitSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "Pilih commit yang tersedia di cache GitHub." };
  const input = parsed.data;
  const db = await createClient();
  const { data, error } = await db.rpc("select_github_commit_evidence", { p_commit_id: input.commitId, p_activity_id: input.activityId ?? null, p_todo_id: input.todoId ?? null, p_title: input.title ?? null, p_note: input.note ?? null });
  if (error || !data) return { ok: false, message: "Commit belum dapat dilampirkan. Coba lagi." };
  if (!data.ok) return data as AttachCommitResult;
  for (const path of ["/evidence", "/todos", "/dashboard", "/integrations"]) revalidatePath(path);
  if (input.activityId) revalidatePath(`/activities/${input.activityId}`);
  return data as AttachCommitResult;
}
