"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabels, parseWorkCategory } from "@/features/work/domain/category";
import type { VisibleReportPhotoShare } from "../server/report-photo-shares";
import { revokeReportPhotoShare } from "../server/revoke-report-share";

export function ActivePhotoShares({ shares, timezone }: { shares: VisibleReportPhotoShare[]; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const active = shares.filter(share => !hidden.includes(share.id));
  if (!active.length) return null;
  const date = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));
  async function revoke(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const result = await revokeReportPhotoShare(id);
      if (!result.ok) { toast.error(result.message); return; }
      setHidden(current => [...current, id]);
      toast.success("Akses foto dicabut");
      router.refresh();
    } catch { toast.error("Akses belum dapat dicabut. Coba lagi."); }
    finally { setBusy(null); }
  }
  return <section className="surface max-w-3xl p-5 sm:p-7" aria-labelledby="photo-shares-title">
    <h2 id="photo-shares-title" className="text-base font-semibold">Akses foto aktif <span className="text-sm font-normal text-muted-foreground">{active.length}</span></h2>
    <p className="mt-1 text-sm text-muted-foreground">Cabut akses jika file Excel tidak lagi perlu dibagikan.</p>
    <div className="mt-4 max-h-80 divide-y overflow-y-auto rounded-2xl border border-border/70">
      {active.map(share => <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0 text-sm"><p className="font-medium">{categoryLabels[parseWorkCategory(share.work_category)]} · {share.period_from} – {share.period_to}</p><p className="mt-1 text-xs text-muted-foreground">Berlaku sampai {date(share.expires_at)}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => revoke(share.id)} disabled={Boolean(busy)} className="gap-2"><Link2Off size={15} />{busy === share.id ? "Mencabut…" : "Cabut akses"}</Button>
      </div>)}
    </div>
  </section>;
}
