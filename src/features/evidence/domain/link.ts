export function validateEvidenceUrl(value: string): string {
  const raw = value.trim();
  if (raw.length > 2048) throw new Error("Tautan terlalu panjang.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Tautan tidak valid."); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname ||
      url.username || url.password) throw new Error("Gunakan tautan http atau https tanpa kredensial.");
  return url.toString();
}
