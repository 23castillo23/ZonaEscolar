const CACHE_NAME = 'zonaescolar-shell-v9';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.webmanifest'
];

// ── INSTALL: cachea el app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(u => cache.add(u).catch(() => null)))
    )
  );
  // NO llamamos skipWaiting() aquí — esperamos a que el usuario confirme
  // la actualización desde el banner, así evitamos romper sesiones activas.
});

// ── ACTIVATE: limpia caches viejos y toma control de las pestañas ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── MESSAGE: el cliente pide "skipWaiting" cuando el usuario acepta actualizar
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH: Network-first para assets propios, cache-first para el resto ───────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = request.mode === 'navigate';
  const isAppAsset = isSameOrigin && (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest')
  );

  // Assets propios y navegación: Network-first → fallback a cache
  if (isNavigation || isAppAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response?.ok && isSameOrigin) {
            caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(c => c || caches.match('./index.html'))
        )
    );
    return;
  }

  // Resto (imágenes externas, etc.): Cache-first → fallback a network
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response?.ok && isSameOrigin) {
          caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
        }
        return response;
      }).catch(() => null);
      return cached || networkFetch;
    })
  );
});
