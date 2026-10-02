"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import type { TodoDetailItem, TodoPriority } from "../domain/types";
import type { SafeEvidence } from "@/features/evidence/domain/types";
import { EvidencePicker } from "@/features/evidence/components/evidence-picker";
import { getEvidencePickerPage } from "@/features/evidence/server/mutations";
import { updateTodo, deleteTodo, detachTodoEvidence } from "../server/mutations";

export function TodoDetailDrawer({ isOpen, onClose, initialData: data, error = "", onReload }: { todoId?: string; isOpen: boolean; onClose: () => void; initialData?: TodoDetailItem | null; error?: string; onReload: () => void }) {
  const [editing, setEditing] = useState(false); const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const lock = useRef(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [priority, setPriority] = useState<TodoPriority>("MEDIUM"); const [due, setDue] = useState(""); const [editVersion, setEditVersion] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false); const [options, setOptions] = useState<SafeEvidence[] | null>(null); const [pickerError, setPickerError] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  useEffect(() => {
    if (!pickerOpen) return;
    let valid = true;
    getEvidencePickerPage(1).then(result => { if (valid) setOptions(result); }).catch(() => { if (valid) setPickerError("Library belum dapat dimuat."); });
    return () => { valid = false; };
  }, [pickerOpen]);
  function edit() { if (!data) return; setTitle(data.title); setDescription(data.description ?? ""); setPriority(data.priority); setDue(data.dueDate ?? ""); setEditVersion(data.version); setMessage(""); setEditing(true); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!data || lock.current) return; lock.current = true; setPending(true); setMessage("");
    try { const result = await updateTodo({ id: data.id, title, description, priority, dueDate: due || null, expectedVersion: editVersion }); if (!result.ok) setMessage(result.message); else { toast.success("Todo disimpan"); setEditing(false); onReload(); } }
    catch { setMessage("Todo belum tersimpan. Coba lagi."); } finally { lock.current = false; setPending(false); }
  }
  async function remove() {
    if (!data || lock.current) return; lock.current = true; setPending(true); setMessage("");
    try { const result = await deleteTodo(data.id); if (!result.ok) setMessage(result.message); else { toast.success("Todo dihapus"); setRemoveOpen(false); onClose(); } }
    catch { setMessage("Todo belum dihapus. Coba lagi."); } finally { lock.current = false; setPending(false); }
  }
  async function detach(id: string) {
    if (lock.current) return; lock.current = true; setPending(true); setMessage("");
    try { const result = await detachTodoEvidence(id); if (!result.ok) setMessage(result.message); else { toast.success("Lampiran dilepas"); onReload(); } }
    catch { setMessage("Lampiran belum dapat dilepas."); } finally { lock.current = false; setPending(false); }
  }
  return <>
    <Modal open={isOpen} onClose={onClose} title="Detail todo" side="right" busy={pending || pickerBusy}>
      {error ? <div className="space-y-4"><Feedback>{error}</Feedback><Button onClick={onReload}>Coba lagi</Button></div> : !data ? <div role="status" aria-label="Memuat todo" className="space-y-5"><div className="skeleton h-8 w-3/4 rounded-xl" /><div className="skeleton h-28 rounded-2xl" /></div> : <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="info">{data.stage.name}</Badge><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={edit} aria-label="Edit todo" disabled={pending || pickerBusy}><Pencil size={18} /></Button><Button variant="ghost" size="icon" onClick={() => setRemoveOpen(true)} aria-label="Hapus todo" disabled={pending || pickerBusy}><Trash2 size={18} /></Button></div></div>
        {data.evidenceHealth === "EVIDENCE_INCOMPLETE" && <Feedback tone="warning">Evidence perlu dilengkapi. Tahap todo tetap tersimpan.</Feedback>}
        {editing ? <form onSubmit={save} className="space-y-4"><fieldset disabled={pending} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Judul</span><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><label className="block space-y-2 text-sm font-medium"><span>Deskripsi</span><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={3} className="w-full rounded-xl border border-input px-3 py-2" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2 text-sm"><span>Prioritas</span><select value={priority} onChange={e => setPriority(e.target.value as TodoPriority)} className="w-full rounded-xl border border-input px-3"><option value="LOW">Rendah</option><option value="MEDIUM">Normal</option><option value="HIGH">Tinggi</option><option value="URGENT">Mendesak</option></select></label><label className="block space-y-2 text-sm"><span>Tenggat</span><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></label></div></fieldset><div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>Batal</Button><Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button></div></form> : <div><h2 className="break-words text-xl font-semibold leading-snug">{data.title}</h2>{data.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{data.description}</p>}<p className="mt-4 text-xs text-muted-foreground">{data.dueDate ? `Tenggat ${data.dueDate}` : "Tanpa tenggat"} · {data.priority === "HIGH" || data.priority === "URGENT" ? "Prioritas tinggi" : "Prioritas normal"}</p></div>}
        {message && <Feedback>{message}<button type="button" onClick={onReload} className="ml-2 underline">Muat ulang data</button></Feedback>}
        <Button asChild variant="outline" className="w-full gap-2"><Link aria-disabled={pickerBusy || pending} tabIndex={pickerBusy || pending ? -1 : undefined} onClick={event => { if (pickerBusy || pending) event.preventDefault(); }} href={`/activities/new?todoId=${data.id}&title=${encodeURIComponent(data.title)}&description=${encodeURIComponent(data.description ?? "")}`}><Plus size={17} />Catat sebagai Activity</Link></Button>
        <section className="space-y-3 border-t border-border pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Evidence · {data.evidences.length}</h3><Button variant="ghost" size="sm" onClick={() => { setOptions(null); setPickerError(""); setPickerOpen(current => !current); }} disabled={pending || pickerBusy}>Lampirkan</Button></div>
          {pickerOpen && <div className="rounded-2xl bg-muted/40 p-4">{pickerError ? <Feedback>{pickerError}</Feedback> : options ? <EvidencePicker todoId={data.id} options={options} attachedIds={data.evidences.map(e => e.evidenceId)} onAttached={onReload} onBusyChange={setPickerBusy} /> : <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Memuat library…</p>}</div>}
          {data.evidences.map(evidence => <div key={evidence.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3"><Paperclip size={17} className="shrink-0 text-primary" /><div className="min-w-0 flex-1"><a href={evidence.type === "PHOTO" ? `/api/media/evidence/${evidence.evidenceId}` : evidence.url && /^https?:\/\//i.test(evidence.url) ? evidence.url : "/evidence"} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium">{evidence.title || "Evidence"}</a><p className={`mt-1 text-xs ${evidence.status === "AVAILABLE" ? "text-muted-foreground" : "text-warning"}`}>{evidence.status === "AVAILABLE" ? "Siap" : "Tidak tersedia"}</p></div><Button variant="ghost" size="icon" aria-label={`Lepas ${evidence.title || "evidence"}`} disabled={pending} onClick={() => detach(evidence.id)}><Trash2 size={16} /></Button></div>)}{!data.evidences.length && <p className="text-xs text-muted-foreground">Belum ada evidence.</p>}
        </section>
        <section className="border-t border-border pt-5"><h3 className="mb-3 text-sm font-semibold">Activity terkait</h3>{data.activities.map(activity => <Link href={`/activities/${activity.id}`} key={activity.id} className="flex min-h-11 items-center justify-between gap-3 text-sm"><span className="truncate">{activity.title}</span><span className="shrink-0 text-xs text-muted-foreground">{activity.activityDate}</span></Link>)}{!data.activities.length && <p className="text-xs text-muted-foreground">Belum ada Activity.</p>}</section>
        <details className="border-t border-border pt-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Riwayat tahap · {data.transitions.length}</summary><ol className="mt-2 space-y-3">{data.transitions.map(item => <li key={item.id} className="text-xs text-muted-foreground"><p className="font-medium text-foreground">{item.fromStageName || "Awal"} → {item.toStageName || "Tahap"}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("id-ID")}</time>{item.note && <p className="mt-1 break-words">{item.note}</p>}</li>)}</ol></details>
      </div>}
    </Modal>
    <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Hapus todo?" description="Activity dan evidence yang terkait tetap tersimpan." busy={pending}><div className="space-y-4">{message && <Feedback>{message}</Feedback>}<div className="flex justify-end gap-2"><Button variant="ghost" disabled={pending} onClick={() => setRemoveOpen(false)}>Batal</Button><Button variant="destructive" disabled={pending} onClick={remove}>{pending ? "Menghapus…" : "Hapus todo"}</Button></div></div></Modal>
  </>;
}
