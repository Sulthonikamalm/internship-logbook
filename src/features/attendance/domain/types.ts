export type AttendanceSession = {
  id: string;
  user_id: string;
  work_date: string;
  timezone: string;
  started_at: string;
  auto_close_at: string;
  ended_at: string | null;
  auto_closed: boolean;
  created_at: string;
};

export type AttendanceActionResult =
  | { ok: true; session: AttendanceSession }
  | { ok: false; message: string };

export type AttendanceHistoryResult = {
  sessions: AttendanceSession[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  asOf: string;
};
