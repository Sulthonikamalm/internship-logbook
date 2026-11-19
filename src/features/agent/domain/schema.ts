import { z } from "zod";
import { isRealDate } from "@/features/activity/domain/date";
import { workCategorySchema } from "@/features/work/domain/category";

const date = z.string().refine(isRealDate, "Tanggal tidak valid.");
export const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).transform(value => value.toLowerCase());
export const generationRequestSchema = z.object({
  requestId: z.uuid(), period: z.enum(["daily", "weekly", "monthly", "custom"]),
  from: date, to: date, category: workCategorySchema.default("INTERNSHIP"),
  repositories: z.array(repositorySchema).min(1).max(10).transform(values => [...new Set(values)].sort()),
}).strict().superRefine((value, ctx) => {
  const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
  if (days < 0 || days > 366) ctx.addIssue({ code: "custom", message: "Pilih rentang hingga 367 hari.", path: ["to"] });
  if (value.period === "daily" && value.from !== value.to) ctx.addIssue({ code: "custom", message: "Laporan harian memuat satu tanggal.", path: ["to"] });
});
export const sourceRefSchema = z.object({ kind: z.enum(["activity", "todo", "photo", "commit", "attendance"]), id: z.uuid() }).strict();
export const generationEntrySchema = z.object({
  activityId: z.uuid().optional(), expectedVersion: z.number().int().min(1).optional(),
  date, title: z.string().trim().min(1).max(160), description: z.string().trim().max(10000).default(""),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  evidenceIds: z.array(z.uuid()).max(100).transform(values => [...new Set(values)].sort()),
  sourceRefs: z.array(sourceRefSchema).min(1).max(100).transform(values => [...new Map(values.map(v => [`${v.kind}:${v.id}`, v])).values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))),
}).strict().superRefine((value, ctx) => {
  if (value.activityId && value.expectedVersion === undefined) ctx.addIssue({ code: "custom", message: "Versi Activity wajib disertakan.", path: ["expectedVersion"] });
  if (value.endTime && (!value.startTime || value.endTime < value.startTime)) ctx.addIssue({ code: "custom", message: "Rentang jam kegiatan tidak valid.", path: ["endTime"] });
  if (value.sourceRefs.every(ref => ref.kind === "attendance")) ctx.addIssue({ code: "custom", message: "Absensi saja belum mendukung isi kegiatan.", path: ["sourceRefs"] });
});
export const gapSchema = z.object({ date, reason: z.string().trim().min(1).max(2000) }).strict();
export const generationPlanSchema = z.object({ entries: z.array(generationEntrySchema).max(500),
  gaps: z.array(gapSchema).max(1000).default([]), summary: z.string().max(20000).default("") }).strict();
export const saveGenerationSchema = z.object({ request: generationRequestSchema, plan: generationPlanSchema }).strict()
  .superRefine(({ request, plan }, ctx) => {
    if (new Set(plan.entries.flatMap(entry => entry.evidenceIds)).size > 500)
      ctx.addIssue({ code: "custom", message: "Maksimal 500 bukti unik per laporan. Pilih periode lebih pendek.", path: ["plan", "entries"] });
    for (const entry of plan.entries) if (entry.date < request.from || entry.date > request.to)
      ctx.addIssue({ code: "custom", message: "Kegiatan berada di luar periode.", path: ["plan", "entries"] });
    for (const gap of plan.gaps) if (gap.date < request.from || gap.date > request.to)
      ctx.addIssue({ code: "custom", message: "Kekurangan berada di luar periode.", path: ["plan", "gaps"] });
  });
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationPlan = z.infer<typeof generationPlanSchema>;
export type GenerationGap = z.infer<typeof gapSchema>;

export function missingWorkingDays(request: GenerationRequest, dates: string[], workingDays: number[], today: string): GenerationGap[] {
  const covered = new Set(dates); const gaps: GenerationGap[] = [];
  for (let day = request.from; day <= request.to && day <= today;) {
    const utc = new Date(`${day}T12:00:00Z`);
    if (workingDays.includes(utc.getUTCDay() || 7) && !covered.has(day)) gaps.push({ date: day, reason: "Belum ada kegiatan dengan sumber pendukung untuk hari kerja ini." });
    utc.setUTCDate(utc.getUTCDate() + 1); day = utc.toISOString().slice(0, 10);
  }
  return gaps;
}
