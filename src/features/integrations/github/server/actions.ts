"use server";

import { syncGitHubCommits, type SyncCommitsResult } from "./sync-commits";
import { disconnectGitHub } from "./disconnect";
import { attachCommitEvidence, type AttachCommitResult } from "./attach-commit-evidence";
import type { AttachCommitInput } from "../schemas/github.schema";
import { listGitHubCommits } from "./queries";
import type { CommitFilterParams } from "../types";

export async function getGitHubCommitPage(params: CommitFilterParams = {}) {
  return listGitHubCommits(params);
}

export async function syncGitHubCommitsAction(targetRepo?: string): Promise<SyncCommitsResult> {
  return syncGitHubCommits(targetRepo);
}

export async function disconnectGitHubAction(): Promise<{ ok: boolean; message: string }> {
  return disconnectGitHub();
}

export async function attachCommitEvidenceAction(input: AttachCommitInput): Promise<AttachCommitResult> {
  return attachCommitEvidence(input);
}
