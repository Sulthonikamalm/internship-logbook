import { localDateAt } from "@/features/activity/domain/date";
import type { TodoRow } from "./row";

export function visibleDailyTodos(rows: TodoRow[], doneStageId: string | undefined, today: string, timeZone: string): TodoRow[] {
  return rows.filter(row => row.current_stage_id !== doneStageId || !row.completed_at || localDateAt(new Date(row.completed_at), timeZone) === today);
}
