"use client";

import { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TodoPriority, TodoStage } from "../domain/types";
import { createTodo } from "../server/mutations";

export function CreateTodoDialog({
  stages,
  defaultStageId,
  isOpen,
  onClose,
}: {
  stages: TodoStage[];
  defaultStageId?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [stageId, setStageId] = useState(defaultStageId || stages[0]?.id || "");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;

    setPending(true);
    setErrorMessage(null);

    try {
      const res = await createTodo({
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || null,
        stageId: stageId || undefined,
      });

      if (!res.ok) {
        setErrorMessage(res.message);
      } else {
        // Reset and close
        setTitle("");
        setDescription("");
        setPriority("MEDIUM");
        setDueDate("");
        onClose();
      }
    } catch {
      setErrorMessage("Gagal membuat Todo. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <PlusCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">Tambah Todo Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="todo-title" className="text-sm font-medium text-foreground">
              Judul Todo <span className="text-destructive">*</span>
            </label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Riset arsitektur Next.js 15"
              required
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="todo-desc" className="text-sm font-medium text-foreground">
              Deskripsi (Opsional)
            </label>
            <textarea
              id="todo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rincian atau catatan tugas..."
              rows={3}
              maxLength={5000}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="todo-priority" className="text-sm font-medium text-foreground">
                Prioritas
              </label>
              <select
                id="todo-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="todo-stage" className="text-sm font-medium text-foreground">
                Tahap Awal
              </label>
              <select
                id="todo-stage"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="todo-due" className="text-sm font-medium text-foreground">
                Jatuh Tempo
              </label>
              <Input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-destructive">{errorMessage}</p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={!title.trim() || pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Todo"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
