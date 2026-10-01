import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SyncCommitsResult {
  ok: boolean;
  code?: "SUCCESS" | "NOT_CONNECTED" | "REAUTH_REQUIRED" | "RATE_LIMITED" | "SYNC_ERROR";
  message: string;
  syncedCount?: number;
}

export async function syncGitHubCommits(targetRepo?: string): Promise<SyncCommitsResult> {
  const user = await requireActiveUser();
  const userClient = await createClient();
  const adminClient = createAdminClient();

  // 1. Check connection
  const { data: connection } = await userClient
    .from("github_connections")
    .select("id, github_user_id, github_username, connection_status")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!connection || connection.connection_status === "DISCONNECTED") {
    return {
      ok: false,
      code: "NOT_CONNECTED",
      message: "Akun GitHub belum terhubung. Silakan hubungkan akun terlebih dahulu.",
    };
  }

  // 2. Fetch token via admin client
  const { data: tokenRecord } = await adminClient
    .from("github_tokens")
    .select("access_token")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!tokenRecord?.access_token) {
    await userClient
      .from("github_connections")
      .update({ connection_status: "REAUTH_REQUIRED", updated_at: new Date().toISOString() })
      .eq("user_id", user.userId);

    return {
      ok: false,
      code: "REAUTH_REQUIRED",
      message: "Token otorisasi GitHub tidak ditemukan. Silakan hubungkan ulang akun GitHub.",
    };
  }

  const accessToken = tokenRecord.access_token;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "InternFlow-Logbook",
  };

  try {
    // 3. Fetch user repositories (capped to 15 recent repos)
    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=15&type=all", {
      headers,
    });

    if (reposRes.status === 401) {
      await userClient
        .from("github_connections")
        .update({ connection_status: "REAUTH_REQUIRED", updated_at: new Date().toISOString() })
        .eq("user_id", user.userId);

      return {
        ok: false,
        code: "REAUTH_REQUIRED",
        message: "Akses GitHub dicabut atau kedaluwarsa. Silakan hubungkan ulang akun.",
      };
    }

    if (reposRes.status === 403 || reposRes.status === 429) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Sinkronisasi GitHub sementara dibatasi. Data sinkronisasi terakhir tetap tersedia.",
      };
    }

    if (!reposRes.ok) {
      return {
        ok: false,
        code: "SYNC_ERROR",
        message: `Gagal memuat repositori GitHub (${reposRes.status}).`,
      };
    }

    const reposData = await reposRes.json();
    if (!Array.isArray(reposData)) {
      return { ok: false, code: "SYNC_ERROR", message: "Respon repositori tidak valid." };
    }

    // Filter if targetRepo specified
    const targetRepos = targetRepo
      ? reposData.filter((r) => r.full_name.toLowerCase() === targetRepo.toLowerCase())
      : reposData.slice(0, 10);

    const commitsToUpsert: Array<{
      user_id: string;
      github_connection_id: string;
      repository_id: string;
      repository_name: string;
      sha: string;
      message: string | null;
      commit_url: string | null;
      branch: string | null;
      author_date: string | null;
      source_status: "AVAILABLE";
      synced_at: string;
    }> = [];

    const now = new Date().toISOString();

    // 4. For each repo, fetch user's recent authored commits
    for (const repo of targetRepos) {
      try {
        const commitsUrl = `https://api.github.com/repos/${repo.full_name}/commits?author=${encodeURIComponent(
          connection.github_username
        )}&per_page=20`;

        const commitsRes = await fetch(commitsUrl, { headers });

        if (commitsRes.status === 401) {
          await userClient
            .from("github_connections")
            .update({ connection_status: "REAUTH_REQUIRED", updated_at: now })
            .eq("user_id", user.userId);
          return {
            ok: false,
            code: "REAUTH_REQUIRED",
            message: "Akses GitHub dicabut atau kedaluwarsa.",
          };
        }

        if (commitsRes.status === 403 || commitsRes.status === 429) {
          // Rate limit reached during commit sync - stop querying further repos but upsert what we have
          break;
        }

        if (!commitsRes.ok) {
          // Skip inaccessible repo
          continue;
        }

        const commitsData = await commitsRes.json();
        if (Array.isArray(commitsData)) {
          for (const item of commitsData) {
            if (item.sha) {
              commitsToUpsert.push({
                user_id: user.userId,
                github_connection_id: connection.id,
                repository_id: String(repo.id),
                repository_name: repo.full_name,
                sha: item.sha,
                message: item.commit?.message?.slice(0, 2000) || null,
                commit_url: item.html_url || null,
                branch: repo.default_branch || "main",
                author_date:
                  item.commit?.author?.date || item.commit?.committer?.date || now,
                source_status: "AVAILABLE",
                synced_at: now,
              });
            }
          }
        }
      } catch {
        // Continue on single repo error
      }
    }

    // 5. Batch upsert commits idempotently
    if (commitsToUpsert.length > 0) {
      const { error: upsertErr } = await userClient
        .from("github_commits")
        .upsert(commitsToUpsert, {
          onConflict: "user_id,repository_id,sha",
        });

      if (upsertErr) {
        console.error("Failed to upsert commits:", upsertErr.message);
      }
    }

    // 6. Update last_synced_at on connection
    await userClient
      .from("github_connections")
      .update({
        last_synced_at: now,
        connection_status: "CONNECTED",
        updated_at: now,
      })
      .eq("user_id", user.userId);

    return {
      ok: true,
      code: "SUCCESS",
      syncedCount: commitsToUpsert.length,
      message: `Berhasil menyinkronkan ${commitsToUpsert.length} commit dari GitHub.`,
    };
  } catch (error) {
    return {
      ok: false,
      code: "SYNC_ERROR",
      message: error instanceof Error ? error.message : "Sinkronisasi gagal dilakukan.",
    };
  }
}
