/*
 * Offline support: the app shell is cached on first visit so the survey opens in
 * back rooms with no signal. Network first, cache as fallback, so updates arrive
 * whenever there is a connection. Survey data is in IndexedDB, not this cache.
 */
var CACHE = 'suncor-survey-v1';
var APP = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/vendor/jszip.min.js', 'js/schema.js', 'js/model.js',
  'js/docx-fill.js', 'js/store.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
