import { describe, expect, it } from "vitest";
import { addDays, daysBetween, floridaToday, floridaWallClockToInstant } from "@/lib/dates";

describe("floridaToday", () => {
  it("is still yesterday in Florida late in the UTC evening (daylight time)", () => {
    expect(floridaToday(new Date("2026-09-17T03:30:00Z"))).toBe("2026-09-16");
  });

  it("follows standard time in winter", () => {
    expect(floridaToday(new Date("2026-01-15T04:59:00Z"))).toBe("2026-01-14");
    expect(floridaToday(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
  });
});

describe("addDays and daysBetween", () => {
  it("cross a month end", () => {
    expect(addDays("2026-09-28", 5)).toBe("2026-10-03");
    expect(daysBetween("2026-09-28", "2026-10-03")).toBe(5);
    expect(daysBetween("2026-10-03", "2026-09-28")).toBe(-5);
  });
});

describe("floridaWallClockToInstant", () => {
  /** Expected values are worked out from the UTC offset Florida is actually
   *  on that date — EDT is UTC−4, EST is UTC−5 — not by running the function. */
  it("reads a summer evening as eastern daylight time", () => {
    expect(floridaWallClockToInstant("2026-09-25T20:00")?.toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  it("reads a winter evening as eastern standard time", () => {
    expect(floridaWallClockToInstant("2026-01-15T20:00")?.toISOString()).toBe("2026-01-16T01:00:00.000Z");
  });

  it("refuses something that is not a wall-clock value", () => {
    expect(floridaWallClockToInstant("next tuesday")).toBeNull();
    expect(floridaWallClockToInstant("2026-09-25")).toBeNull();
  });
});
