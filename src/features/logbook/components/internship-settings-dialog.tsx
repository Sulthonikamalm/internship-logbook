"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Loader2, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workingDayNames } from "../domain/settings-schema";
import type { InternshipSettings } from "../domain/types";
import { saveInternshipSettingsAction } from "../server/actions";

type Props = {
  settings: InternshipSettings | null;
  trigger?: React.ReactNode;
  isOpenDefault?: boolean;
};

export function InternshipSettingsDialog({ settings, trigger, isOpenDefault = false }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(settings?.startDate || "");
  const [endDate, setEndDate] = useState(settings?.endDate || "");
  const [workingDays, setWorkingDays] = useState<number[]>(
    settings?.workingDays && settings.workingDays.length > 0
      ? settings.workingDays
      : [1, 2, 3, 4, 5]
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function toggleWorkingDay(day: number) {
    if (workingDays.includes(day)) {
      if (workingDays.length === 1) {
        setErrorMsg("Pilih minimal satu hari kerja.");
        return;
      }
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort((a, b) => a - b));
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setFieldErrors({});

    startTransition(async () => {
      const res = await saveInternshipSettingsAction({
        startDate: startDate || null,
        endDate: endDate || null,
        workingDays,
      });

      if (!res.ok) {
        setErrorMsg(res.message);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)} className="cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 text-xs"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Atur Periode Magang</span>
        </Button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="settings-dialog-title" className="font-semibold text-foreground text-base">
                    Pengaturan Periode Magang
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Diperlukan untuk evaluasi hari kosong (missing-day).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Tutup dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="setting-start-date" className="block text-xs font-medium text-foreground mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    id="setting-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {fieldErrors.startDate && (
                    <p className="mt-1 text-[11px] text-destructive">{fieldErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="setting-end-date" className="block text-xs font-medium text-foreground mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    id="setting-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {fieldErrors.endDate && (
                    <p className="mt-1 text-[11px] text-destructive">{fieldErrors.endDate}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Hari Kerja Aktif
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleWorkingDay(day)}
                        className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{workingDayNames[day]}</span>
                        {isSelected && <Check className="h-3 w-3 text-primary ml-1" />}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.workingDays && (
                  <p className="mt-1 text-[11px] text-destructive">{fieldErrors.workingDays}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Pengaturan</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
