import "server-only";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";
import { APP_NAME, APP_URL } from "@/lib/env";

/**
 * A short public label for roughly where a sesh is — "Riverside", "South
 * Tampa". Looked up once, when a sesh is saved, from OpenStreetMap's
 * Nominatim. No key, no account, no cost.
 *
 * **It is handed the FUZZY point, never the exact address.** The fuzzy point
 * is already published on the map, so nothing private leaves the app. This is
 * the only reason calling an outside service is acceptable anywhere in this
 * feature, and it is the first line to check in review.
 *
 * Nominatim's usage policy wants a way to contact whoever is calling and
 * accepts a website, so the User-Agent carries the app's URL. The owner's
 * email address is deliberately not sent.
 *
 * Answers are cached for 30 days on the fuzzy point rounded to about 100 m.
 * That keeps the app inside the one-request-per-second policy and means a
 * street's worth of seshes costs one call. Upstash is shared with the TEKGUYZ
 * Website database, so every key starts `m4w:`.
 *
 * Nothing here ever throws. A lookup that fails returns null and the sesh
 * still saves — an outside service being down must not stop a member hosting.
 */

export type AreaCache = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
};

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type FuzzyPoint = { lat: number; lng: number };

export const AREA_NAME_TTL_SECONDS = 2_592_000; // 30 days
const TIMEOUT_MS = 2_000;
const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** Rounded to 3 decimal places — about 100 m — so neighbouring seshes share
 *  one cached answer rather than each making a call. */
export function areaNameKey(lat: number, lng: number): string {
  return `m4w:geo:${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/** Narrowest first. "Riverside" tells a member more than "Jacksonville", and
 *  a state or country tells them nothing they did not already know. */
const NAME_FIELDS = [
  "neighbourhood",
  "suburb",
  "city_district",
  "quarter",
  "town",
  "village",
  "city",
  "municipality",
] as const;

type NominatimReply = { address?: Record<string, string | undefined> };

function pickName(reply: NominatimReply): string | null {
  for (const field of NAME_FIELDS) {
    const value = reply.address?.[field]?.trim();
    // Mirrors the 40-character CHECK on seshes.area_name: a name the column
    // would reject is worse than no name at all.
    if (value && value.length <= 40) return value;
  }
  return null;
}

export function createAreaNameLookup(deps: { fetch: Fetcher; cache?: AreaCache | null }) {
  const { fetch: fetcher, cache } = deps;

  return async function areaNameFor(point: FuzzyPoint): Promise<string | null> {
    const key = areaNameKey(point.lat, point.lng);

    try {
      const hit = await cache?.get(key);
      if (hit) return hit;
    } catch {
      // A cache outage is not a reason to refuse a lookup.
    }

    let name: string | null = null;
    try {
      const url = `${ENDPOINT}?format=jsonv2&zoom=14&lat=${point.lat}&lon=${point.lng}`;
      const response = await fetcher(url, {
        headers: {
          "user-agent": `${APP_NAME}/1.0 (${APP_URL})`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      name = pickName((await response.json()) as NominatimReply);
    } catch {
      // Unreachable, aborted, or not JSON. The sesh saves without a name.
      return null;
    }

    if (!name) return null;

    try {
      await cache?.set(key, name, AREA_NAME_TTL_SECONDS);
    } catch {
      // Same again: the answer is good even if we could not keep it.
    }
    return name;
  };
}

function upstashCache(): AreaCache {
  const env = serverEnv();
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return {
    get: (key) => redis.get<string>(key),
    set: (key, value, ttlSeconds) => redis.set(key, value, { ex: ttlSeconds }),
  };
}

/** The real one. */
export function areaNameLookup() {
  return createAreaNameLookup({ fetch: globalThis.fetch, cache: upstashCache() });
}
