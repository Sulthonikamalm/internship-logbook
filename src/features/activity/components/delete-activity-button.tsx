"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { softDeleteActivity } from "../server/soft-delete-activity";

export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  async function remove() {
    if (pending || !confirming) return;
    setPending(true); setMessage("");
    try {
      const result = await softDeleteActivity(id);
      if (!result.ok) { setMessage(result.message); return; }
      router.push("/activities"); router.refresh();
    } catch { setMessage("Respons belum diterima. Coba lagi."); }
    finally { setPending(false); }
  }
  return <div>
    {!confirming ? <button type="button" onClick={() => setConfirming(true)}
      className="text-sm text-destructive underline">Hapus</button> :
      <div role="group" aria-label="Konfirmasi hapus aktivitas" className="space-y-2 rounded-md border p-3">
        <p className="text-sm">Hapus aktivitas ini?</p>
        <div className="flex gap-3">
          <button type="button" onClick={remove} disabled={pending}
            className="text-sm font-medium text-destructive disabled:opacity-50">
            {pending ? "Menghapus..." : "Ya, hapus"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="text-sm underline disabled:opacity-50">Batal</button>
        </div>
      </div>}
    {message && <p role="alert" className="mt-2 text-sm text-destructive">{message}</p>}</div>;
}
