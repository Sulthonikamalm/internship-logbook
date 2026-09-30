/**
 * Auth context types used across the application.
 * Single source of truth for authorization data — features MUST use this
 * instead of implementing their own auth parsing.
 */

/**
 * Valid application roles.
 * Matches CHECK constraint on profiles.role column.
 */
export const VALID_ROLES = ["user", "supervisor", "admin"] as const;
export type Role = (typeof VALID_ROLES)[number];

/**
 * Normalized auth context provided to features.
 * Constructed from Supabase session + profiles table.
 */
export type AuthContext = {
  userId: string;
  role: Role;
  timezone: string;
  isActive: boolean;
  displayName: string;
  contentReadAll: boolean;
};

/**
 * Type guard for role validation.
 */
export function isValidRole(value: unknown): value is Role {
  return (
    typeof value === "string" && VALID_ROLES.includes(value as Role)
  );
}

/**
 * Parses a role string with fallback to "user".
 * Never throws — invalid values default safely.
 */
export function parseRole(value: unknown): Role {
  if (isValidRole(value)) return value;
  return "user";
}

/**
 * Validates an IANA timezone string.
 * Returns true for valid timezones, false otherwise.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses a timezone string with fallback to "Asia/Jakarta".
 */
export function parseTimezone(value: unknown): string {
  if (typeof value === "string" && isValidTimezone(value)) return value;
  return "Asia/Jakarta";
}
