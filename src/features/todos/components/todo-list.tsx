"use client";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabels, parseWorkCategory } from "@/features/work/domain/category";
import { getAllowedTargetStageCodes } from "../domain/matrix";
import type { TodoItem, TodoStage } from "../domain/types";

export function TodoList({ todos, stages, pending, onOpen, onMove }: { todos: TodoItem[]; stages: TodoStage[]; pending: boolean; onOpen: (todo: TodoItem) => void; onMove: (todo: TodoItem, stageId: string) => void }) {
  const done = stages.find(stage => stage.code === "DONE");
  return <div className="surface divide-y divide-border/60">{!todos.length && <p className="p-8 text-center text-sm text-muted-foreground">Belum ada tugas untuk pilihan ini.</p>}{todos.map(todo => {
    const stage = stages.find(item => item.id === todo.currentStageId)!;
    const category = parseWorkCategory(todo.workCategory);
    const targets = getAllowedTargetStageCodes(stage.code);
    return <div key={todo.id} data-todo-id={todo.id} className="flex flex-wrap items-center gap-3 p-4"><Button variant="ghost" size="icon" disabled={pending || stage.isTerminal} aria-label={`Selesaikan ${todo.title}`} onClick={() => { if (done) onMove(todo, done.id); }} className={stage.isTerminal ? "text-success" : "text-muted-foreground"}>{stage.isTerminal ? <Check size={21} /> : <Circle size={21} />}</Button><button type="button" onClick={() => onOpen(todo)} disabled={pending} className="min-h-11 min-w-0 flex-1 text-left"><span className={`block break-words text-sm font-medium ${stage.isTerminal ? "text-muted-foreground" : ""}`}>{todo.title}</span><span className="mt-2 flex flex-wrap items-center gap-2"><span className="category-chip" data-category={category}>{categoryLabels[category]}</span>{todo.dueDate && <span className="text-xs text-muted-foreground">{todo.dueDate}</span>}</span></button><select aria-label={`Tahap ${todo.title}`} value={stage.id} disabled={pending} onChange={event => onMove(todo, event.target.value)} className="ml-auto max-w-full text-sm">{stages.filter(item => item.id === stage.id || targets.includes(item.code)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>;
  })}</div>;
}
