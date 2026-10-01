import type { EvidenceHealth, StageCode } from "./types";

/**
 * Computes evidence health for a Todo.
 * If a Todo is in DONE (or any stage requiring evidence) and has fewer
 * valid/available evidences than required, its health becomes EVIDENCE_INCOMPLETE.
 */
export function calculateEvidenceHealth(
  stageCode: StageCode | string,
  availableEvidenceCount: number,
  minimumRequired = 1
): EvidenceHealth {
  if ((stageCode === "DONE" || stageCode === "REVIEW") && availableEvidenceCount < minimumRequired) {
    return "EVIDENCE_INCOMPLETE";
  }

  return "OK";
}
