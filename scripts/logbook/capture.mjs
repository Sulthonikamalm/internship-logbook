import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { chromium } from "playwright";
import { api, command, configuration, execute, localDir, root, uploadFile, writePrivateJson } from "./client.mjs";

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
async function browser() {
  for (const channel of [undefined, "msedge", "chrome"]) {
    try { return await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); } catch { /* Try the installed browser. */ }
  }
  throw new Error("Browser screenshot belum tersedia. Jalankan npx playwright install chromium.");
}
async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer(); server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolvePort(port)); });
  });
}
function cleanEnvironment(extra = {}) {
  const result = {};
  for (const [key, value] of Object.entries(process.env))
    if (["path", "systemroot", "windir", "comspec", "temp", "tmp", "userprofile", "appdata", "localappdata", "home"].includes(key.toLowerCase())) result[key] = value;
  return { ...result, NEXT_TELEMETRY_DISABLED: "1", ...extra };
}
async function stop(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") await execute("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"]).catch(() => {});
  else { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill(); } }
}
export async function screenshotApp(commit, profile, directory, routeName) {
  if (!profile?.localPath || !Array.isArray(profile.start) || !Array.isArray(profile.routes) || !profile.routes.length)
    throw new Error("Profil menjalankan aplikasi belum tersedia.");
  const route = routeName ? profile.routes.find(route => route.path === routeName) : profile.routes[0];
  if (!route?.path?.startsWith("/") || route.path.startsWith("//") || !route.readySelector) throw new Error("Halaman tidak terdaftar dalam profil project.");
  const localPath = resolve(root, profile.localPath);
  const remote = await execute("git", ["remote", "get-url", "origin"], { cwd: localPath });
  const slug = remote.replace(/^https:\/\/github\.com\//i, "").replace(/^git@github\.com:/i, "").replace(/\.git$/, "").replace(/\/$/, "");
  if (slug.toLowerCase() !== commit.repository.toLowerCase()) throw new Error("Repository lokal berbeda dari project perintah.");
  await execute("git", ["cat-file", "-e", `${commit.sha}^{commit}`], { cwd: localPath }).catch(() => execute("git", ["fetch", "--no-write-fetch-head", "origin", commit.sha], { cwd: localPath, timeout: 60000 }));
  const source = join(directory, "source"); await mkdir(source, { recursive: true });
  const archive = join(directory, "commit.tar");
  await execute("git", ["archive", "--format=tar", `--output=${archive}`, commit.sha], { cwd: localPath, timeout: 60000 });
  await execute("tar", ["-xf", archive, "-C", source], { timeout: 60000 });
  const port = await freePort();
  const env = cleanEnvironment({ ...profile.env, PORT: String(port) });
  if (profile.install?.length) await execute(profile.install[0], profile.install.slice(1), { cwd: source, env, timeout: 180000 });
  const args = profile.start.slice(1).map(value => value.replaceAll("{port}", String(port)));
  const [bin, argv] = command(profile.start[0], args);
  const child = spawn(bin, argv, { cwd: source, env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: "ignore" });
  let spawnError; child.on("error", error => { spawnError = error; });
  let instance;
  try {
    const url = new URL(route.path, `http://127.0.0.1:${port}`);
    if (url.origin !== `http://127.0.0.1:${port}`) throw new Error("Alamat halaman tidak valid.");
    let ready = false;
    for (const start = Date.now(); Date.now() - start < 60000;) {
      if (spawnError || child.exitCode !== null) throw new Error("Aplikasi pada commit ini gagal dijalankan.");
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2000) }).catch(() => null);
      if (response?.ok) { ready = true; break; }
      await new Promise(resolveWait => setTimeout(resolveWait, 500));
    }
    if (!ready) throw new Error("Aplikasi belum siap dalam batas waktu.");
    instance = await browser();
    const context = await instance.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await context.route("**/*", async request => {
      const target = new URL(request.request().url());
      if (target.origin === url.origin && ["GET", "HEAD", "OPTIONS"].includes(request.request().method())) return request.continue();
      return request.abort();
    });
    const page = await context.newPage(); await page.goto(url.href, { waitUntil: "networkidle", timeout: 30000 });
    if (new URL(page.url()).pathname !== url.pathname) throw new Error("Halaman dialihkan; bukti tampilan belum tersedia.");
    await page.locator(route.readySelector).first().waitFor({ timeout: 10000 });
    const screenshot = await page.screenshot({ fullPage: false });
    const caption = `<svg width="1280" height="100"><rect width="100%" height="100%" fill="#13243b"/><text x="24" y="32" fill="white" font-family="sans-serif" font-size="18">Rekonstruksi tampilan dari commit ${escapeHtml(commit.sha.slice(0, 12))}</text><text x="24" y="60" fill="#b7cce5" font-family="sans-serif" font-size="14">${escapeHtml(commit.repository)} · ${escapeHtml(route.path)} · commit ${escapeHtml(commit.date)} · dibuat ${new Date().toISOString()}</text></svg>`;
    return { bytes: await sharp(screenshot).extend({ top: 100, bottom: 0, left: 0, right: 0, background: "#13243b" }).composite([{ input: Buffer.from(caption), top: 0, left: 0 }]).png().toBuffer(), path: route.path };
  } finally { await instance?.close(); await stop(child); }
}

