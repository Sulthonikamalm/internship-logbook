export type TodoPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type EvidenceHealth = "OK" | "EVIDENCE_INCOMPLETE";

export type StageCode = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface TodoStage {
  id: string;
  code: StageCode;
  name: string;
  position: number;
  requiresEvidenceOnEnter: boolean;
  requiresEvidenceOnExit: boolean;
  minimumEvidenceCount: number;
  allowedEvidenceTypes: ("PHOTO" | "LINK")[] | null;
  requiresNote: boolean;
  isTerminal: boolean;
}

export interface TodoItem {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  dueDate: string | null;
  currentStageId: string;
  sortOrder: number;
  evidenceHealth: EvidenceHealth;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  evidenceCount?: number;
  activityCount?: number;
}

export interface TodoTransition {
  id: string;
  todoId: string;
  userId: string;
  fromStageId: string | null;
  toStageId: string;
  note: string | null;
  evidenceCount: number;
  idempotencyKey: string;
  createdAt: string;
  fromStageName?: string;
  toStageName?: string;
}

export interface TodoEvidenceItem {
  id: string;
  todoId: string;
  evidenceId: string;
  stageId: string | null;
  attachedAt: string;
  title: string | null;
  type: "PHOTO" | "LINK";
  status: string;
  url?: string | null;
}

export interface TodoRelatedActivity {
  id: string;
  title: string;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
}

export interface TodoDetailItem extends TodoItem {
  stage: TodoStage;
  evidences: TodoEvidenceItem[];
  activities: TodoRelatedActivity[];
  transitions: TodoTransition[];
}

export interface BoardData {
  stages: TodoStage[];
  todos: TodoItem[];
}
