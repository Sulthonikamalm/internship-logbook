"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared focus trap, Escape dismissal, scroll lock and return focus. */
export function Modal({ open, onClose, title, description, children, side = "bottom", className, busy = false }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode;
  side?: "bottom" | "right" | "center"; className?: string; busy?: boolean;
}) {
  const [keyboard, setKeyboard] = useState(false);
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="dialog-backdrop" data-keyboard={keyboard} />
      <Dialog.Popup className={cn("dialog-popup", className)} data-side={side} data-keyboard={keyboard}
        onKeyDown={() => setKeyboard(true)}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
          </div>
          <Dialog.Close disabled={busy} aria-label="Tutup" className="pressable -mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X size={20} />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
