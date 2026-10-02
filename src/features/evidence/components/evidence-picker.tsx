"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import type { SafeEvidence } from "../domain/types";
import { attachEvidence, detachEvidence, getEvidencePickerPage } from "../server/mutations";
import { attachTodoEvidence } from "@/features/todos/server/mutations";
import { CommitPicker } from "@/features/integrations/github/components/commit-picker";
import { PhotoUploader } from "./photo-uploader";

export function EvidencePicker({ activityId, todoId, options, attachedIds, total = 0, onAttached, onBusyChange }: { activityId?: string; todoId?: string; options: SafeEvidence[]; attachedIds: string[]; total?: number; onAttached?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter(); const selectId = useId(); const lock = useRef(false);
  const [selected, setSelected] = useState(""); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [items, setItems] = useState(options); const [previousOptions, setPreviousOptions] = useState(options);
  const [page, setPage] = useState(1); const [loadingMore, setLoadingMore] = useState(false); const [hasMore, setHasMore] = useState(options.length >= 18);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { onBusyChange?.(pending || uploading); }, [pending, uploading, onBusyChange]);
  if (options !== previousOptions) { setPreviousOptions(options); setItems(current => [...options, ...current.filter(item => !options.some(newer => newer.id === item.id))]); }
  async function attach(id: string) {
    if (!id || lock.current) return false; lock.current = true; setPending(true); setMessage("");
    try {
      const result = activityId ? await attachEvidence(activityId, id) : todoId ? await attachTodoEvidence({ todoId, evidenceId: id }) : null;
      if (!result?.ok) { setMessage(result?.message ?? "Lampiran tidak tersedia."); return false; }
      toast.success("Evidence dilampirkan"); setSelected(""); router.refresh(); onAttached?.(); return true;
    } catch { setMessage("Lampiran belum tersimpan. Coba lagi."); return false; } finally { lock.current = false; setPending(false); }
  }
  async function loadMore() {
    if (loadingMore) return; setLoadingMore(true); setMessage("");
    try { const next = await getEvidencePickerPage(page + 1); setItems(current => [...current, ...next.filter(item => !current.some(old => old.id === item.id))]); setPage(current => current+1); setHasMore(next.length >= 18); }
    catch { setMessage("Evidence berikutnya belum dapat dimuat."); } finally { setLoadingMore(false); }
  }
  const available = items.filter(item => item.status === "AVAILABLE" && !attachedIds.includes(item.id));
  return <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label htmlFor={selectId} className="mb-2 block text-sm font-medium">Dari library</label><select id={selectId} value={selected} disabled={pending || uploading} onChange={e => setSelected(e.target.value)} className="w-full rounded-xl border border-input bg-white px-3"><option value="">Pilih evidence</option>{available.map(item => <option key={item.id} value={item.id}>{item.type === "PHOTO" ? "Foto" : item.type === "GITHUB_COMMIT" ? "Commit" : "Tautan"} · {item.title || "Tanpa judul"}</option>)}</select></div><Button disabled={!selected || pending || uploading} onClick={() => attach(selected)}>{pending ? "Melampirkan…" : "Lampirkan"}</Button></div>
    {!available.length && <p className="text-xs text-muted-foreground">Belum ada evidence siap pakai di daftar ini.</p>}
    {(total ? items.length < total : hasMore) && <Button variant="ghost" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Memuat…" : "Muat evidence lainnya"}</Button>}
    {message && <Feedback>{message}</Feedback>}
    <fieldset disabled={pending}><details><summary className="min-h-11 cursor-pointer text-sm text-primary">Upload foto baru</summary><div className="mt-3"><PhotoUploader onUploaded={async id => { if (!await attach(id)) throw new Error("ATTACH_FAILED"); }} onBusyChange={setUploading} compact /></div></details></fieldset>
    <CommitPicker disabled={pending || uploading} activityId={activityId} todoId={todoId} onAttached={onAttached} />
  </div>;
}
export function DetachEvidenceButton({ activityId, evidenceId }: { activityId: string; evidenceId: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const lock = useRef(false);
  async function detach() {
    if (lock.current) return; lock.current = true; setPending(true); setMessage("");
    try { const result = await detachEvidence(activityId, evidenceId); if (!result.ok) setMessage(result.message); else { toast.success("Lampiran dilepas"); router.refresh(); } }
    catch { setMessage("Lampiran belum dapat dilepas."); } finally { lock.current = false; setPending(false); }
  }
  return <div><Button variant="ghost" disabled={pending} onClick={detach} className="text-muted-foreground">{pending ? "Melepas…" : "Lepas lampiran"}</Button>{message && <Feedback>{message}</Feedback>}</div>;
}
