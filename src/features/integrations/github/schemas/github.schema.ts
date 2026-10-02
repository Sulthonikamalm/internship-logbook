import { z } from "zod";

export const attachCommitSchema = z.object({
  commitId: z.uuid(),
  activityId: z.string().uuid().optional(),
  todoId: z.string().uuid().optional(),
  title: z.string().max(160).optional(),
  note: z.string().max(10000).optional(),
}).strict();

export type AttachCommitInput = z.infer<typeof attachCommitSchema>;

export const commitFilterSchema = z.object({
  repository: z.string().max(200).optional(),
  search: z.string().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CommitFilterInput = z.infer<typeof commitFilterSchema>;
