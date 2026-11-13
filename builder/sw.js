/*
 * Offline support. The app's files are cached on first visit, so it opens without
 * a connection. Each request is answered from the cache and refreshed in the
 * background; when a file changed, open pages are told a new version is ready.
 * Bump CACHE only when the file list changes, so stale entries get dropped.
 */
var CACHE = 'levelwright-v4';
var APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/builder.css', 'js/vendor/jszip.min.js',
  'js/data/rules.js', 'js/data/spells.js', 'js/data/classes.js', 'js/engine.js', 'js/fc5.js', 'js/data/srd-content.js',
  'js/content.js', 'js/github.js', 'js/icons.js', 'js/play.js', 'js/gm-rules.js', 'js/gm.js', 'js/advisor.js', 'js/print.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'
];
// Web fonts: the stylesheet is fetched at install, and the font files it names are cached as they load.
// The app falls back to system fonts if they aren't cached yet.
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap';
var CDN = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(APP).then(function () {
      return fetch(FONT_CSS).then(function (res) { if (res.ok) return c.put(FONT_CSS, res); }).catch(function () { /* fonts are optional */ });
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function version(res) { return res && (res.headers.get('etag') || res.headers.get('last-modified') || res.headers.get('content-length')); }
// Several files usually change together: wait for the burst to finish before telling pages.
var notifyTimer = null;
function tellPages() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(function () {
    self.clients.matchAll({ type: 'window' }).then(function (list) { list.forEach(function (c) { c.postMessage({ type: 'updated' }); }); });
  }, 1500);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    var key = req.mode === 'navigate' ? 'index.html' : req;
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(key, { ignoreSearch: true }).then(function (hit) {
        // Revalidate with the server so a changed file is noticed (not just the browser's HTTP cache).
        var fresh = fetch(req, { cache: 'no-cache' }).then(function (res) {
          if (res.ok && res.type === 'basic') {
            // Announce an update only once the new copy is stored.
            var changed = hit && version(hit) && version(res) && version(hit) !== version(res);
            return c.put(key, res.clone()).then(function () { if (changed) tellPages(); return res; });
          }
          return res;
        });
        if (hit) { e.waitUntil(fresh.catch(function () {})); return hit; }
        return fresh;
      });
    }));
  } else if (CDN.test(req.url)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
      });
    }));
  }
});
