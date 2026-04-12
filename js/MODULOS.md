# Estructura de módulos — ZonaEscolar JS

Los archivos se cargan en este orden en index.html.
Cada uno depende del anterior (las variables globales de core.js las usan todos).

---

## Orden de carga y responsabilidad

| Archivo              | Líneas | Qué hace                                              |
|----------------------|--------|-------------------------------------------------------|
| `core.js`            | ~605   | Estado global, utilidades (escHtml, fmtTime…), tema oscuro/claro, Firebase Auth, **uploadToCloudinary** |
| `grupos.js`          | ~580   | Crear/cambiar/abandonar grupos, invitar miembros, sidebar de integrantes, **navegación global (activarSeccion, setActiveNav)**, **auto-activar grupo al ser reingresado** |
| `tableros.js`        | ~1792  | Tableros (galería + feed), tarjetas, comentarios, likes, chinchetas, publicar, quitar votación del tablero |
| `muro.js`            | ~767   | Muro personal y ajeno, álbumes, fotos, **initMuro**, cargarMuroFotos, publicarFotoMuroAlFeed |
| `chat.js`            | ~941   | Chat en tiempo real, salas, imágenes, typing, online, burbuja flotante |
| `tareas.js`          | ~380   | Crear/completar/filtrar tareas, subtareas. **Calendario eliminado.** |
| `biblioteca.js`      | ~229   | Biblioteca de archivos, categorías, compartir al tablero |
| `apuntes.js`         | ~760   | Semestres, materias/galerías, fotos de pizarrón, notas de materia |
| `dinamicas.js`       | ~1831  | Ruleta, votación (sin autopublicar), trivia (guardada en Firestore), puntos, lightbox, compartir al tablero |
| `videotutoriales.js` | ~720   | Cajas DVD, comentarios de video, compartir al tablero |
| `utils-extra.js`     | ~439   | Selector de tablero, fix de teclado iOS, compartir libro/DVD, resize |

---

## Qué archivo tocar según lo que quieras cambiar

| Qué quieres cambiar | Archivo |
|---|---|
| Chat (mensajes, salas, burbuja) | `chat.js` |
| Barra de online del chat (visual) | `style.css` → `.chat-online-bar` |
| Muro (fotos, álbumes, perfil) | `muro.js` |
| Tareas (lista, subtareas, filtros) | `tareas.js` |
| Feed o tarjetas del tablero | `tableros.js` |
| Variables globales (currentUser, currentGroupId) | `core.js` |
| Subir archivos a Cloudinary | `core.js` — función `uploadToCloudinary()` |
| "Compartir al tablero" desde biblioteca/videotutoriales | `utils-extra.js` |
| Votaciones o trivias | `dinamicas.js` |
| Navegación entre secciones | `grupos.js` — funciones `activarSeccion()` y `setActiveNav()` |
| Agregar/reingresar miembros al grupo | `grupos.js` — función `loadGruposDelUsuario()` |
| Layout responsive móvil | `style.css` → `@media (max-width: 768px)` |
| Grid de VideoTutoriales | `style.css` → `.dvd-shell` |

---

## Lo que se reorganizó / eliminó (historial)

| Qué se movió / eliminó | De | A | Por qué |
|---|---|---|---|
| `initMuro()`, `cargarMuroFotos()`, etc. | `chat.js` | `muro.js` | La lógica del muro no tiene nada que ver con el chat |
| `renderCalMes()`, `calNavegar()`, `calVerDia()`, `resetVistaCalendario()` | `biblioteca.js` | `tareas.js` | El calendario es parte de Tareas, no de Biblioteca |
| `uploadToCloudinary()` | `apuntes.js` | `core.js` | La usan 5 módulos distintos |
| **Calendario de tareas completo** | `tareas.js` + `index.html` | **Eliminado** | El usuario decidió quitarlo por problemas de adaptación en móvil |
| `_calTareasCache`, `calMesOffset`, `calDiaSeleccionado`, `tareasVistaCalendario` | `tareas.js` / `core.js` | **Eliminadas** | Ya no se necesitan sin el calendario |
| Botón `📅 Calendario` | `index.html` | **Eliminado** | Acompañó la eliminación del calendario |

---

## Flujo de votaciones y trivias

