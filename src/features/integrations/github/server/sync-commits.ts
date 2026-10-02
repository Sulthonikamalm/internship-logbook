import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptGitHubToken } from "./token-crypto";

export interface SyncCommitsResult {
  ok: boolean;
  code?: "SUCCESS" | "NOT_CONNECTED" | "REAUTH_REQUIRED" | "RATE_LIMITED" | "SYNC_ERROR" | "SYNC_IN_PROGRESS" | "REPO_UNAVAILABLE" | "PARTIAL";
  message: string;
  syncedCount?: number;
  retryAt?: string;
}
const repositorySchema = z.object({ id: z.number().int().positive(), full_name: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/), default_branch: z.string().nullable().optional() });
const commitSchema = z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), author: z.object({ id: z.number().int() }).nullable(), commit: z.object({ message: z.string(), author: z.object({ date: z.iso.datetime({ offset: true }) }).nullable(), committer: z.object({ date: z.iso.datetime({ offset: true }) }).nullable() }) });
type CacheCommit = { repository_id: string; repository_name: string; sha: string; message: string; commit_url: string; branch: string | null; author_date: string | null };

export async function syncGitHubCommits(targetRepo?: string): Promise<SyncCommitsResult> {
  const user = await requireActiveUser();
  const repoFilter = targetRepo?.trim();
  if (repoFilter && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoFilter)) return { ok: false, code: "REPO_UNAVAILABLE", message: "Gunakan nama repo dalam format owner/repository." };
  const admin = createAdminClient();
  const nonce = randomUUID();
  const { data: lease, error: leaseError } = await admin.rpc("begin_github_sync", { p_user_id: user.userId, p_nonce: nonce });
  if (leaseError || !lease) return { ok: false, code: "SYNC_ERROR", message: "Sinkronisasi belum dapat dimulai. Coba lagi." };
  if (!lease.ok) return { ok: false, code: lease.code, message: lease.code === "SYNC_IN_PROGRESS" ? "Sinkronisasi sedang berjalan. Tunggu sebentar." : "Hubungkan ulang GitHub untuk menyinkronkan commit." };
  const connection = lease.connection as { version: number; github_user_id: string; github_username: string };
  const commits: CacheCommit[] = [];
  const unavailable: string[] = [];
  let result: SyncCommitsResult = { ok: false, code: "SYNC_ERROR", message: "Sinkronisasi terputus. Coba lagi." };
  let reauth = false;
  const finish = async () => {
    const { data, error } = await admin.rpc("finish_github_sync", { p_user_id: user.userId, p_version: connection.version, p_nonce: nonce, p_commits: commits, p_complete: result.ok, p_reauth: reauth, p_unavailable_repos: unavailable });
    if (error) {
      // Release the lease without claiming the failed batch was saved.
      await admin.rpc("finish_github_sync", { p_user_id: user.userId, p_version: connection.version, p_nonce: nonce, p_commits: [], p_complete: false, p_reauth: false, p_unavailable_repos: [] });
      return { ok: false, code: "SYNC_ERROR" as const, message: "Commit belum tersimpan. Coba sinkronkan lagi." };
    }
    if (!data) return { ok: false, code: "NOT_CONNECTED" as const, message: "Koneksi GitHub berubah. Muat ulang sebelum menyinkronkan." };
    revalidatePath("/integrations"); revalidatePath("/dashboard");
    return { ...result, syncedCount: commits.length };
  };
  try {
    const { data: record, error } = await admin.from("github_tokens").select("access_token").eq("user_id", user.userId).maybeSingle();
    if (error) return await finish();
    let token: string;
    try { token = decryptGitHubToken(record?.access_token ?? ""); }
    catch { reauth = true; result = { ok: false, code: "REAUTH_REQUIRED", message: "Otorisasi GitHub perlu diperbarui. Hubungkan ulang akun." }; return await finish(); }
    const totalTimeout = AbortSignal.timeout(150000);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "InternFlow" };
    const get = (path: string) => fetch(`https://api.github.com${path}`, { headers, cache: "no-store", signal: AbortSignal.any([totalTimeout, AbortSignal.timeout(12000)]) });
    const failure = async (response: Response): Promise<SyncCommitsResult> => {
      if (response.status === 401) { reauth = true; return { ok: false, code: "REAUTH_REQUIRED", message: "Akses GitHub dicabut. Hubungkan ulang akun." }; }
      const body = await response.json().catch(() => ({}));
      const limited = response.status === 429 || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after") || /rate limit|abuse/i.test(body.message ?? "")));
      if (limited) {
        const seconds = Number(response.headers.get("retry-after"));
        const reset = Number(response.headers.get("x-ratelimit-reset"));
        const retryTime = seconds > 0 ? Date.now() + seconds * 1000 : reset > 0 ? reset * 1000 : null;
        return { ok: false, code: "RATE_LIMITED", message: "Batas GitHub tercapai. Commit yang tersimpan tetap tersedia.", ...(retryTime ? { retryAt: new Date(retryTime).toISOString() } : {}) };
      }
      return { ok: false, code: "REPO_UNAVAILABLE", message: "Repo tidak tersedia atau akun ini tidak memiliki akses." };
    };
    const response = await get(repoFilter ? `/repos/${repoFilter}` : "/user/repos?sort=updated&per_page=100&type=all");
    if (!response.ok) { result = await failure(response); if (repoFilter && result.code === "REPO_UNAVAILABLE") unavailable.push(repoFilter); return await finish(); }
    const raw = await response.json();
    const repos = repoFilter ? [repositorySchema.parse(raw)] : z.array(repositorySchema).parse(raw).slice(0, 10);
    let partial = false;
    for (const repo of repos) {
      const response = await get(`/repos/${repo.full_name}/commits?author=${encodeURIComponent(connection.github_username)}&per_page=100`);
      if (response.status === 409) continue; // Empty repositories contain no commits.
      if (!response.ok) {
        result = await failure(response);
        if (result.code === "RATE_LIMITED" || result.code === "REAUTH_REQUIRED") return await finish();
        unavailable.push(repo.full_name); partial = true; continue;
      }
      const entries = z.array(commitSchema).parse(await response.json());
      for (const entry of entries) {
        if (String(entry.author?.id) !== connection.github_user_id) continue;
        commits.push({ repository_id: String(repo.id), repository_name: repo.full_name, sha: entry.sha, message: entry.commit.message.slice(0, 2000), commit_url: `https://github.com/${repo.full_name}/commit/${entry.sha}`, branch: repo.default_branch ?? null, author_date: entry.commit.author?.date ?? entry.commit.committer?.date ?? null });
      }
    }
    result = partial ? { ok: false, code: "PARTIAL", message: `${commits.length} commit dimuat. Sebagian repo tidak dapat diakses.` } : { ok: true, code: "SUCCESS", message: `${commits.length} commit disinkronkan${repoFilter ? "" : " dari hingga 10 repo terbaru"}.` };
  } catch { /* Provider or network failures never expose tokens or raw exceptions. */ }
  return await finish();
}
