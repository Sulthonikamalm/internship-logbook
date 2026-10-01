import ExcelJS from "exceljs";
import { buildLogbookSheet } from "../excel/build-logbook-sheet";
import { buildEvidenceSheet } from "../excel/build-evidence-sheet";
import { buildTodoSheet } from "../excel/build-todo-sheet";
import type { ExportDataResult } from "./get-export-data";

export type GenerateWorkbookOptions = {
  includeEvidence: boolean;
  baseUrl: string;
};

/**
 * Assembles and styles an ExcelJS workbook from export data, returning an xlsx buffer.
 */
export async function generateWorkbook(
  data: ExportDataResult,
  options: GenerateWorkbookOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "InternFlow";
  workbook.lastModifiedBy = "InternFlow";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Build Sheet 1: Logbook
  buildLogbookSheet(workbook, data.activities);

  // 2. Build Sheet 2: Evidence Detail (if requested)
  if (options.includeEvidence) {
    buildEvidenceSheet(workbook, data.evidenceDetails, options.baseUrl);
  }

  // 3. Build Sheet 3: Todos (Phase 6 extension)
  if (data.todos && data.todos.length > 0) {
    buildTodoSheet(workbook, data.todos);
  }

  // 3. Write workbook to buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
