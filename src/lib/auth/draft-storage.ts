/**
 * Draft preservation contract.
 *
 * Stores non-sensitive form drafts in localStorage scoped to userId+feature.
 * When session expires and user re-authenticates, drafts belonging to the
 * same userId are restored. Drafts from a different user are NEVER shown.
 *
 * Key format: internflow:draft:<userId>:<feature>:<draftId>
 *
 * FORBIDDEN to store:
 * - session tokens
 * - OAuth tokens
 * - service role keys
 * - external refresh tokens
 */

const PREFIX = "internflow:draft";

function buildKey(
  userId: string,
  feature: string,
  draftId: string
): string {
  return `${PREFIX}:${userId}:${feature}:${draftId}`;
}

/**
 * Saves a draft to localStorage, scoped to the current user.
 * Only stores non-sensitive text/form state.
 */
export function saveDraft(
  userId: string,
  feature: string,
  draftId: string,
  data: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;

  try {
    const key = buildKey(userId, feature, draftId);
    const payload = JSON.stringify({
      data,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, payload);
  } catch {
    // localStorage may be full or unavailable — silently fail
  }
}

/**
 * Loads a draft from localStorage.
 * Returns null if no draft exists or if it belongs to a different user.
 */
export function loadDraft(
  userId: string,
  feature: string,
  draftId: string
): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;

  try {
    const key = buildKey(userId, feature, draftId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      data: Record<string, unknown>;
      savedAt: string;
    };
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Removes a specific draft.
 */
export function removeDraft(
  userId: string,
  feature: string,
  draftId: string
): void {
  if (typeof window === "undefined") return;

  try {
    const key = buildKey(userId, feature, draftId);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Clears all drafts for the current user.
 * Used on explicit logout to clean up.
 */
export function clearUserDrafts(userId: string): void {
  if (typeof window === "undefined") return;

  try {
    const userPrefix = `${PREFIX}:${userId}:`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(userPrefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
