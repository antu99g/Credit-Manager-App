const CACHE_NAME = "credit-app-v4";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.png",
];

// Install: Force the new service worker to take over immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
});

// Activate: Delete any old, outdated caches instantly
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch: "NETWORK FIRST" Strategy for 100% Accuracy
self.addEventListener("fetch", (event) => {
  // Never intercept API calls to Google Sheets
  if (event.request.url.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If internet works, save the newest version and show it
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If offline (no internet), fall back to the last known cache
        return caches.match(event.request);
      }),
  );
});
