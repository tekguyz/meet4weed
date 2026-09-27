/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createDemoLimits, demoLimitKeys, hourOf, type Counter } from "@/lib/demo/limits";

function memoryCounter(): Counter & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async incr(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async expire() {},
  };
}

const NOW = new Date("2026-09-27T14:30:00Z");

describe("the demo door's limits", () => {
  it("lets an IP in five times an hour and not a sixth", async () => {
    const limits = createDemoLimits(memoryCounter());
    for (let i = 0; i < 5; i++) expect((await limits.claimVisitor("1.2.3.4", NOW)).ipAllowed).toBe(true);
    expect((await limits.claimVisitor("1.2.3.4", NOW)).ipAllowed).toBe(false);
    expect((await limits.claimVisitor("5.6.7.8", NOW)).ipAllowed).toBe(true);
  });

  it("starts again the next hour", async () => {
    const limits = createDemoLimits(memoryCounter());
    for (let i = 0; i < 6; i++) await limits.claimVisitor("1.2.3.4", NOW);
    const later = new Date("2026-09-27T15:00:00Z");
    expect((await limits.claimVisitor("1.2.3.4", later)).ipAllowed).toBe(true);
  });

  it("closes for everyone after the hour's total", async () => {
    const limits = createDemoLimits(memoryCounter(), { ip: 5, global: 3 });
    for (let i = 0; i < 3; i++) expect((await limits.claimVisitor(`10.0.0.${i}`, NOW)).globalAllowed).toBe(true);
    expect(await limits.claimVisitor("10.0.0.9", NOW)).toEqual({ ipAllowed: true, globalAllowed: false });
  });

  it("does not spend the hour's total on an IP that is already over", async () => {
    const counter = memoryCounter();
    const limits = createDemoLimits(counter);
    for (let i = 0; i < 8; i++) await limits.claimVisitor("1.2.3.4", NOW);
    expect(counter.counts.get(demoLimitKeys.global(hourOf(NOW)))).toBe(5);
  });

  it("says busy when Upstash cannot be reached", async () => {
    const broken: Counter = { incr: async () => { throw new Error("down"); }, expire: async () => {} };
    expect(await createDemoLimits(broken).claimVisitor("1.2.3.4", NOW)).toEqual({ ipAllowed: false, globalAllowed: false });
  });

  it("keeps every key under the shared prefix and never holds the raw IP", () => {
    const key = demoLimitKeys.ip("2026-09-27T14", "1.2.3.4");
    expect(key.startsWith("m4w:")).toBe(true);
    expect(key).not.toContain("1.2.3.4");
    expect(demoLimitKeys.global("2026-09-27T14").startsWith("m4w:")).toBe(true);
  });
});
