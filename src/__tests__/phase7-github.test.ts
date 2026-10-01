/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

// Import modules under test
import {
  createGitHubAuthUrl,
  verifyAndClearOAuthState,
  saveGitHubConnectionAndToken,
} from "@/features/integrations/github/server/oauth";
import { syncGitHubCommits } from "@/features/integrations/github/server/sync-commits";
import { disconnectGitHub } from "@/features/integrations/github/server/disconnect";
import { attachCommitEvidence } from "@/features/integrations/github/server/attach-commit-evidence";
import {
  getGitHubConnection,
  listGitHubCommits,
  listUserGitHubRepos,
} from "@/features/integrations/github/server/queries";
import { buildEvidenceSheet } from "@/features/reports/excel/build-evidence-sheet";
import { formatEvidenceSummary } from "@/features/reports/excel/build-logbook-sheet";

// Test Users
const userA = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  email: "sulthon@internflow.invalid",
  role: "intern" as const,
  displayName: "Sulthon User A",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

const userB = {
  userId: "00000000-0000-4000-8000-0000000000b2",
  email: "attacker@internflow.invalid",
  role: "intern" as const,
  displayName: "Attacker User B",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

let currentUser = userA;

// In-Memory Database Store for Testing
let dbConnections: any[] = [];
let dbTokens: any[] = [];
let dbCommits: any[] = [];
let dbEvidences: any[] = [];
let dbGithubEvidences: any[] = [];
let dbActivities: any[] = [];
let dbActivityEvidences: any[] = [];
let dbTodos: any[] = [];
let dbTodoEvidences: any[] = [];
let dbAuditLogs: any[] = [];

// Cookie store mock
let cookieJar: Record<string, { value: string; options?: any }> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar[name],
    set: (name: string, value: string, options?: any) => {
      cookieJar[name] = { value, options };
    },
    delete: (name: string) => {
      delete cookieJar[name];
    },
  }),
}));

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveUser: async () => currentUser,
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    NODE_ENV: "test",
    APP_ENV: "test",
    APP_BASE_URL: "http://localhost:3000",
    GITHUB_CLIENT_ID: "mock-gh-client-id",
    GITHUB_CLIENT_SECRET: "mock-gh-client-secret",
    GITHUB_CALLBACK_URL: "http://localhost:3000/api/integrations/github/callback",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase User Client
