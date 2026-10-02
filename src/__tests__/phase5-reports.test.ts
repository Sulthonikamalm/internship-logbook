/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { sanitizeCellText, isValidHyperlink } from "@/features/reports/excel/sanitize-cell";
import {
  sanitizeFilenamePart,
  buildExportFilename,
} from "@/features/reports/excel/sanitize-filename";
import {
  exportLogbookSchema,
} from "@/features/reports/schemas/export.schema";
import {
  formatEvidenceSummary,
} from "@/features/reports/excel/build-logbook-sheet";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import { getExportData } from "@/features/reports/server/get-export-data";
import { POST } from "@/app/api/reports/export-excel/route";
import { NextRequest } from "next/server";

// Test Users
const userA = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  email: "user_a@internflow.invalid",
  role: "intern" as const,
  displayName: "Sulthon User A",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

const userB = {
  userId: "00000000-0000-4000-8000-0000000000b2",
  email: "user_b@internflow.invalid",
  role: "intern" as const,
  displayName: "Hacker User B",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

let currentUser: typeof userA | null = userA;

// Mock database state
const mockDb = {
  activities: [] as any[],
  evidences: [] as any[],
  activityEvidences: [] as any[],
  auditLogs: [] as any[],
};

// Mock dependencies
vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveUser: async () => currentUser,
}));
vi.mock("@/lib/auth/get-current-user", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ APP_BASE_URL: "https://internflow.invalid" }) }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: any) => {
        if (table === "audit_logs") {
          mockDb.auditLogs.push(row);
        }
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const filters: { field: string; op: string; val: any }[] = [];
      const orders: { field: string; ascending: boolean }[] = [];
      let rangeStart = 0;
      let rangeEnd = Infinity;

      const chain: any = { single: async () => ({ data: { id: "done-stage" }, error: null }), lt: (field: string, val: any) => { filters.push({ field, op: "lt", val }); return chain; },
        select: () => chain,
        eq: (field: string, val: any) => {
          filters.push({ field, op: "eq", val });
          return chain;
        },
        gte: (field: string, val: any) => {
          filters.push({ field, op: "gte", val });
          return chain;
        },
        lte: (field: string, val: any) => {
          filters.push({ field, op: "lte", val });
          return chain;
        },
        is: (field: string, val: any) => {
          filters.push({ field, op: "is", val });
          return chain;
        },
        in: (field: string, val: any[]) => {
          filters.push({ field, op: "in", val });
          return chain;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orders.push({ field, ascending: options?.ascending ?? true });
          return chain;
        },
        range: (from: number, to: number) => { rangeStart = from; rangeEnd = to; return chain; },
        then: (resolve: any) => {
          let list: any[] = [];
          if (table === "activities") {
            list = mockDb.activities.map(item => ({ work_category: "INTERNSHIP", status: "AVAILABLE", todo_id: null, completion_transition_id: null, ...item }));
          } else if (table === "evidences") {
            list = [...mockDb.evidences];
          } else if (table === "activity_evidences") {
            list = [...mockDb.activityEvidences];
          }

          for (const f of filters) {
            if (f.op === "eq") {
              list = list.filter((item) => item[f.field] === f.val);
            } else if (f.op === "gte") {
              list = list.filter((item) => item[f.field] >= f.val);
            } else if (f.op === "lt") { list = list.filter(item => item[f.field] < f.val); } else if (f.op === "lte") {
              list = list.filter((item) => item[f.field] <= f.val);
            } else if (f.op === "is") {
              list = list.filter((item) => item[f.field] === f.val);
            } else if (f.op === "in") {
              list = list.filter((item) => f.val.includes(item[f.field]));
            }
          }

          list.sort((a, b) => {
            for (const order of orders) {
              const valA = a[order.field] ?? "";
              const valB = b[order.field] ?? "";
              if (valA < valB) return order.ascending ? -1 : 1;
              if (valA > valB) return order.ascending ? 1 : -1;
            }
            return 0;
          });
          return resolve({ data: list.slice(rangeStart, rangeEnd + 1), error: null });
        },
      };
      return chain;
    },
  }),
}));

