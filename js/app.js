/**
 * EduCircle — app.js
 * Google Auth · Grupos privados · Feed · Chat · Tareas · Dinámicas
 * Cloudinary: dwjzn6n0a / preset: escolar_unsigned
 */

const CLOUDINARY_CLOUD = 'dwjzn6n0a';
const CLOUDINARY_PRESET = 'zonaescolar_unsigned';

/* ═══════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════ */
let currentUser = null;   // { uid, email, name, avatar }
let currentGroupId = null;   // grupo activo
let currentGroupData = null;  // datos del grupo activo
let isAdmin = false;  // ¿es admin del grupo?

let grupos = [];     // todos los grupos del usuario
let semestres = [];     // semestres de apuntes
let galerias = [];     // materias / galerías
let galeriaActual = null;   // galería de apuntes abierta
let apunteFiles = [];     // archivos pendientes de subir

let feedUnsub = null;
let chatUnsub = null;
let tareasUnsub = null;
let votacionUnsub = null;
let gruposUnsub = null;

let currentSection = 'feed';
let tareasFilter = 'all';
let lightboxPhotos = [];
let lightboxIdx = 0;

// Dinámicas locales
let ruletaMiembros = [];
let ruletaAngulo = 0;
let ruletaSpinning = false;
let triviaBanco = [];    // preguntas creadas
let triviaIdx = 0;
let triviaScore = 0;
let puntosMarcador = [];

const EMOJIS_SEMESTRE = ['📅', '📚', '🎓', '🌱', '☀️', '🍂', '❄️', '📖', '🏫', '✏️'];
const EMOJIS_MATERIA = ['📐', '🔬', '🌍', '📊', '💻', '🎨', '⚗️', '📝', '🔢', '🎭', '📜', '🔭', '💡', '🧮', '🏋️'];
const EMOJIS_GRUPO = ['👥', '🚀', '⭐', '🔥', '💎', '🌙', '🎯', '🏆', '🌈', '🎪'];

/* ═══════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function fmtTimeChat(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function waitForFirebase(cb) {
  if (window._firebaseReady) { cb(); return; }
  window.addEventListener('firebase-ready', cb, { once: true });
}
function db() { return window._db; }
function lib() { return window._fbLib; }

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
function initAuth() {
  waitForFirebase(() => {
    const { onAuthStateChanged } = lib();
    onAuthStateChanged(window._auth, async user => {
      if (user) {
        currentUser = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          avatar: user.photoURL || ''
        };
        showApp();
        await ensureUserDoc();
        loadGruposDelUsuario();
      } else {
        currentUser = null;
        showLogin();
      }
    });
  });
}

$('btnGoogleLogin').addEventListener('click', async () => {
  waitForFirebase(async () => {
    const { GoogleAuthProvider, signInWithPopup } = lib();
    try {
      await signInWithPopup(window._auth, new GoogleAuthProvider());
    } catch (e) {
      alert('Error al iniciar sesión: ' + e.message);
    }
  });
});

$('btnLogout').addEventListener('click', async () => {
  if (!confirm('¿Cerrar sesión?')) return;
  const { signOut } = lib();
  await signOut(window._auth);
});

async function ensureUserDoc() {
  const { doc, setDoc } = lib();
  try {
    await setDoc(doc(db(), 'ec_users', currentUser.uid), {
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      updatedAt: lib().serverTimestamp()
    }, { merge: true });
  } catch (_) { }
}

function showLogin() {
  $('loginScreen').style.display = 'flex';
  $('appShell').style.display = 'none';
}
function showApp() {
  $('loginScreen').style.display = 'none';
  $('appShell').style.display = 'flex';
  // Poblar avatares
  [$('userAvatar'), $('topbarAvatar'), $('composeAvatar')].forEach(el => {
    if (el) el.src = currentUser.avatar || '';
  });
  $('userName').textContent = currentUser.name;
  $('userRole').textContent = 'Miembro';
}

/* ═══════════════════════════════════════════════════
   GRUPOS
═══════════════════════════════════════════════════ */
async function loadGruposDelUsuario() {
  // Escuchar grupos donde el usuario es miembro (por email) o admin (por uid)
  const { collection, query, onSnapshot, where } = lib();

  if (gruposUnsub) gruposUnsub();

  // Escuchar grupos donde el usuario es miembro
  const q = query(
    collection(db(), 'ec_grupos'),
    where('miembros', 'array-contains', currentUser.email)
  );

  gruposUnsub = onSnapshot(q, snap => {
    grupos = [];
    snap.forEach(d => grupos.push({ id: d.id, ...d.data() }));
    renderGroupSelector();
    if (!currentGroupId && grupos.length > 0) {
      activarGrupo(grupos[0].id);
    } else if (grupos.length === 0) {
      showSection('noGroup');
    }
  });
}

function renderGroupSelector() {
  const sel = $('groupSelector');
  sel.innerHTML = grupos.map(g =>
    `<option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>
      ${escHtml(g.icon || '👥')} ${escHtml(g.name)}
    </option>`
  ).join('') || '<option value="">Sin grupos</option>';
}

$('groupSelector').addEventListener('change', e => {
  if (e.target.value) activarGrupo(e.target.value);
});

async function activarGrupo(groupId) {
  currentGroupId = groupId;
  currentGroupData = grupos.find(g => g.id === groupId) || null;
  isAdmin = currentGroupData?.adminUid === currentUser.uid;
  $('userRole').textContent = isAdmin ? 'Admin' : 'Miembro';
  $('topbarGroupBadge').textContent = currentGroupData ? `${currentGroupData.icon || '👥'} ${currentGroupData.name}` : '';
  renderGroupSelector();
  // Reiniciar listeners
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  // Activar sección actual
  activarSeccion(currentSection);
}

