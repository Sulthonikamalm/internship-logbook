/**
 * Maximum character limit for a single Excel cell (Excel hard limit is 32,767).
 * We conservatively cap at 30,000 characters to prevent buffer issues.
 */
export const MAX_CELL_CHAR_LENGTH = 30000;

/**
 * Characters that trigger formula execution in spreadsheet software
 * when appearing as the first non-whitespace character.
 */
const FORMULA_TRIGGER_REGEX = /^\s*[=+\-@\t\r]/;

/**
 * Sanitizes user-controlled text before writing to an Excel cell.
 * Prevents formula injection (CSV/Excel Formula Injection / CWE-1236)
 * by prepending a single quote (') if the text begins with dangerous characters.
 * Also enforces the maximum cell length limit.
 */
export function sanitizeCellText(val: string | null | undefined): string {
  if (val === null || val === undefined) {
    return "";
  }

  let text = String(val);

  // Enforce cell character length limit safely
  if (text.length > MAX_CELL_CHAR_LENGTH) {
    text = text.slice(0, MAX_CELL_CHAR_LENGTH) + " [dipotong]";
  }

  // Formula injection defense: prepend single quote to escape executable formulas
  if (FORMULA_TRIGGER_REGEX.test(text)) {
    return `'${text}`;
  }

  return text;
}

/**
 * Validates whether a URL has a safe protocol (http: or https:)
 * and can be safely rendered as a clickable hyperlink in Excel.
 * Blocks dangerous schemes such as javascript:, data:, file:, vbscript:.
 */
export function isValidHyperlink(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
