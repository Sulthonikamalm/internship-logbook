"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLinkEvidence, deleteEvidence } from "../server/mutations";

export function LinkEvidenceForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    setPending(true); setMessage(""); setSuccess(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await createLinkEvidence({ title: String(data.get("title") || ""),
        note: String(data.get("note") || ""), url: String(data.get("url") || "") });
      if (!result.ok) { setMessage(result.message); return; }
      form.reset(); setSuccess(true); router.refresh();
    } catch { setMessage("Respons tidak diterima. Periksa daftar sebelum mencoba lagi."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">Tambah tautan</h2>
    <div><label htmlFor="link-url" className="block text-sm">URL http/https</label>
      <input id="link-url" name="url" type="url" required maxLength={2048}
        className="w-full rounded-md border bg-background px-3 py-2 text-base" /></div>
    <div><label htmlFor="link-title" className="block text-sm">Judul</label>
      <input id="link-title" name="title" maxLength={160}
        className="w-full rounded-md border bg-background px-3 py-2 text-base" /></div>
    <div><label htmlFor="link-note" className="block text-sm">Catatan</label>
      <textarea id="link-note" name="note" maxLength={10000} rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-base" /></div>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    {success && <p role="status" className="text-sm text-primary">Tautan tersimpan.</p>}
    <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
      {pending ? "Menyimpan..." : "Simpan tautan"}</button>
  </form>;
}

export function DeleteEvidenceButton({ id, count }: { id: string; count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(count > 0);
  const [confirming, setConfirming] = useState(false);
  async function remove(detachAll: boolean) {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const result = await deleteEvidence(id, detachAll);
      if (!result.ok) {
        setMessage(result.message);
        if (result.code === "ASSIGNED") { setBlocked(true); setConfirming(true); }
      } else { setMessage("Evidence dihapus."); router.refresh(); }
    } catch { setMessage("Penghapusan belum pasti. Muat ulang daftar sebelum mencoba lagi."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2 border-t pt-2 text-sm">
    {confirming && blocked && <p>{count || "Beberapa"} aktivitas menggunakan evidence ini. Melepas lampiran akan mempertahankan aktivitasnya.</p>}
    {message && <p role="alert" className="text-destructive">{message}</p>}
    {confirming ? <div className="flex gap-3">
      <button type="button" disabled={pending} onClick={() => remove(true)} className="text-destructive underline disabled:opacity-50">
        {pending ? "Menghapus..." : "Lepas dari semua & hapus"}</button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="underline">Batal</button>
    </div> : <button type="button" disabled={pending} onClick={() => blocked ? setConfirming(true) : remove(false)}
      className="text-destructive underline disabled:opacity-50">{pending ? "Menghapus..." : "Hapus evidence"}</button>}
  </div>;
}