/* ── CREAR GRUPO ── */
function openModalCrearGrupo() {
  renderEmojiPicker('grupoEmojiPicker', EMOJIS_GRUPO, '👥', em => selectedGrupoEmoji = em);
  selectedGrupoEmoji = '👥';
  openModal('modalCrearGrupo');
}
let selectedGrupoEmoji = '👥';

$('btnCreateGroup').addEventListener('click', openModalCrearGrupo);
$('btnCreateGroupEmpty').addEventListener('click', openModalCrearGrupo);

$('btnConfirmarGrupo').addEventListener('click', async () => {
  const nombre = $('nuevoGrupoNombre').value.trim();
  const desc = $('nuevoGrupoDesc').value.trim();
  if (!nombre) { alert('Escribe el nombre del grupo.'); return; }
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const ref = await addDoc(collection(db(), 'ec_grupos'), {
      name: nombre,
      desc: desc,
      icon: selectedGrupoEmoji,
      adminUid: currentUser.uid,
      adminEmail: currentUser.email,
      miembros: [currentUser.email],  // admin es miembro automático
      createdAt: serverTimestamp()
    });
    closeModal('modalCrearGrupo');
    $('nuevoGrupoNombre').value = '';
    $('nuevoGrupoDesc').value = '';
    activarGrupo(ref.id);
  } catch (e) { alert('Error: ' + e.message); }
});

/* ── AGREGAR MIEMBRO ── */

// 1. Este es el botón NUEVO que abre la ventanita:
$('btnInvitarCompa').addEventListener('click', () => {
  openModal('modalAgregarMiembro');
});

// 2. Este es TU código original que guarda los datos cuando le das a "Agregar":
$('btnConfirmarMiembro').addEventListener('click', async () => {
  const email = $('miembroEmail').value.trim().toLowerCase();
  const nombre = $('miembroNombre').value.trim();
  if (!email || !nombre) { alert('Completa el correo y nombre.'); return; }
  if (!currentGroupId) return;
  const { doc, updateDoc, arrayUnion } = lib();
  try {
    await updateDoc(doc(db(), 'ec_grupos', currentGroupId), {
      miembros: arrayUnion(email),
      [`miembroNombres.${email.replace(/\./g, '_')}`]: nombre
    });
    closeModal('modalAgregarMiembro');
    $('miembroEmail').value = '';
    $('miembroNombre').value = '';
    alert(`✅ ${nombre} agregado al grupo.`);
  } catch (e) { alert('Error: ' + e.message); }
});

/* ═══════════════════════════════════════════════════
   NAVEGACIÓN
═══════════════════════════════════════════════════ */
qsa('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    currentSection = section;
    qsa('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const titles = { feed: 'Feed', apuntes: 'Apuntes', chat: 'Chat', tareas: 'Tareas', dinamicas: 'Dinámicas' };
    $('topbarTitle').textContent = titles[section] || 'EduCircle';
    activarSeccion(section);
    closeSidebar();
  });
});

function activarSeccion(section) {
  if (!currentGroupId) { showSection('noGroup'); return; }
  showSection(section);
  if (section === 'feed') initFeed();
  if (section === 'chat') initChat();
  if (section === 'tareas') initTareas();
  if (section === 'apuntes') initApuntes();
  if (section === 'dinamicas') initDinamicas();
}

function showSection(name) {
  qsa('.section').forEach(s => s.classList.remove('active'));
  const map = {
    noGroup: 'sectionNoGroup',
    feed: 'sectionFeed',
    apuntes: 'sectionApuntes',
    chat: 'sectionChat',
    tareas: 'sectionTareas',
    dinamicas: 'sectionDinamicas'
  };
  const el = $(map[name]);
  if (el) el.classList.add('active');
}

/* ── TOPBAR MENÚ (móvil) ── */
$('topbarMenu').addEventListener('click', openSidebar);
$('sidebarClose').addEventListener('click', closeSidebar);
$('sidebarOverlay').addEventListener('click', closeSidebar);

function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebarOverlay').classList.remove('show');
}

/* ═══════════════════════════════════════════════════
   FEED
═══════════════════════════════════════════════════ */
function initFeed() {
  if (feedUnsub) return; // ya activo
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc'),
    limit(40)
  );
  $('feedList').innerHTML = '<div class="feed-loading">Cargando…</div>';
  feedUnsub = onSnapshot(q, snap => {
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    renderFeed(posts);
  });
}

function renderFeed(posts) {
  if (!posts.length) {
    $('feedList').innerHTML = '<div class="feed-loading">El feed está vacío. ¡Sé el primero en publicar!</div>';
    return;
  }
  $('feedList').innerHTML = posts.map(p => buildFeedCard(p)).join('');
  // Ligar likes
  qsa('.feed-action-btn[data-like]').forEach(btn => {
    btn.addEventListener('click', () => toggleFeedLike(btn.dataset.like, btn));
  });
  // Ligar imágenes de feed para lightbox
  qsa('.feed-card-img, .feed-card-images-grid img').forEach((img, i) => {
    img.addEventListener('click', () => openLightboxFeed(img));
  });
}

