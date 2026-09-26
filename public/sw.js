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
// Keep in step with app/manifest.ts; app/__tests__/manifest.test.ts checks it.
const ICONS = ["/icon.svg", "/favicon.ico", "/apple-icon.png", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

// A build asset the offline page names: its styles, scripts and fonts. Stops
// at a quote, space, backslash or bracket, so an escaped URL inside the page's
// inline data is read too.
const ASSET = /\/_next\/static\/[^"'\s\\)]+\.(?:js|css|woff2?)/g;
const isShell = (pathname) => pathname.startsWith("/_next/static/") || ICONS.includes(pathname);

// A font a stylesheet names, as a path relative to that stylesheet.
const FONT = /url\(\s*["']?([^"')]+\.woff2?)/g;

// Stores one shell file, and the fonts it names if it is a stylesheet. Each
// file is best-effort: one missing icon must not stop the worker installing,
// because web push needs a worker whether or not the offline page is complete.
async function keep(cache, path) {
  try {
    const res = await fetch(path, { cache: "reload" });
    if (!res.ok) return;
    if (path.endsWith(".css")) {
      const base = new URL(path, self.location.origin);
      const fonts = [...(await res.clone().text()).matchAll(FONT)].map((m) => new URL(m[1], base).pathname);
      await Promise.all(fonts.filter(isShell).map((font) => keep(cache, font)));
    }
    await cache.put(path, res);
  } catch {
    // No signal, or the file is gone. The rest of the shell still installs.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      let assets = [];
      try {
        const page = await fetch(OFFLINE, { cache: "reload" });
        if (page.ok) {
          assets = [...new Set((await page.clone().text()).match(ASSET) || [])];
          await cache.put(OFFLINE, page);
        }
      } catch {
        // Installs anyway, for push. With no cached page, no signal shows the
        // browser's own offline screen, which holds no data either.
      }
      await Promise.all([...assets, ...ICONS].map((path) => keep(cache, path)));
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

  if (isShell(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error()),
    );
  }
});
