"use client";
import Link from "next/link";
import { GitCommitHorizontal, Link2, ImageOff, ExternalLink } from "lucide-react";
import { EvidencePhotoPreview } from "./evidence-photo-preview";
import { Badge } from "@/components/ui/badge";
import type { SafeEvidence } from "../domain/types";

const statusLabel: Record<string, string> = { AVAILABLE: "Siap", BROKEN: "Tidak tersedia", UPLOADING: "Mengunggah", FAILED: "Upload gagal", ORPHANED: "Perlu diperiksa", DELETE_PENDING: "Penghapusan tertunda", DELETED: "Dihapus" };
export function EvidenceCard({ item, actions }: { item: SafeEvidence; actions?: React.ReactNode }) {
  const available = item.status === "AVAILABLE";
  const url = item.url && /^https?:\/\//i.test(item.url) ? item.url : null;
  const title = item.title || (item.type === "PHOTO" ? "Foto aktivitas" : item.type === "GITHUB_COMMIT" ? "Commit GitHub" : "Tautan");
  return <article className="surface-card overflow-hidden">
    <div className="relative flex h-40 items-center justify-center bg-muted/40">
      {item.type === "PHOTO" && available ? <EvidencePhotoPreview id={item.id} title={title} /> : item.type === "GITHUB_COMMIT" ? <div className="space-y-2 px-4 text-center"><GitCommitHorizontal size={28} className="mx-auto text-primary" /><p className="font-mono text-xs">{item.githubCommit?.sha?.slice(0, 7) || "GitHub"}</p><p className="max-w-60 truncate text-xs text-muted-foreground">{item.githubCommit?.repositoryName}</p></div>
        : item.type === "LINK" ? <Link2 size={30} className="text-primary" /> : <div className="px-4 text-center"><ImageOff size={28} className="mx-auto mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground">Pratinjau tidak tersedia</p></div>}
    </div>
    <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-sm font-semibold"><Link href={`/evidence/${item.id}`} className="flex min-h-11 items-center hover:text-primary">{title}</Link></h3><Badge variant={available ? "secondary" : "outline"} className="shrink-0">{statusLabel[item.status] || item.status}</Badge></div>
      {item.note && <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.note}</p>}
      <p className="text-xs text-muted-foreground">{new Date(item.capturedAt || item.createdAt).toLocaleDateString("id-ID")} · {item.assignmentCount ? `${item.assignmentCount} lampiran` : "Belum terpasang"}</p>
      <div className="flex items-center justify-between border-t border-border/60 pt-2">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary">{item.type === "GITHUB_COMMIT" ? "Buka commit" : "Buka tautan"}<ExternalLink size={15} /></a> : <span />}{actions}</div>
    </div>
  </article>;
}

