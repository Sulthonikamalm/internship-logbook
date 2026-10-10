// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driveMessage, mapDriveOAuthError } from "@/lib/google-drive/errors";

const apiUrl = "https://www.googleapis.com/drive/v3/files?fields=id";
const sessionUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test";
const token = (value = "fixture-access-token", expires = 3600) => Response.json({ access_token: value, expires_in: expires });
let client: typeof import("@/lib/google-drive/client");
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let logs: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CLIENT_ID", "fixture-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture-client-secret");
  vi.stubEnv("GOOGLE_REFRESH_TOKEN", "fixture-refresh-secret");
  vi.stubEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "fixture-private-root");
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  logs = vi.spyOn(console, "error").mockImplementation(() => {});
  client = await import("@/lib/google-drive/client");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Drive OAuth recovery", () => {
  it("reports invalid_grant without retrying a revoked refresh token or leaking provider details", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "invalid_grant", error_description: "fixture-refresh-secret" }, { status: 400 }));
    await expect(client.driveFetch(apiUrl)).rejects.toMatchObject({ code: "AUTH", status: 400, reason: "invalid_grant" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs.mock.calls.flat().join(" ")).toContain("reason=invalid_grant");
    expect(logs.mock.calls.flat().join(" ")).not.toContain("fixture-refresh-secret");
    expect(driveMessage("AUTH", "invalid_grant")).toContain("kedaluwarsa atau dicabut");
  });

  it("distinguishes invalid client configuration from expired permission", () => {
    expect(mapDriveOAuthError(400, "invalid_client").code).toBe("CONFIG");
    expect(mapDriveOAuthError(401, "invalid_client").code).toBe("CONFIG");
    expect(mapDriveOAuthError(400, "invalid_grant").code).toBe("AUTH");
    expect(mapDriveOAuthError(503).code).toBe("SERVER");
    expect(mapDriveOAuthError(400, "temporarily_unavailable").code).toBe("SERVER");
    expect(mapDriveOAuthError(429).code).toBe("RATE_LIMIT");
    expect(mapDriveOAuthError(400, "fixture-refresh-secret").reason).toBeUndefined();
  });

  it("rejects missing configuration before requesting a token", async () => {
    vi.stubEnv("GOOGLE_REFRESH_TOKEN", "");
    await expect(client.driveFetch(apiUrl)).rejects.toMatchObject({ code: "CONFIG", reason: "missing_configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares one token refresh across simultaneous uploads", async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async url => {
      if (String(url).includes("oauth2.googleapis.com")) { refreshes++; return token(); }
      return Response.json({ id: "fixture" });
    });
    const responses = await Promise.all([client.driveFetch(apiUrl), client.driveFetch(apiUrl), client.driveFetch(apiUrl)]);
    expect(responses.every(response => response.ok)).toBe(true);
    expect(refreshes).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("refreshes and replays a rejected access token once, preserving the upload request", async () => {
    fetchMock.mockResolvedValueOnce(token("old-token"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(token("new-token"))
      .mockResolvedValueOnce(Response.json({ id: "fixture" }));
    await expect(client.driveFetch(apiUrl, { method: "POST", headers: { Origin: "https://example.test" }, body: "{}" })).resolves.toHaveProperty("status", 200);
    const requests = fetchMock.mock.calls.filter(([url]) => String(url).includes("www.googleapis.com"));
    expect(requests.map(([, init]) => new Headers(init?.headers).get("Authorization"))).toEqual(["Bearer old-token", "Bearer new-token"]);
    expect(requests.every(([, init]) => init?.method === "POST" && init?.body === "{}" && new Headers(init.headers).get("Origin") === "https://example.test")).toBe(true);
  });

  it("bounds auth retries when Google rejects even the newly issued access token", async () => {
    fetchMock.mockResolvedValueOnce(token("old-token"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(token("new-token"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(client.driveFetch(apiUrl)).rejects.toMatchObject({ code: "AUTH", reason: "invalid_access_token" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("allows recovery after a failed refresh instead of retaining a rejected promise", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "invalid_grant" }, { status: 400 }));
    await expect(client.driveFetch(apiUrl)).rejects.toMatchObject({ code: "AUTH" });
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(Response.json({ id: "fixture" }));
    await expect(client.driveFetch(apiUrl)).resolves.toHaveProperty("status", 200);
  });

  it("invalidates cached access when refresh credentials are rotated", async () => {
    fetchMock.mockResolvedValueOnce(token("old-token")).mockResolvedValueOnce(Response.json({ id: "fixture" }))
      .mockResolvedValueOnce(token("new-token")).mockResolvedValueOnce(Response.json({ id: "fixture" }));
    await client.driveFetch(apiUrl);
    vi.stubEnv("GOOGLE_REFRESH_TOKEN", "rotated-fixture-secret");
    await client.driveFetch(apiUrl);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2.googleapis.com"))).toHaveLength(2);
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("Authorization")).toBe("Bearer new-token");
  });

  it("never caches a token beyond its short provider lifetime", async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async url => {
      if (String(url).includes("oauth2.googleapis.com")) { refreshes++; return token("short-token", 20); }
      return Response.json({ id: "fixture" });
    });
    await client.driveFetch(apiUrl);
    await client.driveFetch(apiUrl);
    expect(refreshes).toBe(2);
  });

  it("retries temporary OAuth server failures without reporting a disconnected account", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ error: "temporarily_unavailable" }, { status: 400 }))
      .mockResolvedValueOnce(token()).mockResolvedValueOnce(Response.json({ id: "fixture" }));
    const assertion = expect(client.driveFetch(apiUrl)).resolves.toHaveProperty("status", 200);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(logs).not.toHaveBeenCalled();
  });

  it("classifies a malformed successful OAuth response as a provider error", async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 123 }));
    await expect(client.driveFetch(apiUrl)).rejects.toMatchObject({ code: "SERVER", reason: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers auth while preserving resumable upload status responses", async () => {
    fetchMock.mockResolvedValueOnce(token("old-token"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(token("new-token"))
      .mockResolvedValueOnce(new Response(null, { status: 308 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await client.driveUploadStatusFetch(sessionUrl, 100)).status).toBe(308);
    expect((await client.driveUploadStatusFetch(sessionUrl, 100)).status).toBe(404);
    const requests = fetchMock.mock.calls.filter(([url]) => String(url).includes("www.googleapis.com"));
    expect(requests.every(([, init]) => init?.method === "PUT" && new Headers(init.headers).get("Content-Range") === "bytes */100")).toBe(true);
  });

  it("does not refresh credentials for an untrusted upload endpoint", async () => {
    await expect(client.driveUploadStatusFetch("https://attacker.invalid/upload", 100)).rejects.toMatchObject({ code: "UNKNOWN" });
    await expect(client.driveFetch("https://www.googleapis.com:8443/drive/v3/files")).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
