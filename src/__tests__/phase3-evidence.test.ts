import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { inspectPhoto, safeOriginalFilename, extensionForMime } from "@/features/evidence/domain/photo";
import { photoMimeFromSignature, MAX_PHOTO_BYTES } from "@/features/evidence/domain/photo-signature";
import { validateEvidenceUrl } from "@/features/evidence/domain/link";
import { mapDriveNetworkError, mapDriveResponse } from "@/lib/google-drive/errors";
import { utcRangeForLocalDay } from "@/features/evidence/domain/date";

describe("Photo evidence validation", () => {
  it("recognizes only supported signatures", () => {
    expect(photoMimeFromSignature(Uint8Array.from([255, 216, 255]))).toBe("image/jpeg");
    expect(photoMimeFromSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(photoMimeFromSignature(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe("image/webp");
    expect(photoMimeFromSignature(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(photoMimeFromSignature(new TextEncoder().encode("ftypheic"))).toBeNull();
  });
  it("decodes content and computes checksum", async () => {
    const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: "red" } })
      .png().toBuffer();
    const result = await inspectPhoto(bytes, "image/png");
    expect(result).toEqual({ mime: "image/png", width: 4, height: 3,
      checksum: createHash("sha256").update(bytes).digest("hex") });
    await expect(inspectPhoto(bytes, "image/jpeg")).rejects.toThrow("Format");
  });
  it("rejects forged, damaged, and oversized input", async () => {
    await expect(inspectPhoto(Buffer.from("not really a photo"), "image/jpeg")).rejects.toThrow();
    await expect(inspectPhoto(Uint8Array.from([255, 216, 255, ...new Array(30).fill(0)]), "image/jpeg"))
      .rejects.toThrow("rusak");
    await expect(inspectPhoto(new Uint8Array(MAX_PHOTO_BYTES + 1))).rejects.toThrow("15 MB");
  });
  it("removes path and control characters from original filename", () => {
    expect(safeOriginalFilename(" ../../secret\\name\u0000.jpg ")).toBe(".._.._secret_name_.jpg");
    expect(extensionForMime("image/webp")).toBe("webp");
  });
});

describe("Link and Drive error boundaries", () => {
  it("accepts only credential-free http(s) links", () => {
    expect(validateEvidenceUrl(" https://example.com/path?q=1 ")).toBe("https://example.com/path?q=1");
    for (const unsafe of ["javascript:alert(1)", "data:text/html,evil", "file:///etc/passwd",
      "https://user:pass@example.com", "https://"])
      expect(() => validateEvidenceUrl(unsafe)).toThrow();
  });
  it("maps quota, rate, auth, missing file, and timeouts", () => {
    expect(mapDriveResponse(403, "storageQuotaExceeded")).toBe("QUOTA");
    expect(mapDriveResponse(403, "userRateLimitExceeded")).toBe("RATE_LIMIT");
    expect(mapDriveResponse(403)).toBe("FORBIDDEN");
    expect(mapDriveResponse(401)).toBe("AUTH");
    expect(mapDriveResponse(404)).toBe("NOT_FOUND");
    expect(mapDriveNetworkError(new DOMException("Timed out", "TimeoutError")).code).toBe("TIMEOUT");
  });
});

describe("Evidence date filter", () => {
  it("uses the user's local day across WIB midnight", () => {
    expect(utcRangeForLocalDay("2026-10-01", "Asia/Jakarta")).toEqual({
      start: "2026-09-30T17:00:00.000Z", end: "2026-10-01T17:00:00.000Z",
    });
  });
  it("accounts for a DST day that is not 24 hours", () => {
    const range = utcRangeForLocalDay("2026-11-01", "America/New_York");
    expect((Date.parse(range.end) - Date.parse(range.start)) / 3600000).toBe(25);
  });
});
