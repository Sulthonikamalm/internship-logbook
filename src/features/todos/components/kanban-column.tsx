"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodoItem, TodoStage } from "../domain/types";
import { KanbanCard } from "./kanban-card";

export function KanbanColumn({
  stage,
  todos,
  allStages,
  today,
  onCardClick,
  onMoveTo,
  onCreateInStage,
}: {
  stage: TodoStage;
  todos: TodoItem[];
  allStages: TodoStage[];
  today: string;
  onCardClick: (todo: TodoItem) => void;
  onMoveTo: (todo: TodoItem, targetStageId: string) => void;
  onCreateInStage?: (stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: "Stage",
      stage,
    },
  });

  const todoIds = todos.map((t) => t.id);


  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-muted/20 min-w-[280px] w-full max-w-[320px] shrink-0 transition-colors ${
        isOver ? "bg-primary/5 border-primary ring-1 ring-primary/40" : "border-border/70"
      }`}
    >
      {/* Column Header */}
      <div className={`p-3.5 border-b border-border/60 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${
            stage.code === "DONE"
              ? "bg-emerald-500"
              : stage.code === "IN_PROGRESS"
              ? "bg-amber-500"
              : stage.code === "REVIEW"
              ? "bg-purple-500"
              : stage.code === "TODO"
              ? "bg-blue-500"
              : "bg-slate-400"
          }`} />
          <h2 className="font-semibold text-sm tracking-tight text-foreground">
            {stage.name}
          </h2>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {todos.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {stage.requiresEvidenceOnEnter && (
            <div
              className="flex items-center text-xs text-primary font-medium"
              title={`Wajib minimal ${stage.minimumEvidenceCount} evidence valid untuk masuk tahap ini`}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
          )}

          {onCreateInStage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
              onClick={() => onCreateInStage(stage.id)}
              title={`Tambah Todo ke ${stage.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)] min-h-[150px]">
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          {todos.map((todo) => (
            <KanbanCard
              key={todo.id}
              todo={todo}
              currentStage={stage}
              allStages={allStages}
              today={today}
              onClick={() => onCardClick(todo)}
              onMoveTo={(targetStageId) => onMoveTo(todo, targetStageId)}
            />
          ))}
        </SortableContext>

        {todos.length === 0 && (
          <div className="h-24 flex items-center justify-center rounded-md border border-dashed border-border/50 text-xs text-muted-foreground">
            Belum ada Todo
          </div>
        )}
      </div>
    </div>
  );
}
