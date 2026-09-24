import "server-only";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";

/**
 * Asking to join and posting a sesh, per member, per day. Spec §4.4.
 *
 * The same shape as lib/sesh/invite-limits.ts. These count PRESSES, which is
 * what the database cannot: request_rsvp() caps new requests at 20 rows a
 * day, but withdrawing and asking again reuses one row, so a member could
 * flood one host's approvals forever. The seshes insert policy caps a host at
 * five OPEN seshes, but posting and cancelling in a loop never trips it and
 * floods the feed.
 *
 * FAIL-OPEN IS THE DECISION. Those database caps are still the wall; this is
 * the press-counting on top. An Upstash outage must not stop members joining
 * or hosting.
 *
 * Upstash is shared with the TEKGUYZ Website database, so every key starts
 * `m4w:`. Counters live two days, long enough to outlast clock skew around
 * midnight.
 */

export type Counter = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export type MemberLimitConfig = { rsvpDaily: number; seshCreateDaily: number };

const TWO_DAYS_SECONDS = 172_800;

/** 30 a day. Above the database's 20 new requests, so a member who only asks
 *  hears the database's sentence first; this one catches the withdraw-and-ask
 *  loop. */
export const RSVP_MEMBER_DAILY_LIMIT = 30;

/** 10 a day. Twice the five-open cap, so a host who posts, cancels a mistake
 *  and posts again never meets it. */
export const SESH_CREATE_MEMBER_DAILY_LIMIT = 10;

export const memberLimitKeys = {
  rsvp: (day: string, memberId: string) => `m4w:rsvp:member:${day}:${memberId}`,
  seshCreate: (day: string, memberId: string) => `m4w:sesh:create:member:${day}:${memberId}`,
};

export function createMemberLimits(
  counter: Counter,
  config: MemberLimitConfig = {
    rsvpDaily: RSVP_MEMBER_DAILY_LIMIT,
    seshCreateDaily: SESH_CREATE_MEMBER_DAILY_LIMIT,
  },
) {
  async function claim(key: string, daily: number): Promise<boolean> {
    try {
      const count = await counter.incr(key);
      if (count === 1) await counter.expire(key, TWO_DAYS_SECONDS);
      return count <= daily;
    } catch (error) {
      // Fail open. The name only, never the message.
      console.error(`[member-limits] Upstash unavailable, letting it through: ${(error as Error).name}`);
      return true;
    }
  }

  return {
    /** True means carry on. False means they have asked enough for today. */
    claimRsvp: (memberId: string, day: string) => claim(memberLimitKeys.rsvp(day, memberId), config.rsvpDaily),
    /** True means carry on. False means they have posted enough for today. */
    claimSeshCreate: (memberId: string, day: string) =>
      claim(memberLimitKeys.seshCreate(day, memberId), config.seshCreateDaily),
  };
}

export type MemberLimits = ReturnType<typeof createMemberLimits>;

export function memberLimitsFromEnv(): MemberLimits {
  const env = serverEnv();
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return createMemberLimits(redis);
}
