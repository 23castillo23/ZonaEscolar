# ZonaEscolar 🏫

Tu espacio escolar privado — apuntes, chat, tareas y dinámicas con tu grupo.

> **Versión actual:** 1.1.0  
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

    function isMember(groupId) {
      return isAuth() &&
        request.auth.token.email in
        get(/databases/$(database)/documents/ec_grupos/$(groupId)).data.miembros;
    }

    function isAdmin(groupId) {
      return isAuth() &&
        request.auth.uid ==
        get(/databases/$(database)/documents/ec_grupos/$(groupId)).data.adminUid;
    }

    match /ec_users/{uid} {
      allow read, write: if isAuth() && request.auth.uid == uid;
    }

    match /ec_grupos/{groupId} {
      allow read: if isMember(groupId);
      allow create: if isAuth();
      allow update: if isAdmin(groupId);
      allow delete: if isAdmin(groupId);
    }

    match /ec_feed/{docId} {
      allow read: if isMember(resource.data.groupId);
      allow create: if isMember(request.resource.data.groupId);
      allow delete: if isAuth() && request.auth.uid == resource.data.authorUid;
    }
    match /ec_chat/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
    }
    match /ec_tareas/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
      allow update, delete: if isMember(resource.data.groupId);
    }
    match /ec_semestres/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
      allow delete: if isAdmin(resource.data.groupId);
    }
    match /ec_galerias/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
      allow delete: if isAdmin(resource.data.groupId);
    }
    match /ec_fotos/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
      allow delete: if isAdmin(resource.data.groupId);
    }
    match /ec_muro_fotos/{docId} {
      allow read, create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.authorUid;
    }
    match /ec_votaciones/{docId} {
      allow read: if isMember(resource.data.groupId);
      allow create: if isMember(request.resource.data.groupId);
      allow update: if isMember(resource.data.groupId);
    }
    match /ec_comentarios/{docId} {
      allow read, create: if isMember(request.resource.data.groupId);
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
| ⚡ **Feed** | Publicaciones de texto y fotos con likes y comentarios en tiempo real |
| 🙋 **Mi Muro** | Perfil personal con fotos propias y publicaciones del usuario |
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

### v1.1.0
- **Feed:** preview de fotos antes de publicar, con opción de quitar imágenes individuales. Feedback visual (botón de envío muestra ⏳) mientras se sube a Cloudinary.
- **Chat:** mensajes optimistas — el texto aparece al instante en pantalla sin esperar confirmación de Firestore. Layout adaptativo para móvil (fuente ≥15px en iOS para evitar zoom, burbujas más anchas, área de escritura más cómoda).
- **Miembros:** el modal `+ Invitar` ahora muestra la lista completa de miembros actuales del grupo con su nombre, correo y rol (Admin/Miembro) antes de agregar uno nuevo.
- **Grupos:** al cambiar de grupo activo se limpian correctamente todos los listeners activos (feed, chat, tareas, votaciones), evitando mezcla de datos entre grupos.
- **README:** renombrado completamente a ZonaEscolar, documentación de colecciones Firestore, changelog y notas técnicas actualizadas.

### v1.0.0
- Lanzamiento inicial: Auth Google, Feed, Chat, Tareas, Apuntes, Muro, Dinámicas (Ruleta, Votación, Trivia, Puntos), soporte PWA, tema oscuro/claro.
