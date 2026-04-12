const CACHE_NAME = 'zonaescolar-shell-v34';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css?v=34',
  './manifest.webmanifest',
  './js/core.js?v=34',
  './js/grupos.js?v=34',
  './js/tableros.js?v=34',
  './js/muro.js?v=34',
  './js/chat.js?v=34',
  './js/tareas.js?v=34',
  './js/biblioteca.js?v=34',
  './js/apuntes.js?v=34',
  './js/dinamicas.js?v=34',
  './js/videotutoriales.js?v=34',
  './js/utils-extra.js?v=34'
];

self.addEventListener('install', event => {
  // Activar inmediatamente sin esperar a que se cierren las pestañas anteriores
  self.skipWaiting();
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
          // Clonar ANTES de consumir el body (devolver response)
          if (response?.ok && isSameOrigin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        // Clonar ANTES de consumir el body
        if (response?.ok && isSameOrigin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
        }
        return response;
      }).catch(() => null);
      return cached || networkFetch;
    })
  );
});
