const CACHE_NAME = "aar-reader-shell-v13";
const SHELL_URL = "./index.html";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js?v=20260312h",
  "./app.js?v=20260312h",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        if (network && network.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(SHELL_URL, network.clone());
        }
        return network;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(SHELL_URL);
        if (fallback) return fallback;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response("", { status: 503, statusText: "Offline" });
    }
  })());
});
