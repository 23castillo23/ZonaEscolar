# ZonaEscolar 🏫

Tu espacio escolar privado — apuntes, chat, tareas y dinámicas con tu grupo.

> **Versión actual:** 1.7.0  
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
│   ├── grupos.js           ← Grupos, miembros, sidebar, navegación
│   ├── tableros.js         ← Feed, tableros temáticos, tarjetas
│   ├── muro.js             ← Muro personal, álbumes de fotos
│   ├── chat.js             ← Chat en tiempo real, salas
│   ├── tareas.js           ← Tareas, subtareas, filtros
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
2. **Admin invita miembros** → botón `+ Invitar` en la topbar → escribe correo Gmail exacto + nombre del compañero
3. **Compañero entra con su cuenta Google** → el grupo aparece automáticamente en su selector
4. **Si el admin expulsa y reingresa a alguien**, el grupo vuelve a aparecer automáticamente sin recargar la página
5. **Cada quien interactúa solo dentro de su grupo activo** — pueden pertenecer a varios grupos y cambiar con el selector

> ⚠️ El correo que el admin escribe al invitar debe coincidir **exactamente** con el que usa el compañero para iniciar sesión con Google (incluyendo puntos y mayúsculas).

---

## Módulos

| Módulo | Descripción |
|---|---|
| 🔐 **Auth** | Google Login sin contraseñas vía Firebase Authentication |
| 📍 **Tablero** | Publicaciones de texto y fotos con likes y comentarios en tiempo real. Tableros temáticos por materia |
| 📂 **Mis Aportes** | Perfil personal con álbumes de fotos y publicaciones del usuario |
| 📸 **Apuntes** | Fotos del pizarrón organizadas por semestre y materia (sube a Cloudinary) |
| 💬 **Chat** | Mensajes en tiempo real con salas. El nombre de la sala activa aparece en la barra superior |
| ✅ **Tareas** | Tareas con responsable, fecha límite, materia, subtareas y filtros (Todas / Pendientes / Completadas) |
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

### v1.7.0 — Fixes de layout móvil, calendario eliminado y correcciones de miembros

**Cambios principales:**

**1 — Calendario de tareas eliminado (`tareas.js` + `index.html`)**  
El calendario mensual de tareas fue removido completamente por problemas de adaptación en móvil. Se eliminaron las funciones `renderCalMes`, `calNavegar`, `calVerDia`, `resetVistaCalendario` y las variables `_calTareasCache`, `tareasVistaCalendario`, `calMesOffset` y `calDiaSeleccionado`. El botón `📅 Calendario` fue quitado del HTML. Los filtros Todas / Pendientes / Completadas se mantienen intactos.

**2 — Bug crítico: miembros reingresados no veían el grupo (`grupos.js`)**  
Cuando el admin expulsaba a un integrante y lo volvía a agregar, el listener de Firestore recibía la actualización en tiempo real pero no llamaba a `activarGrupo` porque ya había pasado el `primerSnapshot`. El usuario veía el grupo en el selector pero la pantalla seguía diciendo "sin grupo". Se agregó el bloque `else if (grupos.length > 0)` en el listener para activar automáticamente el grupo cuando el usuario no tiene ninguno activo y aparece uno nuevo.

**3 — Barra de usuarios online arreglada (`style.css`)**  
La barra `.chat-online-bar` mostraba una línea verde visible aunque no hubiera nadie conectado, porque tenía `min-height: 26px` y `border-bottom` siempre activos. Ahora tiene `min-height: 0` y el borde/padding solo aparecen cuando la lista interna está en `display:flex` (es decir, cuando hay compañeros conectados). El sistema de presencia no fue modificado.

**4 — Espacio excesivo arriba en móvil (`style.css`)**  
El `::before` de `.section` usaba `max(56px, calc(...))` que en Android generaba un hueco extra entre el topbar y el contenido. Cambiado a `calc(56px + env(safe-area-inset-top, 0px))` para que sea exactamente el alto del topbar.

**5 — Barra del chat oculta por el bottom nav en móvil (`style.css`)**  
El `.chat-compose-wrapper` tenía `padding-bottom` calculado solo con `safe-area-inset-bottom`, sin considerar la altura del bottom nav (48px). Cambiado a `var(--ze-bottom-nav-clearance)` que ya incluye ambos valores, igual que el resto de la app.

