# Estructura de módulos — ZonaEscolar JS

Los archivos se cargan en este orden en index.html.
Cada uno depende del anterior (las variables globales de core.js las usan todos).

---

## Orden de carga y responsabilidad

| Archivo              | Líneas | Qué hace                                              |
|----------------------|--------|-------------------------------------------------------|
| `core.js`            | ~362   | Estado global, utilidades (escHtml, fmtTime...), tema oscuro/claro, Firebase Auth |
| `grupos.js`          | ~486   | Crear/cambiar/abandonar grupos, invitar miembros, sidebar de integrantes |
| `tableros.js`        | ~1722  | Tableros (galería + feed), tarjetas, comentarios, likes, chinchetas, publicar |
| `muro.js`            | ~347   | Muro personal y ajeno, álbumes de fotos, subir fotos al muro |
| `chat.js`            | ~1084  | Chat en tiempo real, salas, imágenes, typing, online, burbuja flotante |
| `tareas.js`          | ~155   | Crear/completar/filtrar tareas, subtareas, calendario |
| `biblioteca.js`      | ~665   | Biblioteca de archivos, categorías, compartir al tablero |
| `apuntes.js`         | ~767   | Semestres, materias/galerías, fotos de pizarrón, notas de materia |
| `dinamicas.js`       | ~1297  | Ruleta, votación, trivia, puntos, lightbox de fotos   |
| `videotutoriales.js` | ~425   | Cajas DVD, comentarios de video, compartir al tablero |
| `utils-extra.js`     | ~343   | Selector de tablero, fix de teclado iOS, compartir libro/DVD, resize |

---

## Regla para hacer cambios

- **¿Tocas el chat?** → edita solo `chat.js`
- **¿Tocas las tareas?** → edita solo `tareas.js`
- **¿Tocas el feed o las tarjetas del tablero?** → edita `tableros.js`
- **¿Tocas variables que usan todos (currentUser, currentGroupId)?** → edita `core.js`
- **¿Tocas "compartir al tablero" desde biblioteca o videotutoriales?** → edita `utils-extra.js`

---

## Cuando subas cambios

Solo sube el archivo que modificaste + `sw.js` si agregaste un archivo nuevo.

Si modificaste `tableros.js`, solo sube ese archivo y actualiza su `?v=` en `index.html`:
```html
<script src="js/tableros.js?v=2"></script>  ← incrementar versión
```
Esto fuerza al navegador a descargar la versión nueva en lugar de usar el caché.