- **Crear** → se guarda en `ec_votaciones` / `ec_trivias`. **No se publica automáticamente.**
- **Compartir** (botón 📌) → abre selector de tablero → publica en `ec_feed` con el tablero elegido.
- **Quitar del tablero** → solo borra el post del feed, la votación/trivia sigue en Dinámicas.
- **Eliminar definitivamente** → desde Dinámicas → Votaciones/Trivia → botón 🗑️ Eliminar.

---

## Flujo de miembros (invitar / expulsar / reingresar)

- **Invitar** → Admin escribe correo Gmail exacto + nombre → se agrega al array `miembros` del grupo en Firestore.
- **El correo debe coincidir exactamente** con el que usa el compañero para iniciar sesión con Google.
- **Expulsar** → botón ✕ en sidebar → se quita del array `miembros` → el listener detecta el cambio y muestra pantalla de expulsado en tiempo real.
- **Reingresar** → Admin lo vuelve a agregar con el mismo correo → el listener en `loadGruposDelUsuario` detecta el nuevo grupo y lo activa automáticamente sin necesidad de recargar la página.

---

## Barra de usuarios online (Chat)

- La barra `.chat-online-bar` existe en el HTML pero **es invisible cuando no hay compañeros conectados** (height 0, sin borde).
- Cuando hay otros usuarios en la sala, `chat.js` pone `.chat-online-list` en `display:flex` y la barra aparece con sus píldoras verdes.
- El sistema de presencia (`ec_online`, heartbeat cada 25s) sigue activo en segundo plano aunque la barra no sea visible.
- Para modificar el estilo: `style.css` → `.chat-online-bar` y `.chat-online-pill`.

---

## Regla para hacer cambios

Antes de tocar cualquier archivo, pregúntate:

1. **¿Qué sección visual afecta?** → ese es el archivo
2. **¿Afecta a VARIOS módulos?** → va en `core.js` o `utils-extra.js`
3. **¿Es navegación?** → va en `grupos.js`
4. **¿Es responsive/visual?** → va en `style.css`, sección correspondiente

---

## Cuándo subir cambios

Solo sube el archivo que modificaste + `sw.js` incrementando la versión del caché:

```js
// sw.js — línea 1
const CACHE_NAME = 'zonaescolar-shell-v32';  // ← incrementar cada deploy
```

Y actualiza el `?v=` del script correspondiente en `index.html`:
```html
<script src="js/tareas.js?v=32"></script>  ← incrementar versión
```
Esto fuerza al navegador a descargar la versión nueva en lugar de usar el caché.

---

## Colecciones Firestore activas

| Colección             | Usado en          | Descripción                                      |
|-----------------------|-------------------|--------------------------------------------------|
| `ec_users`            | core, grupos      | Perfil de cada usuario (nombre, email, avatar)   |
| `ec_grupos`           | grupos            | Grupos escolares (nombre, admin, miembros)        |
| `ec_feed`             | tableros          | Publicaciones del feed (texto, fotos, votaciones compartidas) |
| `ec_comentarios`      | tableros          | Comentarios de publicaciones del feed            |
| `ec_tableros`         | tableros          | Tableros temáticos del grupo                     |
| `ec_chat`             | chat              | Mensajes del chat grupal por sala                |
| `ec_salas_chat`       | chat              | Salas de chat creadas por el grupo               |
| `ec_chat_reads`       | chat              | Marca de último mensaje leído por usuario        |
| `ec_typing`           | chat              | Indicador de "está escribiendo…" en tiempo real  |
| `ec_online`           | chat              | Presencia online de usuarios                     |
| `ec_tareas`           | tareas            | Tareas del grupo con responsable y fecha         |
| `ec_semestres`        | apuntes           | Semestres dentro de Apuntes                      |
| `ec_galerias`         | apuntes           | Materias/galerías dentro de un semestre          |
| `ec_fotos`            | apuntes           | Fotos de apuntes subidas a una galería           |
| `ec_notas`            | apuntes           | Notas de materia por usuario                     |
| `ec_muro_fotos`       | muro              | Fotos del muro personal de cada usuario          |
| `ec_muro_albums`      | muro              | Álbumes del muro personal de cada usuario        |
| `ec_biblioteca`       | biblioteca        | Archivos PDF/links de la biblioteca              |
| `ec_biblio_categorias`| biblioteca        | Categorías/repisas de la biblioteca              |
| `ec_videotutoriales`  | videotutoriales   | Videos tutoriales del grupo                      |
| `ec_votaciones`       | dinamicas         | Votaciones (no se autopublican en el feed)       |
| `ec_trivias`          | dinamicas         | Trivias guardadas con sus preguntas              |