function buildMockQuery(tableName: string) {
  let filtered: any[] = [];
  if (tableName === "github_connections") filtered = [...dbConnections];
  else if (tableName === "github_tokens") filtered = [...dbTokens];
  else if (tableName === "github_commits") filtered = [...dbCommits];
  else if (tableName === "evidences") filtered = [...dbEvidences];
  else if (tableName === "github_evidences") filtered = [...dbGithubEvidences];
  else if (tableName === "activities") filtered = [...dbActivities];
  else if (tableName === "activity_evidences") filtered = [...dbActivityEvidences];
  else if (tableName === "todos") filtered = [...dbTodos];
  else if (tableName === "todo_evidences") filtered = [...dbTodoEvidences];
  else if (tableName === "audit_logs") filtered = [...dbAuditLogs];

  const query: any = {
    _filters: [] as ((item: any) => boolean)[],
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation((field: string, val: any) => {
      query._filters.push((item: any) => item[field] === val);
      return query;
    }),
    in: vi.fn().mockImplementation((field: string, vals: any[]) => {
      query._filters.push((item: any) => vals.includes(item[field]));
      return query;
    }),
    is: vi.fn().mockImplementation((field: string, val: any) => {
      query._filters.push((item: any) =>
        val === null ? item[field] === null || item[field] === undefined : item[field] === val
      );
      return query;
    }),
    ilike: vi.fn().mockImplementation((field: string, val: string) => {
      const clean = val.replace(/%/g, "").toLowerCase();
      query._filters.push((item: any) => (item[field] || "").toLowerCase().includes(clean));
      return query;
    }),
    gte: vi.fn().mockImplementation((field: string, val: string) => {
      query._filters.push((item: any) => item[field] >= val);
      return query;
    }),
    lte: vi.fn().mockImplementation((field: string, val: string) => {
      query._filters.push((item: any) => item[field] <= val);
      return query;
    }),
    order: vi.fn().mockImplementation(() => query),
    range: vi.fn().mockImplementation((start: number, end: number) => {
      const res = filtered.filter((item: any) => query._filters.every((f: any) => f(item)));
      return {
        data: res.slice(start, end + 1),
        count: res.length,
        error: null,
      };
    }),
    single: vi.fn().mockImplementation(() => {
      const res = filtered.filter((item: any) => query._filters.every((f: any) => f(item)));
      return { data: res[0] || null, error: res[0] ? null : { message: "Not found" } };
    }),
    maybeSingle: vi.fn().mockImplementation(() => {
      const res = filtered.filter((item: any) => query._filters.every((f: any) => f(item)));
      return { data: res[0] || null, error: null };
    }),
    insert: vi.fn().mockImplementation((payload: any) => {
      const items = Array.isArray(payload) ? payload : [payload];
      const inserted: any[] = [];
      for (const itm of items) {
        const id = itm.id || `gen-${Math.random().toString(36).substring(2, 9)}`;
        const record = { deleted_at: null, ...itm, id, created_at: itm.created_at || new Date().toISOString() };
        inserted.push(record);
        if (tableName === "evidences") dbEvidences.push(record);
        else if (tableName === "github_evidences") dbGithubEvidences.push(record);
        else if (tableName === "audit_logs") dbAuditLogs.push(record);
      }
      return {
        data: inserted[0],
        error: null,
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: inserted[0], error: null }),
        }),
      };
    }),
    upsert: vi.fn().mockImplementation((payload: any) => {
      const items = Array.isArray(payload) ? payload : [payload];
      for (const itm of items) {
        if (tableName === "github_connections") {
          const idx = dbConnections.findIndex((c) => c.user_id === itm.user_id);
          if (idx >= 0) dbConnections[idx] = { ...dbConnections[idx], ...itm };
          else dbConnections.push({ ...itm, id: `conn-${Date.now()}` });
        } else if (tableName === "github_tokens") {
          const idx = dbTokens.findIndex((t) => t.user_id === itm.user_id);
          if (idx >= 0) dbTokens[idx] = { ...dbTokens[idx], ...itm };
          else dbTokens.push({ ...itm, id: `token-${Date.now()}` });
        } else if (tableName === "github_commits") {
          const idx = dbCommits.findIndex(
            (c) => c.user_id === itm.user_id && c.repository_id === itm.repository_id && c.sha === itm.sha
          );
          if (idx >= 0) dbCommits[idx] = { ...dbCommits[idx], ...itm };
          else dbCommits.push({ ...itm, id: itm.id || `commit-${Date.now()}-${Math.random()}` });
        } else if (tableName === "activity_evidences") {
          const idx = dbActivityEvidences.findIndex(
            (ae) => ae.activity_id === itm.activity_id && ae.evidence_id === itm.evidence_id
          );
          if (idx < 0) dbActivityEvidences.push(itm);
        } else if (tableName === "todo_evidences") {
          const idx = dbTodoEvidences.findIndex(
            (te) => te.todo_id === itm.todo_id && te.evidence_id === itm.evidence_id
          );
          if (idx < 0) dbTodoEvidences.push(itm);
        }
      }
      return {
        data: items[0],
        error: null,
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: items[0], error: null }),
        }),
      };
    }),
    update: vi.fn().mockImplementation((updates: any) => {
      return {
        eq: vi.fn().mockImplementation((f: string, v: any) => {
          if (tableName === "github_connections") {
            dbConnections = dbConnections.map((c) => (c[f] === v ? { ...c, ...updates } : c));
          }
          return { error: null };
        }),
      };
    }),
    delete: vi.fn().mockImplementation(() => {
      return {
        eq: vi.fn().mockImplementation((f: string, v: any) => {
          if (tableName === "github_tokens") {
            dbTokens = dbTokens.filter((t) => t[f] !== v);
          } else if (tableName === "evidences") {
            dbEvidences = dbEvidences.filter((e) => e[f] !== v);
          }
          return { error: null };
        }),
      };
    }),
  };

  // Add thenable support for await supabase.from(...)
  query.then = function (resolve: any) {
    const res = filtered.filter((item: any) => query._filters.every((f: any) => f(item)));
    resolve({ data: res, error: null, count: res.length });
  };

  return query;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => buildMockQuery(table),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => buildMockQuery(table),
  }),
}));

