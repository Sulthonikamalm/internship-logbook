import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mergeWorkRecords, type RecordActivity, type RecordCompletion } from "@/features/work/domain/records";
import { missingReportEvidence } from "@/features/reports/domain/evidence-gate";
import { exportLogbookSchema } from "@/features/reports/schemas/export.schema";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import { splitReportNote } from "@/features/reports/excel/split-note";

const activity: RecordActivity = { id: "activity", title: "Magang", description: "Catatan", activity_date: "2026-10-02", start_time: null, end_time: null, status: "READY", todo_id: "todo", completion_transition_id: "completion", work_category: "INTERNSHIP" };
const completion: RecordCompletion = { id: "completion", todo_id: "todo", created_at: "2026-10-01T18:00:00Z", work_category: "INTERNSHIP", completion_snapshot: { title: "Judul historis", description: "Catatan historis", category: "INTERNSHIP" }, todo: { title: "Judul baru", description: "Berubah", work_category: "PERSONAL" } };
describe("Completed work history", () => {
  it("represents atomic completion only once", () => { expect(mergeWorkRecords([activity], [completion], "2026-10-02", "2026-10-02", "Asia/Jakarta")).toHaveLength(1); });
  it("keeps the original snapshot after reopening, renaming or changing task category", () => {
    const rows = mergeWorkRecords([], [completion], "2026-10-02", "2026-10-02", "Asia/Jakarta");
    expect(rows[0]).toMatchObject({ title: "Judul historis", description: "Catatan historis", category: "INTERNSHIP", kind: "COMPLETION", date: "2026-10-02" });
  });
  it("preserves Personal work after deleting its task", () => {
    const rows = mergeWorkRecords([], [{ ...completion, work_category: "PERSONAL", todo: null }], "2026-10-02", "2026-10-02", "Asia/Jakarta");
    expect(rows[0]).toMatchObject({ title: "Judul historis", category: "PERSONAL" });
  });
  it("filters broad UTC query results to the user's exact local dates", () => {
    expect(mergeWorkRecords([], [completion], "2026-10-02", "2026-10-02", "America/New_York")).toHaveLength(0);
    expect(mergeWorkRecords([], [completion], "2026-10-01", "2026-10-01", "America/New_York")).toHaveLength(1);
  });
  it("does not count a manually linked activity as a completed task without a completion event", () => {
    const rows = mergeWorkRecords([{ ...activity, completion_transition_id: null }], [], "2026-10-02", "2026-10-02", "Asia/Jakarta");
    expect(rows[0].isCompletion).toBe(false);
  });
  it("counts a legacy linked activity once when a same-day completion exists", () => {
    const rows = mergeWorkRecords([{ ...activity, completion_transition_id: null }], [{ ...completion, completion_snapshot: null }], "2026-10-02", "2026-10-02", "Asia/Jakarta");
    expect(rows).toHaveLength(1); expect(rows[0].isCompletion).toBe(true);
  });
  it("records a second completion after reopening as a separate historical event", () => {
    const second = { ...completion, id: "second", created_at: "2026-10-02T18:00:00Z" };
    expect(mergeWorkRecords([activity], [completion, second], "2026-10-01", "2026-10-04", "Asia/Jakarta")).toHaveLength(2);
  });
});
describe("Category reports and readable photo links", () => {
  const row = { id: "work", activityDate: "2026-10-02", startTime: null, endTime: null, title: "Pekerjaan", description: "A".repeat(4000), evidences: [{ id: "00000000-0000-4000-8000-000000000001", type: "PHOTO" as const, title: "Foto", status: "AVAILABLE" }] };
  it("requires evidence inclusion for both academic reports, allows Personal without it", () => {
    for (const category of ["INTERNSHIP", "THESIS"]) expect(exportLogbookSchema.safeParse({ from: "2026-10-01", to: "2026-10-02", category, includeEvidence: false }).success).toBe(false);
    expect(exportLogbookSchema.safeParse({ from: "2026-10-01", to: "2026-10-02", category: "PERSONAL", includeEvidence: false }).success).toBe(true);
  });
  it("rejects missing or broken proof without blocking Personal exports", () => {
    const rows = [{ ...row, evidences: [] }, { ...row, id: "broken", evidences: [{ ...row.evidences[0], status: "BROKEN" }] }, row];
    expect(missingReportEvidence(rows, "THESIS").map(item => item.id)).toEqual(["work", "broken"]);
    expect(missingReportEvidence(rows, "PERSONAL")).toHaveLength(0);
  });
  it("preserves long multi-line notes within Excel's maximum row height", () => {
    const text = "=malicious\n" + "Isi laporan ".repeat(700) + "\n".repeat(45) + "Akhir";
    const chunks = splitReportNote(text);
    expect(chunks.length).toBeGreaterThan(1); expect(chunks.join("\n").replaceAll("\n", "")).toBe(text.replaceAll("\n", ""));
    expect(chunks.every(chunk => chunk.split("\n").length <= 16)).toBe(true);
  });
  it("round-trips a printable workbook with compact clickable photo links and continuation notes", async () => {
    const buffer = await generateWorkbook({ user: { userId: "owner", displayName: "Nama", timezone: "Asia/Jakarta" }, category: "THESIS", from: "2026-10-01", to: "2026-10-02", activities: [row], evidenceDetails: [{ evidenceId: row.evidences[0].id, activityId: row.id, activityDate: row.activityDate, activityTitle: row.title, type: "PHOTO", title: "Foto", status: "AVAILABLE" }] }, { includeEvidence: true, baseUrl: "https://internflow.invalid" });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
    expect(book.getWorksheet("Ringkasan")?.getRow(3).getCell(2).value).toBe("Tugas Akhir");
    const details = book.getWorksheet("Evidence Detail")!;
    expect(details.getRow(2).getCell(5).value).toMatchObject({ text: "Buka foto", hyperlink: `https://internflow.invalid/evidence/${row.evidences[0].id}` });
    expect(details.getColumn(7).hidden).toBe(true);
    const logbook = book.getWorksheet("Logbook")!; expect(logbook.rowCount).toBeGreaterThan(2); expect(logbook.pageSetup.fitToWidth).toBe(1);
    expect(logbook.getRow(2).getCell(7).value).toMatchObject({ hyperlink: `https://internflow.invalid/evidence/${row.evidences[0].id}` });
    const notes: string[] = []; logbook.eachRow((record, index) => { if (index > 1) { notes.push(String(record.getCell(6).value)); expect(record.height).toBeLessThanOrEqual(409); } });
    expect(notes.join("\n").replaceAll("\n", "")).toBe(row.description);
  });
});
