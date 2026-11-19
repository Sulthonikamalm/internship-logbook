// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { buildMcpPackage } from "../../scripts/build-mcp-download.mjs";

let directory: string;
afterAll(async () => {
  if (!directory) return;
  for (const file of ["internflow-mcp.zip", "internflow-mcp.sha256", "internflow-mcp.json"]) await unlink(join(directory, file)).catch(() => {});
  await rmdir(directory);
});

describe("downloadable MCP distribution", () => {
  it("builds a standalone, reproducible archive containing only explicitly approved inputs", async () => {
    directory = await mkdtemp(join(tmpdir(), "internflow-mcp-package-"));
    const manifest = await buildMcpPackage({ outputDir: directory, appUrl: "https://internflow.example" });
    const bytes = await readFile(join(directory, manifest.filename));
    expect(manifest.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(manifest.bytes).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(150000);
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      ".codex/logbook.example.json", ".gitignore", "README.md", "connect-codex.mjs", "docs/CODEX_LOGBOOK.md", "install.json",
      "package-lock.json", "package.json", "scripts/logbook/capture.mjs", "scripts/logbook/client.mjs", "scripts/logbook/index.mjs", "scripts/logbook/public-config.mjs", "setup.mjs",
    ].map(name => `internflow-mcp/${name}`).sort());
    expect(names.some(name => name.includes("..") || /\.env|session\.|node_modules|local\//.test(name))).toBe(false);
    const pkg = JSON.parse(await zip.file("internflow-mcp/package.json")!.async("string"));
    const lock = JSON.parse(await zip.file("internflow-mcp/package-lock.json")!.async("string"));
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(Object.values(pkg.dependencies).every(value => /^\d+\.\d+\.\d+$/.test(String(value)))).toBe(true);
    expect(JSON.parse(await zip.file("internflow-mcp/install.json")!.async("string"))).toEqual({ appUrl: "https://internflow.example" });
    expect((await buildMcpPackage({ outputDir: directory, appUrl: "https://internflow.example" })).sha256).toBe(manifest.sha256);
  });
});