**6 — VideoTutoriales: espacio vacío a la izquierda (`style.css`)**  
El `.dvd-shell` tenía `max-width: 900px` con `margin: 0 auto`, dejando espacio en blanco a la izquierda en pantallas anchas. Ampliado a `max-width: 1200px` para aprovechar el ancho disponible igual que las otras secciones.

---

**Archivos modificados en esta versión:**
| Archivo | Cambio |
|---|---|
| `js/tareas.js` | Eliminado calendario completo. Filtros de tareas simplificados |
| `js/grupos.js` | Fix: auto-activar grupo al ser reingresado después de expulsión |
| `css/style.css` | Fix barra online, fix spacer móvil, fix chat-compose, fix dvd-shell |
| `index.html` | Eliminado botón `📅 Calendario` de la sección de tareas |

---

### v1.6.3 — Refactorización y corrección de bugs críticos

**Bugs críticos corregidos:**

**Bug 1 — Duplicación de estado en múltiples archivos**  
Las variables `muroAlbumActualId` y `muroAlbumsCache` estaban declaradas en AMBOS archivos `chat.js` y `muro.js`, causando potencial inconsistencia de estado. Ahora están centralizadas en `core.js` como variables globales únicas.

**Bug 2 — Variable `calMesOffset` no declarada globalmente**  
`calMesOffset` se usaba en `tareas.js` sin estar declarada o inicializada. Ahora está en `core.js` inicializada a `0`.

**Bug 3 — Variable `triviasUnsub` no declarada**  
En `dinamicas.js` se verificaba `typeof triviasUnsub` pero la variable existía sin tipo declarado. Ahora hay una declaración explícita en `dinamicas.js`.

**Bug 4 — Código muerto en apuntes.js**  
Línea vacía: `const btnPublicar = '';` que nunca se usaba. Eliminada.

**Bug 5 — Manejo de errores silencioso (anti-pattern)**  
Múltiples `.catch()` con funciones vacías que ocultaban errores. Ahora todos tienen logging con `console.error`.

---

**Archivos modificados en esta versión:**
| Archivo | Cambio |
|---|---|
| `js/core.js` | Agregadas: `muroAlbumActualId`, `muroAlbumsCache`, `calMesOffset` |
| `js/muro.js` | Removidas variables duplicadas + comentario de referencia |
| `js/chat.js` | Mejorado `.catch()` con logging |
| `js/apuntes.js` | Eliminada línea vacía de `btnPublicar` |
| `js/utils-extra.js` | Mejorado `.catch()` con logging |

---

### v1.6.2 — Limpieza y caché PWA

**Función huérfana eliminada (`biblioteca.js`)**  
`renderCalendarioTareas` era la versión vieja del calendario que quedó en el archivo sin llamarse desde ningún lado. Se eliminó.

**Bump de caché del Service Worker**  
Se actualizó `CACHE_NAME` de `v13` a `v14` y las versiones de todos los scripts de `?v=2` a `?v=3`.

---

**Archivos modificados en esta versión:**
| Archivo | Cambio |
|---|---|
| `js/biblioteca.js` | Eliminada función `renderCalendarioTareas` (huérfana) |
| `sw.js` | `CACHE_NAME` bumpeado a `v14` |
| `index.html` | Scripts actualizados a `?v=3` |

---

### v1.6.1 — Correcciones móvil (PWA)

**Bug 1 — Calendario: mes incorrecto al navegar (`tareas.js`)**  
Ahora usa `new Date(año, mes + offset, 1)` en lugar de aritmética manual.

**Bug 2 — Calendario: retardo al tocar un día (`biblioteca.js`)**  
`renderCalMes` guarda las tareas en `_calTareasCache` y `calVerDia` filtra desde ese caché sin hacer getDocs.

**Bug 3 — Topbar se oculta al hacer scroll en iOS**  
La topbar pasa a `position: fixed` en móvil. `showSection()` hace `scrollTop = 0` al activar cada sección.

**Bug 4 — `calMesOffset` variable global no centralizada**  
Documentado para mover a `core.js` (ya resuelto en v1.6.3).

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
