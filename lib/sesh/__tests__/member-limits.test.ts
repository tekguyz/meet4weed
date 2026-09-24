/** @vitest-environment node
 *
 *  Plan 04b, ticket #66 — asking to join and posting a sesh are rate-limited
 *  per member per day.
 *
 *  Runs in CI: the counter is a Map, so no Upstash and no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  RSVP_MEMBER_DAILY_LIMIT,
  SESH_CREATE_MEMBER_DAILY_LIMIT,
  createMemberLimits,
  memberLimitKeys,
  type Counter,
} from "@/lib/sesh/member-limits";

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

const DAY = "2026-09-23";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";

describe("the starting values", () => {
  /** Above the database's own cap of 20 new requests a day, on purpose: that
   *  cap counts rows, so withdrawing and asking again on one sesh never
   *  trips it. This one counts presses. */
  it("is 30 requests to join a day", () => {
    expect(RSVP_MEMBER_DAILY_LIMIT).toBe(30);
  });

  it("is 10 seshes posted a day", () => {
    expect(SESH_CREATE_MEMBER_DAILY_LIMIT).toBe(10);
  });
});

describe("asking to join", () => {
  it("allows the daily number and refuses the one after", async () => {
    const limits = createMemberLimits(memoryCounter().counter);
    for (let i = 0; i < RSVP_MEMBER_DAILY_LIMIT; i += 1) {
      expect(await limits.claimRsvp(MEMBER, DAY)).toBe(true);
    }
    expect(await limits.claimRsvp(MEMBER, DAY)).toBe(false);
  });

  it("starts a new allowance on a new day", async () => {
    const limits = createMemberLimits(memoryCounter().counter, { rsvpDaily: 1, seshCreateDaily: 1 });
    await limits.claimRsvp(MEMBER, DAY);
    expect(await limits.claimRsvp(MEMBER, DAY)).toBe(false);
    expect(await limits.claimRsvp(MEMBER, "2026-09-24")).toBe(true);
  });

  it("counts each member on their own", async () => {
    const limits = createMemberLimits(memoryCounter().counter, { rsvpDaily: 1, seshCreateDaily: 1 });
    expect(await limits.claimRsvp(MEMBER, DAY)).toBe(true);
    expect(await limits.claimRsvp(OTHER, DAY)).toBe(true);
    expect(await limits.claimRsvp(MEMBER, DAY)).toBe(false);
  });
});

describe("posting a sesh", () => {
  it("allows the daily number and refuses the one after", async () => {
    const limits = createMemberLimits(memoryCounter().counter);
    for (let i = 0; i < SESH_CREATE_MEMBER_DAILY_LIMIT; i += 1) {
      expect(await limits.claimSeshCreate(MEMBER, DAY)).toBe(true);
    }
    expect(await limits.claimSeshCreate(MEMBER, DAY)).toBe(false);
  });

  it("does not share an allowance with asking to join", async () => {
    const limits = createMemberLimits(memoryCounter().counter, { rsvpDaily: 1, seshCreateDaily: 1 });
    await limits.claimRsvp(MEMBER, DAY);
    expect(await limits.claimSeshCreate(MEMBER, DAY)).toBe(true);
  });
});

describe("the keys", () => {
  /** The Redis database is shared with the TEKGUYZ Website. Every key this
   *  app writes starts `m4w:`. */
  it("are prefixed m4w:", () => {
    expect(memberLimitKeys.rsvp(DAY, MEMBER).startsWith("m4w:")).toBe(true);
    expect(memberLimitKeys.seshCreate(DAY, MEMBER).startsWith("m4w:")).toBe(true);
  });

  it("set a two-day expiry, once, on the first press only", async () => {
    const { counter, expiries } = memoryCounter();
    const limits = createMemberLimits(counter);
    await limits.claimRsvp(MEMBER, DAY);
    await limits.claimSeshCreate(MEMBER, DAY);
    expect(expiries.get(memberLimitKeys.rsvp(DAY, MEMBER))).toBe(172_800);
    expect(expiries.get(memberLimitKeys.seshCreate(DAY, MEMBER))).toBe(172_800);

    expiries.clear();
    await limits.claimRsvp(MEMBER, DAY);
    await limits.claimSeshCreate(MEMBER, DAY);
    expect(expiries.size).toBe(0);
  });
});

describe("an Upstash outage", () => {
  /** FAIL-OPEN, on purpose. The database still holds the hard caps — 20 new
   *  requests a day, five open seshes — so an outage costs nothing but the
   *  press-counting on top. It must not stop members using the app. */
  it("lets both through", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const limits = createMemberLimits(brokenCounter);

    expect(await limits.claimRsvp(MEMBER, DAY)).toBe(true);
    expect(await limits.claimSeshCreate(MEMBER, DAY)).toBe(true);

    spy.mockRestore();
  });

  it("logs the error name and never the message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await createMemberLimits(brokenCounter).claimRsvp(MEMBER, DAY);

    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("Error");
    expect(line).not.toContain("upstash unreachable");

    spy.mockRestore();
  });
});
