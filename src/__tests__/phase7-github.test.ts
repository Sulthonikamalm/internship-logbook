import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { GET as connectGitHub } from "@/app/api/integrations/github/connect/route";
import ExcelJS from "exceljs";
import { createGitHubAuthUrl, verifyAndClearOAuthState, saveGitHubConnectionAndToken, exchangeGitHubCode } from "@/features/integrations/github/server/oauth";
import { encryptGitHubToken, decryptGitHubToken } from "@/features/integrations/github/server/token-crypto";
import { syncGitHubCommits } from "@/features/integrations/github/server/sync-commits";
import { disconnectGitHub } from "@/features/integrations/github/server/disconnect";
import { attachCommitEvidence } from "@/features/integrations/github/server/attach-commit-evidence";
import { attachCommitSchema } from "@/features/integrations/github/schemas/github.schema";
import { buildEvidenceSheet } from "@/features/reports/excel/build-evidence-sheet";
import { formatEvidenceSummary } from "@/features/reports/excel/build-logbook-sheet";

const mocks = vi.hoisted(() => ({ adminRpc: vi.fn(), userRpc: vi.fn(), token: vi.fn(), fetch: vi.fn(), cookie: new Map<string, { value: string; options: Record<string, unknown> }>(), key: "ab".repeat(32), callback: undefined as string | undefined }));
const owner = "00000000-0000-4000-8000-0000000000a1";
const commitId = "00000000-0000-4000-8000-000000000001";
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000", GITHUB_CALLBACK_URL: mocks.callback, GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret", GITHUB_TOKEN_ENCRYPTION_KEY: mocks.key }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => mocks.cookie.get(name), set: (name: string, value: string, options: Record<string, unknown>) => mocks.cookie.set(name, { value, options }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/require-active-user", () => ({ requireActiveUser: async () => ({ userId: owner, timezone: "Asia/Jakarta", isActive: true }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.userRpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.adminRpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.token }) }) }) }) }));
function response(data: unknown, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }); }
const repo = { id: 10, full_name: "qa/repo", default_branch: "main" };
const commit = { sha: "a".repeat(40), author: { id: 42 }, commit: { message: "Implement feature", author: { date: "2026-10-01T09:00:00Z" }, committer: null } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.cookie.clear(); mocks.key = "ab".repeat(32); mocks.callback = undefined; vi.stubGlobal("fetch", mocks.fetch);
  mocks.token.mockResolvedValue({ data: { access_token: encryptGitHubToken("test-provider-token") }, error: null });
  mocks.adminRpc.mockImplementation(async (name: string) => name === "begin_github_sync" ? { data: { ok: true, connection: { version: 7, github_user_id: "42", github_username: "qa" } }, error: null } : { data: true, error: null });
  mocks.userRpc.mockResolvedValue({ data: { ok: true, evidenceId: commitId, reused: false }, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("OAuth and encrypted token boundary", () => {
  it("starts OAuth on the canonical origin before writing a state cookie", async () => {
    const result = await connectGitHub(new NextRequest("http://127.0.0.1:3000/api/integrations/github/connect?private=1&replace=1&unknown=1", { headers: { host: "127.0.0.1:3000" } }));
    expect(result.headers.get("location")).toBe("http://localhost:3000/api/integrations/github/connect?private=1&replace=1");
    expect(mocks.cookie.size).toBe(0);
  });
  it("rejects callback origins that cannot receive the path-scoped state cookie", async () => {
    mocks.callback = "http://127.0.0.1:3000/api/integrations/github/callback";
    await expect(createGitHubAuthUrl(owner)).rejects.toThrow("GITHUB_CALLBACK_NOT_CONFIGURED");
    expect(mocks.cookie.size).toBe(0);
  });
  it("uses opaque state and S256 PKCE, keeping the verifier in an HttpOnly path-scoped cookie", async () => {
    const result = await createGitHubAuthUrl(owner); const url = new URL(result.url);
    const cookie = mocks.cookie.get("gh_oauth_state")!; const decoded = JSON.parse(Buffer.from(cookie.value, "base64url").toString());
    expect(result.state).toMatch(/^[a-f0-9]{64}$/); expect(result.url).not.toContain(owner);
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(decoded.verifier).digest("base64url"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("scope")).toBe("read:user");
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/integrations/github", maxAge: 600 });
  });
  it("only requests private repository access when explicitly selected", async () => {
    const result = await createGitHubAuthUrl(owner, { privateRepos: true, allowReplace: true });
    expect(new URL(result.url).searchParams.get("scope")).toBe("read:user repo");
    expect(await verifyAndClearOAuthState(result.state, owner)).toMatchObject({ valid: true, allowReplace: true });
  });
  it("consumes state exactly once using the same cookie path", async () => {
    const result = await createGitHubAuthUrl(owner); expect((await verifyAndClearOAuthState(result.state, owner)).valid).toBe(true);
    expect(mocks.cookie.get("gh_oauth_state")?.options).toMatchObject({ maxAge: 0, path: "/api/integrations/github" });
    expect((await verifyAndClearOAuthState(result.state, owner)).valid).toBe(false);
  });
  it("rejects a cross-user callback and corrupted state", async () => {
    const result = await createGitHubAuthUrl(owner);
    expect(await verifyAndClearOAuthState(result.state, commitId)).toMatchObject({ valid: false, reason: "user_mismatch" });
    expect((await verifyAndClearOAuthState("invalid", owner)).valid).toBe(false);
  });
  it("rejects expired and future-dated authorization cookies", async () => {
    vi.useFakeTimers(); const now = new Date("2026-10-01T00:00:00Z"); vi.setSystemTime(now);
    const result = await createGitHubAuthUrl(owner); vi.setSystemTime(new Date(now.getTime() + 601000));
    expect(await verifyAndClearOAuthState(result.state, owner)).toMatchObject({ valid: false, reason: "state_expired" });
    const fresh = await createGitHubAuthUrl(owner); vi.setSystemTime(now);
    expect(await verifyAndClearOAuthState(fresh.state, owner)).toMatchObject({ valid: false, reason: "state_expired" });
  });
  it("encrypts with unique nonces and detects tampering, legacy plaintext and wrong keys", () => {
    const first = encryptGitHubToken("secret-fixture"); const second = encryptGitHubToken("secret-fixture");
    expect(first).not.toBe(second); expect(first).not.toContain("secret-fixture"); expect(decryptGitHubToken(first)).toBe("secret-fixture");
    const parts = first.split("."); const cipher = Buffer.from(parts[3], "base64url"); cipher[0] ^= 1; parts[3] = cipher.toString("base64url");
    expect(() => decryptGitHubToken(parts.join("."))).toThrow(); expect(() => decryptGitHubToken("legacy-plain-token")).toThrow();
    mocks.key = "cd".repeat(32); expect(() => decryptGitHubToken(first)).toThrow();
  });
  it("stores encrypted token and metadata with one atomic service-only RPC", async () => {
    mocks.adminRpc.mockResolvedValue({ data: { id: commitId, user_id: owner, github_user_id: "42", github_username: "qa", connection_status: "CONNECTED" }, error: null });
    const connection = await saveGitHubConnectionAndToken({ userId: owner, githubUserId: "42", githubUsername: "qa", scopes: ["read:user"], accessToken: "test-provider-token", tokenType: "bearer" });
    const args = mocks.adminRpc.mock.calls[0][1]; expect(decryptGitHubToken(args.p_ciphertext)).toBe("test-provider-token"); expect(JSON.stringify(connection)).not.toContain("test-provider-token");
    expect(mocks.adminRpc.mock.calls[0][0]).toBe("store_github_connection");
  });
  it("includes the verifier in the exchange and rejects provider error payloads", async () => {
    mocks.fetch.mockResolvedValue(response({ error: "bad_verification_code" }));
    await expect(exchangeGitHubCode("code", "http://localhost/callback", "verifier")).rejects.toThrow("GITHUB_EXCHANGE_FAILED");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).code_verifier).toBe("verifier");
  });
});

describe("GitHub sync resilience", () => {
  it("directly queries a selected repo and caches only commits owned by the connected identity", async () => {
    mocks.fetch.mockResolvedValueOnce(response(repo)).mockResolvedValueOnce(response([commit, { ...commit, sha: "b".repeat(40), author: { id: 99 } }]));
    const result = await syncGitHubCommits("qa/repo"); expect(result).toMatchObject({ ok: true, syncedCount: 1 });
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.github.com/repos/qa/repo");
    const finish = mocks.adminRpc.mock.calls.find(call => call[0] === "finish_github_sync")![1];
    expect(finish.p_commits).toHaveLength(1); expect(finish.p_commits[0].commit_url).toBe(`https://github.com/qa/repo/commit/${commit.sha}`);
  });
  it("invalidates revoked tokens without removing historical evidence", async () => {
    mocks.fetch.mockResolvedValue(response({}, 401)); expect(await syncGitHubCommits()).toMatchObject({ ok: false, code: "REAUTH_REQUIRED" });
    expect(mocks.adminRpc.mock.calls.find(call => call[0] === "finish_github_sync")![1]).toMatchObject({ p_reauth: true, p_complete: false });
  });
  it("distinguishes rate limiting from repository permission failures", async () => {
    mocks.fetch.mockResolvedValueOnce(response({}, 403, { "x-ratelimit-remaining": "0", "retry-after": "60" })).mockResolvedValueOnce(response({}, 403));
    expect(await syncGitHubCommits("qa/repo")).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAt: expect.any(String) });
    expect(await syncGitHubCommits("qa/repo")).toMatchObject({ ok: false, code: "REPO_UNAVAILABLE" });
  });
  it("treats an empty repository as a successful zero-commit sync", async () => {
    mocks.fetch.mockResolvedValueOnce(response(repo)).mockResolvedValueOnce(response({}, 409));
    expect(await syncGitHubCommits("qa/repo")).toMatchObject({ ok: true, syncedCount: 0 });
  });
  it("reports partial sync and does not mark the entire batch complete", async () => {
    mocks.fetch.mockResolvedValueOnce(response([repo, { ...repo, id: 11, full_name: "qa/other" }])).mockResolvedValueOnce(response([commit])).mockResolvedValueOnce(response({}, 404));
    expect(await syncGitHubCommits()).toMatchObject({ ok: false, code: "PARTIAL", syncedCount: 1 });
    expect(mocks.adminRpc.mock.calls.find(call => call[0] === "finish_github_sync")![1]).toMatchObject({ p_complete: false, p_unavailable_repos: ["qa/other"] });
  });
  it("rejects a stale finish after a concurrent disconnect", async () => {
    mocks.fetch.mockResolvedValueOnce(response(repo)).mockResolvedValueOnce(response([commit]));
    mocks.adminRpc.mockImplementation(async name => name === "begin_github_sync" ? { data: { ok: true, connection: { version: 7, github_user_id: "42", github_username: "qa" } }, error: null } : { data: false, error: null });
    expect(await syncGitHubCommits("qa/repo")).toMatchObject({ ok: false, code: "NOT_CONNECTED" });
  });
  it("does not claim saved commits when cache persistence fails", async () => {
    mocks.fetch.mockResolvedValueOnce(response(repo)).mockResolvedValueOnce(response([commit]));
    mocks.adminRpc.mockImplementation(async name => name === "begin_github_sync" ? { data: { ok: true, connection: { version: 7, github_user_id: "42", github_username: "qa" } }, error: null } : { data: null, error: { message: "private database detail" } });
    expect(await syncGitHubCommits("qa/repo")).toMatchObject({ ok: false, code: "SYNC_ERROR" });
  });
  it("does not call the provider when a sync lease is already held", async () => {
    mocks.adminRpc.mockResolvedValue({ data: { ok: false, code: "SYNC_IN_PROGRESS" }, error: null });
    expect(await syncGitHubCommits()).toMatchObject({ ok: false, code: "SYNC_IN_PROGRESS" }); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("Commit selection and disconnect boundary", () => {
  it("rejects browser-fabricated commit snapshots", () => {
    expect(attachCommitSchema.safeParse({ repositoryName: "attacker/repo", sha: "a".repeat(40), commitUrl: "https://evil.invalid" }).success).toBe(false);
    expect(attachCommitSchema.safeParse({ commitId, commitUrl: "https://evil.invalid" }).success).toBe(false);
  });
  it("selects an owned cache ID and targets through one transactional RPC", async () => {
    expect(await attachCommitEvidence({ commitId, todoId: owner })).toMatchObject({ ok: true, evidenceId: commitId });
    expect(mocks.userRpc).toHaveBeenCalledWith("select_github_commit_evidence", { p_commit_id: commitId, p_activity_id: null, p_todo_id: owner, p_title: null, p_note: null });
  });
  it("preserves an authoritative unavailable-source response", async () => {
    mocks.userRpc.mockResolvedValue({ data: { ok: false, message: "Commit tidak tersedia." }, error: null });
    expect((await attachCommitEvidence({ commitId })).ok).toBe(false);
  });
  it("uses the historical-preserving disconnect transaction and reports failures", async () => {
    expect((await disconnectGitHub()).ok).toBe(true); expect(mocks.adminRpc).toHaveBeenCalledWith("disconnect_github", { p_user_id: owner });
    mocks.adminRpc.mockResolvedValue({ error: { message: "private error" } }); expect((await disconnectGitHub()).ok).toBe(false);
  });
  it("keeps GitHub links in Excel and identifies commits in summaries", () => {
    const url = `https://github.com/qa/repo/commit/${commit.sha}`;
    expect(formatEvidenceSummary([{ id: commitId, type: "GITHUB_COMMIT", title: "Work", status: "AVAILABLE", url }])).toBe("1 Commit");
    const workbook = new ExcelJS.Workbook(); buildEvidenceSheet(workbook, [{ evidenceId: commitId, activityId: owner, activityDate: "2026-10-01", type: "GITHUB_COMMIT", title: "Work", status: "AVAILABLE", url }], "https://internflow.invalid");
    expect(workbook.getWorksheet("Evidence Detail")?.getRow(2).getCell(5).value).toMatchObject({ hyperlink: url });
  });
});
