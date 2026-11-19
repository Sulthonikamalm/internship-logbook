/** EXIF commonly has no offset. Interpret that wall clock in the owner's zone. */
export function parseCaptureTime(value: unknown, offset: unknown, timeZone: string): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, h, min, sec] = match;
  if (!isRealDate(`${y}-${m}-${d}`) || Number(h) > 23 || Number(min) > 59 || Number(sec) > 59) return null;
  const wall = `${y}-${m}-${d}T${h}:${min}:${sec}`;
  if (typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset)) {
    const date = new Date(wall + offset);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const target = Date.parse(wall + "Z");
  if (!Number.isFinite(target)) return null;
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const fields = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(instant)).map(part => [part.type, Number(part.value)]));
    const represented = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
    instant = target - (represented - instant);
  }
  return new Date(instant).toISOString();
}
import { isRealDate } from "@/features/activity/domain/date";
