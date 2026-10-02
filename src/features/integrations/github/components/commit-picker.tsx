"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitCommitHorizontal, Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import type { GitHubCommit } from "../types";
import { attachCommitEvidenceAction, getGitHubCommitPage } from "../server/actions";

export function CommitList({ initialItems = [], initialCount = 0, loadOnMount = false, activityId, todoId, onAttached, onBusyChange, showIntegrationLink = true }: { initialItems?: GitHubCommit[]; initialCount?: number; loadOnMount?: boolean; activityId?: string; todoId?: string; onAttached?: () => void; onBusyChange?: (busy: boolean) => void; showIntegrationLink?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [count, setCount] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [repository, setRepository] = useState("");
  const [applied, setApplied] = useState({ search: "", repository: "" });
  const [loading, setLoading] = useState(loadOnMount);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const requestId = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    if (!loadOnMount) return;
    let current = true;
    const id = ++requestId.current;
    getGitHubCommitPage({ limit: 20 }).then(result => { if (current && id === requestId.current) { setItems(result.items); setCount(result.count); } }).catch(() => { if (current && id === requestId.current) setError("Commit belum dapat dimuat. Coba cari lagi."); }).finally(() => { if (current && id === requestId.current) setLoading(false); });
    return () => { current = false; };
  }, [loadOnMount]);
  async function load(nextPage: number, filters = applied) {
    const id = ++requestId.current; setLoading(true); setError("");
    try {
      const result = await getGitHubCommitPage({ limit: 20, page: nextPage, search: filters.search || undefined, repository: filters.repository || undefined });
      if (id !== requestId.current) return;
      setItems(current => nextPage === 1 ? result.items : [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))]);
      setPage(nextPage); setCount(result.count); setApplied(filters);
    } catch { if (id === requestId.current) setError("Commit belum dapat dimuat. Coba lagi."); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  async function select(commit: GitHubCommit) {
    if (lock.current) return; lock.current = true; setPending(commit.id); onBusyChange?.(true); setError("");
    try {
      const result = await attachCommitEvidenceAction({ commitId: commit.id, activityId, todoId });
      if (!result.ok) setError(result.message ?? "Commit belum tersimpan.");
      else { toast.success(activityId || todoId ? "Commit dilampirkan" : "Commit disimpan di Evidence Library"); router.refresh(); onAttached?.(); }
    } catch { setError("Commit belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setPending(null); onBusyChange?.(false); }
  }
  return <div className="space-y-4">
    <form onSubmit={e => { e.preventDefault(); void load(1, { search: search.trim(), repository: repository.trim() }); }} className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Cari pesan commit" placeholder="Cari pesan commit" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} disabled={Boolean(pending)} /><Input aria-label="Filter repo commit" placeholder="owner/repository (opsional)" value={repository} maxLength={200} onChange={e => setRepository(e.target.value)} disabled={Boolean(pending)} /><Button variant="outline" disabled={loading || Boolean(pending)} type="submit">Cari</Button></form>
    {error && <Feedback>{error}</Feedback>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={17} className="animate-spin" />Memuat commit…</p>}
    {!loading && items.length === 0 && <div className="rounded-2xl bg-muted/50 p-6 text-center"><GitCommitHorizontal size={28} className="mx-auto mb-3 text-primary" /><p className="text-sm font-medium">Belum ada commit di sini</p><p className="mt-2 text-xs text-muted-foreground">Sync dari Integrasi, atau ubah pencarian.</p>{showIntegrationLink && <Link href="/integrations" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary">Buka Integrasi →</Link>}</div>}
    <div className="divide-y divide-border/60">{items.map(commit => <article key={commit.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="mb-1 truncate text-xs text-muted-foreground">{commit.repositoryName}</p><p className="line-clamp-2 break-words text-sm font-medium">{commit.message?.split("\n")[0] || "Commit tanpa pesan"}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="font-mono">{commit.sha.slice(0, 7)}</span>{commit.authorDate && <time dateTime={commit.authorDate}>{new Date(commit.authorDate).toLocaleDateString("id-ID")}</time>}{commit.sourceStatus !== "AVAILABLE" && <span className="text-warning">Sumber tidak tersedia</span>}</div></div><div className="flex shrink-0 items-center justify-end gap-2">{/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(commit.repositoryName) && /^[0-9a-f]{40}$/.test(commit.sha) && <a href={`https://github.com/${commit.repositoryName}/commit/${commit.sha}`} target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Buka commit ${commit.sha.slice(0,7)} di GitHub`}><ExternalLink size={17} /></a>}<Button variant="outline" size="sm" disabled={Boolean(pending) || commit.sourceStatus !== "AVAILABLE"} onClick={() => select(commit)} className="gap-2">{pending === commit.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{activityId || todoId ? "Lampirkan" : "Simpan evidence"}</Button></div></article>)}</div>
    {items.length < count && <Button variant="ghost" disabled={loading || Boolean(pending)} onClick={() => load(page + 1)} className="w-full">Muat lainnya · {items.length}/{count}</Button>}
  </div>;
}
export function CommitPicker({ activityId, todoId, onAttached, disabled = false }: { activityId?: string; todoId?: string; onAttached?: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <><Button variant="outline" disabled={disabled} onClick={() => setOpen(true)} className="gap-2"><GitCommitHorizontal size={17} />Pilih commit GitHub</Button><Modal open={open} onClose={() => setOpen(false)} busy={busy} title="Pilih commit" description="Pilih bukti kerja untuk dilampirkan." className="sm:max-w-2xl">{open && <CommitList loadOnMount activityId={activityId} todoId={todoId} onBusyChange={setBusy} onAttached={() => { setOpen(false); onAttached?.(); }} />}</Modal></>;
}
