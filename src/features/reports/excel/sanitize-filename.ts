/**
 * Sanitizes an arbitrary string (like a user's display name) to be safe for inclusion
 * in an HTTP Content-Disposition header and filesystem filename.
 * Strips path traversal sequences, control characters, and reserved filesystem characters.
 */
export function sanitizeFilenamePart(part: string | null | undefined, fallback = "User"): string {
  if (!part || typeof part !== "string") {
    return fallback;
  }

  // Remove control characters (0x00-0x1F, 0x7F) and illegal filename characters: / \ : * ? " < > |
  let clean = part
    .replace(/[\x00-\x1F\x7F/\\:*?"<>|]/g, "")
    // Remove dangerous path traversal sequences
    .replace(/\.{2,}/g, "")
    // Normalize consecutive whitespace to a single underscore
    .trim()
    .replace(/\s+/g, "_");

  // Keep alphanumeric, dash, and underscore characters
  clean = clean.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, "");

  // Cap length to 50 characters
  if (clean.length > 50) {
    clean = clean.slice(0, 50).trim();
  }

  return clean || fallback;
}

/**
 * Builds the canonical Excel export filename:
 * InternFlow_Logbook_<display_name>_<from>_<to>.xlsx
 */
export function buildExportFilename(
  displayName: string | null | undefined,
  from: string,
  to: string
): string {
  const safeName = sanitizeFilenamePart(displayName, "User");
  const safeFrom = from.replace(/[^0-9-]/g, "");
  const safeTo = to.replace(/[^0-9-]/g, "");

  return `InternFlow_Logbook_${safeName}_${safeFrom}_${safeTo}.xlsx`;
}
