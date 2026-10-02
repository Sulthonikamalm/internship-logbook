"use client";
import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { TodoItem, TodoStage, TodoDetailItem } from "../domain/types";
import { isTransitionAllowed } from "../domain/matrix";
import { transitionTodo } from "../server/transition-todo";
import { reorderTodo } from "../server/mutations";
import { getTodoDetail } from "../server/get-todo-detail";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { CreateTodoDialog } from "./create-todo-dialog";
import { TodoDetailDrawer } from "./todo-detail-drawer";
import { EvidenceGateModal } from "./evidence-gate-modal";

export function KanbanBoard({ initialStages: stages, initialTodos, today, initialCreate = false, initialTodoId = null }: { initialStages: TodoStage[]; initialTodos: TodoItem[]; today: string; initialCreate?: boolean; initialTodoId?: string | null }) {
  const router = useRouter();
  const [todos, optimistic] = useOptimistic(initialTodos, (current, change: { id: string; stageId?: string; sortOrder?: number }) => current.map(todo => todo.id === change.id ? { ...todo, currentStageId: change.stageId ?? todo.currentStageId, sortOrder: change.sortOrder ?? todo.sortOrder } : todo));
  const [active, setActive] = useState<TodoItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null); const lock = useRef(false);
  const [query, setQuery] = useState(""); const [priority, setPriority] = useState("ALL");
  const [mobileStage, setMobileStage] = useState(stages[0]?.id);
  const [noteRequest, setNoteRequest] = useState<{ todo: TodoItem; stageId: string; stageName: string } | null>(null);
  const [note, setNote] = useState("");
  const requests = useRef(new Map<string, string>());
  const [create, setCreate] = useState({ open: initialCreate, stageId: undefined as string | undefined, session: 0 });
  const [selected, setSelected] = useState<string | null>(initialTodoId);
  const [detail, setDetail] = useState<TodoDetailItem | null>(null); const [detailError, setDetailError] = useState(""); const [detailRevision, setDetailRevision] = useState(0);
  const [gate, setGate] = useState<{ todoId: string; stage: string; minimum: number; current: number } | null>(null);
  const detailVersion = initialTodos.find(todo => todo.id === selected)?.version;
  useEffect(() => {
    if (!selected) return;
    let valid = true;
    getTodoDetail(selected).then(result => { if (valid) { setDetail(result); setDetailError(result ? "" : "Todo tidak ditemukan."); } }).catch(() => { if (valid) setDetailError("Detail belum dapat dimuat. Coba lagi."); });
    return () => { valid = false; };
  }, [selected, detailVersion, detailRevision]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const grouped = useMemo(() => {
    const map = new Map(stages.map(stage => [stage.id, [] as TodoItem[]]));
    for (const todo of [...todos].sort((a,b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))) {
      if (priority !== "ALL" && todo.priority !== priority) continue;
      if (query.trim() && !`${todo.title} ${todo.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())) continue;
      map.get(todo.currentStageId)?.push(todo);
    }
    return map;
  }, [stages, todos, priority, query]);
  function open(todo: TodoItem) { setDetail(null); setDetailError(""); setSelected(todo.id); setDetailRevision(value => value + 1); }
  function refreshDetail() { setDetailRevision(value => value + 1); router.refresh(); }
  function closeDetail() { setSelected(null); setDetail(null); if (initialTodoId) router.replace("/todos", { scroll: false }); }
  function changeStage(todo: TodoItem, stageId: string, transitionNote?: string) {
    if (lock.current) return;
    const from = stages.find(stage => stage.id === todo.currentStageId); const to = stages.find(stage => stage.id === stageId);
    if (!from || !to || !isTransitionAllowed(from.code, to.code)) { toast.error("Pilih tahap berikutnya atau sebelumnya."); return; }
    if (to.requiresNote && !transitionNote?.trim()) { setNote(""); setNoteRequest({ todo, stageId, stageName: to.name }); return; }
    const request = `${todo.id}:${stageId}:${todo.version}:${transitionNote?.trim() ?? ""}`;
    if (!requests.current.has(request)) requests.current.set(request, crypto.randomUUID());
    lock.current = true; setPendingId(todo.id);
    startTransition(async () => {
      optimistic({ id: todo.id, stageId });
      try {
        const result = await transitionTodo({ todoId: todo.id, targetStageId: stageId, expectedVersion: todo.version, idempotencyKey: requests.current.get(request)!, note: transitionNote });
        if (result.ok) { requests.current.delete(request); setNoteRequest(null); setMobileStage(stageId); toast.success(`Dipindah ke ${to.name}`); router.refresh(); }
        else if (result.code === "EVIDENCE_REQUIRED") { setNoteRequest(null); setGate({ todoId: todo.id, stage: to.name, minimum: result.minimum ?? 1, current: result.current ?? 0 }); }
        else if (result.code === "NOTE_REQUIRED") { setNoteRequest({ todo, stageId, stageName: to.name }); }
        else { toast.error(result.message); if (result.code === "CONFLICT") { setNoteRequest(null); router.refresh(); } }
      } catch { toast.error("Todo belum berpindah. Coba lagi."); }
      finally { lock.current = false; setPendingId(null); }
    });
  }
  function drop(event: DragEndEvent) {
    setActive(null); if (!event.over || lock.current) return;
    const todo = todos.find(item => item.id === event.active.id);
    const over = event.over;
    const targetId = over.data.current?.type === "Stage" ? String(over.id) : over.data.current?.stageId as string | undefined;
    if (!todo || !targetId) return;
    if (targetId !== todo.currentStageId) { changeStage(todo, targetId); return; }
    if (over.id === todo.id) return;
    const ordered = todos.filter(item => item.currentStageId === targetId).sort((a,b) => a.sortOrder-b.sortOrder);
    const source = ordered.findIndex(item => item.id === todo.id);
    const destination = over.data.current?.type === "Stage" ? ordered.length - 1 : ordered.findIndex(item => item.id === over.id);
    if (destination < 0 || source === destination) return;
    ordered.splice(source,1); ordered.splice(destination,0,todo);
    const before = ordered[destination-1]?.sortOrder ?? 0; const after = ordered[destination+1]?.sortOrder ?? before + 2000;
    const sortOrder = (before + after) / 2;
    lock.current = true; setPendingId(todo.id);
    startTransition(async () => {
      optimistic({ id: todo.id, sortOrder });
      try { const result = await reorderTodo({ todoId: todo.id, stageId: targetId, newSortOrder: sortOrder, expectedVersion: todo.version }); if (!result.ok) toast.error(result.message); router.refresh(); }
      catch { toast.error("Urutan belum tersimpan. Coba lagi."); }
      finally { lock.current = false; setPendingId(null); }
    });
  }
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Cari todo" placeholder="Cari todo" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1" /><div className="flex gap-2"><select aria-label="Filter prioritas" value={priority} onChange={e => setPriority(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-input bg-white px-3 text-sm"><option value="ALL">Semua prioritas</option><option value="LOW">Rendah</option><option value="MEDIUM">Normal</option><option value="HIGH">Tinggi</option><option value="URGENT">Mendesak</option></select><Button variant="outline" size="icon" onClick={() => router.refresh()} disabled={Boolean(pendingId)} aria-label="Muat ulang todo"><RefreshCw size={17} /></Button><Button onClick={() => setCreate(current => ({ open: true, stageId: undefined, session: current.session+1 }))} disabled={Boolean(pendingId)} className="gap-2"><Plus size={17} />Todo</Button></div></div>
    <div aria-label="Pilih tahap" className="flex gap-2 overflow-x-auto pb-1 lg:hidden">{stages.map(stage => <button key={stage.id} type="button" aria-pressed={mobileStage === stage.id} onClick={() => setMobileStage(stage.id)} className={`pressable min-h-11 shrink-0 rounded-full px-4 text-xs font-medium ${mobileStage === stage.id ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}>{stage.name} <span className="ml-1 opacity-80">{grouped.get(stage.id)?.length}</span></button>)}</div>
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={event => setActive(todos.find(todo => todo.id === event.active.id) ?? null)} onDragEnd={drop} onDragCancel={() => setActive(null)}>
      <div className="flex items-start gap-4 overflow-x-auto pb-5">{stages.map(stage => <div key={stage.id} className={`w-full shrink-0 lg:w-auto ${stage.id === mobileStage ? "block" : "hidden lg:block"}`}><KanbanColumn stage={stage} todos={grouped.get(stage.id) ?? []} allStages={stages} today={today} onCardClick={open} onMoveTo={changeStage} pendingId={pendingId} onCreateInStage={stageId => setCreate(current => ({ open: true, stageId, session: current.session+1 }))} /></div>)}</div>
      <DragOverlay dropAnimation={null}>{active && <KanbanCard todo={active} currentStage={stages.find(stage => stage.id === active.currentStageId)!} allStages={stages} today={today} isOverlay />}</DragOverlay>
    </DndContext>
    <CreateTodoDialog onCreated={setMobileStage} key={create.session} stages={stages} defaultStageId={create.stageId} isOpen={create.open} onClose={() => { setCreate(current => ({ ...current, open: false })); if (initialCreate) router.replace("/todos", { scroll: false }); }} />
    <TodoDetailDrawer key={selected ?? "closed"} isOpen={Boolean(selected)} initialData={detail} error={detailError} onReload={refreshDetail} onClose={closeDetail} />
    <EvidenceGateModal isOpen={Boolean(gate)} targetStageName={gate?.stage ?? ""} minimumRequired={gate?.minimum ?? 1} currentCount={gate?.current ?? 0} onClose={() => setGate(null)} onOpenTodoDetail={() => { const todo = todos.find(item => item.id === gate?.todoId); if (todo) open(todo); }} />
    <Modal open={Boolean(noteRequest)} onClose={() => setNoteRequest(null)} title={`Pindah ke ${noteRequest?.stageName ?? "tahap berikutnya"}`} description="Tahap ini memerlukan catatan." busy={Boolean(pendingId)}>
      <form onSubmit={event => { event.preventDefault(); if (noteRequest) changeStage(noteRequest.todo, noteRequest.stageId, note); }} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Catatan</span><textarea required maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={Boolean(pendingId)} rows={3} className="w-full rounded-xl border bg-background p-3" /></label><Button type="submit" disabled={Boolean(pendingId) || !note.trim()}>{pendingId ? "Memindahkan…" : "Pindahkan"}</Button></form>
    </Modal>
  </div>;
}
