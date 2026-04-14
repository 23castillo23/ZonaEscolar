# Estructura de módulos — ZonaEscolar JS

Los archivos se cargan en este orden en `index.html` (todos con `?v=36`).  
Cada uno depende del anterior — las APIs de `core.js` las usan todos.

---

## Orden de carga y responsabilidad

| Archivo              | Líneas | Qué hace                                              |
|----------------------|--------|-------------------------------------------------------|
| `core.js`            | ~839   | **AppState** (fuente única de verdad), Firebase init, Auth Google, utilidades globales (`escHtml`, `fmtTime`, `showToast`, `showConfirm`, `getUserAlias`, `uploadToCloudinary`, `limpiarLinkDrive`), tema oscuro/claro |
| `grupos.js`          | ~673   | Crear/cambiar/abandonar grupos, invitar/expulsar miembros, sidebar de integrantes, **navegación global** (`activarSeccion`, `setActiveNav`), auto-activar grupo al reingresar |
| `tableros.js`        | ~1827  | Tableros (galería + feed), tarjetas, comentarios, likes, chinchetas, publicar, quitar del tablero |
| `muro.js`            | ~801   | Muro personal y ajeno, álbumes, fotos, `initMuro`, `cargarMuroFotos`, publicar foto del muro al feed |
| `chat.js`            | ~836   | Chat en tiempo real, salas, imágenes, typing, online, burbuja flotante |
| `tareas.js`          | ~343   | Crear/completar/filtrar tareas, subtareas. **Sin calendario.** Migrado a AppState. |
| `biblioteca.js`      | ~290   | Biblioteca de archivos PDF/links, repisas (categorías). Migrado a AppState + delegación de eventos. |
| `apuntes.js`         | ~774   | Semestres, materias/galerías, fotos de pizarrón, búsqueda de apuntes, notas de materia |
| `dinamicas.js`       | ~1967  | Ruleta, votación (sin autopublicar), trivia (Firestore), puntos, lightbox, compartir al tablero |
| `videotutoriales.js` | ~730   | Cajas DVD, comentarios de video, compartir al tablero |
| `utils-extra.js`     | ~421   | Selector de tablero, fix teclado iOS, compartir libro/DVD, `abrirModalLibro`, resize |

---

## Qué archivo tocar según lo que quieras cambiar

| Qué quieres cambiar | Archivo |
|---|---|
| Chat (mensajes, salas, burbuja) | `chat.js` |
| Barra de online del chat (visual) | `style.css` → `.chat-online-bar` |
| Muro (fotos, álbumes, perfil) | `muro.js` |
| Tareas (lista, subtareas, filtros) | `tareas.js` |
| Feed o tarjetas del tablero | `tableros.js` |
| Estado global (AppState, currentUser, currentGroupId) | `core.js` |
| Subir archivos a Cloudinary | `core.js` — función `uploadToCloudinary()` |
| "Compartir al tablero" desde biblioteca/videotutoriales | `utils-extra.js` |
| Abrir modal de detalle de un libro | `utils-extra.js` — función `abrirModalLibro()` |
| Votaciones o trivias | `dinamicas.js` |
| Ruleta o marcador de puntos | `dinamicas.js` |
| Navegación entre secciones | `grupos.js` — `activarSeccion()` y `setActiveNav()` |
| Agregar/reingresar miembros al grupo | `grupos.js` — `loadGruposDelUsuario()` |
| Layout responsive móvil | `style.css` → `@media (max-width: 768px)` |
| Grid de VideoTutoriales | `style.css` → `.dvd-shell` |
| Caché del Service Worker | `sw.js` — subir el número del caché del módulo que cambió |

---

## Estado de migración a AppState

| Módulo | Estado | Notas |
|---|---|---|
| `biblioteca.js` | ✅ Completo | AppState + delegación de eventos (sin `window.*`) |
| `tareas.js` | ✅ Completo | AppState + `AppState.on('currentGroupId')` |
| `chat.js` | ⚙️ Parcial | Usa AppState para algunos unsubs |
| `muro.js` | ⚙️ Parcial | Un `AppState.set`, resto en variables globales |
| `apuntes.js` | ⏳ Pendiente | Usa variables globales y `window.*` |
| `dinamicas.js` | ⏳ Pendiente | Usa variables globales y `window.*` |
| `grupos.js` | ⏳ Pendiente | Orquestador principal, migrar al final |
| `tableros.js` | ⏳ Pendiente | Depende del feed, migrar cerca del final |
| `videotutoriales.js` | ⏳ Pendiente | Listener local (`dvdUnsub`), más aislado |

