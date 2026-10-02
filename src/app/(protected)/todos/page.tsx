import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { getBoardData } from "@/features/todos/server/get-board-data";
import { KanbanBoard } from "@/features/todos/components/kanban-board";
import { PageHeader } from "@/components/ui/page-header";
export const metadata: Metadata = { title: "Todo — InternFlow" };
export default async function TodosPage({ searchParams }: { searchParams: Promise<{ new?: string; todo?: string }> }) {
  const user = await requireActiveUser();
  const [board, params] = await Promise.all([getBoardData(), searchParams]);
  return <div className="space-y-7"><PageHeader title="Todo" description="Dari rencana hingga selesai." /><KanbanBoard initialStages={board.stages} initialTodos={board.todos} today={localDateAt(new Date(), user.timezone)} initialCreate={params.new === "1"} initialTodoId={params.todo && board.todos.some(todo => todo.id === params.todo) ? params.todo : null} /></div>;
}
