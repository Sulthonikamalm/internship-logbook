"use client";
import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip, CalendarDays, AlertTriangle, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabels, parseWorkCategory } from "@/features/work/domain/category";
import type { TodoItem, TodoStage } from "../domain/types";
import { getAllowedTargetStageCodes } from "../domain/matrix";

type CardProps = {
  todo: TodoItem;
  currentStage: TodoStage;
  allStages: TodoStage[];
  today: string;
  onClick?: () => void;
  onMoveTo?: (id: string) => void;
  pending?: boolean;
};

export function KanbanCard(props: CardProps) {
  const { todo, currentStage, pending = false } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id, data: { type: "Todo", todo, stageId: currentStage.id }, disabled: pending,
  });
  return <article ref={setNodeRef} {...attributes} {...listeners} data-todo-id={todo.id}
    style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .3 : 1, touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
    aria-busy={pending} data-overdue={Boolean(todo.dueDate && !currentStage.isTerminal && todo.dueDate < props.today)} className="kanban-task">
    <CardContent {...props} onClick={() => { if (!isDragging) props.onClick?.(); }}
      handle={<span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"><GripVertical size={16} /></span>} />
  </article>;
}

/** A visual copy must not register a second sortable node or enter the accessibility tree. */
export function KanbanCardPreview(props: CardProps) {
  return <article aria-hidden="true" data-overdue={Boolean(props.todo.dueDate && !props.currentStage.isTerminal && props.todo.dueDate < props.today)} className="kanban-task kanban-task-dragging">
    <CardContent {...props} preview handle={<span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"><GripVertical size={16} /></span>} />
  </article>;
}

function CardContent({ todo, currentStage, allStages, today, onClick, onMoveTo, pending = false, handle, preview = false }: CardProps & { handle: ReactNode; preview?: boolean }) {
  const next = allStages.find(stage => stage.position > currentStage.position && stage.code !== "DONE" && getAllowedTargetStageCodes(currentStage.code).includes(stage.code));
  const done = allStages.find(stage => stage.code === "DONE");
  const previous = allStages.find(stage => stage.code === "REVIEW");
  const category = parseWorkCategory(todo.workCategory);
  const late = todo.dueDate && !currentStage.isTerminal && todo.dueDate < today;
  const title = <span className="line-clamp-3 break-words">{todo.title}</span>;
  const titleClass = "min-h-11 w-full text-left text-sm font-semibold leading-snug";
  return <>
    <div className="flex items-center justify-between gap-1"><span className="category-chip" data-category={category}>{categoryLabels[category]}</span>{handle}</div>
    {preview ? <p className={titleClass}>{title}</p> : <button type="button" onClick={onClick} disabled={pending} className={titleClass}>{title}</button>}
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
      {todo.dueDate && <span className={`flex items-center gap-1 ${late ? "font-semibold text-destructive" : ""}`}><CalendarDays size={13} />{late ? "Terlambat · " : ""}{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${todo.dueDate}T12:00:00Z`))}</span>}
      {Boolean(todo.evidenceCount) && <span className="flex items-center gap-1" aria-label={`${todo.evidenceCount} evidence`}><Paperclip size={13} />{todo.evidenceCount}</span>}
      {["HIGH", "URGENT"].includes(todo.priority) && <span className="text-warning">{todo.priority === "URGENT" ? "Mendesak" : "Prioritas"}</span>}
    </div>
    {todo.evidenceHealth === "EVIDENCE_INCOMPLETE" && category !== "PERSONAL" && <p className="mt-3 flex items-center gap-1.5 text-xs text-warning"><AlertTriangle size={14} />Lengkapi bukti</p>}
    {onMoveTo && !preview && <div onPointerDown={event => event.stopPropagation()} className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2">
      {next && <Button variant="ghost" size="sm" disabled={pending} onClick={() => onMoveTo(next.id)} className="min-w-0 flex-1 gap-1 px-1 text-xs">{next.name}<ChevronRight size={13} /></Button>}
      {!currentStage.isTerminal && done && <Button variant="ghost" size={next ? "icon" : "sm"} disabled={pending} onClick={() => onMoveTo(done.id)} aria-label={`Selesaikan ${todo.title}`} className="gap-1 text-success"><Check size={17} />{!next && "Selesaikan"}</Button>}
      {currentStage.isTerminal && previous && <Button variant="ghost" size="sm" disabled={pending} onClick={() => onMoveTo(previous.id)} className="w-full text-xs">Buka kembali</Button>}
    </div>}
  </>;
}
