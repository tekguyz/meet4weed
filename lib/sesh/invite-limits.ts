import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";

/**
 * Redemption attempts, per IP, per day.
 *
 * The same shape as lib/verification/limits.ts, and deliberately not a reuse
 * of it: that module counts card submissions against a member AND an IP and
 * closes on failure, because a Claude call costs money. This one counts
 * presses on an invite link, and fails OPEN.
 *
 * FAIL-OPEN IS THE DECISION, not an oversight. A 22-byte random token with a
 * signature tag is not sweepable in practice, so the limiter is there to make
 * a script boring rather than to be the wall. An Upstash outage must not stop
 * real people walking through real links they were handed.
 *
 * Upstash is shared with the TEKGUYZ Website database, so every key starts
 * `m4w:`. Counters live two days, long enough to outlast clock skew around
 * midnight. The IP is HASHED: the key has to be stable, not readable, and it
 * lands in somebody else's database.
 */

export type Counter = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

const TWO_DAYS_SECONDS = 172_800;

/** 30 a day. Generous for a person who mistypes, useless to a script. */
export const REDEEM_IP_DAILY_LIMIT = 30;

const hashIp = (ip: string) => createHash("sha256").update(`m4w:${ip}`).digest("base64url").slice(0, 22);

export const inviteLimitKey = (day: string, ip: string) => `m4w:invite:redeem:ip:${day}:${hashIp(ip)}`;

export function createInviteLimits(counter: Counter, ipDaily: number = REDEEM_IP_DAILY_LIMIT) {
  return {
    /** True means carry on. False means this IP has had its thirty. */
    async claimRedemption(ip: string, day: string): Promise<boolean> {
      try {
        const key = inviteLimitKey(day, ip);
        const count = await counter.incr(key);
        if (count === 1) await counter.expire(key, TWO_DAYS_SECONDS);
        return count <= ipDaily;
      } catch (error) {
        // Fail open. The name only — never the message, which can carry a
        // URL with a token in it.
        console.error(`[invite-limits] Upstash unavailable, letting it through: ${(error as Error).name}`);
        return true;
      }
    },
  };
}

export type InviteLimits = ReturnType<typeof createInviteLimits>;

export function inviteLimitsFromEnv(): InviteLimits {
  const env = serverEnv();
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return createInviteLimits(redis);
}
