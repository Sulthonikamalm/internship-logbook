export type ActivityStatus = "DRAFT" | "READY" | "ARCHIVED";
export type ActivitySource = "manual" | "quick_capture" | "todo";

export type Activity = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  activity_date: string;
  start_time: string | null;
  end_time: string | null;
  source: ActivitySource;
  status: ActivityStatus;
  needs_description: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  todo_id?: string | null;
};

export type ActivityActionResult =
  | { ok: true; activity: Activity }
  | { ok: false; code: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND_OR_FORBIDDEN" | "INTERNAL_ERROR"; message: string; fields?: Record<string, string> };
