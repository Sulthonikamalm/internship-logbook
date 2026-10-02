import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all-rows";
import type { SafeEvidence } from "../domain/types";
import { utcRangeForLocalDay } from "../domain/date";
import { isRealDate } from "@/features/activity/domain/date";

export type EvidenceFilter = { page?: number; type?: string; assignment?: string; date?: string };
export const EVIDENCE_PAGE_SIZE = 18;
const columns = "id,type,title,note,status,captured_at,created_at,mime_type,size_bytes,width,height,url,repository_name,sha,commit_message,assignment_count";
type LibraryRow = { id: string; type: SafeEvidence["type"]; title: string | null; note: string | null; status: SafeEvidence["status"]; captured_at: string | null; created_at: string; mime_type: string | null; size_bytes: number | null; width: number | null; height: number | null; url: string | null; repository_name: string | null; sha: string | null; commit_message: string | null; assignment_count: number | null };
function toEvidence(row: LibraryRow): SafeEvidence {
  return { id: row.id, type: row.type, title: row.title, note: row.note, status: row.status,
    capturedAt: row.captured_at, createdAt: row.created_at, mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined, width: row.width ?? undefined, height: row.height ?? undefined,
    url: row.url ?? undefined, assignmentCount: row.assignment_count ?? 0,
    githubCommit: row.sha ? { commitUrl: row.url || "", repositoryName: row.repository_name || "", sha: row.sha, message: row.commit_message } : undefined };
}
export async function listEvidence(filter: EvidenceFilter = {}): Promise<{ items: SafeEvidence[]; count: number; page: number }> {
  const user = await requireActiveUser(); const supabase = await createClient();
  const page = Number.isFinite(filter.page) ? Math.max(1, Math.min(10000, Math.floor(filter.page!))) : 1;
  let query = supabase.from("evidence_library").select(columns, { count: "exact" }).eq("user_id", user.userId).is("deleted_at", null);
  if (["PHOTO", "LINK", "GITHUB_COMMIT"].includes(filter.type ?? "")) query = query.eq("type", filter.type!);
  if (filter.type === "BROKEN") query = query.eq("status", "BROKEN");
  if (filter.assignment === "assigned") query = query.gt("assignment_count", 0);
  if (filter.assignment === "unassigned") query = query.eq("assignment_count", 0);
  if (filter.date && isRealDate(filter.date)) {
    const range = utcRangeForLocalDay(filter.date, user.timezone);
    query = query.gte("created_at", range.start).lt("created_at", range.end);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id")
    .range((page - 1) * EVIDENCE_PAGE_SIZE, page * EVIDENCE_PAGE_SIZE - 1);
  if (error) throw new Error("Evidence gagal dimuat.");
  return { page, count: count ?? 0, items: (data as LibraryRow[] ?? []).map(toEvidence) };
}
export async function evidenceForActivity(activityId: string): Promise<SafeEvidence[]> {
  const user = await requireActiveUser(); const supabase = await createClient();
  const relations = await readAllRows((from, to) => supabase.from("activity_evidences").select("evidence_id").eq("activity_id", activityId).eq("attached_by", user.userId).order("attached_at", { ascending: false }).order("evidence_id").range(from, to), "Lampiran gagal dimuat.");
  const ids = relations.map(row => row.evidence_id); const rows: LibraryRow[] = [];
  for (let start = 0; start < ids.length; start += 150) {
    const result = await supabase.from("evidence_library").select(columns).eq("user_id", user.userId).in("id", ids.slice(start, start + 150)).is("deleted_at", null);
    if (result.error) throw new Error("Lampiran gagal dimuat.");
    rows.push(...(result.data as LibraryRow[] ?? []));
  }
  const byId = new Map(rows.map(row => [row.id, toEvidence(row)]));
  return ids.flatMap(id => { const item = byId.get(id); return item ? [item] : []; });
}
