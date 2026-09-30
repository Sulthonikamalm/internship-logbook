export function localDateAt(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function maxActivityDate(today: string, futureDays = 7): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + futureDays);
  return date.toISOString().slice(0, 10);
}

export function resolveActivityDate(
  value: string | undefined,
  timeZone: string,
  now = new Date(),
): string {
  const today = localDateAt(now, timeZone);
  const date = value || today;
  if (!isRealDate(date)) throw new Error("Tanggal aktivitas tidak valid.");
  if (date > maxActivityDate(today)) {
    throw new Error("Tanggal aktivitas maksimal 7 hari ke depan.");
  }
  return date;
}
