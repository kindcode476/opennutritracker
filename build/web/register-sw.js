// Registers the app's service worker (web/sw.js) and warms its cache.
//
// A separate file rather than an inline <script> because the Content Security
// Policy in web/_headers allows scripts from 'self' only.
//
// The warm-up exists because of a rule that is easy to miss: a service worker
// never controls the page load that registered it. On a first visit the engine
// and the app bundle — the two largest and most essential files — are fetched
// outside its reach, so they are absent from the cache exactly when they are
// needed. Rather than guess their names (they vary: Chromium takes a different
// CanvasKit build from Safari), the page reads back what it actually fetched
// and hands the worker the list.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Service worker registration failed; the app still runs online.', error);
    });

    // Long enough for the engine and the app bundle to have been requested.
    window.setTimeout(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const worker = navigator.serviceWorker.controller || registration.active;
        if (!worker) return;
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(self.location.origin));
        worker.postMessage({ type: 'warm-cache', urls });
      } catch (error) {
        console.warn('Could not warm the offline cache.', error);
      }
    }, 8000);
  });
}
