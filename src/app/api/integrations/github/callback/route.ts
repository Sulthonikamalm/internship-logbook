import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getServerEnv } from "@/lib/env/server";
import {
  verifyAndClearOAuthState,
  exchangeGitHubCode,
  fetchGitHubUser,
  saveGitHubConnectionAndToken,
} from "@/features/integrations/github/server/oauth";
import { syncGitHubCommits } from "@/features/integrations/github/server/sync-commits";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;

  // 1. Handle error returned by GitHub OAuth
  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent(errorDescription || oauthError)}`,
        baseUrl
      )
    );
  }

  // 2. Validate user authentication
  let user;
  try {
    user = await requireActiveUser();
  } catch {
    return NextResponse.redirect(new URL("/login?next=/integrations", baseUrl));
  }

  // 3. Verify state and check one-time token binding
  if (!state) {
    return NextResponse.redirect(new URL("/integrations?error=missing_state", baseUrl));
  }

  const stateVerification = await verifyAndClearOAuthState(state, user.userId);
  if (!stateVerification.valid) {
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent(stateVerification.reason || "state_mismatch")}`,
        baseUrl
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/integrations?error=missing_code", baseUrl));
  }

  try {
    const env = getServerEnv();
    const callbackUrl =
      env.GITHUB_CALLBACK_URL || `${baseUrl}/api/integrations/github/callback`;

    // 4. Exchange code for access token (server-to-server)
    const tokenData = await exchangeGitHubCode(code, callbackUrl);

    // 5. Fetch GitHub user identity
    const githubUser = await fetchGitHubUser(tokenData.accessToken);

    // 6. Save connection metadata and securely store token in github_tokens table
    await saveGitHubConnectionAndToken({
      userId: user.userId,
      githubUserId: githubUser.id,
      githubUsername: githubUser.login,
      scopes: tokenData.scopes,
      accessToken: tokenData.accessToken,
      tokenType: tokenData.tokenType,
    });

    // 7. Perform initial commit sync in the background
    try {
      await syncGitHubCommits();
    } catch (syncErr) {
      console.warn("Initial sync after connection had a non-fatal issue:", syncErr);
    }

    return NextResponse.redirect(new URL("/integrations?success=connected", baseUrl));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "callback_failed";
    console.error("GitHub callback error:", errMsg);
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(errMsg)}`, baseUrl)
    );
  }
}
