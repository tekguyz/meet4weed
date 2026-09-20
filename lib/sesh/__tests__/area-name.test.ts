/** @vitest-environment node
 *
 *  The one call this feature makes to the outside world.
 *
 *  The first test is the important one. The lookup must be handed the FUZZY
 *  point, which is already public, and never the exact address. If that ever
 *  flips, a member's home goes to a third party and nothing else in the app
 *  would notice.
 *
 *  fetch and the cache are injected, following lib/verification/limits.ts, so
 *  nothing here mocks the network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  areaNameKey,
  createAreaNameLookup,
  type AreaCache,
  type Fetcher,
} from "@/lib/sesh/area-name";

const EXACT = { lat: 27.95061, lng: -82.45729 };
const FUZZY = { lat: 27.95312, lng: -82.45411 };

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const RIVERSIDE = { address: { neighbourhood: "Riverside", city: "Jacksonville", country: "United States" } };

function memoryCache() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  const cache: AreaCache = {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, ttl) => {
      store.set(key, value);
      ttls.set(key, ttl);
    },
  };
  return { cache, store, ttls };
}

const brokenCache: AreaCache = {
  get: async () => {
    throw new Error("upstash unreachable");
  },
  set: async () => {
    throw new Error("upstash unreachable");
  },
};

function lookupWith(fetcher: Fetcher, cache: AreaCache | null = null) {
  return createAreaNameLookup({ fetch: fetcher, cache });
}

describe("areaName", () => {
  it("asks about the fuzzy point and never sends the exact address", async () => {
    const fetcher = vi.fn<Fetcher>(async () => reply(RIVERSIDE));

    await lookupWith(fetcher)(FUZZY);

    const url = String(fetcher.mock.calls[0][0]);
    expect(url).toContain(String(FUZZY.lat));
    expect(url).toContain(String(FUZZY.lng));
    expect(url).not.toContain(String(EXACT.lat));
    expect(url).not.toContain(String(EXACT.lng));
  });

  it("names the app by its website and sends no email address", async () => {
    const fetcher = vi.fn<Fetcher>(async () => reply(RIVERSIDE));

    await lookupWith(fetcher)(FUZZY);

    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    const agent = headers.get("user-agent") ?? "";
    expect(agent).toMatch(/meet4weed/i);
    expect(agent).toMatch(/https:\/\//);
    expect(agent).not.toContain("@");
  });

  it("returns the neighbourhood when there is one", async () => {
    expect(await lookupWith(async () => reply(RIVERSIDE))(FUZZY)).toBe("Riverside");
  });

  it("falls back to a wider name when there is no neighbourhood", async () => {
    const body = { address: { city: "Tampa", state: "Florida" } };

    expect(await lookupWith(async () => reply(body))(FUZZY)).toBe("Tampa");
  });

  it("returns nothing rather than throwing when the service errors", async () => {
    expect(await lookupWith(async () => reply({ error: "boom" }, 503))(FUZZY)).toBeNull();
  });

  it("returns nothing rather than throwing when the request fails or times out", async () => {
    const aborted = async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    };

    expect(await lookupWith(aborted)(FUZZY)).toBeNull();
  });

  it("returns nothing when the answer has no usable name", async () => {
    expect(await lookupWith(async () => reply({ address: {} }))(FUZZY)).toBeNull();
  });

  it("serves a repeat from the cache without calling out again", async () => {
    const fetcher = vi.fn<Fetcher>(async () => reply(RIVERSIDE));
    const { cache } = memoryCache();
    const lookup = lookupWith(fetcher, cache);

    expect(await lookup(FUZZY)).toBe("Riverside");
    expect(await lookup(FUZZY)).toBe("Riverside");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps its keys inside the m4w namespace, because the database is shared", async () => {
    const { cache, store, ttls } = memoryCache();

    await lookupWith(async () => reply(RIVERSIDE), cache)(FUZZY);

    const key = [...store.keys()][0];
    expect(key).toBe(areaNameKey(FUZZY.lat, FUZZY.lng));
    expect(key.startsWith("m4w:")).toBe(true);
    expect(ttls.get(key)).toBeGreaterThan(0);
  });

  it("still answers when the cache is unreachable", async () => {
    expect(await lookupWith(async () => reply(RIVERSIDE), brokenCache)(FUZZY)).toBe("Riverside");
  });
});
