/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createLimits, limitKeys, type Counter } from "@/lib/verification/limits";

function memoryCounter() {
  const counts = new Map<string, number>();
  const expiries = new Map<string, number>();
  const counter: Counter = {
    incr: async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    expire: async (key, seconds) => void expiries.set(key, seconds),
  };
  return { counter, counts, expiries };
}

const brokenCounter: Counter = {
  incr: async () => {
    throw new Error("upstash unreachable");
  },
  expire: async () => undefined,
};

const CONFIG = { memberDaily: 3, ipDaily: 10, visionDaily: 50 };
const DAY = "2026-09-17";

describe("limits", () => {
  it("allows three submissions per member per day and refuses the fourth", async () => {
    const limits = createLimits(memoryCounter().counter, CONFIG);
    for (let i = 0; i < 3; i++) {
      expect(await limits.claimSubmission("member-a", "1.1.1.1", DAY)).toEqual({ ok: true, limiterAvailable: true });
    }
    expect(await limits.claimSubmission("member-a", "1.1.1.1", DAY)).toEqual({ ok: false, reason: "member_limit" });
  });

  it("starts a new allowance on a new day", async () => {
    const limits = createLimits(memoryCounter().counter, CONFIG);
    for (let i = 0; i < 3; i++) await limits.claimSubmission("member-a", "1.1.1.1", DAY);
    expect((await limits.claimSubmission("member-a", "1.1.1.1", "2026-09-18")).ok).toBe(true);
  });

  it("refuses an IP after its daily allowance, across different members", async () => {
    const limits = createLimits(memoryCounter().counter, { ...CONFIG, ipDaily: 2 });
    expect((await limits.claimSubmission("a", "9.9.9.9", DAY)).ok).toBe(true);
    expect((await limits.claimSubmission("b", "9.9.9.9", DAY)).ok).toBe(true);
    expect(await limits.claimSubmission("c", "9.9.9.9", DAY)).toEqual({ ok: false, reason: "ip_limit" });
  });

  it("allows Claude up to the daily ceiling and not one call more", async () => {
    const limits = createLimits(memoryCounter().counter, { ...CONFIG, visionDaily: 2 });
    expect(await limits.claimVisionCall(DAY)).toBe(true);
    expect(await limits.claimVisionCall(DAY)).toBe(true);
    expect(await limits.claimVisionCall(DAY)).toBe(false);
  });

  it("a ceiling of zero turns Claude off entirely", async () => {
    const limits = createLimits(memoryCounter().counter, { ...CONFIG, visionDaily: 0 });
    expect(await limits.claimVisionCall(DAY)).toBe(false);
  });

  it("fails open for the member and closed for Claude when Upstash is down", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const limits = createLimits(brokenCounter, CONFIG);
    expect(await limits.claimSubmission("a", "1.1.1.1", DAY)).toEqual({ ok: true, limiterAvailable: false });
    expect(await limits.claimVisionCall(DAY)).toBe(false);
    log.mockRestore();
  });

  it("prefixes every key m4w: and expires each counter once, after two days", async () => {
    const { counter, counts, expiries } = memoryCounter();
    const limits = createLimits(counter, CONFIG);
    await limits.claimSubmission("a", "1.1.1.1", DAY);
    await limits.claimSubmission("a", "1.1.1.1", DAY);
    await limits.claimVisionCall(DAY);
    for (const key of counts.keys()) expect(key.startsWith("m4w:")).toBe(true);
    expect([...expiries.values()]).toEqual([172_800, 172_800, 172_800]);
  });

  it("never stores a raw IP address in the shared database", () => {
    expect(limitKeys.ip(DAY, "203.0.113.7")).not.toContain("203.0.113.7");
  });
});
