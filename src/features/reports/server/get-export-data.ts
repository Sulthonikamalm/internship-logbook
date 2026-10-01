import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { ExportLogbookInput } from "../schemas/export.schema";
import type { ExportEvidenceSummaryItem, ExportActivityRow } from "../excel/build-logbook-sheet";
import type { ExportDetailEvidenceItem } from "../excel/build-evidence-sheet";
import type { ExportTodoRow } from "../excel/build-todo-sheet";

export type ExportDataResult = {
  user: {
    userId: string;
    displayName: string;
    timezone: string;
  };
  activities: ExportActivityRow[];
  evidenceDetails: ExportDetailEvidenceItem[];
  todos?: ExportTodoRow[];
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

  // 4. Safely fetch owner Todos for optional Excel Todos sheet
  let todos: ExportTodoRow[] = [];
  try {
    const { data: todosData } = await supabase
      .from("todos")
      .select("id, title, priority, due_date, current_stage_id, started_at, completed_at, evidence_health")
      .eq("user_id", user.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (todosData && todosData.length > 0) {
      type StageRow = { id: string; name: string };
      type TodoRow = {
        id: string;
        title: string;
        priority: string;
        due_date: string | null;
        current_stage_id: string;
        started_at: string | null;
        completed_at: string | null;
        evidence_health: string;
      };

      const { data: stageRows } = await supabase.from("todo_stages").select("id, name");
      const stageMap = new Map(((stageRows ?? []) as unknown as StageRow[]).map((s) => [s.id, s.name]));

      const typedTodos = todosData as unknown as TodoRow[];
      const todoIds = typedTodos.map((t) => t.id);

      // Fetch evidence counts for each todo
      const evidenceCountMap = new Map<string, number>();
      const { data: rels } = await supabase
        .from("todo_evidences")
        .select("todo_id, evidence_id")
        .in("todo_id", todoIds)
        .eq("attached_by", user.userId);

      const distinctEv = new Set<string>();
      for (const r of rels ?? []) {
        const key = `${r.todo_id}:${r.evidence_id}`;
        if (!distinctEv.has(key)) {
          distinctEv.add(key);
          evidenceCountMap.set(r.todo_id, (evidenceCountMap.get(r.todo_id) ?? 0) + 1);
        }
      }

      // Fetch activity counts for each todo
      const activityCountMap = new Map<string, number>();
      const { data: linkedActs } = await supabase
        .from("activities")
        .select("id, todo_id")
        .in("todo_id", todoIds)
        .eq("user_id", user.userId)
        .is("deleted_at", null);

      for (const a of linkedActs ?? []) {
        if (a.todo_id) {
          activityCountMap.set(a.todo_id, (activityCountMap.get(a.todo_id) ?? 0) + 1);
        }
      }

      todos = typedTodos.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.due_date,
        stageName: stageMap.get(t.current_stage_id) ?? "Unknown",
        startedAt: t.started_at,
        completedAt: t.completed_at,
        evidenceCount: evidenceCountMap.get(t.id) ?? 0,
        evidenceHealth: t.evidence_health,
        activityCount: activityCountMap.get(t.id) ?? 0,
      }));
    }
  } catch (todoErr) {
    console.warn("[reports.getExportData] Non-fatal error querying todos for report:", todoErr);
  }

  return {
    user: {
      userId: user.userId,
      displayName: user.displayName,
      timezone: user.timezone,
    },
    activities,
    evidenceDetails,
    todos,
  };
}
