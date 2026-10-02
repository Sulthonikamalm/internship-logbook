"use client";
import { startTransition, useEffect, useId, useMemo, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, closestCorners, pointerWithin, KeyboardSensor, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type CollisionDetection, type Announcements } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, RefreshCw, List, KanbanSquare, History } from "lucide-react";
import Link from "next/link";
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
import { KanbanCardPreview } from "./kanban-card";
import { CreateTodoDialog } from "./create-todo-dialog";
import { TodoDetailDrawer } from "./todo-detail-drawer";
import { EvidenceGateModal } from "./evidence-gate-modal";
import { TodoList } from "./todo-list";
import { celebrateCompletion } from "./celebrate-completion";
import { WORK_CATEGORIES, categoryLabels, parseWorkCategory, type WorkCategory } from "@/features/work/domain/category";
import { localDateAt } from "@/features/activity/domain/date";

const cardCollision: CollisionDetection = args => {
  const hits = pointerWithin(args);
  const cards = hits.filter(hit => args.droppableContainers.find(container => container.id === hit.id)?.data.current?.type === "Todo");
  return cards.length ? cards : hits.length ? hits : closestCorners(args);
};

function StageTarget({ stage, count, selected, onSelect, location = "tabs" }: { stage: TodoStage; count?: number; selected?: boolean; onSelect?: () => void; location?: "tabs" | "tray" }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${location}:${stage.id}`, data: { type: "StageTarget", stageId: stage.id } });
  return <button ref={setNodeRef} type="button" aria-pressed={selected} onClick={onSelect} data-over={isOver}
    className={`pressable min-h-12 min-w-0 rounded-xl border px-2 text-xs font-medium transition-colors ${isOver ? "border-primary bg-primary text-white shadow-md" : selected ? "border-primary bg-primary text-white" : "border-border/70 bg-white text-muted-foreground"}`}>
    <span className="block truncate">{stage.name}</span>{count !== undefined && <span className="text-[10px] opacity-75">{count}</span>}
  </button>;
}

export function KanbanBoard({ initialStages: stages, initialTodos, today, timeZone, initialCreate = false, initialTodoId = null, initialCategory = "ALL" }: { initialStages: TodoStage[]; initialTodos: TodoItem[]; today: string; timeZone: string; initialCreate?: boolean; initialTodoId?: string | null; initialCategory?: WorkCategory | "ALL" }) {
  const router = useRouter();
  const dndId = useId();
  const [todos, optimistic] = useOptimistic(initialTodos, (current, change: { id: string; stageId?: string; sortOrder?: number }) => current.map(todo => todo.id === change.id ? { ...todo, currentStageId: change.stageId ?? todo.currentStageId, sortOrder: change.sortOrder ?? todo.sortOrder } : todo));
  const [active, setActive] = useState<TodoItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null); const lock = useRef(false);
  const [query, setQuery] = useState(""); const [priority, setPriority] = useState("ALL");
  const [category, setCategory] = useState<WorkCategory | "ALL">(initialCategory);
  const [view, setView] = useState<"board" | "list">("board");
  const boardRef = useRef<HTMLDivElement>(null);
  const [mobileStage, setMobileStage] = useState(stages[0]?.id);
  const lastDate = useRef(today);
  useEffect(() => {
    lastDate.current = today;
    const refreshAtNewDay = () => {
      const current = localDateAt(new Date(), timeZone);
      if (current !== lastDate.current) { lastDate.current = current; router.refresh(); }
    };
    const timer = window.setInterval(refreshAtNewDay, 30_000);
    document.addEventListener("visibilitychange", refreshAtNewDay);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshAtNewDay); };
  }, [today, timeZone, router]);
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
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 12 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const grouped = useMemo(() => {
    const map = new Map(stages.map(stage => [stage.id, [] as TodoItem[]]));
    for (const todo of [...todos].sort((a,b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))) {
      if (category !== "ALL" && parseWorkCategory(todo.workCategory) !== category) continue;
      if (priority !== "ALL" && todo.priority !== priority) continue;
      if (query.trim() && !`${todo.title} ${todo.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())) continue;
      map.get(todo.currentStageId)?.push(todo);
    }
    return map;
  }, [stages, todos, priority, query, category]);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${todos.find(todo => todo.id === active.id)?.title ?? "Tugas"} dipilih. Gunakan panah untuk memindahkan.`,
    onDragOver: ({ over }) => {
      if (!over) return "Di luar area tugas.";
      const stageId = over.data.current?.type === "Stage" ? over.id : over.data.current?.stageId;
      return `Tujuan ${stages.find(stage => stage.id === stageId)?.name ?? "tugas"}.`;
    },
    onDragEnd: () => "Kartu dilepas. Status tersimpan setelah konfirmasi berhasil.",
    onDragCancel: () => "Perpindahan dibatalkan.",
  };
  function open(todo: TodoItem) { setDetail(null); setDetailError(""); setSelected(todo.id); setDetailRevision(value => value + 1); }
  function refreshDetail() { setDetailRevision(value => value + 1); router.refresh(); }
  function closeDetail() { setSelected(null); setDetail(null); if (initialTodoId) router.replace(`/todos?category=${category}`, { scroll: false }); }
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
        if (result.ok) { requests.current.delete(request); setNoteRequest(null); setMobileStage(stageId); toast.success(result.activityId ? "Selesai · Activity dan bukti tercatat" : `Dipindah ke ${to.name}`); if (to.code === "DONE" && !result.replayed) celebrateCompletion(boardRef.current, todo.id); router.refresh(); }
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
    const destination = over.data.current?.type !== "Todo" ? ordered.length - 1 : ordered.findIndex(item => item.id === over.id);
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
  return <div ref={boardRef} className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="min-w-0 flex-1 sm:max-w-xs"><span className="sr-only">Kategori tugas</span><select className="w-full" value={category} onChange={event => setCategory(event.target.value as WorkCategory | "ALL")}><option value="ALL">Semua kegiatan</option>{WORK_CATEGORIES.map(item => <option key={item} value={item}>{categoryLabels[item]}</option>)}</select></label><div className="flex gap-1 rounded-xl bg-muted p-1" aria-label="Tampilan tugas"><Button size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")} className="gap-2"><KanbanSquare size={16} />Kanban</Button><Button size="sm" variant={view === "list" ? "secondary" : "ghost"} aria-pressed={view === "list"} onClick={() => setView("list")} className="gap-2"><List size={16} />List</Button></div></div>
    <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Cari todo" placeholder="Cari todo" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1" /><div className="flex min-w-0 gap-2"><select aria-label="Filter prioritas" value={priority} onChange={event => setPriority(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-input bg-white px-3 text-sm"><option value="ALL">Semua prioritas</option><option value="LOW">Rendah</option><option value="MEDIUM">Normal</option><option value="HIGH">Tinggi</option><option value="URGENT">Mendesak</option></select><Button variant="outline" size="icon" onClick={() => router.refresh()} disabled={Boolean(pendingId)} aria-label="Muat ulang todo"><RefreshCw size={17} /></Button><Button onClick={() => setCreate(current => ({ open: true, stageId: undefined, session: current.session+1 }))} disabled={Boolean(pendingId)} className="gap-2"><Plus size={17} />Todo</Button></div></div>
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Selesai hari ini · tugas aktif berlanjut besok</span><Link href="/calendar" className="inline-flex min-h-11 shrink-0 items-center gap-1 font-medium text-primary hover:underline"><History size={15} />Riwayat</Link></div>
    {view === "list" ? <TodoList todos={Array.from(grouped.values()).flat()} stages={stages} pending={Boolean(pendingId)} onOpen={open} onMove={changeStage} /> : <DndContext id={dndId} accessibility={{ announcements, screenReaderInstructions: { draggable: "Tekan spasi untuk memilih tugas. Gunakan tombol panah untuk memindahkan, spasi untuk melepas, atau Escape untuk membatalkan." } }} sensors={sensors} collisionDetection={cardCollision} onDragStart={event => setActive(todos.find(todo => todo.id === event.active.id) ?? null)} onDragEnd={drop} onDragCancel={() => setActive(null)}>
      <div aria-label="Pilih atau lepas di tahap" className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:hidden">{stages.map(stage => <StageTarget key={stage.id} stage={stage} count={grouped.get(stage.id)?.length ?? 0} selected={mobileStage === stage.id} onSelect={() => setMobileStage(stage.id)} />)}</div>
      <div className="grid grid-cols-1 items-start gap-3 pb-3 xl:grid-cols-5">{stages.map(stage => <div key={stage.id} className={`min-w-0 w-full ${stage.id === mobileStage ? "block" : "hidden xl:block"}`}><KanbanColumn stage={stage} todos={grouped.get(stage.id) ?? []} allStages={stages} today={today} onCardClick={open} onMoveTo={changeStage} pendingId={pendingId} onCreateInStage={stageId => setCreate(current => ({ open: true, stageId, session: current.session+1 }))} /></div>)}</div>
      {active && <div className="fixed inset-x-3 z-50 rounded-2xl border border-primary/15 bg-white/95 p-2 shadow-xl backdrop-blur-xl xl:hidden" style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}><p className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">Lepas kartu di tahap tujuan</p><div className="grid grid-cols-3 gap-1.5">{stages.filter(stage => isTransitionAllowed(stages.find(item => item.id === active.currentStageId)?.code ?? "", stage.code)).map(stage => <StageTarget key={stage.id} stage={stage} location="tray" />)}</div></div>}
      <DragOverlay dropAnimation={null} style={{ zIndex: 60 }}>{active && <KanbanCardPreview todo={active} currentStage={stages.find(stage => stage.id === active.currentStageId)!} allStages={stages} today={today} />}</DragOverlay>
    </DndContext>}
    <CreateTodoDialog initialCategory={category === "ALL" ? "INTERNSHIP" : category} onCreated={(stageId, createdCategory) => { setMobileStage(stageId); setCategory(createdCategory); }} key={create.session} stages={stages} defaultStageId={create.stageId} isOpen={create.open} onClose={() => { setCreate(current => ({ ...current, open: false })); if (initialCreate) router.replace(`/todos?category=${category}`, { scroll: false }); }} />
    <TodoDetailDrawer key={selected ?? "closed"} isOpen={Boolean(selected)} initialData={detail} error={detailError} onReload={refreshDetail} onClose={closeDetail} />
    <EvidenceGateModal isOpen={Boolean(gate)} targetStageName={gate?.stage ?? ""} minimumRequired={gate?.minimum ?? 1} currentCount={gate?.current ?? 0} onClose={() => setGate(null)} onOpenTodoDetail={() => { const todo = todos.find(item => item.id === gate?.todoId); if (todo) open(todo); }} />
    <Modal open={Boolean(noteRequest)} onClose={() => setNoteRequest(null)} title={`Pindah ke ${noteRequest?.stageName ?? "tahap berikutnya"}`} description="Tahap ini memerlukan catatan." busy={Boolean(pendingId)}>
      <form onSubmit={event => { event.preventDefault(); if (noteRequest) changeStage(noteRequest.todo, noteRequest.stageId, note); }} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Catatan</span><textarea required maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={Boolean(pendingId)} rows={3} className="w-full rounded-xl border bg-background p-3" /></label><Button type="submit" disabled={Boolean(pendingId) || !note.trim()}>{pendingId ? "Memindahkan…" : "Pindahkan"}</Button></form>
    </Modal>
  </div>;
}