function buildFeedCard(p) {
  const isMine = p.authorUid === currentUser.uid;
  const badgeTipo = p.type === 'foto' ? 'badge-foto' : (p.type === 'tarea' ? 'badge-tarea' : 'badge-texto');
  const badgeLabel = p.type === 'foto' ? '📷 Foto' : (p.type === 'tarea' ? '✅ Tarea' : '💬 Texto');
  let imgHtml = '';
  if (p.images && p.images.length > 0) {
    const cls = `count-${Math.min(p.images.length, 3)}`;
    imgHtml = `<div class="feed-card-images-grid ${cls}">
      ${p.images.slice(0, 3).map(url => `<img src="${escHtml(url)}" loading="lazy" alt="">`).join('')}
    </div>`;
  }
  return `<div class="feed-card">
    <div class="feed-card-header">
      <img class="feed-card-avatar" src="${escHtml(p.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
      <div class="feed-card-meta">
        <div class="feed-card-author">${escHtml(p.authorName || 'Anónimo')}</div>
        <div class="feed-card-time">${fmtTime(p.createdAt)}</div>
      </div>
      <span class="feed-card-type-badge ${badgeTipo}">${badgeLabel}</span>
    </div>
    ${p.text ? `<div class="feed-card-body"><p class="feed-card-text">${escHtml(p.text)}</p></div>` : ''}
    ${imgHtml}
    <div class="feed-card-actions">
      <button class="feed-action-btn ${p.likedBy?.includes(currentUser.uid) ? 'liked' : ''}" data-like="${p.id}">
        <span>${p.likedBy?.includes(currentUser.uid) ? '❤️' : '🤍'}</span> ${p.likes || 0}
      </button>
      ${isMine ? `<button class="feed-action-btn" onclick="eliminarPost('${p.id}')"><span>🗑️</span></button>` : ''}
    </div>
  </div>`;
}

async function toggleFeedLike(postId, btn) {
  const { doc, updateDoc, arrayUnion, arrayRemove, increment } = lib();
  const uid = currentUser.uid;
  const likedEl = btn;
  const isLiked = likedEl.classList.contains('liked');
  try {
    await updateDoc(doc(db(), 'ec_feed', postId), {
      likedBy: isLiked ? arrayRemove(uid) : arrayUnion(uid),
      likes: increment(isLiked ? -1 : 1)
    });
  } catch (e) { console.error(e); }
}

window.eliminarPost = async function (postId) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  const { doc, deleteDoc } = lib();
  await deleteDoc(doc(db(), 'ec_feed', postId));
};

/* ── PUBLICAR EN FEED ── */
let composeFiles = [];
$('composePhoto').addEventListener('change', e => {
  composeFiles = [...e.target.files];
});

$('composeSend').addEventListener('click', async () => {
  const text = $('composeInput').value.trim();
  if (!text && !composeFiles.length) return;
  if (!currentGroupId) return;

  $('composeSend').disabled = true;
  const { collection, addDoc, serverTimestamp } = lib();

  let images = [];
  if (composeFiles.length) {
    images = await Promise.all(composeFiles.map(f => uploadToCloudinary(f)));
    images = images.filter(Boolean);
    composeFiles = [];
    $('composePhoto').value = '';
  }

  try {
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      text: text || '',
      images: images,
      type: images.length ? 'foto' : 'texto',
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      likes: 0,
      likedBy: [],
      createdAt: serverTimestamp()
    });
    $('composeInput').value = '';
  } catch (e) { alert('Error al publicar: ' + e.message); }
  $('composeSend').disabled = false;
});

$('composeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composeSend').click(); }
});

/* ═══════════════════════════════════════════════════
   CHAT
═══════════════════════════════════════════════════ */
function initChat() {
  if (chatUnsub) return;
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc'),
    limit(80)
  );
  $('chatMessages').innerHTML = '<div class="feed-loading">Conectando…</div>';
  chatUnsub = onSnapshot(q, snap => {
    const msgs = [];
    snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
    renderChat(msgs);
  });
}

function renderChat(msgs) {
  if (!msgs.length) {
    $('chatMessages').innerHTML = '<div class="feed-loading">Aún no hay mensajes. ¡Rompe el hielo! 👋</div>';
    return;
  }
  $('chatMessages').innerHTML = msgs.map(m => {
    const mine = m.authorUid === currentUser.uid;
    return `<div class="chat-msg ${mine ? 'mine' : ''}">
      <img class="chat-msg-avatar" src="${escHtml(m.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
      <div class="chat-msg-wrap">
        ${!mine ? `<div class="chat-msg-author">${escHtml(m.authorName)}</div>` : ''}
        <div class="chat-msg-bubble">${escHtml(m.text)}</div>
        <div class="chat-msg-time">${fmtTimeChat(m.createdAt)}</div>
      </div>
    </div>`;
  }).join('');
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

async function enviarMensaje() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text || !currentGroupId) return;
  input.value = '';
  const { collection, addDoc, serverTimestamp } = lib();
  await addDoc(collection(db(), 'ec_chat'), {
    groupId: currentGroupId,
    text,
    authorUid: currentUser.uid,
    authorName: currentUser.name,
    authorAvatar: currentUser.avatar,
    createdAt: serverTimestamp()
  });
}

$('chatSend').addEventListener('click', enviarMensaje);
$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
});

/* ═══════════════════════════════════════════════════
   TAREAS
═══════════════════════════════════════════════════ */
function initTareas() {
  if (tareasUnsub) return;
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_tareas'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc')
  );
  $('tareasList').innerHTML = '<div class="feed-loading">Cargando…</div>';
  tareasUnsub = onSnapshot(q, snap => {
    const tareas = [];
    snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
    renderTareas(tareas);
  });
}

