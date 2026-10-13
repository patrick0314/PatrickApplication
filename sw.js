const CACHE_NAME = 'my-app-v34';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/vendor/mqtt.min.js',
  './js/storage.js',
  './js/app.js',
  './js/modules/dashboard.js',
  './js/modules/werewolf.js',
  './js/modules/codenames.js',
  './js/modules/arthur.js',
  './js/modules/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/roles/card_icon.svg',
  './icons/roles/card_back.svg',
  './icons/roles/werewolf.svg',
  './icons/roles/minion.svg',
  './icons/roles/mason.svg',
  './icons/roles/seer.svg',
  './icons/roles/robber.svg',
  './icons/roles/troublemaker.svg',
  './icons/roles/drunk.svg',
  './icons/roles/insomniac.svg',
  './icons/roles/hunter.svg',
  './icons/roles/villager.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
