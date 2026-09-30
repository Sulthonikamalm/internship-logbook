"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, ExternalLink, Image as ImageIcon, Link as LinkIcon, X } from "lucide-react";
import type { LogbookEvidenceItem } from "../domain/types";

type Props = {
  evidences: LogbookEvidenceItem[];
  photoCount: number;
  linkCount: number;
  brokenCount: number;
  totalEvidenceCount: number;
};

export function EvidenceSummaryBadges({
  evidences,
  photoCount,
  linkCount,
  brokenCount,
  totalEvidenceCount,
}: Props) {
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  if (totalEvidenceCount === 0 && evidences.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const photos = evidences.filter((e) => e.type === "PHOTO");
  const links = evidences.filter((e) => e.type === "LINK");
  const brokenEvidences = evidences.filter((e) => e.status === "BROKEN");
  const hasBroken = brokenCount > 0 || brokenEvidences.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Photo badge & preview trigger */}
      {photoCount > 0 && (
        <button
          type="button"
          onClick={() => setPhotoViewerOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
          title="Klik untuk melihat pratinjau foto"
        >
          <ImageIcon className="h-3 w-3" />
          <span>{photoCount} foto</span>
        </button>
      )}

      {/* Links badges */}
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
          title={link.url || "Buka tautan eksternal"}
        >
          <LinkIcon className="h-3 w-3" />
          <span className="max-w-[100px] truncate">{link.title || "Tautan"}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-70" />
        </a>
      ))}

      {/* If links count exists but individual links were not in array */}
      {linkCount > 0 && links.length === 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700">
          <LinkIcon className="h-3 w-3" />
          <span>{linkCount} tautan</span>
        </span>
      )}

      {/* Broken Warning Badge */}
      {hasBroken && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-[11px] font-medium text-amber-800"
          title="Salah satu bukti foto tidak ditemukan di Google Drive"
        >
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span>Bukti Rusak</span>
        </span>
      )}

      {/* Photo Viewer Modal */}
      {photoViewerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPhotoViewerOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span>Foto Evidence ({photos.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setPhotoViewerOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <div className="relative aspect-4/3 flex items-center justify-center bg-muted/60">
                    {photo.status === "AVAILABLE" ? (
                      <a
                        href={`/api/media/evidence/${photo.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-full w-full"
                      >
                        <Image
                          src={`/api/media/evidence/${photo.id}?thumb=1`}
                          alt={photo.title || "Evidence photo"}
                          fill
                          sizes="(max-width: 640px) 50vw, 240px"
                          className="object-cover group-hover:scale-105 transition-transform"
                          unoptimized
                        />
                      </a>
                    ) : (
                      <div className="p-3 text-center">
                        <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                        <span className="text-[11px] text-amber-700 font-medium">
                          {photo.status === "BROKEN" ? "Foto rusak / terhapus di Drive" : photo.status}
                        </span>
                      </div>
                    )}
                  </div>
                  {photo.title && (
                    <div className="p-2 text-xs truncate font-medium text-foreground bg-card">
                      {photo.title}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setPhotoViewerOpen(false)}
                className="text-xs text-primary font-medium hover:underline"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
