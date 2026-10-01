import type { Workbook, Worksheet } from "exceljs";
import { sanitizeCellText } from "./sanitize-cell";

export type ExportTodoRow = {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  stageName: string;
  startedAt: string | null;
  completedAt: string | null;
  evidenceCount: number;
  evidenceHealth: string;
  activityCount: number;
};

/**
 * Builds and formats the "Todos" worksheet inside the provided ExcelJS workbook.
 */
export function buildTodoSheet(
  workbook: Workbook,
  todos: ExportTodoRow[]
): Worksheet {
  const sheet = workbook.addWorksheet("Todos", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  // Define columns
  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Judul Todo", key: "title", width: 36 },
    { header: "Prioritas", key: "priority", width: 12 },
    { header: "Jatuh Tempo", key: "dueDate", width: 14 },
    { header: "Tahap", key: "stageName", width: 16 },
    { header: "Mulai", key: "startedAt", width: 14 },
    { header: "Selesai", key: "completedAt", width: 14 },
    { header: "Evidence", key: "evidenceCount", width: 12 },
    { header: "Health", key: "evidenceHealth", width: 14 },
    { header: "Activity Terkait", key: "activityCount", width: 16 },
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
  todos.forEach((todo, index) => {
    const row = sheet.addRow({
      no: index + 1,
      title: sanitizeCellText(todo.title),
      priority: todo.priority,
      dueDate: todo.dueDate || "—",
      stageName: todo.stageName,
      startedAt: todo.startedAt ? todo.startedAt.slice(0, 10) : "—",
      completedAt: todo.completedAt ? todo.completedAt.slice(0, 10) : "—",
      evidenceCount: todo.evidenceCount,
      evidenceHealth: todo.evidenceHealth,
      activityCount: todo.activityCount,
    });

    row.height = 22;

    row.eachCell((cell, colNumber) => {
      cell.border = dataBorder;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };

      if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9 || colNumber === 10) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    });
  });

  return sheet;
}
