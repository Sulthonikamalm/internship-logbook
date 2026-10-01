import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { getBoardData } from "@/features/todos/server/get-board-data";
import { KanbanBoard } from "@/features/todos/components/kanban-board";
import { KanbanSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Todo Kanban & Evidence Gates — InternFlow",
  description: "Kelola alur kerja magang, kanban interaktif, dan validasi evidence gate.",
};

export default async function TodosPage() {
  const user = await requireActiveUser();
  const boardData = await getBoardData();
  const today = localDateAt(new Date(), user.timezone);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <KanbanSquare className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Todo Kanban
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visualisasi alur pengerjaan tugas magang, transisi server-authoritative, dan perlindungan evidence gate.
          </p>
        </div>
      </div>

      {/* Main Board */}
      <KanbanBoard
        initialStages={boardData.stages}
        initialTodos={boardData.todos}
        today={today}
      />
    </div>
  );
}
