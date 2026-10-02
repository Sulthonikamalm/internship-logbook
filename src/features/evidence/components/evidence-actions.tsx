"use client";
import { useState } from "react";
import { Camera, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PhotoUploader } from "./photo-uploader";
import { LinkEvidenceForm } from "./evidence-controls";
import { CommitPicker } from "@/features/integrations/github/components/commit-picker";

export function EvidenceActions({ initialUpload = false }: { initialUpload?: boolean }) {
  const [mode, setMode] = useState<"photo" | "link" | null>(initialUpload ? "photo" : null);
  const [busy, setBusy] = useState(false);
  return <><div className="flex flex-wrap gap-2"><Button onClick={() => setMode("photo")} className="gap-2"><Camera size={18} />Unggah foto</Button><Button variant="outline" onClick={() => setMode("link")} className="gap-2"><Link2 size={18} />Tautan</Button><CommitPicker /></div>
    <Modal open={mode !== null} onClose={() => setMode(null)} busy={busy} title={mode === "photo" ? "Unggah foto" : "Tambah tautan"}>
      {mode === "photo" && <PhotoUploader compact onBusyChange={setBusy} />}{mode === "link" && <LinkEvidenceForm onBusyChange={setBusy} />}
    </Modal></>;
}
