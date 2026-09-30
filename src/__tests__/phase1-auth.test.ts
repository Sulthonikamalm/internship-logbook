import { describe, it, expect, beforeEach } from "vitest";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import {
  isValidRole,
  parseRole,
  isValidTimezone,
  parseTimezone,
  VALID_ROLES,
} from "@/lib/auth/types";
import {
  ErrorCode,
  createAppError,
  mapToAppError,
  generateRequestId,
} from "@/lib/errors";
import { clientEnvSchema } from "@/lib/env/client";
import { serverEnvSchema } from "@/lib/env/server";
import { loginSchema } from "@/features/auth/schemas/login";
import {
  saveDraft,
  loadDraft,
  removeDraft,
  clearUserDrafts,
} from "@/lib/auth/draft-storage";

// =============================================================================
// §16 — Safe Redirect
// =============================================================================
describe("Safe Redirect", () => {
  it("allows valid relative paths", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/activities/123")).toBe("/activities/123");
    expect(safeRedirect("/profile")).toBe("/profile");
  });

  it("falls back to /dashboard for empty or missing", () => {
    expect(safeRedirect("")).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("   ")).toBe("/dashboard");
  });

  it("rejects absolute URLs (open redirect)", () => {
    expect(safeRedirect("https://evil.com")).toBe("/dashboard");
    expect(safeRedirect("http://evil.com/path")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.com")).toBe("/dashboard");
    expect(safeRedirect("//evil.com/path")).toBe("/dashboard");
  });

  it("rejects javascript: scheme", () => {
    expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirect("JAVASCRIPT:alert(1)")).toBe("/dashboard");
  });

  it("rejects data: scheme", () => {
    expect(safeRedirect("data:text/html,<h1>Hi</h1>")).toBe("/dashboard");
  });

  it("rejects backslash variants", () => {
    expect(safeRedirect("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirect("/path\\file")).toBe("/dashboard");
  });

  it("rejects paths that don't start with /", () => {
    expect(safeRedirect("dashboard")).toBe("/dashboard");
    expect(safeRedirect("evil.com")).toBe("/dashboard");
  });
});

// =============================================================================
// §19 — Role Parser
// =============================================================================
describe("Role Parser", () => {
  it("validates correct roles", () => {
    expect(isValidRole("user")).toBe(true);
    expect(isValidRole("supervisor")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
  });

  it("rejects invalid roles", () => {
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole(42)).toBe(false);
  });

  it("parses role with fallback", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("invalid")).toBe("user");
    expect(parseRole(null)).toBe("user");
  });

  it("has exactly 3 valid roles", () => {
    expect(VALID_ROLES).toEqual(["user", "supervisor", "admin"]);
  });
});

// =============================================================================
// §19 — Timezone Parser
// =============================================================================
describe("Timezone Parser", () => {
  it("validates known IANA timezones", () => {
    expect(isValidTimezone("Asia/Jakarta")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("rejects invalid timezone strings", () => {
    expect(isValidTimezone("Invalid/Zone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("foo")).toBe(false);
  });

  it("parses timezone with fallback to Asia/Jakarta", () => {
    expect(parseTimezone("America/New_York")).toBe("America/New_York");
    expect(parseTimezone("Invalid")).toBe("Asia/Jakarta");
    expect(parseTimezone(null)).toBe("Asia/Jakarta");
    expect(parseTimezone(42)).toBe("Asia/Jakarta");
  });
});

// =============================================================================
// §20 — Error Contract
// =============================================================================
describe("Error Contract", () => {
  it("has all required error codes", () => {
    expect(ErrorCode.UNAUTHENTICATED).toBe("UNAUTHENTICATED");
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCode.ACCOUNT_DISABLED).toBe("ACCOUNT_DISABLED");
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.CONFLICT).toBe("CONFLICT");
    expect(ErrorCode.NOT_FOUND_OR_FORBIDDEN).toBe("NOT_FOUND_OR_FORBIDDEN");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });

  it("generates unique request IDs", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("creates structured AppError", () => {
    const err = createAppError(ErrorCode.UNAUTHENTICATED);
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.message).toBeTruthy();
    expect(err.requestId).toBeTruthy();
  });

  it("maps unknown errors safely", () => {
    const err = mapToAppError(new Error("secret internal error"));
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).not.toContain("secret");
    expect(err.requestId).toBeTruthy();
  });

  it("passes through valid AppErrors", () => {
    const original = createAppError(ErrorCode.FORBIDDEN);
    const mapped = mapToAppError(original);
    expect(mapped.code).toBe("FORBIDDEN");
  });
});

// =============================================================================
// §6 — Environment Validation
// =============================================================================
describe("Environment Validation (Split Modules)", () => {
  it("validates valid client env", () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid client env", () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    });
    expect(result.success).toBe(false);
  });

  it("validates server env with service role key", () => {
    const result = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
      NODE_ENV: "test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBe(
        "test-service-role-key"
      );
    }
  });

  it("server env allows optional service role key", () => {
    const result = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    }
  });
});

// =============================================================================
// §15 — Login Schema
// =============================================================================
describe("Login Schema", () => {
  it("validates valid login input", () => {
    const result = loginSchema.safeParse({
      email: " Test@Example.com ",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Email should be trimmed and lowercased
      expect(result.data.email).toBe("test@example.com");
      // Password should NOT be trimmed
      expect(result.data.password).toBe("password123");
    }
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@test.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("does NOT trim password (spaces intentional)", () => {
    const result = loginSchema.safeParse({
      email: "test@test.com",
      password: " pass with spaces ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(" pass with spaces ");
    }
  });
});

// =============================================================================
// §23 — Draft Storage
// =============================================================================
describe("Draft Storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads draft for same user", () => {
    saveDraft("user-a", "activity", "draft-1", { title: "Test" });
    const loaded = loadDraft("user-a", "activity", "draft-1");
    expect(loaded).toEqual({ title: "Test" });
  });

  it("does NOT leak draft to different user", () => {
    saveDraft("user-a", "activity", "draft-1", { title: "Secret" });
    const loaded = loadDraft("user-b", "activity", "draft-1");
    expect(loaded).toBeNull();
  });

  it("removes specific draft", () => {
    saveDraft("user-a", "activity", "draft-1", { title: "Test" });
    removeDraft("user-a", "activity", "draft-1");
    const loaded = loadDraft("user-a", "activity", "draft-1");
    expect(loaded).toBeNull();
  });

  it("clears all drafts for a user", () => {
    saveDraft("user-a", "activity", "draft-1", { title: "A1" });
    saveDraft("user-a", "todo", "draft-2", { title: "A2" });
    saveDraft("user-b", "activity", "draft-3", { title: "B1" });

    clearUserDrafts("user-a");

    expect(loadDraft("user-a", "activity", "draft-1")).toBeNull();
    expect(loadDraft("user-a", "todo", "draft-2")).toBeNull();
    // User B's draft should still exist
    expect(loadDraft("user-b", "activity", "draft-3")).toEqual({ title: "B1" });
  });

  it("returns null for non-existent draft", () => {
    const loaded = loadDraft("user-a", "activity", "nonexistent");
    expect(loaded).toBeNull();
  });
});
