// FloodNow service worker: keeps the app shell and recently viewed map tiles
// available on poor or no network. API data is NOT cached here — the app
// keeps its own timestamped copies (lib/offline-cache.ts) so it can say
// "last updated at …" instead of passing stale data off as live.
const VERSION = "v1";
const SHELL = `floodnow-shell-${VERSION}`;
const STATIC = `floodnow-static-${VERSION}`;
const TILES = `floodnow-tiles-${VERSION}`;
const MAX_TILES = 400;
const SHELL_URLS = ["/", "/manifest.json", "/icon.svg", "/maplibre-gl-worker.js", "/maplibre-gl-shared.mjs"];
const TILE_HOSTS = ["tiles.openfreemap.org"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, STATIC, TILES]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("floodnow-") && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Pages: network first (fresh HTML), falling back to the cached shell.
async function navigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL)).put("/", response.clone());
    return response;
  } catch {
    return (await caches.match("/")) || Response.error();
  }
}

// Hashed build assets never change: cache first.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

// Everything else we cache: serve what we have, refresh in the background.
async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone());
        if (max) trim(cacheName, max);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") return event.respondWith(navigate(request));
    if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(request, STATIC));
    if (SHELL_URLS.includes(url.pathname)) return event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }
  if (TILE_HOSTS.includes(url.hostname)) return event.respondWith(staleWhileRevalidate(request, TILES, MAX_TILES));
  // API and other cross-origin requests go straight to the network.
});
