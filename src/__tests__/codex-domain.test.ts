import { describe, expect, it } from "vitest";
import { parseCaptureTime } from "@/features/evidence/domain/capture-time";
import { processUploadQueue } from "@/features/evidence/domain/upload-queue";
import { generationRequestSchema, missingWorkingDays, saveGenerationSchema } from "@/features/agent/domain/schema";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { readJsonBody } from "@/lib/http/read-json";
import { streamBytes } from "@/lib/http/stream-bytes";

const request = { requestId: "10000000-0000-4000-8000-000000000001", period: "monthly" as const, from: "2026-11-01", to: "2026-11-30", category: "INTERNSHIP" as const, repositories: ["owner/project"] };
describe("Codex dates and upload scheduling", () => {
  it("keeps two uploads active, continues after failure, and reports each result", async () => {
    let active = 0; let maximum = 0; const finished: number[] = [];
    const results = await processUploadQueue([0, 1, 2, 3, 4], async index => {
      active++; maximum = Math.max(active, maximum);
      await new Promise(resolve => setTimeout(resolve, 5)); active--; finished.push(index);
      if (index === 1) throw new Error("Disconnected");
    });
    expect(maximum).toBe(2); expect(finished.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(results[1].status).toBe("rejected"); expect(results.filter(row => row.status === "fulfilled")).toHaveLength(4);
  });
  it("interprets EXIF wall clocks in the profile timezone and honors embedded offsets", () => {
    expect(parseCaptureTime("2026:11:19 08:30:00", undefined, "Asia/Jakarta")).toBe("2026-11-19T01:30:00.000Z");
    expect(parseCaptureTime("2026:11:19 08:30:00", "+09:00", "Asia/Jakarta")).toBe("2026-11-18T23:30:00.000Z");
    expect(parseCaptureTime("2026:02:30 08:30:00", undefined, "Asia/Jakarta")).toBeNull();
    expect(parseCaptureTime(undefined, undefined, "Asia/Jakarta")).toBeNull();
  });
  it("lists past working days only, honoring the configured weekend", () => {
    const gaps = missingWorkingDays({ ...request, from: "2026-11-16", to: "2026-11-23" }, ["2026-11-17"], [1, 2, 3, 4, 5], "2026-11-19");
    expect(gaps.map(row => row.date)).toEqual(["2026-11-16", "2026-11-18", "2026-11-19"]);
  });
  it("rejects invalid dates, daily ranges, cross-period entries, and missing versions", () => {
    expect(generationRequestSchema.parse({ ...request, repositories: ["Owner/Project", "owner/project"] }).repositories).toEqual(["owner/project"]);
    expect(generationRequestSchema.safeParse({ ...request, from: "2026-02-30" }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...request, period: "daily" }).success).toBe(false);
    expect(saveGenerationSchema.safeParse({ request, plan: { entries: [{ activityId: request.requestId, date: "2026-12-01", title: "Test", evidenceIds: [], sourceRefs: [{ kind: "photo", id: request.requestId }] }] } }).success).toBe(false);
  });
  it("bounds actual JSON bytes even without a Content-Length header", async () => {
    const request = new Request("https://app.example/api/agent/save", { method: "POST", body: JSON.stringify({ data: "a".repeat(100) }) });
    await expect(readJsonBody(request, 32)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(new Request("https://app.example", { method: "POST", body: '{"valid":true}' }), 32)).resolves.toEqual({ valid: true });
  });
  it("streams a large file without losing or reordering bytes", async () => {
    const input = Uint8Array.from({ length: 200000 }, (_, index) => index % 251);
    expect(new Uint8Array(await new Response(streamBytes(input)).arrayBuffer())).toEqual(input);
  });
});

describe("Codex Excel documentation", () => {
  it("embeds real thumbnail media, private links, provenance and gaps", async () => {
    const id = request.requestId;
    const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: "blue" } }).jpeg().toBuffer();
    const bytes = await generateWorkbook({ user: { userId: id, displayName: "Peserta", timezone: "Asia/Jakarta" }, category: "INTERNSHIP", from: request.from, to: request.to,
      activities: [{ id, activityDate: "2026-11-19", startTime: null, endTime: null, title: "Implementasi fitur", description: "Menguji fitur", status: "READY", evidences: [{ id, type: "PHOTO", title: "Rekonstruksi", status: "AVAILABLE" }] }],
      evidenceDetails: [{ evidenceId: id, activityId: id, activityDate: "2026-11-19", activityTitle: "Implementasi fitur", type: "PHOTO", title: "Rekonstruksi", status: "AVAILABLE" }] }, {
      includeEvidence: true, baseUrl: "https://internflow.example", documentation: [{ evidenceId: id, base64: image.toString("base64"), provenance: "owner/project @ aabbcc\nGambar dibuat hari ini" }],
      generation: { period: "monthly", summary: "Pekerjaan bulan ini", gaps: [{ date: "2026-11-18", reason: "Belum ada bukti" }] },
    });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(new Uint8Array(bytes) as never);
    expect(workbook.getWorksheet("Dokumentasi")?.getImages()).toHaveLength(1);
    expect(workbook.getWorksheet("Dokumentasi")?.getCell("E2").text).toContain("owner/project @ aabbcc");
    expect(workbook.getWorksheet("Dokumentasi")?.getCell("D2").hyperlink).toBe(`https://internflow.example/evidence/${id}`);
    expect(workbook.getWorksheet("Perlu Dilengkapi")?.getCell("B2").text).toBe("Belum ada bukti");
    expect(workbook.getWorksheet("Ringkasan")?.getCell("B9").text).toBe("Bulanan");
  });
});
