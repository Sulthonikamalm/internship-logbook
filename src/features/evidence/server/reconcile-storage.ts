import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDriveFile } from "@/lib/google-drive/delete";

type Job = { id: string; evidence_id: string; drive_file_id: string;
  reason: "UPLOAD_FINALIZE_FAILED" | "DRIVE_DELETE_FAILED"; attempts: number;
  status: "PENDING" | "IN_PROGRESS"; updated_at: string };

export async function reconcileStorageJobs(limit = 10): Promise<{ processed: number; resolved: number }> {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await admin.from("storage_reconciliation_jobs")
    .select("id,evidence_id,drive_file_id,reason,attempts,status,updated_at")
    .or(`status.eq.PENDING,and(status.eq.IN_PROGRESS,updated_at.lt.${staleBefore})`)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(25, limit)));
  if (error) throw new Error("Reconciliation queue unavailable");
  let processed = 0; let resolved = 0;
  for (const job of (data ?? []) as Job[]) {
    const claim = await admin.from("storage_reconciliation_jobs")
      .update({ status: "IN_PROGRESS", attempts: job.attempts + 1 })
      .eq("id", job.id).eq("status", job.status).eq("updated_at", job.updated_at)
      .select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    processed++;
    try {
      await deleteDriveFile(job.drive_file_id);
      const next = job.reason === "UPLOAD_FINALIZE_FAILED"
        ? { status: "FAILED", metadata: {} }
        : { status: "DELETED", deleted_at: new Date().toISOString() };
      const { data: evidence, error: evidenceError } = await admin.from("evidences")
        .update(next).eq("id", job.evidence_id)
        .eq("status", job.reason === "UPLOAD_FINALIZE_FAILED" ? "ORPHANED" : "DELETE_PENDING")
        .select("status").maybeSingle();
      if (evidenceError) throw new Error(`Evidence metadata code ${evidenceError.code}`);
      if (!evidence) {
        const { data: current, error: currentError } = await admin.from("evidences")
          .select("status").eq("id", job.evidence_id).maybeSingle();
        const desired = job.reason === "UPLOAD_FINALIZE_FAILED" ? "FAILED" : "DELETED";
        if (currentError || current?.status !== desired) throw new Error("Evidence state changed unexpectedly");
      }
      const { error: resolvedError } = await admin.from("storage_reconciliation_jobs")
        .update({ status: "RESOLVED", last_error: null }).eq("id", job.id);
      if (resolvedError) throw new Error(`Job completion code ${resolvedError.code}`);
      resolved++;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message.slice(0, 256) : "Unknown reconciliation error";
      await admin.from("storage_reconciliation_jobs")
        .update({ status: "PENDING", last_error: message }).eq("id", job.id);
    }
  }
  return { processed, resolved };
}
