import { getClientEnv } from "@/lib/env/client";
import { validatePublicConfig } from "../../../../../scripts/logbook/public-config.mjs";

/** Same public auth settings as the browser; never include server credentials. */
export async function GET(request: Request) {
  const env = getClientEnv();
  const incoming = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ? "https:" : incoming.protocol;
  // Next's internal request URL may use localhost or a deployment hostname.
  // Bind setup to the public host requested by this client instead.
  const appUrl = new URL(`${protocol}//${request.headers.get("host") || incoming.host}`).origin;
  const config = validatePublicConfig({ version: 1, appUrl,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  return Response.json(config, { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