describe("Phase 7 — Optional GitHub Integration & Commit Evidence", () => {
  beforeEach(() => {
    currentUser = userA;
    cookieJar = {};
    dbConnections = [];
    dbTokens = [];
    dbCommits = [];
    dbEvidences = [];
    dbGithubEvidences = [];
    dbActivities = [];
    dbActivityEvidences = [];
    dbTodos = [];
    dbTodoEvidences = [];
    dbAuditLogs = [];
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. OAuth State Generation & Security Verification
  // =========================================================================
  describe("OAuth State Security Boundary", () => {
    it("generates user-bound state and stores in cookie", async () => {
      const { url, state } = await createGitHubAuthUrl(userA.userId);

      expect(url).toContain("https://github.com/login/oauth/authorize");
      expect(url).toContain("client_id=mock-gh-client-id");
      expect(url).toContain("scope=read%3Auser+repo");
      expect(url).toContain(`state=${encodeURIComponent(state)}`);

      // Cookie check
      expect(cookieJar["gh_oauth_state"]).toBeDefined();
      expect(cookieJar["gh_oauth_state"].value).toBe(state);
    });

    it("verifies state successfully and immediately deletes cookie (one-time use)", async () => {
      const { state } = await createGitHubAuthUrl(userA.userId);

      const verification = await verifyAndClearOAuthState(state, userA.userId);
      expect(verification.valid).toBe(true);

      // Cookie must be deleted after use
      expect(cookieJar["gh_oauth_state"]).toBeUndefined();

      // Second attempt with same state must fail
      const secondAttempt = await verifyAndClearOAuthState(state, userA.userId);
      expect(secondAttempt.valid).toBe(false);
      expect(secondAttempt.reason).toBe("state_mismatch");
    });

    it("rejects state if used by a different user (cross-user attack mitigation)", async () => {
      const { state } = await createGitHubAuthUrl(userA.userId);

      // User B tries to use User A's OAuth state
      const verification = await verifyAndClearOAuthState(state, userB.userId);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe("user_mismatch");
    });

    it("rejects manipulated or corrupted state string", async () => {
      cookieJar["gh_oauth_state"] = { value: "corrupted_state_payload" };

      const verification = await verifyAndClearOAuthState("corrupted_state_payload", userA.userId);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe("invalid_state_format");
    });
  });

  // =========================================================================
  // 2. Token Security & Storage Isolation
  // =========================================================================
  describe("Token Storage & Secret Isolation", () => {
    it("stores token in private github_tokens table without exposing in public connection", async () => {
      const secretToken = "gho_SUPER_SECRET_TOKEN_1234567890";

      const conn = await saveGitHubConnectionAndToken({
        userId: userA.userId,
        githubUserId: "123456",
        githubUsername: "sulthonikamal",
        scopes: ["read:user", "repo"],
        accessToken: secretToken,
        tokenType: "bearer",
      });

      expect(conn.githubUsername).toBe("sulthonikamal");
      expect(conn.connectionStatus).toBe("CONNECTED");
      expect((conn as any).accessToken).toBeUndefined();

      // Check tokens table has it
      expect(dbTokens.length).toBe(1);
      expect(dbTokens[0].access_token).toBe(secretToken);
      expect(dbTokens[0].user_id).toBe(userA.userId);

      // Check public query does NOT return access token
      const fetchedConn = await getGitHubConnection();
      expect(fetchedConn?.githubUsername).toBe("sulthonikamal");
      expect((fetchedConn as any).access_token).toBeUndefined();

      // Check audit log does NOT contain the token
      const audit = dbAuditLogs.find((l) => l.action === "GITHUB_CONNECTED");
      expect(audit).toBeDefined();
      expect(JSON.stringify(audit.details)).not.toContain(secretToken);
    });
  });

  // =========================================================================
  // 3. Commit Synchronization & Error Paths (401 & 403 Rate Limit)
  // =========================================================================
  describe("Commit Synchronization & Resilience", () => {
    beforeEach(async () => {
      await saveGitHubConnectionAndToken({
        userId: userA.userId,
        githubUserId: "123456",
        githubUsername: "sulthonikamal",
        scopes: ["read:user", "repo"],
        accessToken: "gho_valid_token",
        tokenType: "bearer",
      });
    });

    it("successfully syncs commits from GitHub API and upserts into database", async () => {
      // Mock global fetch for GitHub API
      const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("/user/repos")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: 101, full_name: "sulthonikamal/internship-logbook", default_branch: "main" },
            ],
          } as any;
        }
        if (urlStr.includes("/commits?author=")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                sha: "c7a42bf4567890abcdef1234567890abcdef1234",
                html_url: "https://github.com/sulthonikamal/internship-logbook/commit/c7a42bf",
                commit: {
                  message: "feat: implement Phase 7 GitHub Integration",
                  author: { date: "2026-10-01T10:00:00Z" },
                },
              },
            ],
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const result = await syncGitHubCommits();
      expect(result.ok).toBe(true);
      expect(result.syncedCount).toBe(1);

      // Verify commit stored in DB
      expect(dbCommits.length).toBe(1);
      expect(dbCommits[0].sha).toBe("c7a42bf4567890abcdef1234567890abcdef1234");
      expect(dbCommits[0].repository_name).toBe("sulthonikamal/internship-logbook");

      fetchSpy.mockRestore();
    });

    it("handles GitHub 401 Unauthorized by setting status REAUTH_REQUIRED without crashing", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      } as any);

      const result = await syncGitHubCommits();
      expect(result.ok).toBe(false);
      expect(result.code).toBe("REAUTH_REQUIRED");

      const conn = await getGitHubConnection();
      expect(conn?.connectionStatus).toBe("REAUTH_REQUIRED");

      fetchSpy.mockRestore();
    });

    it("handles GitHub 403 Rate Limit by returning cached fallback notice", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "API rate limit exceeded" }),
      } as any);

      const result = await syncGitHubCommits();
      expect(result.ok).toBe(false);
      expect(result.code).toBe("RATE_LIMITED");
      expect(result.message).toContain("sementara dibatasi");

      fetchSpy.mockRestore();
    });
  });

  // =========================================================================
  // 4. Commit Evidence Conversion & Deduplication
  // =========================================================================
  describe("Generic Evidence Conversion & Deduplication", () => {
    it("converts a selected commit into a generic Evidence and links github_evidences", async () => {
      const commit = {
        repositoryName: "sulthonikamal/internship-logbook",
        sha: "a1b2c3d4e5f6789012345678901234567890abcd",
        commitUrl: "https://github.com/sulthonikamal/internship-logbook/commit/a1b2c3d",
        message: "feat: add kanban board",
        authorDate: "2026-10-01T08:30:00Z",
      };

      const result = await attachCommitEvidence(commit);
      expect(result.ok).toBe(true);
      expect(result.evidenceId).toBeDefined();
      expect(result.reused).toBe(false);

      // Verify generic Evidence was created with GITHUB_COMMIT type
      const ev = dbEvidences.find((e) => e.id === result.evidenceId);
      expect(ev).toBeDefined();
      expect(ev.type).toBe("GITHUB_COMMIT");
      expect(ev.status).toBe("AVAILABLE");
      expect(ev.title).toContain("sulthonikamal/internship-logbook#a1b2c3d");

      // Verify subtype github_evidences record
      const ghEv = dbGithubEvidences.find((g) => g.evidence_id === result.evidenceId);
      expect(ghEv).toBeDefined();
      expect(ghEv.sha).toBe(commit.sha);
      expect(ghEv.repository_name).toBe(commit.repositoryName);
    });

    it("reuses existing Evidence when attaching the exact same commit again (deduplication)", async () => {
      const commit = {
        repositoryName: "sulthonikamal/internship-logbook",
        sha: "deadbeef12345678901234567890123456789012",
        commitUrl: "https://github.com/sulthonikamal/internship-logbook/commit/deadbeef",
        message: "fix: solve memory leak",
      };

      // First attach
      const first = await attachCommitEvidence(commit);
      expect(first.ok).toBe(true);
      expect(first.reused).toBe(false);

      // Second attach of the same commit
      const second = await attachCommitEvidence(commit);
      expect(second.ok).toBe(true);
      expect(second.reused).toBe(true);
      expect(second.evidenceId).toBe(first.evidenceId);

      // Evidences table count must remain 1
      expect(dbEvidences.length).toBe(1);
    });

    it("attaches commit evidence to Activity and Todo simultaneously", async () => {
      // Setup test activity and todo
      const actId = "00000000-0000-4000-8000-000000000010";
      const todoId = "00000000-0000-4000-8000-000000000020";

      dbActivities.push({
        id: actId,
        user_id: userA.userId,
        title: "Pengerjaan Kanban Board",
        deleted_at: null,
      });

      dbTodos.push({
        id: todoId,
        user_id: userA.userId,
        title: "Implementasi Gate",
        current_stage_id: "stage-review",
        deleted_at: null,
      });

      const res = await attachCommitEvidence({
        repositoryName: "sulthonikamal/internship-logbook",
        sha: "feedface12345678901234567890123456789012",
        commitUrl: "https://github.com/sulthonikamal/internship-logbook/commit/feedface",
        message: "chore: finish gate tests",
        activityId: actId,
        todoId: todoId,
      });

      expect(res.ok).toBe(true);

      // Verify activity_evidences link
      expect(dbActivityEvidences.some((ae) => ae.activity_id === actId && ae.evidence_id === res.evidenceId)).toBe(true);

      // Verify todo_evidences link
      expect(dbTodoEvidences.some((te) => te.todo_id === todoId && te.evidence_id === res.evidenceId)).toBe(true);
    });
  });

  // =========================================================================
  // 5. Historical Evidence Retention on Disconnect
  // =========================================================================
  describe("Disconnect & Historical Retention (Immutable Rule)", () => {
    it("disconnects GitHub, deletes token, marks DISCONNECTED, but retains cached commits and attached evidences", async () => {
      // 1. Setup connection, commits, and an attached evidence
      await saveGitHubConnectionAndToken({
        userId: userA.userId,
        githubUserId: "123456",
        githubUsername: "sulthonikamal",
        scopes: ["repo"],
        accessToken: "gho_token_to_disconnect",
        tokenType: "bearer",
      });

      dbCommits.push({
        id: "commit-1",
        user_id: userA.userId,
        repository_id: "repo-1",
        repository_name: "sulthonikamal/internship-logbook",
        sha: "1111111222222233333334444444555555556666",
        message: "historic commit",
        source_status: "AVAILABLE",
      });

      const attachRes = await attachCommitEvidence({
        commitId: "commit-1",
        repositoryName: "sulthonikamal/internship-logbook",
        sha: "1111111222222233333334444444555555556666",
        commitUrl: "https://github.com/sulthonikamal/internship-logbook/commit/1111111",
        message: "historic commit",
      });

      expect(attachRes.ok).toBe(true);
      expect(dbEvidences.length).toBe(1);

      // 2. Perform disconnect
      const disconnectRes = await disconnectGitHub();
      expect(disconnectRes.ok).toBe(true);

      // 3. Verify token deleted
      expect(dbTokens.length).toBe(0);

      // 4. Verify status is DISCONNECTED
      const conn = await getGitHubConnection();
      expect(conn?.connectionStatus).toBe("DISCONNECTED");

      // 5. IMMUTABLE RULE CHECK: cached commits and evidences MUST NOT be deleted
      expect(dbCommits.length).toBe(1);
      expect(dbEvidences.length).toBe(1);
      expect(dbGithubEvidences.length).toBe(1);
    });
  });

  // =========================================================================
  // 6. Cross-Owner Isolation / IDOR Protection
  // =========================================================================
  describe("Cross-Owner Isolation & IDOR Defense", () => {
    it("prevents User B from querying or listing User A's commits and repos", async () => {
      dbCommits.push({
        id: "commit-user-a",
        user_id: userA.userId,
        repository_id: "repo-user-a",
        repository_name: "sulthonikamal/secret-repo",
        sha: "9999999999999999999999999999999999999999",
        message: "secret commit",
        author_date: "2026-10-01T12:00:00Z",
        source_status: "AVAILABLE",
      });

      // User A sees their commit
      currentUser = userA;
      const resA = await listGitHubCommits();
      expect(resA.items.length).toBe(1);

      const reposA = await listUserGitHubRepos();
      expect(reposA).toContain("sulthonikamal/secret-repo");

      // User B must NOT see User A's commit
      currentUser = userB;
      const resB = await listGitHubCommits();
      expect(resB.items.length).toBe(0);

      const reposB = await listUserGitHubRepos();
      expect(reposB.length).toBe(0);
    });
  });

  // =========================================================================
  // 7. Excel Export Integration for GITHUB_COMMIT
  // =========================================================================
  describe("Excel Export Formatting with Commit Evidences", () => {
    it("formats summary sheet with Commit count", () => {
      const summary = formatEvidenceSummary([
        { id: "e1", type: "PHOTO", title: "Foto", status: "AVAILABLE" },
        { id: "e2", type: "LINK", title: "Tautan", status: "AVAILABLE" },
        { id: "e3", type: "GITHUB_COMMIT", title: "Commit", status: "AVAILABLE" },
      ]);

      expect(summary).toBe("1 Foto, 1 Tautan, 1 Commit");
    });

    it("builds Evidence Detail sheet with GITHUB_COMMIT and clickable commit_url", () => {
      const workbook = new ExcelJS.Workbook();
      const commitUrl = "https://github.com/sulthonikamal/internship-logbook/commit/c7a42bf";

      const sheet = buildEvidenceSheet(
        workbook,
        [
          {
            evidenceId: "00000000-0000-4000-8000-000000000099",
            activityId: "00000000-0000-4000-8000-000000000088",
            activityDate: "2026-10-01",
            type: "GITHUB_COMMIT",
            title: "feat: Phase 7 commit",
            status: "AVAILABLE",
            url: commitUrl,
          },
        ],
        "http://localhost:3000"
      );

      const row2 = sheet.getRow(2);
      expect(row2.getCell("type").value).toBe("GITHUB_COMMIT");
      expect(row2.getCell("title").value).toBe("feat: Phase 7 commit");

      // Check Hyperlink formatting for commit URL
      const urlCell = row2.getCell("url");
      expect((urlCell.value as any)?.hyperlink).toBe(commitUrl);
      expect((urlCell.value as any)?.text).toBe(commitUrl);
    });
  });
});
