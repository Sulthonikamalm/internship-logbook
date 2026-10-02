import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getServerEnv } from "@/lib/env/server";
import { verifyAndClearOAuthState, exchangeGitHubCode, fetchGitHubUser, saveGitHubConnectionAndToken } from "@/features/integrations/github/server/oauth";

export async function GET(request: NextRequest) {
  const user = await requireActiveUser();
  const env = getServerEnv();
  const fail = (code: string) => NextResponse.redirect(new URL(`/integrations?error=${code}`, env.APP_BASE_URL));
  const verification = await verifyAndClearOAuthState(request.nextUrl.searchParams.get("state") ?? "", user.userId);
  if (!verification.valid || !verification.verifier) return fail(verification.reason ?? "state_mismatch");
  if (request.nextUrl.searchParams.has("error")) return fail("authorization_cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 512) return fail("missing_code");
  try {
    const token = await exchangeGitHubCode(code, env.GITHUB_CALLBACK_URL || `${env.APP_BASE_URL}/api/integrations/github/callback`, verification.verifier);
    const identity = await fetchGitHubUser(token.accessToken);
    await saveGitHubConnectionAndToken({ userId: user.userId, githubUserId: identity.id, githubUsername: identity.login, scopes: token.scopes, accessToken: token.accessToken, tokenType: token.tokenType, allowReplace: verification.allowReplace });
    // Sync is explicit; connection success must not imply that commits were fetched.
    return NextResponse.redirect(new URL("/integrations?success=connected", env.APP_BASE_URL));
  } catch (error) {
    return fail(error instanceof Error && error.message === "ACCOUNT_CHANGE_REQUIRED" ? "account_change_required" : "callback_failed");
  }
}
