import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { SafeEvidence } from "../domain/types";
import { utcRangeForLocalDay } from "../domain/date";
import { isRealDate } from "@/features/activity/domain/date";

export type EvidenceFilter = { page?: number; type?: string; assignment?: string; date?: string };
export const EVIDENCE_PAGE_SIZE = 18;

export async function listEvidence(filter: EvidenceFilter = {}): Promise<{
  items: SafeEvidence[]; count: number; page: number;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const page = Math.max(1, Math.min(10000, Math.floor(filter.page || 1)));
  let query = supabase.from("evidence_library")
    .select("id,type,title,note,status,captured_at,created_at,mime_type,size_bytes,width,height,url,assignment_count", { count: "exact" })
    .eq("user_id", user.userId).is("deleted_at", null);
  if (filter.type === "PHOTO" || filter.type === "LINK") query = query.eq("type", filter.type);
  if (filter.type === "BROKEN") query = query.eq("status", "BROKEN");
  if (filter.assignment === "assigned") query = query.gt("assignment_count", 0);
  if (filter.assignment === "unassigned") query = query.eq("assignment_count", 0);
  if (filter.date && isRealDate(filter.date)) {
    const range = utcRangeForLocalDay(filter.date, user.timezone);
    query = query.gte("created_at", range.start).lt("created_at", range.end);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false })
    .range((page - 1) * EVIDENCE_PAGE_SIZE, page * EVIDENCE_PAGE_SIZE - 1);
  if (error) throw new Error("Evidence gagal dimuat.");
  return { page, count: count ?? 0, items: (data ?? []).map((row) => ({
    id: row.id, type: row.type, title: row.title, note: row.note,
    status: row.status, capturedAt: row.captured_at, createdAt: row.created_at,
    mimeType: row.mime_type ?? undefined, sizeBytes: row.size_bytes ?? undefined,
    width: row.width ?? undefined, height: row.height ?? undefined,
    url: row.url ?? undefined, assignmentCount: row.assignment_count ?? 0,
  })) as SafeEvidence[] };
}

export async function evidenceForActivity(activityId: string): Promise<SafeEvidence[]> {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data: relations, error } = await supabase.from("activity_evidences")
    .select("evidence_id").eq("activity_id", activityId).eq("attached_by", user.userId)
    .order("attached_at", { ascending: false }).limit(30);
  if (error) throw new Error("Lampiran gagal dimuat.");
  const ids = (relations ?? []).map((row) => row.evidence_id);
  if (!ids.length) return [];
  const { data, error: evidenceError } = await supabase.from("evidence_library")
    .select("id,type,title,note,status,captured_at,created_at,mime_type,size_bytes,width,height,url,assignment_count")
    .eq("user_id", user.userId).in("id", ids).is("deleted_at", null);
  if (evidenceError) throw new Error("Lampiran gagal dimuat.");
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [{ id: row.id, type: row.type, title: row.title, note: row.note,
      status: row.status, capturedAt: row.captured_at, createdAt: row.created_at,
      mimeType: row.mime_type ?? undefined, sizeBytes: row.size_bytes ?? undefined,
      width: row.width ?? undefined, height: row.height ?? undefined,
      url: row.url ?? undefined, assignmentCount: row.assignment_count ?? 0 } as SafeEvidence] : [];
  });
}
