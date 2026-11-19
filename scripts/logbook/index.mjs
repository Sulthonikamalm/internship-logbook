import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { api, configuration, localDir, login, logout, uploadFile, writePrivateJson } from "./client.mjs";
import { captureCommit } from "./capture.mjs";

const repository = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).transform(value => value.toLowerCase());
const request = z.object({ requestId: z.uuid().describe("Gunakan UUID yang sama saat melanjutkan permintaan."),
  period: z.enum(["daily", "weekly", "monthly", "custom"]), from: z.string(), to: z.string(),
  category: z.enum(["INTERNSHIP", "THESIS", "PERSONAL"]).default("INTERNSHIP"), repositories: z.array(repository).min(1).max(10) });
const ref = z.object({ kind: z.enum(["activity", "todo", "photo", "commit", "attendance"]), id: z.uuid() });
const plan = z.object({ entries: z.array(z.object({ activityId: z.uuid().optional(), expectedVersion: z.number().int().optional(),
  date: z.string(), title: z.string(), description: z.string().default(""), startTime: z.string().optional().describe("HH:mm dalam zona profil, hanya jika didukung catatan atau absensi."),
  endTime: z.string().optional(), evidenceIds: z.array(z.uuid()), sourceRefs: z.array(ref).min(1) })).max(500),
  gaps: z.array(z.object({ date: z.string(), reason: z.string() })).default([]), summary: z.string().default("") });
