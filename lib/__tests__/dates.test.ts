import { describe, expect, it } from "vitest";
import { addDays, daysBetween, floridaToday } from "@/lib/dates";

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
