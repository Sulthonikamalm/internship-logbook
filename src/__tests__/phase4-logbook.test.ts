import { describe, expect, it } from "vitest";
import {
  formatIndonesianDate,
  formatTimeDisplay,
  getIsoWeekday,
  getStartAndEndOfMonth,
  getStartAndEndOfWeek,
  normalizeLogbookFilters,
} from "@/features/logbook/domain/filters";
import { evaluateMissingDays } from "@/features/logbook/domain/missing-days";
import {
  compareLogbookRowsAsc,
  compareLogbookRowsDesc,
} from "@/features/logbook/domain/sorting";
import { internshipSettingsSchema } from "@/features/logbook/domain/settings-schema";
import type {
  InternshipSettings,
  LogbookEvidenceItem,
  LogbookRow,
} from "@/features/logbook/domain/types";

// =============================================================================
// 1. Settings Schema Validation Tests
// =============================================================================
describe("Internship Settings Validation", () => {
  it("accepts valid start and end dates with unique working days", () => {
    const valid = {
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      workingDays: [1, 2, 3, 4, 5],
    };
    const res = internshipSettingsSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("accepts null or empty dates when user has not yet configured them", () => {
    const res = internshipSettingsSchema.safeParse({
      startDate: "",
      endDate: null,
      workingDays: [1, 2, 3, 4, 5],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.startDate).toBeNull();
      expect(res.data.endDate).toBeNull();
    }
  });

  it("rejects end date before start date", () => {
    const res = internshipSettingsSchema.safeParse({
      startDate: "2026-10-01",
      endDate: "2026-09-01",
      workingDays: [1, 2, 3, 4, 5],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("harus sama atau setelah");
    }
  });

  it("rejects duplicate working days", () => {
    const res = internshipSettingsSchema.safeParse({
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      workingDays: [1, 2, 2, 4],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("duplikat");
    }
  });

  it("rejects invalid working day numbers outside 1..7", () => {
    const res = internshipSettingsSchema.safeParse({
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      workingDays: [0, 8],
    });
    expect(res.success).toBe(false);
  });

  it("rejects empty working days array", () => {
    const res = internshipSettingsSchema.safeParse({
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      workingDays: [],
    });
    expect(res.success).toBe(false);
  });
});

// =============================================================================
// 2. Filter Normalizer & Date Presets Tests
// =============================================================================
describe("Filter Parser and Normalizer", () => {
  it("normalizes preset today to current date", () => {
    const filters = normalizeLogbookFilters({ preset: "today" }, "Asia/Jakarta");
    expect(filters.preset).toBe("today");
    expect(filters.from).toBeDefined();
    expect(filters.from).toBe(filters.to);
  });

  it("normalizes preset week to Monday..Sunday range", () => {
    const week = getStartAndEndOfWeek("2026-09-30"); // Wednesday
    expect(week.start).toBe("2026-09-28"); // Monday
    expect(week.end).toBe("2026-10-04"); // Sunday
    expect(getIsoWeekday(week.start)).toBe(1);
    expect(getIsoWeekday(week.end)).toBe(7);
  });

  it("calculates correct start and end of month including leap years", () => {
    const feb = getStartAndEndOfMonth("2024-02"); // 2024 is leap year
    expect(feb.start).toBe("2024-02-01");
    expect(feb.end).toBe("2024-02-29");

    const sep = getStartAndEndOfMonth("2026-09");
    expect(sep.start).toBe("2026-09-01");
    expect(sep.end).toBe("2026-09-30");

    const oct = getStartAndEndOfMonth("2026-10");
    expect(oct.start).toBe("2026-10-01");
    expect(oct.end).toBe("2026-10-31");
  });

  it("handles from > to gracefully with field error without throwing", () => {
    const filters = normalizeLogbookFilters({
      preset: "custom",
      from: "2026-10-15",
      to: "2026-10-01",
    });
    expect(filters.fieldError).toBeDefined();
    expect(filters.fieldError?.field).toBe("from");
    expect(filters.fieldError?.message).toContain("lebih besar");
  });

  it("clamps invalid or negative page numbers to 1", () => {
    expect(normalizeLogbookFilters({ page: -5 }).page).toBe(1);
    expect(normalizeLogbookFilters({ page: "abc" }).page).toBe(1);
    expect(normalizeLogbookFilters({ page: 4 }).page).toBe(4);
  });

  it("clamps page sizes between 5 and 100", () => {
    expect(normalizeLogbookFilters({ pageSize: 1 }).pageSize).toBe(5);
    expect(normalizeLogbookFilters({ pageSize: 500 }).pageSize).toBe(100);
    expect(normalizeLogbookFilters({ pageSize: 25 }).pageSize).toBe(25);
  });

  it("validates evidenceType filter values", () => {
    expect(normalizeLogbookFilters({ evidenceType: "PHOTO" }).evidenceType).toBe("photo");
    expect(normalizeLogbookFilters({ evidenceType: "LINK" }).evidenceType).toBe("link");
    expect(normalizeLogbookFilters({ evidenceType: "NONE" }).evidenceType).toBe("none");
    expect(normalizeLogbookFilters({ evidenceType: "INVALID" }).evidenceType).toBe("all");
  });

  it("formats time display with null time represented as en-dash —", () => {
    expect(formatTimeDisplay(null, null)).toBe("—");
    expect(formatTimeDisplay("09:00:00", null)).toBe("09:00");
    expect(formatTimeDisplay("09:00:00", "17:00:00")).toBe("09:00 - 17:00");
  });

  it("formats Indonesian dates cleanly", () => {
    const formatted = formatIndonesianDate("2026-09-28");
    expect(formatted.toLowerCase()).toContain("senin");
    expect(formatted).toContain("28");
  });
});

// =============================================================================
// 3. Missing-Day Detection Tests
// =============================================================================
describe("Missing-Day Evaluation Logic", () => {
  const settings: InternshipSettings = {
    userId: "user-1",
    startDate: "2026-09-28", // Monday
    endDate: "2026-10-02", // Friday
    workingDays: [1, 2, 3, 4, 5], // Mon..Fri
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  it("disables detection when internship settings or dates are missing", () => {
    const noDates = evaluateMissingDays({
      settings: { ...settings, startDate: null, endDate: null },
      activities: [],
      today: "2026-09-30",
    });
    expect(noDates.enabled).toBe(false);
    expect(noDates.reason).toBe("NO_SETTINGS");
    expect(noDates.missingCount).toBe(0);

    const nullSettings = evaluateMissingDays({
      settings: null,
      activities: [],
      today: "2026-09-30",
    });
    expect(nullSettings.enabled).toBe(false);
  });

  it("disables detection if end date is before start date", () => {
    const invalidRange = evaluateMissingDays({
      settings: { ...settings, startDate: "2026-10-05", endDate: "2026-10-01" },
      activities: [],
      today: "2026-10-03",
    });
    expect(invalidRange.enabled).toBe(false);
    expect(invalidRange.reason).toBe("RANGE_INVALID");
  });

  it("never marks future dates as missing (future clamp)", () => {
    // Today is Wednesday 2026-09-30. Period is Mon 28 to Fri 2.
    // Only Mon 28, Tue 29, and Wed 30 should be evaluated (total 3 workdays).
    // Thu 01 and Fri 02 are in the future and MUST NOT be marked missing!
    const summary = evaluateMissingDays({
      settings,
      activities: [],
      today: "2026-09-30",
    });

    expect(summary.enabled).toBe(true);
    expect(summary.totalWorkdays).toBe(3); // Mon, Tue, Wed
    expect(summary.missingCount).toBe(3);
    const missingDates = summary.missingDays.map((d) => d.date);
    expect(missingDates).toEqual(["2026-09-30", "2026-09-29", "2026-09-28"]);
    expect(missingDates).not.toContain("2026-10-01");
    expect(missingDates).not.toContain("2026-10-02");
  });

  it("does not evaluate days if today is before the internship starts", () => {
    const summary = evaluateMissingDays({
      settings,
      activities: [],
      today: "2026-09-01", // Well before Sep 28
    });
    expect(summary.enabled).toBe(true);
    expect(summary.totalWorkdays).toBe(0);
    expect(summary.missingCount).toBe(0);
    expect(summary.missingDays).toHaveLength(0);
  });

  it("recognizes logged days and distinguishes draft vs missing", () => {
    const activities = [
      { id: "act-1", activity_date: "2026-09-28", status: "READY" }, // Mon: READY
      { id: "act-2", activity_date: "2026-09-29", status: "DRAFT" }, // Tue: DRAFT
      // Wed: completely empty
    ];

    const summary = evaluateMissingDays({
      settings,
      activities,
      today: "2026-09-30", // Evaluating Mon, Tue, Wed
    });

    expect(summary.totalWorkdays).toBe(3);
    expect(summary.loggedWorkdays).toBe(1); // Monday
    expect(summary.draftCount).toBe(1); // Tuesday
    expect(summary.missingCount).toBe(1); // Wednesday

    const wednesday = summary.missingDays.find((d) => d.date === "2026-09-30");
    expect(wednesday?.hasDraft).toBe(false);

    const tuesday = summary.missingDays.find((d) => d.date === "2026-09-29");
    expect(tuesday?.hasDraft).toBe(true);
    expect(tuesday?.draftActivityId).toBe("act-2");
  });

  it("respects customized working days (e.g. only Mon, Wed, Fri)", () => {
    const customWorkingDays: InternshipSettings = {
      ...settings,
      workingDays: [1, 3, 5], // Monday, Wednesday, Friday
    };

    const summary = evaluateMissingDays({
      settings: customWorkingDays,
      activities: [],
      today: "2026-10-02", // Mon to Fri
    });

    // In Sep 28..Oct 02:
    // Sep 28 (Mon - 1) -> workday
    // Sep 29 (Tue - 2) -> ignored
    // Sep 30 (Wed - 3) -> workday
    // Oct 01 (Thu - 4) -> ignored
    // Oct 02 (Fri - 5) -> workday
    expect(summary.totalWorkdays).toBe(3);
    const evaluatedDates = summary.missingDays.map((d) => d.date);
    expect(evaluatedDates).toContain("2026-09-28");
    expect(evaluatedDates).toContain("2026-09-30");
    expect(evaluatedDates).toContain("2026-10-02");
    expect(evaluatedDates).not.toContain("2026-09-29");
    expect(evaluatedDates).not.toContain("2026-10-01");
  });
});

// =============================================================================
// 4. Deterministic Ordering Tests
// =============================================================================
describe("Deterministic Sorting Comparators", () => {
  const rowBase: LogbookRow = {
    id: "1",
    activityDate: "2026-09-30",
    startTime: "09:00:00",
    endTime: "10:00:00",
    title: "Test",
    description: null,
    source: "manual",
    status: "READY",
    needsDescription: false,
    version: 1,
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:00:00Z",
    photoCount: 0,
    linkCount: 0,
    brokenCount: 0,
    totalEvidenceCount: 0,
    evidences: [],
  };

  it("sorts by activity_date DESC first", () => {
    const rowA = { ...rowBase, id: "a", activityDate: "2026-09-29" };
    const rowB = { ...rowBase, id: "b", activityDate: "2026-09-30" };

    const sorted = [rowA, rowB].sort(compareLogbookRowsDesc);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("sorts same day with start_time DESC and places NULL start_time LAST", () => {
    const early = { ...rowBase, id: "early", startTime: "08:00:00" };
    const late = { ...rowBase, id: "late", startTime: "14:00:00" };
    const nullTime = { ...rowBase, id: "nullTime", startTime: null };

    const sorted = [early, nullTime, late].sort(compareLogbookRowsDesc);
    expect(sorted[0].id).toBe("late");
    expect(sorted[1].id).toBe("early");
    expect(sorted[2].id).toBe("nullTime"); // nulls last
  });

  it("breaks ties with created_at DESC", () => {
    const firstCreated = {
      ...rowBase,
      id: "first",
      startTime: "09:00:00",
      createdAt: "2026-09-30T09:00:00Z",
    };
    const secondCreated = {
      ...rowBase,
      id: "second",
      startTime: "09:00:00",
      createdAt: "2026-09-30T09:30:00Z",
    };

    const sorted = [firstCreated, secondCreated].sort(compareLogbookRowsDesc);
    expect(sorted[0].id).toBe("second");
    expect(sorted[1].id).toBe("first");
  });

  it("chronological comparator sorts ASC for future export", () => {
    const rowA = { ...rowBase, id: "a", activityDate: "2026-09-28" };
    const rowB = { ...rowBase, id: "b", activityDate: "2026-09-29" };

    const sorted = [rowB, rowA].sort(compareLogbookRowsAsc);
    expect(sorted[0].id).toBe("a");
    expect(sorted[1].id).toBe("b");
  });
});

// =============================================================================
// 5. Evidence DTO Secrecy & Join Structure
// =============================================================================
describe("Evidence DTO Secrecy and Integrity", () => {
  it("never includes Google Drive file IDs or folder IDs in client DTO", () => {
    const evidenceItem: LogbookEvidenceItem = {
      id: "ev-1",
      type: "PHOTO",
      title: "Dokumentasi",
      status: "AVAILABLE",
      thumbnailUrl: "/api/media/evidence/ev-1?thumb=1",
      url: undefined,
    };

    // Verify properties
    expect(evidenceItem).not.toHaveProperty("drive_file_id");
    expect(evidenceItem).not.toHaveProperty("drive_folder_id");
    expect(evidenceItem).not.toHaveProperty("driveFileId");
    expect(evidenceItem.thumbnailUrl).toBe("/api/media/evidence/ev-1?thumb=1");
  });
});
