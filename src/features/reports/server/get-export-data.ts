import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { ExportLogbookInput } from "../schemas/export.schema";
import type { ExportEvidenceSummaryItem, ExportActivityRow } from "../excel/build-logbook-sheet";
import type { ExportDetailEvidenceItem } from "../excel/build-evidence-sheet";

export type ExportDataResult = {
  user: {
    userId: string;
    displayName: string;
    timezone: string;
  };
  activities: ExportActivityRow[];
  evidenceDetails: ExportDetailEvidenceItem[];
};

/**
 * Fetches the user's activities and attached evidence for the requested date range.
 * Strictly enforces user ownership and excludes soft-deleted records.
 * Sorts activities in chronological ascending order (ASC).
 */
export async function getExportData(input: ExportLogbookInput): Promise<ExportDataResult> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  // 1. Fetch activities for the user in the specified date range
  const { data: activityRows, error: activityError } = await supabase
    .from("activities")
    .select("id, activity_date, start_time, end_time, title, description, created_at")
    .eq("user_id", user.userId)
    .gte("activity_date", input.from)
    .lte("activity_date", input.to)
    .is("deleted_at", null)
    .order("activity_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (activityError) {
    console.error("[reports.getExportData] Error fetching activities:", activityError.message);
    throw new Error("Gagal mengambil data aktivitas untuk ekspor.");
  }

  const rawActivities = activityRows ?? [];
  if (rawActivities.length === 0) {
    return {
      user: {
        userId: user.userId,
        displayName: user.displayName,
        timezone: user.timezone,
      },
      activities: [],
      evidenceDetails: [],
    };
  }

  const activityIds = rawActivities.map((a) => a.id);
  const evidenceMap = new Map<string, ExportEvidenceSummaryItem[]>();
  const evidenceDetails: ExportDetailEvidenceItem[] = [];

  // 2. Fetch evidence if requested or needed for summary
  try {
    const { data: relations } = await supabase
      .from("activity_evidences")
      .select("activity_id, evidence_id, attached_at")
      .in("activity_id", activityIds)
      .eq("attached_by", user.userId)
      .order("attached_at", { ascending: true });

    const evidenceIds = Array.from(new Set(relations?.map((r) => r.evidence_id) ?? []));

    if (evidenceIds.length > 0) {
      const { data: evidenceItems } = await supabase
        .from("evidences")
        .select("id, type, title, status, link_evidences(url)")
        .in("id", evidenceIds)
        .eq("user_id", user.userId)
        .is("deleted_at", null);

      type FetchedEvidence = {
        id: string;
        type: "PHOTO" | "LINK";
        title: string | null;
        status: string;
        link_evidences?: { url: string }[];
      };

      const itemMap = new Map<string, FetchedEvidence>();
      for (const item of (evidenceItems ?? []) as unknown as FetchedEvidence[]) {
        itemMap.set(item.id, item);
      }

      // Map activities by ID for quick date lookup
      const activityMap = new Map(rawActivities.map((a) => [a.id, a]));

      for (const rel of relations ?? []) {
        const item = itemMap.get(rel.evidence_id);
        const parentActivity = activityMap.get(rel.activity_id);
        if (!item || !parentActivity) continue;

        const summaryItem: ExportEvidenceSummaryItem = {
          id: item.id,
          type: item.type,
          title: item.title,
          status: item.status,
          url: item.type === "LINK" ? item.link_evidences?.[0]?.url : undefined,
        };

        const currentList = evidenceMap.get(rel.activity_id) || [];
        currentList.push(summaryItem);
        evidenceMap.set(rel.activity_id, currentList);

        evidenceDetails.push({
          evidenceId: item.id,
          activityId: rel.activity_id,
          activityDate: parentActivity.activity_date,
          type: item.type,
          title: item.title,
          status: item.status,
          url: item.type === "LINK" ? item.link_evidences?.[0]?.url : null,
        });
      }
    }
  } catch (err) {
    console.error("[reports.getExportData] Non-fatal error joining evidence:", err);
  }

  // 3. Assemble activities with their evidence items
  const activities: ExportActivityRow[] = rawActivities.map((act) => ({
    id: act.id,
    activityDate: act.activity_date,
    startTime: act.start_time,
    endTime: act.end_time,
    title: act.title,
    description: act.description,
    evidences: evidenceMap.get(act.id) || [],
  }));

  return {
    user: {
      userId: user.userId,
      displayName: user.displayName,
      timezone: user.timezone,
    },
    activities,
    evidenceDetails,
  };
}
