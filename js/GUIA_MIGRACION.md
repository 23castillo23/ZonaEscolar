# Guía de migración — ZonaEscolar AppState v2

## Qué cambió en core.js

El `core.js` actual introduce `AppState`, un objeto central que reemplaza las ~60 variables globales sueltas.  
**Todos los módulos no migrados siguen funcionando sin cambiar nada** porque cada variable suelta (`currentGroupId`, `isAdmin`, etc.) ahora es un *proxy* que lee y escribe en `AppState` automáticamente.

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
  recargarMiModulo(nuevoId);
});
cancelar(); // para dejar de escuchar

// Cancelar un unsub de Firestore guardado en el estado
AppState.unsub('bibliotecaUnsub');
// equivale a: if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
```

---

## Estado actual de la migración

### ✅ `biblioteca.js` — Completo

Variables propias migradas: `biblioCategorias`, `bibliotecaUiBound`, `selectedBiblioColor`, `bibliotecaUnsub`, `catBiblioUnsub`.  
Eventos: `AppState.on('currentGroupId')` cancela listeners y resetea UI al cambiar de grupo.  
`window.eliminarLibro` / `window.eliminarCategoria` se mantienen por compatibilidad, pero la lógica real ya vive en delegación de eventos (`data-action`).

### ✅ `tareas.js` — Completo

Variables propias migradas: `tareasUnsub`, `votacionUnsub`, `tareasFilter`, `tareasVistaCalendario`, `calDiaSeleccionado`.  
`AppState.on('currentGroupId')` cancela listeners y resetea estado al cambiar de grupo.

### ⚙️ `chat.js` — Parcial

Algunos unsubs usan AppState. Aún quedan múltiples `window.*` y variables locales sueltas. Ver lista completa en MODULOS.md.

### ⚙️ `muro.js` — Parcial

Un `AppState.set` presente. El resto sigue en variables globales heredadas.

### ⏳ Pendientes

`apuntes.js`, `dinamicas.js`, `grupos.js`, `tableros.js`, `videotutoriales.js`

---

## Migrar un módulo — paso a paso

### Ejemplo basado en `biblioteca.js` (ya migrado)

**ANTES (problemático)**
```js
function initBiblioteca() {
  if (!currentGroupId) return;           // lee variable global directa
  bibliotecaUiBound = true;              // escribe variable global directa
}

function loadBiblioCategorias() {
  if (catBiblioUnsub) { catBiblioUnsub(); catBiblioUnsub = null; }  // cancelación manual
  catBiblioUnsub = onSnapshot(...);      // guarda unsub en global
}
```

**DESPUÉS (limpio)**
```js
AppState.on('currentGroupId', (nuevoId) => {
  AppState.unsub('bibliotecaUnsub');
  AppState.unsub('catBiblioUnsub');
  AppState.set('bibliotecaUiBound', false);
});

function initBiblioteca() {
  if (!AppState.get('currentGroupId')) return;

  if (!AppState.get('bibliotecaUiBound')) {
    AppState.set('bibliotecaUiBound', true);
    // registrar listeners de UI solo una vez por grupo
  }
  loadBiblioCategorias();
}

function loadBiblioCategorias() {
  AppState.unsub('catBiblioUnsub');  // una sola línea
  AppState.set('catBiblioUnsub', onSnapshot(...));
}
```

---

## Eliminar `window.*` — delegación de eventos

Actualmente varios módulos exponen funciones en `window` para ser llamadas desde HTML inline.

**El patrón problemático:**
```html
<!-- En el HTML generado -->
<button onclick="eliminarLibro('abc123')">✕</button>
```
```js
// En el módulo
window.eliminarLibro = function(id) { ... }
```

**El patrón limpio (delegación):**
```html
<!-- En el HTML generado -->
<button data-action="eliminar-libro" data-id="abc123">✕</button>
```
```js
// En el módulo — un solo listener que cubre todos los botones
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action="eliminar-libro"]');
  if (!btn) return;
  eliminarLibroLocal(btn.dataset.id);
});
```

Esto elimina las dependencias en `window` y hace que cada módulo sea completamente autónomo.

> **Nota:** Las funciones de `core.js` en `window` (`showToast`, `showConfirm`, `getUserAlias`, `friendlyError`) son utilidades globales compartidas y **no se deben eliminar**.

---

## Migración por módulo — variables que le pertenecen a cada uno

### `grupos.js`
```js
// Variables propias a migrar:
AppState.get/set/unsub('gruposUnsub')
AppState.get/set('grupos')

// Shared — ya manejados por proxies (no tocar):
// currentGroupId, currentGroupData, isAdmin
```

### `chat.js`
```js
// Variables propias a migrar:
AppState.get/set/unsub('chatUnsub')
AppState.get/set/unsub('salasUnsub')
AppState.get/set/unsub('chatOnlineUnsub')
AppState.get/set('currentSalaId')
AppState.get/set('chatOldestDoc')
AppState.get/set('chatHayMas')
AppState.get/set('chatCargandoMas')
AppState.get/set('chatLastReadMs')
AppState.get/set('salaChatColorSeleccionado')
AppState.get/set('salaChatEmojiSeleccionado')

