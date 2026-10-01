import type { ActivityStatus } from "@/features/activity/domain/types";
import type { EvidenceStatus, EvidenceType } from "@/features/evidence/domain/types";

export type WorkingDayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type InternshipSettings = {
  userId: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  workingDays: number[]; // ISO weekdays 1..7 (1=Mon, 7=Sun)
  createdAt: string;
  updatedAt: string;
};

export type LogbookEvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string | null;
  status: EvidenceStatus;
  thumbnailUrl?: string; // e.g. /api/media/evidence/{id}?thumb=1
  url?: string; // external safe URL for LINK
  note?: string | null;
};

export type LogbookRow = {
  id: string;
  activityDate: string; // YYYY-MM-DD
  startTime: string | null; // HH:mm:ss or HH:mm
  endTime: string | null; // HH:mm:ss or HH:mm
  title: string;
  description: string | null;
  source: string;
  status: ActivityStatus;
  needsDescription: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  linkCount: number;
  brokenCount: number;
  totalEvidenceCount: number;
  evidences: LogbookEvidenceItem[];
};

export type FilterPreset = "today" | "week" | "month" | "custom";
export type EvidenceTypeFilter = "all" | "photo" | "link" | "github" | "none";

export type LogbookFilterInput = {
  preset?: string;
  from?: string;
  to?: string;
  month?: string; // YYYY-MM
  q?: string;
  evidenceType?: string;
  page?: number | string;
  pageSize?: number | string;
};

export type NormalizedLogbookFilters = {
  preset: FilterPreset;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  q: string;
  evidenceType: EvidenceTypeFilter;
  page: number;
  pageSize: number;
  fieldError?: {
    field: "from" | "to" | "month";
    message: string;
  };
};

export type MissingDayItem = {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 1..7
  dayName: string; // "Senin", "Selasa", etc.
  formattedDate: string; // "12 Okt 2026"
  hasDraft: boolean;
  draftActivityId?: string;
};

export type MissingDaySummary = {
  enabled: boolean;
  reason?: "NO_SETTINGS" | "RANGE_INVALID";
  startDate: string | null;
  endDate: string | null;
  totalWorkdays: number;
  loggedWorkdays: number;
  missingCount: number;
  draftCount: number;
  missingDays: MissingDayItem[];
};
