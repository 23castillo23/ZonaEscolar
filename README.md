# ZonaEscolar 🏫

Tu espacio escolar privado — apuntes, chat, tareas y dinámicas con tu grupo.

> **Versión actual:** 1.4.0  
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
│   └── app.js              ← Lógica completa de la app
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
    
    match /ec_muro_albums/{docId} {
      allow get, list, create: if isAuth();
      allow update, delete: if isAuth();
    }

    match /ec_tableros/{docId} {
      allow get, list, create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.createdBy;
      allow update: if isAuth();
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
| 📍 **Tablero** | Publicaciones de texto y fotos con likes y comentarios en tiempo real |
| 🙋 **Mis Aportes** | Perfil personal con fotos propias y publicaciones del usuario |
| 📸 **Apuntes** | Fotos del pizarrón organizadas por semestre y materia (sube a Cloudinary) |
| 💬 **Chat** | Mensajes en tiempo real con entrega optimista (aparecen al instante) |
| ✅ **Tareas** | Tareas con responsable, fecha límite, materia y filtros |
| 🎰 **Ruleta** | Elige al azar quién expone en clase |
| 🗳️ **Votación** | Encuestas en tiempo real para el grupo |
| 🧠 **Trivia** | Banco de preguntas de repaso creado por el grupo |
| 🏆 **Puntos** | Marcador de puntos entre compañeros |

---

## Colecciones Firestore

| Colección | Descripción |
|---|---|
| `ec_usuarios` | Perfil de cada usuario (nombre, email, avatar) |
| `ec_grupos` | Grupos escolares (nombre, admin, lista de miembros) |
| `ec_feed` | Publicaciones del feed (texto, imágenes, likes, comentarios) |
| `ec_comentarios` | Comentarios de publicaciones del feed |
| `ec_chat` | Mensajes del chat grupal |
| `ec_tareas` | Tareas del grupo |
| `ec_semestres` | Semestres dentro de Apuntes |
| `ec_galerias` | Materias/galerías dentro de un semestre |
| `ec_fotos` | Fotos de apuntes subidas a una galería |
| `ec_muro_fotos` | Fotos del muro personal de cada usuario |
| `ec_muro_albums` | Álbumes del muro personal de cada usuario |
| `ec_votaciones` | Votaciones activas e historial |

---

## Cloudinary

Las imágenes se almacenan en **Cloudinary** (no en Firebase Storage).

- **Cloud name:** `dwjzn6n0a`
- **Upload preset:** `zonaescolar_unsigned` (unsigned, sin autenticación)
- Se usa en: Feed, Apuntes, Mi Muro

---

## PWA

ZonaEscolar es instalable como app nativa en móvil y escritorio.

- El archivo `sw.js` maneja el caché de los assets del app shell
- El archivo `manifest.webmanifest` define nombre, colores y el ícono
- En iOS: Safari → Compartir → Agregar a pantalla de inicio
- En Android/Chrome: el navegador muestra un banner de instalación automáticamente

---

## Changelog

### v1.5.0
- **Álbumes en Mis Aportes:** la pestaña "Fotos" ahora muestra una vista de álbumes. Cada integrante puede crear sus propios álbumes con nombre e ícono emoji para organizar sus fotos ordenadamente.
- **Subir foto a álbum:** al usar el botón "+ Foto", aparece un selector para elegir en qué álbum guardar las imágenes. Si estás dentro de un álbum abierto, las fotos van directo a ese álbum sin preguntar.
- **Álbum "Sin álbum":** las fotos subidas antes de esta versión (y las que se suban sin elegir álbum) aparecen automáticamente en una tarjeta especial "📷 Sin álbum".
- **Eliminar álbum:** el admin y el dueño pueden eliminar álbumes; las fotos dentro quedan en "Sin álbum" en lugar de borrarse.
- **Vista de álbum ajeno:** al ver el muro de un compañero también se ven sus álbumes (sin el botón de crear/eliminar).
- **Firestore:** nueva colección `ec_muro_albums`. Agregar su regla al panel de Firestore (ver sección Reglas).

### v1.4.0
- **Chat — Imágenes:** botón 📷 en el chat para enviar fotos directamente en la conversación (se suben a Cloudinary). Preview miniatura antes de enviar con opción de cancelar.
- **Chat — ✔ Enviado / ✔✔ Visto:** cada mensaje propio muestra ✔ cuando se envió y ✔✔ en azul cuando al menos otro miembro lo leyó (automático al renderizar).
- **Chat — Typing indicator:** aparece "X está escribiendo…" en tiempo real cuando un compañero escribe. Desaparece automáticamente a los 2 segundos.
- **Chat — Usuarios online:** barra superior del chat muestra con un punto verde 🟢 quién del grupo está conectado en este momento.
- **Chat — Notificaciones push:** si llegas un mensaje mientras el tab no está activo, aparece una notificación del sistema (pide permiso la primera vez).
- **Firestore:** se añadieron las colecciones `ec_typing` y `ec_online` para las nuevas features. Agregar sus reglas al README.

### v1.3.0
- **Editar perfil:** al hacer clic en el botón ✏️ (o en tu nombre en Mi Muro) se abre un modal con dos opciones: cambiar tu nombre en el grupo y cambiar tu foto de perfil. Puedes usar tu foto de Google, subir una imagen desde tu dispositivo, o elegir un emoji de una paleta de 30 opciones.
- **Fotos de perfil:** se cargan correctamente en toda la app (sidebar, topbar, compose, chat, muro). Si el avatar es un emoji o no existe URL, se muestra la inicial del nombre en su lugar en todos los puntos de la UI.
- **Nombre personalizado:** al guardar, el nombre se actualiza en Firestore y se refleja inmediatamente en el sidebar, topbar y muro sin recargar.
- **Eliminar foto propia del muro:** cada usuario puede eliminar las fotos que él mismo subió a su muro (botón 🗑️ al pasar el cursor). El admin puede eliminar cualquier foto. Al eliminar también se borra la publicación asociada del feed.
- **Eliminar comentario propio:** ahora aparece un botón 🗑️ en cada comentario que tú escribiste. El admin puede eliminar cualquier comentario del grupo.
- **Fix duplicados en feed:** las tarjetas del feed ya no se duplican al abrir/cerrar la sección de comentarios. Se corrigió que `data-id` no estaba en el HTML generado por `buildFeedCard`, causando que el listener de Firestore re-insertara cards existentes.
- **Fix comentarios acumulando listeners:** `loadComments` ahora cancela el listener anterior antes de crear uno nuevo al abrir la sección de comentarios en una tarjeta.
- **Fix sección de comentarios oculta por defecto:** se corrigió que `.feed-comments-section` no tenía `style="display:none"` en el HTML generado, haciendo que apareciera abierta al renderizar.

### v1.2.0
- **Sidebar — Miembros del grupo:** la barra lateral ahora muestra la lista de miembros del grupo activo con avatar inicial y nombre. Al hacer clic en un miembro se abre su muro para ver sus fotos y publicaciones. Los miembros invitados que aún no hayan iniciado sesión muestran un mensaje informativo.
- **Muro ajeno:** al ver el muro de otro miembro se oculta el botón "+ Foto" y aparece un botón "← Volver a mi muro". Cada miembro solo puede subir fotos a su propio muro.
- **Feed:** el listener se reinicia correctamente al publicar con fotos — las imágenes aparecen en tiempo real sin necesidad de recargar la página.
- **Tareas:** el listener de tareas se reinicia al cambiar de grupo o sección, solucionando que no aparecieran nuevas tareas creadas.
- **Apuntes:** creación de semestres y materias ahora muestra errores descriptivos y feedback visual (⏳) durante la operación.

### v1.1.0
- **Feed:** preview de fotos antes de publicar, con opción de quitar imágenes individuales. Feedback visual (botón de envío muestra ⏳) mientras sube a Cloudinary.
- **Chat:** mensajes optimistas — el texto aparece al instante sin esperar Firestore. Layout adaptativo para móvil.
- **Miembros:** el modal `+ Invitar` muestra la lista completa de miembros actuales con nombre, correo y rol.
- **Grupos:** al cambiar de grupo se limpian todos los listeners activos (feed, chat, tareas, votaciones).

### v1.0.0
- Lanzamiento inicial: Auth Google, Feed, Chat, Tareas, Apuntes, Muro, Dinámicas (Ruleta, Votación, Trivia, Puntos), PWA, tema oscuro/claro.
