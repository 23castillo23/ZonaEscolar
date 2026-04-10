# ZonaEscolar 🏫

Tu espacio escolar privado — apuntes, chat, tareas y dinámicas con tu grupo.

> **Versión actual:** 1.6.2  
> **Stack:** Firebase (Auth + Firestore) · Cloudinary · PWA  
> **Sin backend propio** — todo corre en Firebase + Cloudinary

---

## Estructura de archivos

```
zonaescolar/
├── index.html              ← App principal (shell + Firebase init)
├── sw.js                   ← Service Worker (PWA / caché offline)
├── manifest.webmanifest    ← Manifiesto PWA (nombre, colores, iconos)
├── css/
│   └── style.css           ← Estilos globales (tema oscuro/claro)
├── js/
│   ├── core.js             ← Estado global, auth, utilidades
│   ├── grupos.js           ← Grupos, miembros, sidebar
│   ├── tableros.js         ← Feed, tableros temáticos, tarjetas
│   ├── muro.js             ← Muro personal, álbumes de fotos
│   ├── chat.js             ← Chat en tiempo real, salas
│   ├── tareas.js           ← Tareas, subtareas, calendario
│   ├── biblioteca.js       ← Biblioteca de archivos
│   ├── apuntes.js          ← Apuntes por semestre y materia
│   ├── dinamicas.js        ← Ruleta, votación, trivia, puntos
│   ├── videotutoriales.js  ← Videos tutoriales del grupo
│   └── utils-extra.js      ← Selector de tablero, helpers
└── icons/
    └── icon.png            ← Ícono de la app (192×192 mínimo)
```

---

## Cómo desplegar

1. **Sube los archivos a tu hosting** (Netlify, Firebase Hosting, GitHub Pages, etc.)
2. **Configura las Firestore Security Rules** (ver sección abajo)
3. **Abre la app** → inicia sesión con Google → crea tu primer grupo → agrega a tus compañeros por correo Gmail

---

## Configuración Firebase

El proyecto Firebase usado es **zonaescolar-658ff**. Si quieres usar tu propio proyecto:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Activa **Authentication** → Google Sign-in
3. Activa **Firestore Database**
4. Reemplaza el objeto `firebaseConfig` en `index.html` con las credenciales de tu proyecto

---

