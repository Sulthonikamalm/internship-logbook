import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { buildEvidenceSheet } from "@/features/reports/excel/build-evidence-sheet";
import { POST } from "@/app/api/reports/shared-photo/route";

const userId = "00000000-0000-4000-8000-0000000000a1";
const shareId = "00000000-0000-4000-8000-0000000000b2";
const evidenceId = "00000000-0000-4000-8000-0000000000c3";
const otherEvidenceId = "00000000-0000-4000-8000-0000000000d4";
const token = "A".repeat(43);
const fixture = { revoked: false, expired: false, ownerActive: true, member: true, photoAvailable: true };
const verifyDrivePhoto = vi.fn(async (...args: unknown[]) => args.length === 3);
const downloadDriveFile = vi.fn(async (...args: unknown[]) => {
  expect(args).toHaveLength(1);
  return new Response(new Uint8Array([137, 80, 78, 71]));
});

vi.mock("@/features/evidence/server/verify-drive-photo", () => ({ verifyDrivePhoto: (...args: unknown[]) => verifyDrivePhoto(...args) }));
vi.mock("@/lib/google-drive/download", () => ({ downloadDriveFile: (...args: unknown[]) => downloadDriveFile(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from(table: string) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query, eq: (field: string, value: unknown) => { filters[field] = value; return query; },
    is: (field: string, value: unknown) => { filters[field] = value; return query; },
    not: (field: string) => { filters[field] = "present"; return query; },
    gt: (field: string) => { filters[field] = "future"; return query; },
    maybeSingle: async () => {
      if (table === "report_photo_shares") return { data: filters.id === shareId && filters.token_hash === (await import("node:crypto")).createHash("sha256").update(token).digest("hex") && !fixture.revoked && !fixture.expired ? { id: shareId, user_id: userId } : null, error: null };
      if (table === "profiles") return { data: fixture.ownerActive ? { id: userId } : null, error: null };
      if (table === "report_photo_share_evidences") return { data: fixture.member && filters.evidence_id === evidenceId ? { evidence_id: evidenceId } : null, error: null };
      if (table === "evidences") return { data: fixture.photoAvailable && filters.id === evidenceId ? { id: evidenceId } : null, error: null };
      if (table === "photo_evidences") return { data: filters.evidence_id === evidenceId ? { drive_file_id: "file", drive_folder_id: "folder", mime_type: "image/png", size_bytes: 4, stored_filename: "proof.png" } : null, error: null };
      return { data: null, error: null };
    },
  }; return query;
} }) }));

const request = (evidence = evidenceId, suppliedToken = token) => new Request("http://localhost:3000/api/reports/shared-photo", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId, evidenceId: evidence, token: suppliedToken }),
});

describe("foto laporan untuk dosen", () => {
  beforeEach(() => { fixture.revoked = false; fixture.expired = false; fixture.ownerActive = true; fixture.member = true; fixture.photoAvailable = true; verifyDrivePhoto.mockClear(); downloadDriveFile.mockClear(); });
  it("puts a fragment token in the Excel hyperlink without revealing the Drive ID", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = buildEvidenceSheet(workbook, [{ evidenceId, activityId: "activity", activityDate: "2026-10-02", type: "PHOTO", title: "Dokumentasi", status: "AVAILABLE" }], "https://internflow.example", { id: shareId, token, expiresAt: "2027-01-01" });
    const link = sheet.getRow(2).getCell("url").value as { hyperlink: string };
    expect(link.hyperlink).toBe(`https://internflow.example/shared/evidence/${shareId}/${evidenceId}#${token}`);
    expect(link.hyperlink).not.toContain("drive.google.com");
  });
  it("serves only the listed owner's available photo to the bearer, without a login cookie", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(result.headers.get("Content-Type")).toBe("image/png");
    expect(downloadDriveFile).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["wrong token", () => {}, evidenceId, "B".repeat(43)],
    ["photo not in the report", () => {}, otherEvidenceId, token],
    ["revoked", () => { fixture.revoked = true; }, evidenceId, token],
    ["expired", () => { fixture.expired = true; }, evidenceId, token],
    ["owner disabled", () => { fixture.ownerActive = false; }, evidenceId, token],
    ["missing proof", () => { fixture.photoAvailable = false; }, evidenceId, token],
  ])("denies %s before downloading", async (_name, setup, evidence, suppliedToken) => {
    setup();
    const response = await POST(request(evidence, suppliedToken));
    expect(response.status).toBe(404);
    expect(downloadDriveFile).not.toHaveBeenCalled();
  });
});
