import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * public/sw.js is a plain script the browser runs; nothing imports it, so no
 * type or build step checks it. It is run here in a fake worker scope and
 * driven through its events.
 *
 * The rule under test is ADR 0001: the worker caches the app shell only. A
 * cached sesh page holds an exact address, a unit number and a gate code, and
 * it would outlive the RSVP that unlocked it. The tests below are the guard
 * that stops somebody "improving" offline support into an address leak.
 */
const root = path.resolve(import.meta.dirname, "../..");
const SOURCE = readFileSync(path.join(root, "public/sw.js"), "utf8");
const ORIGIN = "https://meet4weed.test";

/** What a cached path may be: the offline page, a build asset, or an icon. */
const SHELL = /^\/(?:offline|_next\/static\/.+\.(?:js|css|woff2?)|icon\.svg|favicon\.ico|apple-icon\.png|icon-(?:192|512|maskable-512)\.png)$/;

/** Every data route the app has, and the API. None may ever be cached. */
const DATA_ROUTES = ["/", "/seshes", "/seshes/abc", "/seshes/abc/edit", "/me", "/profile/someone", "/notifications", "/admin", "/api/anything", "/invite/tok"];

const OFFLINE_HTML = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/_next/static/css/app.css"/>
<link rel="preload" href="/_next/static/media/nunito.woff2" as="font"/>
<script src="/_next/static/chunks/main.js" async></script>
<link rel="icon" href="/icon.svg?abc123"/>
</head><body><a href="/seshes/abc">not a shell asset</a>
<script>self.__next_f.push([1,"/_next/static/chunks/lazy.js"])</script></body></html>`;

/** next/font names a face only here when it is not preloaded. */
const STYLESHEET = `@font-face{font-family:x;src:url(../media/inner.woff2) format("woff2")}`;

type Listener = (event: Record<string, unknown>) => void;

function worker({ online = true, missing = [] as string[] } = {}) {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
  const put = vi.fn();

  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      put: async (req: Request | string, res: Response) => {
        put(key(req));
        store.set(key(req), res);
      },
      addAll: async (reqs: string[]) => {
        for (const r of reqs) {
          put(key(r));
          store.set(key(r), new Response("asset"));
        }
      },
      match: async (req: Request | string) => store.get(key(req)),
    };
  };

  const net = vi.fn(async (req: Request | string) => {
    if (!online) throw new TypeError("Failed to fetch");
    const p = key(req);
    if (missing.includes(p)) return new Response("gone", { status: 404 });
    if (p === "/offline") return new Response(OFFLINE_HTML);
    if (p.endsWith(".css")) return new Response(STYLESHEET);
    return new Response(`live ${p}`);
  });

  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const caches = {
    open: async (name: string) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: Request | string) => {
      for (const name of stores.keys()) {
        const hit = await cacheFor(name).match(req);
        if (hit) return hit;
      }
    },
  };
  vm.runInNewContext(SOURCE, { self, caches, fetch: net, URL, Request, Response, Promise });

  async function install() {
    let done: Promise<unknown> = Promise.resolve();
    listeners.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }

  async function request(pathname: string, mode: "navigate" | "cors" = "navigate", method = "GET") {
    let answer: Promise<Response> | undefined;
    const request = { url: `${ORIGIN}${pathname}`, mode, method };
    listeners.fetch({ request, respondWith: (p: Promise<Response>) => (answer = p) });
    return answer;
  }

  const cached = () => [...stores.values()].flatMap((s) => [...s.keys()]);
  return { install, request, cached, put, net, stores, listeners, setOnline: (v: boolean) => (online = v) };
}

describe("the service worker (ADR 0001: app shell only)", () => {
  let w: ReturnType<typeof worker>;
  beforeEach(async () => {
    w = worker();
    await w.install();
  });

  it("caches the offline page and the CSS, JS, fonts and icons it needs", () => {
    expect(w.cached()).toEqual(
      expect.arrayContaining([
        "/offline",
        "/_next/static/css/app.css",
        "/_next/static/media/nunito.woff2",
        "/_next/static/chunks/main.js",
        "/_next/static/chunks/lazy.js",
        "/_next/static/media/inner.woff2",
        "/icon.svg",
        "/icon-192.png",
      ]),
    );
  });

  it("caches nothing outside the shell, and no data route", () => {
    for (const p of w.cached()) expect(p).toMatch(SHELL);
    for (const p of DATA_ROUTES) expect(w.cached()).not.toContain(p);
  });

  it("stores nothing while the app is used — online or off", async () => {
    w.put.mockClear();
    for (const p of DATA_ROUTES) await (await w.request(p));
    await (await w.request("/_next/static/chunks/other.js", "cors"));
    w.setOnline(false);
    for (const p of DATA_ROUTES) await (await w.request(p));
    expect(w.put).not.toHaveBeenCalled();
  });

  it("goes to the network for every page while online", async () => {
    const res = await w.request("/seshes/abc");
    expect(await res!.text()).toBe("live /seshes/abc");
  });

  it("shows the offline page, never a stale sesh, when there is no signal", async () => {
    w.setOnline(false);
    const res = await w.request("/seshes/abc");
    expect(await res!.text()).toBe(OFFLINE_HTML);
  });

  it("serves a shell asset from the cache when there is no signal", async () => {
    w.setOnline(false);
    const res = await w.request("/_next/static/css/app.css", "cors");
    expect(res).toBeDefined();
    expect(await res!.text()).toBe(STYLESHEET);
  });

  // Web push needs the worker whether or not the offline page is complete.
  it("still installs when a shell file is missing", async () => {
    const partial = worker({ missing: ["/icon-512.png", "/offline"] });
    await partial.install();
    expect(partial.cached()).toContain("/icon-192.png");
    expect(partial.cached()).not.toContain("/icon-512.png");
  });

  it("leaves writes and other origins to the browser", async () => {
    expect(await w.request("/seshes/abc", "cors", "POST")).toBeUndefined();
    let answered = false;
    w.listeners.fetch({ request: { url: "https://tiles.example/1.png", mode: "cors", method: "GET" }, respondWith: () => (answered = true) });
    expect(answered).toBe(false);
  });

  it("drops an older shell cache when a new worker takes over", async () => {
    w.stores.set("m4w-shell-old", new Map([["/seshes/abc", new Response("stale")]]));
    let done: Promise<unknown> = Promise.resolve();
    w.listeners.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(w.cached()).not.toContain("/seshes/abc");
    expect(w.stores.size).toBe(1);
  });
});
