import { z } from "zod";

export const WORK_CATEGORIES = ["INTERNSHIP", "THESIS", "PERSONAL"] as const;
export const workCategorySchema = z.enum(WORK_CATEGORIES);
export type WorkCategory = z.infer<typeof workCategorySchema>;
export const categoryLabels: Record<WorkCategory, string> = {
  INTERNSHIP: "Magang",
  THESIS: "Tugas Akhir",
  PERSONAL: "Personal",
};
export const categoryDescriptions: Record<WorkCategory, string> = {
  INTERNSHIP: "Kegiatan magang",
  THESIS: "Kegiatan tugas akhir",
  PERSONAL: "Di luar magang dan tugas akhir",
};
export function parseWorkCategory(value: unknown): WorkCategory {
  const parsed = workCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : "INTERNSHIP";
}
export function requiresWorkEvidence(category: WorkCategory): boolean {
  return category !== "PERSONAL";
}
