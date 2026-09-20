/** Calendar days as `YYYY-MM-DD` strings. Florida is the only market, and a
 *  card is valid through the whole of its expiry date in Florida. */

const FLORIDA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function floridaToday(now: Date = new Date()): string {
  return FLORIDA.format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const FLORIDA_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** How far Florida is behind UTC at a given instant, in milliseconds.
 *  4 hours on daylight time, 5 on standard time. */
function floridaOffsetMs(at: Date): number {
  const parts = FLORIDA_PARTS.formatToParts(at);
  const value = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return at.getTime() - asIfUtc;
}

/** Turns a `datetime-local` value — "2026-09-25T20:00", wall-clock with no
 *  zone — into the instant it means. Florida is the only market, so it always
 *  means America/New_York, and the offset flips with daylight saving.
 *
 *  Returns null when the string is not a wall-clock value, so a caller can
 *  report a field error rather than store an Invalid Date. */
export function floridaWallClockToInstant(local: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);

  // Read the wall clock as if it were UTC, then shift by the offset in force
  // at roughly that moment. Inside the hour daylight saving skips or repeats,
  // either answer is defensible; everywhere else this is exact.
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const instant = new Date(naive + floridaOffsetMs(new Date(naive)));
  return Number.isNaN(instant.getTime()) ? null : instant;
}
