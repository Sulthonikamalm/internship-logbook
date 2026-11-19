import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { exportGeneration } from "@/features/agent/server/generations";
import { AgentError } from "@/features/agent/server/auth";
import { buildExportFilename } from "@/features/reports/excel/sanitize-filename";
import { streamBytes } from "@/lib/http/stream-bytes";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getCurrentUser();
    if (!user?.isActive) return Response.json({ message: "Masuk dengan akun aktif untuk mengunduh laporan." }, { status: 401, headers });
    const id = z.uuid().parse((await context.params).id);
    const result = await exportGeneration({ user, db: await createClient() }, id);
    return new Response(streamBytes(result.buffer), { headers: { ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename(user.displayName, result.request.from, result.request.to)}"`,
    } });
  } catch (error) {
    return Response.json({ message: error instanceof AgentError ? error.message : "Laporan belum dapat diunduh." }, { status: error instanceof AgentError ? error.status : 503, headers });
  }
}
