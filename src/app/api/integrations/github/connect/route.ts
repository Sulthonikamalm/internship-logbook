import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createGitHubAuthUrl } from "@/features/integrations/github/server/oauth";
import { getServerEnv } from "@/lib/env/server";

export async function GET(request: NextRequest) {
  const appUrl = new URL(getServerEnv().APP_BASE_URL);
  const requestHost = request.headers.get("host") ?? new URL(request.url).host;
  if (requestHost !== appUrl.host || request.nextUrl.protocol !== appUrl.protocol) {
    const canonical = new URL("/api/integrations/github/connect", appUrl);
    for (const key of ["private", "replace"]) {
      if (request.nextUrl.searchParams.get(key) === "1") canonical.searchParams.set(key, "1");
    }
    return NextResponse.redirect(canonical);
  }
  const user = await requireActiveUser();
  try {
    const { url } = await createGitHubAuthUrl(user.userId, { privateRepos: request.nextUrl.searchParams.get("private") === "1", allowReplace: request.nextUrl.searchParams.get("replace") === "1" });
    return NextResponse.redirect(url);
  } catch (error) {
    const code = error instanceof Error && error.message === "GITHUB_OAUTH_NOT_CONFIGURED" ? "oauth_not_configured" : error instanceof Error && error.message === "GITHUB_ENCRYPTION_NOT_CONFIGURED" ? "encryption_not_configured" : error instanceof Error && error.message === "GITHUB_CALLBACK_NOT_CONFIGURED" ? "callback_not_configured" : "connect_failed";
    return NextResponse.redirect(new URL(`/integrations?error=${code}`, getServerEnv().APP_BASE_URL));
  }
}
