import Image from "next/image";
import { GitCommit, ExternalLink } from "lucide-react";
import type { SafeEvidence } from "../domain/types";

export function EvidenceCard({ item, actions }: { item: SafeEvidence; actions?: React.ReactNode }) {
  const available = item.status === "AVAILABLE";
  return <article className="overflow-hidden rounded-lg border bg-card">
    <div className="relative flex h-44 items-center justify-center bg-muted/40 p-4">
      {item.type === "PHOTO" && available ? (
        <a href={`/api/media/evidence/${item.id}`} target="_blank" rel="noopener noreferrer"
            aria-label="Buka foto ukuran penuh" className="block h-full w-full">
            <Image src={`/api/media/evidence/${item.id}?thumb=1`} alt={item.title || "Foto evidence"}
              fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" unoptimized />
          </a>
      ) : item.type === "GITHUB_COMMIT" ? (
        <div className="flex flex-col items-center justify-center text-center space-y-2 max-w-xs">
          <div className="p-2.5 rounded-full bg-primary/10 text-primary">
            <GitCommit className="h-6 w-6" />
          </div>
          <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
            {item.githubCommit?.sha ? item.githubCommit.sha.slice(0, 7) : "Commit GitHub"}
          </span>
          {item.githubCommit?.repositoryName && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {item.githubCommit.repositoryName}
            </span>
          )}
        </div>
      ) : (
        <span className="px-3 text-center text-sm text-muted-foreground">
          {item.status === "BROKEN" ? "Foto di Drive tidak tersedia" : item.type === "LINK" ? "Tautan" : `Foto ${item.status.toLowerCase()}`}
        </span>
      )}
    </div>
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-medium">
          {item.title || (item.type === "PHOTO" ? "Foto aktivitas" : item.type === "GITHUB_COMMIT" ? "Commit GitHub" : "Tautan")}
        </h3>
        <span className="rounded-full bg-secondary px-2 py-1 text-[10px]">{item.status}</span>
      </div>
      {item.note && <p className="line-clamp-2 whitespace-pre-wrap text-sm">{item.note}</p>}
      <p className="text-xs text-muted-foreground">
        {new Date(item.capturedAt || item.createdAt).toLocaleDateString("id-ID")}
        {` · ${item.assignmentCount} aktivitas`}
      </p>
      {item.type === "LINK" && item.url && available && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="block truncate text-sm text-primary underline">Buka tautan</a>
      )}
      {item.type === "GITHUB_COMMIT" && item.url && (
        <div className="space-y-1">
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 truncate text-xs text-primary underline">
            <span>Buka commit di GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-[10px] text-muted-foreground">
            *Repositori privat memerlukan hak akses di akun GitHub pemeriksa.
          </p>
        </div>
      )}
      {actions}
    </div>
  </article>;
}

