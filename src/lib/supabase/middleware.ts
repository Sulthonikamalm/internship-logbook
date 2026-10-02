import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/lib/env/client";
import { safeLoginRedirect } from "@/lib/auth/safe-redirect";

/**
 * Protected route prefixes that require authentication.
 * Requests to these paths will redirect to /login if no session.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/activities", "/todos", "/evidence", "/logbook", "/reports", "/integrations", "/settings", "/profile", "/admin"];

/**
 * Auth routes that authenticated users should be redirected away from.
 */
const AUTH_ROUTES = ["/login"];

/**
 * Updates the user session across requests in Next.js middleware.
 * Also handles:
 * - Protected route redirect for unauthenticated users
 * - Auth route redirect for already-authenticated users
 *
 * Returns a NextResponse directly.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const env = getClientEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          for (const [name, value] of Object.entries(headersToSet ?? {})) {
            supabaseResponse.headers.set(name, value);
          }
        },
      },
    }
  );

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  // Refreshes auth token and validates the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  function redirectWithSession(url: URL) {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    return response;
  }

  // Protected route: redirect unauthenticated users to login
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Preserve intended destination for post-login redirect
    if (pathname !== "/dashboard") {
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    return redirectWithSession(loginUrl);
  }

  // Cookie updates can render the login route again during a Server Action.
  // Honor its destination instead of overriding the pending navigation to Home.
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAuthRoute && user) {
    const destination = safeLoginRedirect(request.nextUrl.searchParams.get("next"));
    return redirectWithSession(new URL(destination, request.nextUrl.origin));
  }

  return supabaseResponse;
}
