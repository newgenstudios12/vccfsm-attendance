const CACHE = 'vccf-connect-v2';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/vccf-suite.css',
  '/vccf-suite.js',
  '/vccf-ui-refresh.css',
  '/vccf-theme.js',
  '/vccf-config.js',
  '/vccf-logo-black.png',
  '/vccf-logo-white.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Keep navigations fresh so authentication and application state are not
  // accidentally served from an old cached document.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Cache static assets only. Do not cache XHR/fetch responses from the app.
  const isStaticAsset = /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(requestUrl.pathname)
    || requestUrl.pathname === '/manifest.webmanifest';

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
    )
  );
});