// Suscribirse al cambio de grupo:
AppState.on('currentGroupId', (id) => {
  AppState.unsub('chatUnsub');
  AppState.unsub('salasUnsub');
  if (id) initSalasChat();
});
```

### `tareas.js` ✅ ya migrado
```js
AppState.get/set/unsub('tareasUnsub')
AppState.get/set/unsub('votacionUnsub')
AppState.get/set('tareasFilter')
AppState.get/set('tareasVistaCalendario')
AppState.get/set('calDiaSeleccionado')
```

### `biblioteca.js` ✅ ya migrado
```js
AppState.get/set/unsub('bibliotecaUnsub')
AppState.get/set/unsub('catBiblioUnsub')
AppState.get/set('biblioCategorias')
AppState.get/set('bibliotecaUiBound')
AppState.get/set('selectedBiblioColor')
```

### `apuntes.js`
```js
AppState.get/set/unsub('semestresUnsub')
AppState.get/set/unsub('galeriasUnsub')
AppState.get/set('semestres')
AppState.get/set('galerias')
AppState.get/set('galeriaActual')
AppState.get/set('apunteFiles')
AppState.get/set('semestresAbiertos')
AppState.get/set('scrollPosicionApuntes')
AppState.get/set('ordenSemestres')
AppState.get/set('ordenMaterias')
AppState.get/set('apuntesSearchTerm')
```

### `muro.js`
```js
AppState.get/set/unsub('muroFeedUnsub')
AppState.get/set/unsub('muroFotosUnsub')
AppState.get/set/unsub('muroAlbumsUnsub')
AppState.get/set('muroAlbumActualId')
AppState.get/set('muroAlbumsCache')
```

### `tableros.js`
```js
AppState.get/set/unsub('tablerosUnsub')
AppState.get/set/unsub('tableroFeedUnsub')
AppState.get/set/unsub('feedUnsub')
AppState.get/set('currentTableroId')
AppState.get/set('dentroDeTablero')
AppState.get/set('feedOldestDoc')
AppState.get/set('feedHayMas')
AppState.get/set('feedCargandoMas')
```

### `dinamicas.js`
```js
AppState.get/set/unsub('votacionUnsub')
AppState.get/set('ruletaMiembros')
AppState.get/set('ruletaAngulo')
AppState.get/set('ruletaSpinning')
AppState.get/set('triviaBanco')
AppState.get/set('triviaIdx')
AppState.get/set('triviaScore')
AppState.get/set('puntosMarcador')
```

### `videotutoriales.js`
```js
// dvdUnsub está declarado localmente en el módulo — está bien así.
// Solo migrar si se detecta que causa problemas al cambiar de grupo.
```

---

## Orden sugerido de migración

De menor a mayor impacto:

1. ✅ **`biblioteca.js`** — completado
2. ✅ **`tareas.js`** — completado
3. **`videotutoriales.js`** — completamente independiente, fácil
4. **`dinamicas.js`** — estado local, no comparte con nadie
5. **`apuntes.js`** — comparte `galeriasUnsub` con muro, considerar migrar junto
6. **`muro.js`** — migrar con apuntes
7. **`chat.js`** — más complejo por la burbuja y las salas
8. **`tableros.js`** — depende del feed, migrar al final
9. **`grupos.js`** — el orquestador, migrar al final de todo

---

## Verificar que funciona tras cada migración

Después de migrar un módulo, verifica:

- [ ] Al entrar a esa sección, carga correctamente
- [ ] Al cambiar de grupo, la sección se recarga limpia (sin datos del grupo anterior)
- [ ] Al hacer logout y login, no quedan listeners colgados
- [ ] En móvil (Chrome DevTools → modo dispositivo), el layout no se rompe
- [ ] Los botones de borrar/editar siguen funcionando (delegación de eventos ok)

Si algo falla, el problema es en el módulo que acabas de migrar — ningún otro debería verse afectado.

---

## Service Worker — caché modular (ya implementado)

El `sw.js` actual ya usa caché por módulo. Cada módulo tiene su propia constante:

```js
const CACHE_SHELL    = 'ze-shell-v47';   // subir al cambiar: index.html, style.css, core.js, grupos.js, utils-extra.js
const CACHE_CHAT     = 'ze-chat-v5';     // subir al cambiar: chat.js
const CACHE_TAREAS   = 'ze-tareas-v4';   // subir al cambiar: tareas.js
const CACHE_BIBLIO   = 'ze-biblio-v3';   // subir al cambiar: biblioteca.js
const CACHE_APUNTES  = 'ze-apuntes-v3';  // subir al cambiar: apuntes.js
const CACHE_MURO     = 'ze-muro-v3';     // subir al cambiar: muro.js
const CACHE_TABLEROS = 'ze-tableros-v2'; // subir al cambiar: tableros.js
const CACHE_VIDEO    = 'ze-video-v2';    // subir al cambiar: videotutoriales.js
const CACHE_DIN      = 'ze-dinamicas-v3';// subir al cambiar: dinamicas.js
```

Al cambiar solo `chat.js`, solo subes `CACHE_CHAT` de v5 a v6. El resto del caché permanece intacto.
