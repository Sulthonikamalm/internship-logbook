import "server-only";
import { localDateAt } from "@/features/activity/domain/date";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import type { ExportDataResult } from "@/features/reports/server/get-export-data";
import type { ExportActivityRow } from "@/features/reports/excel/build-logbook-sheet";
import type { DocumentationImage } from "@/features/reports/excel/build-documentation-sheet";
import { getServerEnv } from "@/lib/env/server";
import { processUploadQueue } from "@/features/evidence/domain/upload-queue";
import { missingWorkingDays, saveGenerationSchema, type GenerationGap, type GenerationRequest } from "../domain/schema";
import { AgentError, type AgentActor } from "./auth";
import { readEvidenceThumbnail } from "./photos";

export async function saveGeneration(actor: AgentActor, input: unknown) {
  const parsed = saveGenerationSchema.safeParse(input);
  if (!parsed.success) throw new AgentError(parsed.error.issues[0]?.message ?? "Data laporan tidak valid.");
  const { request, plan } = parsed.data;
  // Replay before deriving new gaps, so a later date/settings change cannot alter a retry.
  const old = await actor.db.from("logbook_generation_runs").select("*").eq("user_id", actor.user.userId).eq("request_id", request.requestId).maybeSingle();
  if (old.error) throw new AgentError("Riwayat laporan belum tersedia. Terapkan migrasi Codex.", 503, "MIGRATION_REQUIRED");
  if (old.data) {
    // PostgreSQL jsonb key order is not insertion order.
    if (!sameJson(old.data.request_payload, request) || !sameJson(old.data.plan_payload.clientPlan, plan))
      throw new AgentError("Kunci permintaan telah digunakan dengan isi berbeda.", 409, "IDEMPOTENCY_KEY_REUSED");
    return old.data;
  }
  const settings = await actor.db.from("internship_settings").select("working_days,start_date,end_date").eq("user_id", actor.user.userId).maybeSingle();
  if (settings.error) throw new AgentError("Pengaturan hari kerja gagal dimuat.", 503);
  const today = localDateAt(new Date(), actor.user.timezone);
  if (plan.entries.some(entry => entry.date > today)) throw new AgentError("Kegiatan mendatang belum dapat disusun dari bukti historis.");
  const gapRequest = { ...request, from: settings.data?.start_date && settings.data.start_date > request.from ? settings.data.start_date : request.from,
    to: settings.data?.end_date && settings.data.end_date < request.to ? settings.data.end_date : request.to };
  const gaps = [...plan.gaps];
  for (const gap of missingWorkingDays(gapRequest, plan.entries.map(entry => entry.date), settings.data?.working_days ?? [1, 2, 3, 4, 5], today))
    if (!gaps.some(item => item.date === gap.date)) gaps.push(gap);
  const result = await actor.db.rpc("save_logbook_generation", { p_request: request, p_plan: { ...plan, gaps, clientPlan: plan } });
  if (result.error) {
    const message = result.error.message;
    if (message.includes("PHOTO_ALREADY_USED")) throw new AgentError("Foto sudah digunakan kegiatan lain. Muat konteks dan pilih bukti lain.", 409, "PHOTO_ALREADY_USED");
    if (message.includes("CONFLICT") || message.includes("IDEMPOTENCY")) throw new AgentError("Kegiatan atau permintaan berubah. Muat ulang sebelum menyimpan.", 409, "CONFLICT");
    console.error(`[agent.save] database code=${result.error.code}`);
    throw new AgentError("Laporan belum tersimpan. Periksa sumber, periode, dan akses bukti.", 422, "SAVE_FAILED");
  }
  return result.data;
}

function sameJson(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === "object"
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  return canonical(a) === canonical(b);
}

export async function getGeneration(actor: AgentActor, id: string) {
  const result = await actor.db.from("logbook_generation_runs").select("*").eq("user_id", actor.user.userId).eq("id", id).maybeSingle();
  if (result.error) throw new AgentError("Riwayat laporan gagal dimuat.", 503);
  if (!result.data) throw new AgentError("Laporan tidak tersedia.", 404, "NOT_FOUND");
  return result.data;
}

export async function exportGeneration(actor: AgentActor, id: string) {
  const run = await getGeneration(actor, id);
  const request = run.request_payload as GenerationRequest;
  const snapshot = run.snapshot as { activities: (ExportActivityRow & { evidences: (NonNullable<ExportActivityRow["evidences"]>[number] & { provenance?: Record<string, unknown> })[] })[]; gaps: GenerationGap[]; summary: string };
  const gaps = [...(snapshot.gaps ?? [])];
  const activities = snapshot.activities.filter(row => {
    const available = row.status !== "DRAFT" && row.status !== "ARCHIVED" && row.evidences.some(e => e.status === "AVAILABLE");
    if (!available) gaps.push({ date: row.activityDate, reason: `${row.title}: belum masuk laporan final. Lengkapi bukti atau status kegiatan di aplikasi.` });
    return available;
  });
  const evidenceDetails = activities.flatMap(row => row.evidences.map(e => ({ evidenceId: e.id, activityId: row.id,
    activityDate: row.activityDate, activityTitle: row.title, type: e.type, title: e.title, status: e.status, url: e.url })));
  const data: ExportDataResult = { user: actor.user, category: request.category, from: request.from, to: request.to, activities, evidenceDetails };
  const images: DocumentationImage[] = [];
  const photoIds = [...new Set(evidenceDetails.filter(e => e.type === "PHOTO").map(e => e.evidenceId))];
  await processUploadQueue(photoIds, async evidenceId => {
    const e = snapshot.activities.flatMap(row => row.evidences).find(e => e.id === evidenceId);
    const p = e?.provenance;
    const provenance = p?.source === "github_reconstruction" ? `Rekonstruksi ${p.kind}\n${p.repository} @ ${p.sha}\n${p.path}\nTanggal commit: ${p.commitDate ?? "tidak tersedia"}\nGambar dibuat: ${p.generatedAt}` : undefined;
    try { images.push({ evidenceId, base64: (await readEvidenceThumbnail(actor, evidenceId)).toString("base64"), provenance }); }
    catch {
      images.push({ evidenceId, message: "Gambar asli tidak dapat dibaca saat ekspor.", provenance });
      gaps.push({ date: evidenceDetails.find(e => e.evidenceId === evidenceId)!.activityDate, reason: `Gambar ${e?.title || evidenceId} tidak dapat dibaca. Periksa evidence di aplikasi.` });
    }
  });
  const buffer = await generateWorkbook(data, { includeEvidence: true, baseUrl: getServerEnv().APP_BASE_URL,
    documentation: images, generation: { period: request.period, summary: snapshot.summary ?? "", gaps } });
  return { buffer, request, gaps, status: gaps.length ? "PARTIAL" : run.status };
}
