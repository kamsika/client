const VERSION = "sms-pwa-v3"
const CACHE_PREFIX = "sms-pwa-"
const LEGACY_CACHE_PREFIX = "ahms-pwa-"
const STATIC_CACHE = `${VERSION}-static`
const PUBLIC_CACHE = `${VERSION}-public`
const MAX_STATIC_ENTRIES = 60
const MAX_PUBLIC_ENTRIES = 8

const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

const PUBLIC_NAVIGATION_PATHS = new Set([
  "/",
  "/auth/login",
  "/auth/parent-login",
  "/auth/register",
  "/institutional-onboarding",
  "/offline",
])

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)))
}

function isCacheable(response) {
  if (!response || response.status !== 200 || !["basic", "cors"].includes(response.type)) return false
  const cacheControl = response.headers.get("Cache-Control") || ""
  return !/(?:no-store|private)/i.test(cacheControl)
}

function isSafeStaticRequest(request, url) {
  if (request.method !== "GET" || request.headers.has("Authorization")) return false
  if (url.pathname.startsWith("/_next/static/")) return true
  if (url.pathname.startsWith("/icons/")) return true
  if (url.pathname === "/favicon.ico" || url.pathname === "/manifest.webmanifest") return true
  return false
}

async function putBounded(cacheName, request, response, maxEntries) {
  if (!isCacheable(response)) return
  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  await trimCache(cacheName, maxEntries)
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(LEGACY_CACHE_PREFIX) ||
                (key.startsWith(CACHE_PREFIX) && !key.startsWith(VERSION)),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }
  if (event.data?.type === "CLEAR_APP_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      ),
    )
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)

  // API/authenticated data is hosted separately today, but this same-origin
  // guard keeps it network-only if deployment topology changes later.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    request.headers.has("Authorization")
  ) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (PUBLIC_NAVIGATION_PATHS.has(url.pathname)) {
            await putBounded(PUBLIC_CACHE, request, response, MAX_PUBLIC_ENTRIES)
          }
          return response
        })
        .catch(async () => {
          if (PUBLIC_NAVIGATION_PATHS.has(url.pathname)) {
            const cachedPublicPage = await caches.match(request)
            if (cachedPublicPage) return cachedPublicPage
          }
          return (await caches.match("/offline")) || Response.error()
        }),
    )
    return
  }

  if (!isSafeStaticRequest(request, url)) return

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached
      const response = await fetch(request)
      await putBounded(STATIC_CACHE, request, response, MAX_STATIC_ENTRIES)
      return response
    }),
  )
})
