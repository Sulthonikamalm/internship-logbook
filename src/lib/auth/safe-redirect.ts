/**
 * Safe redirect URL parser.
 * Prevents open redirect attacks by allowing only same-origin relative paths.
 *
 * Allows:
 *   /dashboard
 *   /activities/123
 *
 * Rejects:
 *   https://evil.com
 *   //evil.com
 *   javascript:alert(1)
 *   data:...
 *   malformed paths
 *
 * Fallback: /dashboard
 */

const FALLBACK = "/dashboard";

/**
 * Validates and sanitizes a redirect path.
 * Returns the sanitized path if valid, FALLBACK otherwise.
 */
export function safeRedirect(to: unknown): string {
  // Must be a non-empty string
  if (typeof to !== "string" || to.trim().length === 0) {
    return FALLBACK;
  }

  const trimmed = to.trim();

  // Must start with exactly one /
  if (!trimmed.startsWith("/")) {
    return FALLBACK;
  }

  // Reject protocol-relative URLs (//evil.com)
  if (trimmed.startsWith("//")) {
    return FALLBACK;
  }

  // Reject dangerous schemes that could be encoded
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return FALLBACK;
  }

  // Reject backslash variants (some browsers normalize \ to /)
  if (trimmed.includes("\\")) {
    return FALLBACK;
  }

  // Reject URLs with protocol in unexpected position (e.g., /\evil.com)
  // Reject encoded characters that could bypass checks
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      decoded.toLowerCase().startsWith("javascript:") ||
      decoded.toLowerCase().startsWith("data:")
    ) {
      return FALLBACK;
    }
  } catch {
    // decodeURIComponent failed — malformed URI
    return FALLBACK;
  }

  // Reject if it contains a host component (URL constructor check)
  try {
    const url = new URL(trimmed, "http://localhost");
    if (url.host !== "localhost") {
      return FALLBACK;
    }
  } catch {
    return FALLBACK;
  }

  return trimmed;
}

/** Keeps authentication redirects on this origin and out of a login loop. */
export function safeLoginRedirect(to: unknown): string {
  const destination = safeRedirect(to);
  const pathname = decodeURIComponent(new URL(destination, "http://localhost").pathname);
  return pathname === "/login" || pathname.startsWith("/login/")
    ? FALLBACK
    : destination;
}
