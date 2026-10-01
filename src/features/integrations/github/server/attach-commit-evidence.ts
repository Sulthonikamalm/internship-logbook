import "server-only";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { attachCommitSchema, type AttachCommitInput } from "../schemas/github.schema";

export interface AttachCommitResult {
  ok: boolean;
  evidenceId?: string;
  reused?: boolean;
  message?: string;
}

export async function attachCommitEvidence(rawInput: AttachCommitInput): Promise<AttachCommitResult> {
  const parseResult = attachCommitSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      message: parseResult.error.issues[0]?.message || "Data commit tidak valid.",
    };
  }

  const input = parseResult.data;
  const user = await requireActiveUser();
  const supabase = await createClient();

  try {
    let evidenceId: string | null = null;
    let reused = false;

    // 1. Check if an Evidence already exists for this exact repository and commit SHA owned by this user
    const { data: candidateGhEvidences } = await supabase
      .from("github_evidences")
      .select("evidence_id")
      .eq("repository_name", input.repositoryName)
      .eq("sha", input.sha);

    if (candidateGhEvidences && candidateGhEvidences.length > 0) {
      const candidateIds = candidateGhEvidences.map((g: { evidence_id: string }) => g.evidence_id);
      const { data: userEvidence } = await supabase
        .from("evidences")
        .select("id")
        .in("id", candidateIds)
        .eq("user_id", user.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (userEvidence?.id) {
        evidenceId = userEvidence.id;
        reused = true;
      }
    }

    if (!evidenceId) {
      // 2. Create new generic Evidence record
      const defaultTitle = input.title || `${input.repositoryName}#${input.sha.slice(0, 7)}`;
      const capturedAt = input.authorDate || new Date().toISOString();

      const { data: newEvidence, error: evError } = await supabase
        .from("evidences")
        .insert({
          user_id: user.userId,
          type: "GITHUB_COMMIT",
          title: defaultTitle,
          note: input.note || input.message || null,
          status: "AVAILABLE",
          captured_at: capturedAt,
        })
        .select("id")
        .single();

      if (evError || !newEvidence) {
        return {
          ok: false,
          message: `Gagal membuat evidence commit: ${evError?.message || "Unknown error"}`,
        };
      }

      evidenceId = newEvidence.id;

      // 3. Insert into github_evidences subtype table
      const { error: ghEvError } = await supabase.from("github_evidences").insert({
        evidence_id: evidenceId,
        github_commit_id: input.commitId || null,
        commit_url: input.commitUrl,
        repository_name: input.repositoryName,
        sha: input.sha,
        message: input.message || null,
        author_date: input.authorDate || null,
      });

      if (ghEvError) {
        // Rollback generic evidence if subtype insert failed
        await supabase.from("evidences").delete().eq("id", evidenceId);
        return {
          ok: false,
          message: `Gagal menyimpan metadata commit: ${ghEvError.message}`,
        };
      }
    }

    // 4. Attach to Activity if activityId is provided
    if (input.activityId) {
      const { data: activity } = await supabase
        .from("activities")
        .select("id")
        .eq("id", input.activityId)
        .eq("user_id", user.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!activity) {
        return { ok: false, message: "Aktivitas tidak ditemukan." };
      }

      const { error: attachError } = await supabase.from("activity_evidences").upsert(
        {
          activity_id: input.activityId,
          evidence_id: evidenceId,
          attached_by: user.userId,
        },
        { onConflict: "activity_id,evidence_id", ignoreDuplicates: true }
      );

      if (attachError) {
        return { ok: false, message: "Gagal melampirkan ke aktivitas." };
      }

      revalidatePath(`/activities/${input.activityId}`);
    }

    // 5. Attach to Todo if todoId is provided
    if (input.todoId) {
      const { data: todo } = await supabase
        .from("todos")
        .select("id, current_stage_id")
        .eq("id", input.todoId)
        .eq("user_id", user.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!todo) {
        return { ok: false, message: "Todo tidak ditemukan." };
      }

      const { error: attachTodoError } = await supabase.from("todo_evidences").upsert(
        {
          todo_id: input.todoId,
          evidence_id: evidenceId,
          stage_id: todo.current_stage_id,
          attached_by: user.userId,
        },
        { onConflict: "todo_id,evidence_id,stage_id", ignoreDuplicates: true }
      );

      if (attachTodoError) {
        return { ok: false, message: "Gagal melampirkan ke Todo." };
      }

      revalidatePath("/todos");
    }

    revalidatePath("/evidence");

    return {
      ok: true,
      evidenceId: evidenceId || undefined,
      reused,
      message: reused
        ? "Evidence commit yang sudah ada berhasil digunakan ulang."
        : "Evidence commit berhasil dibuat dan dilampirkan.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Terjadi kesalahan saat melampirkan commit.",
    };
  }
}
