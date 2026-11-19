import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { buildEvidenceSheet } from "@/features/reports/excel/build-evidence-sheet";
import { POST } from "@/app/api/reports/shared-photo/route";
import { getSharedPhotoLabel } from "@/features/reports/server/shared-photo-label";

const userId = "00000000-0000-4000-8000-0000000000a1";
const shareId = "00000000-0000-4000-8000-0000000000b2";
const evidenceId = "00000000-0000-4000-8000-0000000000c3";
const otherEvidenceId = "00000000-0000-4000-8000-0000000000d4";
const token = "A".repeat(43);
const fixture = { revoked: false, expired: false, inactive: false, ownerActive: true, member: true, photoAvailable: true, ownerName: "Sulthonika", revision: 0, checksum: "", persisted: false };
const sourceBytes = () => sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#1674ea" } }).png().toBuffer();
const verifyDrivePhoto = vi.fn(async (...args: unknown[]) => args.length === 3);
const downloadDriveBytes = vi.fn(async (...args: unknown[]) => {
  expect(args).toHaveLength(2);
  return new Uint8Array(await sourceBytes());
});
const readReportPreview = vi.fn(async () => {
  if (!fixture.persisted) return null;
  return { bytes: new Uint8Array(await sharp(await sourceBytes()).resize(960, 480).webp().toBuffer()), width: 960, height: 480 };
});
const storeReportPreviews = vi.fn(async () => Promise.all([960, 1920].map(async size => ({
  size, bytes: new Uint8Array(await sharp(await sourceBytes()).resize(size, size / 2).webp().toBuffer()), width: size, height: size / 2,
}))));
vi.mock("@/lib/photos/report-preview-storage.mjs", () => ({ readReportPreview: () => readReportPreview(), storeReportPreviews: () => storeReportPreviews() }));

vi.mock("@/features/evidence/server/verify-drive-photo", () => ({ verifyDrivePhoto: (...args: unknown[]) => verifyDrivePhoto(...args) }));
vi.mock("@/lib/google-drive/download", () => ({ downloadDriveBytes: (...args: unknown[]) => downloadDriveBytes(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from(table: string) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query, eq: (field: string, value: unknown) => { filters[field] = value; return query; },
    is: (field: string, value: unknown) => { filters[field] = value; return query; },
    not: (field: string) => { filters[field] = "present"; return query; },
    gt: (field: string) => { filters[field] = "future"; return query; },
    maybeSingle: async () => {
      if (table === "report_photo_share_evidences") {
        const authorized = filters.share_id === shareId && filters.evidence_id === evidenceId
          && (filters["share.token_hash"] === undefined || filters["share.token_hash"] === createHash("sha256").update(token).digest("hex"))
          && filters["share.revoked_at"] === null && !fixture.revoked
          && filters["share.activated_at"] === "present" && !fixture.inactive
          && filters["share.expires_at"] === "future" && !fixture.expired
          && filters["share.owner.is_active"] === true && fixture.ownerActive
          && filters["evidence.type"] === "PHOTO" && filters["evidence.status"] === "AVAILABLE"
          && filters["evidence.deleted_at"] === null && fixture.photoAvailable && fixture.member;
        return { data: authorized ? {
          share: { user_id: userId, owner: { display_name: fixture.ownerName } },
          evidence: { id: evidenceId, photo: { drive_file_id: `file-${fixture.revision}`, drive_folder_id: "folder", mime_type: "image/png", size_bytes: 10000, stored_filename: "proof.png", checksum: fixture.checksum } },
        } : null, error: null };
      }
      return { data: null, error: null };
    },
  }; return query;
} }) }));

const request = (evidence = evidenceId, suppliedToken = token) => new Request("http://localhost:3000/api/reports/shared-photo", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId, evidenceId: evidence, token: suppliedToken }),
});

