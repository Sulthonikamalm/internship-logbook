import { z } from "zod";

const draftSchema = z.object({
  title: z.string().max(160),
  description: z.string().max(10000),
  activityDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  source: z.enum(["manual", "quick_capture", "todo"]),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]),
  idempotencyKey: z.uuid(),
  savedAt: z.string(),
  baseVersion: z.number().int().min(1).optional(),
  todoId: z.uuid().optional(),
}).strict();

export type ActivityDraft = z.infer<typeof draftSchema>;
export const activityDraftKey = (userId: string, draftId: string) =>
  `internflow:draft:${userId}:activity:${draftId}`;

export function saveActivityDraft(userId: string, draftId: string, draft: ActivityDraft): boolean {
  if (typeof window === "undefined") return false;
  try {
    const parsed = draftSchema.parse(draft);
    localStorage.setItem(activityDraftKey(userId, draftId), JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function loadActivityDraft(userId: string, draftId: string): ActivityDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(activityDraftKey(userId, draftId));
    return raw ? draftSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function removeActivityDraft(userId: string, draftId: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(activityDraftKey(userId, draftId)); } catch { /* storage unavailable */ }
}
