import type { Workbook, Worksheet } from "exceljs";
import { isValidHyperlink, sanitizeCellText } from "./sanitize-cell";
import { styleReportSheet } from "./sheet-style";
import { splitReportNote } from "./split-note";
import { reportPhotoHref, type ReportPhotoShare } from "../domain/photo-link";
export type ExportEvidenceSummaryItem = { id: string; type: "PHOTO" | "LINK" | "GITHUB_COMMIT"; title: string | null; status: string; url?: string | null };
export type ExportActivityRow = { id: string; activityDate: string; startTime: string | null; endTime: string | null; title: string; description: string | null; evidences?: ExportEvidenceSummaryItem[]; status?: string; href?: string };
export function formatEvidenceSummary(evidences?: ExportEvidenceSummaryItem[]): string {
  if (!evidences?.length) return "—";
  const labels = { PHOTO: "Foto", LINK: "Tautan", GITHUB_COMMIT: "Commit" };
  return (Object.keys(labels) as (keyof typeof labels)[]).flatMap(type => { const count = evidences.filter(item => item.type === type).length; return count ? [`${count} ${labels[type]}`] : []; }).join(", ");
}
export function buildLogbookSheet(workbook: Workbook, activities: ExportActivityRow[], baseUrl?: string, share?: ReportPhotoShare): Worksheet {
  const sheet = workbook.addWorksheet("Logbook");
  sheet.columns = [{ header: "No", key: "no", width: 6 }, { header: "Tanggal", key: "activityDate", width: 14 }, { header: "Mulai", key: "startTime", width: 10 }, { header: "Selesai", key: "endTime", width: 10 }, { header: "Kegiatan", key: "title", width: 36 }, { header: "Catatan", key: "description", width: 52 }, { header: "Lampiran · klik untuk buka", key: "evidence", width: 28 }, { header: "Status", key: "status", width: 14 }];
  for (const [index, act] of activities.entries()) {
    const summary = formatEvidenceSummary(act.evidences);
    const notes = splitReportNote(act.description);
    const row = sheet.addRow({ no: index + 1, activityDate: act.activityDate, startTime: act.startTime?.slice(0, 5) || "—", endTime: act.endTime?.slice(0, 5) || "—", title: sanitizeCellText(act.title), description: sanitizeCellText(notes[0]), evidence: summary, status: act.status === "DRAFT" ? "Draft" : act.status === "ARCHIVED" ? "Diarsipkan" : act.status === "READY" ? "Siap" : "Selesai" });
    const first = act.evidences?.find(item => item.status === "AVAILABLE");
    const url = first?.type === "PHOTO" && baseUrl ? reportPhotoHref(baseUrl, first.id, share) : first?.url;
    if (url && isValidHyperlink(url)) row.getCell("evidence").value = { text: `${summary} · Buka`, hyperlink: url };
    for (const note of notes.slice(1)) sheet.addRow({ no: `↳ ${index + 1}`, activityDate: act.activityDate, title: sanitizeCellText(`Lanjutan: ${act.title}`), description: sanitizeCellText(note), evidence: "—" });
  }
  styleReportSheet(sheet, [6, 14, 10, 10, 36, 52, 28, 14]);
  return sheet;
}
