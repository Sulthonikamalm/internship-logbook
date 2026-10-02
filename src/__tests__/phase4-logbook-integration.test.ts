/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const testUser = {
  userId: "00000000-0000-4000-8000-0000000000a4",
  email: "phase4@example.invalid",
  role: "intern",
  displayName: "Intern Phase 4",
  timezone: "Asia/Jakarta",
  isActive: true,
};

const fakeDb = vi.hoisted(() => ({
  activities: [] as any[],
  evidences: [] as any[],
  activityEvidences: [] as any[],
  settings: null as any,
  calls: {
    logbookQueryUsers: [] as string[],
    activityFilters: [] as any[],
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveUser: async () => testUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, params: { p_from: string; p_to: string }) => {
      if (name !== "get_activity_days") throw new Error("Unexpected RPC");
      const dates = new Map<string, { activity_date: string; has_ready: boolean; draft_id: string | null }>();
      for (const row of fakeDb.activities) {
        if (row.user_id !== testUser.userId || row.deleted_at || row.activity_date < params.p_from || row.activity_date > params.p_to) continue;
        const day = dates.get(row.activity_date) ?? { activity_date: row.activity_date, has_ready: false, draft_id: null };
        if (row.status === "READY" || row.status === "ARCHIVED") day.has_ready = true;
        if (row.status === "DRAFT") day.draft_id ??= row.id;
        dates.set(row.activity_date, day);
      }
      return { data: [...dates.values()], error: null };
    },
    from: (table: string) => {
      let isHead = false;
      const filters: { type: string; field: string; value?: any }[] = [];
      let rangeLimit: { start: number; end: number } | null = null;

      const chain: any = {
        select: (_?: unknown, options?: { count?: string; head?: boolean }) => {
          if (options?.head) isHead = true;
          return chain;
        },
        eq: (field: string, val: any) => {
          filters.push({ type: "eq", field, value: val });
          if (table === "logbook_activities" && field === "user_id") {
            fakeDb.calls.logbookQueryUsers.push(val);
          }
          return chain;
        },
        neq: (field: string, val: any) => {
          filters.push({ type: "neq", field, value: val });
          return chain;
        },
        is: (field: string, val: any) => {
          filters.push({ type: "is", field, value: val });
          return chain;
        },
        gte: (field: string, val: any) => {
          filters.push({ type: "gte", field, value: val });
          return chain;
        },
        lte: (field: string, val: any) => {
          filters.push({ type: "lte", field, value: val });
          return chain;
        },
        gt: (field: string, val: any) => {
          filters.push({ type: "gt", field, value: val });
          return chain;
        },
        or: (expr: string) => {
          filters.push({ type: "or", field: "or", value: expr });
          return chain;
        },
        in: (field: string, values: any[]) => {
          filters.push({ type: "in", field, value: values });
          return chain;
        },
        order: () => chain,
        range: (start: number, end: number) => {
          rangeLimit = { start, end };
          return execute();
        },
        maybeSingle: async () => {
          const res = await execute();
          return { data: res.data?.[0] ?? null, error: null };
        },
        single: async () => {
          const res = await execute();
          return { data: res.data?.[0] ?? null, error: null };
        },
        upsert: (payload: any) => {
          fakeDb.settings = payload;
          return chain;
        },
        then: (resolve: (val: any) => void) => execute().then(resolve),
      };

      async function execute() {
        if (table === "internship_settings") {
          const data = fakeDb.settings ? [fakeDb.settings] : [];
          return { data, error: null, count: data.length };
        }

        if (table === "activities" || table === "canonical_activities" || table === "logbook_activities") {
          let list = fakeDb.activities.map(item => ({ work_category: "INTERNSHIP", ...item }));

          for (const f of filters) {
            if (f.type === "eq") list = list.filter((item) => item[f.field] === f.value);
            if (f.type === "is" && f.value === null) list = list.filter((item) => item[f.field] == null);
            if (f.type === "gte") list = list.filter((item) => item[f.field] >= f.value);
            if (f.type === "lte") list = list.filter((item) => item[f.field] <= f.value);
            if (f.type === "gt") list = list.filter((item) => (item[f.field] || 0) > f.value);
            if (f.type === "or") {
              // search term in title or description
              const match = f.value.match(/%([^%]+)%/);
              if (match) {
                const term = match[1].toLowerCase();
                list = list.filter(
                  (item) =>
                    item.title?.toLowerCase().includes(term) ||
                    item.description?.toLowerCase().includes(term)
                );
              }
            }
          }

          const count = list.length;
          if (rangeLimit) {
            list = list.slice(rangeLimit.start, rangeLimit.end + 1);
          }
          return { data: isHead ? null : list, error: null, count };
        }

        if (table === "canonical_activity_evidences") {
          let list = [...fakeDb.activityEvidences];
          for (const f of filters) {
            if (f.type === "eq") list = list.filter((item) => item[f.field] === f.value);
            if (f.type === "in") list = list.filter((item) => f.value.includes(item[f.field]));
          }
          return { data: list, error: null, count: list.length };
        }

        if (table === "evidences") {
          let list = [...fakeDb.evidences];
          for (const f of filters) {
            if (f.type === "eq") list = list.filter((item) => item[f.field] === f.value);
            if (f.type === "in") list = list.filter((item) => f.value.includes(item[f.field]));
            if (f.type === "is" && f.value === null) list = list.filter((item) => item[f.field] == null);
          }
          return { data: list, error: null, count: list.length };
        }

        return { data: [], error: null, count: 0 };
      }

      return chain;
    },
  }),
}));

