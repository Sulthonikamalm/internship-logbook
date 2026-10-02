"use client";
import { useState } from "react";
import { Paperclip, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EvidencePhotoPreview } from "@/features/evidence/components/evidence-photo-preview";
import type { LogbookEvidenceItem } from "../domain/types";
export function EvidenceSummaryBadges({ evidences, totalEvidenceCount, brokenCount }: { evidences: LogbookEvidenceItem[]; photoCount: number; linkCount: number; brokenCount: number; totalEvidenceCount: number }) {
  const [open, setOpen] = useState(false);
  if (!totalEvidenceCount) return <span className="text-xs text-muted-foreground">—</span>;
  return <><Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="gap-2 text-primary"><Paperclip size={15} />{totalEvidenceCount} bukti{brokenCount > 0 && <AlertTriangle size={15} className="text-warning" />}</Button><Modal open={open} onClose={() => setOpen(false)} title="Bukti kerja" className="sm:max-w-2xl">
    <div className="grid gap-4 sm:grid-cols-2">{evidences.map(item => <div key={item.id} className="overflow-hidden rounded-xl border">{item.type === "PHOTO" && item.status === "AVAILABLE" && <div className="relative h-40 bg-muted/40"><EvidencePhotoPreview id={item.id} title={item.title ?? undefined} /></div>}<div className="space-y-2 p-3"><p className="break-words text-sm font-medium">{item.title || (item.type === "GITHUB_COMMIT" ? "Commit GitHub" : item.type === "PHOTO" ? "Foto" : "Tautan")}</p>{item.status !== "AVAILABLE" && <Badge variant="warning">Tidak tersedia</Badge>}{item.url && /^https?:\/\//i.test(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary">{item.type === "GITHUB_COMMIT" ? "Buka commit" : "Buka tautan"} →</a>}</div></div>)}</div>
  </Modal></>;
}
