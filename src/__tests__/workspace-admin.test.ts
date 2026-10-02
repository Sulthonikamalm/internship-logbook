import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";
import { createManagedUser } from "@/features/admin/server/users";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), elevated: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), profile: vi.fn(), audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/get-current-user", () => ({ getCurrentUser: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.elevated }));
const owner = { userId: "owner", isActive: true, isSuperAdmin: true };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue(owner); mocks.createUser.mockResolvedValue({ data: { user: { id: "created-user" } }, error: null });
  mocks.profile.mockResolvedValue({ data: { id: "created-user" }, error: null }); mocks.audit.mockResolvedValue({ error: null }); mocks.deleteUser.mockResolvedValue({ error: null });
  const profileQuery = { select: () => profileQuery, eq: () => profileQuery, single: mocks.profile };
  mocks.elevated.mockReturnValue({ auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } }, from: (table: string) => table === "profiles" ? profileQuery : { insert: mocks.audit } });
});
describe("Only the verified owner can create accounts", () => {
  const input = { name: "Pengguna Baru", email: "new@example.invalid", password: "ValidPassword123!" };
  it("requires exact verified email, active profile and a non-anonymous identity", () => {
    const identity = { email: "sulthon02032019@gmail.com", email_confirmed_at: "2026-10-01", is_anonymous: false };
    expect(isSuperAdminIdentity(identity, true)).toBe(true);
    expect(isSuperAdminIdentity({ ...identity, email: "admin@example.invalid" }, true)).toBe(false);
    expect(isSuperAdminIdentity({ ...identity, email_confirmed_at: undefined }, true)).toBe(false);
    expect(isSuperAdminIdentity({ ...identity, is_anonymous: true }, true)).toBe(false);
    expect(isSuperAdminIdentity(identity, false)).toBe(false);
  });
  it("denies ordinary users, another admin and expired/disabled sessions before using service-role", async () => {
    for (const user of [null, { ...owner, isSuperAdmin: false, role: "admin" }, { ...owner, isActive: false }]) {
      mocks.auth.mockResolvedValue(user); expect((await createManagedUser(input)).ok).toBe(false);
    }
    expect(mocks.elevated).not.toHaveBeenCalled();
  });
  it("rechecks authorization for every action, rejects role injection", async () => {
    expect((await createManagedUser({ ...input, role: "admin" })).ok).toBe(false); expect(mocks.createUser).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ ...owner, isSuperAdmin: false }); expect((await createManagedUser(input)).ok).toBe(false);
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });
  it("creates a confirmed account without sending email or logging the password", async () => {
    expect((await createManagedUser(input)).ok).toBe(true);
    expect(mocks.createUser).toHaveBeenCalledWith({ email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name } });
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(input.password);
    expect(mocks.audit.mock.calls[0][0]).toMatchObject({ actor_user_id: owner.userId, entity_id: "created-user", action: "user.created" });
  });
  it("rolls back only the newly created user if profile provisioning fails", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: { code: "missing" } });
    expect((await createManagedUser(input)).ok).toBe(false); expect(mocks.deleteUser).toHaveBeenCalledWith("created-user"); expect(mocks.audit).not.toHaveBeenCalled();
  });
});
