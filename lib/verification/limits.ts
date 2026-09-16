import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";

/**
 * Spec §4.4 items 3 and 4, in Upstash Redis.
 *
 * - Per member and per IP: over the limit, the submission is refused whole —
 *   nothing stored, no Claude call.
 * - Daily ceiling: over it, the submission is still stored and queued, and only
 *   the Claude call is skipped. The reviewer reads the card by eye.
 *
 * Upstash is shared with the TEKGUYZ Website database, so every key starts
 * `m4w:`. Counters live two days, long enough to outlast any clock skew
 * around midnight.
 *
 * If Upstash cannot be reached, a member is not locked out (the submission is
 * queued) but Claude is not called: an outage must not be the thing that runs
 * up the bill.
 */

export type Counter = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export type LimitConfig = { memberDaily: number; ipDaily: number; visionDaily: number };

export type SubmissionClaim =
  | { ok: true; limiterAvailable: boolean }
  | { ok: false; reason: "member_limit" | "ip_limit" };

const TWO_DAYS_SECONDS = 172_800;

// The IP is hashed: the key needs to be stable, not readable, and the database
// is shared with another app.
const hashIp = (ip: string) => createHash("sha256").update(`m4w:${ip}`).digest("base64url").slice(0, 22);

export const limitKeys = {
  member: (day: string, memberId: string) => `m4w:verify:member:${day}:${memberId}`,
  ip: (day: string, ip: string) => `m4w:verify:ip:${day}:${hashIp(ip)}`,
  vision: (day: string) => `m4w:vision:calls:${day}`,
};

async function bump(counter: Counter, key: string): Promise<number> {
  const count = await counter.incr(key);
  if (count === 1) await counter.expire(key, TWO_DAYS_SECONDS);
  return count;
}

export function createLimits(counter: Counter, config: LimitConfig) {
  return {
    async claimSubmission(memberId: string, ip: string, day: string): Promise<SubmissionClaim> {
      try {
        if ((await bump(counter, limitKeys.member(day, memberId))) > config.memberDaily) {
          return { ok: false, reason: "member_limit" };
        }
        if ((await bump(counter, limitKeys.ip(day, ip))) > config.ipDaily) {
          return { ok: false, reason: "ip_limit" };
        }
        return { ok: true, limiterAvailable: true };
      } catch (error) {
        console.error(`[limits] Upstash unavailable, Claude will be skipped: ${(error as Error).name}`);
        return { ok: true, limiterAvailable: false };
      }
    },

    async claimVisionCall(day: string): Promise<boolean> {
      try {
        return (await bump(counter, limitKeys.vision(day))) <= config.visionDaily;
      } catch (error) {
        console.error(`[limits] Upstash unavailable, Claude skipped: ${(error as Error).name}`);
        return false;
      }
    },
  };
}

export type Limits = ReturnType<typeof createLimits>;

export function limitsFromEnv(): Limits {
  const env = serverEnv();
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return createLimits(redis, {
    memberDaily: env.VERIFY_MEMBER_DAILY_LIMIT,
    ipDaily: env.VERIFY_IP_DAILY_LIMIT,
    visionDaily: env.VISION_DAILY_CEILING,
  });
}
