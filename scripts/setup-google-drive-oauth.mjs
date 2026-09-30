import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const redirectUri = "http://127.0.0.1:8765/callback";
const scope = "https://www.googleapis.com/auth/drive";
const file = readFileSync(envPath, "utf8");
function value(name) { return file.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() || ""; }
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
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
        code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) throw new Error("Pertukaran kode OAuth gagal.");
    const token = await tokenResponse.json();
    if (!token.refresh_token || !token.access_token) throw new Error("Refresh token tidak diterbitkan. Ulangi persetujuan.");
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed,permissions(type,role)`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!metadataResponse.ok) throw new Error("Akun OAuth tidak dapat membuka folder evidence.");
    const folder = await metadataResponse.json();
    if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" ||
        !Array.isArray(folder.permissions) || folder.permissions.some((permission) =>
          permission.type !== "user" || permission.role !== "owner")) {
      throw new Error("Folder evidence harus dibatasi hanya untuk akun pemilik OAuth.");
    }
    const nextFile = /^GOOGLE_REFRESH_TOKEN=/m.test(file)
      ? file.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${token.refresh_token}`)
      : `${file.trimEnd()}\nGOOGLE_REFRESH_TOKEN=${token.refresh_token}\n`;
    writeFileSync(envPath, nextFile, { encoding: "utf8", mode: 0o600 });
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end("OAuth tersimpan secara lokal. Anda dapat menutup tab ini.");
    process.stdout.write("OAuth Drive tersimpan di .env.local dan folder privat terverifikasi.\n");
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end(error instanceof Error ? error.message : "Setup OAuth gagal.");
    process.stderr.write(`${error instanceof Error ? error.message : "Setup OAuth gagal."}\n`);
  } finally { server.close(); }
});
server.listen(8765, "127.0.0.1", () => {
  process.stdout.write(`Buka URL ini di browser akun Google pemilik folder:\n${authorize.toString()}\n`);
});
setTimeout(() => server.close(), 10 * 60_000).unref();