Ver `GUIA_MIGRACION.md` para el proceso completo.

---

## Funciones globales (`window.*`) aún presentes

Estas funciones se llaman desde HTML inline. Se deben migrar a delegación de eventos.

| Función | Módulo | Prioridad |
|---|---|---|
| `window.eliminarLibro` | `biblioteca.js` | Mantener por compatibilidad (ya hay delegación) |
| `window.eliminarCategoria` | `biblioteca.js` | Mantener por compatibilidad (ya hay delegación) |
| `window.abrirSalaChat` | `chat.js` | Alta |
| `window.eliminarSalaActiva` | `chat.js` | Alta |
| `window.eliminarSala` | `chat.js` | Alta |
| `window.abrirModalNuevaSala` | `chat.js` | Alta |
| `window.eliminarMensaje` | `chat.js` | Alta |
| `window.openChatImgLightbox` | `chat.js` | Media |
| `window.toggleOrdenMaterias` | `apuntes.js` | Media |
| `window.toggleSemestre` | `apuntes.js` | Media |
| `window.abrirGaleria` | `apuntes.js` | Media |
| `window.eliminarFotoApunte` | `apuntes.js` | Media |
| `window.publicarFotoEnFeed` | `apuntes.js` | Media |
| `window.openLightbox` | `dinamicas.js` | Media |
| `window.abrirVistaVotacion` | `dinamicas.js` | Media |
| `window.getUserAlias` | `core.js` | Mantener (usada por múltiples módulos) |
| `window.showToast` | `core.js` | Mantener (utilidad global) |
| `window.showConfirm` | `core.js` | Mantener (utilidad global) |
| `window.friendlyError` | `core.js` | Mantener (utilidad global) |

---

## Lo que se reorganizó / eliminó (historial)

| Qué se movió / eliminó | De | A | Por qué |
|---|---|---|---|
| `initMuro()`, `cargarMuroFotos()` | `chat.js` | `muro.js` | La lógica del muro no tiene nada que ver con el chat |
| `uploadToCloudinary()` | `apuntes.js` | `core.js` | La usan 5 módulos distintos |
| `renderCalMes()`, `calNavegar()`, `calVerDia()`, `resetVistaCalendario()` | `tareas.js` + `biblioteca.js` | **Eliminadas** | Calendario quitado por problemas en móvil (v1.7.0) |
| `renderCalendarioTareas()` | `biblioteca.js` | **Eliminada** | Función huérfana (v1.6.2) |
| `_calTareasCache`, `calMesOffset`, `calDiaSeleccionado`, `tareasVistaCalendario` | `core.js` / `tareas.js` | **Eliminadas** | Sin calendario (v1.7.0) |
| Botón `📅 Calendario` | `index.html` | **Eliminado** | Acompañó la eliminación del calendario (v1.7.0) |
| `muroAlbumActualId`, `muroAlbumsCache` | `chat.js` + `muro.js` (duplicadas) | `core.js` (única) | Evitar estado inconsistente (v1.6.3) |

---

## Flujo de votaciones y trivias

- **Crear** → se guarda en `ec_votaciones` / `ec_trivias`. **No se publica automáticamente.**
- **Compartir** (botón 📌) → abre selector de tablero → publica en `ec_feed` con el tablero elegido.
- **Quitar del tablero** → solo borra el post del feed, la votación/trivia sigue en Dinámicas.
- **Eliminar definitivamente** → desde Dinámicas → botón 🗑️ Eliminar (solo creador o admin).

---

## Flujo de miembros (invitar / expulsar / reingresar)

- **Invitar** → Admin escribe correo Gmail exacto + nombre → se agrega al array `miembros` del grupo en Firestore.
- **El correo debe coincidir exactamente** con el que usa el compañero para iniciar sesión con Google.
- **Expulsar** → botón ✕ en sidebar → se quita del array `miembros` → el listener detecta el cambio y muestra pantalla de expulsado en tiempo real.
- **Reingresar** → Admin lo vuelve a agregar → `loadGruposDelUsuario` detecta el nuevo grupo y lo activa automáticamente sin recargar la página.

