"use client";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodoItem, TodoStage } from "../domain/types";
import { KanbanCard } from "./kanban-card";
export function KanbanColumn({ stage, todos, allStages, today, onCardClick, onMoveTo, onCreateInStage, pendingId }: { stage: TodoStage; todos: TodoItem[]; allStages: TodoStage[]; today: string; onCardClick: (todo: TodoItem) => void; onMoveTo: (todo: TodoItem, id: string) => void; onCreateInStage?: (id: string) => void; pendingId?: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "Stage", stage } });
  return <section ref={setNodeRef} aria-label={stage.name} className={`w-full rounded-2xl p-2 lg:w-72 ${isOver ? "bg-secondary ring-2 ring-primary/30" : "bg-muted/60"}`}>
    <div className="mb-2 flex min-h-12 items-center justify-between px-2"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{stage.name}</h2><span className="text-xs tabular-nums text-muted-foreground">{todos.length}</span>{stage.requiresEvidenceOnEnter && <Paperclip size={14} className="text-muted-foreground" aria-label="Evidence diperlukan" />}</div>{onCreateInStage && ["BACKLOG", "TODO"].includes(stage.code) && <Button variant="ghost" size="icon" onClick={() => onCreateInStage(stage.id)} aria-label={`Buat todo di ${stage.name}`} disabled={Boolean(pendingId)}><Plus size={17} /></Button>}</div>
    <div className="space-y-3"><SortableContext items={todos.map(todo => todo.id)} strategy={verticalListSortingStrategy}>{todos.map(todo => <KanbanCard key={todo.id} todo={todo} currentStage={stage} allStages={allStages} today={today} pending={Boolean(pendingId)} onClick={() => onCardClick(todo)} onMoveTo={id => onMoveTo(todo, id)} />)}</SortableContext>{!todos.length && <p className="flex min-h-28 items-center justify-center text-xs text-muted-foreground">Belum ada todo</p>}</div>
  </section>;
}
