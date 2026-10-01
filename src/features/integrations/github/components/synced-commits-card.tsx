"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitCommit,
  ExternalLink,
  Search,
  Filter,
  Check,
  Plus,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GitHubCommit } from "../types";
import { attachCommitEvidenceAction } from "../server/actions";

export function SyncedCommitsCard({
  commits,
  repos,
}: {
  commits: GitHubCommit[];
  repos: string[];
}) {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [attachingSha, setAttachingSha] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ sha: string; text: string; success: boolean } | null>(
    null
  );

  const filteredCommits = commits.filter((c) => {
    if (selectedRepo && c.repositoryName !== selectedRepo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inMsg = (c.message || "").toLowerCase().includes(q);
      const inSha = c.sha.toLowerCase().includes(q);
      const inRepo = c.repositoryName.toLowerCase().includes(q);
      if (!inMsg && !inSha && !inRepo) return false;
    }
    return true;
  });

  const handleConvertEvidence = async (commit: GitHubCommit) => {
    setAttachingSha(commit.sha);
    setFeedback(null);

    try {
      const res = await attachCommitEvidenceAction({
        commitId: commit.id,
        repositoryName: commit.repositoryName,
        sha: commit.sha,
        commitUrl: commit.commitUrl || `https://github.com/${commit.repositoryName}/commit/${commit.sha}`,
        message: commit.message,
        authorDate: commit.authorDate,
      });

      if (res.ok) {
        setFeedback({
          sha: commit.sha,
          text: res.message || "Tersimpan sebagai Evidence!",
          success: true,
        });
        router.refresh();
      } else {
        setFeedback({
          sha: commit.sha,
          text: res.message || "Gagal menyimpan Evidence.",
          success: false,
        });
      }
    } catch {
      setFeedback({
        sha: commit.sha,
        text: "Terjadi kesalahan sistem.",
        success: false,
      });
    } finally {
      setAttachingSha(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <GitCommit className="h-5 w-5 text-primary" />
            <span>Riwayat Commit Tersinkronisasi ({filteredCommits.length})</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar commit yang telah disinkronkan dari akun GitHub Anda. Klik &quot;Jadikan Evidence&quot; untuk
            mengubah commit menjadi berkas bukti resmi.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {repos.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="">Semua Repositori ({repos.length})</option>
                {repos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative min-w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pesan / SHA..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Commits List */}
      {filteredCommits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
          <GitCommit className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">Tidak ada commit yang ditemukan</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {commits.length === 0
              ? "Klik tombol 'Sinkronkan' di atas untuk memuat riwayat commit terbaru dari repositori GitHub Anda."
              : "Tidak ada commit yang cocok dengan filter pencarian saat ini."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
          {filteredCommits.map((commit) => {
            const isAttaching = attachingSha === commit.sha;
            const currentFeedback = feedback?.sha === commit.sha ? feedback : null;

            return (
              <div
                key={commit.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {commit.repositoryName}
                    </span>
                    <a
                      href={
                        commit.commitUrl ||
                        `https://github.com/${commit.repositoryName}/commit/${commit.sha}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {commit.sha.slice(0, 7)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {commit.branch && (
                      <span className="text-[10px] text-muted-foreground">
                        branch: {commit.branch}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-foreground font-medium line-clamp-1 break-words">
                    {commit.message?.split("\n")[0] || "No commit message"}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {commit.authorDate
                        ? new Date(commit.authorDate).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Waktu tidak diketahui"}
                    </span>
                    <span>• Status: {commit.sourceStatus}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {currentFeedback && (
                    <span
                      className={`text-xs font-medium inline-flex items-center gap-1 ${
                        currentFeedback.success ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {currentFeedback.success ? <Check className="h-3.5 w-3.5" /> : null}
                      {currentFeedback.text}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleConvertEvidence(commit)}
                    disabled={isAttaching}
                    className="h-8 text-xs gap-1.5"
                  >
                    {isAttaching ? (
                      <Layers className="h-3.5 w-3.5 animate-pulse" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>{isAttaching ? "Menyimpan..." : "Jadikan Evidence"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
