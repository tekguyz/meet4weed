import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";

/**
 * New visitors, per IP and in total, per clock hour (issue #39).
 *
 * The same shape as lib/sesh/invite-limits.ts. Supabase's own anonymous
 * sign-in limit (30 an hour per IP) sits underneath; these are tighter, and
 * the global one is the only thing that stops a bot spread across many IPs.
 *
 * FAIL-CLOSED IS THE DECISION, unlike the member limits. Those guard a real
 * member's evening; this guards the database against a flood, and a demo that
 * says "busy" during an Upstash outage costs nobody anything.
 *
 * The IP is checked first, and the global counter is touched only when the IP
 * is clear, so one noisy IP cannot eat the hour's allowance past its own five.
 *
 * Upstash is shared with the TEKGUYZ Website database, so every key starts
 * `m4w:`. The IP is hashed.
 */

export type Counter = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export const DEMO_IP_HOURLY_LIMIT = 5;
export const DEMO_GLOBAL_HOURLY_LIMIT = 100;

const TWO_HOURS_SECONDS = 7_200;

const hashIp = (ip: string) => createHash("sha256").update(`m4w:${ip}`).digest("base64url").slice(0, 22);

/** The UTC hour a press falls in, e.g. `2026-09-27T14`. */
export const hourOf = (now: Date) => now.toISOString().slice(0, 13);

export const demoLimitKeys = {
  ip: (hour: string, ip: string) => `m4w:demo:visitor:ip:${hour}:${hashIp(ip)}`,
  global: (hour: string) => `m4w:demo:visitor:all:${hour}`,
};

export type DemoClaim = { ipAllowed: boolean; globalAllowed: boolean };

export function createDemoLimits(
  counter: Counter,
  limits = { ip: DEMO_IP_HOURLY_LIMIT, global: DEMO_GLOBAL_HOURLY_LIMIT },
) {
  async function claim(key: string, limit: number): Promise<boolean> {
    const count = await counter.incr(key);
    if (count === 1) await counter.expire(key, TWO_HOURS_SECONDS);
    return count <= limit;
  }

  return {
    async claimVisitor(ip: string, now: Date): Promise<DemoClaim> {
      const hour = hourOf(now);
      try {
        const ipAllowed = await claim(demoLimitKeys.ip(hour, ip), limits.ip);
        if (!ipAllowed) return { ipAllowed, globalAllowed: true };
        return { ipAllowed, globalAllowed: await claim(demoLimitKeys.global(hour), limits.global) };
      } catch (error) {
        // Fail closed. The name only, never the message.
        console.error(`[demo-limits] Upstash unavailable, the demo says busy: ${(error as Error).name}`);
        return { ipAllowed: false, globalAllowed: false };
      }
    },
  };
}

export type DemoLimits = ReturnType<typeof createDemoLimits>;

export function demoLimitsFromEnv(): DemoLimits {
  const env = serverEnv();
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return createDemoLimits(redis);
}
