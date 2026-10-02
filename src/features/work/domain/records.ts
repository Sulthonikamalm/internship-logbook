import { localDateAt } from "@/features/activity/domain/date";
import { parseWorkCategory, type WorkCategory } from "./category";

export type WorkRecord = {
  id: string; kind: "ACTIVITY" | "COMPLETION"; title: string; description: string | null;
  category: WorkCategory; date: string; startTime: string | null; endTime: string | null;
  status: string; activityId?: string; todoId?: string; href: string;
  isCompletion?: boolean; todoDeleted?: boolean;
};
export type RecordActivity = {
  id: string; title: string; description: string | null; activity_date: string; start_time: string | null;
  end_time: string | null; status: string; work_category?: string; todo_id: string | null; completion_transition_id?: string | null;
  created_at?: string; deleted_at?: string | null;
};
export type RecordCompletion = {
  id: string; todo_id: string; created_at: string; work_category: string; completion_snapshot: unknown;
  todo?: { title: string; description: string | null; work_category: string; deleted_at?: string | null } | null;
};
/** Completion snapshots survive reopening, renaming and soft deletion of the task. */
export function mergeWorkRecords(activities: RecordActivity[], completions: RecordCompletion[], from: string, to: string, timezone: string): WorkRecord[] {
  // A deleted auto-record must not reappear as a synthetic completion. Repeated
  // completions on one local day represent one piece of work, not two entries.
  const represented = new Set(activities.map(row => row.completion_transition_id).filter(Boolean));
  const latestAuto = new Map<string, RecordActivity>();
  for (const row of activities) {
    if (row.deleted_at || !row.todo_id || !row.completion_transition_id) continue;
    const key = `${row.todo_id}:${row.activity_date}`;
    const previous = latestAuto.get(key);
    if (!previous || (row.created_at ?? "") > (previous.created_at ?? "") || ((row.created_at ?? "") === (previous.created_at ?? "") && row.id > previous.id)) latestAuto.set(key, row);
  }
  const active = activities.filter(row => !row.deleted_at && (!row.todo_id || !row.completion_transition_id || latestAuto.get(`${row.todo_id}:${row.activity_date}`)?.id === row.id));
  const output: WorkRecord[] = active.map(row => ({ id: row.id, kind: "ACTIVITY", title: row.title, description: row.description,
    category: parseWorkCategory(row.work_category), date: row.activity_date, startTime: row.start_time, endTime: row.end_time,
    status: row.status, activityId: row.id, todoId: row.todo_id ?? undefined, isCompletion: Boolean(row.completion_transition_id), href: `/activities/${row.id}` }));
  const linkedRecords = new Map(output.filter(row => row.todoId).map(row => [`${row.todoId}:${row.date}`, row]));
  const completionDays = new Set(activities.filter(row => row.deleted_at && row.todo_id && row.completion_transition_id).map(row => `${row.todo_id}:${row.activity_date}`));
  for (const row of completions) {
    const date = localDateAt(new Date(row.created_at), timezone);
    if (date < from || date > to) continue;
    const dayKey = `${row.todo_id}:${date}`;
    if (represented.has(row.id) || completionDays.has(dayKey)) continue;
    const snapshot = row.completion_snapshot && typeof row.completion_snapshot === "object" ? row.completion_snapshot as Record<string, unknown> : null;
    const linked = linkedRecords.get(dayKey);
    if (linked) { linked.isCompletion = true; completionDays.add(dayKey); continue; }
    const title = typeof snapshot?.title === "string" ? snapshot.title : row.todo?.title ?? "Tugas selesai";
    const description = typeof snapshot?.description === "string" ? snapshot.description : row.todo?.description ?? null;
    const category = parseWorkCategory(row.work_category); const todoDeleted = !row.todo || Boolean(row.todo.deleted_at);
    output.push({ id: row.id, kind: "COMPLETION", title, description, category,
      date, startTime: null, endTime: null, status: "DONE", todoId: row.todo_id, isCompletion: true, todoDeleted, href: todoDeleted ? `/reports?category=${category}&from=${date}&to=${date}` : `/todos?todo=${row.todo_id}&category=${category}` });
    completionDays.add(dayKey);
  }
  return output.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id.localeCompare(b.id));
}