describe("foto laporan untuk dosen", () => {
  beforeEach(async () => { fixture.revoked = false; fixture.expired = false; fixture.inactive = false; fixture.ownerActive = true; fixture.member = true; fixture.photoAvailable = true; fixture.ownerName = "Sulthonika"; fixture.persisted = false; fixture.revision++; fixture.checksum = createHash("sha256").update(await sourceBytes()).digest("hex"); verifyDrivePhoto.mockReset(); verifyDrivePhoto.mockImplementation(async (...args) => args.length === 3); downloadDriveBytes.mockClear(); readReportPreview.mockClear(); storeReportPreviews.mockClear(); });
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
    expect(result.headers.get("Content-Type")).toBe("image/webp");
    expect(decodeURIComponent(result.headers.get("X-InternFlow-Owner-Name")!)).toBe("Sulthonika");
    const bytes = new Uint8Array(await result.arrayBuffer());
    expect(Number(result.headers.get("Content-Length"))).toBe(bytes.byteLength);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 1920, height: 960 });
    expect(downloadDriveBytes).toHaveBeenCalledTimes(1);
  });
  it("returns the current uploader's Unicode name and a smaller mobile preview", async () => {
    fixture.ownerName = "Alifa Éka";
    const response = await POST(new Request("http://localhost:3000/api/reports/shared-photo", { method: "POST", body: JSON.stringify({ shareId, evidenceId, token, maxWidth: 960 }) }));
    expect(decodeURIComponent(response.headers.get("X-InternFlow-Owner-Name")!)).toBe("Alifa Éka");
    expect(await sharp(new Uint8Array(await response.arrayBuffer())).metadata()).toMatchObject({ width: 960, height: 480 });
  });
  it("reuses verified preview bytes but rechecks the live grant on every request", async () => {
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect(downloadDriveBytes).toHaveBeenCalledTimes(1);
    expect(verifyDrivePhoto).toHaveBeenCalledTimes(1);
    fixture.revoked = true;
    const revoked = await POST(request());
    expect(revoked.status).toBe(404);
    expect(revoked.headers.has("X-InternFlow-Owner-Name")).toBe(false);
    expect(downloadDriveBytes).toHaveBeenCalledTimes(1);
  });
  it("does not serve a cached photo after it is deleted from the library", async () => {
    expect((await POST(request())).status).toBe(200);
    fixture.photoAvailable = false;
    expect((await POST(request())).status).toBe(404);
    expect(downloadDriveBytes).toHaveBeenCalledTimes(1);
  });
  it("serves a prebuilt private preview without contacting Drive or rendering the original", async () => {
    fixture.persisted = true;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await sharp(new Uint8Array(await response.arrayBuffer())).metadata()).toMatchObject({ format: "webp" });
    expect(verifyDrivePhoto).not.toHaveBeenCalled();
    expect(downloadDriveBytes).not.toHaveBeenCalled();
    expect(storeReportPreviews).not.toHaveBeenCalled();
  });
  it("includes the uploader in server-rendered page metadata independently of Drive", async () => {
    fixture.ownerName = "Nur Alifia Rustan";
    expect(await getSharedPhotoLabel(shareId, evidenceId)).toBe("Nur Alifia Rustan");
    expect(verifyDrivePhoto).not.toHaveBeenCalled();
    expect(downloadDriveBytes).not.toHaveBeenCalled();
  });
  it.each(["revoked", "expired", "inactive", "disabled", "deleted"])("omits the initial name for a %s report", async state => {
    if (state === "revoked") fixture.revoked = true;
    if (state === "expired") fixture.expired = true;
    if (state === "inactive") fixture.inactive = true;
    if (state === "disabled") fixture.ownerActive = false;
    if (state === "deleted") fixture.photoAvailable = false;
    expect(await getSharedPhotoLabel(shareId, evidenceId)).toBe("");
  });
  it.each([
    ["wrong token", () => {}, evidenceId, "B".repeat(43)],
    ["photo not in the report", () => {}, otherEvidenceId, token],
    ["revoked", () => { fixture.revoked = true; }, evidenceId, token],
    ["inactive grant", () => { fixture.inactive = true; }, evidenceId, token],
    ["expired", () => { fixture.expired = true; }, evidenceId, token],
    ["owner disabled", () => { fixture.ownerActive = false; }, evidenceId, token],
    ["missing proof", () => { fixture.photoAvailable = false; }, evidenceId, token],
  ])("denies %s before downloading", async (_name, setup, evidence, suppliedToken) => {
    setup();
    const response = await POST(request(evidence, suppliedToken));
    expect(response.status).toBe(404);
    expect(downloadDriveBytes).not.toHaveBeenCalled();
    expect(response.headers.has("X-InternFlow-Owner-Name")).toBe(false);
  });
});
