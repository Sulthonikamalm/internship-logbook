import type { Workbook, Worksheet } from "exceljs";
import { isValidHyperlink, sanitizeCellText } from "./sanitize-cell";

export type ExportDetailEvidenceItem = {
  evidenceId: string;
  activityId: string;
  activityDate: string;
  type: "PHOTO" | "LINK" | "GITHUB_COMMIT";
  title: string | null;
  status: string;
  url?: string | null;
};

/**
 * Builds and formats the "Evidence Detail" worksheet inside the provided ExcelJS workbook.
 */
export function buildEvidenceSheet(
  workbook: Workbook,
  items: ExportDetailEvidenceItem[],
  baseUrl: string
): Worksheet {
  const sheet = workbook.addWorksheet("Evidence Detail", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  // Define columns
  sheet.columns = [
    { header: "Evidence ID", key: "evidenceId", width: 38 },
    { header: "Activity ID", key: "activityId", width: 38 },
    { header: "Tanggal", key: "activityDate", width: 14 },
    { header: "Type", key: "type", width: 16 },
    { header: "Nama/Judul", key: "title", width: 35 },
    { header: "URL", key: "url", width: 50 },
    { header: "Status", key: "status", width: 14 },
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

  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // Add data rows
  items.forEach((item) => {
    // Determine evidence URL:
    // PHOTO: stable application route /evidence/<id> (APP_PRIVATE)
    // LINK / GITHUB_COMMIT: external URL (commit URL or web link)
    let targetUrl: string | null = null;
    if (item.type === "PHOTO") {
      targetUrl = `${normalizedBase}/evidence/${item.evidenceId}`;
    } else if (item.type === "LINK" || item.type === "GITHUB_COMMIT") {
      targetUrl = item.url ?? null;
    }

    const row = sheet.addRow({
      evidenceId: item.evidenceId,
      activityId: item.activityId,
      activityDate: item.activityDate,
      type: item.type,
      title: item.title ? sanitizeCellText(item.title) : "—",
      url: "", // will format hyperlink or plain text cell below
      status: item.status || "READY",
    });

    row.height = 22;

    // Apply borders and font
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = dataBorder;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };

      if (colNumber === 3 || colNumber === 4 || colNumber === 7) {
        // Tanggal, Type, Status: center
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });

    // Format URL cell with strict scheme validation
    const urlCell = row.getCell("url");
    if (targetUrl && isValidHyperlink(targetUrl)) {
      urlCell.value = {
        text: targetUrl,
        hyperlink: targetUrl,
      };
      urlCell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF2563EB" },
        underline: true,
      };
    } else {
      urlCell.value = targetUrl ? sanitizeCellText(targetUrl) : "—";
    }

    // Format Status cell: if BROKEN, render with warning reddish color
    const statusCell = row.getCell("status");
    if (item.status === "BROKEN") {
      statusCell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: "FFDC2626" },
      };
    }
  });

  return sheet;
}
