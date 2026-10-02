import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/lib/env/client", () => ({ getClientEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture" }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: { name: string; value: string; options: { path: string } }[], headers: Record<string, string>) => void } }) => ({ auth: { getUser: async () => {
  options.cookies.setAll([{ name: "fixture-session", value: "refreshed-fixture", options: { path: "/" } }], { "Cache-Control": "private, no-store", "Pragma": "no-cache" });
  return { data: { user: fake.user } };
} } }) }));
import { updateSession } from "@/lib/supabase/middleware";
beforeEach(() => { fake.user = null; });
describe("Session refresh redirects", () => {
  it.each(["todos", "evidence", "logbook", "reports", "integrations", "settings"])("preserves %s destination and refreshed cookie/cache headers on login redirect", async (path) => {
    const response = await updateSession(new NextRequest(`http://localhost:3000/${path}?view=recent`));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("next")).toBe(`/${path}?view=recent`);
    expect(response.cookies.get("fixture-session")?.value).toBe("refreshed-fixture");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
  it("retains destination query, refreshed cookies and cache headers after authentication", async () => {
    fake.user = { id: "fixture" };
    const response = await updateSession(new NextRequest("http://localhost:3000/login?next=%2Freports%3Fmonth%3D2026-10"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/reports?month=2026-10");
    expect(response.cookies.get("fixture-session")?.value).toBe("refreshed-fixture");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["", "/login?next=/integrations", "/%6cogin", "//evil.example", "https://evil.example/"])("falls back safely for invalid or cyclic login destination %s", async (next) => {
    fake.user = { id: "fixture" };
    const response = await updateSession(new NextRequest(`http://localhost:3000/login?next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
