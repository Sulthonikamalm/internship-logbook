import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { clientEnvSchema, serverEnvSchema } from "@/lib/env";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

describe("Phase 0 Foundation Tests", () => {
  describe("Utility: cn (Tailwind Class Merging)", () => {
    it("merges class names correctly without duplication", () => {
      const result = cn("px-2 py-1", "bg-primary", "px-4");
      expect(result).toContain("px-4");
      expect(result).not.toContain("px-2");
      expect(result).toContain("bg-primary");
    });

    it("handles conditional classes and falsy values", () => {
      const isVisible = false;
      const isActive = true;
      const result = cn(
        "base-class",
        isVisible && "hidden",
        isActive && "block",
        undefined,
        null
      );
      expect(result).toBe("base-class block");
    });
  });

  describe("Environment Validation (Zod Schemas)", () => {
    it("validates valid client environment schema", () => {
      const validClient = {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sample-anon-key-string",
        NEXT_PUBLIC_APP_URL: "https://internflow.vercel.app",
      };

      const parsed = clientEnvSchema.safeParse(validClient);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
      }
    });

    it("rejects invalid Supabase URL in client schema", () => {
      const invalidClient = {
        NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sample-anon-key",
      };

      const parsed = clientEnvSchema.safeParse(invalidClient);
      expect(parsed.success).toBe(false);
    });

    it("validates server environment schema with optional integration secrets", () => {
      const serverConfig = {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sample-anon-key",
        NODE_ENV: "test",
        APP_ENV: "test",
        APP_BASE_URL: "http://localhost:3000",
        GOOGLE_CLIENT_ID: "sample-google-id",
      };

      const parsed = serverEnvSchema.safeParse(serverConfig);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.GOOGLE_CLIENT_ID).toBe("sample-google-id");
      }
    });
  });

  describe("Supabase Browser Client Factory", () => {
    it("initializes browser client with default environment fallback", () => {
      const client = createBrowserClient();
      expect(client).toBeDefined();
      expect(typeof client.auth.getSession).toBe("function");
      expect(typeof client.from).toBe("function");
    });
  });
});
