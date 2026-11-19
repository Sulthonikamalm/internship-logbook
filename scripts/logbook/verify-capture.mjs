// Exercises real Git archives and Chromium without any application credentials.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { execute, localDir } from "./client.mjs";
import { screenshotApp, screenshotDiff } from "./capture.mjs";

const folder = resolve(localDir, "capture-verification", crypto.randomUUID());
const repository = resolve(folder, "repository"); await mkdir(repository, { recursive: true });
await execute("git", ["init"], { cwd: repository });
await execute("git", ["remote", "add", "origin", "https://github.com/fixture/history-test.git"], { cwd: repository });
const server = label => `import http from 'node:http';http.createServer((_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<!doctype html><html><title>${label}</title><body style="font:32px Arial;padding:80px"><h1 id="proof">${label}</h1><p>Historical application screenshot fixture</p></body></html>')}).listen(process.env.PORT,'127.0.0.1');`;
await writeFile(resolve(repository, "server.mjs"), server("HISTORY_AT_COMMIT_ONE"));
await execute("git", ["add", "server.mjs"], { cwd: repository });
await execute("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "Original feature"], { cwd: repository });
const sha = await execute("git", ["rev-parse", "HEAD"], { cwd: repository });
await writeFile(resolve(repository, "server.mjs"), server("CURRENT_COMMIT_TWO"));
await execute("git", ["add", "server.mjs"], { cwd: repository });
await execute("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "Newer feature"], { cwd: repository });
const current = await execute("git", ["rev-parse", "HEAD"], { cwd: repository });
const commit = { id: crypto.randomUUID(), repository: "fixture/history-test", sha, date: "2026-11-18T08:00:00Z", message: "Original feature", url: `https://github.com/fixture/history-test/commit/${sha}`,
  files: [{ filename: ".env.local", status: "modified", patch: "+SECRET=fixture-only", additions: 1, deletions: 0 },
    { filename: "feature.ts", status: "modified", patch: "@@ -1 +1 @@\n-oldFeature()\n+newFeature('<script>must be text</script>')", additions: 1, deletions: 1 }], hasMore: false };
const appDirectory = resolve(folder, "app"); await mkdir(appDirectory);
const app = await screenshotApp(commit, { localPath: repository, start: ["node", "server.mjs"], routes: [{ path: "/", readySelector: "#proof" }] }, appDirectory);
const diff = await screenshotDiff(commit);
assert.equal((await sharp(app.bytes).metadata()).width, 1280);
assert.equal((await sharp(app.bytes).metadata()).height, 1000);
assert.equal(diff.path, "feature.ts");
assert.equal(await execute("git", ["rev-parse", "HEAD"], { cwd: repository }), current);
const appFile = resolve(folder, "app.png"); const diffFile = resolve(folder, "diff.png");
await writeFile(appFile, app.bytes); await writeFile(diffFile, diff.bytes);
console.log(JSON.stringify({ passed: true, appFile, diffFile, historicalSha: sha, currentCheckoutUnchanged: true }));
