import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";

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
    evidenceLinkMode: z.enum(["APP_PRIVATE", "DRIVE_SHARED"]).default("APP_PRIVATE"),
  })
  .strict()
  .superRefine((data, ctx) => {
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
