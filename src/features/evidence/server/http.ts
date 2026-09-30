import { getCurrentUser } from "@/lib/auth/get-current-user";

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function jsonError(message: string, status: number, code = "ERROR"): Response {
  return Response.json({ ok: false, code, message }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export async function activeApiUser() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}