export async function screenshotDiff(commit, requestedPath) {
  const credentialFile = filename => /(^|\/)(\.env(?:\.|$)|\.envrc$|[^/]*\.(?:pem|key|p12|pfx)$)/i.test(filename);
  if (requestedPath && credentialFile(requestedPath)) throw new Error("File credential tidak dapat dijadikan screenshot.");
  const eligible = file => (!requestedPath || file.filename === requestedPath) && file.patch && !credentialFile(file.filename);
  let selected = commit.files.find(eligible);
  let page = 1;
  while (!selected && commit.hasMore && page < 100) {
    const next = await api(`commits/${commit.id}?repository=${encodeURIComponent(commit.repository)}&page=${++page}`);
    selected = next.files.find(eligible);
    commit = next;
  }
  if (!selected) throw new Error("Commit tidak memiliki diff teks untuk dijadikan gambar.");
  const lines = selected.patch.split("\n"); const shown = lines.slice(0, 160);
  const body = shown.map(line => `<div class="line ${line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : ""}">${escapeHtml(line) || " "}</div>`).join("");
  const html = `<!doctype html><html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#182b49;font-family:Arial,sans-serif}header{padding:24px 30px;background:#13243b;color:white}h1{font-size:20px;margin:0 0 12px}p{font-size:14px;margin:6px 0;overflow-wrap:anywhere}main{padding:20px 30px}.line{font:14px/20px Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-height:20px}.add{background:#dcf4e4;color:#165b32}.remove{background:#ffe5e5;color:#8e2424}footer{padding:20px 30px;font-size:13px}</style><header><h1>Rekonstruksi kode / diff commit</h1><p>${escapeHtml(commit.repository)} @ ${escapeHtml(commit.sha)}</p><p>${escapeHtml(commit.message)}</p><p>Commit: ${escapeHtml(commit.date)} · Gambar dibuat: ${new Date().toISOString()}</p><p>${escapeHtml(selected.filename)}</p></header><main>${body}</main><footer>${shown.length} dari ${lines.length} baris diff · ${escapeHtml(commit.url)}</footer></html>`;
  const instance = await browser();
  try {
    const context = await instance.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 300 } });
    await context.route("**/*", request => request.abort());
    const page = await context.newPage(); await page.setContent(html);
    return { bytes: await page.screenshot({ fullPage: true }), path: selected.filename };
  } finally { await instance.close(); }
}

export async function captureCommit({ commitId, repository, path, route }) {
  const config = await configuration();
  if (config.repositories?.length && !config.repositories.some(allowed => allowed.toLowerCase() === repository.toLowerCase())) throw new Error("Repository tidak terdaftar dalam project lokal.");
  const commit = await api(`commits/${commitId}?repository=${encodeURIComponent(repository)}`);
  const profile = Object.entries(config.profiles ?? {}).find(([name]) => name.toLowerCase() === repository.toLowerCase())?.[1];
  const key = createHash("sha256").update(JSON.stringify([commitId, repository.toLowerCase(), path || "", route || "", profile ?? null])).digest("hex");
  const directory = resolve(localDir, "captures", key); await mkdir(directory, { recursive: true });
  const checkpoint = join(directory, "result.json");
  let cached;
  try { cached = JSON.parse(await readFile(checkpoint, "utf8")); } catch { /* First attempt. */ }
  if (cached?.evidenceId) {
    try { await api(`photos/${cached.evidenceId}`, undefined, true); return cached; }
    catch (error) {
      if (error.status !== 404) throw error;
      cached = { ...cached, evidenceId: undefined, uploadId: crypto.randomUUID() };
      await writePrivateJson(checkpoint, cached);
    }
  }
  let output; let kind = "APP_SCREENSHOT"; let fallbackReason;
  if (!cached?.file) {
    try { output = await screenshotApp(commit, profile, directory, route); }
    catch (error) { fallbackReason = error.message; kind = "CODE_DIFF"; output = await screenshotDiff(commit, path); }
    const file = join(directory, `reconstruction-${commit.sha.slice(0, 12)}.png`);
    await writeFile(file, output.bytes, { mode: 0o600 });
    cached = { file, kind, path: output.path, fallbackReason, uploadId: crypto.randomUUID(), capturedAt: new Date().toISOString() };
    await writePrivateJson(checkpoint, cached);
  }
  const result = await uploadFile(cached.file, { uploadId: cached.uploadId, capturedAt: cached.capturedAt,
    provenance: { commitId, kind: cached.kind, path: cached.path } });
  const completed = { ...cached, evidenceId: result.evidenceId, repository, sha: commit.sha, commitDate: commit.date };
  await writePrivateJson(checkpoint, completed); return completed;
}
