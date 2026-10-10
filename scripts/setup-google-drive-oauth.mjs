import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const envPath = resolve(process.cwd(), ".env.local");
const redirectUri = "http://127.0.0.1:8765/callback";
const scope = "https://www.googleapis.com/auth/drive";
const file = readFileSync(envPath, "utf8");
const envValues = parseEnv(file);
function value(name) { return envValues[name]?.trim() || ""; }
const clientId = value("GOOGLE_CLIENT_ID");
const clientSecret = value("GOOGLE_CLIENT_SECRET");
const folderId = value("GOOGLE_DRIVE_ROOT_FOLDER_ID");
if (!clientId || !clientSecret || !folderId) {
  throw new Error("Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_DRIVE_ROOT_FOLDER_ID di .env.local dahulu.");
}
const state = randomBytes(32).toString("hex");
const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
  response_type: "code", scope, access_type: "offline", prompt: "consent", state }).toString();

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") { response.writeHead(405).end(); return; }
  const url = new URL(request.url || "/", redirectUri);
  if (url.pathname !== "/callback") { response.writeHead(404).end(); return; }
  const received = Buffer.from(url.searchParams.get("state") || "");
  const expected = Buffer.from(state);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    response.writeHead(400).end("OAuth state tidak sesuai."); return;
  }
  const code = url.searchParams.get("code");
  if (!code) { response.writeHead(400).end("OAuth dibatalkan atau kode tidak ada."); return; }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
        code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) throw new Error("Pertukaran kode OAuth gagal.");
    const token = await tokenResponse.json();
    if (typeof token.refresh_token !== "string" || !token.refresh_token || /[\r\n]/.test(token.refresh_token)
        || typeof token.access_token !== "string" || !token.access_token)
      throw new Error("Refresh token tidak diterbitkan. Ulangi persetujuan.");
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed,permissions(type,role)`, {
      signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!metadataResponse.ok) throw new Error("Akun OAuth tidak dapat membuka folder evidence.");
    const folder = await metadataResponse.json();
    if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" ||
        !Array.isArray(folder.permissions) || folder.permissions.some((permission) =>
          permission.type !== "user" || permission.role !== "owner")) {
      throw new Error("Folder evidence harus dibatasi hanya untuk akun pemilik OAuth.");
    }
    const latestFile = readFileSync(envPath, "utf8");
    const tokenLine = `GOOGLE_REFRESH_TOKEN=${JSON.stringify(token.refresh_token)}`;
    const tokenPattern = /^(?:export\s+)?GOOGLE_REFRESH_TOKEN\s*=.*$/m;
    const nextFile = tokenPattern.test(latestFile)
      ? latestFile.replace(tokenPattern, () => tokenLine)
      : `${latestFile.trimEnd()}\n${tokenLine}\n`;
    writeFileSync(envPath, nextFile, { encoding: "utf8", mode: 0o600 });
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end("OAuth tersimpan secara lokal. Anda dapat menutup tab ini.");
    process.stdout.write("OAuth Drive tersimpan di .env.local dan folder privat terverifikasi.\n");
    process.stdout.write("Untuk situs online, perbarui GOOGLE_REFRESH_TOKEN di environment Vercel Production lalu redeploy. Token tidak dicetak ke terminal.\n");
    if (Number.isFinite(token.refresh_token_expires_in))
      process.stdout.write(`Google memberi masa berlaku refresh token sekitar ${Math.ceil(token.refresh_token_expires_in / 86400)} hari.\n`);
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end(error instanceof Error ? error.message : "Setup OAuth gagal.");
    process.stderr.write(`${error instanceof Error ? error.message : "Setup OAuth gagal."}\n`);
  } finally { server.close(); }
});
server.listen(8765, "127.0.0.1", () => {
  process.stdout.write("Jika consent screen masih External/Testing, pindahkan ke In production sebelum memberi persetujuan agar token baru tidak habis setiap tujuh hari.\n");
  process.stdout.write(`Buka URL ini di browser akun Google pemilik folder:\n${authorize.toString()}\n`);
});
setTimeout(() => server.close(), 10 * 60_000).unref();
