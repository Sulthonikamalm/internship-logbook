import { z } from "zod";
import { workCategorySchema } from "@/features/work/domain/category";
import { isRealDate } from "../domain/date";

const optionalText = (max: number) => z.union([z.string().max(max), z.null()])
  .optional().transform((value) => value?.trim() || null);
const optionalTime = z.union([z.string(), z.null()]).optional()
  .transform((value) => value?.trim() || null)
  .refine((value) => value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    "Gunakan format jam HH:mm.");

export const activityFieldsSchema = z.object({
  workCategory: workCategorySchema.default("INTERNSHIP"),
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160, "Maksimal 160 karakter."),
  description: optionalText(10000),
  activityDate: z.string().optional()
    .refine((value) => value === undefined || isRealDate(value), "Tanggal tidak valid."),
  startTime: optionalTime,
  endTime: optionalTime,
  todoId: z.string().uuid().optional().nullable(),
  source: z.enum(["manual", "quick_capture", "todo"]),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]),
}).strict().superRefine((value, context) => {
  if (value.endTime && !value.startTime) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "Isi jam mulai terlebih dahulu." });
  } else if (value.endTime && value.startTime && value.endTime < value.startTime) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai tidak boleh sebelum jam mulai." });
  }
});

export const createActivitySchema = activityFieldsSchema.safeExtend({
  idempotencyKey: z.uuid(),
  status: z.enum(["DRAFT", "READY"]),
});
export const updateActivitySchema = activityFieldsSchema.safeExtend({
  activityDate: z.string().refine(isRealDate, "Tanggal tidak valid."),
  expectedVersion: z.number().int().min(1),
});

export type ActivityFields = z.infer<typeof activityFieldsSchema>;
export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type UpdateActivityInput = z.input<typeof updateActivitySchema>;
