import ExcelJS from "exceljs";
import { buildLogbookSheet } from "../excel/build-logbook-sheet";
import { buildEvidenceSheet } from "../excel/build-evidence-sheet";
import { buildTodoSheet } from "../excel/build-todo-sheet";
import type { ExportDataResult } from "./get-export-data";
import { categoryLabels } from "@/features/work/domain/category";
import { sanitizeCellText } from "../excel/sanitize-cell";
import type { ReportPhotoShare } from "../domain/photo-link";

export type GenerateWorkbookOptions = {
  includeEvidence: boolean;
  baseUrl: string;
  photoShare?: ReportPhotoShare | null;
};

/** Produces a report with a reading guide, printable rows and private photo links. */
export async function generateWorkbook(
  data: ExportDataResult,
  options: GenerateWorkbookOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InternFlow";
  workbook.lastModifiedBy = "InternFlow";
  workbook.created = new Date();
  workbook.modified = new Date();

  const hasCompletedTodos = Boolean(data.todos?.length);
  const summary = workbook.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 25 }, { width: 70 }];
  summary.addRows([
    ["InternFlow", "Laporan kegiatan"],
    ["Nama", sanitizeCellText(data.user.displayName)],
    ["Kategori", categoryLabels[data.category ?? "INTERNSHIP"]],
    ["Periode", `${data.from ?? data.activities[0]?.activityDate ?? "—"} — ${data.to ?? data.activities.at(-1)?.activityDate ?? "—"}`],
    ["Jumlah kegiatan", data.activities.length],
    ["Cara membaca", [
      "Logbook berisi kegiatan.",
      options.includeEvidence ? "Evidence Detail berisi semua lampiran." : "Laporan ini tidak menyertakan lampiran.",
      hasCompletedTodos ? "Todos berisi pekerjaan yang selesai dalam periode ini." : "",
    ].filter(Boolean).join(" ")],
    ["Lampiran foto", options.includeEvidence
      ? options.photoShare ? `Klik Buka foto. Penerima file dapat melihat foto tanpa login hingga ${options.photoShare.expiresAt.slice(0, 10)}, kecuali akses dicabut.` : "Klik Buka foto, lalu masuk ke akun pemilik di InternFlow. File tetap privat; tautan dapat dibuka selama bukti tersedia."
      : "Tidak disertakan."],
    ["Keterangan", "Catatan panjang diteruskan pada baris Lanjutan dengan nomor yang sama. Gunakan filter pada baris judul untuk mencari data."],
  ]);
  summary.eachRow((row, index) => {
    row.height = index === 1 ? 42 : index > 5 ? 60 : 30;
    row.eachCell(cell => {
      cell.font = { name: "Calibri", size: index === 1 ? 18 : 11, bold: index === 1, color: { argb: "FF182B49" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  summary.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  buildLogbookSheet(
    workbook,
    options.includeEvidence ? data.activities : data.activities.map(row => ({ ...row, evidences: [] })),
    options.includeEvidence ? options.baseUrl : undefined,
    options.photoShare ?? undefined
  );
  if (options.includeEvidence) buildEvidenceSheet(workbook, data.evidenceDetails, options.baseUrl, options.photoShare ?? undefined);
  if (hasCompletedTodos) buildTodoSheet(workbook, data.todos!);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
