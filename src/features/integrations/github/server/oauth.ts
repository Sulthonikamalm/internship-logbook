import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GitHubConnection } from "../types";

const STATE_COOKIE_NAME = "gh_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

export async function createGitHubAuthUrl(userId: string): Promise<{ url: string; state: string }> {
  const env = getServerEnv();

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error("GITHUB_OAUTH_NOT_CONFIGURED");
  }

  // Generate cryptographically secure state with user binding
  const rawState = crypto.randomBytes(32).toString("hex");
  const statePayload = Buffer.from(
    JSON.stringify({ state: rawState, userId, timestamp: Date.now() })
  ).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, statePayload, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const callbackUrl =
    env.GITHUB_CALLBACK_URL || `${env.APP_BASE_URL}/api/integrations/github/callback`;

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: "read:user repo",
    state: statePayload,
  });

  return {
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    state: statePayload,
  };
}

export async function verifyAndClearOAuthState(
  receivedState: string,
  expectedUserId: string
): Promise<{ valid: boolean; reason?: string }> {
  const cookieStore = await cookies();
  const storedPayload = cookieStore.get(STATE_COOKIE_NAME)?.value;

  // Always delete cookie on use (one-time use)
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!storedPayload || storedPayload !== receivedState) {
    return { valid: false, reason: "state_mismatch" };
  }

  try {
    const decoded = JSON.parse(Buffer.from(storedPayload, "base64url").toString("utf8"));
    if (decoded.userId !== expectedUserId) {
      return { valid: false, reason: "user_mismatch" };
    }
    if (Date.now() - decoded.timestamp > STATE_MAX_AGE_SECONDS * 1000) {
      return { valid: false, reason: "state_expired" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "invalid_state_format" };
  }
}

export async function exchangeGitHubCode(code: string, redirectUri: string) {
  const env = getServerEnv();

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error("GITHUB_OAUTH_NOT_CONFIGURED");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GITHUB_EXCHANGE_HTTP_${response.status}`);
  }

  const data = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "GITHUB_EXCHANGE_FAILED");
  }

  const scopes = (data.scope || "").split(",").map((s: string) => s.trim()).filter(Boolean);

  return {
    accessToken: data.access_token as string,
    tokenType: (data.token_type as string) || "bearer",
    scopes,
  };
}

export async function fetchGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "InternFlow-Logbook",
    },
  });

  if (!response.ok) {
    throw new Error(`GITHUB_USER_FETCH_HTTP_${response.status}`);
  }

  const user = await response.json();
  return {
    id: String(user.id),
    login: user.login as string,
    name: (user.name as string) || user.login,
  };
}

export async function saveGitHubConnectionAndToken(params: {
  userId: string;
  githubUserId: string;
  githubUsername: string;
  scopes: string[];
  accessToken: string;
  tokenType: string;
}): Promise<GitHubConnection> {
  const adminClient = createAdminClient();
  const userClient = await createClient();

  const now = new Date().toISOString();

  // 1. Store token securely in github_tokens table via elevated admin client
  // NEVER log or expose accessToken
  const { error: tokenError } = await adminClient.from("github_tokens").upsert(
    {
      user_id: params.userId,
      access_token: params.accessToken,
      token_type: params.tokenType,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (tokenError) {
    throw new Error(`FAILED_SAVE_TOKEN: ${tokenError.message}`);
  }

  // 2. Save public connection metadata in github_connections table
  const { data: connection, error: connError } = await userClient
    .from("github_connections")
    .upsert(
      {
        user_id: params.userId,
        github_user_id: params.githubUserId,
        github_username: params.githubUsername,
        connection_status: "CONNECTED",
        scopes: params.scopes,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (connError || !connection) {
    throw new Error(`FAILED_SAVE_CONNECTION: ${connError?.message || "Unknown error"}`);
  }

  // 3. Log audit event (WITHOUT token)
  try {
    await userClient.from("audit_logs").insert({
      user_id: params.userId,
      action: "GITHUB_CONNECTED",
      details: {
        github_user_id: params.githubUserId,
        github_username: params.githubUsername,
        scopes: params.scopes,
      },
      created_at: now,
    });
  } catch {
    // Non-critical audit failure
  }

  return {
    id: connection.id,
    userId: connection.user_id,
    githubUserId: connection.github_user_id,
    githubUsername: connection.github_username,
    connectionStatus: connection.connection_status,
    scopes: connection.scopes || [],
    connectedAt: connection.connected_at,
    lastSyncedAt: connection.last_synced_at,
    createdAt: connection.created_at,
    updatedAt: connection.updated_at,
  };
}
