import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptGitHubToken } from "@/features/integrations/github/server/token-crypto";
import { AgentError, type AgentActor } from "./auth";

export type CommitDetail = { id: string; repository: string; sha: string; date: string | null; url: string; message: string;
  files: { filename: string; status: string; patch?: string; additions: number; deletions: number }[]; hasMore: boolean };
export async function readCommitDetail(actor: AgentActor, id: string, repository: string, page = 1): Promise<CommitDetail> {
  const cached = await actor.db.from("github_commits").select("id,repository_name,sha,author_date,message,commit_url")
    .eq("id", id).eq("user_id", actor.user.userId).maybeSingle();
  if (cached.error || !cached.data || cached.data.repository_name.toLowerCase() !== repository.toLowerCase()) throw new AgentError("Commit tidak tersedia dalam project ini.", 404, "COMMIT_UNAVAILABLE");
  const connection = await actor.db.from("github_connections").select("connection_status").eq("user_id", actor.user.userId).maybeSingle();
  if (connection.data?.connection_status !== "CONNECTED") throw new AgentError("Hubungkan ulang GitHub melalui aplikasi.", 409, "GITHUB_REAUTH_REQUIRED");
  const record = await createAdminClient().from("github_tokens").select("access_token").eq("user_id", actor.user.userId).maybeSingle();
  let token: string;
  try { token = decryptGitHubToken(record.data?.access_token ?? ""); }
  catch { throw new AgentError("Hubungkan ulang GitHub melalui aplikasi.", 409, "GITHUB_REAUTH_REQUIRED"); }
  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${cached.data.sha}?per_page=30&page=${page}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new AgentError(response.status === 403 || response.status === 429 ? "GitHub membatasi akses. Coba lagi nanti." : "Detail commit belum dapat dibaca.", 503, "GITHUB_UNAVAILABLE");
  const body = await response.json();
  return { id, repository: cached.data.repository_name, sha: cached.data.sha, date: cached.data.author_date, url: cached.data.commit_url ?? `https://github.com/${repository}/commit/${cached.data.sha}`,
    message: cached.data.message ?? "", files: (body.files ?? []).map((file: CommitDetail["files"][number]) => ({
      filename: file.filename, status: file.status, patch: file.patch?.slice(0, 60000), additions: file.additions, deletions: file.deletions,
    })), hasMore: /rel="next"/.test(response.headers.get("link") ?? "") };
}
