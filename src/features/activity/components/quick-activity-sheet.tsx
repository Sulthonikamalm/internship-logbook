"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActivityForm } from "./activity-form";
import { QuickPhotoActivity } from "@/features/evidence/components/quick-photo-activity";

export function QuickActivitySheet({ backUrl, ...props }: { backUrl: string; userId: string; timezone: string; initialDate?: string; initialTitle?: string; initialDescription?: string; todoId?: string; returnTo?: string }) {
  const router = useRouter(); const [mode, setMode] = useState("text"); const [busy, setBusy] = useState(false);
  return <Modal open onClose={() => router.push(backUrl)} busy={busy} title="Catat cepat" className="sm:max-w-xl">
    {!props.todoId && <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1"><Button variant={mode === "text" ? "secondary" : "ghost"} className="flex-1" aria-pressed={mode === "text"} disabled={busy} onClick={() => setMode("text")}>Catatan</Button><Button variant={mode === "photo" ? "secondary" : "ghost"} className="flex-1" aria-pressed={mode === "photo"} disabled={busy} onClick={() => setMode("photo")}>Foto</Button></div>}
    {mode === "text" ? <ActivityForm {...props} quick onBusyChange={setBusy} /> : <QuickPhotoActivity onBusyChange={setBusy} />}
  </Modal>;
}
