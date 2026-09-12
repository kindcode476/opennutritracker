// Service worker for the personal web build.
//
// Flutter used to generate a precaching service worker; as of 3.44 the one it
// emits is a stub that unregisters itself, and offline support is no longer
// the framework's job. This file is that job, done deliberately.
//
// Two strategies, split by what breaks if the file is stale:
//
//   * The app's own code — the document, the bootstrap, main.dart.js — is
//     network-first. A new deploy must win immediately, and serving a stale
//     bundle alongside a fresh document is how a web app ends up broken in a
//     way only a hard refresh fixes. Offline, the cache answers.
//   * Everything else — the engine, fonts, images, the manifest — is
//     stale-while-revalidate: answered from cache at once, refreshed in the
//     background for next time. These change only when the SDK does.
//
// Nothing is cached that was not requested, so the 37 MB of engine variants in
// the deploy never all land on a phone; only the one this browser asked for.

const CACHE = 'ont-app-v1';

// Requests where freshness matters more than speed.
const NETWORK_FIRST = /\/(index\.html|flutter_bootstrap\.js|main\.dart\.js|version\.json)$|\/$/;

self.addEventListener('install', (event) => {
  // The app shell is the one thing worth having before it is asked for: it is
  // what makes a cold, offline start show the app rather than a browser error.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/index.html'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// The page reports what it fetched on a load the worker did not control (see
// web/register-sw.js). Fetching them here, from the worker itself, is what
// makes the app openable offline after one online visit rather than two.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'warm-cache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const missing = [];
      for (const url of data.urls) {
        if (!(await cache.match(url))) missing.push(url);
      }
      // One at a time, and forgiving: a single 404 must not abandon the rest,
      // which is what cache.addAll would do.
      for (const url of missing) {
        try {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        } catch (error) {
          // Offline again already, or the file has moved. Next visit retries.
        }
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Open Food Facts lookups must never be answered from a stale cache, and
  // anything cross-origin is somebody else's to cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // A navigation with nothing cached for this exact URL still gets the app:
    // its router will resolve the path once it boots.
    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
