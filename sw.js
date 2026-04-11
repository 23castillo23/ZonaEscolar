const CACHE_NAME = 'zonaescolar-shell-v22';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/core.js',
  './js/grupos.js',
  './js/tableros.js',
  './js/muro.js',
  './js/chat.js',
  './js/tareas.js',
  './js/biblioteca.js',
  './js/apuntes.js',
  './js/dinamicas.js',
  './js/videotutoriales.js',
  './js/utils-extra.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(u => cache.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = request.mode === 'navigate';
  const isAppAsset = isSameOrigin && (
    url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') || url.pathname.endsWith('.webmanifest')
  );
  if (isNavigation || isAppAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response?.ok && isSameOrigin)
            caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response?.ok && isSameOrigin)
          caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
        return response;
      }).catch(() => null);
      return cached || networkFetch;
    })
  );
});
