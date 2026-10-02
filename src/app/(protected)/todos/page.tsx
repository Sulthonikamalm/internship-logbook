import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { getBoardData } from "@/features/todos/server/get-board-data";
import { KanbanBoard } from "@/features/todos/components/kanban-board";
import { PageHeader } from "@/components/ui/page-header";
import { workCategorySchema } from "@/features/work/domain/category";
export const metadata: Metadata = { title: "Todo — InternFlow" };
export default async function TodosPage({ searchParams }: { searchParams: Promise<{ new?: string; todo?: string; category?: string }> }) {
  const user = await requireActiveUser();
  const [board, params] = await Promise.all([getBoardData(), searchParams]);
  const selectedCategory = workCategorySchema.safeParse(params.category);
  return <div className="space-y-7"><PageHeader title="Tugas" description="Magang, tugas akhir, dan kegiatan personal." /><KanbanBoard key={`${params.category ?? "ALL"}:${params.todo ?? ""}:${params.new ?? ""}`} initialStages={board.stages} initialTodos={board.todos} today={localDateAt(new Date(), user.timezone)} initialCreate={params.new === "1"} initialCategory={selectedCategory.success ? selectedCategory.data : "ALL"} initialTodoId={params.todo && board.todos.some(todo => todo.id === params.todo) ? params.todo : null} /></div>;
}
