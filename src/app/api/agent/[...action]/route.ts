import { readJsonBody, JsonBodyError } from "@/lib/http/read-json";
import { streamBytes } from "@/lib/http/stream-bytes";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticateAgent, AgentError } from "@/features/agent/server/auth";
import { getGenerationContext } from "@/features/agent/server/context";
import { exportGeneration, getGeneration, saveGeneration } from "@/features/agent/server/generations";
import { readEvidenceThumbnail } from "@/features/agent/server/photos";
import { readCommitDetail } from "@/features/agent/server/github";
import { generationRequestSchema, repositorySchema } from "@/features/agent/domain/schema";
import { startPhotoUpload } from "@/features/evidence/server/photo-start";
import { finalizePhotoUpload } from "@/features/evidence/server/photo-finalize";
import { buildExportFilename } from "@/features/reports/excel/sanitize-filename";
import { syncGitHubCommits } from "@/features/integrations/github/server/sync-commits";

export const runtime = "nodejs";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ action: string[] }> };
function failure(error: unknown) {
  if (error instanceof JsonBodyError) return Response.json({ ok: false, code: "INVALID_BODY", message: error.message }, { status: error.status, headers });
  if (error instanceof z.ZodError) return Response.json({ ok: false, code: "VALIDATION_ERROR", message: error.issues[0]?.message }, { status: 400, headers });
  if (error instanceof AgentError) return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status, headers });
  console.error("[agent] request failed");
  return Response.json({ ok: false, code: "UNAVAILABLE", message: "Layanan belum tersedia. Periksa koneksi dan konfigurasi aplikasi." }, { status: 503, headers });
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await authenticateAgent(request);
    const action = (await context.params).action.join("/");
    if (action === "photos/start") return startPhotoUpload(request, actor.user, actor.db);
    if (action === "photos/finalize") return finalizePhotoUpload(request, actor.user, actor.db);
    const body = await readJsonBody(request, 2_000_000);
    if (action === "context") {
      const input = z.object({ request: generationRequestSchema, page: z.number().int().min(1).max(1000).default(1) }).strict().parse(body);
      return Response.json(await getGenerationContext(actor, input.request, input.page), { headers });
    }
    if (action === "commits/sync") {
      const input = z.object({ repository: repositorySchema }).strict().parse(body);
      return Response.json(await syncGitHubCommits(input.repository, actor.user), { headers });
    }
    if (action === "save") {
      const run = await saveGeneration(actor, body);
      for (const path of ["/reports", "/activities", "/calendar", "/logbook", "/evidence"]) revalidatePath(path);
      return Response.json({ ok: true, run: { id: run.id, status: run.status,
        activityIds: run.snapshot.activities.map((item: { id: string }) => item.id), gaps: run.snapshot.gaps,
        createdAt: run.created_at } }, { headers });
    }
    throw new AgentError("Alat tidak ditemukan.", 404, "NOT_FOUND");
  } catch (error) { return failure(error); }
}
export async function GET(request: Request, context: Context) {
  try {
    const actor = await authenticateAgent(request);
    const action = (await context.params).action;
    if (action.length === 1 && action[0] === "identity") return Response.json({ user: { userId: actor.user.userId, displayName: actor.user.displayName, timezone: actor.user.timezone } }, { headers });
    if (action[0] === "photos" && action.length === 2) {
      const bytes = await readEvidenceThumbnail(actor, z.uuid().parse(action[1]));
      const photo = await actor.db.from("evidences").select("captured_at").eq("id", action[1]).eq("user_id", actor.user.userId).maybeSingle();
      return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "X-InternFlow-Captured-At": photo.data?.captured_at ?? "unknown" } });
    }
    if (action[0] === "commits" && action.length === 2) {
      const params = new URL(request.url).searchParams;
      return Response.json(await readCommitDetail(actor, z.uuid().parse(action[1]), repositorySchema.parse(params.get("repository")),
        z.coerce.number().int().min(1).max(100).parse(params.get("page") ?? 1)), { headers });
    }
    if (action[0] === "runs" && action.length === 1) {
      const result = await actor.db.from("logbook_generation_runs").select("id,status,request_payload,created_at").eq("user_id", actor.user.userId).order("created_at", { ascending: false }).limit(30);
      if (result.error) throw new AgentError("Riwayat gagal dimuat.", 503);
      return Response.json({ runs: result.data }, { headers });
    }
    if (action[0] === "runs" && action.length === 2) return new Response(streamBytes(Buffer.from(JSON.stringify(await getGeneration(actor, z.uuid().parse(action[1]))))), { headers: { ...headers, "Content-Type": "application/json" } });
    if (action[0] === "runs" && action[2] === "export" && action.length === 3) {
      const result = await exportGeneration(actor, z.uuid().parse(action[1]));
      return new Response(streamBytes(result.buffer), { headers: { ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildExportFilename(actor.user.displayName, result.request.from, result.request.to)}"`,
        "X-InternFlow-Status": result.status, "X-InternFlow-Gaps": String(result.gaps.length) } });
    }
    throw new AgentError("Alat tidak ditemukan.", 404, "NOT_FOUND");
  } catch (error) { return failure(error); }
}
