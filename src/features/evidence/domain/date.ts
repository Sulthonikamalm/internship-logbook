import { isRealDate } from "@/features/activity/domain/date";

function offsetAt(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMillis));
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day,
    values.hour, values.minute, values.second) - Math.floor(utcMillis / 1000) * 1000;
}

function localMidnightUtc(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  for (let index = 0; index < 3; index++) {
    const next = target - offsetAt(instant, timeZone);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}

export function utcRangeForLocalDay(date: string, timeZone: string) {
  if (!isRealDate(date)) throw new Error("Tanggal tidak valid.");
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { start: localMidnightUtc(date, timeZone), end: localMidnightUtc(next, timeZone) };
}
