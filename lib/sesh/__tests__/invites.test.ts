/** @vitest-environment node
 *
 *  Plan 04, ticket #30 — the numbers and the one sentence.
 *
 *  Runs in CI: no secret key, no database, no network.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAIMED_NOT_YET,
  INVITE_DAYS_DEFAULT,
  INVITE_DAYS_MAX,
  INVITE_FAILED,
  INVITE_USES_DEFAULT,
  INVITE_USES_MAX,
  INVITES_PER_SESH,
  expiryFromDays,
  inviteMintSchema,
  invitePath,
  inviteUrl,
} from "@/lib/sesh/invites";

describe("the caps mirror the database", () => {
  /** If one of these moves without the migration moving, a host gets a 500
   *  instead of a sentence. That is the whole reason this file exists. */
  it("matches the CHECK constraints and the count in mint_invite()", () => {
    expect(INVITE_USES_DEFAULT).toBe(1);
    expect(INVITE_USES_MAX).toBe(10);
    expect(INVITES_PER_SESH).toBe(5);
  });
});

describe("the mint form", () => {
  it("takes the strings a form actually posts", () => {
    const parsed = inviteMintSchema.parse({ uses: "3", days: "7" });
    expect(parsed).toEqual({ uses: 3, days: 7 });
  });

  /** A form that loses a field mints an ordinary link rather than failing. */
  it("defaults an empty form to one use and a week", () => {
    expect(inviteMintSchema.parse({})).toEqual({
      uses: INVITE_USES_DEFAULT,
      days: INVITE_DAYS_DEFAULT,
    });
  });

  it("refuses an eleventh use and a zeroth", () => {
    expect(inviteMintSchema.safeParse({ uses: "11" }).success).toBe(false);
    expect(inviteMintSchema.safeParse({ uses: "0" }).success).toBe(false);
  });

  it("refuses half a person", () => {
    expect(inviteMintSchema.safeParse({ uses: "1.5" }).success).toBe(false);
  });

  it("refuses a link that would outlast a month", () => {
    expect(inviteMintSchema.safeParse({ days: String(INVITE_DAYS_MAX + 1) }).success).toBe(false);
  });
});

describe("the expiry", () => {
  it("is the host's ask, unclamped — the database does the clamping", () => {
    const now = new Date("2026-09-21T12:00:00.000Z");
    expect(expiryFromDays(7, now)).toBe("2026-09-28T12:00:00.000Z");
  });
});

describe("the link", () => {
  it("points at the invite route", () => {
    expect(invitePath("abc.def")).toBe("/invite/abc.def");
  });

  /** NOT cosmetic. `/invite` is the prefix lib/supabase/session.ts already
   *  lets a signed-out visitor through on, and the cold path in #31 needs
   *  the route reachable without a session. A route named anything else
   *  would be silently gated and #31 would start by moving it. */
  it("sits under the prefix the proxy lets a signed-out visitor through on", () => {
    const session = readFileSync(resolve(process.cwd(), "lib/supabase/session.ts"), "utf8");
    const prefixes = session.match(/const PUBLIC_PREFIXES = \[([^\]]*)\]/)![1];

    expect(prefixes).toContain('"/invite"');
    expect(invitePath("tok").startsWith("/invite/")).toBe(true);
  });

  /** A token is base64url plus a dot, so nothing in it needs escaping. The
   *  encode is there for the case where something else ever does. */
  it("escapes anything that is not token-shaped", () => {
    expect(invitePath("a/b")).toBe("/invite/a%2Fb");
  });

  it("does not double the slash after an origin with a trailing one", () => {
    expect(inviteUrl("https://meet4weed.app/", "tok")).toBe("https://meet4weed.app/invite/tok");
    expect(inviteUrl("https://meet4weed.app", "tok")).toBe("https://meet4weed.app/invite/tok");
  });
});

describe("the wording", () => {
  /** One sentence for every failure. The test is that it says nothing about
   *  WHICH failure — no "expired", no "used", no "revoked", no "found". */
  it("names no reason", () => {
    expect(INVITE_FAILED.toLowerCase()).not.toMatch(
      /expired|used|revok|not found|missing|invalid|signature|suspend/,
    );
  });

  /** The host is told a claim exists and that the person cannot join yet.
   *  Never why. Three causes, one sentence, none of them disclosed. */
  it("tells a host a claim is waiting without saying why", () => {
    expect(CLAIMED_NOT_YET).toBe("claimed, not yet able to join");
    expect(CLAIMED_NOT_YET.toLowerCase()).not.toMatch(
      /verif|unverified|pending|review|expired|card|suspend/,
    );
  });
});
