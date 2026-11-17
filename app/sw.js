// Service Worker: hält die App-Dateien offline bereit.
// Bei jeder Änderung an der App VERSION hochzählen, damit die Handys die neue Version holen.
const VERSION = 'mm-v4';
const SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest',
  'js/main.js', 'js/db.js', 'js/seed.js', 'js/texts.js', 'js/contracts.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return; // Daten immer live
  // Eigene Dateien: erst Netz (frisch), bei Funkloch aus dem Cache. Fremde (Schrift, Bibliothek): Cache zuerst.
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    })));
  }
});
