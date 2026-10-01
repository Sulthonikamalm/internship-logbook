import { z } from "zod";

export const attachCommitSchema = z.object({
  commitId: z.string().optional(),
  repositoryName: z.string().min(1).max(200),
  sha: z.string().min(7).max(40),
  commitUrl: z.string().url().max(2048),
  message: z.string().max(2000).nullable().optional(),
  authorDate: z.string().datetime().nullable().optional(),
  activityId: z.string().uuid().optional(),
  todoId: z.string().uuid().optional(),
  title: z.string().max(160).optional(),
  note: z.string().max(10000).optional(),
});

export type AttachCommitInput = z.infer<typeof attachCommitSchema>;

export const commitFilterSchema = z.object({
  repository: z.string().max(200).optional(),
  search: z.string().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CommitFilterInput = z.infer<typeof commitFilterSchema>;
