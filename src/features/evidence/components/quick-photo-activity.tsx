"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPhotoOnlyActivity } from "../server/mutations";
import { PhotoUploader } from "./photo-uploader";

export function QuickPhotoActivity() {
  const router = useRouter();
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef(crypto.randomUUID());
  async function save() {
    if (!evidenceId || pending) return;
    setPending(true); setMessage("");
    try {
      const result = await createPhotoOnlyActivity(evidenceId, key.current);
      if (!result.ok) { setMessage(result.message); return; }
      router.push(`/activities/${result.id}`); router.refresh();
    } catch { setMessage("Respons tidak diterima. Coba lagi; foto tetap di Evidence Library."); }
    finally { setPending(false); }
  }
  return <section className="space-y-3">
    <PhotoUploader compact onUploaded={(id) => { setEvidenceId(id); setMessage(""); }} />
    {evidenceId && <button type="button" disabled={pending} onClick={save}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
      {pending ? "Menyimpan aktivitas..." : "Simpan aktivitas dari foto"}</button>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <p className="text-xs text-muted-foreground">Foto saja membuat draf “Aktivitas tanpa judul” yang dapat Anda lengkapi nanti.</p>
  </section>;
}
