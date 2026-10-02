import type { Workbook, Worksheet } from "exceljs";
import { sanitizeCellText } from "./sanitize-cell";
import { styleReportSheet } from "./sheet-style";
export type ExportTodoRow = { id: string; title: string; priority: string; dueDate: string | null; stageName: string; startedAt: string | null; completedAt: string | null; evidenceCount: number; evidenceHealth: string; activityCount: number };
export function buildTodoSheet(workbook: Workbook, todos: ExportTodoRow[]): Worksheet {
  const sheet = workbook.addWorksheet("Todos");
  sheet.columns = [{ header: "No", key: "no", width: 6 }, { header: "Tugas selesai", key: "title", width: 60 }, { header: "Tanggal selesai", key: "completedAt", width: 20 }, { header: "Bukti tersedia", key: "evidenceCount", width: 18 }, { header: "Catatan aktivitas", key: "activityCount", width: 20 }];
  todos.forEach((todo, index) => sheet.addRow({ no: index + 1, title: sanitizeCellText(todo.title), completedAt: todo.completedAt?.slice(0, 10) ?? "—", evidenceCount: todo.evidenceCount, activityCount: todo.activityCount }));
  styleReportSheet(sheet, [6, 60, 20, 18, 20]);
  return sheet;
}
