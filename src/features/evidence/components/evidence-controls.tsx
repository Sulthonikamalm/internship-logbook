"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import { createLinkEvidence, deleteEvidence } from "../server/mutations";

export function LinkEvidenceForm({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter(); const id = useId(); const lock = useRef(false);
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setPending(true); onBusyChange?.(true); setMessage(""); setSuccess(false);
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const result = await createLinkEvidence({ title: String(data.get("title") || ""), note: String(data.get("note") || ""), url: String(data.get("url") || "") });
      if (!result.ok) { setMessage(result.message); return; }
      form.reset(); setSuccess(true); toast.success("Tautan tersimpan"); router.refresh();
    } catch { setMessage("Respons belum diterima. Periksa Library sebelum mencoba lagi."); }
    finally { lock.current = false; setPending(false); onBusyChange?.(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <div><label htmlFor={`${id}-url`} className="mb-1.5 block text-sm font-medium">Tautan</label><Input id={`${id}-url`} name="url" type="url" required maxLength={2048} placeholder="https://…" /></div>
      <div><label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-medium">Judul (opsional)</label><Input id={`${id}-title`} name="title" maxLength={160} /></div>
      <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">Tambahkan catatan</summary><label htmlFor={`${id}-note`} className="sr-only">Catatan</label><textarea id={`${id}-note`} name="note" maxLength={10000} rows={3} className="w-full rounded-lg border bg-background p-3" /></details>
    </fieldset>
    {message && <Feedback>{message}</Feedback>}{success && <Feedback tone="success">Tautan siap digunakan.</Feedback>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Menyimpan…" : "Simpan tautan"}</Button>
  </form>;
}

export function DeleteEvidenceButton({ id, count }: { id: string; count: number }) {
  const router = useRouter(); const lock = useRef(false);
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [blockedCount, setBlockedCount] = useState(count); const [open, setOpen] = useState(false);
  async function remove() {
    if (lock.current) return; lock.current = true; setPending(true); setMessage("");
    try {
      const result = await deleteEvidence(id, blockedCount > 0);
      if (!result.ok) {
        setMessage(result.message);
        if (result.code === "ASSIGNED") setBlockedCount(result.count ?? 1);
        if (result.code === "DELETE_PENDING") router.refresh();
      } else { toast.success("Evidence dihapus"); setOpen(false); router.refresh(); }
    } catch { setMessage("Penghapusan belum pasti. Muat ulang sebelum mencoba lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <><Button variant="ghost" size="sm" onClick={() => { setMessage(""); setBlockedCount(count); setOpen(true); }} className="text-destructive">Hapus</Button>
    <Modal open={open} onClose={() => setOpen(false)} busy={pending} title="Hapus evidence?" description={blockedCount > 0 ? `Terpasang pada ${blockedCount} Activity/Todo. Lampiran dilepas; catatan kerja tetap ada.` : "Evidence akan dihapus dari Library."}>
      {blockedCount > 0 && <p className="mb-4 text-sm text-muted-foreground">Todo yang memerlukan bukti dapat ditandai belum lengkap.</p>}
      {message && <div className="mb-4"><Feedback>{message}</Feedback></div>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button variant="destructive" disabled={pending} onClick={remove}>{pending ? "Menghapus…" : blockedCount > 0 ? "Lepas & hapus" : "Hapus"}</Button></div>
    </Modal></>;
}
