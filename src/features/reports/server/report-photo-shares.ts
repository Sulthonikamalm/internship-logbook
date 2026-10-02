import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { readAllRows } from "@/lib/supabase/read-all-rows";
import type { ExportDataResult } from "./get-export-data";
import type { ExportLogbookInput } from "../schemas/export.schema";
import type { ReportPhotoShare } from "../domain/photo-link";

const photoIds = (data: ExportDataResult) => [...new Set(data.evidenceDetails.filter(item => item.type === "PHOTO" && item.status === "AVAILABLE").map(item => item.evidenceId))];
export const hashReportToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Create an inactive grant; activate it only after the workbook has been generated. */
export async function createReportPhotoShare(data: ExportDataResult, input: ExportLogbookInput): Promise<ReportPhotoShare | null> {
  const ids = photoIds(data);
  if (!ids.length) return null;
  const admin = createAdminClient();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + input.shareExpiresDays * 86400000).toISOString();
  const result = await admin.from("report_photo_shares").insert({
    user_id: data.user.userId, token_hash: hashReportToken(token), work_category: input.category,
    period_from: input.from, period_to: input.to, expires_at: expiresAt,
  }).select("id").single();
  if (result.error || !result.data) throw new Error("Tautan dosen belum dapat dibuat.");
  const id = result.data.id;
  try {
    for (let index = 0; index < ids.length; index += 150) {
      const added = await admin.from("report_photo_share_evidences").insert(ids.slice(index, index + 150).map(evidenceId => ({
        share_id: id, user_id: data.user.userId, evidence_id: evidenceId,
      })));
      if (added.error) throw new Error("Lampiran laporan belum dapat disiapkan.");
    }
  } catch (error) {
    await admin.from("report_photo_shares").delete().eq("id", id).eq("user_id", data.user.userId);
    throw error;
  }
  return { id, token, expiresAt };
}

export async function activateReportPhotoShare(userId: string, shareId: string): Promise<void> {
  const admin = createAdminClient();
  const result = await admin.from("report_photo_shares").update({ activated_at: new Date().toISOString() })
    .eq("id", shareId).eq("user_id", userId).is("activated_at", null).is("revoked_at", null)
    .select("id").single();
  if (result.error || !result.data) throw new Error("Tautan dosen belum dapat diaktifkan.");
}

export async function removeInactiveReportPhotoShare(userId: string, shareId: string): Promise<void> {
  await createAdminClient().from("report_photo_shares").delete()
    .eq("id", shareId).eq("user_id", userId).is("activated_at", null);
}

export type VisibleReportPhotoShare = { id: string; work_category: string; period_from: string; period_to: string; created_at: string; expires_at: string };
export async function listReportPhotoShares(): Promise<VisibleReportPhotoShare[]> {
  const user = await getCurrentUser();
  if (!user?.isActive) return [];
  const admin = createAdminClient();
  return readAllRows((first, last) => admin.from("report_photo_shares")
    .select("id,work_category,period_from,period_to,created_at,expires_at")
    .eq("user_id", user.userId).not("activated_at", "is", null).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).order("id").range(first, last),
  "Daftar tautan dosen belum dapat dimuat.");
}
