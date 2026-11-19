import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateAgent } from "@/features/agent/server/auth";
const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn(), profile: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@/lib/env/client", () => ({ getClientEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://db.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }) }));
beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-owner" } }, error: null });
  mocks.profile.mockResolvedValue({ data: { display_name: "Owner", role: "user", is_active: true, timezone: "Asia/Jakarta" }, error: null });
  const chain = { select: () => chain, eq: vi.fn(() => chain), single: mocks.profile };
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser }, from: () => chain });
});
describe("Codex bearer authentication", () => {
  it("requires a bearer session instead of accepting cookies or a supplied owner", async () => {
    await expect(authenticateAgent(new Request("https://app.example/api/agent/runs", { headers: { Cookie: "user_id=someone" } }))).rejects.toMatchObject({ status: 401 });
  });
  it("validates the actual token and supplies it to the RLS client", async () => {
    const actor = await authenticateAgent(new Request("https://app.example/api/agent/runs?userId=someone", { headers: { Authorization: "Bearer fixture-token" } }));
    expect(mocks.getUser).toHaveBeenCalledWith("fixture-token"); expect(actor.user.userId).toBe("verified-owner");
    expect(mocks.create).toHaveBeenCalledWith("https://db.example", "public-key", expect.objectContaining({ global: { headers: { Authorization: "Bearer fixture-token" } } }));
  });
  it("rejects revoked sessions and disabled users", async () => {
    const request = new Request("https://app.example/api/agent/runs", { headers: { Authorization: "Bearer fixture-token" } });
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    await expect(authenticateAgent(request)).rejects.toMatchObject({ status: 401 });
    mocks.profile.mockResolvedValueOnce({ data: { is_active: false }, error: null });
    await expect(authenticateAgent(request)).rejects.toMatchObject({ status: 403 });
  });
});
