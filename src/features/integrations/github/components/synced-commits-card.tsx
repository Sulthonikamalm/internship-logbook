"use client";
import type { GitHubCommit } from "../types";
import { CommitList } from "./commit-picker";
export function SyncedCommitsCard({ commits, count = commits.length }: { commits: GitHubCommit[]; repos?: string[]; count?: number }) {
  return <section className="surface p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Commit tersimpan</h2><span className="text-xs text-muted-foreground">{count} commit</span></div><CommitList showIntegrationLink={false} initialItems={commits} initialCount={count} /></section>;
}
