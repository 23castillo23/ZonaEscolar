# EduCircle 🎓

Tu espacio escolar privado — apuntes, chat, tareas y dinámicas con tu grupo.

## Estructura de archivos

```
educircle/
├── index.html
├── sw.js
├── manifest.webmanifest
├── css/
│   └── style.css
├── js/
│   └── app.js
└── icons/
    └── icon.png   ← pon tu ícono aquí
```

## Cómo usar

1. **Sube estos archivos a tu hosting** (Netlify, Firebase Hosting, GitHub Pages, etc.)
2. **Configura las Firestore Security Rules** (ver abajo)
3. **Abre la app** → inicia sesión con Google → crea tu primer grupo → agrega a tus compañeros por correo Gmail

## Reglas de Firestore (Firebase Console → Firestore → Rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Solo usuarios autenticados
    function isAuth() {
      return request.auth != null;
    }

    // ¿El usuario es miembro del grupo?
    function isMember(groupId) {
      return isAuth() &&
        request.auth.token.email in
        get(/databases/$(database)/documents/ec_grupos/$(groupId)).data.miembros;
    }

    // ¿El usuario es admin del grupo?
    function isAdmin(groupId) {
      return isAuth() &&
        request.auth.uid ==
        get(/databases/$(database)/documents/ec_grupos/$(groupId)).data.adminUid;
    }

    // Usuarios
    match /ec_users/{uid} {
      allow read, write: if isAuth() && request.auth.uid == uid;
    }

    // Grupos — cualquier usuario autenticado puede crear
    match /ec_grupos/{groupId} {
      allow read: if isMember(groupId);
      allow create: if isAuth();
      allow update: if isAdmin(groupId);
      allow delete: if isAdmin(groupId);
    }

    // Feed, Chat, Tareas, Semestres, Galerias, Fotos, Votaciones
    // Solo miembros del grupo
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
    match /ec_votaciones/{docId} {
      allow read: if isMember(resource.data.groupId);
      allow create: if isMember(request.resource.data.groupId);
      allow update: if isMember(resource.data.groupId);
    }
  }
}
```

## Flujo de uso

1. **Admin crea grupo** → copia el nombre del grupo
2. **Admin agrega miembros** → escribe el correo Gmail de cada compañero
3. **Compañero entra con su cuenta Google** → automáticamente ve el grupo
4. **Todos publican en el feed, chatean, agregan tareas y juegan dinámicas**

## Módulos

| Módulo | Qué hace |
|---|---|
| 🔐 Auth | Google Login — sin contraseñas |
| ⚡ Feed | Publicaciones con fotos, texto, notificaciones de tareas |
| 📸 Apuntes | Fotos del pizarrón organizadas por semestre y materia (Cloudinary) |
| 💬 Chat | Mensajes en tiempo real (Firestore onSnapshot) |
| ✅ Tareas | Tareas con responsable, fecha límite y materia |
| 🎰 Ruleta | Elige al azar quién expone |
| 🗳️ Votación | Encuestas en tiempo real para el grupo |
| 🧠 Trivia | Banco de preguntas de repaso creado por el grupo |
| 🏆 Puntos | Marcador de puntos entre compañeros |

## Notas técnicas

- **Firebase proyecto**: fotoapuntes (mismo que FotoApuntes)
- **Cloudinary**: dwjzn6n0a / preset: escolar_unsigned
- **PWA**: instalable en móvil y escritorio
- **Sin backend propio**: todo corre en Firebase + Cloudinary
