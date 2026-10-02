import type { ExportActivityRow } from "../excel/build-logbook-sheet";
import { requiresWorkEvidence, type WorkCategory } from "@/features/work/domain/category";
export function missingReportEvidence(rows: ExportActivityRow[], category: WorkCategory) {
  return requiresWorkEvidence(category) ? rows.filter(row => !row.evidences?.some(item => item.status === "AVAILABLE")) : [];
}
