import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { relatedOne } from "@/lib/supabase/read-all-rows";
import { normalizeLogbookFilters } from "../domain/filters";
import type { ActivityStatus } from "@/features/activity/domain/types";
import type { EvidenceStatus, EvidenceType } from "@/features/evidence/domain/types";
import type { LogbookEvidenceItem, LogbookFilterInput, LogbookRow, NormalizedLogbookFilters } from "../domain/types";

export type LogbookRowsResult = { rows: LogbookRow[]; count: number; totalUnfilteredCount: number; page: number; pageSize: number; totalPages: number; filters: NormalizedLogbookFilters };
export async function getLogbookRows(rawParams: LogbookFilterInput): Promise<LogbookRowsResult> {
  const user = await requireActiveUser(); const filters = normalizeLogbookFilters(rawParams, user.timezone); const supabase = await createClient();
  const total = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("user_id", user.userId).is("deleted_at", null);
  if (total.error) throw new Error("Jumlah Activity belum dapat dimuat.");
  let query = supabase.from("logbook_activities").select("*", { count: "exact" }).eq("user_id", user.userId).is("deleted_at", null);
  if (filters.from) query = query.gte("activity_date", filters.from);
  if (filters.to) query = query.lte("activity_date", filters.to);
  if (filters.q) { const escaped = filters.q.replace(/[\\%_]/g, "\\$&").replace(/[(),]/g, " "); query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`); }
  const evidenceColumn = { photo: "photo_count", link: "link_count", github: "github_count" };
  if (filters.evidenceType in evidenceColumn) query = query.gt(evidenceColumn[filters.evidenceType as keyof typeof evidenceColumn], 0);
  else if (filters.evidenceType === "none") query = query.eq("total_evidence_count", 0);
  const result = await query.order("activity_date", { ascending: false }).order("start_time", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1);
  if (result.error) throw new Error("Data logbook gagal dimuat.");
  const activities = result.data ?? []; const evidenceMap = new Map<string, LogbookEvidenceItem[]>();
  if (activities.length) {
    const relations = await supabase.from("activity_evidences").select("activity_id,evidence_id,attached_at").in("activity_id", activities.map(row => row.id)).eq("attached_by", user.userId).order("attached_at", { ascending: false });
    if (relations.error) throw new Error("Lampiran logbook gagal dimuat.");
    const ids = [...new Set((relations.data ?? []).map(row => row.evidence_id))];
    if (ids.length) {
      const evidence = await supabase.from("evidences").select("id,type,title,status,note,link_evidences(url),github_evidences(commit_url)").in("id", ids).eq("user_id", user.userId).is("deleted_at", null);
      if (evidence.error) throw new Error("Evidence logbook gagal dimuat.");
      type Evidence = { id: string; type: EvidenceType; title: string | null; status: EvidenceStatus; note: string | null; link_evidences?: { url: string } | { url: string }[]; github_evidences?: { commit_url: string } | { commit_url: string }[] };
      const byId = new Map((evidence.data as unknown as Evidence[] ?? []).map(item => [item.id, item]));
      for (const rel of relations.data ?? []) {
        const item = byId.get(rel.evidence_id); if (!item) continue;
        const list = evidenceMap.get(rel.activity_id) ?? [];
        list.push({ id: item.id, type: item.type, title: item.title, status: item.status, note: item.note,
          thumbnailUrl: item.type === "PHOTO" ? `/api/media/evidence/${item.id}?thumb=1` : undefined,
          url: relatedOne(item.link_evidences)?.url ?? relatedOne(item.github_evidences)?.commit_url });
        evidenceMap.set(rel.activity_id, list);
      }
    }
  }
  const rows: LogbookRow[] = activities.map(row => ({ id: row.id, activityDate: row.activity_date, startTime: row.start_time, endTime: row.end_time, title: row.title ?? "Activity", description: row.description, source: row.source ?? "manual", status: row.status as ActivityStatus, needsDescription: Boolean(row.needs_description), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, photoCount: Number(row.photo_count), linkCount: Number(row.link_count), brokenCount: Number(row.broken_count), totalEvidenceCount: Number(row.total_evidence_count), evidences: evidenceMap.get(row.id) ?? [] }));
  return { rows, count: result.count ?? 0, totalUnfilteredCount: total.count ?? 0, page: filters.page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil((result.count ?? 0) / filters.pageSize)), filters };
}
