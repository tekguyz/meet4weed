import { addDays, floridaToday } from "@/lib/dates";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

/** From this Florida hour on, a sesh today is "Tonight"; before it, "Today". */
const EVENING_HOUR = 17;

export type Soon = "Today" | "Tonight" | "Tomorrow";

export type SeshWhen = {
  /** "Tonight", "Today" or "Tomorrow" when the sesh is that close, else null. */
  soon: Soon | null;
  /** The word beside the date block: `soon`, or the short weekday ("Fri"). */
  label: string;
  /** The date block: "Oct" over "9". */
  month: string;
  day: string;
  /** "8:00 PM", Florida time. */
  time: string;
  /** What a screen reader hears: "Tonight, Saturday, October 3 at 7:30 PM". */
  sentence: string;
  /** For `<time dateTime>`. */
  iso: string;
};

/**
 * When a sesh happens, as the card and the sesh page show it (#125). Florida
 * is the only market, so every part is Florida time — the device clock never
 * moves a sesh to another day.
 */
export function seshWhen(startsAt: Date, now: Date): SeshWhen {
  const parts = PARTS.formatToParts(startsAt);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;

  const weekday = part("weekday");
  const month = part("month");
  const day = part("day");
  const time = `${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
  const hour24 = (Number(part("hour")) % 12) + (part("dayPeriod") === "PM" ? 12 : 0);

  const today = floridaToday(now);
  const date = floridaToday(startsAt);
  const soon: Soon | null =
    date === today ? (hour24 >= EVENING_HOUR ? "Tonight" : "Today") : date === addDays(today, 1) ? "Tomorrow" : null;

  const full = `${weekday}, ${month} ${day} at ${time}`;
  return {
    soon,
    label: soon ?? weekday.slice(0, 3),
    month: month.slice(0, 3),
    day,
    time,
    sentence: soon ? `${soon}, ${full}` : full,
    iso: startsAt.toISOString(),
  };
}
