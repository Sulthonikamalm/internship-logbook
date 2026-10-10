import "server-only";
import { createHash } from "node:crypto";
import { DriveError, logDriveError, mapDriveNetworkError, mapDriveOAuthError, mapDriveResponse } from "./errors";

type DriveConfig = { clientId: string; clientSecret: string; refreshToken: string; rootFolderId: string };
type AccessToken = { value: string; expiresAt: number; credentialKey: string };
let cachedToken: AccessToken | null = null;
let tokenRefresh: { credentialKey: string; promise: Promise<AccessToken> } | null = null;

export function getDriveConfig(): DriveConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!clientId || !clientSecret || !refreshToken || !rootFolderId ||
      clientId.startsWith("your-") || clientSecret.startsWith("GOCSPX-your-") ||
      refreshToken.startsWith("1//your-")) {
    throw new DriveError("CONFIG", undefined, "missing_configuration");
  }
  return { clientId, clientSecret, refreshToken, rootFolderId };
}

const backoff = (attempt: number) => new Promise(resolve => setTimeout(resolve, 350 * 2 ** attempt));

async function refreshAccessToken(config: DriveConfig, credentialKey: string): Promise<AccessToken> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
          refresh_token: config.refreshToken, grant_type: "refresh_token" }),
      });
    } catch (error) {
      const failure = mapDriveNetworkError(error);
      logDriveError("oauth", failure);
      throw failure;
    }
    const payload = await response.json().catch(() => null) as {
      access_token?: unknown; expires_in?: unknown; error?: unknown;
    } | null;
    if (!response.ok) {
      const failure = mapDriveOAuthError(response.status, payload?.error);
      if ((failure.code === "RATE_LIMIT" || failure.code === "SERVER") && attempt < 2) {
        await backoff(attempt);
        continue;
      }
      logDriveError("oauth", failure);
      throw failure;
    }
    const lifetime = payload?.expires_in ?? 3600;
    if (typeof payload?.access_token !== "string" || !payload.access_token ||
        typeof lifetime !== "number" || !Number.isFinite(lifetime) || lifetime <= 0) {
      const failure = new DriveError("SERVER", response.status, "invalid_response");
      logDriveError("oauth", failure);
      throw failure;
    }
    return { value: payload.access_token, credentialKey,
      expiresAt: Date.now() + Math.max(0, lifetime - 90) * 1000 };
  }
  throw new DriveError("SERVER");
}

async function accessToken(): Promise<string> {
  const config = getDriveConfig();
  const credentialKey = createHash("sha256")
    .update(JSON.stringify([config.clientId, config.clientSecret, config.refreshToken])).digest("hex");
  if (cachedToken?.credentialKey === credentialKey && Date.now() < cachedToken.expiresAt)
    return cachedToken.value;
  if (tokenRefresh?.credentialKey === credentialKey) return (await tokenRefresh.promise).value;
  const pending = { credentialKey, promise: refreshAccessToken(config, credentialKey) };
  tokenRefresh = pending;
  try {
    const token = await pending.promise;
    // An older refresh must not overwrite a token for newly rotated credentials.
    if (tokenRefresh === pending) cachedToken = token;
    return token.value;
  } finally {
    if (tokenRefresh === pending) tokenRefresh = null;
  }
}

async function authorizedFetch(url: URL, init: RequestInit, acceptedStatuses: number[] = []): Promise<Response> {
  let authRetried = false;
  let transientAttempt = 0;
  while (true) {
    const token = await accessToken();
    let response: Response;
    try {
      response = await fetch(url, {
        ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(20000),
        headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${token}` },
      });
    } catch (error) { throw mapDriveNetworkError(error); }
    if (response.ok || acceptedStatuses.includes(response.status)) return response;
    let reason: string | undefined;
    if (response.status === 403) {
      const body = await response.json().catch(() => null) as {
        error?: { errors?: { reason?: string }[] };
      } | null;
      reason = body?.error?.errors?.[0]?.reason;
    }
    const code = mapDriveResponse(response.status, reason);
    if (code === "AUTH") {
      // Avoid clearing a newer token installed by another in-flight request.
      if (cachedToken?.value === token) cachedToken = null;
      if (!authRetried && !(init.body instanceof ReadableStream)) {
        authRetried = true;
        continue;
      }
    }
    if ((code === "RATE_LIMIT" || code === "SERVER") && transientAttempt < 2) {
      await backoff(transientAttempt++);
      continue;
    }
    const failure = new DriveError(code, response.status, code === "AUTH" ? "invalid_access_token" : undefined);
    logDriveError("request", failure);
    throw failure;
  }
}

export async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.origin !== "https://www.googleapis.com" || parsed.username || parsed.password)
    throw new DriveError("UNKNOWN");
  return authorizedFetch(parsed, init);
}

export async function driveUploadStatusFetch(sessionUrl: string, size: number): Promise<Response> {
  const url = new URL(sessionUrl);
  if (url.origin !== "https://www.googleapis.com" || url.username || url.password ||
      url.pathname !== "/upload/drive/v3/files" || url.searchParams.get("uploadType") !== "resumable" ||
      !url.searchParams.get("upload_id")) throw new DriveError("UNKNOWN");
  return authorizedFetch(url, { method: "PUT", signal: AbortSignal.timeout(15000),
    headers: { "Content-Range": `bytes */${size}` } }, [308, 404]);
}
