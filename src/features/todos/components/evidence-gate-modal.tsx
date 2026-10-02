"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
export function EvidenceGateModal({ isOpen, onClose, targetStageName, minimumRequired, currentCount, onOpenTodoDetail }: { isOpen: boolean; onClose: () => void; targetStageName: string; minimumRequired: number; currentCount: number; onOpenTodoDetail?: () => void }) {
  return <Modal open={isOpen} onClose={onClose} title="Tambahkan evidence" description={`${targetStageName} membutuhkan ${minimumRequired} evidence siap pakai.`}><div className="space-y-5"><p className="text-sm text-muted-foreground">Tersedia {currentCount} dari {minimumRequired}. Lampirkan bukti, lalu pindahkan todo kembali.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Nanti</Button><Button onClick={() => { onClose(); onOpenTodoDetail?.(); }}>Buka todo</Button></div></div></Modal>;
}
