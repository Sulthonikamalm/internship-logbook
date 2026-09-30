import Link from "next/link";
import { listEvidence, EVIDENCE_PAGE_SIZE } from "@/features/evidence/server/list-evidence";
import { EvidenceCard } from "@/features/evidence/components/evidence-card";
import { DeleteEvidenceButton, LinkEvidenceForm } from "@/features/evidence/components/evidence-controls";
import { PhotoUploader } from "@/features/evidence/components/photo-uploader";

type Search = { page?: string; type?: string; assignment?: string; date?: string };
export default async function EvidencePage({ searchParams }: { searchParams: Promise<Search> }) {
  const filter = await searchParams;
  const { items, count, page } = await listEvidence({
    page: Number(filter.page) || 1, type: filter.type, assignment: filter.assignment, date: filter.date,
  });
  const url = (next: number) => {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.assignment) params.set("assignment", filter.assignment);
    if (filter.date) params.set("date", filter.date);
    params.set("page", String(next));
    return `/evidence?${params}`;
  };
  return <section className="space-y-6">
    <header><h1 className="text-2xl font-bold">Evidence Library</h1>
      <p className="text-sm text-muted-foreground">Foto dan tautan milik Anda untuk dilampirkan ke aktivitas.</p></header>
    <div className="grid gap-4 lg:grid-cols-2"><PhotoUploader /><LinkEvidenceForm /></div>
    <form method="get" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
      <div><label htmlFor="evidence-type" className="block text-sm">Jenis/status</label>
        <select id="evidence-type" name="type" defaultValue={filter.type || ""} className="w-full rounded-md border bg-background px-3 py-2">
          <option value="">Semua</option><option value="PHOTO">Foto</option>
          <option value="LINK">Tautan</option><option value="BROKEN">Rusak</option>
        </select></div>
      <div><label htmlFor="evidence-assignment" className="block text-sm">Pemakaian</label>
        <select id="evidence-assignment" name="assignment" defaultValue={filter.assignment || ""} className="w-full rounded-md border bg-background px-3 py-2">
          <option value="">Semua</option><option value="assigned">Terpasang</option>
          <option value="unassigned">Belum terpasang</option>
        </select></div>
      <div><label htmlFor="evidence-date" className="block text-sm">Tanggal unggah</label>
        <input id="evidence-date" name="date" type="date" defaultValue={filter.date || ""}
          className="w-full rounded-md border bg-background px-3 py-2" /></div>
      <button type="submit" className="self-end rounded-md bg-primary px-4 py-2 text-primary-foreground">Terapkan</button>
    </form>
    {items.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center">
      <p>Belum ada evidence untuk filter ini.</p><Link href="/evidence" className="text-primary underline">Lihat semua</Link>
    </div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => <EvidenceCard key={item.id} item={item} actions={<DeleteEvidenceButton id={item.id} count={item.assignmentCount} />} />)}
    </div>}
    <div className="flex justify-between text-sm"><span>{count} evidence</span><div className="flex gap-4">
      {page > 1 && <Link href={url(page - 1)} className="text-primary underline">Sebelumnya</Link>}
      {page * EVIDENCE_PAGE_SIZE < count && <Link href={url(page + 1)} className="text-primary underline">Berikutnya</Link>}
    </div></div>
  </section>;
}
