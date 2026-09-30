import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";

const fake = vi.hoisted(() => ({
  user: { userId: "00000000-0000-4000-8000-0000000000a3", isActive: true },
  evidence: { id: "00000000-0000-4000-8000-0000000000e3", status: "UPLOADING" } as
    { id: string; status: string } | null,
  session: {} as Record<string, unknown>,
  photo: {} as Record<string, unknown>,
  rpcError: null as null | { code: string },
  deleteFails: false,
  updates: [] as unknown[],
  getDriveMetadata: vi.fn(), downloadDriveBytes: vi.fn(), deleteDriveFile: vi.fn(),
}));

vi.mock("@/features/evidence/server/http", () => ({
  sameOrigin: (request: Request) => request.headers.get("origin") === new URL(request.url).origin,
  activeApiUser: async () => fake.user,
  jsonError: (message: string, status: number, code = "ERROR") =>
    Response.json({ ok: false, message, code }, { status }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: (table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain,
      maybeSingle: async () => ({ data: table === "evidences" ? fake.evidence
        : table === "photo_evidences" ? fake.photo : fake.session, error: null }),
      update: (payload: unknown) => { fake.updates.push(payload); return chain; },
      then: (resolve: (value: unknown) => void) => resolve({ error: null }),
    };
    return chain;
  },
  rpc: async () => ({ error: fake.rpcError }),
}) }));
vi.mock("@/lib/google-drive/metadata", () => ({ getDriveMetadata: fake.getDriveMetadata }));
vi.mock("@/lib/google-drive/download", () => ({ downloadDriveBytes: fake.downloadDriveBytes,
  downloadDriveFile: vi.fn() }));
vi.mock("@/lib/google-drive/delete", () => ({ deleteDriveFile: fake.deleteDriveFile }));

import { POST } from "@/app/api/evidence/photos/finalize/route";
import { GET } from "@/app/api/media/evidence/[id]/route";
import { DriveError } from "@/lib/google-drive/errors";

const uploadId = "00000000-0000-4000-8000-0000000000c3";
const driveFileId = "drive-file-a";
function request() {
  return new Request("http://localhost:3000/api/evidence/photos/finalize", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ uploadId, driveFileId }),
  });
}

describe("photo finalization across Drive and database", () => {
  beforeEach(async () => {
    vi.clearAllMocks(); fake.updates.length = 0; fake.deleteFails = false; fake.rpcError = null;
    fake.evidence = { id: "00000000-0000-4000-8000-0000000000e3", status: "UPLOADING" };
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } })
      .png().toBuffer();
    fake.session = { expected_size: bytes.length, expected_mime: "image/png",
      expected_checksum: createHash("sha256").update(bytes).digest("hex"),
      stored_filename: "safe.png", drive_folder_id: "private-folder" };
    fake.photo = { drive_file_id: driveFileId, drive_folder_id: "private-folder",
      mime_type: "image/png", size_bytes: bytes.length, stored_filename: "safe.png" };
    fake.getDriveMetadata.mockResolvedValue({ id: driveFileId, name: "safe.png", mimeType: "image/png",
      size: String(bytes.length), parents: ["private-folder"],
      appProperties: { internflowEvidenceId: fake.evidence.id,
        internflowUserId: fake.user.userId } });
    fake.downloadDriveBytes.mockResolvedValue(bytes);
    fake.deleteDriveFile.mockImplementation(async () => { if (fake.deleteFails) throw new Error("down"); });
  });
  it("marks success only after content validation and atomic RPC", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, evidenceId: fake.evidence?.id });
    expect(fake.deleteDriveFile).not.toHaveBeenCalled();
    expect(fake.updates).toEqual([]);
  });
  it("hides another user's guessed upload without querying Drive", async () => {
    fake.evidence = null;
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(fake.getDriveMetadata).not.toHaveBeenCalled();
  });
  it("deletes Drive file when metadata commit fails", async () => {
    fake.rpcError = { code: "23514" };
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(fake.deleteDriveFile).toHaveBeenCalledWith(driveFileId);
    expect(fake.updates).toContainEqual({ status: "FAILED" });
  });
  it("records an orphan when cleanup also fails", async () => {
    fake.rpcError = { code: "23514" }; fake.deleteFails = true;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(fake.updates).toContainEqual({ status: "ORPHANED",
      metadata: { pending_drive_file_id: driveFileId } });
  });
  it("denies a guessed media ID before calling Drive", async () => {
    fake.evidence = null;
    const response = await GET(new Request("http://localhost:3000/api/media/evidence/guess"),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-0000000000e3" }) });
    expect(response.status).toBe(404);
    expect(fake.getDriveMetadata).not.toHaveBeenCalled();
  });
  it("marks missing external photo broken and returns a safe error", async () => {
    fake.evidence = { id: "00000000-0000-4000-8000-0000000000e3", status: "AVAILABLE" };
    fake.getDriveMetadata.mockRejectedValue(new DriveError("NOT_FOUND", 404));
    const response = await GET(new Request("http://localhost:3000/api/media/evidence/guess"),
      { params: Promise.resolve({ id: fake.evidence.id }) });
    expect(response.status).toBe(404);
    expect(fake.updates).toContainEqual({ status: "BROKEN" });
    expect(JSON.stringify(await response.json())).not.toContain(driveFileId);
  });
  it("serves a private thumbnail through the owner-scoped route", async () => {
    fake.evidence = { id: "00000000-0000-4000-8000-0000000000e3", status: "AVAILABLE" };
    const response = await GET(new Request(`http://localhost:3000/api/media/evidence/${fake.evidence.id}?thumb=1`),
      { params: Promise.resolve({ id: fake.evidence.id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
