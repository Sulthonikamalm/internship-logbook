"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/ui/feedback";
import { saveProfile } from "../server/actions";

export function ProfileForm({ displayName, timezone }: { displayName: string; timezone: string }) {
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const zones = [...new Set([timezone, "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Bangkok", "UTC"])];
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setError("");
    try { const result = await saveProfile({ displayName: name, timezone: zone }); if (!result.ok) setError(result.message ?? "Profil belum tersimpan."); else toast.success("Profil disimpan"); }
    catch { setError("Profil belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><fieldset disabled={pending} className="space-y-5"><label className="block space-y-2 text-sm font-medium"><span>Nama</span><Input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required maxLength={100} /></label><label className="block space-y-2 text-sm font-medium"><span>Zona waktu</span><select value={zone} onChange={e => setZone(e.target.value)} className="w-full rounded-xl border border-input bg-white px-3">{zones.map(tz => <option key={tz}>{tz}</option>)}</select></label></fieldset>{error && <Feedback>{error}</Feedback>}<Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan profil"}</Button></form>;
}
