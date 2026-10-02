"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import type { TodoPriority, TodoStage } from "../domain/types";
import { createTodo } from "../server/mutations";
export function CreateTodoDialog({ stages, defaultStageId, isOpen, onClose, onCreated }: { stages: TodoStage[]; defaultStageId?: string; isOpen: boolean; onClose: () => void; onCreated?: (stageId: string) => void }) {
  const router = useRouter();
  const allowed = stages.filter(stage => ["BACKLOG", "TODO"].includes(stage.code));
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [priority, setPriority] = useState<TodoPriority>("MEDIUM"); const [due, setDue] = useState("");
  const [stageId, setStageId] = useState(allowed.find(stage => stage.id === defaultStageId)?.id ?? allowed[0]?.id ?? "");
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setError("");
    try { const result = await createTodo({ title, description, priority, dueDate: due || null, stageId }); if (!result.ok) setError(result.message); else { toast.success("Todo dibuat"); onCreated?.(stageId); onClose(); router.refresh(); } }
    catch { setError("Todo belum tersimpan. Coba lagi."); } finally { lock.current = false; setPending(false); }
  }
  return <Modal open={isOpen} onClose={onClose} title="Todo baru" busy={pending}><form onSubmit={submit} className="space-y-5"><fieldset disabled={pending} className="space-y-5"><label className="block space-y-2 text-sm font-medium"><span>Apa yang perlu dikerjakan?</span><Input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} placeholder="Misalnya, susun laporan mingguan" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Tahap awal</span><select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full rounded-xl border border-input bg-white px-3">{allowed.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Tenggat</span><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></label></div><details><summary className="min-h-11 cursor-pointer text-sm text-primary">Detail tambahan</summary><div className="mt-3 space-y-4"><label className="block space-y-2 text-sm"><span>Deskripsi</span><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={3} className="w-full rounded-xl border border-input px-3 py-2" /></label><label className="block space-y-2 text-sm"><span>Prioritas</span><select value={priority} onChange={e => setPriority(e.target.value as TodoPriority)} className="w-full rounded-xl border border-input bg-white px-3"><option value="LOW">Rendah</option><option value="MEDIUM">Normal</option><option value="HIGH">Tinggi</option><option value="URGENT">Mendesak</option></select></label></div></details></fieldset>{error && <Feedback>{error}</Feedback>}<div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" disabled={pending} onClick={onClose}>Batal</Button><Button disabled={pending || !title.trim()}>{pending ? "Menyimpan…" : "Buat todo"}</Button></div></form></Modal>;
}
