"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPhotoOnlyActivity } from "../server/mutations";
import { PhotoUploader } from "./photo-uploader";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { toast } from "sonner";
import { CategoryField } from "@/features/work/components/category-field";
import type { WorkCategory } from "@/features/work/domain/category";

export function QuickPhotoActivity({ onBusyChange, initialCategory = "INTERNSHIP" }: { onBusyChange?: (busy: boolean) => void; initialCategory?: WorkCategory }) {
  const router = useRouter();
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const key = useRef(crypto.randomUUID());
  const lock = useRef(false);
  async function save() {
    if (!evidenceId || lock.current || uploading) return;
    lock.current = true; onBusyChange?.(true);
    setPending(true); setMessage("");
    try {
      const result = await createPhotoOnlyActivity(evidenceId, key.current, category);
      if (!result.ok) { setMessage(result.message); return; }
      toast.success("Draft Activity tersimpan");
      router.push(`/activities/${result.id}`); router.refresh();
    } catch { setMessage("Respons tidak diterima. Coba lagi; foto tetap di Evidence Library."); }
    finally { lock.current = false; setPending(false); onBusyChange?.(false); }
  }
  return <section className="space-y-3">
    <CategoryField value={category} disabled={pending || uploading} onChange={value => { setCategory(value); key.current = crypto.randomUUID(); }} />
    <PhotoUploader compact onBusyChange={value => { setUploading(value); onBusyChange?.(value); }} onUploaded={(id) => { if (evidenceId !== id) key.current = crypto.randomUUID(); setEvidenceId(id); setMessage(""); }} />
    {evidenceId && <Button type="button" disabled={pending || uploading} onClick={save}>
      {pending ? "Menyimpan…" : "Simpan Activity"}</Button>}
    {message && <Feedback>{message}</Feedback>}
    <p className="text-xs text-muted-foreground">Foto menjadi draft. Lengkapi judulnya nanti.</p>
  </section>;
}
