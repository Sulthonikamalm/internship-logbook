"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import type { FilterPreset, NormalizedLogbookFilters } from "../domain/types";
export function LogbookFiltersBar({ filters }: { filters: NormalizedLogbookFilters }) {
  const router = useRouter(); const [preset, setPreset] = useState<FilterPreset>(filters.preset);
  const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget);
    if (preset === "custom" && String(data.get("from")) > String(data.get("to"))) { setError("Tanggal selesai harus setelah tanggal mulai."); return; }
    setError(""); const params = new URLSearchParams(); for (const [key, value] of data.entries()) if (String(value).trim()) params.set(key, String(value).trim());
    startTransition(() => router.push(`/logbook?${params}`));
  }
  const field = "w-full rounded-lg border bg-background px-3 py-2";
  return <form onSubmit={apply} className="surface space-y-4 p-4" aria-busy={pending}>
    <input type="hidden" name="category" value={filters.category ?? "INTERNSHIP"} />
    <fieldset disabled={pending} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><label htmlFor="logbook-preset" className="mb-1.5 block text-sm">Periode</label><select id="logbook-preset" name="preset" value={preset} onChange={e => setPreset(e.target.value as FilterPreset)} className={field}><option value="today">Hari ini</option><option value="week">Minggu ini</option><option value="month">Bulan</option><option value="custom">Rentang tanggal</option></select></div>
      <div><label htmlFor="logbook-keyword" className="mb-1.5 block text-sm">Cari</label><input id="logbook-keyword" name="q" defaultValue={filters.q} maxLength={100} placeholder="Judul atau deskripsi" className={field} /></div>
      <div><label htmlFor="logbook-evidence-type" className="mb-1.5 block text-sm">Evidence</label><select id="logbook-evidence-type" name="evidenceType" defaultValue={filters.evidenceType} className={field}><option value="all">Semua</option><option value="photo">Foto</option><option value="link">Tautan</option><option value="github">Commit GitHub</option><option value="none">Tanpa evidence</option></select></div>
      {preset === "month" && <div><label htmlFor="logbook-month-picker" className="mb-1.5 block text-sm">Bulan</label><input id="logbook-month-picker" name="month" type="month" required defaultValue={filters.month || filters.from?.slice(0,7)} className={field} /></div>}
      {preset === "custom" && <><div><label htmlFor="logbook-from-date" className="mb-1.5 block text-sm">Dari</label><input id="logbook-from-date" name="from" type="date" required defaultValue={filters.from} className={field} aria-invalid={Boolean(error)} /></div><div><label htmlFor="logbook-to-date" className="mb-1.5 block text-sm">Sampai</label><input id="logbook-to-date" name="to" type="date" required defaultValue={filters.to} className={field} aria-invalid={Boolean(error)} /></div></>}
    </fieldset>
    {error && <Feedback>{error}</Feedback>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={pending} onClick={() => startTransition(() => router.push(`/logbook?category=${filters.category ?? "INTERNSHIP"}`))}>Reset</Button><Button type="submit" disabled={pending}>{pending ? "Memuat…" : "Terapkan"}</Button></div>
  </form>;
}
