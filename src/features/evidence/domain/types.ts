export type EvidenceStatus = "UPLOADING" | "AVAILABLE" | "FAILED" | "ORPHANED"
  | "BROKEN" | "DELETE_PENDING" | "DELETED";
export type EvidenceType = "PHOTO" | "LINK";
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
};

export function evidenceDto(row: Evidence & {
  photo_evidences?: { mime_type: string; size_bytes: number; width: number | null; height: number | null }[];
  link_evidences?: { url: string }[];
  activity_evidences?: { activity_id: string }[];
}): SafeEvidence {
  const photo = row.photo_evidences?.[0];
  return { id: row.id, type: row.type, title: row.title, note: row.note,
    status: row.status, capturedAt: row.captured_at, createdAt: row.created_at,
    mimeType: photo?.mime_type, sizeBytes: photo?.size_bytes,
    width: photo?.width ?? undefined, height: photo?.height ?? undefined,
    url: row.link_evidences?.[0]?.url,
    assignmentCount: row.activity_evidences?.length ?? 0 };
}
