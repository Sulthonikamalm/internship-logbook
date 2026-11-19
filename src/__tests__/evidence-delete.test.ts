import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  rpc: vi.fn(), deleteDriveFile: vi.fn(), update: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidatePath }));
vi.mock("@/lib/auth/require-active-user", () => ({ requireActiveUser: async () => ({ userId: "00000000-0000-4000-8000-000000000001" }) }));
vi.mock("@/lib/google-drive/delete", () => ({ deleteDriveFile: fake.deleteDriveFile }));
vi.mock("@/features/evidence/server/list-evidence", () => ({ listEvidence: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  rpc: fake.rpc,
  from: () => ({ update: (value: unknown) => {
    fake.update(value);
    const query = { eq: () => query, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
    return query;
  } }),
}) }));

import { deleteEvidence } from "@/features/evidence/server/mutations";
const id = "00000000-0000-4000-8000-000000000003";

describe("photo deletion with Supabase table-returning RPC responses", () => {
  beforeEach(() => { vi.resetAllMocks(); fake.rpc.mockResolvedValue({ data: null, error: null }); });

  it("deletes the remote file before finalizing a detached photo", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [{ type: "PHOTO", status: "DELETE_PENDING", drive_file_id: "qa-drive-file", blocked_count: 0 }], error: null });
    expect(await deleteEvidence(id, true)).toEqual({ ok: true });
    expect(fake.rpc).toHaveBeenCalledWith("begin_evidence_delete", { p_evidence_id: id, p_detach_all: true });
    expect(fake.deleteDriveFile).toHaveBeenCalledWith("qa-drive-file");
    expect(fake.update).toHaveBeenCalledWith({ status: "DELETED", deleted_at: expect.any(String) });
    expect(fake.deleteDriveFile.mock.invocationCallOrder[0]).toBeLessThan(fake.update.mock.invocationCallOrder[0]);
  });

  it("keeps assigned photos untouched until detach is requested", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [{ type: "PHOTO", status: "AVAILABLE", drive_file_id: null, blocked_count: 2 }], error: null });
    expect(await deleteEvidence(id)).toMatchObject({ ok: false, code: "ASSIGNED", count: 2 });
    expect(fake.deleteDriveFile).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("leaves deletion pending and schedules reconciliation when Drive fails", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [{ type: "PHOTO", status: "DELETE_PENDING", drive_file_id: "qa-drive-file", blocked_count: 0 }], error: null });
    fake.deleteDriveFile.mockRejectedValueOnce(new Error("Drive unavailable"));
    expect(await deleteEvidence(id, true)).toMatchObject({ ok: false, code: "DELETE_PENDING" });
    expect(fake.rpc).toHaveBeenCalledWith("record_storage_reconciliation", {
      p_evidence_id: id, p_drive_file_id: "qa-drive-file", p_reason: "DRIVE_DELETE_FAILED", p_error: "Drive delete failed",
    });
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("treats an empty RPC result as unavailable", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await deleteEvidence(id)).toMatchObject({ ok: false });
    expect(fake.deleteDriveFile).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("does not repeat a completed deletion", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [{ type: "PHOTO", status: "DELETED", drive_file_id: null, blocked_count: 0 }], error: null });
    expect(await deleteEvidence(id)).toEqual({ ok: true });
    expect(fake.deleteDriveFile).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
  });
});
