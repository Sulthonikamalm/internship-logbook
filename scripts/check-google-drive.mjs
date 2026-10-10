import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_DRIVE_ROOT_FOLDER_ID"];
const missing = keys.filter(key => !process.env[key]?.trim());

async function check() {
  if (missing.length) {
    console.error(`Konfigurasi Drive belum lengkap: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(), refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim(),
      grant_type: "refresh_token" }),
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || typeof token.access_token !== "string" || !token.access_token) {
    const known = ["invalid_grant", "invalid_client", "invalid_request", "unauthorized_client",
      "unsupported_grant_type", "temporarily_unavailable", "server_error"];
    const reason = known.includes(token.error) ? token.error : "unknown";
    console.error(`Google OAuth gagal: HTTP ${response.status}, reason=${reason}.`);
    if (reason === "invalid_grant")
      console.error("Refresh token sudah tidak berlaku. Periksa status consent screen, lalu jalankan npm run google:setup. Untuk Vercel, perbarui secret Production dan redeploy.");
    process.exitCode = 1;
    return;
  }
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID.trim())}`);
  url.searchParams.set("fields", "mimeType,trashed,capabilities(canAddChildren),permissions(type,role)");
  const metadata = await fetch(url, { signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token.access_token}` } });
  const root = await metadata.json().catch(() => ({}));
  const valid = metadata.ok && !root.trashed && root.mimeType === "application/vnd.google-apps.folder"
    && root.capabilities?.canAddChildren === true && Array.isArray(root.permissions) && root.permissions.length > 0
    && root.permissions.every(permission => permission.type === "user" && permission.role === "owner");
  console.log(`Token OAuth: valid. Folder privat dan dapat ditulis: ${valid ? "ya" : "tidak"} (HTTP ${metadata.status}).`);
  if (!valid) process.exitCode = 1;
}

check().catch(error => {
  const reason = error?.name === "TimeoutError" ? "timeout" : "network";
  console.error(`Pemeriksaan Drive gagal: ${reason}. Coba lagi.`);
  process.exitCode = 1;
});