function renderTareas(tareas) {
  let filtradas = tareas;
  if (tareasFilter === 'pending') filtradas = tareas.filter(t => !t.done);
  if (tareasFilter === 'done') filtradas = tareas.filter(t => t.done);

  if (!filtradas.length) {
    $('tareasList').innerHTML = '<div class="feed-loading">No hay tareas aquí.</div>';
    return;
  }

  const now = new Date();
  $('tareasList').innerHTML = filtradas.map(t => {
    const vence = t.fecha ? new Date(t.fecha) : null;
    const vencida = vence && vence < now && !t.done;
    return `<div class="tarea-card ${t.done ? 'done' : ''}">
      <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}', ${!t.done})">${t.done ? '✓' : ''}</button>
      <div class="tarea-body">
        <div class="tarea-titulo">${escHtml(t.titulo)}</div>
        ${t.desc ? `<div class="tarea-desc">${escHtml(t.desc)}</div>` : ''}
        <div class="tarea-meta">
          ${t.responsable ? `<span class="tarea-badge badge-responsable">👤 ${escHtml(t.responsable)}</span>` : ''}
          ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
          ${vence ? `<span class="tarea-badge badge-fecha ${vencida ? 'vencida' : ''}">
            ${vencida ? '⚠️' : '📅'} ${vence.toLocaleDateString('es-MX')}
          </span>` : ''}
        </div>
      </div>
      <button class="tarea-delete" onclick="eliminarTarea('${t.id}')">🗑️</button>
    </div>`;
  }).join('');
}

window.toggleTarea = async function (id, done) {
  const { doc, updateDoc } = lib();
  await updateDoc(doc(db(), 'ec_tareas', id), { done });
};
window.eliminarTarea = async function (id) {
  if (!confirm('¿Eliminar tarea?')) return;
  const { doc, deleteDoc } = lib();
  await deleteDoc(doc(db(), 'ec_tareas', id));
};

// Filtros de tarea
qsa('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tareasFilter = btn.dataset.filter;
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Re-renderizar con los datos actuales
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
    initTareas();
  });
});

$('btnNuevaTarea').addEventListener('click', () => openModal('modalNuevaTarea'));
$('btnConfirmarTarea').addEventListener('click', async () => {
  const titulo = $('tareaTitulo').value.trim();
  if (!titulo) { alert('Escribe el título de la tarea.'); return; }
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const tarea = {
      groupId: currentGroupId,
      titulo,
      desc: $('tareaDesc').value.trim(),
      responsable: $('tareaResponsable').value.trim(),
      fecha: $('tareaFecha').value || null,
      materia: $('tareaMateria').value.trim(),
      done: false,
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db(), 'ec_tareas'), tarea);
    // Publicar en feed automáticamente
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      text: `📋 Nueva tarea: "${titulo}"${tarea.responsable ? ` · Responsable: ${tarea.responsable}` : ''}${tarea.fecha ? ` · Fecha: ${new Date(tarea.fecha).toLocaleDateString('es-MX')}` : ''}`,
      type: 'tarea',
      images: [],
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      likes: 0, likedBy: [],
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevaTarea');
    ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaMateria'].forEach(id => $(id).value = '');
  } catch (e) { alert('Error: ' + e.message); }
});

/* ═══════════════════════════════════════════════════
   APUNTES (heredado de FotoApuntes, adaptado a grupos)
═══════════════════════════════════════════════════ */
function initApuntes() {
  loadSemestres();
  setupApunteUpload();
}

function loadSemestres() {
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_semestres'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc')
  );
  onSnapshot(q, snap => {
    semestres = [];
    snap.forEach(d => semestres.push({ id: d.id, ...d.data() }));
    loadGalerias();
  });
}

function loadGalerias() {
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_galerias'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc')
  );
  onSnapshot(q, snap => {
    galerias = [];
    snap.forEach(d => galerias.push({ id: d.id, ...d.data() }));
    renderSemestres();
  });
}

