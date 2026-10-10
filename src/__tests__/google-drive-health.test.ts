import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ auth: vi.fn(), root: vi.fn() }));
vi.mock("@/lib/auth/require-active-user", () => ({ requireActiveUser: fake.auth }));
vi.mock("@/lib/google-drive/metadata", () => ({ assertPrivateDriveRoot: fake.root }));
import { getDriveHealth } from "@/features/integrations/drive/server/health";
import { DriveError } from "@/lib/google-drive/errors";

beforeEach(() => { vi.clearAllMocks(); fake.auth.mockResolvedValue({ userId: "fixture" }); fake.root.mockResolvedValue("private-root"); });
describe("Google Drive integration status", () => {
  it("checks actual Drive access before reporting that uploads are ready", async () => {
    expect(await getDriveHealth()).toEqual({ ready: true, message: "Koneksi aktif. Penyimpanan foto dapat diakses." });
    expect(fake.root).toHaveBeenCalledOnce();
  });
  it("shows expired OAuth permission instead of a configured/ready indicator", async () => {
    fake.root.mockRejectedValue(new DriveError("AUTH", 400, "invalid_grant"));
    const status = await getDriveHealth();
    expect(status.ready).toBe(false);
    expect(status.message).toContain("kedaluwarsa atau dicabut");
    expect(JSON.stringify(status)).not.toContain("private-root");
  });
  it("requires an active session before checking shared storage", async () => {
    fake.auth.mockRejectedValue(new Error("session-required"));
    await expect(getDriveHealth()).rejects.toThrow("session-required");
    expect(fake.root).not.toHaveBeenCalled();
  });
});