## Reglas de Firestore (Firebase Console → Firestore → Rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() {
      return request.auth != null;
    }
    match /ec_users/{uid} {
      allow get, list, write: if isAuth();
    }
    match /ec_grupos/{groupId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.adminUid;
      allow update: if isAuth();
    }
    match /ec_biblio_categorias/{docId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth() &&
        get(/databases/$(database)/documents/ec_grupos/$(resource.data.groupId)).data.adminUid == request.auth.uid;
    }
    match /ec_biblioteca/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth() && (
        request.auth.uid == resource.data.authorUid ||
        get(/databases/$(database)/documents/ec_grupos/$(resource.data.groupId)).data.adminUid == request.auth.uid
      );
    }
    match /ec_videotutoriales/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_chat/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth() && (
        request.auth.uid == resource.data.authorUid ||
        get(/databases/$(database)/documents/ec_grupos/$(resource.data.groupId)).data.adminUid == request.auth.uid
      );
    }
    match /ec_feed/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_tareas/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_semestres/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_galerias/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_fotos/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_votaciones/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_muro_fotos/{docId} {
      allow get, list, create: if isAuth();
      /* update: p. ej. quitar albumId al eliminar un álbum (Mis aportes) */
      allow update: if isAuth() && request.auth.uid == resource.data.authorUid;
      allow delete: if isAuth();
    }
    match /ec_comentarios/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_notas/{docId} {
      allow get, list, create, update, delete: if isAuth();
    }
    match /ec_typing/{docId} {
      allow get, list, write: if isAuth();
    }
    match /ec_online/{docId} {
      allow get, list, write: if isAuth();
    }
    match /ec_chat_canales/{docId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_salas_chat/{docId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.adminUid;
      allow update: if isAuth();
    }
    match /ec_muro_albums/{docId} {
      allow get, list, create: if isAuth();
      allow update, delete: if isAuth();
    }
    match /ec_tableros/{docId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.createdBy;
      allow update: if isAuth();
    }
    match /ec_trivias/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
    match /ec_chat_reads/{docId} {
      allow get, list, create, update: if isAuth();
      allow delete: if isAuth();
    }
  }
}
```

---

## Flujo de uso

1. **Admin crea grupo** → le aparece en el selector de "Grupo activo"
2. **Admin invita miembros** → botón `+ Invitar` en la topbar → escribe correo Gmail + nombre del compañero
3. **Compañero entra con su cuenta Google** → el grupo aparece automáticamente en su selector
4. **Cada quien interactúa solo dentro de su grupo activo** — pueden pertenecer a varios grupos y cambiar con el selector

---

## Módulos

| Módulo | Descripción |
|---|---|
| 🔐 **Auth** | Google Login sin contraseñas vía Firebase Authentication |
| 📍 **Tablero** | Publicaciones de texto y fotos con likes y comentarios en tiempo real. Tableros temáticos por materia |
| 📂 **Mis Aportes** | Perfil personal con álbumes de fotos y publicaciones del usuario |
| 📸 **Apuntes** | Fotos del pizarrón organizadas por semestre y materia (sube a Cloudinary) |
| 💬 **Chat** | Mensajes en tiempo real con salas. El nombre de la sala activa aparece en la barra superior |
| ✅ **Tareas** | Tareas con responsable, fecha límite, materia, subtareas y filtros |
| 🗳️ **Votación** | Encuestas creadas y guardadas. Se publican manualmente en el tablero elegido con 📌 Compartir |
| 🧠 **Trivia** | Banco de preguntas guardado en Firestore. Se juega desde Dinámicas y se comparte al tablero con 📌 |
| 🎰 **Ruleta** | Elige al azar quién expone en clase |
| 🏆 **Puntos** | Marcador de puntos entre compañeros |
| 📚 **Biblioteca** | Archivos PDF y links organizados por categorías |
| 🎬 **VideoTutoriales** | Videos tutoriales del grupo con comentarios |

---

## Colecciones Firestore

| Colección              | Descripción                                                  |
|------------------------|--------------------------------------------------------------|
| `ec_users`             | Perfil de cada usuario (nombre, email, avatar)               |
| `ec_grupos`            | Grupos escolares (nombre, admin, lista de miembros)          |
| `ec_feed`              | Publicaciones del feed (texto, imágenes, votaciones compartidas) |
| `ec_comentarios`       | Comentarios de publicaciones del feed                        |
| `ec_tableros`          | Tableros temáticos del grupo                                 |
| `ec_chat`              | Mensajes del chat grupal por sala                            |
| `ec_salas_chat`        | Salas de chat creadas por el grupo                           |
| `ec_chat_reads`        | Registro del último mensaje leído por usuario (para contador no leídos) |
| `ec_typing`            | Indicador "está escribiendo…" en tiempo real                 |
| `ec_online`            | Presencia online de usuarios en el chat                      |
| `ec_tareas`            | Tareas del grupo con responsable, fecha y subtareas          |
| `ec_semestres`         | Semestres dentro de Apuntes                                  |
| `ec_galerias`          | Materias/galerías dentro de un semestre                      |
| `ec_fotos`             | Fotos de apuntes subidas a una galería                       |
| `ec_notas`             | Notas de materia por usuario                                 |
| `ec_muro_fotos`        | Fotos del muro personal de cada usuario                      |
| `ec_muro_albums`       | Álbumes del muro personal de cada usuario                    |
| `ec_biblioteca`        | Archivos PDF/links de la biblioteca del grupo                |
| `ec_biblio_categorias` | Categorías/repisas de la biblioteca                          |
| `ec_videotutoriales`   | Videos tutoriales del grupo                                  |
| `ec_votaciones`        | Votaciones del grupo (no se autopublican en el feed)         |
| `ec_trivias`           | Trivias guardadas con nombre y banco de preguntas            |

---

## Cloudinary

Las imágenes se almacenan en **Cloudinary** (no en Firebase Storage).

- **Cloud name:** `dwjzn6n0a`
- **Upload preset:** `zonaescolar_unsigned` (unsigned, sin autenticación)
- Se usa en: Feed, Apuntes, Chat (imágenes), Mi Muro

---

## PWA

ZonaEscolar es instalable como app nativa en móvil y escritorio.

- El archivo `sw.js` maneja el caché de los assets del app shell
- El archivo `manifest.webmanifest` define nombre, colores y el ícono
- En iOS: Safari → Compartir → Agregar a pantalla de inicio
- En Android/Chrome: el navegador muestra un banner de instalación automáticamente

---

## Changelog

### v1.6.2 — Limpieza y caché PWA

**Función huérfana eliminada (`biblioteca.js`)**  
`renderCalendarioTareas` era la versión vieja del calendario que quedó en el archivo sin llamarse desde ningún lado. Se eliminó para evitar confusión. La función activa es `renderCalMes` (introducida en v1.6.1).

**Bump de caché del Service Worker (`sw.js` + `index.html`)**  
Se actualizó `CACHE_NAME` de `v13` a `v14` y las versiones de todos los scripts de `?v=2` a `?v=3`. Esto garantiza que los usuarios con la PWA instalada descarguen los archivos corregidos en v1.6.1 (topbar fija, calendario, calVerDia sin re-fetch) en lugar de servir versiones viejas del caché.

---

**Archivos modificados en esta versión:**
| Archivo | Cambio |
|---|---|
| `js/biblioteca.js` | Eliminada función `renderCalendarioTareas` (huérfana) |
| `sw.js` | `CACHE_NAME` bumpeado a `v14` |
| `index.html` | Scripts actualizados a `?v=3` |

---


### v1.6.1 — Correcciones móvil (PWA)

Correcciones enfocadas en la experiencia en teléfono:

**Bug 1 — Calendario: mes incorrecto al navegar (`tareas.js`)**  
El listener de Firestore recalculaba el mes con aritmética manual (`Math.floor` y operador `%`), lo que daba resultados incorrectos al cruzar diciembre/enero o al dispararse mientras `calMesOffset` ya había cambiado. Ahora usa `new Date(año, mes + offset, 1)`, igual que `calNavegar()` en `biblioteca.js`.

**Bug 2 — Calendario: retardo al tocar un día (`biblioteca.js`)**  
Cada vez que el usuario tocaba un día del calendario se hacía un nuevo `getDocs` a Firebase, causando un retardo visible. Ahora `renderCalMes` guarda las tareas en la variable `_calTareasCache`, y `calVerDia` filtra desde ese caché local sin ninguna consulta extra a la base de datos. El resultado es instantáneo.

**Bug 3 — Topbar se oculta al hacer scroll en iOS (`style.css` + `grupos.js`)**  
En iOS, `position: sticky` dentro de un contenedor con `overflow` anidado no se mantiene fijo — la topbar desaparecía al bajar el contenido y había que subir manualmente para cambiar de sección. Solución en dos partes:
- La topbar pasa a `position: fixed` dentro del media query `≤768px`, asegurando que siempre sea visible.
- Se agrega `padding-top: calc(56px + env(safe-area-inset-top, 0px) + 12px)` a `.section` para compensar el espacio que ocupa la barra fija.
- `showSection()` en `grupos.js` hace `el.scrollTop = 0` al activar cada sección, así siempre se empieza desde arriba al cambiar de pantalla.

**Bug 4 — `calMesOffset` variable global no centralizada (`biblioteca.js` + `tareas.js`)**  
`calMesOffset` vivía en `biblioteca.js` pero `tareas.js` también la usaba sin declararla. Al quedar en el ámbito global del navegador funciona, pero es frágil ante errores de carga. Documentado para mover a `core.js` en la próxima refactorización mayor (junto a `calDiaSeleccionado` que ya vive ahí).

---

**Archivos modificados en esta versión:**
| Archivo | Cambio |
|---|---|
| `js/tareas.js` | Bug 1: cálculo de año/mes en listener de Firestore |
| `js/biblioteca.js` | Bug 2: caché `_calTareasCache` + `calVerDia` sin getDocs |
| `css/style.css` | Bug 3: topbar `fixed` en móvil + `padding-top` en `.section` |
| `js/grupos.js` | Bug 3: `scrollTop = 0` en `showSection()` |

---

### v1.6.0
- **Votaciones — sin autopublicación:** al crear una votación ya no se publica sola en el Tablero (feed). El usuario decide cuándo y en qué tablero compartirla con el botón 📌 Compartir.
- **Trivias — guardadas en Firestore:** las trivias ahora se guardan en `ec_trivias` con nombre y banco de preguntas. Aparecen como tarjetas en Dinámicas → Trivia con botón ▶️ Jugar y 📌 Compartir.
- **Compartir votación/trivia al tablero:** botón 📌 en cada tarjeta abre el selector de tablero. Si ya está compartida en ese tablero, la sube al inicio en vez de duplicarla.
- **Quitar del tablero:** el botón en la tarjeta del Tablero (feed) dice "🗑️ Quitar del tablero" y solo borra el post del Tablero (feed), sin eliminar la votación original.
- **Modal nueva trivia:** formulario completo con nombre, preguntas y banco visual. Botón "+ Agregar respuesta" para añadir más opciones. Solo el creador y el admin pueden eliminar trivias guardadas.
- **Modal nueva votación:** el formulario se abre en ventana (modal) en lugar de inline.
- **Chat — header en topbar:** al entrar a una sala, el botón "← Salas" y el nombre de la sala se muestran en la barra superior de la app en lugar de ocupar espacio dentro del chat. Esto elimina el espacio en blanco que aparecía en móvil y escritorio.
- **Firestore:** nuevas colecciones `ec_trivias` y `ec_chat_reads`. Agregar sus reglas al panel de Firestore (ver sección Reglas).


### v1.5.0
- **Álbumes en Mis Aportes:** la pestaña "Fotos" ahora muestra una vista de álbumes. Cada integrante puede crear sus propios álbumes con nombre e ícono emoji para organizar sus fotos ordenadamente.
- **Subir foto a álbum:** al usar el botón "+ Foto", aparece un selector para elegir en qué álbum guardar las imágenes. Si estás dentro de un álbum abierto, las fotos van directo a ese álbum sin preguntar.
- **Álbum "Sin álbum":** las fotos subidas antes de esta versión (y las que se suban sin elegir álbum) aparecen automáticamente en una tarjeta especial "📷 Sin álbum".
- **Eliminar álbum:** el admin y el dueño pueden eliminar álbumes.
- **Vista de álbum ajeno:** al ver el muro de un compañero también se ven sus álbumes (sin el botón de crear/eliminar).
- **Firestore:** nueva colección `ec_muro_albums`. Agregar su regla al panel de Firestore (ver sección Reglas).

### v1.4.0
- **Chat — Imágenes:** botón 📷 en el chat para enviar fotos directamente en la conversación (se suben a Cloudinary). 
- **Chat — ✔ Enviado / ✔✔ Visto:** cada mensaje propio muestra ✔ cuando se envió y ✔✔ en cuando al menos otro integrante lo leyó (automático al renderizar).
- **Chat — Typing indicator:** aparece "X está escribiendo…" en tiempo real cuando un compañero escribe. Desaparece automáticamente a los 2 segundos.
- **Chat — Usuarios online:** barra lateral izquierda muestra con un punto verde 🟢 quién del grupo está conectado en este momento.
- **Chat — Notificaciones push:** si llegas un mensaje mientras el tab no está activo, aparece una notificación del sistema (pide permiso la primera vez).
- **Firestore:** se añadieron las colecciones `ec_typing` y `ec_online` para las nuevas features. Agregar sus reglas al README.

### v1.3.0
- **Editar perfil:** al hacer clic en el botón ✏️ (o en tu nombre en Mi Muro) se abre un modal con dos opciones: cambiar tu nombre en el grupo y cambiar tu foto de perfil. Puedes usar tu foto de Google, subir una imagen desde tu dispositivo, o elegir un emoji de una paleta de 30 opciones.
- **Fotos de perfil:** se cargan correctamente en toda la app (sidebar, topbar, compose, chat, muro). Si el avatar es un emoji o no existe URL, se muestra la inicial del nombre en su lugar en todos los puntos de la UI.
- **Nombre personalizado:** al guardar, el nombre se actualiza en Firestore y se refleja inmediatamente en el sidebar, topbar y muro sin recargar.
- **Eliminar foto propia del muro:** cada usuario puede eliminar las fotos que él mismo subió a su muro (botón 🗑️ al pasar el cursor). El admin puede eliminar cualquier foto. Al eliminar también se borra la publicación asociada del feed.
- **Eliminar comentario propio:** ahora aparece un botón 🗑️ en cada comentario que tú escribiste. El admin puede eliminar cualquier comentario del grupo.
- **Fix duplicados en Tablero (feed):** las tarjetas del Tablero (feed) ya no se duplican al abrir/cerrar la sección de comentarios. Se corrigió que `data-id` no estaba en el HTML generado por `buildFeedCard`, causando que el listener de Firestore re-insertara cards existentes.
- **Fix comentarios acumulando listeners:** `loadComments` ahora cancela el listener anterior antes de crear uno nuevo al abrir la sección de comentarios en una tarjeta.
- **Fix sección de comentarios oculta por defecto:** se corrigió que `.feed-comments-section` no tenía `style="display:none"` en el HTML generado, haciendo que apareciera abierta al renderizar.

### v1.2.0
- **Sidebar — Miembros del grupo:** la barra lateral ahora muestra la lista de miembros del grupo activo con avatar inicial y nombre. Al hacer clic en un miembro se abre su muro para ver sus fotos y publicaciones. Los miembros invitados que aún no hayan iniciado sesión muestran un mensaje informativo.
- **Muro ajeno:** al ver el muro de otro miembro se oculta el botón "+ Foto" y aparece un botón "← Volver a mi muro". Cada miembro solo puede subir fotos a su propio muro.
- **Tablero (Feed):** el listener se reinicia correctamente al publicar con fotos — las imágenes aparecen en tiempo real sin necesidad de recargar la página.
- **Tareas:** el listener de tareas se reinicia al cambiar de grupo o sección, solucionando que no aparecieran nuevas tareas creadas.
- **Apuntes:** creación de semestres y materias ahora muestra errores descriptivos y feedback visual (⏳) durante la operación.

### v1.1.0
- **Tablero (Feed):** preview de fotos antes de publicar, con opción de quitar imágenes individuales. Feedback visual (botón de envío muestra ⏳) mientras sube a Cloudinary.
- **Chat:** mensajes optimistas — el texto aparece al instante sin esperar Firestore. Layout adaptativo para móvil.
- **Miembros:** el modal `+ Invitar` muestra la lista completa de miembros actuales con nombre, correo y rol.
- **Grupos:** al cambiar de grupo se limpian todos los listeners activos (Tablero (feed), chat, tareas, votaciones).

### v1.0.0
- Lanzamiento inicial: Auth Google, Tablero (Feed), Chat, Tareas, Apuntes, Mis Aportes (Muro), Dinámicas (Ruleta, Votación, Trivia, Puntos), PWA, tema oscuro/claro.