function renderSemestres() {
  const container = $('apuntesGroupsContainer');
  if (!semestres.length) {
    container.innerHTML = `<div class="feed-loading">
      No hay semestres aún. Crea uno con "+ Semestre".
    </div>`;
    return;
  }
  container.innerHTML = semestres.map(sem => {
    const mats = galerias.filter(g => g.semestreId === sem.id);
    return `<div class="semestre-group" id="sem-${sem.id}">
      <div class="semestre-header" onclick="toggleSemestre('${sem.id}')">
        <span class="semestre-icon">${escHtml(sem.icon || '📅')}</span>
        <span class="semestre-name">${escHtml(sem.name)}</span>
        <span class="semestre-toggle">›</span>
      </div>
      <div class="materias-grid" style="display:none">
        ${mats.map(m => buildMateriaCard(m)).join('')}
        <div class="materia-card" onclick="openNewMateriaModal('${sem.id}')" style="border-style:dashed;opacity:0.5;">
          <div class="materia-card-icon">+</div>
          <div class="materia-card-name">Nueva materia</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.toggleSemestre = function (id) {
  const grup = $('sem-' + id);
  const grid = grup?.querySelector('.materias-grid');
  const tog = grup?.querySelector('.semestre-toggle');
  if (!grid) return;
  const open = grid.style.display !== 'none';
  grid.style.display = open ? 'none' : 'grid';
  grup.classList.toggle('open', !open);
};

function buildMateriaCard(m) {
  return `<div class="materia-card" onclick="abrirGaleria('${m.id}')">
    ${m.coverImage ? `<img class="materia-card-cover" src="${escHtml(m.coverImage)}" alt="">` : ''}
    <div class="materia-card-icon">${escHtml(m.icon || '📚')}</div>
    <div class="materia-card-name">${escHtml(m.name)}</div>
  </div>`;
}

window.abrirGaleria = function (galeriaId) {
  galeriaActual = galerias.find(g => g.id === galeriaId);
  if (!galeriaActual) return;
  $('galeriaTitle').textContent = `${galeriaActual.icon || '📚'} ${galeriaActual.name}`;
  $('apuntesGroupsContainer').style.display = 'none';
  $('apuntesGaleriaView').style.display = 'block';
  $('apuntesUploadZone').style.display = 'none';
  cargarFotosGaleria();
};

function cargarFotosGaleria() {
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_fotos'),
    where('galeriaId', '==', galeriaActual.id),
    orderBy('createdAt', 'desc')
  );
  const grid = $('apuntesGrid');
  grid.innerHTML = '<div class="feed-loading">Cargando fotos…</div>';
  onSnapshot(q, snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    renderFotosGaleria(fotos);
  });
}

function renderFotosGaleria(fotos) {
  lightboxPhotos = fotos;
  const grid = $('apuntesGrid');
  if (!fotos.length) {
    grid.innerHTML = '<div class="feed-loading">Sin fotos aún. ¡Sube tus apuntes!</div>';
    return;
  }
  grid.innerHTML = fotos.map((f, i) => `
    <div class="photo-thumb" onclick="openLightbox(${i})">
      <img src="${escHtml(f.url)}" loading="lazy" alt="">
      <div class="photo-thumb-overlay">
        <span class="photo-thumb-caption">${escHtml(f.caption || '')}</span>
      </div>
    </div>`).join('');
}

$('btnApuntesBack').addEventListener('click', () => {
  galeriaActual = null;
  $('apuntesGroupsContainer').style.display = 'block';
  $('apuntesGaleriaView').style.display = 'none';
});

$('btnUploadApunte').addEventListener('click', () => {
  const zone = $('apuntesUploadZone');
  zone.style.display = zone.style.display === 'none' ? 'block' : 'none';
});

function setupApunteUpload() {
  $('apunteFileInput').addEventListener('change', e => {
    apunteFiles = [...e.target.files];
    renderApuntePreview();
    $('btnApunteSend').disabled = !apunteFiles.length;
  });
  $('apunteCameraInput').addEventListener('change', e => {
    apunteFiles = [...e.target.files];
    renderApuntePreview();
    $('btnApunteSend').disabled = !apunteFiles.length;
  });

  $('btnApunteSend').addEventListener('click', async () => {
    if (!apunteFiles.length || !galeriaActual) return;
    const caption = $('apunteCaption').value.trim();
    $('apunteProgress').style.display = 'block';
    const { collection, addDoc, serverTimestamp } = lib();
    let done = 0;
    for (const file of apunteFiles) {
      const url = await uploadToCloudinary(file, galeriaActual.cloudinaryTag);
      if (url) {
        await addDoc(collection(db(), 'ec_fotos'), {
          galeriaId: galeriaActual.id,
          groupId: currentGroupId,
          url,
          caption,
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          createdAt: serverTimestamp()
        });
        // Publicar en feed
        await addDoc(collection(db(), 'ec_feed'), {
          groupId: currentGroupId,
          text: `Subió fotos de ${galeriaActual.icon || '📚'} ${galeriaActual.name}${caption ? `: ${caption}` : ''}`,
          type: 'foto',
          images: [url],
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          likes: 0, likedBy: [],
          createdAt: serverTimestamp()
        });
      }
      done++;
      $('apunteProgressBar').style.width = `${Math.round(done / apunteFiles.length * 100)}%`;
    }
    apunteFiles = [];
    $('apuntePreviewList').innerHTML = '';
    $('apunteCaption').value = '';
    $('btnApunteSend').disabled = true;
    setTimeout(() => { $('apunteProgress').style.display = 'none'; $('apunteProgressBar').style.width = '0%'; }, 800);
  });
}

function renderApuntePreview() {
  $('apuntePreviewList').innerHTML = apunteFiles.map(f => {
    const url = URL.createObjectURL(f);
    return `<div class="upload-preview-item"><img src="${url}" alt=""></div>`;
  }).join('');
}

/* ── MODALES APUNTES ── */
let selectedSemestreEmoji = '📅';
let selectedMateriaEmoji = '📚';

$('btnNewSubjectGroup').addEventListener('click', () => {
  renderEmojiPicker('semestreEmojiPicker', EMOJIS_SEMESTRE, '📅', em => selectedSemestreEmoji = em);
  selectedSemestreEmoji = '📅';
  openModal('modalNuevoSemestre');
});

$('btnConfirmarSemestre').addEventListener('click', async () => {
  const nombre = $('semestreNombre').value.trim();
  if (!nombre) { alert('Escribe el nombre.'); return; }
  const { collection, addDoc, serverTimestamp } = lib();
  await addDoc(collection(db(), 'ec_semestres'), {
    name: nombre,
    icon: selectedSemestreEmoji,
    groupId: currentGroupId,
    createdAt: serverTimestamp()
  });
  closeModal('modalNuevoSemestre');
  $('semestreNombre').value = '';
});

$('btnNewMateria').addEventListener('click', () => openNewMateriaModal(''));
window.openNewMateriaModal = function (semestreId) {
  renderEmojiPicker('materiaEmojiPicker', EMOJIS_MATERIA, '📚', em => selectedMateriaEmoji = em);
  selectedMateriaEmoji = '📚';
  $('materiaSemestreSelect').innerHTML =
    `<option value="">Sin semestre</option>` +
    semestres.map(s => `<option value="${s.id}" ${s.id === semestreId ? 'selected' : ''}>${escHtml(s.icon || '📅')} ${escHtml(s.name)}</option>`).join('');
  openModal('modalNuevaMateria');
};

$('btnConfirmarMateria').addEventListener('click', async () => {
  const nombre = $('materiaNombre').value.trim();
  if (!nombre) { alert('Escribe el nombre de la materia.'); return; }
  const tag = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const { collection, addDoc, serverTimestamp } = lib();
  await addDoc(collection(db(), 'ec_galerias'), {
    name: nombre,
    icon: selectedMateriaEmoji,
    semestreId: $('materiaSemestreSelect').value || '',
    cloudinaryTag: `ec_${tag}_${currentGroupId.slice(-6)}`,
    groupId: currentGroupId,
    coverImage: '',
    createdAt: serverTimestamp()
  });
  closeModal('modalNuevaMateria');
  $('materiaNombre').value = '';
});

/* ═══════════════════════════════════════════════════
   CLOUDINARY UPLOAD
═══════════════════════════════════════════════════ */
async function uploadToCloudinary(file, tag = '') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  if (tag) fd.append('tags', tag);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST', body: fd
    });
    const data = await res.json();
    return data.secure_url || null;
  } catch (e) {
    console.error('Cloudinary error:', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════════════ */
window.openLightbox = function (idx) {
  lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('open');
};

window.openLightboxFeed = function (imgEl) {
  lightboxPhotos = [{ url: imgEl.src, caption: '' }];
  lightboxIdx = 0;
  updateLightbox();
  $('lightbox').classList.add('open');
};

function updateLightbox() {
  const p = lightboxPhotos[lightboxIdx];
  if (!p) return;
  $('lightboxImg').src = p.url || p;
  $('lightboxCaption').textContent = p.caption || '';
  $('lightboxPrev').style.opacity = lightboxIdx > 0 ? '1' : '0.3';
  $('lightboxNext').style.opacity = lightboxIdx < lightboxPhotos.length - 1 ? '1' : '0.3';
}

$('lightboxClose').addEventListener('click', () => $('lightbox').classList.remove('open'));
$('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) $('lightbox').classList.remove('open'); });
$('lightboxPrev').addEventListener('click', () => { if (lightboxIdx > 0) { lightboxIdx--; updateLightbox(); } });
$('lightboxNext').addEventListener('click', () => { if (lightboxIdx < lightboxPhotos.length - 1) { lightboxIdx++; updateLightbox(); } });
document.addEventListener('keydown', e => {
  if (!$('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') $('lightbox').classList.remove('open');
  if (e.key === 'ArrowLeft' && lightboxIdx > 0) { lightboxIdx--; updateLightbox(); }
  if (e.key === 'ArrowRight' && lightboxIdx < lightboxPhotos.length - 1) { lightboxIdx++; updateLightbox(); }
});

/* ═══════════════════════════════════════════════════
   DINÁMICAS
═══════════════════════════════════════════════════ */
function initDinamicas() {
  initRuleta();
  loadVotacionActiva();
  renderPuntos();
  renderTriviaBanco();
}

/* ── BOTONES ABRIR DINÁMICAS ── */
qsa('.btn-dinamica[data-open]').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.open));
});

/* ─────────────── RULETA ─────────────── */
function initRuleta() {
  // Cargar miembros del grupo como participantes por defecto
  if (currentGroupData?.miembros) {
    // Intentar obtener nombres desde los datos del grupo
    const nombres = currentGroupData.miembros.map(email => {
      const key = email.replace(/\./g, '_');
      return currentGroupData.miembroNombres?.[key] || email.split('@')[0];
    });
    ruletaMiembros = nombres;
    $('ruletaMiembros').value = nombres.join('\n');
  } else {
    ruletaMiembros = [currentUser.name];
    $('ruletaMiembros').value = currentUser.name;
  }
  dibujarRuleta();
}

$('btnRuletaActualizar').addEventListener('click', () => {
  ruletaMiembros = $('ruletaMiembros').value.split('\n').map(s => s.trim()).filter(Boolean);
  dibujarRuleta();
  $('ruletaResultado').textContent = '';
});

$('btnSpin').addEventListener('click', () => {
  if (ruletaSpinning || !ruletaMiembros.length) return;
  ruletaSpinning = true;
  $('ruletaResultado').textContent = '⏳';
  $('btnSpin').disabled = true;
  const extra = Math.floor(Math.random() * 3 + 5) * 360 +
    Math.floor(Math.random() * 360);
  const total = ruletaAngulo + extra;
  const duration = 4000;
  const start = performance.now();
  const startAngle = ruletaAngulo;

  function step(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 4);
    ruletaAngulo = startAngle + extra * ease;
    dibujarRuleta();
    if (t < 1) { requestAnimationFrame(step); }
    else {
      ruletaSpinning = false;
      $('btnSpin').disabled = false;
      const n = ruletaMiembros.length;
      const segAngle = 360 / n;
      const normalized = (((-ruletaAngulo % 360) + 360) % 360);
      const idx = Math.floor(normalized / segAngle) % n;
      $('ruletaResultado').textContent = `🎯 ${ruletaMiembros[idx]}`;
    }
  }
  requestAnimationFrame(step);
});

function dibujarRuleta() {
  const canvas = $('ruletaCanvas');
  const ctx = canvas.getContext('2d');
  const cx = 150, cy = 150, r = 140;
  const n = ruletaMiembros.length || 1;
  const segAngle = (Math.PI * 2) / n;
  const colores = ['#7c6af7', '#a594f9', '#4f46e5', '#6366f1', '#818cf8', '#c4b5fd', '#8b5cf6', '#ddd6fe'];

  ctx.clearRect(0, 0, 300, 300);

  for (let i = 0; i < n; i++) {
    const start = (ruletaAngulo * Math.PI / 180) + i * segAngle - Math.PI / 2;
    const end = start + segAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = colores[i % colores.length];
    ctx.strokeStyle = '#0e0e16';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Texto
    const midAngle = start + segAngle / 2;
    const tx = cx + (r * 0.65) * Math.cos(midAngle);
    const ty = cy + (r * 0.65) * Math.sin(midAngle);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    const nombre = ruletaMiembros[i] || '';
    ctx.fillText(nombre.length > 10 ? nombre.slice(0, 9) + '…' : nombre, 0, 0);
    ctx.restore();
  }

  // Centro
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0e16';
  ctx.fill();
  ctx.strokeStyle = '#7c6af7';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ─────────────── VOTACIÓN ─────────────── */
$('btnAgregarOpcion').addEventListener('click', () => {
  const wrap = $('votacionOpcionesInputs');
  const n = wrap.querySelectorAll('.opcion-input').length + 1;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'modal-input opcion-input';
  inp.placeholder = `Opción ${n}`;
  wrap.appendChild(inp);
});

$('btnLanzarVotacion').addEventListener('click', async () => {
  const pregunta = $('votacionPregunta').value.trim();
  const opciones = [...qsa('.opcion-input')].map(i => i.value.trim()).filter(Boolean);
  if (!pregunta || opciones.length < 2) { alert('Agrega una pregunta y al menos 2 opciones.'); return; }
  const { collection, addDoc, serverTimestamp } = lib();
  await addDoc(collection(db(), 'ec_votaciones'), {
    groupId: currentGroupId,
    pregunta,
    opciones,
    votos: {},
    votantes: [],
    activa: true,
    createdAt: serverTimestamp()
  });
  $('votacionPregunta').value = '';
  qsa('.opcion-input').forEach(i => i.value = '');
});

async function loadVotacionActiva() {
  if (!currentGroupId) return;
  if (votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_votaciones'),
    where('groupId', '==', currentGroupId),
    where('activa', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  votacionUnsub = onSnapshot(q, snap => {
    if (!snap.empty) {
      const vot = { id: snap.docs[0].id, ...snap.docs[0].data() };
      renderVotacionActiva(vot);
    } else {
      $('votacionActiva').style.display = 'none';
      $('votacionCrear').style.display = 'block';
    }
  });
}

function renderVotacionActiva(v) {
  $('votacionActiva').style.display = 'block';
  $('votacionCrear').style.display = 'none';
  $('votacionPreguntaText').textContent = v.pregunta;
  const yaVoto = v.votantes?.includes(currentUser.uid);
  const totalVotos = Object.values(v.votos || {}).reduce((a, b) => a + b, 0);

  $('votacionOpciones').innerHTML = yaVoto ? '' :
    v.opciones.map((op, i) =>
      `<button class="votacion-opcion-btn" onclick="votar('${v.id}', ${i}, '${escHtml(op)}')">${escHtml(op)}</button>`
    ).join('');

  $('votacionResultados').innerHTML = v.opciones.map((op, i) => {
    const cnt = v.votos?.[i] || 0;
    const pct = totalVotos ? Math.round(cnt / totalVotos * 100) : 0;
    return `<div class="votacion-resultado-item">
      <span class="votacion-bar-label">${escHtml(op)}</span>
      <div class="votacion-bar-wrap"><div class="votacion-bar" style="width:${pct}%"></div></div>
      <span class="votacion-bar-count">${cnt}</span>
    </div>`;
  }).join('');
}

window.votar = async function (votacionId, opcionIdx, opcionNombre) {
  const { doc, updateDoc, arrayUnion, increment } = lib();
  await updateDoc(doc(db(), 'ec_votaciones', votacionId), {
    [`votos.${opcionIdx}`]: increment(1),
    votantes: arrayUnion(currentUser.uid)
  });
};

$('btnCerrarVotacion').addEventListener('click', async () => {
  if (!confirm('¿Cerrar esta votación?')) return;
  // Buscar la votación activa
  const { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } = lib();
  const q = query(
    collection(db(), 'ec_votaciones'),
    where('groupId', '==', currentGroupId),
    where('activa', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(doc(db(), 'ec_votaciones', snap.docs[0].id), { activa: false });
  }
});

/* ─────────────── TRIVIA ─────────────── */
function renderTriviaBanco() {
  $('triviaBanco').innerHTML = triviaBanco.length
    ? `<p style="font-size:12px;color:var(--text2);margin-bottom:8px">${triviaBanco.length} pregunta(s) lista(s)</p>` +
    triviaBanco.map((p, i) => `<div class="trivia-banco-item">
        <span>${escHtml(p.pregunta)}</span>
        <button onclick="triviaEliminar(${i})" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:12px">✕</button>
      </div>`).join('')
    : '<p style="font-size:12px;color:var(--text2)">Agrega preguntas antes de iniciar.</p>';
}

window.triviaEliminar = function (i) {
  triviaBanco.splice(i, 1);
  renderTriviaBanco();
};

$('btnAgregarPregunta').addEventListener('click', () => {
  const pregunta = $('triviaPreguntaInput').value.trim();
  const resps = qsa('.trivia-resp-input').map(i => i.value.trim()).filter(Boolean);
  if (!pregunta || resps.length < 2) { alert('Agrega la pregunta y al menos la respuesta correcta + 1 opción.'); return; }
  triviaBanco.push({ pregunta, respuestas: resps }); // respuestas[0] = correcta
  $('triviaPreguntaInput').value = '';
  qsa('.trivia-resp-input').forEach(i => i.value = '');
  renderTriviaBanco();
});

$('btnIniciarTrivia').addEventListener('click', () => {
  if (!triviaBanco.length) { alert('Agrega al menos una pregunta.'); return; }
  triviaIdx = 0;
  triviaScore = 0;
  $('triviaCrear').style.display = 'none';
  $('triviaJuego').style.display = 'block';
  mostrarPreguntaTrivia();
});

function mostrarPreguntaTrivia() {
  if (triviaIdx >= triviaBanco.length) {
    // Fin
    $('triviaJuego').innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:40px;margin-bottom:12px">🏆</div>
      <h3 style="font-family:var(--font-display);font-size:22px;margin-bottom:8px">¡Trivia terminada!</h3>
      <p style="color:var(--text1)">Puntuación: <strong>${triviaScore} / ${triviaBanco.length}</strong></p>
      <button class="btn-primary" style="margin-top:20px" onclick="reiniciarTrivia()">Jugar de nuevo</button>
    </div>`;
    return;
  }

  const p = triviaBanco[triviaIdx];
  // Mezclar opciones
  const opciones = [...p.respuestas].sort(() => Math.random() - 0.5);
  const correcta = p.respuestas[0];

  $('triviaProgreso').textContent = `Pregunta ${triviaIdx + 1} de ${triviaBanco.length} · Puntos: ${triviaScore}`;
  $('triviaPreguntaText').textContent = p.pregunta;
  $('triviaFeedback').textContent = '';
  $('triviaOpciones').innerHTML = opciones.map(op =>
    `<button class="trivia-opcion" onclick="responderTrivia('${escHtml(op)}', '${escHtml(correcta)}', this)">
      ${escHtml(op)}
    </button>`
  ).join('');
}

window.responderTrivia = function (elegida, correcta, btn) {
  qsa('.trivia-opcion').forEach(b => { b.disabled = true; });
  const correcto = elegida === correcta;
  if (correcto) {
    btn.classList.add('correcto');
    triviaScore++;
    $('triviaFeedback').textContent = '✅ ¡Correcto!';
    $('triviaFeedback').style.color = 'var(--green)';
  } else {
    btn.classList.add('incorrecto');
    qsa('.trivia-opcion').forEach(b => {
      if (b.textContent.trim() === correcta) b.classList.add('correcto');
    });
    $('triviaFeedback').textContent = `❌ Era: ${correcta}`;
    $('triviaFeedback').style.color = 'var(--red)';
  }
  setTimeout(() => { triviaIdx++; mostrarPreguntaTrivia(); }, 1800);
};

window.reiniciarTrivia = function () {
  $('triviaJuego').style.display = 'none';
  $('triviaCrear').style.display = 'block';
  $('triviaJuego').innerHTML = `
    <div class="trivia-progreso" id="triviaProgreso"></div>
    <div class="trivia-pregunta" id="triviaPreguntaText"></div>
    <div class="trivia-opciones" id="triviaOpciones"></div>
    <div class="trivia-feedback" id="triviaFeedback"></div>`;
};

/* ─────────────── PUNTOS ─────────────── */
function renderPuntos() {
  const marc = $('puntosMarcador');
  if (!puntosMarcador.length) {
    marc.innerHTML = '<div class="feed-loading" style="padding:20px 0">Agrega jugadores abajo.</div>';
    return;
  }
  const sorted = [...puntosMarcador].sort((a, b) => b.pts - a.pts);
  marc.innerHTML = sorted.map((j, i) => `
    <div class="puntos-jugador">
      <span style="font-size:16px;opacity:0.6">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
      <span class="puntos-jugador-nombre">${escHtml(j.nombre)}</span>
      <div class="puntos-btns">
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}', -1)">−</button>
        <span class="puntos-num">${j.pts}</span>
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}', 1)">+</button>
      </div>
    </div>`).join('');
}

$('btnAgregarJugador').addEventListener('click', () => {
  const nombre = $('puntosNombre').value.trim();
  if (!nombre) return;
  if (!puntosMarcador.find(j => j.nombre === nombre)) {
    puntosMarcador.push({ nombre, pts: 0 });
    renderPuntos();
  }
  $('puntosNombre').value = '';
});
$('btnResetPuntos').addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos los puntos?')) return;
  puntosMarcador.forEach(j => j.pts = 0);
  renderPuntos();
});
window.cambiarPuntos = function (nombre, delta) {
  const j = puntosMarcador.find(j => j.nombre === nombre);
  if (j) { j.pts = Math.max(0, j.pts + delta); renderPuntos(); }
};

