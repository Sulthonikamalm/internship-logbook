export type GitHubConnectionStatus =
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "DISCONNECTED"
  | "ERROR";

export type GitHubCommitSourceStatus =
  | "AVAILABLE"
  | "SOURCE_UNAVAILABLE"
  | "STALE";

export interface GitHubConnection {
  id: string;
  userId: string;
  githubUserId: string;
  githubUsername: string;
  connectionStatus: GitHubConnectionStatus;
  scopes: string[];
  connectedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubCommit {
  id: string;
  userId: string;
  githubConnectionId: string;
  repositoryId: string;
  repositoryName: string;
  sha: string;
  message: string | null;
  commitUrl: string | null;
  branch: string | null;
  authorDate: string | null;
  sourceStatus: GitHubCommitSourceStatus;
  syncedAt: string;
}

export interface GitHubCommitEvidence {
  evidenceId: string;
  githubCommitId?: string | null;
  commitUrl: string;
  repositoryName: string;
  sha: string;
  message: string | null;
  authorDate: string | null;
}

export interface CommitFilterParams {
  repository?: string;
  search?: string;
  date?: string;
  page?: number;
  limit?: number;
}
