# Guía de migración — ZonaEscolar AppState

## Qué cambió en core.js

El nuevo `core.js` introduce `AppState`, un objeto central que reemplaza las ~60 variables globales sueltas.  
**Todos los módulos siguen funcionando sin cambiar nada** porque cada variable suelta (`currentGroupId`, `isAdmin`, etc.) ahora es un *proxy* que lee y escribe en `AppState` automáticamente.

Cuando quieras mejorar un módulo, sigue el patrón de migración de abajo.

---

## Las 3 reglas de la arquitectura nueva

```
1. Un módulo NUNCA lee variables de otro módulo directamente.
2. Todo pasa por AppState.get() / AppState.set().
3. Para reaccionar a cambios usa AppState.on() o el evento 'ze:stateChange'.
```

---

## API de AppState

```js
// Leer un valor
AppState.get('currentGroupId')          // → string | null

// Escribir un valor (notifica automáticamente a todos los suscriptores)
AppState.set('currentGroupId', grupoId)

// Escuchar cambios de UNA clave
const cancelar = AppState.on('currentGroupId', (nuevoId) => {
  // se ejecuta cada vez que currentGroupId cambia
  recargarMiModulo(nuevoId);
});
cancelar(); // para dejar de escuchar

// Cancelar un unsub de Firestore guardado en el estado
AppState.unsub('bibliotecaUnsub');
// equivale a: if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
```

---

## Migrar un módulo — paso a paso

### Ejemplo: biblioteca.js

**ANTES (problemático)**
```js
function initBiblioteca() {
  if (!currentGroupId) return;           // lee variable global directa
  // ...
  bibliotecaUiBound = true;              // escribe variable global directa
}

function loadBiblioCategorias() {
  if (catBiblioUnsub) { catBiblioUnsub(); catBiblioUnsub = null; }  // cancela unsub manual
  // ...
  catBiblioUnsub = onSnapshot(...);      // guarda unsub en global
}
```

**DESPUÉS (limpio)**
```js
function initBiblioteca() {
  if (!AppState.get('currentGroupId')) return;      // ← AppState.get
  // ...
  AppState.set('bibliotecaUiBound', true);          // ← AppState.set
}

function loadBiblioCategorias() {
  AppState.unsub('catBiblioUnsub');                 // ← AppState.unsub (una sola línea)
  // ...
  AppState.set('catBiblioUnsub', onSnapshot(...));  // ← AppState.set
}

// Reaccionar cuando el grupo cambia
AppState.on('currentGroupId', (nuevoId) => {
  if (nuevoId) loadBiblioCategorias();
});
```

---

## Migración por módulo (qué variables le pertenecen a cada uno)

### grupos.js
Variables propias que puede migrar primero:
- `gruposUnsub` → `AppState.get/set/unsub('gruposUnsub')`
- `grupos` → `AppState.get/set('grupos')`

Variables compartidas que YA maneja vía AppState (los proxies las interceptan):
- `currentGroupId`, `currentGroupData`, `isAdmin`

### chat.js
Variables propias:
- `chatUnsub`, `salasUnsub`, `chatOnlineUnsub`
- `currentSalaId`, `chatOldestDoc`, `chatHayMas`, `chatCargandoMas`
- `chatLastReadMs`, `salaChatColorSeleccionado`, `salaChatEmojiSeleccionado`

Suscribirse al cambio de grupo:
```js
AppState.on('currentGroupId', (id) => {
  if (id) initSalasChat();
});
```

### tareas.js
Variables propias:
- `tareasUnsub`, `votacionUnsub`
- `tareasFilter`, `tareasVistaCalendario`
- `calDiaSeleccionado`, `calMesOffset`

### biblioteca.js
Variables propias:
- `bibliotecaUnsub`, `catBiblioUnsub`
- `biblioCategorias`, `bibliotecaUiBound`, `selectedBiblioColor`

