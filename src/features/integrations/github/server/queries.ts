import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { GitHubConnection, GitHubCommit, CommitFilterParams } from "../types";

export async function getGitHubConnection(): Promise<GitHubConnection | null> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("github_connections")
    .select("id, user_id, github_user_id, github_username, connection_status, scopes, connected_at, last_synced_at, created_at, updated_at")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    githubUserId: data.github_user_id,
    githubUsername: data.github_username,
    connectionStatus: data.connection_status,
    scopes: data.scopes || [],
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listGitHubCommits(
  params: CommitFilterParams = {}
): Promise<{ items: GitHubCommit[]; count: number }> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));

  let query = supabase
    .from("github_commits")
    .select(
      "id, user_id, github_connection_id, repository_id, repository_name, sha, message, commit_url, branch, author_date, source_status, synced_at",
      { count: "exact" }
    )
    .eq("user_id", user.userId);

  if (params.repository) {
    query = query.eq("repository_name", params.repository);
  }

  if (params.search) {
    query = query.ilike("message", `%${params.search}%`);
  }

  if (params.date) {
    const start = `${params.date}T00:00:00.000Z`;
    const end = `${params.date}T23:59:59.999Z`;
    query = query.gte("author_date", start).lte("author_date", end);
  }

  const { data, error, count } = await query
    .order("author_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    console.error("Error listing github commits:", error.message);
    return { items: [], count: 0 };
  }

  const items: GitHubCommit[] = (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    githubConnectionId: row.github_connection_id,
    repositoryId: row.repository_id,
    repositoryName: row.repository_name,
    sha: row.sha,
    message: row.message,
    commitUrl: row.commit_url,
    branch: row.branch,
    authorDate: row.author_date,
    sourceStatus: row.source_status,
    syncedAt: row.synced_at,
  }));

  return { items, count: count ?? items.length };
}

export async function listUserGitHubRepos(): Promise<string[]> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("github_commits")
    .select("repository_name")
    .eq("user_id", user.userId);

  if (error || !data) return [];

  const uniqueRepos = Array.from(new Set(data.map((d) => d.repository_name))).filter(Boolean);
  uniqueRepos.sort((a, b) => a.localeCompare(b));
  return uniqueRepos;
}
