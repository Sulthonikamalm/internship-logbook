import { beforeEach, describe, expect, it } from "vitest";
import { localDateAt, maxActivityDate, resolveActivityDate } from "@/features/activity/domain/date";
import { activityFieldsSchema, createActivitySchema, updateActivitySchema } from "@/features/activity/schemas/activity";
import { activityDraftKey, loadActivityDraft, removeActivityDraft, saveActivityDraft } from "@/features/activity/domain/draft";

const fields = {
  title: "Membuat laporan", description: "", activityDate: "2026-09-30",
  startTime: "09:00", endTime: "10:00", source: "manual", status: "DRAFT",
};

describe("Activity date and time rules", () => {
  it("uses the profile timezone across WIB midnight", () => {
    expect(localDateAt(new Date("2026-09-30T16:59:59Z"), "Asia/Jakarta")).toBe("2026-09-30");
    expect(localDateAt(new Date("2026-09-30T17:00:00Z"), "Asia/Jakarta")).toBe("2026-10-01");
    expect(resolveActivityDate(undefined, "Asia/Jakarta", new Date("2026-09-30T17:00:00Z")))
      .toBe("2026-10-01");
  });
  it("allows up to seven future days and past dates", () => {
    expect(maxActivityDate("2026-09-30")).toBe("2026-10-07");
    expect(resolveActivityDate("2026-10-07", "Asia/Jakarta", new Date("2026-09-30T10:00:00Z")))
      .toBe("2026-10-07");
    expect(resolveActivityDate("2020-01-01", "Asia/Jakarta", new Date("2026-09-30T10:00:00Z")))
      .toBe("2020-01-01");
    expect(() => resolveActivityDate("2026-10-08", "Asia/Jakarta", new Date("2026-09-30T10:00:00Z")))
      .toThrow("maksimal 7 hari");
    expect(() => resolveActivityDate("2026-02-30", "Asia/Jakarta")).toThrow("tidak valid");
  });
  it("rejects blank title, end without start, and overnight time", () => {
    expect(activityFieldsSchema.safeParse({ ...fields, title: "   " }).success).toBe(false);
    expect(activityFieldsSchema.safeParse({ ...fields, startTime: "" }).success).toBe(false);
    expect(activityFieldsSchema.safeParse({ ...fields, startTime: "22:00", endTime: "01:00" }).success).toBe(false);
    expect(activityFieldsSchema.safeParse({ ...fields, startTime: "09:00", endTime: "09:00" }).success).toBe(true);
  });
  it("rejects forged owner and unknown fields", () => {
    const key = "00000000-0000-4000-8000-000000000001";
    expect(createActivitySchema.safeParse({ ...fields, idempotencyKey: key, user_id: "forged" }).success)
      .toBe(false);
    expect(createActivitySchema.safeParse({ ...fields, idempotencyKey: key }).success).toBe(true);
  });
  it("requires a valid date and expected version when editing", () => {
    expect(updateActivitySchema.safeParse({ ...fields, expectedVersion: 2 }).success).toBe(true);
    expect(updateActivitySchema.safeParse({ ...fields, activityDate: undefined, expectedVersion: 2 }).success)
      .toBe(false);
    expect(updateActivitySchema.safeParse({ ...fields, expectedVersion: 0 }).success).toBe(false);
  });
});

describe("User-scoped activity draft", () => {
  beforeEach(() => localStorage.clear());
  const draft = {
    title: "Draf", description: "", activityDate: "2026-09-30", startTime: "", endTime: "",
    source: "quick_capture" as const, status: "DRAFT" as const,
    idempotencyKey: "00000000-0000-4000-8000-000000000001", savedAt: "2026-09-30T10:00:00Z",
  };
  it("restores only for the same user and keeps retry key", () => {
    expect(saveActivityDraft("user-a", "quick", draft)).toBe(true);
    expect(loadActivityDraft("user-a", "quick")?.idempotencyKey).toBe(draft.idempotencyKey);
    expect(loadActivityDraft("user-b", "quick")).toBeNull();
    removeActivityDraft("user-a", "quick");
    expect(loadActivityDraft("user-a", "quick")).toBeNull();
  });
  it("does not restore malformed or secret-bearing payload", () => {
    localStorage.setItem(activityDraftKey("user-a", "new"), JSON.stringify({ ...draft, token: "secret" }));
    expect(loadActivityDraft("user-a", "new")).toBeNull();
  });
});
