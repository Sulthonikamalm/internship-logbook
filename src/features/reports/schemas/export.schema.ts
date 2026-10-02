import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";
import { workCategorySchema, requiresWorkEvidence } from "@/features/work/domain/category";

export const exportLogbookSchema = z
  .object({
    from: z
      .string()
      .trim()
      .min(1, "Tanggal mulai wajib diisi.")
      .refine(isRealDate, "Format tanggal mulai tidak valid (YYYY-MM-DD)."),
    to: z
      .string()
      .trim()
      .min(1, "Tanggal selesai wajib diisi.")
      .refine(isRealDate, "Format tanggal selesai tidak valid (YYYY-MM-DD)."),
    includeEvidence: z.boolean().default(true),
    category: workCategorySchema.default("INTERNSHIP"),
    evidenceLinkMode: z.enum(["APP_PRIVATE", "REPORT_SHARED", "DRIVE_SHARED"]).default("APP_PRIVATE"),
    shareExpiresDays: z.union([z.literal(30), z.literal(90), z.literal(180)]).default(90),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (requiresWorkEvidence(data.category) && !data.includeEvidence) ctx.addIssue({ code: "custom", path: ["includeEvidence"], message: "Laporan Magang dan Tugas Akhir wajib menyertakan bukti." });
    if (data.evidenceLinkMode === "REPORT_SHARED" && !data.includeEvidence) ctx.addIssue({ code: "custom", path: ["includeEvidence"], message: "Sertakan lampiran untuk membagikan foto." });
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
      });
    }
  });

export type ExportLogbookInput = z.infer<typeof exportLogbookSchema>;
export type ExportLogbookRawInput = z.input<typeof exportLogbookSchema>;
