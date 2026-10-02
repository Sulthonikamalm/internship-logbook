import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: mocks.signIn } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { loginAction } from "@/features/auth/actions/login";

function credentials(next: string) {
  const data = new FormData();
  data.set("email", "fixture@example.invalid");
  data.set("password", "fixture-password");
  data.set("next", next);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });
});

describe("Login navigation after cookie updates", () => {
  it("redirects on the server to the original destination and does not catch the redirect", async () => {
    await expect(loginAction(null, credentials("/integrations?repo=owner%2Frepo")))
      .rejects.toThrow("NEXT_REDIRECT:/integrations?repo=owner%2Frepo");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });
  it.each(["https://evil.example/", "/login?next=/reports"])("rejects unsafe or cyclic destination %s", async (next) => {
    await expect(loginAction(null, credentials(next))).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
  it("keeps authentication errors generic without navigating", async () => {
    mocks.signIn.mockResolvedValue({ error: new Error("Private provider detail") });
    const state = await loginAction(null, credentials("/integrations"));
    expect(state.success).toBe(false);
    expect(state.error?.message).toBe("Email atau password tidak valid.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("does not sign in or navigate when form validation fails", async () => {
    const data = credentials("/integrations");
    data.set("email", "invalid");
    expect((await loginAction(null, data)).fieldErrors?.email).toBeTruthy();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