describe("Phase 5: Excel Export & Reports", () => {
  beforeEach(() => {
    currentUser = userA;
    mockDb.activities = [];
    mockDb.evidences = [];
    mockDb.activityEvidences = [];
    mockDb.auditLogs = [];
  });

  describe("1. Formula Injection & Hyperlink Sanitization", () => {
    it("escapes formula injection characters with leading single quote", () => {
      expect(sanitizeCellText("=HYPERLINK('http://evil.com')")).toBe("'=HYPERLINK('http://evil.com')");
      expect(sanitizeCellText("+SUM(1,2)")).toBe("'+SUM(1,2)");
      expect(sanitizeCellText("-12345")).toBe("'-12345");
      expect(sanitizeCellText("@cmd")).toBe("'@cmd");
      expect(sanitizeCellText("\tmalicious")).toBe("'\tmalicious");
      expect(sanitizeCellText("\rmalicious")).toBe("'\rmalicious");
      expect(sanitizeCellText("   =1+1")).toBe("'   =1+1");
    });

    it("leaves safe benign text untouched", () => {
      expect(sanitizeCellText("Implementasi authentication")).toBe("Implementasi authentication");
      expect(sanitizeCellText("12345")).toBe("12345");
      expect(sanitizeCellText("")).toBe("");
      expect(sanitizeCellText(null)).toBe("");
      expect(sanitizeCellText(undefined)).toBe("");
    });

    it("truncates excessively long text exceeding 30,000 characters safely", () => {
      const veryLong = "A".repeat(35000);
      const sanitized = sanitizeCellText(veryLong);
      expect(sanitized.length).toBe(30000 + " [dipotong]".length);
      expect(sanitized.endsWith(" [dipotong]")).toBe(true);
    });

    it("validates hyperlink protocols strictly", () => {
      expect(isValidHyperlink("https://internflow.app/evidence/123")).toBe(true);
      expect(isValidHyperlink("http://localhost:3000/evidence/123")).toBe(true);
      expect(isValidHyperlink("javascript:alert(1)")).toBe(false);
      expect(isValidHyperlink("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isValidHyperlink("file:///etc/passwd")).toBe(false);
      expect(isValidHyperlink("vbscript:msgbox(1)")).toBe(false);
      expect(isValidHyperlink("not-a-valid-url")).toBe(false);
      expect(isValidHyperlink("")).toBe(false);
      expect(isValidHyperlink(null)).toBe(false);
    });
  });

  describe("2. Filename Sanitization", () => {
    it("builds canonical export filename", () => {
      const filename = buildExportFilename("Sulthon Kamal", "2026-09-01", "2026-09-30");
      expect(filename).toBe("InternFlow_Logbook_Sulthon_Kamal_2026-09-01_2026-09-30.xlsx");
    });

    it("strips path traversal and forbidden filesystem characters", () => {
      const malicious = "../../etc/passwd: *?\"<>|\r\n";
      const sanitized = sanitizeFilenamePart(malicious);
      expect(sanitized).not.toContain("..");
      expect(sanitized).not.toContain("/");
      expect(sanitized).not.toContain("\\");
      expect(sanitized).not.toContain(":");
      expect(sanitized).not.toContain("*");
      expect(sanitized).not.toContain("?");
      expect(sanitized).not.toContain("\"");
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).not.toContain("|");
    });

    it("falls back to 'User' when display name is blank or invalid", () => {
      expect(sanitizeFilenamePart("")).toBe("User");
      expect(sanitizeFilenamePart("   ")).toBe("User");
      expect(sanitizeFilenamePart(null)).toBe("User");
      expect(sanitizeFilenamePart(undefined)).toBe("User");
      expect(sanitizeFilenamePart("///")).toBe("User");
    });
  });

  describe("3. Export Schema Validation", () => {
    it("validates correct date range", () => {
      const parsed = exportLogbookSchema.safeParse({
        from: "2026-09-01",
        to: "2026-09-30",
        includeEvidence: true,
        category: "INTERNSHIP",
        evidenceLinkMode: "APP_PRIVATE",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects when from date is after to date", () => {
      const parsed = exportLogbookSchema.safeParse({
        from: "2026-09-30",
        to: "2026-09-01",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("tidak boleh lebih awal");
      }
    });

    it("rejects invalid or non-existent calendar dates", () => {
      const parsed = exportLogbookSchema.safeParse({
        from: "2026-02-30", // February 30th does not exist
        to: "2026-03-01",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("4. Workbook Generation & Multi-Sheet Structure", () => {
    it("formats evidence summary string correctly", () => {
      expect(formatEvidenceSummary([])).toBe("—");
      expect(
        formatEvidenceSummary([
          { id: "1", type: "PHOTO", title: "P1", status: "READY" },
          { id: "2", type: "PHOTO", title: "P2", status: "READY" },
          { id: "3", type: "LINK", title: "L1", status: "READY" },
        ])
      ).toBe("2 Foto, 1 Tautan");
      expect(
        formatEvidenceSummary([{ id: "1", type: "PHOTO", title: "P1", status: "READY" }])
      ).toBe("1 Foto");
    });

    it("generates valid .xlsx buffer with frozen rows and branded styling", async () => {
      const mockActivities = [
        {
          id: "act-1",
          activityDate: "2026-09-01",
          startTime: "09:00",
          endTime: "17:00",
          title: "Setup CI/CD pipeline",
          description: "Configured GitHub Actions and unit tests",
          evidences: [
            {
              id: "ev-1",
              type: "PHOTO" as const,
              title: "Screenshot Pipeline",
              status: "AVAILABLE",
            },
          ],
        },
        {
          id: "act-2",
          activityDate: "2026-09-02",
          startTime: "10:00",
          endTime: "12:00",
          title: "=cmd|' /C calc'!A0", // Malicious formula attempt
          description: "Testing formula escape",
          evidences: [],
        },
      ];

      const mockEvidenceDetails = [
        {
          evidenceId: "ev-1",
          activityId: "act-1",
          activityDate: "2026-09-01",
          type: "PHOTO" as const,
          title: "Screenshot Pipeline",
          status: "AVAILABLE",
          url: null,
        },
        {
          evidenceId: "ev-2",
          activityId: "act-1",
          activityDate: "2026-09-01",
          type: "LINK" as const,
          title: "PR Link",
          status: "AVAILABLE",
          url: "https://github.com/org/repo/pull/42",
        },
        {
          evidenceId: "ev-3",
          activityId: "act-1",
          activityDate: "2026-09-01",
          type: "PHOTO" as const,
          title: "Missing photo",
          status: "BROKEN",
          url: null,
        },
      ];

      const buffer = await generateWorkbook(
        {
          user: {
            userId: userA.userId,
            displayName: userA.displayName,
            timezone: userA.timezone,
          },
          activities: mockActivities,
          evidenceDetails: mockEvidenceDetails,
        },
        {
          includeEvidence: true,
          baseUrl: "https://internflow.example.com",
        }
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify that ExcelJS can parse the generated workbook
      const loadedWb = new ExcelJS.Workbook();
      await loadedWb.xlsx.load(buffer as any);

      // Sheet 1: Logbook
      const logbookSheet = loadedWb.getWorksheet("Logbook");
      expect(logbookSheet).toBeDefined();
      expect(logbookSheet?.views[0]?.state).toBe("frozen");

      const headerRow = logbookSheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe("No");
      expect(headerRow.getCell(2).value).toBe("Tanggal");
      expect(headerRow.getCell(5).value).toBe("Kegiatan");
      expect(headerRow.getCell(7).value).toBe("Lampiran · klik untuk buka");

      // Verify row 2 data
      const dataRow1 = logbookSheet!.getRow(2);
      expect(dataRow1.getCell(1).value).toBe(1);
      expect(dataRow1.getCell(2).value).toBe("2026-09-01");
      expect(dataRow1.getCell(5).value).toBe("Setup CI/CD pipeline");
      expect((dataRow1.getCell(7).value as any).hyperlink).toBe("https://internflow.example.com/evidence/ev-1");

      // Verify formula sanitization in row 3
      const dataRow2 = logbookSheet!.getRow(3);
      expect(dataRow2.getCell(5).value).toBe("'=cmd|' /C calc'!A0");

      // Sheet 2: Evidence Detail
      const evidenceSheet = loadedWb.getWorksheet("Evidence Detail");
      expect(evidenceSheet).toBeDefined();
      expect(evidenceSheet?.views[0]?.state).toBe("frozen");

      const evHeaderRow = evidenceSheet!.getRow(1);
      expect(evHeaderRow.getCell(1).value).toBe("Tanggal");
      expect(evHeaderRow.getCell(3).value).toBe("Jenis");
      expect(evHeaderRow.getCell(5).value).toBe("Klik untuk membuka");
      expect(evHeaderRow.getCell(6).value).toBe("Status");

      // Verify row with valid photo link
      const evRow1 = evidenceSheet!.getRow(2);
      expect(evRow1.getCell(7).value).toBe("ev-1"); expect(evidenceSheet!.getColumn(7).hidden).toBe(true);
      expect(evRow1.getCell(3).value).toBe("Foto");
      const urlCell1 = evRow1.getCell(5);
      expect((urlCell1.value as any)?.hyperlink).toBe("https://internflow.example.com/evidence/ev-1");

      // Verify row with external link
      const evRow2 = evidenceSheet!.getRow(3);
      expect(evRow2.getCell(3).value).toBe("Tautan");
      const urlCell2 = evRow2.getCell(5);
      expect((urlCell2.value as any)?.hyperlink).toBe("https://github.com/org/repo/pull/42");

      // Verify broken evidence row
      const evRow3 = evidenceSheet!.getRow(4);
      expect(evRow3.getCell(6).value).toBe("Tidak tersedia"); expect(evRow3.getCell(5).value).toBe("—");
    });
  });

  describe("5. Multi-User Isolation & Server Data Query", () => {
    it("reads all pages beyond the provider row limit", async () => {
      mockDb.activities = Array.from({ length: 1105 }, (_, index) => ({ id: `act-${String(index).padStart(4,"0")}`, user_id: userA.userId, activity_date: "2026-09-01", title: "Work", description: null, start_time: null, end_time: null, deleted_at: null, created_at: "2026-09-01T09:00:00Z" }));
      const result = await getExportData({ from: "2026-09-01", to: "2026-09-30", includeEvidence: true, category: "INTERNSHIP", evidenceLinkMode: "APP_PRIVATE" });
      expect(result.activities).toHaveLength(1105); expect(result.activities.at(-1)?.id).toBe("act-1104");
    });

    it("ensures User A only exports User A's activities and ignores User B", async () => {
      // Setup DB records
      mockDb.activities = [
        {
          id: "act-a-1",
          user_id: userA.userId,
          activity_date: "2026-09-10",
          start_time: "08:00",
          end_time: "16:00",
          title: "User A Work",
          description: "Internal A",
          deleted_at: null,
          created_at: "2026-09-10T08:00:00Z",
        },
        {
          id: "act-a-2",
          user_id: userA.userId,
          activity_date: "2026-09-15",
          start_time: "09:00",
          end_time: "17:00",
          title: "User A Second Day",
          description: null,
          deleted_at: null,
          created_at: "2026-09-15T09:00:00Z",
        },
        {
          id: "act-a-deleted",
          user_id: userA.userId,
          activity_date: "2026-09-12",
          start_time: "09:00",
          end_time: "17:00",
          title: "User A Deleted",
          description: null,
          deleted_at: "2026-09-12T12:00:00Z",
          created_at: "2026-09-12T09:00:00Z",
        },
        {
          id: "act-b-secret",
          user_id: userB.userId,
          activity_date: "2026-09-11",
          start_time: "09:00",
          end_time: "17:00",
          title: "User B Secret Activity",
          description: "Confidential B",
          deleted_at: null,
          created_at: "2026-09-11T09:00:00Z",
        },
      ];

      currentUser = userA;
      const result = await getExportData({
        from: "2026-09-01",
        to: "2026-09-30",
        includeEvidence: true,
        category: "INTERNSHIP",
        evidenceLinkMode: "APP_PRIVATE",
      });

      // Should contain only User A's non-deleted activities
      expect(result.activities.length).toBe(2);
      expect(result.activities.map((a) => a.id)).toEqual(["act-a-1", "act-a-2"]);
      expect(result.activities.some((a) => a.id === "act-b-secret")).toBe(false);
      expect(result.activities.some((a) => a.id === "act-a-deleted")).toBe(false);
    });

    it("isolates all three categories for the same owner", async () => {
      mockDb.activities = ["INTERNSHIP", "THESIS", "PERSONAL"].map(category => ({
        id: category, user_id: userA.userId, work_category: category,
        activity_date: "2026-09-10", title: category, deleted_at: null,
        start_time: null, end_time: null, description: null, created_at: "2026-09-10T09:00:00Z",
      }));
      for (const category of ["INTERNSHIP", "THESIS", "PERSONAL"] as const) {
        const data = await getExportData({ from: "2026-09-01", to: "2026-09-30", category, includeEvidence: true, evidenceLinkMode: "APP_PRIVATE" });
        expect(data.activities.map(row => row.id)).toEqual([category]);
      }
    });
    it("sorts activities in chronological ascending (ASC) order", async () => {
      mockDb.activities = [
        {
          id: "act-day-3",
          user_id: userA.userId,
          activity_date: "2026-09-20",
          start_time: "09:00",
          end_time: "17:00",
          title: "Day 3",
          deleted_at: null,
          created_at: "2026-09-20T09:00:00Z",
        },
        {
          id: "act-day-1",
          user_id: userA.userId,
          activity_date: "2026-09-05",
          start_time: "09:00",
          end_time: "17:00",
          title: "Day 1",
          deleted_at: null,
          created_at: "2026-09-05T09:00:00Z",
        },
        {
          id: "act-day-2",
          user_id: userA.userId,
          activity_date: "2026-09-10",
          start_time: "09:00",
          end_time: "17:00",
          title: "Day 2",
          deleted_at: null,
          created_at: "2026-09-10T09:00:00Z",
        },
      ];

      const result = await getExportData({
        from: "2026-09-01",
        to: "2026-09-30",
        includeEvidence: true,
        category: "INTERNSHIP",
        evidenceLinkMode: "APP_PRIVATE",
      });

      expect(result.activities[0].id).toBe("act-day-1");
      expect(result.activities[1].id).toBe("act-day-2");
      expect(result.activities[2].id).toBe("act-day-3");
    });
  });

  describe("6. Route Handler & Audit Logging", () => {
    it("returns 401 for an expired session before processing report input", async () => {
      currentUser = null;
      const result = await POST(new NextRequest("http://localhost:3000/api/reports/export-excel", { method: "POST", body: "invalid" }));
      expect(result.status).toBe(401); expect(mockDb.auditLogs).toHaveLength(0);
    });
    it("returns 400 for invalid request body", async () => {
      const req = new NextRequest("http://localhost:3000/api/reports/export-excel", {
        method: "POST",
        body: JSON.stringify({ from: "invalid-date", to: "2026-09-30" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("VALIDATION_ERROR");
    });

    it("rejects DRIVE_SHARED mode with clear explanation", async () => {
      const req = new NextRequest("http://localhost:3000/api/reports/export-excel", {
        method: "POST",
        body: JSON.stringify({
          from: "2026-09-01",
          to: "2026-09-30",
          evidenceLinkMode: "DRIVE_SHARED",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("UNSUPPORTED_MODE");
      expect(json.message).toContain("DRIVE_SHARED saat ini belum didukung");
    });

    it("returns 404 with friendly message if zero activities found in range", async () => {
      mockDb.activities = []; // Empty DB

      const req = new NextRequest("http://localhost:3000/api/reports/export-excel", {
        method: "POST",
        body: JSON.stringify({
          from: "2026-09-01",
          to: "2026-09-30",
          includeEvidence: true,
          category: "INTERNSHIP",
          evidenceLinkMode: "APP_PRIVATE",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("EMPTY_RANGE");
      expect(json.message).toBe("Belum ada kegiatan untuk kategori dan periode ini.");
    });

    it("returns an actionable 422 for academic work without available evidence", async () => {
      mockDb.activities = [{ id: "needs-proof", user_id: userA.userId, work_category: "THESIS", activity_date: "2026-09-10", title: "Analisis TA", deleted_at: null, created_at: "2026-09-10T09:00:00Z" }];
      const response = await POST(new NextRequest("http://localhost:3000/api/reports/export-excel", {
        method: "POST", body: JSON.stringify({ from: "2026-09-01", to: "2026-09-30", category: "THESIS", includeEvidence: true, evidenceLinkMode: "APP_PRIVATE" }),
      }));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: "EVIDENCE_REQUIRED", missing: [{ title: "Analisis TA", href: "/activities/needs-proof" }] });
      expect(mockDb.auditLogs).toHaveLength(0);
    });
    it("returns 200 with xlsx stream, attachment headers, and records audit event", async () => {
      mockDb.evidences = [{ id: "proof", user_id: userA.userId, type: "LINK", title: "Bukti", status: "AVAILABLE", deleted_at: null, link_evidences: { url: "https://example.com/proof" } }];
      mockDb.activityEvidences = [{ activity_id: "act-1", evidence_id: "proof", attached_by: userA.userId }];
      mockDb.activities = [
        {
          id: "act-1",
          user_id: userA.userId,
          activity_date: "2026-09-05",
          start_time: "09:00",
          end_time: "17:00",
          title: "Feature Implementation",
          description: "Completed tasks",
          deleted_at: null,
          created_at: "2026-09-05T09:00:00Z",
        },
      ];

      const req = new NextRequest("http://localhost:3000/api/reports/export-excel", {
        method: "POST",
        body: JSON.stringify({
          from: "2026-09-01",
          to: "2026-09-30",
          includeEvidence: true,
          category: "INTERNSHIP",
          evidenceLinkMode: "APP_PRIVATE",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      expect(res.headers.get("Content-Disposition")).toContain(".xlsx");

      // Verify audit event was logged
      expect(mockDb.auditLogs.length).toBe(1);
      const log = mockDb.auditLogs[0];
      expect(log.actor_user_id).toBe(userA.userId);
      expect(log.action).toBe("report.excel_exported");
      expect(log.metadata).toEqual({
        from: "2026-09-01",
        to: "2026-09-30",
        row_count: 1,
        evidence_mode: "APP_PRIVATE",
        include_evidence: true,
        category: "INTERNSHIP",
        share_id: null,
      });
    });
  });
});
