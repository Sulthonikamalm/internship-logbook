import type { StageCode } from "./types";

/**
 * Authoritative Server Transition Matrix.
 * Defines the strict, permitted stage-to-stage transitions for Todos.
 * Done is a dedicated completion action from any active stage. Evidence is
 * still enforced by the database for Magang and Tugas Akhir.
 */
export const ALLOWED_TRANSITIONS: Record<StageCode, StageCode[]> = {
  BACKLOG: ["TODO", "DONE"],
  TODO: ["BACKLOG", "IN_PROGRESS", "DONE"],
  IN_PROGRESS: ["TODO", "REVIEW", "DONE"],
  REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["REVIEW"], // Reopen
};

/**
 * Checks whether transitioning from `fromCode` to `toCode` is valid according to the matrix.
 */
export function isTransitionAllowed(
  fromCode: StageCode | string,
  toCode: StageCode | string
): boolean {
  if (fromCode === toCode) {
    return false; // Same stage is a reorder, not a transition
  }

  const allowedTargets = ALLOWED_TRANSITIONS[fromCode as StageCode];
  if (!allowedTargets) {
    return false;
  }

  return allowedTargets.includes(toCode as StageCode);
}

/**
 * Returns the list of permitted target stage codes from a given source stage code.
 */
export function getAllowedTargetStageCodes(fromCode: StageCode | string): StageCode[] {
  return ALLOWED_TRANSITIONS[fromCode as StageCode] ?? [];
}
