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
  claimsAwaitingMention,
  expiryFromDays,
  isInviteLive,
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

describe("who gets the sentence", () => {
  const known = (...ids: string[]) => new Set(ids);

  /** The one person it exists for: somebody spent a use and never appeared.
   *  That is a use the host cannot otherwise account for. */
  it("counts a claimant the host has never met", () => {
    expect(claimsAwaitingMention(["ghost"], known())).toBe(1);
  });

  /** THE RULE IS "HAS THE HOST MET THIS PERSON", not "can they join".
   *  Somebody the host DECLINED has already surfaced by name in the queue and
   *  been acted on. Saying "claimed, not yet able to join" about them would
   *  imply they are still waiting, which is the opposite of true. Any rsvp
   *  row at all — waiting, coming, declined, removed, withdrawn — means met. */
  it("says nothing about anybody who holds an rsvp row of any kind", () => {
    expect(claimsAwaitingMention(["declined"], known("declined"))).toBe(0);
    expect(claimsAwaitingMention(["waiting"], known("waiting"))).toBe(0);
  });

  it("counts only the ones the host has not met", () => {
    expect(claimsAwaitingMention(["a", "b", "c"], known("b"))).toBe(2);
  });

  it("is nothing when nobody claimed", () => {
    expect(claimsAwaitingMention([], known("a"))).toBe(0);
  });

  /** It takes ids and ids only. Nothing about verification reaches it, so
   *  nothing about verification can leak out of it. */
  it("takes no status of any kind", () => {
    expect(claimsAwaitingMention.length).toBe(2);
  });
});

describe("whether a link still works", () => {
  const base = {
    revokedAt: null as string | null,
    expiresAt: "2026-09-30T00:00:00.000Z",
    useCount: 0,
    maxUses: 1,
  };
  const NOW = new Date("2026-09-21T00:00:00.000Z").getTime();

  it("is live when nothing has happened to it", () => {
    expect(isInviteLive(base, NOW)).toBe(true);
  });

  it("is dead once revoked", () => {
    expect(isInviteLive({ ...base, revokedAt: "2026-09-21T00:00:00.000Z" }, NOW)).toBe(false);
  });

  it("is dead once the expiry has passed", () => {
    expect(isInviteLive({ ...base, expiresAt: "2026-09-20T00:00:00.000Z" }, NOW)).toBe(false);
  });

  it("is dead once the uses are gone, and live while any remain", () => {
    expect(isInviteLive({ ...base, useCount: 1, maxUses: 1 }, NOW)).toBe(false);
    expect(isInviteLive({ ...base, useCount: 1, maxUses: 3 }, NOW)).toBe(true);
  });

  /** A COPY of private.invite_is_live, and cosmetic only. The database is the
   *  boundary — mint counts with its own copy and redeem checks under a row
   *  lock — so nothing a browser believes here can let a use be spent. The
   *  three SQL conditions are mirrored, and this test is the note saying that
   *  when one moves, both move. */
  it("mirrors the three conditions the migration uses", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260921090000_invites.sql"),
      "utf8",
    );
    const fn = sql.slice(sql.indexOf("function private.invite_is_live"));

    expect(fn).toContain("revoked_at is null");
    expect(fn).toContain("expires_at > now()");
    expect(fn).toContain("use_count < p_invite.max_uses");
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
