"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Layers,
  CalendarCheck2,
  AlertTriangle,
  MoveRight,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TodoItem, TodoStage } from "../domain/types";
import { getAllowedTargetStageCodes } from "../domain/matrix";

export function KanbanCard({
  todo,
  currentStage,
  allStages,
  today,
  onClick,
  onMoveTo,
  isOverlay = false,
}: {
  todo: TodoItem;
  currentStage: TodoStage;
  allStages: TodoStage[];
  today: string;
  onClick?: () => void;
  onMoveTo?: (targetStageId: string) => void;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    data: {
      type: "Todo",
      todo,
      stageId: currentStage.id,
    },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const isTerminal = currentStage.isTerminal;
  const isOverdue = todo.dueDate && !isTerminal && todo.dueDate < today;
  const isDueToday = todo.dueDate && !isTerminal && todo.dueDate === today;

  // Allowed target stages for mobile fallback move
  const allowedCodes = getAllowedTargetStageCodes(currentStage.code);
  const targetStages = allStages.filter((s) => allowedCodes.includes(s.code));

  // Priority color styling
  const priorityBadgeVariant = () => {
    switch (todo.priority) {
      case "URGENT":
        return "bg-destructive/15 text-destructive border-destructive/30 font-semibold";
      case "HIGH":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium";
      case "MEDIUM":
        return "bg-primary/10 text-primary border-primary/20";
      case "LOW":
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border bg-card p-3 shadow-2xs hover:shadow-xs transition-all ${
        isOverlay ? "rotate-2 shadow-lg ring-2 ring-primary cursor-grabbing" : "cursor-pointer"
      } ${
        todo.evidenceHealth === "EVIDENCE_INCOMPLETE"
          ? "border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10"
          : "border-border/80"
      }`}
      onClick={onClick}
    >
      {/* Top Header: Priority & Drag Handle */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5">
        <Badge
          variant="outline"
          className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${priorityBadgeVariant()}`}
        >
          {todo.priority}
        </Badge>

        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Geser kartu"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Card Title */}
      <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">
        {todo.title}
      </h3>

      {/* Description Snippet */}
      {todo.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {todo.description}
        </p>
      )}

      {/* Bottom Metadata & Indicators */}
      <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {/* Due date badge */}
          {todo.dueDate && (
            <div
              className={`flex items-center gap-1 font-medium text-[11px] ${
                isOverdue
                  ? "text-destructive font-semibold"
                  : isDueToday
                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                  : ""
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>{todo.dueDate}</span>
            </div>
          )}

          {/* Evidence count */}
          {(todo.evidenceCount ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 text-primary text-[11px] font-medium" title="Evidence terlampir">
              <Layers className="h-3 w-3" />
              <span>{todo.evidenceCount}</span>
            </div>
          )}

          {/* Linked Activity count */}
          {(todo.activityCount ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium" title="Activity terhubung">
              <CalendarCheck2 className="h-3 w-3" />
              <span>{todo.activityCount}</span>
            </div>
          )}
        </div>

        {/* Evidence Health Warning */}
        {todo.evidenceHealth === "EVIDENCE_INCOMPLETE" && (
          <div
            className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-semibold"
            title="Evidence tidak lengkap atau rusak"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Incomplete</span>
          </div>
        )}
      </div>

      {/* Mobile Move Dropdown / Fallback */}
      {onMoveTo && targetStages.length > 0 && (
        <div className="mt-2.5 pt-1.5 border-t border-border/40 sm:hidden flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Pindahkan:</span>
          <div className="flex items-center gap-1">
            {targetStages.map((target) => (
              <Button
                key={target.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-1.5 py-0 gap-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveTo(target.id);
                }}
              >
                <span>{target.name}</span>
                <MoveRight className="h-2.5 w-2.5" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
