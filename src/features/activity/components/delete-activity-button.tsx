"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import { softDeleteActivity } from "../server/soft-delete-activity";
export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter(); const lock = useRef(false); const [pending, setPending] = useState(false); const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  async function remove() {
    if (lock.current) return; lock.current = true; setPending(true); setMessage("");
    try { const result = await softDeleteActivity(id); if (!result.ok) { setMessage(result.message); return; } toast.success("Activity dihapus"); setOpen(false); router.push("/activities"); router.refresh(); }
    catch { setMessage("Respons belum diterima. Periksa daftar sebelum mencoba lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <><Button variant="ghost" onClick={() => { setMessage(""); setOpen(true); }} className="text-destructive">Hapus</Button><Modal open={open} onClose={() => setOpen(false)} busy={pending} title="Hapus Activity?" description="Evidence tetap tersimpan di Library.">{message && <div className="mb-4"><Feedback>{message}</Feedback></div>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button variant="destructive" disabled={pending} onClick={remove}>{pending ? "Menghapus…" : "Hapus Activity"}</Button></div></Modal></>;
}
