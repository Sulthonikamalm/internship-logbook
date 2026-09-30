import type { LogbookRow } from "./types";

/**
 * Deterministic ordering for Logbook UI:
 * 1. activity_date DESC
 * 2. start_time DESC (NULLS LAST)
 * 3. created_at DESC (tie-breaker)
 */
export function compareLogbookRowsDesc(a: LogbookRow, b: LogbookRow): number {
  // 1. activity_date DESC
  if (a.activityDate !== b.activityDate) {
    return b.activityDate.localeCompare(a.activityDate);
  }

  // 2. start_time DESC NULLS LAST
  if (a.startTime && b.startTime) {
    if (a.startTime !== b.startTime) {
      return b.startTime.localeCompare(a.startTime);
    }
  } else if (a.startTime && !b.startTime) {
    return -1; // a comes first because b is null (nulls last)
  } else if (!a.startTime && b.startTime) {
    return 1; // b comes first because a is null
  }

  // 3. created_at DESC tie-breaker
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Chronological ordering for export / sequential reports:
 * 1. activity_date ASC
 * 2. start_time ASC (NULLS FIRST)
 * 3. created_at ASC
 */
export function compareLogbookRowsAsc(a: LogbookRow, b: LogbookRow): number {
  if (a.activityDate !== b.activityDate) {
    return a.activityDate.localeCompare(b.activityDate);
  }

  if (a.startTime && b.startTime) {
    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
  } else if (a.startTime && !b.startTime) {
    return 1; // null comes first in chronological
  } else if (!a.startTime && b.startTime) {
    return -1;
  }

  return a.createdAt.localeCompare(b.createdAt);
}
