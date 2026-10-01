"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, Search, Filter, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function KanbanBoard({
  initialStages,
  initialTodos,
  today,
}: {
  initialStages: TodoStage[];
  initialTodos: TodoItem[];
  today: string;
}) {
  const router = useRouter();
  const [stages] = useState<TodoStage[]>(initialStages);
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
  const [activeTodo, setActiveTodo] = useState<TodoItem | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Dialogs & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>(undefined);

  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<TodoDetailItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Evidence Gate Rejection Modal
  const [gateModalState, setGateModalState] = useState<{
    isOpen: boolean;
    todoId: string;
    targetStageName: string;
    minimumRequired: number;
    currentCount: number;
  }>({
    isOpen: false,
    todoId: "",
    targetStageName: "",
    minimumRequired: 1,
    currentCount: 0,
  });

  // Transient feedback
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // DnD Sensors: distance constraint prevents accidental drags on click or scroll
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filtered Todos
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [todos, searchQuery, priorityFilter]);

  // Group Todos by stage
  const todosByStage = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const stage of stages) {
      map.set(stage.id, []);
    }
    for (const todo of filteredTodos) {
      const list = map.get(todo.currentStageId);
      if (list) {
        list.push(todo);
      }
    }
    return map;
  }, [stages, filteredTodos]);

  // Handle Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const found = todos.find((t) => t.id === active.id);
    if (found) {
      setActiveTodo(found);
    }
  };

  // Handle Drag End
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTodo(null);

    if (!over) return;

    const activeId = String(active.id);
    const draggedTodo = todos.find((t) => t.id === activeId);
    if (!draggedTodo) return;

    // Determine target stage: over could be a column (stage.id) or another card (card.id)
    let targetStageId: string | null = null;
    const overData = over.data.current;

    if (overData?.type === "Stage") {
      targetStageId = String(over.id);
    } else if (overData?.type === "Todo") {
      targetStageId = overData.stageId || overData.todo?.currentStageId;
    }

    if (!targetStageId) return;

    const fromStage = stages.find((s) => s.id === draggedTodo.currentStageId);
    const toStage = stages.find((s) => s.id === targetStageId);

    if (!fromStage || !toStage) return;

    // 1. Moving between different stages
    if (fromStage.id !== toStage.id) {
      // Validate matrix client-side first
      if (!isTransitionAllowed(fromStage.code, toStage.code)) {
        setNotification({
          type: "error",
          message: `Transisi langsung dari ${fromStage.name} ke ${toStage.name} tidak diizinkan.`,
        });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      // Optimistic UI move
      const originalTodos = [...todos];
      setTodos((prev) =>
        prev.map((t) =>
          t.id === draggedTodo.id
            ? { ...t, currentStageId: toStage.id, version: t.version + 1 }
            : t
        )
      );

      // Perform authoritative server transition
      try {
        const res = await transitionTodo({
          todoId: draggedTodo.id,
          targetStageId: toStage.id,
          expectedVersion: draggedTodo.version,
          idempotencyKey: crypto.randomUUID(),
        });

        if (res.ok) {
          // Reconcile version
          setTodos((prev) =>
            prev.map((t) =>
              t.id === draggedTodo.id
                ? { ...t, version: res.newVersion, currentStageId: res.currentStageId }
                : t
            )
          );
        } else {
          // Rollback on rejection
          setTodos(originalTodos);

          if (res.code === "EVIDENCE_REQUIRED") {
            setGateModalState({
              isOpen: true,
              todoId: draggedTodo.id,
              targetStageName: toStage.name,
              minimumRequired: res.minimum ?? 1,
              currentCount: res.current ?? 0,
            });
          } else if (res.code === "CONFLICT") {
            setNotification({
              type: "error",
              message: "Todo telah diubah di perangkat lain. Memperbarui halaman...",
            });
            router.refresh();
          } else {
            setNotification({ type: "error", message: res.message });
            setTimeout(() => setNotification(null), 4000);
          }
        }
      } catch {
        setTodos(originalTodos);
        setNotification({ type: "error", message: "Gagal memproses transisi ke server." });
        setTimeout(() => setNotification(null), 4000);
      }
    } else {
      // 2. Reordering within the same stage
      const stageTodos = todosByStage.get(fromStage.id) || [];
      const oldIndex = stageTodos.findIndex((t) => t.id === draggedTodo.id);
      const newIndex = stageTodos.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Calculate new sort_order
        let newSortOrder: number;
        if (newIndex === 0) {
          newSortOrder = (stageTodos[0]?.sortOrder ?? 1000) / 2;
        } else if (newIndex === stageTodos.length - 1) {
          newSortOrder = (stageTodos[stageTodos.length - 1]?.sortOrder ?? 1000) + 1000;
        } else {
          const prev = stageTodos[newIndex < oldIndex ? newIndex - 1 : newIndex]?.sortOrder ?? 0;
          const next = stageTodos[newIndex < oldIndex ? newIndex : newIndex + 1]?.sortOrder ?? (prev + 2000);
          newSortOrder = (prev + next) / 2;
        }

        // Optimistic update
        setTodos((prev) =>
          prev.map((t) => (t.id === draggedTodo.id ? { ...t, sortOrder: newSortOrder } : t))
        );

        // Call server reorder
        reorderTodo({
          todoId: draggedTodo.id,
          stageId: fromStage.id,
          newSortOrder,
          expectedVersion: draggedTodo.version,
        }).catch(() => {
          router.refresh();
        });
      }
    }
  };

  // Mobile Fallback: Direct Move To Target Stage
  const handleMobileMoveTo = async (todo: TodoItem, targetStageId: string) => {
    const fromStage = stages.find((s) => s.id === todo.currentStageId);
    const toStage = stages.find((s) => s.id === targetStageId);
    if (!fromStage || !toStage) return;

    if (!isTransitionAllowed(fromStage.code, toStage.code)) {
      setNotification({
        type: "error",
        message: `Transisi langsung dari ${fromStage.name} ke ${toStage.name} tidak diizinkan.`,
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const originalTodos = [...todos];
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, currentStageId: toStage.id, version: t.version + 1 } : t))
    );

    try {
      const res = await transitionTodo({
        todoId: todo.id,
        targetStageId,
        expectedVersion: todo.version,
        idempotencyKey: crypto.randomUUID(),
      });

      if (res.ok) {
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? { ...t, version: res.newVersion, currentStageId: res.currentStageId } : t))
        );
      } else {
        setTodos(originalTodos);
        if (res.code === "EVIDENCE_REQUIRED") {
          setGateModalState({
            isOpen: true,
            todoId: todo.id,
            targetStageName: toStage.name,
            minimumRequired: res.minimum ?? 1,
            currentCount: res.current ?? 0,
          });
        } else {
          setNotification({ type: "error", message: res.message });
          setTimeout(() => setNotification(null), 4000);
        }
      }
    } catch {
      setTodos(originalTodos);
    }
  };

  // Open Drawer and fetch full detail
  const handleCardClick = async (todo: TodoItem) => {
    setSelectedTodoId(todo.id);
    setIsDrawerOpen(true);
    setDetailData(null); // loading

    try {
      const detail = await getTodoDetail(todo.id);
      if (detail) {
        setDetailData(detail);
      }
    } catch (err) {
      console.error("[KanbanBoard] Detail fetch error:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/80 shadow-2xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari kartu Todo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs"
            onClick={() => router.refresh()}
            title="Muat ulang board"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            onClick={() => {
              setCreateStageId(undefined);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Todo</span>
          </Button>
        </div>
      </div>

      {/* Transient Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-md text-xs flex items-center gap-2 ${
            notification.type === "error"
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Kanban DnD Canvas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4 overflow-x-auto pb-6 pt-1">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              todos={todosByStage.get(stage.id) || []}
              allStages={stages}
              today={today}
              onCardClick={handleCardClick}
              onMoveTo={handleMobileMoveTo}
              onCreateInStage={(sId) => {
                setCreateStageId(sId);
                setIsCreateOpen(true);
              }}
            />
          ))}
        </div>

        {/* Drag Overlay during Dragging */}
        <DragOverlay>
          {activeTodo ? (
            <KanbanCard
              todo={activeTodo}
              currentStage={stages.find((s) => s.id === activeTodo.currentStageId)!}
              allStages={stages}
              today={today}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Todo Dialog */}
      <CreateTodoDialog
        stages={stages}
        defaultStageId={createStageId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Todo Detail Drawer */}
      {selectedTodoId && (
        <TodoDetailDrawer
          todoId={selectedTodoId}
          initialData={detailData}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedTodoId(null);
            setDetailData(null);
          }}
        />
      )}

      {/* Evidence Gate Modal */}
      <EvidenceGateModal
        isOpen={gateModalState.isOpen}
        targetStageName={gateModalState.targetStageName}
        minimumRequired={gateModalState.minimumRequired}
        currentCount={gateModalState.currentCount}
        onClose={() => setGateModalState((prev) => ({ ...prev, isOpen: false }))}
        onOpenTodoDetail={() => {
          if (gateModalState.todoId) {
            const found = todos.find((t) => t.id === gateModalState.todoId);
            if (found) handleCardClick(found);
          }
        }}
      />
    </div>
  );
}
