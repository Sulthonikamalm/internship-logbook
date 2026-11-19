"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { updateEvidenceCaptureTime } from "../server/mutations";

export function CaptureTimeForm({ id, initialValue, timezone }: { id: string; initialValue: string; timezone: string }) {
  const [value, setValue] = useState(initialValue); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage(""); setSaved(false);
    try { const result = await updateEvidenceCaptureTime(id, value); setSaved(result.ok); setMessage(result.ok ? "Waktu pengambilan tersimpan." : result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Waktu pengambilan belum tersimpan. Coba lagi."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="surface space-y-3 p-4">
    <label htmlFor="evidence-captured-at" className="block text-sm font-medium">Waktu pengambilan · {timezone}</label>
    <input id="evidence-captured-at" required type="datetime-local" value={value} disabled={busy} onChange={event => setValue(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base" />
    <p className="text-xs text-muted-foreground">Tanggal kegiatan dibedakan dari tanggal unggah. Koreksi jika metadata foto tidak tersedia atau tidak tepat.</p>
    <Button disabled={busy} type="submit">{busy ? "Menyimpan…" : "Simpan waktu pengambilan"}</Button>
    {message && <Feedback tone={saved ? "success" : "error"}>{message}</Feedback>}
  </form>;
}
