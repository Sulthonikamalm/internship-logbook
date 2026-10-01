"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeEvidence } from "../domain/types";
import { attachEvidence, detachEvidence, getEvidencePickerPage } from "../server/mutations";
import { PhotoUploader } from "./photo-uploader";

export function EvidencePicker({ activityId, options, attachedIds, total = 0 }: {
  activityId: string; options: SafeEvidence[]; attachedIds: string[]; total?: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [items, setItems] = useState(options);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  async function attach(id: string) {
    if (!id || pending) return;
    setPending(true); setMessage(""); setSuccess("");
    try {
      const result = await attachEvidence(activityId, id);
      if (!result.ok) setMessage(result.message);
      else { setSuccess("Evidence dilampirkan."); setSelected(""); router.refresh(); }
    } catch { setMessage("Lampiran belum tersimpan. Coba lagi."); }
    finally { setPending(false); }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true); setMessage("");
    try {
      const next = await getEvidencePickerPage(page + 1);
      setItems((current) => [...current, ...next.filter((item) => !current.some((old) => old.id === item.id))]);
      setPage(page + 1);
    } catch { setMessage("Evidence berikutnya gagal dimuat."); }
    finally { setLoadingMore(false); }
  }

  const available = items.filter((item) => item.status === "AVAILABLE" && !attachedIds.includes(item.id));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><label htmlFor="evidence-select" className="block text-sm">Pilih dari Evidence Library</label>
        <select id="evidence-select" value={selected} onChange={(event) => setSelected(event.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-base">
          <option value="">Pilih evidence</option>
          {available.map((item) => <option key={item.id} value={item.id}>
            [{item.type === "PHOTO" ? "FOTO" : item.type === "GITHUB_COMMIT" ? "COMMIT" : "TAUTAN"}] {item.title || (item.type === "PHOTO" ? "Foto" : item.type === "GITHUB_COMMIT" ? "Commit GitHub" : "Tautan")} · {new Date(item.createdAt).toLocaleDateString("id-ID")}
          </option>)}
        </select></div>
      <button type="button" disabled={!selected || pending} onClick={() => attach(selected)}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {pending ? "Menambahkan..." : "Lampirkan"}</button>
    </div>
    {available.length === 0 && <p className="text-sm text-muted-foreground">Belum ada evidence siap pakai pada daftar terbaru.</p>}
    {items.length < total && <button type="button" disabled={loadingMore} onClick={loadMore}
      className="text-sm text-primary underline disabled:opacity-50">{loadingMore ? "Memuat..." : "Muat evidence lainnya"}</button>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    {success && <p role="status" className="text-sm text-primary">{success}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
      <details><summary className="cursor-pointer text-sm text-primary">Unggah foto baru</summary>
        <div className="mt-3"><PhotoUploader onUploaded={attach} compact /></div>
      </details>
      <a href="/integrations" className="text-xs text-muted-foreground hover:text-primary underline">
        + Lampirkan Commit dari GitHub
      </a>
    </div>
  </div>;
}

export function DetachEvidenceButton({ activityId, evidenceId }: { activityId: string; evidenceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function detach() {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const result = await detachEvidence(activityId, evidenceId);
      if (!result.ok) setMessage(result.message);
      else router.refresh();
    } catch { setMessage("Lampiran gagal dilepas. Coba lagi."); }
    finally { setPending(false); }
  }
  return <div className="space-y-1"><button type="button" disabled={pending} onClick={detach}
    className="text-sm text-destructive underline disabled:opacity-50">{pending ? "Melepas..." : "Lepas lampiran"}</button>
    {message && <p role="alert" className="text-xs text-destructive">{message}</p>}</div>;
}
