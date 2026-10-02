import type { TodoStage } from "./types";
export type StageRow = { id: string; code: TodoStage["code"]; name: string; position: number; requires_evidence_on_enter: boolean; requires_evidence_on_exit: boolean; minimum_evidence_count: number; allowed_evidence_types: TodoStage["allowedEvidenceTypes"]; requires_note: boolean; is_terminal: boolean };
export function toTodoStage(row: StageRow): TodoStage {
  return { id: row.id, code: row.code, name: row.name, position: row.position, requiresEvidenceOnEnter: row.requires_evidence_on_enter, requiresEvidenceOnExit: row.requires_evidence_on_exit, minimumEvidenceCount: row.minimum_evidence_count, allowedEvidenceTypes: row.allowed_evidence_types, requiresNote: row.requires_note, isTerminal: row.is_terminal };
}