---

## Barra de usuarios online (Chat)

- La barra `.chat-online-bar` es **invisible cuando no hay compañeros conectados** (height 0, sin borde).
- Cuando hay otros usuarios en la sala, `chat.js` activa `.chat-online-list` en `display:flex` y la barra aparece con sus píldoras verdes.
- El sistema de presencia (`ec_online`, heartbeat cada 25s) sigue activo en segundo plano.
- Para modificar el estilo: `style.css` → `.chat-online-bar` y `.chat-online-pill`.

---

## Versiones del caché por módulo (sw.js)

| Constante | Versión actual | Archivos que cubre |
|---|---|---|
| `CACHE_SHELL` | v47 | `index.html`, `style.css`, `manifest.webmanifest`, `core.js`, `grupos.js`, `utils-extra.js` |
| `CACHE_CHAT` | v5 | `chat.js` |
| `CACHE_TAREAS` | v4 | `tareas.js` |
| `CACHE_BIBLIO` | v3 | `biblioteca.js` |
| `CACHE_APUNTES` | v3 | `apuntes.js` |
| `CACHE_MURO` | v3 | `muro.js` |
| `CACHE_TABLEROS` | v2 | `tableros.js` |
| `CACHE_VIDEO` | v2 | `videotutoriales.js` |
| `CACHE_DIN` | v3 | `dinamicas.js` |

---

## Colecciones Firestore activas

| Colección             | Usado en          | Descripción                                      |
|-----------------------|-------------------|--------------------------------------------------|
| `ec_users`            | core, grupos      | Perfil de cada usuario (nombre, email, avatar)   |
| `ec_grupos`           | grupos            | Grupos escolares (nombre, admin, miembros)        |
| `ec_feed`             | tableros          | Publicaciones del feed                           |
| `ec_comentarios`      | tableros          | Comentarios de publicaciones del feed            |
| `ec_tableros`         | tableros          | Tableros temáticos del grupo                     |
| `ec_chat`             | chat              | Mensajes del chat grupal por sala                |
| `ec_salas_chat`       | chat              | Salas de chat creadas por el grupo               |
| `ec_chat_reads`       | chat              | Marca de último mensaje leído por usuario        |
| `ec_typing`           | chat              | Indicador "está escribiendo…" en tiempo real     |
| `ec_online`           | chat              | Presencia online de usuarios                     |
| `ec_tareas`           | tareas            | Tareas del grupo con responsable y fecha         |
| `ec_semestres`        | apuntes           | Semestres dentro de Apuntes                      |
| `ec_galerias`         | apuntes           | Materias/galerías dentro de un semestre          |
| `ec_fotos`            | apuntes           | Fotos de apuntes subidas a una galería           |
| `ec_notas`            | apuntes           | Notas de materia por usuario                     |
| `ec_muro_fotos`       | muro              | Fotos del muro personal de cada usuario          |
| `ec_muro_albums`      | muro              | Álbumes del muro personal de cada usuario        |
| `ec_biblioteca`       | biblioteca        | Archivos PDF/links de la biblioteca              |
| `ec_biblio_categorias`| biblioteca        | Repisas (categorías) de la biblioteca            |
| `ec_videotutoriales`  | videotutoriales   | Videos tutoriales del grupo                      |
| `ec_votaciones`       | dinamicas         | Votaciones (no se autopublican en el feed)       |
| `ec_trivias`          | dinamicas         | Trivias guardadas con sus preguntas              |

---

## Regla para hacer cambios

Antes de tocar cualquier archivo, pregúntate:

1. **¿Qué sección visual afecta?** → ese es el archivo
2. **¿Afecta a VARIOS módulos?** → va en `core.js` o `utils-extra.js`
3. **¿Es navegación?** → va en `grupos.js`
4. **¿Es responsive/visual?** → va en `style.css`, sección correspondiente

## Cuándo subir cambios

Solo sube el archivo que modificaste + `sw.js` incrementando el número del caché del módulo:

```js
// sw.js — subir solo el caché del módulo cambiado
const CACHE_CHAT = 'ze-chat-v5';  // ← si cambiaste chat.js, sube a v6
```

Y actualiza el `?v=` del script en `index.html`:
```html
<script src="js/chat.js?v=37"></script>  ← incrementar versión
```
