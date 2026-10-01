"use server";

import { syncGitHubCommits, type SyncCommitsResult } from "./sync-commits";
import { disconnectGitHub } from "./disconnect";
import { attachCommitEvidence, type AttachCommitResult } from "./attach-commit-evidence";
import type { AttachCommitInput } from "../schemas/github.schema";

export async function syncGitHubCommitsAction(targetRepo?: string): Promise<SyncCommitsResult> {
  return syncGitHubCommits(targetRepo);
}

export async function disconnectGitHubAction(): Promise<{ ok: boolean; message: string }> {
  return disconnectGitHub();
}

export async function attachCommitEvidenceAction(input: AttachCommitInput): Promise<AttachCommitResult> {
  return attachCommitEvidence(input);
}