/* ═══════════════════════════════════════════════════
   MODALES — utilidades
═══════════════════════════════════════════════════ */
function openModal(id) { $(id)?.classList.add('open'); }
function closeModal(id) { $(id)?.classList.remove('open'); }

// Cerrar por botón .modal-close
document.addEventListener('click', e => {
  const closeBtn = e.target.closest('.modal-close[data-close]');
  if (closeBtn) closeModal(closeBtn.dataset.close);
  // Cerrar por btn-cancel con data-close
  const cancelBtn = e.target.closest('.btn-cancel[data-close]');
  if (cancelBtn) closeModal(cancelBtn.dataset.close);
  // Cerrar al hacer clic en overlay
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

/* ═══════════════════════════════════════════════════
   EMOJI PICKER
═══════════════════════════════════════════════════ */
function renderEmojiPicker(containerId, emojis, selected, onChange) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = emojis.map(em =>
    `<span class="emoji-option ${em === selected ? 'selected' : ''}" data-em="${em}">${em}</span>`
  ).join('');
  container.querySelectorAll('.emoji-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      onChange(opt.dataset.em);
    });
  });
}

/* ═══════════════════════════════════════════════════
   ARRANQUE
═══════════════════════════════════════════════════ */
waitForFirebase(() => initAuth());

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  });
}
