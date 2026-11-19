import type { Workbook } from "exceljs";
import { sanitizeCellText } from "./sanitize-cell";
import { styleReportSheet } from "./sheet-style";
import { reportPhotoHref, type ReportPhotoShare } from "../domain/photo-link";
import type { ExportDetailEvidenceItem } from "./build-evidence-sheet";

export type DocumentationImage = { evidenceId: string; base64?: string; message?: string; provenance?: string };
export function buildDocumentationSheet(workbook: Workbook, items: ExportDetailEvidenceItem[], images: DocumentationImage[], baseUrl: string, share?: ReportPhotoShare) {
  const sheet = workbook.addWorksheet("Dokumentasi");
  sheet.columns = [{ header: "Tanggal", key: "date", width: 14 }, { header: "Kegiatan", key: "activity", width: 36 },
    { header: "Gambar", key: "image", width: 48 }, { header: "Bukti asli", key: "url", width: 22 }, { header: "Sumber dan keterangan", key: "source", width: 52 }];
  const byId = new Map(images.map(item => [item.evidenceId, item]));
  const positions: { row: number; image: DocumentationImage }[] = [];
  for (const item of items.filter(item => item.type === "PHOTO")) {
    const image = byId.get(item.evidenceId);
    const row = sheet.addRow({ date: item.activityDate, activity: sanitizeCellText(item.activityTitle),
      image: image?.base64 ? "" : sanitizeCellText(image?.message || "Gambar belum tersedia."),
      url: { text: "Buka foto", hyperlink: reportPhotoHref(baseUrl, item.evidenceId, share) },
      source: sanitizeCellText([item.title, image?.provenance, image?.message].filter(Boolean).join("\n")) });
    if (image?.base64) positions.push({ row: row.number, image });
  }
  styleReportSheet(sheet, [14, 36, 48, 22, 52]);
  for (const { row, image } of positions) {
    sheet.getRow(row).height = Math.max(190, sheet.getRow(row).height ?? 190);
    const id = workbook.addImage({ base64: image.base64!, extension: "jpeg" });
    sheet.addImage(id, { tl: { col: 2.1, row: row - 0.95 }, ext: { width: 320, height: 240 }, editAs: "oneCell" });
  }
  return sheet;
}
