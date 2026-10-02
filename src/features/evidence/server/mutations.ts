"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { resolveActivityDate } from "@/features/activity/domain/date";
import { validateEvidenceUrl } from "../domain/link";
import { deleteDriveFile } from "@/lib/google-drive/delete";
import { listEvidence } from "./list-evidence";

type MutationResult = { ok: true; id?: string } | { ok: false; message: string; code?: string; count?: number };
const uuid = z.uuid();

export async function getEvidencePickerPage(page: number) {
  await requireActiveUser();
  if (!Number.isInteger(page) || page < 1 || page > 10000) return [];
  const result = await listEvidence({ page });
  return result.items;
}

export async function createLinkEvidence(input: unknown): Promise<MutationResult> {
  await requireActiveUser();
  const parsed = z.object({ title: z.string().max(160), note: z.string().max(10000), url: z.string().max(2048) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data tautan tidak valid." };
  let url: string;
  try { url = validateEvidenceUrl(parsed.data.url); }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Tautan tidak valid." }; }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_link_evidence", {
    p_title: parsed.data.title.trim() || null, p_note: parsed.data.note.trim() || null, p_url: url,
  });
  if (error || !data) return { ok: false, message: "Tautan gagal disimpan. Coba lagi." };
  revalidatePath("/evidence");
  return { ok: true, id: data.id };
}

export async function attachEvidence(activityId: string, evidenceId: string): Promise<MutationResult> {
  const user = await requireActiveUser();
  if (!uuid.safeParse(activityId).success || !uuid.safeParse(evidenceId).success)
    return { ok: false, message: "Lampiran tidak tersedia." };
  const supabase = await createClient();
  const { data: activity } = await supabase.from("activities").select("id")
    .eq("id", activityId).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
  const { data: evidence } = await supabase.from("evidences").select("id")
    .eq("id", evidenceId).eq("user_id", user.userId).eq("status", "AVAILABLE")
    .is("deleted_at", null).maybeSingle();
  if (!activity || !evidence) return { ok: false, message: "Lampiran tidak tersedia." };
  const { error } = await supabase.from("activity_evidences")
    .upsert({ activity_id: activityId, evidence_id: evidenceId, attached_by: user.userId },
      { onConflict: "activity_id,evidence_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: "Lampiran gagal ditambahkan. Muat ulang dan coba lagi." };
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/evidence");
  return { ok: true };
}

export async function detachEvidence(activityId: string, evidenceId: string): Promise<MutationResult> {
  const user = await requireActiveUser();
  if (!uuid.safeParse(activityId).success || !uuid.safeParse(evidenceId).success)
    return { ok: false, message: "Lampiran tidak tersedia." };
  const supabase = await createClient();
  const { error } = await supabase.from("activity_evidences").delete()
    .eq("activity_id", activityId).eq("evidence_id", evidenceId).eq("attached_by", user.userId);
  if (error) return { ok: false, message: "Lampiran gagal dilepas. Coba lagi." };
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/evidence");
  return { ok: true };
}

export async function createPhotoOnlyActivity(evidenceId: string, key: string): Promise<MutationResult> {
  const user = await requireActiveUser();
  if (!uuid.safeParse(evidenceId).success || !uuid.safeParse(key).success)
    return { ok: false, message: "Foto tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_photo_only_activity", {
    p_key: key, p_evidence_id: evidenceId,
    p_activity_date: resolveActivityDate(undefined, user.timezone),
  });
  if (error || !data) return { ok: false,
    message: "Aktivitas gagal dibuat. Foto tetap tersedia di Evidence Library." };
  revalidatePath("/activities");
  revalidatePath("/evidence");
  return { ok: true, id: data.id };
}

export async function deleteEvidence(evidenceId: string, detachAll = false): Promise<MutationResult> {
  const user = await requireActiveUser();
  if (!uuid.safeParse(evidenceId).success) return { ok: false, message: "Evidence tidak tersedia." };
  const supabase = await createClient();
  const { data: started, error } = await supabase.rpc("begin_evidence_delete", {
    p_evidence_id: evidenceId, p_detach_all: detachAll,
  });
  if (error) return { ok: false, message: "Evidence gagal dihapus. Coba lagi." };
  if (!started) return { ok: false, message: "Evidence tidak tersedia." };
  if (started.blocked_count > 0) return { ok: false, code: "ASSIGNED",
    message: `Evidence terpasang pada ${started.blocked_count} Activity/Todo. Tinjau sebelum melepas semua lampiran.`, count: started.blocked_count };
  if (started.status === "DELETED") return { ok: true };
  if (started.type === "PHOTO" && started.drive_file_id) {
    try { await deleteDriveFile(started.drive_file_id); }
    catch {
      const { error: jobError } = await supabase.rpc("record_storage_reconciliation", {
        p_evidence_id: evidenceId, p_drive_file_id: started.drive_file_id,
        p_reason: "DRIVE_DELETE_FAILED", p_error: "Drive delete failed",
      });
      if (jobError) console.error(`[evidence.reconciliation] database code=${jobError.code}`);
      revalidatePath("/evidence");
      return { ok: false, code: "DELETE_PENDING",
        message: "Penghapusan Drive tertunda. Evidence disembunyikan dan akan direkonsiliasi." };
    }
  }
  const { error: finishError } = await supabase.from("evidences")
    .update({ status: "DELETED", deleted_at: new Date().toISOString() })
    .eq("id", evidenceId).eq("user_id", user.userId).eq("status", "DELETE_PENDING");
  if (finishError) {
    if (started.drive_file_id) {
      const { error: jobError } = await supabase.rpc("record_storage_reconciliation", {
        p_evidence_id: evidenceId, p_drive_file_id: started.drive_file_id,
        p_reason: "DRIVE_DELETE_FAILED", p_error: `Metadata finalization failed: ${finishError.code}`,
      });
      if (jobError) console.error(`[evidence.reconciliation] database code=${jobError.code}`);
    }
    return { ok: false, code: "DELETE_PENDING",
      message: "File dihapus, tetapi status belum selesai. Pengelola perlu merekonsiliasi." };
  }
  revalidatePath("/evidence");
  return { ok: true };
}
