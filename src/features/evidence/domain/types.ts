export type EvidenceStatus = "UPLOADING" | "AVAILABLE" | "FAILED" | "ORPHANED"
  | "BROKEN" | "DELETE_PENDING" | "DELETED";
export type EvidenceType = "PHOTO" | "LINK" | "GITHUB_COMMIT";
export type Evidence = {
  id: string; user_id: string; type: EvidenceType; title: string | null;
  note: string | null; status: EvidenceStatus; captured_at: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
};
export type SafeEvidence = {
  id: string; type: EvidenceType; title: string | null; note: string | null;
  status: EvidenceStatus; capturedAt: string | null; createdAt: string;
  mimeType?: string; sizeBytes?: number; width?: number; height?: number;
  url?: string; assignmentCount: number;
  githubCommit?: {
    commitUrl: string;
    repositoryName: string;
    sha: string;
    message: string | null;
    authorDate?: string | null;
  };
};