### apuntes.js
Variables propias:
- `semestresUnsub`, `galeriasUnsub`
- `semestres`, `galerias`, `galeriaActual`, `apunteFiles`
- `semestresAbiertos`, `scrollPosicionApuntes`
- `ordenSemestres`, `ordenMaterias`, `apuntesSearchTerm`

### muro.js
Variables propias:
- `muroFeedUnsub`, `muroFotosUnsub`, `muroAlbumsUnsub`
- `muroAlbumActualId`, `muroAlbumsCache`

### tableros.js
Variables propias:
- `tablerosUnsub`, `tableroFeedUnsub`
- `currentTableroId`, `dentroDeTablero`
- `feedUnsub`, `feedOldestDoc`, `feedHayMas`, `feedCargandoMas`

### dinamicas.js
Variables propias:
- `votacionUnsub`
- `ruletaMiembros`, `ruletaAngulo`, `ruletaSpinning`
- `triviaBanco`, `triviaIdx`, `triviaScore`, `puntosMarcador`

### videotutoriales.js
Variables propias:
- `dvdUnsub` (declarada localmente en el módulo, está bien)

---

## Eliminar window.* — el otro problema grande

Actualmente `biblioteca.js`, `chat.js` y `tareas.js` exponen funciones en `window`:

```js
window.eliminarLibro = function(id) { ... }
window.abrirSalaChat = function(salaId, ...) { ... }
window.toggleTarea   = function(id, ...) { ... }
```

Estas se llaman desde HTML inline (`onclick="eliminarLibro('...')`).

**La alternativa limpia** es usar delegación de eventos:

```js
// En biblioteca.js — en vez de window.eliminarLibro
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action="eliminar-libro"]');
  if (!btn) return;
  eliminarLibro(btn.dataset.id);
});

// En el HTML generado — en vez de onclick="eliminarLibro('...')"
`<button data-action="eliminar-libro" data-id="${it.id}">✕</button>`
```

Esto elimina las dependencias en `window` y hace que cada módulo sea completamente independiente.

---

## Service Worker — versionado por módulo

Actualmente un solo número de versión invalida TODO el caché:
```js
const CACHE_NAME = 'zonaescolar-shell-v36';  // cambia uno → borra todo
```

**La mejora** es un caché por módulo:
```js
// sw.js
const CACHE_SHELL   = 'ze-shell-v37';    // HTML, CSS, manifest
const CACHE_CHAT    = 'ze-chat-v4';      // solo cuando chat.js cambia
const CACHE_BIBLIO  = 'ze-biblio-v2';    // solo cuando biblioteca.js cambia
const CACHE_TAREAS  = 'ze-tareas-v3';
// ...

const CACHES_VALIDOS = [CACHE_SHELL, CACHE_CHAT, CACHE_BIBLIO, CACHE_TAREAS];

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !CACHES_VALIDOS.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
```

Así cuando solo cambias `chat.js`, solo subes `CACHE_CHAT` de v4 a v5. El resto del caché se mantiene intacto y el usuario no pierde la app.

---

## Orden sugerido de migración

Hazlo de menor a mayor impacto:

1. **biblioteca.js** — más aislado, pocas dependencias
2. **tareas.js** — sin conexión con chat ni muro
3. **videotutoriales.js** — completamente independiente
4. **dinamicas.js** — estado local, no comparte con nadie
5. **apuntes.js** — comparte `galeriasUnsub` con muro, migrarlo junto
6. **muro.js** — migrar con apuntes
7. **chat.js** — más complejo por la burbuja y las salas
8. **tableros.js** — depende del feed, migrar al final
9. **grupos.js** — el orquestador, migrar al final de todo

---

## Verificar que funciona tras cada cambio

Después de migrar un módulo, verifica:
- [ ] Al entrar a esa sección, carga correctamente
- [ ] Al cambiar de grupo, la sección se recarga limpia
- [ ] Al hacer logout y login, no quedan listeners colgados
- [ ] En móvil (Chrome DevTools → modo dispositivo), el layout no se rompe

Si algo falla, el problema es en el módulo que acabas de migrar — ningún otro debería verse afectado.
