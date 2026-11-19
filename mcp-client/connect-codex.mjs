import { access } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
await access(resolve(root, ".codex/local/public-client.json")).catch(() => { throw new Error("Jalankan npm run setup terlebih dahulu."); });
const args = ["mcp", "add", "internflow", "--", process.execPath, resolve(root, "scripts/logbook/index.mjs"), "mcp"];
let executable = "codex"; let prefix = [];
if (process.platform === "win32") {
  const found = spawnSync("where.exe", ["codex"], { encoding: "utf8", windowsHide: true });
  const paths = found.status === 0 ? found.stdout.trim().split(/\r?\n/) : [];
  executable = paths.find(path => extname(path).toLowerCase() === ".exe");
  if (!executable) {
    for (const path of paths) {
      const cli = resolve(dirname(path), "node_modules/@openai/codex/bin/codex.js");
      try { await access(cli); executable = process.execPath; prefix = [cli]; break; } catch { /* Try another installed CLI. */ }
    }
  }
}
if (!executable) throw new Error("Codex CLI belum ditemukan. Tambahkan server STDIO melalui pengaturan MCP Codex desktop; gunakan codex-config.toml yang dibuat oleh setup.");
const result = spawnSync(executable, [...prefix, ...args], { stdio: "inherit", shell: false, windowsHide: true });
if (result.error || result.status !== 0) throw new Error("MCP belum terdaftar. Gunakan Codex CLI yang tersedia atau salin pengaturan codex-config.toml ke konfigurasi Codex.");
console.log("MCP internflow terdaftar. Muat ulang sesi Codex untuk menggunakan alat logbook.");
