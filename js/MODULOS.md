# Estructura de módulos — ZonaEscolar JS

Los archivos se cargan en este orden en index.html.
Cada uno depende del anterior (las variables globales de core.js las usan todos).

---

## Orden de carga y responsabilidad

| Archivo              | Líneas | Qué hace                                              |
|----------------------|--------|-------------------------------------------------------|
| `core.js`            | ~563   | Estado global, utilidades (escHtml, fmtTime...), tema oscuro/claro, Firebase Auth |
| `grupos.js`          | ~492   | Crear/cambiar/abandonar grupos, invitar miembros, sidebar de integrantes |
| `tableros.js`        | ~1790  | Tableros (galería + feed), tarjetas, comentarios, likes, chinchetas, publicar, quitar votación del tablero |
| `muro.js`            | ~354   | Muro personal y ajeno, álbumes de fotos, subir fotos al muro |
| `chat.js`            | ~1155  | Chat en tiempo real, salas, imágenes, typing, online, burbuja flotante. Botón ← Salas y nombre de sala se inyectan en el topbar al entrar |
| `tareas.js`          | ~155   | Crear/completar/filtrar tareas, subtareas, calendario |
| `biblioteca.js`      | ~685   | Biblioteca de archivos, categorías, compartir al tablero |
| `apuntes.js`         | ~772   | Semestres, materias/galerías, fotos de pizarrón, notas de materia |
| `dinamicas.js`       | ~1793  | Ruleta, votación (sin autopublicar), trivia (guardada en Firestore), puntos, lightbox, compartir al tablero |
| `videotutoriales.js` | ~435   | Cajas DVD, comentarios de video, compartir al tablero |
| `utils-extra.js`     | ~377   | Selector de tablero, fix de teclado iOS, compartir libro/DVD, resize |

---

## Regla para hacer cambios

- **¿Tocas el chat?** → edita solo `chat.js`
- **¿Tocas las tareas?** → edita solo `tareas.js`
- **¿Tocas el feed o las tarjetas del tablero?** → edita `tableros.js`
- **¿Tocas variables que usan todos (currentUser, currentGroupId)?** → edita `core.js`
- **¿Tocas "compartir al tablero" desde biblioteca o videotutoriales?** → edita `utils-extra.js`
- **¿Tocas votaciones o trivias?** → edita solo `dinamicas.js`

---

## Flujo de votaciones y trivias

- **Crear** → se guarda en `ec_votaciones` / `ec_trivias`. **No se publica automáticamente.**
- **Compartir** (botón 📌) → abre selector de tablero → publica en `ec_feed` con el tablero elegido.
- **Quitar del tablero** → solo borra el post del feed, la votación/trivia sigue en Dinámicas.
- **Eliminar definitivamente** → desde Dinámicas → Votaciones/Trivia → botón 🗑️ Eliminar.

---

## Cuando subas cambios

Solo sube el archivo que modificaste + `sw.js` incrementando la versión del caché:

```js
// sw.js — línea 1
const CACHE_NAME = 'zonaescolar-shell-v11';  // ← incrementar cada deploy
```

Y actualiza el `?v=` del script correspondiente en `index.html`:
```html
<script src="js/dinamicas.js?v=2"></script>  ← incrementar versión
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
| `ec_typing`           | chat              | Indicador de "está escribiendo..." en tiempo real |
| `ec_online`           | chat              | Presencia online de usuarios                     |
| `ec_tareas`           | tareas, biblioteca| Tareas del grupo con responsable y fecha         |
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
