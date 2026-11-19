// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureReportPreviewBucket, readReportPreview, reportPreviewPath, storeReportPreviews, REPORT_PREVIEW_BUCKET } from "@/lib/photos/report-preview-storage.mjs";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const evidence = "00000000-0000-4000-8000-000000000003";

function storage(publicBucket = false) {
  const files = new Map<string, Uint8Array>();
  const upload = vi.fn(async (path: string, data: Uint8Array, options: unknown) => { files.set(path, data); return { data: { path }, error: null, options }; });
  const download = vi.fn(async (path: string) => ({ data: files.has(path) ? new Blob([Uint8Array.from(files.get(path)!)]) : null, error: files.has(path) ? null : { status: 404 } }));
  const createBucket = vi.fn(async () => ({ error: null }));
  const from = vi.fn((bucket: string) => { expect(bucket).toBe(REPORT_PREVIEW_BUCKET); return { upload, download }; });
  const db = { storage: { from, getBucket: vi.fn(async () => ({ data: { public: publicBucket }, error: null })), createBucket } };
  return { db: db as unknown as SupabaseClient, files, upload, download, createBucket };
}

describe("private prebuilt report photos", () => {
  it("stores both optimized variants and reloads them without an original file", async () => {
    const fixture = storage();
    const original = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#1674ea" } }).jpeg().toBuffer();
    const checksum = createHash("sha256").update(original).digest("hex");
    await storeReportPreviews(fixture.db, owner, evidence, checksum, original);
    expect(fixture.upload).toHaveBeenCalledTimes(2);
    for (const size of [960, 1920]) {
      expect(fixture.upload).toHaveBeenCalledWith(reportPreviewPath(owner, evidence, checksum, size), expect.any(Uint8Array), { contentType: "image/webp", cacheControl: "0", upsert: true });
      const result = await readReportPreview(fixture.db, owner, evidence, checksum, size);
      expect(result).toMatchObject({ width: size, height: size / 2 });
      expect(await sharp(result!.bytes).metadata()).toMatchObject({ format: "webp", width: size, height: size / 2 });
      expect(result!.bytes.byteLength).toBeLessThan(original.byteLength);
    }
    expect(await readReportPreview(fixture.db, other, evidence, checksum, 960)).toBeNull();
  });
  it("refuses a public bucket rather than publishing private photos", async () => {
    const fixture = storage(true);
    await expect(ensureReportPreviewBucket(fixture.db)).rejects.toThrow("must be private");
    expect(fixture.upload).not.toHaveBeenCalled();
  });
  it("rejects path traversal, malformed IDs and arbitrary preview sizes", () => {
    const checksum = "a".repeat(64);
    expect(() => reportPreviewPath("../owner", evidence, checksum, 960)).toThrow();
    expect(() => reportPreviewPath(owner, "../photo", checksum, 960)).toThrow();
    expect(() => reportPreviewPath(owner, evidence, "../file", 960)).toThrow();
    expect(() => reportPreviewPath(owner, evidence, checksum, 4000)).toThrow();
  });
});
