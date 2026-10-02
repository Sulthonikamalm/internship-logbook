"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/ui/feedback";
import { workingDayNames } from "../domain/settings-schema";
import type { InternshipSettings } from "../domain/types";
import { saveInternshipSettingsAction } from "../server/actions";

export function InternshipSettingsDialog({ settings, trigger, isOpenDefault = false }: { settings: InternshipSettings | null; trigger?: React.ReactNode; isOpenDefault?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(isOpenDefault);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [startDate, setStartDate] = useState(settings?.startDate ?? "");
  const [endDate, setEndDate] = useState(settings?.endDate ?? "");
  const [days, setDays] = useState(settings?.workingDays ?? [1, 2, 3, 4, 5]);
  const [error, setError] = useState("");
  function show() {
    setStartDate(settings?.startDate ?? ""); setEndDate(settings?.endDate ?? ""); setDays(settings?.workingDays ?? [1, 2, 3, 4, 5]); setError(""); setOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try {
      const result = await saveInternshipSettingsAction({ startDate: startDate || null, endDate: endDate || null, workingDays: days });
      if (!result.ok) { setError(result.message); return; }
      toast.success("Periode magang disimpan"); setOpen(false); router.refresh();
    } catch { setError("Pengaturan belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <>
    {trigger ? <Button asChild variant="outline" onClick={show}>{trigger}</Button> : <Button variant="outline" onClick={show} className="gap-2"><Settings size={17} />Atur periode</Button>}
    <Modal open={open} onClose={() => setOpen(false)} title="Periode magang" description="Tentukan periode dan hari kerja untuk logbook." busy={pending}>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium"><span>Mulai</span><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label className="space-y-2 text-sm font-medium"><span>Selesai</span><Input type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} /></label></div>
          <fieldset><legend className="mb-3 text-sm font-medium">Hari kerja</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{[1,2,3,4,5,6,7].map(day => <button type="button" key={day} aria-pressed={days.includes(day)} onClick={() => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort())} className={`pressable flex min-h-11 items-center justify-between rounded-xl border px-3 text-xs font-medium ${days.includes(day) ? "border-primary/30 bg-secondary text-primary" : "border-border bg-white text-muted-foreground"}`}>{workingDayNames[day]}{days.includes(day) && <Check size={14} />}</button>)}</div></fieldset>
        </fieldset>
        {error && <Feedback>{error}</Feedback>}
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button disabled={pending} className="gap-2">{pending && <Loader2 size={16} className="animate-spin" />}{pending ? "Menyimpan…" : "Simpan"}</Button></div>
      </form>
    </Modal>
  </>;
}
