import type { TodoItem } from "./types";
export type TodoRow = {
  id: string; user_id: string; title: string; description: string | null; priority: TodoItem["priority"];
  due_date: string | null; current_stage_id: string; sort_order: number | string;
  evidence_health: TodoItem["evidenceHealth"]; version: number; started_at: string | null;
  completed_at: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};
export function toTodoItem(row: TodoRow): TodoItem {
  return { id: row.id, userId: row.user_id, title: row.title, description: row.description, priority: row.priority,
    dueDate: row.due_date, currentStageId: row.current_stage_id, sortOrder: Number(row.sort_order),
    evidenceHealth: row.evidence_health, version: row.version, startedAt: row.started_at, completedAt: row.completed_at,
    createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at };
}
