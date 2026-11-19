// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { validatePublicConfig } from "../../scripts/logbook/public-config.mjs";

const anon = `fixture.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
const secret = `fixture.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
vi.mock("@/lib/env/client", () => ({ getClientEnv: () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://database.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: `fixture.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`,
  SUPABASE_SERVICE_ROLE_KEY: "server-secret-fixture", GOOGLE_REFRESH_TOKEN: "drive-secret-fixture",
}) }));
import { GET } from "@/app/api/mcp/config/route";

describe("public MCP onboarding configuration", () => {
  const config = { version: 1, appUrl: "https://internflow.example", supabaseUrl: "https://database.example", publishableKey: anon };
  it("serves only public auth settings without requiring an app session", async () => {
    const result = await GET(new Request("https://internflow.example/api/mcp/config"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(config);
  });
  it("drops all extra fields and rejects service-role or secret keys", () => {
    expect(validatePublicConfig({ ...config, password: "do-not-ship", serviceRoleKey: secret })).toEqual(config);
    for (const publishableKey of [secret, "sb_secret_do-not-ship", "invalid"])
      expect(() => validatePublicConfig({ ...config, publishableKey })).toThrow();
    expect(validatePublicConfig({ ...config, publishableKey: "sb_publishable_public-fixture" }).publishableKey).toBe("sb_publishable_public-fixture");
  });
  it("preserves the public host when Next uses an internal origin", async () => {
    const result = await GET(new Request("http://localhost:3027/api/mcp/config", { headers: { host: "public.example", "x-forwarded-proto": "https" } }));
    expect((await result.json()).appUrl).toBe("https://public.example");
  });
  it("rejects credential-bearing URLs and insecure remote origins", () => {
    for (const appUrl of ["https://user:password@internflow.example", "http://remote.example", "https://internflow.example/path", "https://internflow.example#secret"])
      expect(() => validatePublicConfig({ ...config, appUrl })).toThrow();
    expect(validatePublicConfig({ ...config, appUrl: "http://127.0.0.1:3027" }).appUrl).toBe("http://127.0.0.1:3027");
  });
});
