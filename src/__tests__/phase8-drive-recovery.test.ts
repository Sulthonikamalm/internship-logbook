import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ drive: vi.fn(), status: vi.fn(), evidenceId: "00000000-0000-4000-8000-0000000000e3", userId: "00000000-0000-4000-8000-0000000000a3" }));
const sessionUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture";
vi.mock("@/lib/google-drive/client", () => ({ driveFetch: fake.drive, driveUploadStatusFetch: fake.status }));
vi.mock("@/lib/google-drive/metadata", () => ({ ensureUserMonthFolder: vi.fn() }));
vi.mock("@/features/evidence/server/http", () => ({ sameOrigin: () => true, activeApiUser: async () => ({ userId: fake.userId, timezone: "Asia/Jakarta" }), jsonError: (message: string, status: number) => Response.json({ message }, { status }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ error: null, data: table === "evidences" ? { id: fake.evidenceId, status: "UPLOADING" } : { session_url: sessionUrl, expected_size: 100, expected_mime: "image/png", expected_checksum: "a".repeat(64), expires_at: "2099-01-01" } }) };
  return query;
} }) }));
import { initiatePhotoUpload, probePhotoUpload } from "@/lib/google-drive/upload";
import { POST } from "@/app/api/evidence/photos/start/route";
beforeEach(() => { vi.clearAllMocks(); });
describe("Drive browser upload recovery", () => {
  it("binds the resumable session to the validated browser origin", async () => {
    fake.drive.mockResolvedValue(new Response(null, { headers: { location: sessionUrl } }));
    await expect(initiatePhotoUpload({ evidenceId: fake.evidenceId, userId: fake.userId, folderId: "private", storedFilename: "safe.png", mimeType: "image/png", size: 100, origin: "http://localhost:3000" })).resolves.toBe(sessionUrl);
    expect(fake.drive.mock.calls[0][1].headers.Origin).toBe("http://localhost:3000");
  });
  it("recovers a completed upload after the browser lost the success response", async () => {
    fake.status.mockResolvedValue(new Response(JSON.stringify({ id: "completed-qa-file" })));
    const result = await POST(new Request("http://localhost:3000/api/evidence/photos/start", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ uploadId: "00000000-0000-4000-8000-0000000000c3", size: 100, mimeType: "image/png", originalFilename: "qa.png", checksum: "a".repeat(64) }) }));
    expect(await result.json()).toEqual({ ok: true, kind: "FINALIZE", evidenceId: fake.evidenceId, driveFileId: "completed-qa-file" });
    expect(fake.drive).not.toHaveBeenCalled();
  });
  it("distinguishes an active session from an expired session", async () => {
    fake.status.mockResolvedValueOnce(new Response(null, { status: 308 })).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(probePhotoUpload(sessionUrl, 100)).resolves.toEqual({ kind: "ACTIVE" });
    await expect(probePhotoUpload(sessionUrl, 100)).resolves.toEqual({ kind: "EXPIRED" });
  });
  it("rejects arbitrary upload endpoints before issuing a server request", async () => {
    await expect(probePhotoUpload("https://attacker.invalid/upload", 100)).rejects.toThrow();
    expect(fake.status).not.toHaveBeenCalled();
  });
});
