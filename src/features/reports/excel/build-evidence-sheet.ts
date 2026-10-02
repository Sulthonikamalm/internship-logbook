import type { Workbook, Worksheet } from "exceljs";
import { isValidHyperlink, sanitizeCellText } from "./sanitize-cell";
import { styleReportSheet } from "./sheet-style";
import { reportPhotoHref, type ReportPhotoShare } from "../domain/photo-link";
export type ExportDetailEvidenceItem = { evidenceId: string; activityId: string; activityDate: string; activityTitle?: string; type: "PHOTO" | "LINK" | "GITHUB_COMMIT"; title: string | null; status: string; url?: string | null };
export function buildEvidenceSheet(workbook: Workbook, items: ExportDetailEvidenceItem[], baseUrl: string, share?: ReportPhotoShare): Worksheet {
  const sheet = workbook.addWorksheet("Evidence Detail");
  sheet.columns = [{ header: "Tanggal", key: "activityDate", width: 14 }, { header: "Kegiatan", key: "activityTitle", width: 36 }, { header: "Jenis", key: "type", width: 16 }, { header: "Lampiran", key: "title", width: 36 }, { header: "Klik untuk membuka", key: "url", width: 22 }, { header: "Status", key: "status", width: 18 }, { header: "Evidence ID", key: "evidenceId", width: 38, hidden: true }, { header: "Activity ID", key: "activityId", width: 38, hidden: true }];
  const labels = { PHOTO: "Foto", LINK: "Tautan", GITHUB_COMMIT: "Commit GitHub" };
  for (const item of items) {
    const row = sheet.addRow({ activityDate: item.activityDate, activityTitle: sanitizeCellText(item.activityTitle) || "—", type: labels[item.type], title: sanitizeCellText(item.title) || labels[item.type], url: "—", status: item.status === "AVAILABLE" ? "Tersedia" : "Tidak tersedia", evidenceId: item.evidenceId, activityId: item.activityId });
    const target = item.type === "PHOTO" ? reportPhotoHref(baseUrl, item.evidenceId, share) : item.url;
    if (target && isValidHyperlink(target) && item.status === "AVAILABLE") row.getCell("url").value = { text: item.type === "PHOTO" ? "Buka foto" : "Buka lampiran", hyperlink: target };
  }
  styleReportSheet(sheet, [14, 36, 16, 36, 22, 18, 38, 38], 6);
  return sheet;
}
