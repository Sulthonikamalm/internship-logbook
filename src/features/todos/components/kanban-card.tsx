"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip, CalendarDays, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TodoItem, TodoStage } from "../domain/types";
import { getAllowedTargetStageCodes } from "../domain/matrix";

export function KanbanCard({ todo, currentStage, allStages, today, onClick, onMoveTo, isOverlay = false, pending = false }: { todo: TodoItem; currentStage: TodoStage; allStages: TodoStage[]; today: string; onClick?: () => void; onMoveTo?: (id: string) => void; isOverlay?: boolean; pending?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id, data: { type: "Todo", todo, stageId: currentStage.id }, disabled: isOverlay || pending });
  const targets = allStages.filter(stage => getAllowedTargetStageCodes(currentStage.code).includes(stage.code));
  const late = todo.dueDate && !currentStage.isTerminal && todo.dueDate < today;
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .35 : 1 }} aria-busy={pending} className={`surface p-4 ${isOverlay ? "shadow-lg ring-2 ring-primary/30" : ""}`}>
    <div className="flex items-center justify-between gap-2"><div>{todo.priority === "URGENT" ? <Badge variant="destructive">Mendesak</Badge> : todo.priority === "HIGH" ? <Badge variant="warning">Prioritas</Badge> : <span className="text-xs text-muted-foreground">{todo.priority === "LOW" ? "Rendah" : "Normal"}</span>}</div><button ref={setActivatorNodeRef} {...(!isOverlay ? attributes : {})} {...listeners} type="button" aria-label={`Geser ${todo.title}`} disabled={pending || isOverlay} className="flex size-11 touch-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted active:cursor-grabbing"><GripVertical size={18} /></button></div>
    <button type="button" onClick={onClick} disabled={pending || isOverlay} className="block min-h-11 w-full text-left text-sm font-semibold leading-relaxed"><span className="line-clamp-3 break-words">{todo.title}</span></button>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{todo.dueDate && <span className={`flex items-center gap-1.5 ${late ? "text-destructive" : ""}`}><CalendarDays size={14} />{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${todo.dueDate}T12:00:00Z`))}{late && " · lewat"}</span>}{Boolean(todo.evidenceCount) && <span className="flex items-center gap-1" aria-label={`${todo.evidenceCount} evidence`}><Paperclip size={14} />{todo.evidenceCount}</span>}</div>
    {todo.evidenceHealth === "EVIDENCE_INCOMPLETE" && <p className="mt-3 flex items-center gap-1.5 text-xs text-warning"><AlertTriangle size={14} />Periksa evidence</p>}
    {onMoveTo && <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">{targets.map(target => <Button key={target.id} variant="ghost" size="sm" disabled={pending} onClick={() => onMoveTo(target.id)} className="flex-1 gap-1 px-2 text-xs">{target.name}<ChevronRight size={14} /></Button>)}</div>}
  </article>;
}