export async function assertProject(repositories) {
  const config = await configuration();
  if (config.repositories?.length && repositories.some(repo => !config.repositories.some(allowed => allowed.toLowerCase() === repo.toLowerCase()))) throw new Error("Perintah menyebut repository di luar konfigurasi project lokal.");
}
async function exportRun(runId) {
  const { bytes, headers } = await api(`runs/${runId}/export`, undefined, true);
  const file = resolve(localDir, "reports", `${runId}.xlsx`);
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(resolve(localDir, "reports"), { recursive: true }); await writeFile(file, bytes, { mode: 0o600 });
  return { runId, file, status: headers.get("x-internflow-status"), gaps: Number(headers.get("x-internflow-gaps") || 0) };
}
export async function perform(action, input) {
  if (action === "context") {
    const body = z.object({ request, page: z.number().int().min(1).default(1) }).parse(input); await assertProject(body.request.repositories);
    const result = await api("context", body);
    const checkpoint = resolve(localDir, "requests", `${body.request.requestId}.json`);
    let previous;
    try { previous = JSON.parse(await readFile(checkpoint, "utf8")); } catch { /* First context page. */ }
    if (!previous?.plan) await writePrivateJson(checkpoint, { request: body.request });
    return result;
  }
  if (action === "sync") { const body = z.object({ repository }).parse(input); await assertProject([body.repository]); return api("commits/sync", body); }
  if (action === "commit") {
    const body = z.object({ commitId: z.uuid(), repository, page: z.number().int().min(1).max(100).default(1) }).parse(input);
    await assertProject([body.repository]); return api(`commits/${body.commitId}?repository=${encodeURIComponent(body.repository)}&page=${body.page}`);
  }
  if (action === "capture") {
    const body = z.object({ commitId: z.uuid(), repository, path: z.string().optional(), route: z.string().optional() }).parse(input);
    await assertProject([body.repository]); return captureCommit(body);
  }
  if (action === "save") {
    const body = z.object({ request, plan }).parse(input); await assertProject(body.request.repositories);
    const checkpoint = resolve(localDir, "requests", `${body.request.requestId}.json`);
    await writePrivateJson(checkpoint, body);
    const result = await api("save", body);
    await writePrivateJson(checkpoint, { ...body, runId: result.run.id });
    return { runId: result.run.id, status: result.run.status, activityIds: result.run.activityIds, gaps: result.run.gaps };
  }
  if (action === "resume") {
    const { requestId } = z.object({ requestId: z.uuid() }).parse(input);
    const checkpoint = JSON.parse(await readFile(resolve(localDir, "requests", `${requestId}.json`), "utf8"));
    if (!checkpoint.plan) return perform("context", { request: checkpoint.request, page: 1 });
    const saved = await perform("save", { request: checkpoint.request, plan: checkpoint.plan }); return exportRun(saved.runId);
  }
  if (action === "export") return exportRun(z.uuid().parse(input.runId));
  if (action === "runs") return api("runs");
  if (action === "upload") return uploadFile(z.string().parse(input.file), { uploadId: input.uploadId, capturedAt: input.capturedAt });
  throw new Error("Perintah tidak dikenali.");
}
async function mcp() {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const server = new McpServer({ name: "internflow-logbook", version: "1.0.0" }, { instructions:
    "Susun logbook hanya untuk repository yang diminta. Sinkronkan commit, baca SEMUA halaman konteks, periksa gambar lewat logbook_photo, lalu pasangkan bukti. Jangan gunakan foto kegiatan lain, jangan anggap waktu unggah sebagai tanggal kegiatan, jangan mengarang hari kosong. Utamakan Activity yang sudah ada beserta expectedVersion. Saat foto relevan habis gunakan logbook_capture; itu mencoba tampilan aplikasi lalu diff. Simpan melalui logbook_save dan ekspor melalui logbook_export. Tampilkan file Excel dan daftar kekurangan kepada pengguna." });
  function tool(name, description, shape, action) {
    server.registerTool(name, { description, inputSchema: shape }, async input => {
      try { return { content: [{ type: "text", text: JSON.stringify(await perform(action, input)) }] }; }
      catch (error) { return { isError: true, content: [{ type: "text", text: error.message }] }; }
    });
  }
  tool("logbook_context", "Baca kegiatan, Todo, absensi, foto, dan commit untuk project/periode. Lanjutkan page sampai semua hasMore=false.", { request, page: z.number().int().min(1).default(1) }, "context");
  tool("logbook_sync", "Sinkronkan commit milik akun GitHub yang terhubung, hanya dari repository pilihan.", { repository }, "sync");
  tool("logbook_commit", "Baca perubahan kode dan sumber commit sebelum menyusun kegiatan atau screenshot.", { commitId: z.uuid(), repository, page: z.number().int().min(1).max(100).default(1) }, "commit");
  server.registerTool("logbook_photo", { description: "Lihat isi foto privat untuk menilai kecocokannya dengan kegiatan; waktu unggah bukan tanggal kegiatan.", inputSchema: { evidenceId: z.uuid() } }, async ({ evidenceId }) => {
    try { const { bytes, headers } = await api(`photos/${evidenceId}`, undefined, true); return { content: [{ type: "text", text: `Waktu pengambilan: ${headers.get("x-internflow-captured-at") || "unknown"}. Gunakan zona waktu profil; tanggal tidak diketahui harus dinilai dari sumber pendukung.` }, { type: "image", data: bytes.toString("base64"), mimeType: "image/jpeg" }] }; }
    catch (error) { return { isError: true, content: [{ type: "text", text: error.message }] }; }
  });
  tool("logbook_capture", "Lengkapi kegiatan coding yang kekurangan foto dengan screenshot versi commit asli. Utamakan tampilan aplikasi sesuai profil lokal, lalu kode/diff. Hasil diunggah ke Evidence Library.", { commitId: z.uuid(), repository, path: z.string().optional(), route: z.string().optional() }, "capture");
  tool("logbook_save", "Simpan kegiatan, sumber, alokasi foto, dan snapshot laporan secara atomik. Kegiatan manual dipertahankan. Gunakan requestId dan payload yang sama untuk retry.", { request, plan }, "save");
  tool("logbook_export", "Unduh Excel bergambar dari snapshot laporan. Kembalikan tautan file lokal dan sampaikan kekurangannya.", { runId: z.uuid() }, "export");
  tool("logbook_resume", "Lanjutkan permintaan lokal yang terputus dengan UUID semula.", { requestId: z.uuid() }, "resume");
  tool("logbook_runs", "Lihat laporan yang sudah tersimpan dalam akun aplikasi.", {}, "runs");
  await server.connect(new StdioServerTransport());
}
async function main() {
  const [action = "help", path] = process.argv.slice(2);
  if (action === "mcp") return mcp();
  if (action === "login") {
    if (!process.stdin.isTTY) throw new Error("Jalankan login di terminal interaktif. Jangan kirim password melalui chat atau argumen perintah.");
    let muted = false;
    const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
    const terminal = createInterface({ input: process.stdin, output, terminal: true });
    try {
      const email = await terminal.question("Email akun aplikasi: ");
      process.stdout.write("Password (disembunyikan): "); muted = true;
      const password = await terminal.question(""); muted = false; process.stdout.write("\n");
      await login(email.trim(), password); process.stdout.write("Akun aplikasi terhubung. Sesi tersimpan secara lokal.\n");
    } finally { terminal.close(); }
    return;
  }
  if (action === "logout") { await logout(); process.stdout.write("Sesi lokal dihapus.\n"); return; }
  if (action === "help") {
    process.stdout.write("InternFlow: npm run logbook -- <context|sync|commit|capture|save|resume|export|upload|runs> [input.json]\nLogin: npm run logbook:login\nMCP: npm run logbook:mcp\nInput menggunakan JSON; lihat docs/CODEX_LOGBOOK.md.\n"); return;
  }
  const input = path ? JSON.parse(await readFile(resolve(path), "utf8")) : {};
  process.stdout.write(`${JSON.stringify(await perform(action, input), null, 2)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
