import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePublicConfig } from "./scripts/logbook/public-config.mjs";

const root = dirname(fileURLToPath(import.meta.url));
let install = { appUrl: "https://internship-logbook-kijc.vercel.app" };
try { install = JSON.parse(await readFile(resolve(root, "install.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw new Error("Konfigurasi paket tidak valid."); }
const supplied = process.argv.indexOf("--url");
const site = new URL(supplied >= 0 ? process.argv[supplied + 1] : install.appUrl);
if (site.username || site.password || site.pathname !== "/" || site.search || site.hash
  || !(site.protocol === "https:" || site.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)))
  throw new Error("Gunakan alamat HTTPS aplikasi, atau localhost untuk pengembangan.");
const response = await fetch(`${site.origin}/api/mcp/config`, { redirect: "error", signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Konfigurasi aplikasi belum tersedia (HTTP ${response.status}).`);
const config = validatePublicConfig(await response.json());
if (config.appUrl !== site.origin) throw new Error("Alamat konfigurasi tidak cocok dengan aplikasi yang dipilih.");
const localDir = resolve(root, ".codex/local");
await mkdir(localDir, { recursive: true });
await writeFile(resolve(localDir, "public-client.json"), JSON.stringify(config, null, 2), { mode: 0o600 });
const projectConfig = resolve(root, ".codex/logbook.local.json");
let previous = {};
try { previous = JSON.parse(await readFile(projectConfig, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("Konfigurasi project lokal tidak valid."); }
await writeFile(projectConfig, JSON.stringify({ ...previous, appUrl: config.appUrl, repositories: previous.repositories ?? [], profiles: previous.profiles ?? {} }, null, 2), { mode: 0o600 });
const script = resolve(root, "scripts/logbook/index.mjs");
const toml = `[mcp_servers.internflow]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(script)}, "mcp"]\nstartup_timeout_sec = 30\ntool_timeout_sec = 600\n`;
await writeFile(resolve(root, "codex-config.toml"), toml);
console.log(`Aplikasi: ${config.appUrl}\nKonfigurasi publik siap.\n1. Jalankan npm run login dengan akun InternFlow milikmu.\n2. Jalankan npm run connect:codex jika Codex CLI tersedia.\n   Untuk Codex desktop, gunakan pengaturan MCP STDIO dari codex-config.toml.\n3. Muat ulang sesi Codex.\nFolder paket perlu tetap berada di lokasi ini agar koneksi MCP dapat dijalankan.`);