import { getLogbookRows } from "@/features/logbook/server/get-logbook-rows";
import { getMissingDaysSummary } from "@/features/logbook/server/get-missing-days";
import { getInternshipSettings, saveInternshipSettings } from "@/features/logbook/server/settings";

describe("Logbook Service Integration", () => {
  beforeEach(() => {
    fakeDb.activities = [];
    fakeDb.evidences = [];
    fakeDb.activityEvidences = [];
    fakeDb.settings = null;
    fakeDb.calls.logbookQueryUsers = [];
  });

  it("enforces owner-scoping and excludes soft-deleted activities", async () => {
    fakeDb.activities = [
      {
        id: "act-own",
        user_id: testUser.userId,
        title: "Aktivitas Saya",
        activity_date: "2026-09-30",
        start_time: "09:00:00",
        end_time: "17:00:00",
        source: "manual",
        status: "READY",
        version: 1,
        deleted_at: null,
        created_at: "2026-09-30T10:00:00Z",
        photo_count: 0,
        link_count: 0,
        total_evidence_count: 0,
      },
      {
        id: "act-other-user",
        user_id: "00000000-0000-4000-8000-0000000000b4", // Other user
        title: "Aktivitas User Lain",
        activity_date: "2026-09-30",
        status: "READY",
        deleted_at: null,
      },
      {
        id: "act-deleted",
        user_id: testUser.userId,
        title: "Aktivitas Terhapus",
        activity_date: "2026-09-30",
        status: "READY",
        deleted_at: "2026-09-30T12:00:00Z", // Soft deleted
      },
    ];

    const result = await getLogbookRows({ from: "2026-09-30", to: "2026-09-30" });

    // Must query only for testUser.userId
    expect(fakeDb.calls.logbookQueryUsers).toContain(testUser.userId);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("act-own");
    expect(result.rows[0].title).toBe("Aktivitas Saya");
  });

  it("performs batched evidence join, excludes drive_file_id, and maps broken status", async () => {
    fakeDb.activities = [
      {
        id: "act-with-evidence",
        user_id: testUser.userId,
        title: "Laporan Lapangan",
        activity_date: "2026-09-29",
        status: "READY",
        deleted_at: null,
        created_at: "2026-09-29T10:00:00Z",
        photo_count: 1,
        link_count: 1,
        broken_count: 1,
        total_evidence_count: 2,
      },
    ];

    fakeDb.activityEvidences = [
      { activity_id: "act-with-evidence", evidence_id: "ev-photo-1", attached_by: testUser.userId },
      { activity_id: "act-with-evidence", evidence_id: "ev-link-1", attached_by: testUser.userId },
    ];

    fakeDb.evidences = [
      {
        id: "ev-photo-1",
        user_id: testUser.userId,
        type: "PHOTO",
        title: "Foto Dokumentasi",
        status: "BROKEN", // Broken photo in Drive
        drive_file_id: "secret-drive-id-12345", // must be excluded from DTO!
        deleted_at: null,
      },
      {
        id: "ev-link-1",
        user_id: testUser.userId,
        type: "LINK",
        title: "PR Pull Request",
        status: "AVAILABLE",
        deleted_at: null,
        link_evidences: [{ url: "https://github.com/org/repo/pull/1" }],
      },
    ];

    const result = await getLogbookRows({ from: "2026-09-01", to: "2026-09-30" });
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.totalEvidenceCount).toBe(2);
    expect(row.brokenCount).toBe(1);
    expect(row.evidences).toHaveLength(2);

    const photoItem = row.evidences.find((e) => e.type === "PHOTO");
    expect(photoItem?.thumbnailUrl).toBe("/api/media/evidence/ev-photo-1?thumb=1");
    expect(photoItem?.status).toBe("BROKEN");
    // Verify DTO secrecy: Drive file ID must NOT be present
    expect(photoItem).not.toHaveProperty("drive_file_id");
    expect(photoItem).not.toHaveProperty("driveFileId");

    const linkItem = row.evidences.find((e) => e.type === "LINK");
    expect(linkItem?.url).toBe("https://github.com/org/repo/pull/1");
  });

  it("filters activities by keyword search", async () => {
    fakeDb.activities = [
      {
        id: "act-1",
        user_id: testUser.userId,
        title: "Meeting dengan mentor",
        description: "Membahas arsitektur microservices",
        activity_date: "2026-09-28",
        status: "READY",
        deleted_at: null,
      },
      {
        id: "act-2",
        user_id: testUser.userId,
        title: "Menulis unit test",
        description: "Testing fitur autentikasi",
        activity_date: "2026-09-29",
        status: "READY",
        deleted_at: null,
      },
    ];

    const res = await getLogbookRows({ month: "2026-09", q: "mentor" });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe("act-1");

    const resDesc = await getLogbookRows({ month: "2026-09", q: "autentikasi" });
    expect(resDesc.rows).toHaveLength(1);
    expect(resDesc.rows[0].id).toBe("act-2");
  });

  it("handles saving and loading internship settings", async () => {
    const saveRes = await saveInternshipSettings({
      startDate: "2026-08-01",
      endDate: "2026-11-30",
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(saveRes.ok).toBe(true);
    if (saveRes.ok) {
      expect(saveRes.settings.startDate).toBe("2026-08-01");
      expect(saveRes.settings.endDate).toBe("2026-11-30");
    }

    const loaded = await getInternshipSettings();
    expect(loaded?.startDate).toBe("2026-08-01");
    expect(loaded?.endDate).toBe("2026-11-30");
  });

  it("evaluates missing days through getMissingDaysSummary", async () => {
    fakeDb.settings = {
      user_id: testUser.userId,
      start_date: "2026-09-21",
      end_date: "2026-09-25", // Mon to Fri
      working_days: [1, 2, 3, 4, 5],
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    fakeDb.activities = [
      {
        id: "act-logged",
        user_id: testUser.userId,
        activity_date: "2026-09-21",
        status: "READY",
        deleted_at: null,
      },
    ];

    const summary = await getMissingDaysSummary();
    expect(summary.enabled).toBe(true);
    expect(summary.loggedWorkdays).toBe(1);
    expect(summary.missingCount).toBe(4);
  });
});
