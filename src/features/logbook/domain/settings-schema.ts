import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";

export const workingDayNames: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export const internshipSettingsSchema = z
  .object({
    startDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null))
      .refine((val) => val === null || isRealDate(val), {
        message: "Format tanggal mulai tidak valid (YYYY-MM-DD)",
      }),
    endDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null))
      .refine((val) => val === null || isRealDate(val), {
        message: "Format tanggal selesai tidak valid (YYYY-MM-DD)",
      }),
    workingDays: z
      .array(z.number().int().min(1, "Hari kerja harus antara 1 dan 7").max(7, "Hari kerja harus antara 1 dan 7"))
      .min(1, "Pilih minimal 1 hari kerja")
      .max(7, "Maksimal 7 hari kerja")
      .refine(
        (days) => new Set(days).size === days.length,
        "Hari kerja tidak boleh duplikat (mengandung hari yang sama)"
      ),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "Tanggal selesai harus sama atau setelah tanggal mulai.",
      path: ["endDate"],
    }
  );

export type InternshipSettingsInput = z.infer<typeof internshipSettingsSchema>;
