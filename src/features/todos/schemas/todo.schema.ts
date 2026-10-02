import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";
import { workCategorySchema } from "@/features/work/domain/category";

export const createTodoSchema = z.object({
  idempotencyKey: z.uuid().optional(),
  workCategory: workCategorySchema.default("INTERNSHIP"),
  autoRecordActivity: z.boolean().default(true),
  title: z
    .string()
    .trim()
    .min(1, "Judul Todo wajib diisi.")
    .max(200, "Judul Todo maksimal 200 karakter."),
  description: z
    .string()
    .max(5000, "Deskripsi maksimal 5000 karakter.")
    .optional()
    .transform((val) => val?.trim() || null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || isRealDate(val), "Format tanggal jatuh tempo tidak valid (YYYY-MM-DD).")
    .transform((val) => val || null),
  stageId: z.uuid().optional(),
});

export const updateTodoSchema = z.object({
  workCategory: workCategorySchema.optional(),
  autoRecordActivity: z.boolean().optional(),
  id: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, "Judul Todo wajib diisi.")
    .max(200, "Judul Todo maksimal 200 karakter."),
  description: z
    .string()
    .max(5000, "Deskripsi maksimal 5000 karakter.")
    .optional()
    .transform((val) => val?.trim() || null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || isRealDate(val), "Format tanggal jatuh tempo tidak valid (YYYY-MM-DD).")
    .transform((val) => val || null),
  expectedVersion: z.number().int().min(1, "Versi Todo tidak valid."),
});

export const transitionTodoSchema = z.object({
  todoId: z.uuid(),
  targetStageId: z.uuid(),
  expectedVersion: z.number().int().min(1, "Versi Todo tidak valid."),
  idempotencyKey: z.string().min(1, "Idempotency key wajib disertakan.").max(100),
  note: z
    .string()
    .max(1000, "Catatan transisi maksimal 1000 karakter.")
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),
});

export const reorderTodoSchema = z.object({
  todoId: z.uuid(),
  stageId: z.uuid(),
  newSortOrder: z.number().finite(),
  expectedVersion: z.number().int().min(1),
});

export const attachTodoEvidenceSchema = z.object({
  todoId: z.uuid(),
  evidenceId: z.uuid(),
  stageId: z.uuid().optional().nullable(),
});

export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type TransitionTodoInput = z.input<typeof transitionTodoSchema>;
export type ReorderTodoInput = z.input<typeof reorderTodoSchema>;
export type AttachTodoEvidenceInput = z.input<typeof attachTodoEvidenceSchema>;
