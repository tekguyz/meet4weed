// Meet4Weed's service worker (#51). Registered by components/service-worker.tsx.
//
// IT CACHES THE APP SHELL ONLY. Read docs/adr/0001-app-shell-caching-only.md
// before changing anything here. A cached sesh page holds an exact address, a
// unit number and a gate code, and it would outlive the RSVP that unlocked it.
// So nothing that came from the database is ever stored: no page, no data
// route, no API response. Offline shows "you are offline", never stale data.
// Writes are not queued (spec §8). app/__tests__/service-worker.test.ts holds
// this line.
//
// The one thing stored is the offline page and the CSS, JS, fonts and icons it
// needs, and only at install. Nothing is written to the cache afterwards.
// While online, every request goes to the network exactly as it would with no
// worker; the cache answers only when the network cannot.

const CACHE = "m4w-shell-v1";
const OFFLINE = "/offline";
const ICONS = ["/icon.svg", "/favicon.ico", "/apple-icon.png", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

// A build asset the offline page names: its styles, scripts and fonts. Stops
// at a quote, space, backslash or bracket, so an escaped URL inside the page's
// inline data is read too.
const ASSET = /\/_next\/static\/[^"'\s\\)]+\.(?:js|css|woff2?)/g;
const SHELL_PATH = /^\/(?:_next\/static\/|icon|favicon\.ico$|apple-icon)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const page = await fetch(OFFLINE, { cache: "reload" });
      if (!page.ok) throw new Error(`${OFFLINE} answered ${page.status}`);
      const assets = [...new Set((await page.clone().text()).match(ASSET) || [])];
      const cache = await caches.open(CACHE);
      await cache.put(OFFLINE, page);
      await cache.addAll([...assets, ...ICONS]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (SHELL_PATH.test(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error()),
    );
  }
});
