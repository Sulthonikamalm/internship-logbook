"use client";

import { ShieldAlert, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EvidenceGateModal({
  isOpen,
  onClose,
  targetStageName,
  minimumRequired,
  currentCount,
  onOpenTodoDetail,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetStageName: string;
  minimumRequired: number;
  currentCount: number;
  onOpenTodoDetail?: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Evidence Gate: Lampiran Diperlukan</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tahap <strong className="text-foreground">{targetStageName}</strong> memerlukan bukti pekerjaan
              sebelum kartu dapat dipindahkan.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Syarat Minimum Evidence:</span>
            <span className="font-semibold text-foreground">{minimumRequired} Berkas Valid</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Evidence Tersedia Saat Ini:</span>
            <span className={`font-semibold ${currentCount < minimumRequired ? "text-destructive" : "text-emerald-600"}`}>
              {currentCount} Berkas
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Kartu dikembalikan ke posisi semula secara otomatis. Silakan lampirkan foto dokumentasi atau tautan hasil kerja terlebih dahulu.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          {onOpenTodoDetail && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onClose();
                onOpenTodoDetail();
              }}
            >
              <Layers className="h-4 w-4" />
              <span>Buka Todo & Lampirkan</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
