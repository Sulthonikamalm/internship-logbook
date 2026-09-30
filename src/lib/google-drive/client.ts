import "server-only";
import { DriveError, mapDriveNetworkError, mapDriveResponse } from "./errors";

type DriveConfig = { clientId: string; clientSecret: string; refreshToken: string; rootFolderId: string };
let cachedToken: { value: string; expiresAt: number } | null = null;

export function getDriveConfig(): DriveConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !rootFolderId ||
      clientId.startsWith("your-") || clientSecret.startsWith("GOCSPX-your-") ||
      refreshToken.startsWith("1//your-")) {
    throw new DriveError("AUTH");
  }
  return { clientId, clientSecret, refreshToken, rootFolderId };
}

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const config = getDriveConfig();
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
        refresh_token: config.refreshToken, grant_type: "refresh_token" }),
    });
  } catch (error) { throw mapDriveNetworkError(error); }
  if (!response.ok) throw new DriveError("AUTH", response.status);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new DriveError("AUTH");
  cachedToken = { value: payload.access_token,
    expiresAt: Date.now() + Math.max(30, (payload.expires_in ?? 3600) - 90) * 1000 };
  return cachedToken.value;
}

export async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "www.googleapis.com") {
    throw new DriveError("UNKNOWN");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(parsed, {
        ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(20000),
        headers: { ...Object.fromEntries(new Headers(init.headers).entries()),
          Authorization: `Bearer ${await accessToken()}` },
      });
    } catch (error) { throw mapDriveNetworkError(error); }
    if (response.ok) return response;
    let reason: string | undefined;
    if (response.status === 403) {
      const body = await response.json().catch(() => null) as {
        error?: { errors?: { reason?: string }[]; status?: string };
      } | null;
      reason = body?.error?.errors?.[0]?.reason;
    }
    const code = mapDriveResponse(response.status, reason);
    if (code === "AUTH") cachedToken = null;
    if ((code === "RATE_LIMIT" || code === "SERVER") && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
      continue;
    }
    throw new DriveError(code, response.status);
  }
  throw new DriveError("UNKNOWN");
}

export async function driveUploadStatusFetch(sessionUrl: string, size: number): Promise<Response> {
  const url = new URL(sessionUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" ||
      url.pathname !== "/upload/drive/v3/files" ||
      url.searchParams.get("uploadType") !== "resumable" ||
      !url.searchParams.get("upload_id")) throw new DriveError("UNKNOWN");
  try {
    return await fetch(url, { method: "PUT", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${await accessToken()}`,
        "Content-Range": `bytes */${size}` } });
  } catch (error) { throw mapDriveNetworkError(error); }
}
