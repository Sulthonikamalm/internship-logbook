import type { Workbook, Worksheet } from "exceljs";
import { sanitizeCellText } from "./sanitize-cell";

export type ExportEvidenceSummaryItem = {
  id: string;
  type: "PHOTO" | "LINK" | "GITHUB_COMMIT";
  title: string | null;
  status: string;
  url?: string | null;
};

export type ExportActivityRow = {
  id: string;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  description: string | null;
  evidences?: ExportEvidenceSummaryItem[];
};

/**
 * Builds the evidence summary string for Sheet 1.
 * e.g., "1 Foto, 2 Tautan, 1 Commit" or "—".
 */
export function formatEvidenceSummary(evidences?: ExportEvidenceSummaryItem[]): string {
  if (!evidences || evidences.length === 0) {
    return "—";
  }

  let photoCount = 0;
  let linkCount = 0;
  let commitCount = 0;

  for (const ev of evidences) {
    if (ev.type === "PHOTO") photoCount++;
    else if (ev.type === "LINK") linkCount++;
    else if (ev.type === "GITHUB_COMMIT") commitCount++;
  }

  const parts: string[] = [];
  if (photoCount > 0) parts.push(`${photoCount} Foto`);
  if (linkCount > 0) parts.push(`${linkCount} Tautan`);
  if (commitCount > 0) parts.push(`${commitCount} Commit`);

  return parts.length > 0 ? parts.join(", ") : "—";
}

/**
 * Builds and formats the "Logbook" worksheet inside the provided ExcelJS workbook.
 */
export function buildLogbookSheet(
  workbook: Workbook,
  activities: ExportActivityRow[]
): Worksheet {
  const sheet = workbook.addWorksheet("Logbook", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  // Define columns
  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Tanggal", key: "activityDate", width: 14 },
    { header: "Jam Mulai", key: "startTime", width: 12 },
    { header: "Jam Selesai", key: "endTime", width: 12 },
    { header: "Aktivitas", key: "title", width: 36 },
    { header: "Keterangan", key: "description", width: 52 },
    { header: "Evidence", key: "evidence", width: 22 },
  ];

  // Header Row styling (Row 1): Branded blue (#2563EB), white bold text
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1D4ED8" } },
      bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
      left: { style: "thin", color: { argb: "FF1D4ED8" } },
      right: { style: "thin", color: { argb: "FF1D4ED8" } },
    };
  });

  // Border style for data cells
  const dataBorder = {
    top: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    left: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    right: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  };

  // Add data rows
  activities.forEach((act, index) => {
    const row = sheet.addRow({
      no: index + 1,
      activityDate: act.activityDate,
      startTime: act.startTime || "—",
      endTime: act.endTime || "—",
      title: sanitizeCellText(act.title),
      description: act.description ? sanitizeCellText(act.description) : "—",
      evidence: formatEvidenceSummary(act.evidences),
    });

    row.height = 24;

    // Apply alignment and borders cell by cell
    row.eachCell((cell, colNumber) => {
      cell.border = dataBorder;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };

      if (colNumber === 1) {
        // No column: center
        cell.alignment = { vertical: "top", horizontal: "center" };
      } else if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
        // Date & Time: center
        cell.alignment = { vertical: "top", horizontal: "center" };
      } else if (colNumber === 7) {
        // Evidence summary: center
        cell.alignment = { vertical: "top", horizontal: "center", wrapText: true };
      } else {
        // Text columns (Aktivitas, Keterangan): left, wrap text
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      }
    });
  });

  return sheet;
}
