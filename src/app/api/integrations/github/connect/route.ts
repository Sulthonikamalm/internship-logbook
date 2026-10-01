import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createGitHubAuthUrl } from "@/features/integrations/github/server/oauth";

export async function GET() {
  try {
    const user = await requireActiveUser();
    const { url } = await createGitHubAuthUrl(user.userId);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "GITHUB_OAUTH_NOT_CONFIGURED") {
      return NextResponse.redirect(
        new URL("/integrations?error=oauth_not_configured", process.env.APP_BASE_URL || "http://localhost:3000")
      );
    }
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(message)}`, process.env.APP_BASE_URL || "http://localhost:3000")
    );
  }
}
