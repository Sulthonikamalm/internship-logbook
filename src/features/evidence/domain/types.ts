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

export function evidenceDto(row: Evidence & {
  photo_evidences?: { mime_type: string; size_bytes: number; width: number | null; height: number | null }[];
  link_evidences?: { url: string }[];
  github_evidences?: { commit_url: string; repository_name: string; sha: string; message: string | null; author_date?: string | null }[];
  activity_evidences?: { activity_id: string }[];
}): SafeEvidence {
  const photo = row.photo_evidences?.[0];
  const gh = row.github_evidences?.[0];
  return { id: row.id, type: row.type, title: row.title, note: row.note,
    status: row.status, capturedAt: row.captured_at, createdAt: row.created_at,
    mimeType: photo?.mime_type, sizeBytes: photo?.size_bytes,
    width: photo?.width ?? undefined, height: photo?.height ?? undefined,
    url: row.link_evidences?.[0]?.url || gh?.commit_url,
    githubCommit: gh ? {
      commitUrl: gh.commit_url,
      repositoryName: gh.repository_name,
      sha: gh.sha,
      message: gh.message,
      authorDate: gh.author_date,
    } : undefined,
    assignmentCount: row.activity_evidences?.length ?? 0 };
}
