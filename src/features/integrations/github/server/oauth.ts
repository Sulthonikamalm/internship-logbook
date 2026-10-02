import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptGitHubToken } from "./token-crypto";
import type { GitHubConnection } from "../types";

const COOKIE = "gh_oauth_state";
const MAX_AGE = 600;
const stateSchema = z.object({ state: z.string().length(64), verifier: z.string().min(43).max(128), userId: z.uuid(), timestamp: z.number(), allowReplace: z.boolean() }).strict();

export async function createGitHubAuthUrl(userId: string, options: { privateRepos?: boolean; allowReplace?: boolean } = {}) {
  const env = getServerEnv();
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new Error("GITHUB_OAUTH_NOT_CONFIGURED");
  if (!env.GITHUB_TOKEN_ENCRYPTION_KEY || !/^[a-f0-9]{64}$/i.test(env.GITHUB_TOKEN_ENCRYPTION_KEY)) throw new Error("GITHUB_ENCRYPTION_NOT_CONFIGURED");
  const redirectUri = env.GITHUB_CALLBACK_URL || `${env.APP_BASE_URL}/api/integrations/github/callback`;
  const callback = new URL(redirectUri);
  if (callback.origin !== new URL(env.APP_BASE_URL).origin || callback.pathname !== "/api/integrations/github/callback" || callback.search || callback.hash) throw new Error("GITHUB_CALLBACK_NOT_CONFIGURED");
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  (await cookies()).set(COOKIE, Buffer.from(JSON.stringify({ state, verifier, userId, timestamp: Date.now(), allowReplace: Boolean(options.allowReplace) })).toString("base64url"), { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/github", maxAge: MAX_AGE });
  const params = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: redirectUri, scope: options.privateRepos ? "read:user repo" : "read:user", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
  return { url: `https://github.com/login/oauth/authorize?${params}`, state };
}

export async function verifyAndClearOAuthState(receivedState: string, expectedUserId: string): Promise<{ valid: boolean; reason?: string; verifier?: string; allowReplace?: boolean }> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  jar.set(COOKIE, "", { path: "/api/integrations/github", maxAge: 0, httpOnly: true });
  if (!value || !/^[a-f0-9]{64}$/.test(receivedState)) return { valid: false, reason: "state_mismatch" };
  try {
    const decoded = stateSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (!timingSafeEqual(Buffer.from(decoded.state), Buffer.from(receivedState))) return { valid: false, reason: "state_mismatch" };
    if (decoded.userId !== expectedUserId) return { valid: false, reason: "user_mismatch" };
    const age = Date.now() - decoded.timestamp;
    if (age < 0 || age > MAX_AGE * 1000) return { valid: false, reason: "state_expired" };
    return { valid: true, verifier: decoded.verifier, allowReplace: decoded.allowReplace };
  } catch { return { valid: false, reason: "invalid_state_format" }; }
}

export async function exchangeGitHubCode(code: string, redirectUri: string, verifier: string) {
  const env = getServerEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri, code_verifier: verifier }), cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("GITHUB_EXCHANGE_FAILED");
  const parsed = z.object({ access_token: z.string().min(1), token_type: z.literal("bearer"), scope: z.string().default("") }).safeParse(await response.json());
  if (!parsed.success) throw new Error("GITHUB_EXCHANGE_FAILED");
  return { accessToken: parsed.data.access_token, tokenType: parsed.data.token_type, scopes: parsed.data.scope.split(/[ ,]+/).filter(Boolean) };
}
export async function fetchGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "InternFlow" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("GITHUB_IDENTITY_FAILED");
  const parsed = z.object({ id: z.number().int().positive(), login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/), name: z.string().nullable().optional() }).safeParse(await response.json());
  if (!parsed.success) throw new Error("GITHUB_IDENTITY_FAILED");
  return { id: String(parsed.data.id), login: parsed.data.login, name: parsed.data.name || parsed.data.login };
}
export async function saveGitHubConnectionAndToken(params: { userId: string; githubUserId: string; githubUsername: string; scopes: string[]; accessToken: string; tokenType: string; allowReplace?: boolean }): Promise<GitHubConnection> {
  const { data: c, error } = await createAdminClient().rpc("store_github_connection", { p_user_id: params.userId, p_github_user_id: params.githubUserId, p_username: params.githubUsername, p_scopes: params.scopes, p_ciphertext: encryptGitHubToken(params.accessToken), p_token_type: params.tokenType, p_allow_replace: Boolean(params.allowReplace) });
  if (error || !c) throw new Error(error?.message?.includes("ACCOUNT_CHANGE_REQUIRED") ? "ACCOUNT_CHANGE_REQUIRED" : "GITHUB_SAVE_FAILED");
  return { id: c.id, userId: c.user_id, githubUserId: c.github_user_id, githubUsername: c.github_username, connectionStatus: c.connection_status, scopes: c.scopes ?? [], connectedAt: c.connected_at, lastSyncedAt: c.last_synced_at, createdAt: c.created_at, updatedAt: c.updated_at };
}
