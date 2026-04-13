/* ═══════════════════════════════════════════════════
   SERVICE WORKER — ZonaEscolar PWA
   
   VERSIONADO POR MÓDULO:
   · Sube solo el número del módulo que cambias.
   · Los demás cachés permanecen intactos.
   · El usuario no pierde la app al actualizar un archivo.
   
   CÓMO ACTUALIZAR:
     - Cambias chat.js     → sube CACHE_CHAT  (v5→v6)
     - Cambias tareas.js   → sube CACHE_TAREAS (v3→v4)
     - Cambias style.css   → sube CACHE_SHELL  (v37→v38)
     - Cambias varios      → sube cada uno individualmente
═══════════════════════════════════════════════════ */

/* ── Versiones por módulo ── */
const CACHE_SHELL   = 'ze-shell-v37';        /* HTML, CSS, manifest, core.js, grupos.js, utils-extra.js */
const CACHE_CHAT    = 'ze-chat-v4';
const CACHE_TAREAS  = 'ze-tareas-v3';
const CACHE_BIBLIO  = 'ze-biblio-v3';
const CACHE_APUNTES = 'ze-apuntes-v2';
const CACHE_MURO    = 'ze-muro-v2';
const CACHE_TABLEROS= 'ze-tableros-v2';
const CACHE_VIDEO   = 'ze-video-v2';
const CACHE_DIN     = 'ze-dinamicas-v2';

/* ── Todos los cachés válidos ── */
const CACHES_VALIDOS = [
  CACHE_SHELL, CACHE_CHAT, CACHE_TAREAS, CACHE_BIBLIO,
  CACHE_APUNTES, CACHE_MURO, CACHE_TABLEROS, CACHE_VIDEO, CACHE_DIN
];

/* ── Archivos por caché ── */
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/core.js',
  './js/grupos.js',
  './js/utils-extra.js',
];

const MODULE_ASSETS = {
  [CACHE_CHAT]:    ['./js/chat.js'],
  [CACHE_TAREAS]:  ['./js/tareas.js'],
  [CACHE_BIBLIO]:  ['./js/biblioteca.js'],
  [CACHE_APUNTES]: ['./js/apuntes.js'],
  [CACHE_MURO]:    ['./js/muro.js'],
  [CACHE_TABLEROS]:['./js/tableros.js'],
  [CACHE_VIDEO]:   ['./js/videotutoriales.js'],
  [CACHE_DIN]:     ['./js/dinamicas.js'],
};

/* ══════════════════════════════════════════
   INSTALL — Pre-cachear todo
══════════════════════════════════════════ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    /* Shell */
    const shellCache = await caches.open(CACHE_SHELL);
    await Promise.allSettled(SHELL_ASSETS.map(u => shellCache.add(u).catch(() => null)));

    /* Módulos */
    await Promise.allSettled(
      Object.entries(MODULE_ASSETS).map(async ([cacheName, assets]) => {
        const cache = await caches.open(cacheName);
        await Promise.allSettled(assets.map(u => cache.add(u).catch(() => null)));
      })
    );
  })());
});

/* ══════════════════════════════════════════
   ACTIVATE — Eliminar cachés obsoletos
══════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !CACHES_VALIDOS.includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════════════
   MESSAGE — Forzar actualización
══════════════════════════════════════════ */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ══════════════════════════════════════════
   FETCH — Network-first para HTML/JS/CSS,
           Cache-first para el resto
══════════════════════════════════════════ */

/** Determina en qué caché vive un asset por su pathname */
function getCacheNameForUrl(url) {
  const p = new URL(url).pathname;
  for (const [cacheName, assets] of Object.entries(MODULE_ASSETS)) {
    if (assets.some(a => p.endsWith(a.replace('./', '/')))) return cacheName;
  }
  return CACHE_SHELL;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url          = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = request.mode === 'navigate';
  const isAppAsset   = isSameOrigin && (
    url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')  || url.pathname.endsWith('.webmanifest')
  );

  /* ── Navegación y assets de la app: Network-first ── */
  if (isNavigation || isAppAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response?.ok && isSameOrigin) {
            const copy      = response.clone();
            const cacheName = getCacheNameForUrl(request.url);
            caches.open(cacheName).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(c => c || caches.match('./index.html'))
        )
    );
    return;
  }

  /* ── Todo lo demás: Cache-first (imágenes, fuentes, etc.) ── */
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response?.ok && isSameOrigin) {
            const copy      = response.clone();
            const cacheName = getCacheNameForUrl(request.url);
            caches.open(cacheName).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => null);
      return cached || networkFetch;
    })
  );
});
