"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Feedback } from "@/components/ui/feedback";
import type { GitHubConnection } from "../types";
import { syncGitHubCommitsAction, disconnectGitHubAction } from "../server/actions";

export function ConnectionCard({ connection }: { connection: GitHubConnection | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<"sync" | "disconnect" | null>(null);
  const lock = useRef(false);
  const [dialog, setDialog] = useState<"connect" | "disconnect" | null>(null);
  const [privateRepos, setPrivateRepos] = useState(false);
  const [replace, setReplace] = useState(false);
  const [repo, setRepo] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; warning: boolean } | null>(null);
  const connected = connection?.connectionStatus === "CONNECTED";
  const needsAuth = connection?.connectionStatus === "REAUTH_REQUIRED";
  async function sync() {
    if (lock.current) return; lock.current = true; setPending("sync"); setFeedback(null);
    try {
      const result = await syncGitHubCommitsAction(repo || undefined);
      if (result.ok) toast.success(result.message);
      else setFeedback({ text: result.message + (result.retryAt ? ` Coba setelah ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(result.retryAt))}.` : ""), warning: result.code === "PARTIAL" || result.code === "RATE_LIMITED" });
      router.refresh();
    } catch { setFeedback({ text: "Sinkronisasi terputus. Coba lagi.", warning: false }); }
    finally { lock.current = false; setPending(null); }
  }
  async function disconnect() {
    if (lock.current) return; lock.current = true; setPending("disconnect");
    try {
      const result = await disconnectGitHubAction();
      if (result.ok) { toast.success(result.message); setDialog(null); router.refresh(); }
      else setFeedback({ text: result.message, warning: false });
    } catch { setFeedback({ text: "Koneksi belum diputus. Coba lagi.", warning: false }); }
    finally { lock.current = false; setPending(null); }
  }
  return <section className="surface space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><GitBranch size={24} /></div><div><h2 className="text-lg font-semibold">GitHub</h2><p className="mt-1 text-sm text-muted-foreground">{connection ? `@${connection.githubUsername}` : "Commit sebagai bukti kerja"}</p></div></div><Badge variant={connected ? "success" : needsAuth ? "warning" : "outline"}>{connected ? "Terhubung" : needsAuth ? "Hubungkan ulang" : "Opsional"}</Badge></div>
    {connection?.lastSyncedAt && <p className="text-xs text-muted-foreground">Sinkronisasi lengkap terakhir · {new Date(connection.lastSyncedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>}
    {connected && <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Repo untuk disinkronkan" placeholder="Semua repo terbaru, atau owner/repository" value={repo} onChange={e => setRepo(e.target.value)} disabled={Boolean(pending)} className="min-w-0 flex-1" /><Button onClick={sync} disabled={Boolean(pending)} className="gap-2"><RefreshCw size={17} className={pending === "sync" ? "animate-spin" : ""} />{pending === "sync" ? "Menyinkronkan…" : "Sync commit"}</Button></div>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setReplace(false); setDialog("connect"); }} disabled={Boolean(pending)}>{connected || needsAuth ? "Hubungkan ulang" : "Hubungkan GitHub"}</Button>{connection && connection.connectionStatus !== "DISCONNECTED" && <Button variant="ghost" onClick={() => setDialog("disconnect")} disabled={Boolean(pending)} className="gap-2 text-muted-foreground"><Unlink size={17} />Putuskan</Button>}</div>
    {feedback && <Feedback tone={feedback.warning ? "warning" : "error"}>{feedback.text}</Feedback>}
    <Modal open={dialog === "connect"} onClose={() => setDialog(null)} title={connection ? "Hubungkan ulang GitHub" : "Hubungkan GitHub"} description="Commit menjadi evidence hanya saat kamu memilihnya.">
      <div className="space-y-5"><p className="text-sm leading-relaxed text-muted-foreground">InternFlow menyimpan metadata commit. Isi file kode tidak diambil.</p><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={privateRepos} onChange={e => setPrivateRepos(e.target.checked)} className="size-5 accent-primary" />Sertakan repo privat</label>{privateRepos && <Feedback tone="info">GitHub OAuth meminta izin repo yang juga mencakup tulis. InternFlow hanya memakai API baca metadata commit.</Feedback>}
      {connection && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} className="size-5 shrink-0 accent-primary" />Izinkan ganti akun. Evidence lama tetap tersimpan.</label>}
      <Button asChild className="w-full"><a href={`/api/integrations/github/connect?private=${privateRepos ? "1" : "0"}&replace=${replace ? "1" : "0"}`}>Lanjut ke GitHub</a></Button></div>
    </Modal>
    <Modal open={dialog === "disconnect"} onClose={() => setDialog(null)} title="Putuskan GitHub?" description="Token akan dihapus. Evidence historis tetap tersimpan." busy={pending === "disconnect"}>
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={Boolean(pending)} onClick={() => setDialog(null)}>Batal</Button><Button variant="destructive" disabled={Boolean(pending)} onClick={disconnect}>{pending ? "Memutuskan…" : "Putuskan"}</Button></div>
    </Modal>
  </section>;
}
