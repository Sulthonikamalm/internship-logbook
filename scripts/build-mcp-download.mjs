import JSZip from "jszip";
import { readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Deliberately enumerate distribution inputs. Never archive a workspace or glob
// environment files, credentials, user sessions, local reports or screenshots.
export const mcpPackageFiles = {
  "package.json": "mcp-client/package.json",
  "package-lock.json": "mcp-client/package-lock.json",
  "README.md": "mcp-client/README.md",
  "setup.mjs": "mcp-client/setup.mjs",
  "connect-codex.mjs": "mcp-client/connect-codex.mjs",
  "scripts/logbook/index.mjs": "scripts/logbook/index.mjs",
  "scripts/logbook/client.mjs": "scripts/logbook/client.mjs",
  "scripts/logbook/capture.mjs": "scripts/logbook/capture.mjs",
  "scripts/logbook/public-config.mjs": "scripts/logbook/public-config.mjs",
  "docs/CODEX_LOGBOOK.md": "docs/CODEX_LOGBOOK.md",
};

export async function buildMcpPackage({ outputDir = resolve(root, "public/downloads"), appUrl = process.env.APP_BASE_URL || "https://internship-logbook-kijc.vercel.app" } = {}) {
  const origin = new URL(appUrl);
  if (origin.username || origin.password || !["https:", "http:"].includes(origin.protocol)) throw new Error("Invalid public application URL");
  const zip = new JSZip();
  const date = new Date("2000-01-01T00:00:00Z");
  const add = (name, content) => zip.file(`internflow-mcp/${name}`, content, { date, createFolders: false });
  for (const [name, source] of Object.entries(mcpPackageFiles)) {
    const path = resolve(root, source);
    if (!(await lstat(path)).isFile()) throw new Error(`Distribution input is not a regular file: ${source}`);
    add(name, await readFile(path));
  }
  add("install.json", JSON.stringify({ appUrl: origin.origin }, null, 2));
  add(".codex/logbook.example.json", JSON.stringify({ appUrl: origin.origin, repositories: ["owner/repository"], profiles: {
    "owner/repository": { localPath: "/path/to/your/project", install: ["npm", "ci", "--ignore-scripts"],
      start: ["npm", "run", "dev", "--", "--port", "{port}"], routes: [{ path: "/", readySelector: "body" }], env: {} },
  } }, null, 2));
  add(".gitignore", "node_modules/\n.env*\n.codex/local/\n.codex/logbook.local.json\ncodex-config.toml\n");
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const pkg = JSON.parse(await readFile(resolve(root, "mcp-client/package.json"), "utf8"));
  const manifest = { name: pkg.name, version: pkg.version, filename: "internflow-mcp.zip", bytes: bytes.length, sha256: checksum };
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, manifest.filename), bytes);
  await writeFile(resolve(outputDir, "internflow-mcp.sha256"), `${checksum}  ${manifest.filename}\n`);
  await writeFile(resolve(outputDir, "internflow-mcp.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await buildMcpPackage()));
