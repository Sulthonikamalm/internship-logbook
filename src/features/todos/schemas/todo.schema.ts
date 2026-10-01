import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";

export const createTodoSchema = z.object({
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
  stageId: z.string().min(1).optional(),
});

export const updateTodoSchema = z.object({
  id: z.string().min(1, "ID Todo wajib diisi."),
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
  todoId: z.string().min(1, "ID Todo wajib diisi."),
  targetStageId: z.string().min(1, "ID Stage tujuan wajib diisi."),
  expectedVersion: z.number().int().min(1, "Versi Todo tidak valid."),
  idempotencyKey: z.string().min(1, "Idempotency key wajib disertakan."),
  note: z
    .string()
    .max(1000, "Catatan transisi maksimal 1000 karakter.")
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),
});

export const reorderTodoSchema = z.object({
  todoId: z.string().min(1, "ID Todo wajib diisi."),
  stageId: z.string().min(1, "ID Stage wajib diisi."),
  newSortOrder: z.number(),
  expectedVersion: z.number().int().min(1),
});

export const attachTodoEvidenceSchema = z.object({
  todoId: z.string().min(1, "ID Todo wajib diisi."),
  evidenceId: z.string().min(1, "ID Evidence wajib diisi."),
  stageId: z.string().min(1).optional().nullable(),
});

export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type TransitionTodoInput = z.input<typeof transitionTodoSchema>;
export type ReorderTodoInput = z.input<typeof reorderTodoSchema>;
export type AttachTodoEvidenceInput = z.input<typeof attachTodoEvidenceSchema>;
