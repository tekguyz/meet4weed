/** @vitest-environment node
 *
 *  Plan 04, ticket #30 — redemption is rate-limited per IP.
 *
 *  Runs in CI: the counter is a Map, so no Upstash and no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  REDEEM_IP_DAILY_LIMIT,
  createInviteLimits,
  inviteLimitKey,
  type Counter,
} from "@/lib/sesh/invite-limits";

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

const DAY = "2026-09-21";
const IP = "203.0.113.7";

describe("redemption limits", () => {
  it("allows thirty presses from one IP in a day and refuses the thirty-first", async () => {
    const limits = createInviteLimits(memoryCounter().counter);
    for (let i = 0; i < REDEEM_IP_DAILY_LIMIT; i += 1) {
      expect(await limits.claimRedemption(IP, DAY)).toBe(true);
    }
    expect(await limits.claimRedemption(IP, DAY)).toBe(false);
  });

  it("is thirty", () => {
    expect(REDEEM_IP_DAILY_LIMIT).toBe(30);
  });

  it("starts a new allowance on a new day", async () => {
    const limits = createInviteLimits(memoryCounter().counter, 2);
    await limits.claimRedemption(IP, DAY);
    await limits.claimRedemption(IP, DAY);
    expect(await limits.claimRedemption(IP, DAY)).toBe(false);
    expect(await limits.claimRedemption(IP, "2026-09-22")).toBe(true);
  });

  it("counts each IP on its own", async () => {
    const limits = createInviteLimits(memoryCounter().counter, 1);
    expect(await limits.claimRedemption(IP, DAY)).toBe(true);
    expect(await limits.claimRedemption("198.51.100.4", DAY)).toBe(true);
    expect(await limits.claimRedemption(IP, DAY)).toBe(false);
  });

  it("sets a two-day expiry, once, on the first press only", async () => {
    const { counter, expiries } = memoryCounter();
    const limits = createInviteLimits(counter);
    await limits.claimRedemption(IP, DAY);
    expect(expiries.get(inviteLimitKey(DAY, IP))).toBe(172_800);

    expiries.clear();
    await limits.claimRedemption(IP, DAY);
    expect(expiries.size).toBe(0);
  });
});

describe("the key", () => {
  /** The Redis database is shared with the TEKGUYZ Website. Every key this
   *  app writes starts `m4w:`. */
  it("is prefixed m4w:", () => {
    expect(inviteLimitKey(DAY, IP).startsWith("m4w:")).toBe(true);
  });

  /** The key has to be stable, not readable, and it lands in somebody else's
   *  database. */
  it("does not contain the IP", () => {
    expect(inviteLimitKey(DAY, IP)).not.toContain(IP);
    expect(inviteLimitKey(DAY, IP)).not.toContain("203");
  });

  it("is the same key for the same IP on the same day", () => {
    expect(inviteLimitKey(DAY, IP)).toBe(inviteLimitKey(DAY, IP));
    expect(inviteLimitKey(DAY, IP)).not.toBe(inviteLimitKey(DAY, "198.51.100.4"));
  });
});

describe("an Upstash outage", () => {
  /** FAIL-OPEN, on purpose. A 22-byte random token with a signature tag is
   *  not sweepable, so the limiter makes a script boring rather than being
   *  the wall. An outage must not stop real people using real links. */
  it("lets the press through", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const limits = createInviteLimits(brokenCounter);

    expect(await limits.claimRedemption(IP, DAY)).toBe(true);

    spy.mockRestore();
  });

  it("logs the error name and never a value that could carry a token", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await createInviteLimits(brokenCounter).claimRedemption(IP, DAY);

    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("Error");
    expect(line).not.toContain("upstash unreachable");
    expect(line).not.toContain(IP);

    spy.mockRestore();
  });
});
