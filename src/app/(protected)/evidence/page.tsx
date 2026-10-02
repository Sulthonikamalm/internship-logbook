import Link from "next/link";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listEvidence, EVIDENCE_PAGE_SIZE } from "@/features/evidence/server/list-evidence";
import { EvidenceCard } from "@/features/evidence/components/evidence-card";
import { DeleteEvidenceButton } from "@/features/evidence/components/evidence-controls";
import { EvidenceActions } from "@/features/evidence/components/evidence-actions";

type Search = { page?: string; type?: string; assignment?: string; date?: string; upload?: string };
export default async function EvidencePage({ searchParams }: { searchParams: Promise<Search> }) {
  const filter = await searchParams;
  const { items, count, page } = await listEvidence({ page: Number(filter.page) || 1, type: filter.type, assignment: filter.assignment, date: filter.date });
  const url = (next: number) => { const params = new URLSearchParams(); for (const field of ["type", "assignment", "date"] as const) if (filter[field]) params.set(field, filter[field]); params.set("page", String(next)); return `/evidence?${params}`; };
  return <section className="space-y-6"><PageHeader title="Evidence" description="Bukti kerja, siap dilampirkan." /><EvidenceActions key={filter.upload || "library"} initialUpload={filter.upload === "1"} />
    <details className="surface-card p-4" open={Boolean(filter.type || filter.assignment || filter.date)}><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Filter Library <span className="ml-2 font-normal text-muted-foreground">{count} evidence</span></summary>
      <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label htmlFor="evidence-type" className="mb-1.5 block text-sm">Jenis</label><select id="evidence-type" name="type" defaultValue={filter.type || ""} className="w-full rounded-lg border bg-background px-3 py-2"><option value="">Semua</option><option value="PHOTO">Foto</option><option value="LINK">Tautan</option><option value="GITHUB_COMMIT">Commit GitHub</option><option value="BROKEN">Tidak tersedia</option></select></div>
        <div><label htmlFor="evidence-assignment" className="mb-1.5 block text-sm">Pemakaian</label><select id="evidence-assignment" name="assignment" defaultValue={filter.assignment || ""} className="w-full rounded-lg border bg-background px-3 py-2"><option value="">Semua</option><option value="assigned">Terpasang</option><option value="unassigned">Belum terpasang</option></select></div>
        <div><label htmlFor="evidence-date" className="mb-1.5 block text-sm">Tanggal unggah</label><input id="evidence-date" name="date" type="date" defaultValue={filter.date || ""} className="w-full rounded-lg border bg-background px-3 py-2" /></div><div className="flex items-end gap-2"><Button type="submit">Terapkan</Button><Button asChild variant="ghost"><Link href="/evidence">Reset</Link></Button></div>
      </form></details>
    {items.length === 0 ? <EmptyState icon={Images} title="Belum ada evidence di sini" description={filter.type || filter.date || filter.assignment ? "Coba ubah filter." : "Unggah foto, simpan tautan, atau pilih commit."} /> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <EvidenceCard key={`${item.id}-${item.status}`} item={item} actions={<DeleteEvidenceButton id={item.id} count={item.assignmentCount} />} />)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{count} evidence</span><div className="flex gap-2">{page > 1 && <Button asChild variant="outline"><Link href={url(page - 1)}>Sebelumnya</Link></Button>}{page * EVIDENCE_PAGE_SIZE < count && <Button asChild variant="outline"><Link href={url(page + 1)}>Berikutnya</Link></Button>}</div></div>
    <details className="text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Tentang akses privat</summary><p className="max-w-xl">Foto diakses melalui InternFlow. Tautan eksternal dan repo privat memerlukan izin dari pemilik sumber.</p></details>
  </section>;
}
