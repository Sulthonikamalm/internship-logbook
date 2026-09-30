import { timingSafeEqual } from "node:crypto";
import { reconcileStorageJobs } from "@/features/evidence/server/reconcile-storage";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.EVIDENCE_RECONCILE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const givenBytes = Buffer.from(given);
  const secretBytes = Buffer.from(secret || "");
  if (!secret || secretBytes.length < 32 || givenBytes.length !== secretBytes.length ||
      !timingSafeEqual(givenBytes, secretBytes)) {
    return new Response(null, { status: 404 });
  }
  try {
    const result = await reconcileStorageJobs();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Reconciliation unavailable" }, { status: 503,
      headers: { "Cache-Control": "no-store" } });
  }
}
