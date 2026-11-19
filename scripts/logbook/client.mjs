import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const localDir = resolve(root, ".codex/local");
try { process.loadEnvFile(resolve(root, ".env.local")); } catch (error) { if (error.code !== "ENOENT") throw new Error("Konfigurasi environment lokal tidak dapat dibaca."); }
export async function configuration() {
  let local = {};
  try { local = JSON.parse(await readFile(resolve(root, ".codex/logbook.local.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("Konfigurasi logbook.local.json tidak valid."); }
  const appUrl = new URL(local.appUrl || process.env.LOGBOOK_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000");
  if (appUrl.username || appUrl.password || (appUrl.protocol !== "https:" && !(appUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname))))
    throw new Error("Alamat aplikasi harus HTTPS atau localhost.");
  return { ...local, appUrl: appUrl.origin };
}
export function command(executable, args = []) {
  // Launch npm directly through Node on Windows; never build a shell command.
  if (process.platform === "win32" && ["npm", "npx"].includes(executable))
    return [process.execPath, [resolve(dirname(process.execPath), `node_modules/npm/bin/${executable === "npm" ? "npm" : "npx"}-cli.js`), ...args]];
  return [executable === "node" ? process.execPath : executable, args];
}
export async function execute(executable, args, options = {}) {
  const [bin, argv] = command(executable, args);
  return new Promise((resolveResult, reject) => {
    const child = spawn(bin, argv, { windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"], ...options });
    const chunks = []; let size = 0;
    child.stdout.on("data", data => { size += data.length; if (size > 4_000_000) child.kill(); else chunks.push(data); });
    child.stderr.resume();
    child.on("error", () => reject(new Error(`Tidak dapat menjalankan ${executable}.`)));
    child.on("exit", code => code === 0 ? resolveResult(Buffer.concat(chunks).toString("utf8").trim()) : reject(new Error(`${executable} gagal (exit ${code}).`)));
    child.stdin.end(options.input || "");
  });
}
export async function protect(value, decrypt = false) {
  if (process.platform !== "win32") return value;
  const operation = decrypt
    ? "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))"
    : "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))";
  return execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [void][Reflection.Assembly]::LoadWithPartialName('System.Security'); $v=[Console]::In.ReadToEnd(); ${operation}`], { input: value });
}
const sessionFile = resolve(localDir, process.platform === "win32" ? "session.dpapi" : "session.json");
export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, path);
}
async function saveSession(session, config) {
  const text = await protect(JSON.stringify({ session, appUrl: config.appUrl, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }));
  await mkdir(localDir, { recursive: true });
  const temporary = `${sessionFile}.tmp`;
  await writeFile(temporary, text, { mode: 0o600 }); await rename(temporary, sessionFile);
}
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment lokal.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function login(email, password) {
  const config = await configuration(); const result = await supabase().auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) throw new Error("Login gagal. Periksa email dan password akun aplikasi.");
  await saveSession(result.data.session, config);
  await api("identity");
}
let refreshing;
async function accessToken(force = false) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const config = await configuration(); let stored;
    try { stored = JSON.parse(await protect(await readFile(sessionFile, "utf8"), true)); }
    catch { throw new Error("Login lokal diperlukan: npm run logbook:login"); }
    if (stored.appUrl !== config.appUrl || stored.supabaseUrl !== process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Alamat aplikasi berubah. Jalankan login lokal kembali.");
    if (!force && stored.session.expires_at > Date.now() / 1000 + 60) return stored.session.access_token;
    const result = await supabase().auth.refreshSession({ refresh_token: stored.session.refresh_token });
    if (result.error || !result.data.session) throw new Error("Sesi berakhir. Jalankan npm run logbook:login kembali.");
    await saveSession(result.data.session, config); return result.data.session.access_token;
  })();
  try { return await refreshing; } finally { refreshing = undefined; }
}
export async function logout() {
  try {
    const client = supabase();
    const token = await accessToken();
    const stored = JSON.parse(await protect(await readFile(sessionFile, "utf8"), true));
    await client.auth.setSession({ access_token: token, refresh_token: stored.session.refresh_token });
    await client.auth.signOut({ scope: "local" });
  }
  catch { /* Removing the local credential is always possible, even offline. */ }
  await unlink(sessionFile).catch(error => { if (error.code !== "ENOENT") throw error; });
}
export async function api(path, body, binary = false) {
  if (!/^[a-z0-9/?=&%_.-]+$/i.test(path) || path.includes("..")) throw new Error("Path alat tidak valid.");
  const config = await configuration();
  const send = async force => fetch(`${config.appUrl}/api/agent/${path}`, {
    method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(200000),
    headers: { Authorization: `Bearer ${await accessToken(force)}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let response;
  try { response = await send(false); if (response.status === 401) response = await send(true); }
  catch (error) { if (error.message?.includes("Login") || error.message?.includes("Sesi") || error.message?.includes("Alamat")) throw error; throw new Error("Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi dan server."); }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.message || "Permintaan aplikasi gagal."); error.code = result.code; error.status = response.status; error.details = result; throw error;
  }
  return binary ? { bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers } : response.json();
}
export async function uploadFile(file, options = {}) {
  const { createHash } = await import("node:crypto");
  const sharp = (await import("sharp")).default;
  const bytes = await readFile(file);
  if (bytes.length > 15728640) throw new Error("Foto maksimal 15 MB.");
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  const mimeType = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[metadata.format];
  if (!mimeType) throw new Error("Format gambar tidak didukung.");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const checkpoint = resolve(localDir, "uploads", `${checksum}.json`);
  let uploadId = options.uploadId;
  if (!uploadId) {
    try { uploadId = JSON.parse(await readFile(checkpoint, "utf8")).uploadId; } catch { /* First attempt. */ }
    uploadId ||= crypto.randomUUID();
    await writePrivateJson(checkpoint, { uploadId, file: resolve(file) });
  }
  let started;
  const input = { uploadId, size: bytes.length, mimeType, originalFilename: file.split(/[\\/]/).at(-1), checksum, capturedAt: options.capturedAt, provenance: options.provenance };
  try { started = await api("photos/start", input); }
  catch (error) { if (error.code !== "DUPLICATE") throw error; started = await api("photos/start", { ...input, duplicateDecision: "use_existing" }); }
  if (started.kind === "EXISTING") return { evidenceId: started.evidenceId, uploadId };
  let driveFileId = started.driveFileId;
  if (started.kind !== "FINALIZE") {
    const url = new URL(started.sessionUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || url.pathname !== "/upload/drive/v3/files" || !url.searchParams.get("upload_id")) throw new Error("Sesi Drive tidak valid.");
    const probe = await fetch(url, { method: "PUT", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "Content-Range": `bytes */${bytes.length}` } });
    if (probe.ok) driveFileId = (await probe.json()).id;
    else if (probe.status === 308) {
      const start = Number(probe.headers.get("Range")?.split("-")[1] ?? -1) + 1;
      if (!Number.isInteger(start) || start < 0 || start >= bytes.length) throw new Error("Offset upload Drive tidak valid.");
      const uploaded = await fetch(url, { method: "PUT", redirect: "error", signal: AbortSignal.timeout(180000),
        headers: { "Content-Type": mimeType, "Content-Range": `bytes ${start}-${bytes.length - 1}/${bytes.length}` }, body: bytes.subarray(start) });
      if (!uploaded.ok) throw new Error("Upload Drive terputus. Ulangi dengan uploadId yang sama.");
      driveFileId = (await uploaded.json()).id;
    } else throw new Error("Sesi upload Drive belum tersedia. Coba lagi.");
  }
  const result = await api("photos/finalize", { uploadId, driveFileId });
  return { evidenceId: result.evidenceId, uploadId };
}
