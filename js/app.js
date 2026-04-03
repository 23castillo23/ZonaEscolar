/**
 * ZonaEscolar — app.js
 * Google Auth · Grupos privados · Feed + Comentarios + Likes
 * Chat · Tareas · Muro Personal · Apuntes · Dinámicas
 * Cloudinary: dwjzn6n0a / preset: zonaescolar_unsigned
 */

const CLOUDINARY_CLOUD = 'dwjzn6n0a';
const CLOUDINARY_PRESET = 'zonaescolar_unsigned';

/* ═══════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════ */
let currentUser = null;
let currentGroupId = null;
let currentGroupData = null;
let isAdmin = false;

let grupos = [];
let semestres = [];
let galerias = [];
let galeriaActual = null;
let apunteFiles = [];

let feedUnsub = null;
let chatUnsub = null;
let tareasUnsub = null;
let votacionUnsub = null;
let gruposUnsub = null;
let chatTypingUnsub = null;
let chatOnlineUnsub = null;
let _typingTimeout = null;
let _onlineHeartbeatTimer = null;
let chatLastReadMs = 0;

let currentSection = 'feed';
let tareasFilter = 'all';
let tareasVistaCalendario = false;
let lightboxPhotos = [];
let lightboxIdx = 0;

let ruletaMiembros = [];
let ruletaAngulo = 0;
let ruletaSpinning = false;
let triviaBanco = [];
let triviaIdx = 0;
let triviaScore = 0;
let puntosMarcador = [];
let bibliotecaUnsub = null;
let sidebarOnlineUnsub = null;

// ── TABLEROS TEMÁTICOS ──
let tablerosUnsub = null;
let currentTableroId = null;   // null = feed general
let tableroFeedUnsub = null;   // listener del feed filtrado por tablero


let semestresAbiertos = new Set(); // Recuerda qué semestres están abiertos
let scrollPosicionApuntes = 0;
let ordenSemestres = localStorage.getItem('ze_orden_semestres') || 'creacion'; 
let ordenMaterias = localStorage.getItem('ze_orden_materias') || 'creacion';
let semestresUnsub = null;
let galeriasUnsub = null;
let apuntesSearchTerm = '';
let selectedBiblioColor = 'book-pdf';
let catBiblioUnsub = null;
let biblioCategorias = [];
let bibliotecaUiBound = false;
let calDiaSeleccionado = null;

const EMOJIS_SEMESTRE = [
  '📅', '📚', '🎓', '🌱', '☀️', '🍂', '❄️', '📖', '🏫', '✏️',
  '🗓️', '🌸', '🌻', '🍃', '🌊', '⭐', '🔖', '🎒', '🖊️', '📋',
  '🏆', '🌙', '🎯', '🧩', '🌈', '🎪', '🚀', '💫', '🎀', '🌟'
];
const EMOJIS_MATERIA = [
  // Matemáticas y Exactas
  '📐', '🔢', '🧮', '📊', '➕', '➗', '🔣', '∫', 'π', '📈',
  // Ciencias
  '🔬', '⚗️', '🧪', '🧫', '🧬', '🔭', '⚛️', '🌡️', '🧲', '💊',
  // Tecnología y Sistemas
  '💻', '🖥️', '📱', '⌨️', '🖱️', '🖨️', '💾', '💿', '🔌', '🛜',
  '🤖', '👾', '🕹️', '📡', '🔧', '⚙️', '🛠️', '🔩', '🖧', '📟',
  // Humanidades y Sociales
  '🌍', '🗺️', '📜', '🏛️', '🗽', '⚖️', '🏦', '📰', '🎭', '🗣️',
  // Arte y Diseño
  '🎨', '✏️', '🖌️', '🖍️', '📸', '🎬', '🎵', '🎼', '🎹', '🎸',
  // Idiomas y Literatura
  '📝', '📖', '✍️', '🔤', '💬', '📕', '📗', '📘', '📙', '🔡',
  // Economía y Admin
  '💰', '📉', '🏢', '💼', '🤝', '📦', '🏪', '💳', '🧾', '📑',
  // Salud y Deportes
  '🏃', '⚽', '🏀', '🏊', '🧘', '💪', '🦷', '🩺', '🧠', '🫀',
  // General Escolar
  '🏫', '🎒', '📏', '📌', '📍', '🗂️', '🗃️', '📂', '🗒️', '⏰'
];
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
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function fmtTimeChat(ts) {
  if (!ts) return 'Enviando...'; // Evita que se rompa si el mensaje es nuevo
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'Enviando...';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateChat(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getChatMsgMillis(m) {
  const ts = m?.createdAt ?? m?.timestamp ?? m?.fecha ?? m?.date ?? null;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    return Number.isFinite(d?.getTime?.()) ? d.getTime() : 0;
  }
  const d = new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}
function getChatMsgDate(m) {
  const ts = m?.createdAt ?? m?.timestamp ?? m?.fecha ?? m?.date ?? null;
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    return (d instanceof Date && Number.isFinite(d.getTime())) ? d : null;
  }
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}
function waitForFirebase(cb) {
  if (window._firebaseReady) { cb(); return; }
  window.addEventListener('firebase-ready', cb, { once: true });
}
function db() { return window._db; }
function lib() { return window._fbLib; }

// Función para convertir links de Drive a links directos de previsualización
function limpiarLinkDrive(url) {
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/(.+?)\/(view|edit|usp|preview)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  }
  return url;
}

/* ═══════════════════════════════════════════════════
   MODO OSCURO / CLARO
═══════════════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem('ze_theme') || 'dark';
  applyTheme(saved);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  const btn = $('btnThemeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  const meta = $('metaThemeColor');
  if (meta) meta.content = theme === 'light' ? '#ffffff' : '#1a1a2e';
  localStorage.setItem('ze_theme', theme);
}
$('btnThemeToggle').addEventListener('click', () => {
  const current = localStorage.getItem('ze_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

function getAvatarHtml(url, name, extraClass = '') {
  const initial = (name || '?').charAt(0).toUpperCase();
  const safeUrl = (url && typeof url === 'string') ? url.trim() : '';

  if (safeUrl !== '') {
    // Si hay URL, intentamos cargar la imagen
    return `
      <div class="avatar-fallback-container ${extraClass}">
        <img src="${escHtml(safeUrl)}" class="${extraClass}" alt="" 
             style="display:block; width:100%; height:100%; object-fit:cover; border-radius:50%;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="sidebar-member-initial ${extraClass}" style="display:none; width:100%; height:100%;">${initial}</div>
      </div>`;
  }
  // Si no hay URL, ponemos la inicial directo
  return `<div class="sidebar-member-initial ${extraClass}">${initial}</div>`;
}

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
function initAuth() {
  waitForFirebase(() => {
    const { onAuthStateChanged } = lib();
    onAuthStateChanged(window._auth, async user => {
      if (user) {
        // Primero cargamos lo básico de Google
        currentUser = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          avatar: user.photoURL || ''
        };
        // Luego intentamos leer el perfil guardado en Firestore (nombre/avatar personalizados)
        try {
          const { doc, getDoc } = lib();
          const snap = await getDoc(doc(db(), 'ec_users', user.uid));
          if (snap.exists()) {
            const d = snap.data();
            if (d.name) currentUser.name = d.name;
            if (d.avatar !== undefined && d.avatar !== null) currentUser.avatar = d.avatar;
          }
        } catch (_) { }
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
  refreshAvatarUI();
  $('userName').textContent = getUserAlias();
  $('userRole').textContent = 'Integrante';
  if ($('muroNombre')) $('muroNombre').textContent = getUserAlias();
  initChatBurbuja();
  showSection('loading');
}

// --- NUEVO: Función para obtener el nombre específico en este grupo ---
window.getUserAlias = function () {
  if (currentGroupData && currentGroupData.miembroNombres) {
    const key = currentUser.email.replace(/\./g, '_');
    if (currentGroupData.miembroNombres[key]) {
      return currentGroupData.miembroNombres[key];
    }
  }
  return currentUser.name;
};

/** Actualiza todos los elementos de avatar/nombre en la UI con los datos actuales de currentUser */
function refreshAvatarUI() {
  const av = currentUser.avatar || '';
  const isEmoji = av && [...av].length <= 2 && !av.startsWith('http');
  const isUrl = av && av.startsWith('http');
  const initial = (currentUser.name || '?').charAt(0).toUpperCase();

  // Imágenes de avatar en topbar, sidebar, compose, chat
  [$('userAvatar'), $('topbarAvatar'), $('composeAvatar')].forEach(el => {
    if (!el) return;
    if (isUrl) { el.src = av; el.style.display = ''; }
    else { el.src = ''; el.style.display = 'none'; }
  });

  // Avatar grande del muro — solo si es mi muro
  const muroAv = $('muroAvatar');
  const muroFb = $('muroAvatarFallback');
  if (muroAv && muroFb && !muroViendoUid) {
    if (isUrl) {
      muroAv.src = av; muroAv.style.display = 'block'; muroFb.style.display = 'none';
    } else {
      muroAv.style.display = 'none'; muroFb.style.display = 'flex';
      muroFb.textContent = isEmoji ? av : initial;
    }
  }

  // Avatar lateral (sidebar pill)
  const userAvEl = $('userAvatar');
  if (userAvEl) {
    if (!isUrl) {
      userAvEl.style.display = 'none';
      // Mostrar inicial en el pill si no hay foto URL
      let pill = $('userPillInitial');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'userPillInitial';
        pill.className = 'sidebar-member-initial';
        pill.style.cssText = 'width:36px;height:36px;font-size:16px;flex-shrink:0;';
        userAvEl.parentElement.insertBefore(pill, userAvEl);
      }
      pill.textContent = isEmoji ? av : initial;
      pill.style.display = 'flex';
    } else {
      const pill = $('userPillInitial');
      if (pill) pill.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════════════════
   GRUPOS
═══════════════════════════════════════════════════ */
async function loadGruposDelUsuario() {
  const { collection, query, onSnapshot, where } = lib();
  if (gruposUnsub) gruposUnsub();

  let primerSnapshot = true;

  const q = query(
    collection(db(), 'ec_grupos'),
    where('miembros', 'array-contains', currentUser.email)
  );

  gruposUnsub = onSnapshot(q, snap => {
    grupos = [];
    snap.forEach(d => grupos.push({ id: d.id, ...d.data() }));

    if (primerSnapshot) {
      primerSnapshot = false;
      // Primera carga: decidir qué mostrar
      if (grupos.length > 0) {
        // Restaurar último grupo usado si sigue disponible
        const lastId = localStorage.getItem('ze_last_group');
        const target = lastId && grupos.find(g => g.id === lastId)
          ? lastId : grupos[0].id;
        activarGrupo(target);
      } else {
        showSection('noGroup');
        // 👇 NUEVO: Ocultar botón invitar si la cuenta es nueva y no hay grupos
        if ($('btnInvitarCompa')) $('btnInvitarCompa').style.display = 'none';
      }
    } else {
      // Actualizaciones en tiempo real: refrescar selector y datos del grupo activo
      renderGroupSelector();
      renderSidebarMiembros();
      if (currentGroupId) {
        currentGroupData = grupos.find(g => g.id === currentGroupId) || currentGroupData;
      }
    }
  }, err => {
    console.error('Error cargando grupos:', err);
    showSection('noGroup');
  });
}

function renderGroupSelector() {
  const sel = $('groupSelector');

  // Separar los grupos
  const misGruposAdmin = grupos.filter(g => g.adminUid === currentUser.uid);
  const misGruposMiembro = grupos.filter(g => g.adminUid !== currentUser.uid);

  let html = '';

  if (misGruposAdmin.length > 0) {
    html += `<optgroup label="👑 GRUPOS QUE ADMINISTRO">`;
    html += misGruposAdmin.map(g =>
      `<option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>
        ${escHtml(g.icon || '👥')} ${escHtml(g.name)}
      </option>`
    ).join('');
    html += `</optgroup>`;
  }

  if (misGruposMiembro.length > 0) {
    html += `<optgroup label="👥 GRUPOS EN LOS QUE ESTOY">`;
    html += misGruposMiembro.map(g =>
      `<option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>
        ${escHtml(g.icon || '👥')} ${escHtml(g.name)}
      </option>`
    ).join('');
    html += `</optgroup>`;
  }

  sel.innerHTML = html || '<option value="">Sin grupos</option>';
}

$('groupSelector').addEventListener('change', e => {
  if (e.target.value) activarGrupo(e.target.value);
});

async function activarGrupo(groupId) {
  currentGroupId = groupId;
  currentGroupData = grupos.find(g => g.id === groupId) || null;

  // Aquí la app detecta si eres el creador del grupo
  isAdmin = currentGroupData?.adminUid === currentUser.uid;
  localStorage.setItem('ze_last_group', groupId);

  $('userRole').textContent = isAdmin ? 'Admin' : 'Integrante';
  $('topbarGroupBadge').textContent = currentGroupData
    ? `${currentGroupData.icon || '👥'} ${currentGroupData.name}` : '';

  // --- MOSTRAR/OCULTAR BOTONES SEGÚN TU ROL ---

  // 1. Botón de Eliminar Grupo
  const btnDelete = $('btnDeleteGroup');
  if (btnDelete) btnDelete.style.display = isAdmin ? 'inline-block' : 'none';

  // 2. Botón de + Invitar (Oculto para los miembros normales)
  const btnInvitar = $('btnInvitarCompa');
  if (btnInvitar) btnInvitar.style.display = isAdmin ? 'inline-block' : 'none';

  // ------------------------------------------

  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  if (votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }
  if (chatTypingUnsub) { chatTypingUnsub(); chatTypingUnsub = null; }
  if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
  if (tablerosUnsub) { tablerosUnsub(); tablerosUnsub = null; }
  if (tableroFeedUnsub) { tableroFeedUnsub(); tableroFeedUnsub = null; }
  currentTableroId = null;
  if (sidebarOnlineUnsub) { sidebarOnlineUnsub(); sidebarOnlineUnsub = null; }
  if (dvdUnsub) { dvdUnsub(); dvdUnsub = null; }
  if (_onlineHeartbeatTimer) { clearInterval(_onlineHeartbeatTimer); _onlineHeartbeatTimer = null; }
  if (_typingTimeout) { clearTimeout(_typingTimeout); _typingTimeout = null; }
  bibliotecaUiBound = false;

  renderGroupSelector();
  renderSidebarMiembros();

  _setOnlineStatus();
  _onlineHeartbeatTimer = setInterval(() => {
    if (currentGroupId && currentUser) _setOnlineStatus();
  }, 25000);
  initSidebarOnlinePresence();

  hookBurbujaEnGrupo();

  // Mostrar FAB del chat burbuja
  const fab = $('chatFab');

  // Pedir permiso de notificaciones del sistema (si aún no se ha dado)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => { });
  }
  if (fab) fab.style.display = 'flex';

  // Restaurar última sección usada
  const lastSection = localStorage.getItem('ze_last_section') || 'feed';
  currentSection = lastSection;
  setActiveNav(lastSection);
  activarSeccion(lastSection);
}

/* ── MIEMBROS EN SIDEBAR ── */
function renderSidebarMiembros() {
  const container = $('sidebarMiembros');
  if (!container || !currentGroupData) return;
  const miembros = currentGroupData.miembros || [];
  const nombres = currentGroupData.miembroNombres || {};
  if (!miembros.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="sidebar-members-label">👥 Integrantes del grupo</div>
    <div class="sidebar-members-list">
      ${miembros.map(email => {
    const key = email.replace(/\./g, '_');
    const nombre = nombres[key] || email.split('@')[0];
    const esYo = email === currentUser.email;
    const esAdminGrupo = email === currentGroupData.adminEmail;

    // Botón de expulsar respetuoso (solo 'X')
    const btnExpulsar = (isAdmin && !esYo)
      ? `<button class="btn-expulsar" title="Quitar integrante" onclick="event.stopPropagation(); expulsarMiembro('${escHtml(email)}')">✕</button>`
      : '';

    return `<div class="sidebar-member-btn ${esYo ? 'me' : ''}" data-email="${escHtml(email)}" style="display:flex; align-items:center; cursor:pointer;" onclick="verMuroDeUsuario('${escHtml(email)}','${escHtml(nombre)}')">
          <span class="sidebar-member-initial-wrap">
            <span class="sidebar-member-initial">${escHtml(nombre.charAt(0).toUpperCase())}</span>
            <span class="sidebar-online-dot" title="En línea"></span>
          </span>
          <span class="sidebar-member-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(nombre)}${esYo ? ' (tú)' : ''}${esAdminGrupo ? ' ⭐' : ''}</span>
          ${btnExpulsar}
        </div>`;
  }).join('')}
    </div>`;
}

window.expulsarMiembro = async function (emailExpulsado) {
  if (!confirm(`¿Estás seguro de expulsar a ${emailExpulsado} del grupo?`)) return;
  const { doc, updateDoc, arrayRemove } = lib();
  try {
    await updateDoc(doc(db(), 'ec_grupos', currentGroupId), {
      miembros: arrayRemove(emailExpulsado)
    });
    alert(`El usuario ${emailExpulsado} ha sido expulsado.`);
  } catch (e) {
    alert('Error al expulsar: ' + e.message);
  }
};

/* Ver muro de otro miembro */
let muroViendoUid = null;
let muroViendoEmail = null;
let muroViendoNombre = null;

// verMuroDeUsuario se declara más abajo (línea ~1465) con la versión completa y async

/* ── CREAR GRUPO ── */
let selectedGrupoEmoji = '👥';
function openModalCrearGrupo() {
  renderEmojiPicker('grupoEmojiPicker', EMOJIS_GRUPO, '👥', em => selectedGrupoEmoji = em);
  selectedGrupoEmoji = '👥';
  openModal('modalCrearGrupo');
}
$('btnCreateGroup').addEventListener('click', openModalCrearGrupo);
$('btnCreateGroupEmpty').addEventListener('click', openModalCrearGrupo);

$('btnConfirmarGrupo').addEventListener('click', async () => {
  // AQUÍ ESTÁ LA CORRECCIÓN: Usamos el ID correcto 'creadorNombrePerfil'
  const customName = $('creadorNombrePerfil')?.value.trim() || '';
  const grupoNombre = $('nuevoGrupoNombre')?.value.trim() || '';
  const grupoDesc = $('nuevoGrupoDesc')?.value.trim() || '';

  if (!customName) { alert('Por favor, dinos cómo te llamas.'); return; }
  if (!grupoNombre) { alert('Escribe un nombre para el grupo.'); return; }

  // UX: Deshabilitamos el botón y avisamos que está cargando
  const btn = $('btnConfirmarGrupo');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando...';
  }

  const { collection, addDoc, doc, setDoc, serverTimestamp } = lib();
  try {
    // 1. Actualizamos tu nombre real
    await setDoc(doc(db(), 'ec_users', currentUser.uid), {
      name: customName,
      email: currentUser.email,
      avatar: currentUser.avatar || ''
    }, { merge: true });

    currentUser.name = customName;

    // 2. Aseguramos el emoji correcto
    let iconoFinal = '👥';
    if (typeof selectedGrupoEmoji !== 'undefined') iconoFinal = selectedGrupoEmoji;
    else if (typeof grupoIconSelected !== 'undefined') iconoFinal = grupoIconSelected;

    // 3. Creamos el grupo
    await addDoc(collection(db(), 'ec_grupos'), {
      name: grupoNombre,
      desc: grupoDesc,
      icon: iconoFinal,
      adminUid: currentUser.uid,
      miembros: [currentUser.email],
      createdAt: serverTimestamp()
    });

    closeModal('modalCrearGrupo');

    // Limpiamos los campos de forma segura
    if ($('creadorNombrePerfil')) $('creadorNombrePerfil').value = '';
    if ($('nuevoGrupoNombre')) $('nuevoGrupoNombre').value = '';
    if ($('nuevoGrupoDesc')) $('nuevoGrupoDesc').value = '';

  } catch (e) {
    alert('Error al crear el grupo: ' + e.message);
    console.error('Group creation error:', e);
  } finally {
    // 4. Restauramos el botón
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Crear grupo';
    }
  }
});

/* ── AGREGAR MIEMBRO ── */
$('btnInvitarCompa').addEventListener('click', () => {
  openModal('modalAgregarMiembro');
  renderMiembrosList();
});

function renderMiembrosList() {
  const container = $('miembrosListContainer');
  if (!container || !currentGroupData) return;
  const miembros = currentGroupData.miembros || [];
  const nombres = currentGroupData.miembroNombres || {};
  if (!miembros.length) { container.innerHTML = '<p style="font-size:12px;color:var(--text3)">Sin integrantes aún.</p>'; return; }
  container.innerHTML = '<p style="font-size:11px;color:var(--text3);margin-bottom:6px">Integrantes actuales:</p>' +
    miembros.map(email => {
      const key = email.replace(/\./g, '_');
      const nombre = nombres[key] || email.split('@')[0];
      const esAdmin = email === currentGroupData.adminEmail;
      return `<div class="miembro-list-item">
        <span class="miembro-list-name">${escHtml(nombre)}</span>
        <span class="miembro-list-email">${escHtml(email)}</span>
        ${esAdmin ? '<span class="miembro-badge-admin">Admin</span>' : ''}
      </div>`;
    }).join('');
}

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
const sectionTitles = {
  feed: 'Tablero', muro: 'Mis Aportes', apuntes: 'Apuntes',
  chat: 'Chat', tareas: 'Tareas', biblioteca: 'Biblioteca', videotutoriales: 'VideoTutoriales', dinamicas: 'Dinámicas'
};

function setActiveNav(section) {
  // Sidebar nav
  qsa('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  // Bottom nav
  qsa('.bottom-nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  $('topbarTitle').textContent = sectionTitles[section] || 'ZonaEscolar';
}

qsa('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    currentSection = section;
    localStorage.setItem('ze_last_section', section);
    setActiveNav(section);
    activarSeccion(section);
    closeSidebar();
  });
});

qsa('.bottom-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    currentSection = section;
    localStorage.setItem('ze_last_section', section);
    setActiveNav(section);
    activarSeccion(section);
  });
});

function activarSeccion(section) {
  if (!currentGroupId && section !== 'muro') { showSection('noGroup'); return; }

  if (section !== 'biblioteca' && bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }

  const panelBurbuja = $('chatBurbujaPanel');
  const fab = $('chatFab');

  // --- 1. CERRAR BURBUJA SIEMPRE AL CAMBIAR DE SECCIÓN ---
  if (panelBurbuja && panelBurbuja.classList.contains('open')) {
    panelBurbuja.classList.remove('open');
    if (fab) fab.classList.remove('active');
    chatBurbujaAbierta = false;

    // Detenemos la escucha de mensajes de la burbuja para ahorrar recursos
    if (typeof chatBurbujaUnsub !== 'undefined' && chatBurbujaUnsub) {
      chatBurbujaUnsub();
      chatBurbujaUnsub = null;
    }
  }

  // --- 2. OCULTAR EL BOTÓN FLOTANTE SI ESTAMOS EN EL CHAT GRANDE ---
  if (fab) {
    if (section === 'chat') {
      fab.style.display = 'none'; // Desaparece la burbuja flotante
    } else {
      fab.style.display = ''; // Vuelve a aparecer en Feed, Tareas, etc.
    }
  }

  // --- 3. RESETEOS ESPECÍFICOS AL ENTRAR AL CHAT GRANDE ---
  if (section === 'chat') {
    resetBurbujaUnread();
    markChatAsRead();
  }

  // --- LIMPIAR TYPING/ONLINE AL SALIR DEL CHAT (el heartbeat de presencia sigue activo en todo el grupo) ---
  if (section !== 'chat') {
    if (chatTypingUnsub) { chatTypingUnsub(); chatTypingUnsub = null; }
    if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
    const indicator = $('chatTypingIndicator');
    if (indicator) { indicator.style.display = 'none'; indicator.textContent = ''; }
    const onlineList = $('chatOnlineList');
    if (onlineList) onlineList.style.display = 'none';
  }

  showSection(section);

  // FAB: invisible + no clickeable dentro del chat
  const chatFabEl = $('chatFab');
  if (chatFabEl) {
    const hideFab = section === 'chat';
    chatFabEl.style.opacity = hideFab ? '0' : '1';
    chatFabEl.style.pointerEvents = hideFab ? 'none' : '';
  }

  if (section === 'feed') {
    // Asegurarse de que la galería sea visible y el feed expandido esté oculto
    const vistaGaleria = $('vistaTableros');
    const vistaFeed = $('vistaFeedTablero');
    if (vistaGaleria) vistaGaleria.style.display = '';
    if (vistaFeed) vistaFeed.style.display = 'none';
    currentTableroId = null;
    initTableros();
  }
  if (section === 'chat') {
    if (!chatUnsub) initChat();
    else {
      initChatOnline();
      initChatTypingListener();
      markChatAsRead();
    }
    // Al abrir el chat: posicionar en el último mensaje que enviaste (el listener ya pintó si existía).
    const scrollToMine = () => scrollChatToMyLastMessage();
    requestAnimationFrame(() => {
      scrollToMine();
      setTimeout(scrollToMine, 0);
    });
  }
  if (section === 'tareas') initTareas();
  if (section === 'biblioteca') initBiblioteca();
  if (section === 'videotutoriales') initVideotutoriales();
  if (section === 'apuntes') initApuntes();
  if (section === 'dinamicas') initDinamicas();
  if (section === 'muro') initMuro();
}

function showSection(name) {
  qsa('.section').forEach(s => s.classList.remove('active'));
  const map = {
    loading: 'sectionLoading', noGroup: 'sectionNoGroup',
    feed: 'sectionFeed', muro: 'sectionMuro',
    apuntes: 'sectionApuntes', chat: 'sectionChat',
    tareas: 'sectionTareas', biblioteca: 'sectionBiblioteca', 
    videotutoriales: 'sectionVideotutoriales', dinamicas: 'sectionDinamicas'
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
   TABLEROS TEMÁTICOS — GALERÍA
═══════════════════════════════════════════════════ */

// Íconos temáticos para los tableros según palabras clave en el nombre
const TABLERO_ICONOS = {
  mat: '📐', calc: '📐', álgeb: '📐', trigo: '📐',
  fis: '⚗️', quim: '🧪', bio: '🔬', cien: '🔬',
  hist: '📜', geo: '🌍', civil: '📜',
  espa: '📖', liter: '📖', lect: '📖',
  ingl: '🇬🇧', franc: '🇫🇷', idio: '🗣️',
  progr: '💻', inform: '💻', comp: '💻', tecn: '🖥️',
  arte: '🎨', mús: '🎵', educ: '🏃', depo: '⚽',
  aviso: '📢', tarea: '✅', examen: '📝', proyecto: '🏗️',
  tip: '💡', recur: '📚', apunt: '📓',
};

function getTableroIcono(nombre) {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, icon] of Object.entries(TABLERO_ICONOS)) {
    if (n.includes(key)) return icon;
  }
  return '📌';
}

function initTableros() {
  if (tablerosUnsub) { tablerosUnsub(); tablerosUnsub = null; }
  if (!currentGroupId) return;

  // Sync sort button label
  const btnSort = $('btnSortTableros');
  if (btnSort) btnSort.textContent = (window._ordenTableros === 'nombre') ? '🔤 A-Z' : '📅 Fecha';

  const { collection, query, where, orderBy, onSnapshot } = lib();

  // Intentamos primero con orderBy (requiere índice compuesto)
  const qOrdenada = query(
    collection(db(), 'ec_tableros'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc')
  );

  tablerosUnsub = onSnapshot(qOrdenada, snap => {
    const tableros = [];
    snap.forEach(d => tableros.push({ id: d.id, ...d.data() }));
    window._tablerosCache = tableros;
    renderGaleriaTableros(tableros);
  }, err => {
    // Si falla por índice pendiente, usamos query simple sin orderBy
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      console.warn('Índice de tableros compilando, usando query sin orden…');
      const qSimple = query(
        collection(db(), 'ec_tableros'),
        where('groupId', '==', currentGroupId)
      );
      tablerosUnsub = onSnapshot(qSimple, snap => {
        const tableros = [];
        snap.forEach(d => tableros.push({ id: d.id, ...d.data() }));
        // Ordenar en el cliente mientras el índice compila
        tableros.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
        window._tablerosCache = tableros;
        renderGaleriaTableros(tableros);
      }, e2 => console.error('Error tableros (fallback):', e2));
    } else {
      console.error('Error tableros:', err);
    }
  });
}

function renderGaleriaTableros(tableros) {
  const galeria = $('tablerosGaleria');
  if (!galeria) return;

  const btnNuevo = $('btnNuevoTableroGaleria');
  if (btnNuevo) btnNuevo.style.display = isAdmin ? 'inline-flex' : 'none';

  // Ordenar
  const orden = window._ordenTableros || 'fecha';
  const tablerosSorted = [...tableros];
  if (orden === 'nombre') {
    tablerosSorted.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else {
    tablerosSorted.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }

  let html = '';

  // 1. Card "Nuevo tablero" (Solo para Admin)
  if (isAdmin) {
    html += `
      <button class="tablero-card tablero-card-nuevo" onclick="abrirModalNuevoTablero()">
        <div class="tablero-card-inner">
          <div class="tablero-card-content">
            <span class="tablero-card-icon">➕</span>
            <div class="tablero-card-nombre">Nuevo tablero</div>
          </div>
        </div>
      </button>`;
  }

  // 2. Card "Tablero general" (La que se ve bien)
  html += `
    <button class="tablero-card tablero-general" onclick="abrirTablero(null)">
      <div class="tablero-card-inner">
        <div class="tablero-card-content">
          <span class="tablero-card-icon">🏠</span>
          <div class="tablero-card-nombre">Tablero general</div>
        </div>
      </div>
    </button>`;

  // 3. CARDS DE LOS DEMÁS TABLEROS (Aquí es donde estaba el error)
  tablerosSorted.forEach(t => {
    const icono = t.icono || getTableroIcono(t.nombre);
    const bg = t.color || '#1a237e';
    const delBtn = isAdmin
      ? `<button class="tablero-card-del" onclick="event.stopPropagation(); eliminarTablero('${t.id}','${escHtml(t.nombre)}')">🗑️</button>`
      : '';
    
    // IMPORTANTE: Aquí envolvemos el nombre en las mismas clases que el Tablero General
    html += `
    <button class="tablero-card" style="background:${bg}" onclick="abrirTablero('${t.id}','${escHtml(t.nombre)}','${bg}')">
      <div class="tablero-card-inner">
        <div class="tablero-card-content">
          <span class="tablero-card-icon">${icono}</span>
          <div class="tablero-card-nombre">${escHtml(t.nombre)}</div>
        </div>
      </div>
    </button>`;
  });

  galeria.innerHTML = html;
}

/* ── Abrir un tablero (desplegar feed) ── */
window.abrirTablero = function(tableroId, nombre, color) {
  currentTableroId = tableroId;

  const vistaGaleria = $('vistaTableros');
  const vistaFeed = $('vistaFeedTablero');
  const titulo = $('tableroFeedTitulo');
  const delBtn = $('tableroFeedDel');
  const header = $('tableroFeedHeader');

  if (vistaGaleria) vistaGaleria.style.display = 'none';
  if (vistaFeed) vistaFeed.style.display = 'block';

  if (tableroId) {
    titulo.textContent = (nombre || 'Tablero');
    if (color && header) header.style.borderBottomColor = color;
    if (delBtn) delBtn.style.display = isAdmin ? 'block' : 'none';
  } else {
    titulo.textContent = '🏠 Feed general';
    if (header) header.style.borderBottomColor = '';
    if (delBtn) delBtn.style.display = 'none';
  }

  // Actualizar placeholder del compose
  const compose = $('composeInput');
  if (compose) {
    compose.placeholder = tableroId
      ? `Publica en "${nombre || 'este tablero'}"…`
      : 'Comparte un apunte, aviso o material con tu grupo...';
  }

  initFeed();
};

/* ── Cerrar tablero y volver a la galería ── */
window.cerrarTablero = function () {
  currentTableroId = null;
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }

  const vistaFeed = $('vistaFeedTablero');
  const vistaTableros = $('vistaTableros');

  // Ocultamos el feed del tablero
  if (vistaFeed) vistaFeed.style.display = 'none';

  // Si venías de la galería de tableros, la volvemos a mostrar
  if (currentSection === 'tableros' && vistaTableros) {
    vistaTableros.style.display = '';
  }

  const feedList = $('feedList');
  if (feedList) feedList.innerHTML = '';
};

/* ── Eliminar el tablero actualmente abierto ── */
window.eliminarTableroActivo = function() {
  if (!currentTableroId || !isAdmin) return;
  const titulo = $('tableroFeedTitulo')?.textContent || 'este tablero';
  eliminarTablero(currentTableroId, titulo);
};

/* ── Ordenar tableros ── */
window._ordenTableros = localStorage.getItem('ze_orden_tableros') || 'fecha';
window.toggleOrdenTableros = function() {
  window._ordenTableros = window._ordenTableros === 'fecha' ? 'nombre' : 'fecha';
  localStorage.setItem('ze_orden_tableros', window._ordenTableros);
  const btn = $('btnSortTableros');
  if (btn) btn.textContent = window._ordenTableros === 'nombre' ? '🔤 A-Z' : '📅 Fecha';
  // Re-render con los tableros actuales
  if (window._tablerosCache) renderGaleriaTableros(window._tablerosCache);
};

window.abrirModalNuevoTablero = function() {
  $('nuevoTableroNombre').value = '';
  document.querySelectorAll('#tableroColorPicker .dvd-color-opt').forEach((btn, i) => {
    btn.classList.toggle('selected', i === 0);
  });
  // Reset emoji picker
  document.querySelectorAll('#tableroEmojiPicker .tablero-emoji-opt').forEach((btn, i) => {
    btn.classList.toggle('selected', i === 0);
  });
  openModal('modalNuevoTablero');
};

// Bind color picker del modal
document.querySelectorAll('#tableroColorPicker .dvd-color-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tableroColorPicker .dvd-color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Bind emoji picker del modal
document.querySelectorAll('#tableroEmojiPicker .tablero-emoji-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tableroEmojiPicker .tablero-emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

$('btnConfirmarTablero').addEventListener('click', async () => {
  const nombre = $('nuevoTableroNombre').value.trim();
  if (!nombre) { alert('Escribe el nombre del tablero.'); return; }
  if (!isAdmin) { alert('Solo el administrador puede crear tableros.'); return; }

  const selectedColor = document.querySelector('#tableroColorPicker .dvd-color-opt.selected');
  const color = selectedColor?.dataset.color || '#1a237e';

  const selectedEmoji = document.querySelector('#tableroEmojiPicker .tablero-emoji-opt.selected');
  const icono = selectedEmoji?.dataset.emoji || '📌';

  const btn = $('btnConfirmarTablero');
  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_tableros'), {
      groupId: currentGroupId,
      nombre,
      color,
      icono,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevoTablero');
  } catch (e) {
    alert('Error al crear tablero: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear Tablero';
  }
});

window.eliminarTablero = async function(tableroId, nombre) {
  if (!isAdmin) return;
  if (!confirm(`¿Eliminar el tablero "${nombre}"?\nLas publicaciones del tablero no se borran.`)) return;
  try {
    const { doc, deleteDoc } = lib();
    await deleteDoc(doc(db(), 'ec_tableros', tableroId));
    // Si estamos dentro del tablero eliminado, volver a la galería
    if (currentTableroId === tableroId) cerrarTablero();
  } catch (e) {
    alert('Error al eliminar: ' + e.message);
  }
};

/* ═══════════════════════════════════════════════════
   FEED
═══════════════════════════════════════════════════ */
function initFeed() {
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }

  const { collection, query, where, orderBy, limit, onSnapshot } = lib();

  $('feedList').innerHTML = '<div class="feed-loading">Cargando…</div>';

  const onErr = err => {
    console.error('Error en el Feed:', err.code, err.message);
    if (err.code === 'failed-precondition') {
      console.warn('%c⚠️ ÍNDICE FALTANTE EN FIRESTORE',
        'color:white;background:#f59e0b;padding:4px 8px;border-radius:4px;font-weight:bold;');
      console.warn('Haz clic aquí para crearlo automáticamente:\n',
        err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] || 'URL no encontrada.');
      $('feedList').innerHTML = `<div class="feed-loading" style="color:var(--amber);">⚠️ Falta configurar un índice en la base de datos.<br><small>Revisa la consola del navegador (F12) para el enlace de creación.</small></div>`;
    } else {
      $('feedList').innerHTML = `<div class="feed-loading" style="color:var(--red);">⚠️ Error de conexión: ${err.code}</div>`;
    }
  };

  if (currentTableroId) {
    // ── Feed de tablero específico ──
    const q = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('tableroId', '==', currentTableroId),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    feedUnsub = onSnapshot(q, { includeMetadataChanges: false }, snap => {
      const posts = [];
      snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
      renderFeed(posts);
    }, onErr);

  } else {
    // ── Feed general: posts nuevos (tableroId='') + posts legacy (sin campo) ──
    // Firestore no soporta OR en una sola query, así que hacemos dos getDocs
    // y combinamos, luego un onSnapshot para tiempo real con tableroId=''
    const { getDocs } = lib();

    const qNew = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('tableroId', '==', ''),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    // Primera carga: incluir legacy posts (sin tableroId)
    const qLegacy = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    getDocs(qLegacy).then(legacySnap => {
      const legacyPosts = [];
      legacySnap.forEach(d => {
        const data = d.data();
        // Solo incluir posts sin tableroId asignado (general o legacy)
        if (!data.tableroId) legacyPosts.push({ id: d.id, ...data });
      });
      if (legacyPosts.length) renderFeed(legacyPosts);
    }).catch(() => {});

    // Tiempo real con posts nuevos del feed general
    feedUnsub = onSnapshot(qNew, { includeMetadataChanges: false }, snap => {
      const posts = [];
      snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
      // Merge con legacy posts que ya estén en el DOM
      const existingLegacy = [];
      document.querySelectorAll('#feedList .feed-card[data-id]').forEach(el => {
        // Si la card ya existía y no viene en este snapshot, es legacy — la dejamos
        if (!posts.find(p => p.id === el.dataset.id)) {
          // No la tocamos; renderFeed solo elimina las que no estén en newIds
          // Así que las agregamos al array para que no se borren
          existingLegacy.push({ id: el.dataset.id, _keepOnly: true });
        }
      });
      renderFeed([...posts, ...existingLegacy]);
    }, onErr);
  }
}


function bindFeedCard(cardEl, postId) {
  const likeBtn = cardEl.querySelector('.feed-action-btn[data-like]');
  if (likeBtn) likeBtn.addEventListener('click', () => toggleFeedLike(postId, likeBtn));

  cardEl.querySelectorAll('.feed-card-img, .feed-card-images-grid img').forEach(img => {
    img.addEventListener('click', () => openLightboxFeed(img));
  });

  const toggleBtn = cardEl.querySelector('.feed-comments-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const section = cardEl.querySelector('.feed-comments-section');
      if (!section) return;
      const isOpen = section.dataset.open === '1';
      if (!isOpen) {
        loadComments(postId, section);
        section.dataset.open = '1';
        toggleBtn.textContent = 'Ocultar notas';
        section.style.display = 'block';
      } else {
        section.dataset.open = '0';
        section.style.display = 'none';
        // Restaurar el texto correcto con el conteo actual
        const cnt = parseInt(cardEl.querySelector('.feed-comments-section')?.dataset.count || '0', 10);
        toggleBtn.textContent = `📝 ${cnt > 0 ? cnt + ' notas' : 'Añadir nota'}`;
      }
    });
  }

  const sendBtn = cardEl.querySelector('.feed-comment-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const input = cardEl.querySelector('.feed-comment-input');
      enviarComentario(postId, input);
    });
  }

  const commentInput = cardEl.querySelector('.feed-comment-input');
  if (commentInput) {
    commentInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarComentario(postId, commentInput);
      }
    });
  }
}

function getVisibleColCount() {
  if (window.innerWidth <= 600) return 1;
  if (window.innerWidth <= 900) return 2;
  return 3;
}

function getFeedCols(list) {
  let cols = list.querySelectorAll('.feed-col');
  if (cols.length !== 3) {
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const col = document.createElement('div');
      col.className = 'feed-col';
      col.dataset.col = i;
      list.appendChild(col);
    }
    cols = list.querySelectorAll('.feed-col');
  }
  return cols;
}

function renderFeed(posts) {
  const list = $('feedList');
  if (!posts.length) {
    list.innerHTML = '<div class=\"feed-loading\">El feed está vacío. ¡Sé el primero en publicar!</div>';
    return;
  }

  const cols = getFeedCols(list);
  const numCols = getVisibleColCount();
  const newIds = new Set(posts.map(p => p.id));

  // Mostrar/ocultar columnas según tamaño de pantalla
  cols.forEach((col, i) => { col.style.display = i < numCols ? '' : 'none'; });

  // Eliminar cards que ya no existen
  list.querySelectorAll('.feed-card[data-id]').forEach(el => {
    if (!newIds.has(el.dataset.id)) el.remove();
  });

  posts.forEach((p, idx) => {
    if (p._keepOnly) return; // legacy marker — card ya está en el DOM, no tocar
    const colIdx = idx % numCols;
    const col = cols[colIdx];
    const posInCol = Math.floor(idx / numCols);

    let card = list.querySelector(`.feed-card[data-id="${p.id}"]`);
    if (!card) {
      const tmp = document.createElement('div');
      tmp.innerHTML = buildFeedCard(p);
      card = tmp.firstElementChild;
      card.dataset.id = p.id;
      bindFeedCard(card, p.id);
      injectPin(card, getCardColor(p.id, p.pinColor), p.pinShape || 'flat');
    }

    // Insertar/mover a la posición correcta dentro de su columna
    const cardsInCol = [...col.querySelectorAll('.feed-card[data-id]')];
    const currentPosInCol = cardsInCol.indexOf(card);
    if (card.parentElement !== col || currentPosInCol !== posInCol) {
      const refCard = col.querySelectorAll('.feed-card[data-id]')[posInCol];
      if (refCard && refCard !== card) col.insertBefore(card, refCard);
      else if (!refCard) col.appendChild(card);
    }

    // Actualizar contadores
    const likeBtn = card.querySelector('.feed-action-btn[data-like]');
    if (likeBtn) {
      const isLiked = p.likedBy?.includes(currentUser.uid);
      likeBtn.className = `feed-action-btn ${isLiked ? 'liked' : ''}`;
      likeBtn.innerHTML = `<span class=\"foco-icon\">💡</span> Útil (<span class=\"like-count\">${p.likes || 0}</span>)`;
    }
    const commentToggle = card.querySelector('.feed-comments-toggle');
    if (commentToggle && card.querySelector('.feed-comments-section')?.dataset.open !== '1') {
      const cnt = p.commentCount || 0;
      commentToggle.textContent = `📝 ${cnt > 0 ? cnt + ' notas' : 'Añadir nota'}`;
    }
  });
}


/* ── CHINCHETA SVG ── */
const PIN_COLORS = ['red','yellow','green','blue','purple','pink','orange','cyan'];
const PIN_HEX = { red:'#ef4444', yellow:'#f59e0b', green:'#10b981', blue:'#3b82f6', purple:'#8b5cf6', pink:'#ec4899', orange:'#f97316', cyan:'#06b6d4' };
const PIN_DARK = { red:'#b91c1c', yellow:'#d97706', green:'#047857', blue:'#1d4ed8', purple:'#6d28d9', pink:'#be185d', orange:'#c2410c', cyan:'#0e7490' };

function makePinSvg(color, shape) {
  if (shape === 'tilted') return makePinSvgTilted(color);
  const c = PIN_HEX[color] || PIN_HEX.red;
  const d = PIN_DARK[color] || PIN_DARK.red;
  return '<svg class="feed-pin" viewBox="0 0 28 42" xmlns="http://www.w3.org/2000/svg">'
    + '<ellipse cx="14" cy="41" rx="3" ry="1" fill="rgba(0,0,0,0.2)"/>'
    + '<polygon points="12,22 16,22 14,40" fill="#c0c0c0"/>'
    + '<polygon points="13,22 15,22 14,38" fill="#e8e8e8"/>'
    + '<rect x="11" y="15" width="6" height="9" rx="2" fill="#9ca3af"/>'
    + '<rect x="12" y="15" width="2" height="9" rx="1" fill="#d1d5db"/>'
    + '<ellipse cx="14" cy="10" rx="12" ry="7" fill="' + d + '"/>'
    + '<ellipse cx="14" cy="8.5" rx="11" ry="6" fill="' + c + '"/>'
    + '<ellipse cx="10" cy="6" rx="4" ry="2.5" fill="rgba(255,255,255,0.35)" transform="rotate(-15 10 6)"/>'
    + '<ellipse cx="14" cy="15" rx="6" ry="2" fill="' + d + '" opacity="0.5"/>'
    + '</svg>';
}

function makePinSvgTilted(color) {
  const c = PIN_HEX[color] || PIN_HEX.red;
  const d = PIN_DARK[color] || PIN_DARK.red;
  // Pin inclinado ~40°: cabeza redonda arriba-izquierda, aguja larga hacia abajo-derecha
  return '<svg class="feed-pin feed-pin-tilted" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">'
    // sombra alargada debajo
    + '<ellipse cx="28" cy="45" rx="5" ry="2" fill="rgba(0,0,0,0.18)" transform="rotate(-10 28 45)"/>'
    // aguja larga diagonal
    + '<line x1="14" y1="16" x2="30" y2="44" stroke="#b0b0b0" stroke-width="2.2" stroke-linecap="round"/>'
    + '<line x1="13" y1="16" x2="29" y2="43" stroke="#e0e0e0" stroke-width="1" stroke-linecap="round"/>'
    // cuello corto
    + '<rect x="10" y="12" width="7" height="7" rx="2" fill="#9ca3af" transform="rotate(-40 13.5 15.5)"/>'
    + '<rect x="11.5" y="12" width="2.5" height="7" rx="1" fill="#d1d5db" transform="rotate(-40 12.75 15.5)"/>'
    // cabeza esférica
    + '<circle cx="9" cy="9" r="8" fill="' + d + '"/>'
    + '<circle cx="9" cy="8" r="7" fill="' + c + '"/>'
    // brillo
    + '<ellipse cx="6" cy="5.5" rx="3.5" ry="2.2" fill="rgba(255,255,255,0.4)" transform="rotate(-20 6 5.5)"/>'
    + '<circle cx="9" cy="9" r="8" fill="none" stroke="' + d + '" stroke-width="1" opacity="0.4"/>'
    + '</svg>';
}


function injectPin(card, colorClass, shape) {
  shape = shape || card.dataset.pinShape || 'flat';
  card.dataset.pinShape = shape;
  PIN_COLORS.forEach(c => card.classList.remove('pin-' + c));
  card.classList.add('pin-' + colorClass);
  const existing = card.querySelector('.feed-pin');
  if (existing) existing.remove();
  const svg = document.createElement('span');
  svg.innerHTML = makePinSvg(colorClass, shape);
  const pinEl = svg.firstElementChild;
  pinEl.addEventListener('click', e => {
    e.stopPropagation();
    openPinColorPopup(card, colorClass, shape);
  });
  card.insertAdjacentElement('afterbegin', pinEl);
}

function openPinColorPopup(card, currentColor, currentShape) {
  document.querySelectorAll('.pin-color-popup').forEach(p => p.remove());
  currentShape = currentShape || card.dataset.pinShape || 'flat';

  const popup = document.createElement('div');
  popup.className = 'pin-color-popup';

// Shape toggle row
  const shapeRow = document.createElement('div');
  shapeRow.className = 'pin-shape-row';
  const previewColor = currentColor || 'purple';

  ['flat','tilted'].forEach(sh => {
    const btn = document.createElement('div');
    btn.className = 'pin-shape-btn' + (sh === currentShape ? ' active' : '');
    btn.title = sh === 'flat' ? 'Clásico' : 'Inclinado';
    btn.innerHTML = sh === 'flat'
      ? makePinSvg(previewColor, 'flat')
      : makePinSvg(previewColor, 'tilted');
    btn.querySelector('svg').style.cssText = 'width:24px;height:34px;pointer-events:none;display:block;margin:auto;';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      currentShape = sh;
      card.dataset.pinShape = sh;
      popup.querySelectorAll('.pin-shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      injectPin(card, currentColor, sh);
      const postId = card.dataset.id;
      if (!postId) return;
      try {
        const { doc, updateDoc } = lib();
        await updateDoc(doc(db(), 'ec_feed', postId), { pinShape: sh });
      } catch(err) { console.warn(err); }
    });
    shapeRow.appendChild(btn);
  });
  popup.appendChild(shapeRow);

  // Divider
  const div = document.createElement('div');
  div.className = 'pin-popup-divider';
  popup.appendChild(div);

  // Color dots
  const dotsRow = document.createElement('div');
  dotsRow.className = 'pin-dots-row';
  PIN_COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'pin-color-dot' + (c === currentColor ? ' active' : '');
    dot.style.background = PIN_HEX[c];
    dot.title = c;
    dot.addEventListener('click', async e => {
      e.stopPropagation();
      currentColor = c;
      dotsRow.querySelectorAll('.pin-color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      injectPin(card, c, currentShape);
      // update shape buttons preview color
      popup.querySelectorAll('.pin-shape-btn svg').forEach((svg, i) => {
        const sh = i === 0 ? 'flat' : 'tilted';
        svg.outerHTML; // can't easily update, just re-render buttons
      });
      const postId = card.dataset.id;
      if (!postId) return;
      try {
        const { doc, updateDoc } = lib();
        await updateDoc(doc(db(), 'ec_feed', postId), { pinColor: c });
      } catch(err) { console.warn(err); }
    });
    dotsRow.appendChild(dot);
  });
  popup.appendChild(dotsRow);

  // Posicionar el popup usando fixed relativo al pin SVG
  document.body.appendChild(popup);
  const pinEl2 = card.querySelector('.feed-pin');
  if (pinEl2) {
    const r = pinEl2.getBoundingClientRect();
    const popupW = 168;
    let left = r.left + r.width / 2 - popupW / 2;
    // Evitar que se salga por los bordes
    if (left < 8) left = 8;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
    popup.style.top = (r.bottom + 8) + 'px';
    popup.style.left = left + 'px';
    popup.style.transformOrigin = 'top center';
  }

  setTimeout(() => {
    document.addEventListener('click', function handler() {
      popup.remove();
      document.removeEventListener('click', handler);
    });
  }, 0);
}

function getCardColor(postId, savedColor) {
  if (savedColor && PIN_COLORS.includes(savedColor)) return savedColor;
  let hash = 0;
  for (let i = 0; i < postId.length; i++) hash = postId.charCodeAt(i) + ((hash << 5) - hash);
  return PIN_COLORS[Math.abs(hash) % PIN_COLORS.length];
}


/* ── DETECCIÓN DE ENLACES EN TEXTO LIBRE ── */
function detectLinkPreview(text) {
  if (!text) return null;
  // Buscar URL en el texto
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return null;
  const raw = urlMatch[0];
  let url;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.replace('www.', '');

  // ── Google Drive (archivos genéricos) ──
  if (host === 'drive.google.com') {
    const idMatch = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = idMatch ? idMatch[1] : null;
    return {
      type: 'gdrive', url: raw, fileId,
      icon: '📁', label: 'Google Drive',
      color: '#4285F4',
      preview: fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w320` : null,
      action: 'Abrir archivo'
    };
  }
  // ── Google Docs ──
  if (host === 'docs.google.com') {
    const path = url.pathname;
    if (path.includes('/document/')) return { type: 'gdocs', url: raw, icon: '📄', label: 'Google Docs', color: '#4285F4', action: 'Abrir documento' };
    if (path.includes('/spreadsheets/')) return { type: 'gsheets', url: raw, icon: '📊', label: 'Google Sheets', color: '#0F9D58', action: 'Abrir hoja de cálculo' };
    if (path.includes('/presentation/')) return { type: 'gslides', url: raw, icon: '📑', label: 'Google Slides', color: '#F4B400', action: 'Abrir presentación' };
    if (path.includes('/forms/')) return { type: 'gforms', url: raw, icon: '📋', label: 'Google Forms', color: '#7B1FA2', action: 'Abrir formulario' };
    return { type: 'gdocs', url: raw, icon: '📄', label: 'Google Docs', color: '#4285F4', action: 'Abrir documento' };
  }
  // ── YouTube (en texto libre) ──
  if (host.includes('youtube.com') || host === 'youtu.be') {
    let videoId = null;
    if (host.includes('youtube.com')) videoId = url.searchParams.get('v');
    if (host === 'youtu.be') videoId = url.pathname.slice(1).split('?')[0];
    if (!videoId) { const m = url.pathname.match(/(?:shorts|embed|v)\/([^/?&]+)/); if (m) videoId = m[1]; }
    if (videoId) return {
      type: 'youtube', url: raw, videoId,
      icon: '▶', label: 'YouTube',
      color: '#FF0000',
      preview: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      action: 'Ver video'
    };
  }
  // ── Canva ──
  if (host === 'canva.com' || host.includes('canva.com')) {
    return { type: 'canva', url: raw, icon: '🎨', label: 'Canva', color: '#7D2AE8', action: 'Abrir diseño' };
  }
  // ── Figma ──
  if (host === 'figma.com' || host.includes('figma.com')) {
    return { type: 'figma', url: raw, icon: '🖌️', label: 'Figma', color: '#F24E1E', action: 'Abrir en Figma' };
  }
  // ── GitHub ──
  if (host === 'github.com') {
    return { type: 'github', url: raw, icon: '🐙', label: 'GitHub', color: '#24292E', action: 'Ver repositorio' };
  }
  return null;
}

function buildLinkPreviewHtml(d) {
  if (d.type === 'youtube' && d.preview) {
    return `
      <div class="feed-link-preview feed-link-youtube" onclick="window.open('${d.url}','_blank')" style="cursor:pointer">
        <div class="feed-link-thumb">
          <img src="${d.preview}" alt="" class="feed-link-thumb-img">
          <div class="feed-link-play">▶</div>
        </div>
        <div class="feed-link-info">
          <div class="feed-link-badge" style="background:${d.color}">
            <span>${d.icon}</span> ${d.label}
          </div>
          <div class="feed-link-action">${d.action} →</div>
        </div>
      </div>`;
  }
  if (d.type === 'gdrive' && d.preview) {
    return `
      <div class="feed-link-preview" onclick="window.open('${d.url}','_blank')" style="cursor:pointer">
        <div class="feed-link-thumb feed-link-thumb-doc">
          <img src="${d.preview}" alt="" class="feed-link-thumb-img" onerror="this.parentElement.innerHTML='<div class=feed-link-thumb-icon>${d.icon}</div>'">
        </div>
        <div class="feed-link-info">
          <div class="feed-link-badge" style="background:${d.color}">
            <span>${d.icon}</span> ${d.label}
          </div>
          <div class="feed-link-action">${d.action} →</div>
        </div>
      </div>`;
  }
  // Genérico (Docs, Sheets, Slides, Canva, GitHub, etc.)
  const bgMap = { gdocs:'#E8F0FE', gsheets:'#E6F4EA', gslides:'#FEF7E0', gforms:'#F3E8FD', canva:'#F0EAF9', figma:'#FEE9E4', github:'#F0F0F0', gdrive:'#E8F0FE' };
  const bg = bgMap[d.type] || '#1e1e2e';
  return `
    <div class="feed-link-preview feed-link-generic" onclick="window.open('${d.url}','_blank')" style="cursor:pointer">
      <div class="feed-link-icon-block" style="background:${bg}">
        <span class="feed-link-big-icon">${d.icon}</span>
      </div>
      <div class="feed-link-info">
        <div class="feed-link-badge" style="background:${d.color}">
          <span>${d.icon}</span> ${d.label}
        </div>
        <div class="feed-link-action">${d.action} →</div>
      </div>
    </div>`;
}

function buildFeedCard(p) {
  const isMine = p.authorUid === currentUser.uid;

  // NUEVO: Inmunidad. El admin SOLO puede borrar si el autor ya NO está en el grupo.
  let isAuthorInGroup = false;
  if (p.authorEmail && currentGroupData && currentGroupData.miembros) {
    isAuthorInGroup = currentGroupData.miembros.includes(p.authorEmail);
  }
  const canDelete = isMine || (isAdmin && !isAuthorInGroup);

  const badgeMap = {
    foto: ['badge-foto', '📷 Foto'],
    tarea: ['badge-tarea', '✅ Tarea'],
    votacion: ['badge-votacion', '🗳️ Votación'],
    trivia: ['badge-trivia', '🧠 Trivia'],
    texto: ['badge-texto', '💬 Texto']
  };
  const [badgeTipo, badgeLabel] = badgeMap[p.type] || badgeMap.texto;

  // Card especial para votación inline
  if (p.type === 'votacion' && p.votacionId) {
    const yaVoto = p.votantes?.includes(currentUser.uid);
    const miVoto = Number(p?.userVotes?.[currentUser.uid]);
    const activa = p.activa !== false; // true por defecto
    const totalVotos = Object.values(p.votos || {}).reduce((a, b) => a + b, 0);

    let pollHtml = '';
    // Siempre mostrar porcentajes para transparencia.
    const resultadosHtml = (p.opciones || []).map((op, i) => {
      const cnt = p.votos?.[i] || 0;
      const pct = totalVotos ? Math.round((cnt / totalVotos) * 100) : 0;
      const isMine = Number.isInteger(miVoto) && miVoto === i;
      return `
        <div class="feed-votacion-resultado-bar ${isMine ? 'mi-voto' : ''}">
          <div class="feed-votacion-bar-fill" style="width:${pct}%"></div>
          <div class="feed-votacion-bar-text">
            <span>${escHtml(op)} ${isMine ? '✔' : ''}</span>
            <span>${cnt} voto${cnt !== 1 ? 's' : ''} (${pct}%)</span>
          </div>
        </div>
      `;
    }).join('');

    if (!activa) {
      pollHtml = resultadosHtml;
      pollHtml += `<div style="text-align:center; font-size:12px; color:var(--text2); margin-top:10px;">
        🔒 Votación cerrada · ${totalVotos} votos en total
      </div>`;
    } else {
      const botones = (p.opciones || []).map((op, i) =>
        `<button class="feed-votacion-opcion ${Number.isInteger(miVoto) && miVoto === i ? 'votacion-opcion-seleccionada' : ''}" onclick="votarDesdeFeed('${p.votacionId}',${i},'${p.id}')">
          ${escHtml(op)}${Number.isInteger(miVoto) && miVoto === i ? ' ✔' : ''}
        </button>`
      ).join('');
      pollHtml = `<div class="feed-votacion-opciones-cta">${botones}</div>
      <div style="font-size:12px;color:var(--text2);margin:8px 0 6px;">${yaVoto ? 'Puedes cambiar tu voto mientras esté abierta.' : 'Elige una opción para votar.'}</div>
      ${resultadosHtml}
      <div style="text-align:center; font-size:12px; color:var(--text2); margin-top:8px;">${totalVotos} votos en total</div>`;
    }

    return `<div class="feed-card" data-id="${p.id}">
      <div class="feed-card-header">
        <img class="feed-card-avatar" src="${escHtml(p.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
        <div class="feed-card-meta">
          <div class="feed-card-author">${escHtml(p.authorName || 'Anónimo')}</div>
          <div class="feed-card-time">${fmtTime(p.createdAt)}</div>
        </div>
        <span class="feed-card-type-badge badge-votacion">🗳️ Votación</span>
      </div>
      <div class="feed-votacion-inline">
        <div class="feed-votacion-pregunta">🗳️ ${escHtml(p.pregunta || '')}</div>
        <div class="feed-votacion-opciones" id="fv-${p.id}">
          ${pollHtml}
        </div>
        <button class="btn-sm" style="margin-top:8px;font-size:12px" onclick="irADinamicas()">
          Ver resultados en Dinámicas →
        </button>
      </div>
      <div class="feed-card-actions">
        ${canDelete ? `<button class="feed-action-btn" style="margin-left:auto" onclick="eliminarPost('${p.id}')"><span>🗑️</span></button>` : ''}
      </div>
      <div class="feed-comments-section" style="display:none" data-open="0">
        <div class="feed-comments-list"></div>
        <div class="feed-comment-compose">
          <img class="feed-comment-avatar" src="${escHtml(currentUser.avatar || '')}" alt="" onerror="this.style.display='none'">
          <input type="text" class="feed-comment-input" placeholder="Escribe un comentario…" maxlength="300">
          <button class="feed-comment-send" data-post="${p.id}">➤</button>
        </div>
      </div>
    </div>`;
  }

  // Card especial para trivia
  if (p.type === 'trivia') {
    return `<div class="feed-card" data-id="${p.id}">
      <div class="feed-card-header">
        <img class="feed-card-avatar" src="${escHtml(p.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
        <div class="feed-card-meta">
          <div class="feed-card-author">${escHtml(p.authorName || 'Anónimo')}</div>
          <div class="feed-card-time">${fmtTime(p.createdAt)}</div>
        </div>
        <span class="feed-card-type-badge badge-trivia">🧠 Trivia</span>
      </div>
      <div class="feed-votacion-inline">
        <div class="feed-votacion-pregunta">${escHtml(p.text || '')}</div>
        <button class="btn-primary" style="margin-top:10px;font-size:13px;padding:8px 20px" onclick="irADinamicas()">
          🧠 Ir a jugar Trivia
        </button>
      </div>
      <div class="feed-card-actions">
        ${canDelete ? `<button class="feed-action-btn" style="margin-left:auto" onclick="eliminarPost('${p.id}')"><span>🗑️</span></button>` : ''}
      </div>
    </div>`;
  }

  let extraContentHtml = '';

  if (p.images && p.images.length) {
    if (p.images.length === 1) {
      extraContentHtml = `<img src="${escHtml(p.images[0])}" class="feed-card-img" alt="" onclick="openLightboxFeed(this)" style="cursor:pointer;">`;
    } else {
      // Si hay más de 4, aplicamos la clase count-more
      const countClass = p.images.length >= 4 ? 'count-more' : `count-${p.images.length}`;
      
      extraContentHtml = `<div class="feed-card-images-grid ${countClass}">` + p.images.map(img =>
        `<img src="${escHtml(img)}" alt="" onclick="openLightboxFeed(this)" style="cursor:pointer;">`
      ).join('') + `</div>`;
    }
} else if (p.type === 'libro' && p.libroData) {
    // Nos aseguramos de usar los datos correctos de ESTA publicación (p)
    const urlSegura = p.libroData.url ? escHtml(p.libroData.url) : '#';
    const nombreSeguro = p.libroData.name ? escHtml(p.libroData.name) : 'Archivo sin nombre';
    const colorClase = p.libroData.colorClass || 'book-default';
    const extCorta = p.libroData.ext ? escHtml(p.libroData.ext.substring(0, 4)) : 'FILE';

    extraContentHtml = `
      <div class="feed-libro-shared" onclick="window.open('${urlSegura}', '_blank')" style="cursor:pointer;">
        <div style="width: 80px; height: 110px; border-radius: 4px; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; box-shadow: 2px 4px 8px rgba(0,0,0,0.2); overflow: hidden;" class="${colorClase}">
          <div style="font-size: 24px; margin-bottom: 4px;">📄</div>
          <div style="background: rgba(0,0,0,0.4); color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800;">${extCorta}</div>
        </div>
        <div class="feed-libro-info" style="flex:1;">
          <h4 style="margin: 0 0 6px 0; line-height:1.2;">${nombreSeguro}</h4>
          <span style="display:inline-flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            Abrir Archivo
          </span>
        </div>
      </div>`;
  } else if (p.type === 'videotutorial' && p.dvdData) {
    extraContentHtml = `
      <div class="feed-dvd-shared" onclick="window.open('${p.dvdData.url}', '_blank')">
        <div class="dvd-rect-thumb">
          <img src="${p.dvdData.thumbnail}" alt="" class="dvd-rect-img">
          <div class="dvd-rect-play-overlay" style="opacity: 1; background: rgba(0,0,0,0.45);">▶</div>
        </div>
        <div class="feed-dvd-info">
          <h4>${escHtml(p.dvdData.titulo)}</h4>
        </div>
      </div>`;
  } else if (!extraContentHtml && p.text) {
    // Auto-detectar enlaces en el texto
    const linkData = detectLinkPreview(p.text);
    if (linkData) extraContentHtml = buildLinkPreviewHtml(linkData);
  }

  const likeCount = p.likes || 0;
  const commentCount = p.commentCount || 0;
  const isLiked = p.likedBy?.includes(currentUser.uid);

  return `<div class="feed-card" data-id="${p.id}">
    
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px;">
      <span class="feed-card-type-badge ${badgeTipo}">${badgeLabel}</span>
      ${canDelete ? `<button class="feed-action-btn" style="padding: 4px 8px; color: var(--red);" onclick="eliminarPost('${p.id}')" title="Eliminar aporte">🗑️</button>` : ''}
    </div>

    ${p.text ? `<div class="feed-card-body"><p class="feed-card-text">${escHtml(p.text)}</p></div>` : ''}
    ${extraContentHtml}

    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: rgba(0,0,0,0.05); border-top: 1px solid var(--border);">
      <img class="feed-card-avatar" src="${escHtml(p.authorAvatar || '')}" alt="" onerror="this.style.display='none'" style="width: 24px; height: 24px;">
      <div class="feed-card-meta">
        <div style="font-size: 11px; color: var(--text2);">Aportado por <strong style="color: var(--text0);">${escHtml(p.authorName || 'Anónimo')}</strong></div>
        <div style="font-size: 9px; color: var(--text3); margin-top: 2px;">${fmtTime(p.createdAt)}</div>
      </div>
    </div>

    <div class="feed-card-actions">
      <button class="feed-action-btn ${isLiked ? 'liked' : ''}" data-like="${p.id}">
        <span class="foco-icon" style="font-size: 16px;">💡</span> Útil (<span class="like-count">${likeCount}</span>)
      </button>
      <button class="feed-comments-toggle" data-post="${p.id}">
        📝 ${commentCount > 0 ? commentCount + ' notas' : 'Añadir nota'}
      </button>
    </div>
    
    ${likeCount > 0 ? `<div style="font-size: 11px; color: var(--text2); padding: 0 16px 12px; font-style: italic;">Le sirvió a ${likeCount} compañero${likeCount !== 1 ? 's' : ''}</div>` : ''}

    <div class="feed-comments-section" data-open="0" style="display:none">
      <div class="feed-comments-list"></div>
      <div class="feed-comment-compose">
        <img class="feed-comment-avatar" src="${escHtml(currentUser.avatar || '')}" alt="" onerror="this.style.display='none'">
        <input type="text" class="feed-comment-input" placeholder="Añade una nota, corrección o duda…" maxlength="300">
        <button class="feed-comment-send" data-post="${p.id}">➤</button>
      </div>
    </div>
  </div>`;
}


function loadComments(postId, sectionEl) {
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_comentarios'),
    where('postId', '==', postId),
    orderBy('createdAt', 'asc')
  );
  const list = sectionEl.querySelector('.feed-comments-list');
  if (sectionEl._commentsUnsub) sectionEl._commentsUnsub();
  sectionEl._commentsUnsub = onSnapshot(q, snap => {
    // Guardar conteo para el botón de cerrar
    sectionEl.dataset.count = String(snap.size);
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const c = { id: change.doc.id, ...change.doc.data() };
        if (list.querySelector(`[data-comment-id="${c.id}"]`)) return;
        const esMio = c.authorUid === currentUser.uid;
        const btnDel = (esMio || isAdmin)
          ? `<button class="comment-del-btn" onclick="eliminarComentario('${c.id}','${postId}')" title="Eliminar">🗑️</button>`
          : '';

        // Detectar si el comentario anterior es del mismo autor (agrupa visualmente)
        const items = list.querySelectorAll('.feed-comment-item');
        const lastItem = items.length ? items[items.length - 1] : null;
        const lastAuthor = lastItem ? lastItem.dataset.authorUid : null;
        const sameAuthor = lastAuthor === c.authorUid;

        const el = document.createElement('div');
        el.className = 'feed-comment-item' + (sameAuthor ? ' same-author' : '');
        el.dataset.commentId = c.id;
        el.dataset.authorUid = c.authorUid;
        el.innerHTML = `
          <img class="feed-comment-avatar" src="${escHtml(c.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
          <div class="feed-comment-bubble">
            <div class="feed-comment-author">${escHtml(c.authorName || 'Anónimo')}</div>
            <div class="feed-comment-text">${escHtml(c.text)}</div>
            <div class="feed-comment-time">${fmtTime(c.createdAt)} ${btnDel}</div>
          </div>`;
        const empty = list.querySelector('.comment-empty-msg');
        if (empty) empty.remove();
        list.appendChild(el);
        // Scroll suave al último comentario
        list.scrollTop = list.scrollHeight;
      }
      if (change.type === 'removed') {
        const el = list.querySelector(`[data-comment-id="${change.doc.id}"]`);
        if (el) {
          // Si era el primero de un bloque, el siguiente deja de ser same-author
          const next = el.nextElementSibling;
          if (next && next.classList.contains('same-author') && !el.classList.contains('same-author')) {
            next.classList.remove('same-author');
          }
          el.remove();
        }
        if (!list.querySelector('.feed-comment-item')) {
          list.innerHTML = '<div class="comment-empty-msg" style="font-size:12px;color:var(--text3);padding:4px 0">Sé el primero en comentar.</div>';
        }
      }
    });
    if (!list.querySelector('.feed-comment-item') && !list.querySelector('.comment-empty-msg')) {
      list.innerHTML = '<div class="comment-empty-msg" style="font-size:12px;color:var(--text3);padding:4px 0">Sé el primero en comentar.</div>';
    }
  });
}

window.eliminarComentario = async function (comentarioId, postId) {
  if (!confirm('¿Eliminar tu comentario?')) return;
  const { doc, deleteDoc, updateDoc, increment } = lib();
  try {
    await deleteDoc(doc(db(), 'ec_comentarios', comentarioId));
    await updateDoc(doc(db(), 'ec_feed', postId), { commentCount: increment(-1) });
  } catch (e) { alert('Error: ' + e.message); }
};

async function enviarComentario(postId, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;

  const sendBtn = inputEl.nextElementSibling;
  if(sendBtn) sendBtn.disabled = true;

  const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_comentarios'), {
      postId,
      groupId: currentGroupId,
      text,
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorEmail: currentUser.email,
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db(), 'ec_feed', postId), {
      commentCount: increment(1)
    });

    inputEl.value = '';
  } catch (e) { 
      console.error("Error al comentar:", e); 
  } finally {
      if(sendBtn) sendBtn.disabled = false;
  }
}

async function toggleFeedLike(postId, btn) {
  const { doc, updateDoc, arrayUnion, arrayRemove, increment } = lib();
  const uid = currentUser.uid;
  const isLiked = btn.classList.contains('liked');
  
  // Actualización visual inmediata sin romper el HTML
  btn.classList.toggle('liked');
  const spanCount = btn.querySelector('.like-count');
  let currentLikes = parseInt(spanCount.textContent) || 0;
  
  spanCount.textContent = isLiked ? (currentLikes - 1) : (currentLikes + 1);

  try {
    await updateDoc(doc(db(), 'ec_feed', postId), {
      likedBy: isLiked ? arrayRemove(uid) : arrayUnion(uid),
      likes: increment(isLiked ? -1 : 1)
    });
  } catch (e) { console.error(e); }
}

window.eliminarPost = async function (postId) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  const { doc, deleteDoc, getDoc } = lib();
  try {
    const snap = await getDoc(doc(db(), 'ec_feed', postId));
    if (!snap.exists()) return;
    const data = snap.data();

    // LÓGICA DE INMUNIDAD
    if (data.authorUid !== currentUser.uid) {
      if (isAdmin) {
        if (data.authorEmail && currentGroupData?.miembros?.includes(data.authorEmail)) {
          alert('🛡️ No puedes borrar esto. Solo el autor puede eliminar sus publicaciones mientras siga en el grupo.');
          return;
        }
      } else {
        alert('Solo puedes eliminar tus propias publicaciones.');
        return;
      }
    }

    await deleteDoc(doc(db(), 'ec_feed', postId));
  } catch (e) { alert('Error al eliminar: ' + e.message); }
};

/* ── PUBLICAR EN FEED ── */
let composeFiles = [];

$('composePhoto').addEventListener('change', e => {
  // En lugar de reemplazar, SUMAMOS los archivos nuevos a los que ya estaban
  const nuevos = [...e.target.files];
  composeFiles = [...composeFiles, ...nuevos];
  
  renderComposePreview();
  
  // Limpiamos el input para que te deje volver a seleccionar la misma foto si la borraste por error
  e.target.value = '';
});

function renderComposePreview() {
  let preview = $('composePreview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'composePreview';
    preview.className = 'compose-preview';
    $('composePhoto').parentElement.insertAdjacentElement('afterend', preview);
  }
  if (!composeFiles.length) { preview.innerHTML = ''; return; }
  preview.innerHTML = composeFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="compose-preview-item">
      <img src="${url}" alt="">
      <button class="compose-preview-remove" data-idx="${i}">✕</button>
    </div>`;
  }).join('');
  preview.querySelectorAll('.compose-preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      composeFiles.splice(Number(btn.dataset.idx), 1);
      renderComposePreview();
    });
  });
}

$('composeSend').addEventListener('click', async () => {
  const text = $('composeInput').value.trim();
  if (!text && !composeFiles.length) return;
  if (!currentGroupId) return;

  const btn = $('composeSend');
  btn.disabled = true;
  btn.textContent = '⏳';

  const { collection, addDoc, serverTimestamp } = lib();
  let images = [];

  if (composeFiles.length) {
    images = await Promise.all(composeFiles.map(f => uploadToCloudinary(f)));
    const exitosas = images.filter(Boolean); // Quita las que fallaron (null)

    // Si intentaste subir fotos pero fallaron, detenemos todo y te avisamos
    if (exitosas.length === 0 && composeFiles.length > 0) {
      alert('❌ Error: Cloudinary rechazó la imagen. (Abre la consola F12 para ver el motivo exacto). Tienes que crear tu propia cuenta gratis en cloudinary.com y cambiar las credenciales al inicio de app.js');
      btn.disabled = false;
      btn.textContent = '➤';
      return;
    }
    images = exitosas;
  }

  try {
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      text: text || '',
      images,
      type: images.length ? 'foto' : 'texto',
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorEmail: currentUser.email,
      authorAvatar: currentUser.avatar || '',
      likes: 0,
      likedBy: [],
      commentCount: 0,
      pinColor: window._composePinColor || 'purple',
      pinShape: window._composePinShape || 'flat',
      tableroId: currentTableroId || '',
      createdAt: serverTimestamp()
    });
    $('composeInput').value = '';
    composeFiles = [];
    $('composePhoto').value = '';
    renderComposePreview();
  } catch (e) {
    alert('Error al publicar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '➤';
  }
});

$('composeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composeSend').click(); }
});

/* ── Selector de color del pin en el compose ── */
window._composePinColor = 'purple';
window._composePinShape = 'flat';

function updateComposePinPreview(color, shape) {
  if (color) window._composePinColor = color;
  if (shape) window._composePinShape = shape;
  color = window._composePinColor;
  shape = window._composePinShape;

  // Re-render the entire pin SVG in the picker
  const picker = $('composePinPicker');
  const oldSvg = picker.querySelector('.compose-pin-svg');
  const svgStr = makePinSvg(color, shape);
  const tmp = document.createElement('span');
  tmp.innerHTML = svgStr;
  const newSvg = tmp.firstElementChild;
  newSvg.classList.add('compose-pin-svg');
  newSvg.id = 'composePinPreview';
  newSvg.style.cssText = 'width:22px;height:32px;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));transition:transform 0.15s';
  if (oldSvg) oldSvg.replaceWith(newSvg); else picker.prepend(newSvg);

  // Mark active color dot
  $('composePinDropdown').querySelectorAll('.compose-pin-option').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === color);
  });
  // Mark active shape btn
  $('composePinDropdown').querySelectorAll('.compose-shape-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shape === shape);
  });
}

// Build shape toggle buttons inside dropdown
function buildComposePinDropdown() {
  const dd = $('composePinDropdown');
  // Add shape row at top
  const shapeRow = document.createElement('div');
  shapeRow.className = 'pin-shape-row';
  shapeRow.style.cssText = 'width:100%;margin-bottom:6px;display:flex;gap:6px;justify-content:center';
  ['flat','tilted'].forEach(sh => {
    const btn = document.createElement('div');
    btn.className = 'compose-shape-btn pin-shape-btn' + (sh === 'flat' ? ' active' : '');
    btn.dataset.shape = sh;
    btn.title = sh === 'flat' ? 'Clásico' : 'Inclinado';
    const svgStr = makePinSvg(window._composePinColor, sh);
    const tmp = document.createElement('span');
    tmp.innerHTML = svgStr;
    const svg = tmp.firstElementChild;
    svg.style.cssText = 'width:18px;height:26px;pointer-events:none';
    btn.appendChild(svg);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      updateComposePinPreview(null, sh);
    });
    shapeRow.appendChild(btn);
  });
  dd.prepend(shapeRow);
}

buildComposePinDropdown();

$('composePinPicker').addEventListener('click', e => {
  e.stopPropagation();
  $('composePinDropdown').classList.toggle('open');
});

$('composePinDropdown').querySelectorAll('.compose-pin-option').forEach(dot => {
  dot.addEventListener('click', e => {
    e.stopPropagation();
    updateComposePinPreview(dot.dataset.color, null);
    $('composePinDropdown').classList.remove('open');
  });
});

document.addEventListener('click', () => {
  $('composePinDropdown')?.classList.remove('open');
});

updateComposePinPreview('purple', 'flat');

/* ═══════════════════════════════════════════════════
   LÓGICA DEL MURO (PERFIL PROPIO Y DE TERCEROS)
═══════════════════════════════════════════════════ */
let muroFotosUnsub = null;
let muroFeedUnsub = null;

/* ── ABRIR EL MURO DE UN COMPAÑERO DESDE LA BARRA LATERAL ── */

window.verMuroDeUsuario = async function (email, nombre) {
  // 1. Si das clic en tu propio nombre, limpiamos las variables para ver tu muro
  if (email === currentUser.email) {
    muroViendoUid = null;
    muroViendoEmail = null;
    muroViendoNombre = null;
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();
    return;
  }

  // 2. Si es un compañero, buscamos su ID en la base de datos
  const { collection, query, where, getDocs } = lib();
  try {
    const q = query(collection(db(), 'ec_users'), where('email', '==', email));
    const snap = await getDocs(q);

    // 3. Si el usuario fue invitado pero no ha iniciado sesión, usamos '__pending__'
    if (snap.empty) {
      muroViendoUid = '__pending__';
      muroViendoEmail = email;
      muroViendoNombre = nombre;
      setActiveNav('muro');
      activarSeccion('muro');
      closeSidebar();
      return;
    }

    // 4. Si el compañero sí existe, llenamos las variables y abrimos la sección
    muroViendoUid = snap.docs[0].id;
    muroViendoEmail = email;
    muroViendoNombre = snap.docs[0].data().name || nombre;
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();

  } catch (e) {
    console.error(e);
    alert('Error al buscar el perfil del compañero.');
  }
};

/* ═══════════════════════════════════════════════════
   MURO PERSONAL / MURO DE OTRO MIEMBRO
═══════════════════════════════════════════════════ */
function initMuro() {
  // ¿Estamos viendo el muro de otro?
  const esAjeno = muroViendoUid && muroViendoUid !== '__pending__';
  const esPropio = !muroViendoUid;
  const uid = esAjeno ? muroViendoUid : currentUser.uid;
  const nombre = esAjeno ? muroViendoNombre : currentUser.name;
  const avatar = esPropio ? currentUser.avatar : '';

  // Mostrar avatar del muro correctamente (URL, emoji o inicial)
  const muroAv = $('muroAvatar');
  const muroFb = $('muroAvatarFallback');
  if (muroAv && muroFb) {
    const isUrl = avatar && avatar.startsWith('http');
    const isEmoji = avatar && !isUrl && [...avatar].length <= 2;
    const initial = (nombre || '?').charAt(0).toUpperCase();
    if (isUrl) {
      muroAv.src = avatar; muroAv.style.display = 'block'; muroFb.style.display = 'none';
    } else {
      muroAv.style.display = 'none'; muroFb.style.display = 'flex';
      muroFb.textContent = isEmoji ? avatar : initial;
    }
  }
  if ($('muroNombre')) $('muroNombre').textContent = nombre;

  // Botón editar avatar/nombre: solo en muro propio
  const btnEditAv = $('btnEditarAvatar');
  if (btnEditAv) btnEditAv.style.display = esPropio ? '' : 'none';

  // Botón subir: solo visible en muro propio
  const btnSubir = $('btnMuroSubir');
  if (btnSubir) btnSubir.style.display = esPropio ? '' : 'none';

  // Botón volver si es ajeno
  let btnBack = $('muroBackBtn');
  if (esAjeno) {
    if (!btnBack) {
      btnBack = document.createElement('button');
      btnBack.id = 'muroBackBtn';
      btnBack.className = 'btn-sm';
      btnBack.style.marginBottom = '10px';
      btnBack.textContent = '← Volver a mi muro';
      btnBack.addEventListener('click', () => {
        muroViendoUid = null; muroViendoEmail = null; muroViendoNombre = null;
        initMuro();
      });
      const header = $('sectionMuro').querySelector('.muro-header');
      if (header) header.insertAdjacentElement('beforebegin', btnBack);
    }
    btnBack.style.display = '';
  } else {
    if (btnBack) btnBack.style.display = 'none';
  }

  if (muroViendoUid === '__pending__') {
    // Usuario invitado que aún no se ha registrado
    const grid = $('muroFotosGrid');
    if (grid) grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1;padding:30px">
      ${escHtml(muroViendoNombre)} aún no ha iniciado sesión en ZonaEscolar.
    </div>`;
    if ($('muroStats')) $('muroStats').textContent = '0 fotos';
    return;
  }

  // Abrir en publicaciones por defecto
  qsa('.muro-tab').forEach(t => t.classList.remove('active'));
  const tabPubs = document.querySelector('.muro-tab[data-tab="publicaciones"]');
  if (tabPubs) tabPubs.classList.add('active');
  const content = $('muroContent');
  if (content) content.innerHTML = `<div class="feed-list" id="muroPostsList"><div class="feed-loading">Cargando…</div></div>`;
  // ---------------------------------------------------------------------

  cargarMuroPublicaciones();
  cargarMuroStats(uid);
}

function cargarMuroStats(uid) {
  const targetUid = uid || currentUser.uid;
  const { collection, query, where, getDocs } = lib();
  const qFotos = query(collection(db(), 'ec_muro_fotos'), where('authorUid', '==', targetUid));
  getDocs(qFotos).then(snap => {
    if ($('muroStats')) $('muroStats').textContent = `${snap.size} foto${snap.size !== 1 ? 's' : ''}`;
  }).catch(() => { });
}

function cargarMuroFotos(uid, esPropio) {
  // SOLUCIÓN: Si le das clic a la pestaña, usa el ID de la persona que estás viendo
  const targetUid = uid || (muroViendoUid && muroViendoUid !== '__pending__' ? muroViendoUid : currentUser.uid);
  const prop = esPropio !== undefined ? esPropio : (targetUid === currentUser.uid);

  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_muro_fotos'),
    where('authorUid', '==', targetUid),
    orderBy('createdAt', 'desc')
  );

  const grid = $('muroFotosGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="feed-loading" style="grid-column:1/-1">Cargando fotos…</div>';

  muroFeedUnsub = onSnapshot(q, async snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    lightboxPhotos = fotos;

    if (!fotos.length) {
      grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1;padding:30px">
        ${prop ? 'No has subido fotos todavía.' : 'Este integrante aún no tiene fotos.'}<br>
        ${prop ? '<span style="font-size:12px;color:var(--text3)">Usa el botón "+ Foto" para subir al muro.</span>' : ''}
      </div>`;
      return;
    }

    // Consultar en qué tableros ya está compartida cada foto
    // Mapa: fotoId → Set de tableroIds donde ya existe
    const compartidasMap = {};
    if (prop && fotos.length) {
      try {
        const { collection, query, where, getDocs, orderBy } = lib();
        // Traer nombres de tableros para mostrar etiqueta
        const tablerosSnap = await getDocs(query(
          collection(db(), 'ec_tableros'),
          where('groupId', '==', currentGroupId)
        ));
        const tablerosNombres = { '': '🏠 Feed general' };
        tablerosSnap.forEach(d => {
          tablerosNombres[d.id] = `📌 ${d.data().nombre}`;
        });

        const feedSnap = await getDocs(query(
          collection(db(), 'ec_feed'),
          where('groupId', '==', currentGroupId),
          where('type', '==', 'foto')
        ));
        feedSnap.forEach(d => {
          const data = d.data();
          if (!data.muroFotoId) return;
          if (!compartidasMap[data.muroFotoId]) compartidasMap[data.muroFotoId] = [];
          const tId = data.tableroId ?? '';
          compartidasMap[data.muroFotoId].push(tablerosNombres[tId] || '📌 Tablero');
        });
      } catch (_) { /* si falla, renderizamos sin badges */ }
    }

    grid.innerHTML = fotos.map((f, i) => {
      const canDelFoto = f.authorUid === currentUser.uid || isAdmin;
      const btnDelFoto = canDelFoto
        ? `<button class="muro-photo-del" onclick="event.stopPropagation(); eliminarFotoMuro('${f.id}')" title="Eliminar foto">🗑️</button>`
        : '';

      const tablerosDonde = compartidasMap[f.id] || [];
      const yaCompartida = tablerosDonde.length > 0;
      const tooltipTexto = yaCompartida
        ? `Compartida en: ${tablerosDonde.join(', ')}`
        : 'Compartir en tablero';

      const badge = yaCompartida
        ? `<div class="muro-photo-compartido-badge" title="${escHtml(tooltipTexto)}">
             ✅
             <span class="muro-photo-compartido-lista">${escHtml(tablerosDonde.join(' · '))}</span>
           </div>`
        : '';

      const btnPublicar = prop
        ? `<button class="muro-photo-publish ${yaCompartida ? 'ya-pub' : ''}"
              onclick="event.stopPropagation(); publicarFotoMuroAlFeed('${f.id}','${escHtml(f.url)}')"
              title="${escHtml(tooltipTexto)}">
             ${yaCompartida ? '📢 Volver a compartir' : '📢 Compartir al Tablero'}
           </button>`
        : '';

      return `<div class="muro-photo-thumb" onclick="openLightbox(${i})">
        <img src="${escHtml(f.url)}" loading="lazy" alt="">
        ${btnDelFoto}
        ${badge}
        <div class="muro-photo-overlay">
          ${btnPublicar}
        </div>
      </div>`;
    }).join('');

    if ($('muroStats')) $('muroStats').textContent = `${fotos.length} foto${fotos.length !== 1 ? 's' : ''}`;
  });
}

// Eliminar foto del muro (propia o admin)
window.eliminarFotoMuro = async function (fotoId) {
  if (!confirm('¿Eliminar esta foto de tu muro?')) return;
  const { doc, deleteDoc, collection, query, where, getDocs } = lib();
  try {
    await deleteDoc(doc(db(), 'ec_muro_fotos', fotoId));
    // También eliminar la publicación del feed asociada si existe
    const snap = await getDocs(query(collection(db(), 'ec_feed'), where('muroFotoId', '==', fotoId)));
    for (const d of snap.docs) {
      await deleteDoc(doc(db(), 'ec_feed', d.id));
    }
  } catch (e) { alert('Error al eliminar: ' + e.message); }
};

// Publicar foto del muro al feed del grupo (manual, a decisión del usuario)
window.publicarFotoMuroAlFeed = async function(fotoId, url) {
  const { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } = lib();

  // Consultar en qué tableros ya existe esta foto
  const existingSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('muroFotoId', '==', fotoId)
  )).catch(() => null);

  const yaEn = new Set();
  existingSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    '¿En qué tablero quieres compartir esta foto?',
    async (tableroId, tableroNombre) => {
      try {
        const enEste = existingSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
          alert(`📢 ¡Publicación subida al inicio de "${tableroNombre}"!`);
        } else {
          const texto = prompt('¿Quieres agregar un texto? (opcional, OK para dejar vacío)') ?? '';
          await addDoc(collection(db(), 'ec_feed'), {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            type: 'foto',
            muroFotoId: fotoId,
            text: texto.trim(),
            images: [url],
            authorUid: currentUser.uid,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          alert(`¡Foto publicada en "${tableroNombre}"! 📢`);
        }
      } catch(e) { alert('Error al publicar: ' + e.message); }
    },
    yaEn
  );
};


$('btnMuroSubir').addEventListener('click', () => {
  muroViendoUid = null; // asegurar que subimos a nuestro propio muro
  $('muroFileInput').click();
});
$('muroFileInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  $('btnMuroSubir').disabled = true;
  $('btnMuroSubir').textContent = '⏳';
  const { collection, addDoc, serverTimestamp } = lib();
  for (const file of files) {
    const url = await uploadToCloudinary(file);
    if (url) {
      // Solo guardar en ec_muro_fotos — sin publicar automáticamente al feed
      await addDoc(collection(db(), 'ec_muro_fotos'), {
        url,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        groupId: currentGroupId,
        createdAt: serverTimestamp()
      });
    }
  }
  $('btnMuroSubir').disabled = false;
  $('btnMuroSubir').textContent = '+ Foto';
  $('muroFileInput').value = '';
  // Cambiar a la pestaña de fotos para que las vea
  qsa('.muro-tab').forEach(t => t.classList.remove('active'));
  const tabFotos = document.querySelector('.muro-tab[data-tab="fotos"]');
  if (tabFotos) tabFotos.classList.add('active');
  const content = $('muroContent');
  if (content) content.innerHTML = `<div class="muro-photos-grid" id="muroFotosGrid"></div>`;
  cargarMuroFotos();
});

// Tabs del muro
qsa('.muro-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qsa('.muro-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tipo = tab.dataset.tab;
    const content = $('muroContent');
    if (tipo === 'fotos') {
      content.innerHTML = `<div class="muro-photos-grid" id="muroFotosGrid"></div>`;
      cargarMuroFotos();
    } else {
      content.innerHTML = `<div class="feed-list" id="muroPostsList"><div class="feed-loading">Cargando…</div></div>`;
      cargarMuroPublicaciones();
    }
  });
});

function cargarMuroPublicaciones() {
  // Si estamos viendo el muro de otro miembro, mostrar SUS publicaciones
  const targetUid = (muroViendoUid && muroViendoUid !== '__pending__')
    ? muroViendoUid : currentUser.uid;
  const esPropio = targetUid === currentUser.uid;

  // Cancelar listener anterior para evitar acumulación de listeners duplicados
  if (muroFeedUnsub) { muroFeedUnsub(); muroFeedUnsub = null; }

  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_feed'),
    where('authorUid', '==', targetUid),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const list = $('muroPostsList');
  if (!list) return;
  muroFeedUnsub = onSnapshot(q, snap => {
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    if (!posts.length) {
      list.innerHTML = `<div class="feed-loading">${esPropio ? 'Aún no tienes publicaciones en este grupo.' : 'Este integrante aún no tiene publicaciones.'}</div>`;
      return;
    }

    const cols = getFeedCols(list);
    const numCols = getVisibleColCount();
    const newIds = new Set(posts.map(p => p.id));

    // Mostrar/ocultar columnas según pantalla
    cols.forEach((col, i) => { col.style.display = i < numCols ? '' : 'none'; });

    // Eliminar cards que ya no existen
    list.querySelectorAll('.feed-card[data-id]').forEach(el => {
      if (!newIds.has(el.dataset.id)) el.remove();
    });

    // Distribuir en columnas masonry (responsive)
    posts.forEach((p, idx) => {
      const col = cols[idx % numCols];
      const posInCol = Math.floor(idx / numCols);

      let card = list.querySelector(`.feed-card[data-id="${p.id}"]`);
      if (!card) {
        const tmp = document.createElement('div');
        tmp.innerHTML = buildFeedCard(p);
        card = tmp.firstElementChild;
        card.dataset.id = p.id;
        bindFeedCard(card, p.id);
        injectPin(card, getCardColor(p.id, p.pinColor), p.pinShape || 'flat');
      }

      const cardsInCol = [...col.querySelectorAll('.feed-card[data-id]')];
      const currentPosInCol = cardsInCol.indexOf(card);
      if (card.parentElement !== col || currentPosInCol !== posInCol) {
        const refCard = col.querySelectorAll('.feed-card[data-id]')[posInCol];
        if (refCard && refCard !== card) col.insertBefore(card, refCard);
        else if (!refCard) col.appendChild(card);
      }

      // Actualizar contadores
      const likeBtn = card.querySelector('.feed-action-btn[data-like]');
      if (likeBtn) {
        const isLiked = p.likedBy?.includes(currentUser.uid);
        likeBtn.className = `feed-action-btn ${isLiked ? 'liked' : ''}`;
        likeBtn.innerHTML = `<span class="foco-icon">💡</span> Útil (<span class="like-count">${p.likes || 0}</span>)`;
      }
      const commentToggle = card.querySelector('.feed-comments-toggle');
      if (commentToggle && card.querySelector('.feed-comments-section')?.dataset.open !== '1') {
        const cnt = p.commentCount || 0;
        commentToggle.textContent = `📝 ${cnt > 0 ? cnt + ' notas' : 'Añadir nota'}`;
      }
    });
  });
}

/* ═══════════════════════════════════════════════════
   CHAT - VERSIÓN MULTIPLATAFORMA (PC, Tablet, Móvil)
═══════════════════════════════════════════════════ */
let lastChatDateStr = '';
let chatUnreadDividerInserted = false;

// 1. Función maestra para manejar el scroll (SIN parpadeos de frames)
function ajustarScrollChat(isInitialLoad) {
  const box = $('chatMessages');
  if (!box) return;

  setTimeout(() => {
    if (isInitialLoad) {
      const unreadMark = $('chatUnreadMark');
      if (unreadMark) {
        unreadMark.scrollIntoView({ behavior: 'instant', block: 'center' });
      } else {
        box.scrollTop = box.scrollHeight;
      }
    } else {
      box.scrollTop = box.scrollHeight;
    }
  }, 50);
}

/** Baja el scroll hasta el último mensaje enviado por el usuario; si no hay, al final del hilo. */
function scrollChatToMyLastMessage() {
  const box = $('chatMessages');
  if (!box) return;
  const mine = qsa('.chat-msg.mine', box);
  const lastMine = mine[mine.length - 1];
  if (lastMine) {
    lastMine.scrollIntoView({ behavior: 'instant', block: 'end' });
  } else {
    box.scrollTop = box.scrollHeight;
  }
}

function initChat() {
  if (!currentGroupId) return;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  const box = $('chatMessages');
  box.innerHTML = '<div class="feed-loading" id="chatLoading">Conectando…</div>';
  lastChatDateStr = '';
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  let isFirst = true;
  let usingOrdered = true;

  const startListener = (ordered) => {
    if (chatUnsub) { chatUnsub(); chatUnsub = null; }
    const q = ordered
      ? query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc'),
        limit(120)
      )
      : query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        limit(120)
      );

    chatUnsub = onSnapshot(q, snap => {
      const loading = $('chatLoading');
      if (loading) loading.remove();
      const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 220;
      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getChatMsgMillis(a) - getChatMsgMillis(b));

      box.innerHTML = '';
      lastChatDateStr = '';
      mensajes.forEach(m => appendChatMessageObj(m, box));

      if (isFirst) {
        requestAnimationFrame(() => scrollChatToMyLastMessage());
      } else if (wasNearBottom) {
        requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
      }
      isFirst = false;
    }, err => {
      console.error('Chat error:', err);
      if (ordered && err.code === 'failed-precondition') {
        // Fallback para grupos viejos sin índice compuesto.
        usingOrdered = false;
        isFirst = true;
        startListener(false);
        return;
      }
      if (err.code === 'failed-precondition' && !usingOrdered) {
        box.innerHTML = '<div class="feed-loading" style="color:var(--amber);">⚠️ Falta un índice en Firestore. Revisa la consola (F12).</div>';
      } else {
        box.innerHTML = '<div class="feed-loading" style="color:var(--red);">⚠️ Error de conexión</div>';
      }
    });
  };

  startListener(true);

  // Iniciar presencia online y escucha de typing
  initChatOnline();
  initChatTypingListener();
  markChatAsRead();
}

function appendChatMessageObj(m, box) {
  const mine = m.authorUid === currentUser?.uid;

  // Soporta varios formatos históricos de fecha sin romper el render.
  const rawDate = getChatMsgDate(m) || new Date();
  const msgDate = fmtDateChat(rawDate);

  if (msgDate && msgDate !== lastChatDateStr) {
    const divider = document.createElement('div');
    divider.className = 'chat-date-divider';
    divider.innerHTML = `<span>${escHtml(msgDate)}</span>`;
    box.appendChild(divider);
    lastChatDateStr = msgDate;
  }

  let bubbleContent = m.imageUrl
    ? `<img src="${escHtml(m.imageUrl)}" class="chat-msg-img" onclick="openChatImgLightbox('${escHtml(m.imageUrl)}')" style="cursor:pointer;max-width:220px;border-radius:10px;display:block;margin-top:4px;">`
    : escHtml(m.text);

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${mine ? 'mine' : ''}`;
  msgEl.dataset.id = m.id;
  msgEl.innerHTML = `
    <img class="chat-msg-avatar" src="${escHtml(m.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
    <div class="chat-msg-wrap">
      <div class="chat-msg-author" style="${mine ? 'text-align:right;color:var(--accent2);' : ''}">${escHtml(m.authorName || 'Compañero')}</div>
      <div class="chat-msg-bubble">${bubbleContent}</div>
      <div class="chat-msg-time">
        ${fmtTimeChat(getChatMsgDate(m) || m.createdAt)}
        ${mine ? `<button class="chat-del-btn" onclick="eliminarMensaje('${m.id}')" title="Eliminar">🗑️</button>` : ''}
      </div>
    </div>`;
  box.appendChild(msgEl);
}

/* ── ENVÍO DE MENSAJES ── */
async function enviarMensaje() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text || !currentGroupId) return;

  const btn = $('chatSend');
  btn.disabled = true; // Desactivar para evitar doble clic

  // 1. Limpiamos el input visualmente
  input.value = '';
  input.dispatchEvent(new Event('input')); // Restaura tamaño

  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_chat'), {
      groupId: currentGroupId,
      text,
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });
    // Hacemos scroll abajo después de enviar
    const msgBox = $('chatMessages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
  } catch (e) {
    console.error("Error al enviar:", e);
    alert("No se pudo enviar el mensaje.");
    input.value = text; // Restaurar texto si falla
  } finally {
    btn.disabled = false; // Rehabilitar siempre
  }
}

/* ══════════════════════════════════════════════════════
   CHAT — FEATURES v1.4: seenBy ✔✔ · Typing · Online
══════════════════════════════════════════════════════ */

/* ── seenBy: marcar mensaje como visto ── */
async function marcarMensajeVisto(msgId) {
  if (!currentUser || !msgId) return;
  try {
    const { doc, updateDoc } = lib();
    await updateDoc(doc(db(), 'ec_chat', msgId), {
      [`seenBy.${currentUser.uid}`]: true
    });
  } catch (_) { /* silencioso — no bloquear el chat */ }
}

/* ── Typing indicator: escuchar quién está escribiendo ── */
function initChatTypingListener() {
  if (chatTypingUnsub) { chatTypingUnsub(); chatTypingUnsub = null; }
  if (!currentGroupId) return;

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_typing'),
    where('groupId', '==', currentGroupId)
  );

  chatTypingUnsub = onSnapshot(q, snap => {
    const indicator = $('chatTypingIndicator');
    if (!indicator) return;
    const now = Date.now();
    const typing = [];
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.uid === currentUser.uid) return; // ignorar el propio
      const ts = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || 0);
      if (now - ts < 3000) typing.push(data.name || 'Compañero');
    });
    if (typing.length === 0) {
      indicator.style.display = 'none';
      indicator.textContent = '';
    } else {
      const names = typing.slice(0, 2).join(', ');
      indicator.textContent = `${names} ${typing.length === 1 ? 'está escribiendo…' : 'están escribiendo…'}`;
      indicator.style.display = 'block';
    }
  });
}

async function enviarTypingSignal() {
  if (!currentGroupId || !currentUser) return;
  try {
    const { doc, setDoc, serverTimestamp } = lib();
    await setDoc(doc(db(), 'ec_typing', `${currentGroupId}_${currentUser.uid}`), {
      groupId: currentGroupId,
      uid: currentUser.uid,
      name: getUserAlias(),
      updatedAt: serverTimestamp()
    });
  } catch (_) { /* silencioso */ }
}

/* ── Online presence: quién está conectado ahora ── */
function initChatOnline() {
  if (!currentGroupId || !currentUser) return;
  _setOnlineStatus();

  if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_online'),
    where('groupId', '==', currentGroupId)
  );

  chatOnlineUnsub = onSnapshot(q, snap => {
    const list = $('chatOnlineList');
    if (!list) return;
    const now = Date.now();
    const online = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const ts = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || 0);
      if (now - ts < 35000) online.push(data);
    });
    // Mostrar solo si hay otros conectados (no solo yo)
    const others = online.filter(d => d.uid !== currentUser.uid);
    if (others.length === 0) {
      list.style.display = 'none';
    } else {
      list.style.display = 'flex';
      list.innerHTML = others
        .map(d => `<span class="chat-online-pill"><span class="online-dot"></span>${escHtml(d.name || 'Compañero')}</span>`)
        .join('');
    }
  });
}

function initSidebarOnlinePresence() {
  if (!currentGroupId) return;
  if (sidebarOnlineUnsub) { sidebarOnlineUnsub(); sidebarOnlineUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_online'),
    where('groupId', '==', currentGroupId)
  );
  sidebarOnlineUnsub = onSnapshot(q, snap => {
    const now = Date.now();
    const onlineEmails = new Set();
    snap.docs.forEach(d => {
      const data = d.data();
      const ts = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || 0);
      if (now - ts >= 35000) return;
      const em = (data.email || '').toString().trim().toLowerCase();
      if (em) onlineEmails.add(em);
    });
    qsa('.sidebar-member-btn[data-email]').forEach(el => {
      const raw = (el.dataset.email || '').trim().toLowerCase();
      el.classList.toggle('sidebar-member-online', Boolean(raw && onlineEmails.has(raw)));
    });
  });
}

async function _setOnlineStatus() {
  if (!currentGroupId || !currentUser) return;
  try {
    const { doc, setDoc, serverTimestamp } = lib();
    const emailNorm = (currentUser.email || '').toString().trim().toLowerCase();
    await setDoc(doc(db(), 'ec_online', `${currentGroupId}_${currentUser.uid}`), {
      groupId: currentGroupId,
      uid: currentUser.uid,
      email: emailNorm,
      name: getUserAlias(),
      updatedAt: serverTimestamp()
    });
  } catch (_) { /* silencioso */ }
}

window.eliminarMensaje = async function (msgId) {
  if (!confirm('¿Eliminar este mensaje?')) return;
  const { doc, deleteDoc } = lib();
  try {
    await deleteDoc(doc(db(), 'ec_chat', msgId));
  } catch (e) { alert('Error: ' + e.message); }
};

// Abrir imagen del chat en el lightbox existente
window.openChatImgLightbox = function (url) {
  const lb = $('lightbox');
  const img = $('lightboxImg');
  if (!lb || !img) return;
  img.src = url;
  $('lightboxCaption').textContent = '';
  lb.classList.add('open');
  $('lightboxPrev').style.display = 'none';
  $('lightboxNext').style.display = 'none';
};

/* ── LISTENERS ── */
$('chatSend').addEventListener('click', enviarMensaje);

$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensaje();
  }
});

// Crecer al escribir
$('chatInput').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  // Typing signal con throttle — solo si hay texto
  if (this.value.trim()) {
    if (_typingTimeout) clearTimeout(_typingTimeout);
    _typingTimeout = setTimeout(() => enviarTypingSignal(), 400);
  }
});

$('chatInput').addEventListener('focus', () => {
  setTimeout(() => ajustarScrollChat(false), 300);
});

// ── ENVIAR IMAGEN EN CHAT ──
$('chatImgBtn').addEventListener('click', () => $('chatImgInput').click());

$('chatImgInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || !currentGroupId) return;

  const btn = $('chatImgBtn');
  btn.textContent = '⏳';
  btn.disabled = true;

  try {
    const url = await uploadToCloudinary(file);
    if (!url) { alert('No se pudo subir la imagen.'); throw new Error('upload_failed'); }

    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_chat'), {
      groupId: currentGroupId,
      text: '',
      imageUrl: url,
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    if (err.message !== 'upload_failed') {
      console.error('Error enviando imagen al chat:', err);
      alert('Error al enviar imagen.');
    }
  } finally {
    btn.textContent = '📷';
    btn.disabled = false;
    $('chatImgInput').value = '';
  }
});

/* ═══════════════════════════════════════════════════
   TAREAS
═══════════════════════════════════════════════════ */
function initTareas() {
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }

    const { collection, query, where, orderBy, onSnapshot } = lib();
    const q = query(
        collection(db(), 'ec_tareas'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc')
    );

    // En lugar de limpiar TODO el contenedor, solo ponemos el loading en la parte de la lista
    // Si la vista es calendario, mantenemos la estructura.
    if (!tareasVistaCalendario) {
        $('tareasList').innerHTML = '<div class="feed-loading">Cargando tareas…</div>';
    }

    tareasUnsub = onSnapshot(q, snap => {
        const tareas = [];
        snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
        
        if (tareasVistaCalendario) {
            const hoy = new Date();
            const año = hoy.getFullYear() + Math.floor((hoy.getMonth() + calMesOffset) / 12);
            const mes = ((hoy.getMonth() + calMesOffset) % 12 + 12) % 12;
            renderCalMes(tareas, año, mes);
        } else {
            renderTareas(tareas);
        }
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
      <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}',${!t.done})">${t.done ? '✓' : ''}</button>
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

function buildTareaHTML(t) {
    const esMio = t.authorUid === currentUser.uid;
    const tienePermiso = isAdmin || esMio;

    // --- NUEVO: Renderizar sub-tareas si existen ---
    let subTareasHtml = '';
    if (t.subtareas && t.subtareas.length > 0) {
        const total = t.subtareas.length;
        const completadas = t.subtareas.filter(s => s.done).length;
        const progreso = total === 0 ? 0 : Math.round((completadas / total) * 100);

        subTareasHtml = `
        <div style="margin-top:12px; background:var(--bg1); padding:10px; border-radius:8px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:11px; color:var(--text2);">
                <span>Progreso del equipo: ${completadas}/${total}</span>
                <span>${progreso}%</span>
            </div>
            <div style="width:100%; height:4px; background:var(--bg3); border-radius:2px; margin-bottom:12px; overflow:hidden;">
                <div style="width:${progreso}%; height:100%; background:var(--green); transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${t.subtareas.map((sub, idx) => `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" style="accent-color:var(--accent); width:14px; height:14px; cursor:pointer;" 
                               ${sub.done ? 'checked' : ''} 
                               onchange="toggleSubtarea('${t.id}', ${idx}, this.checked)">
                        <span style="font-size:12px; ${sub.done ? 'text-decoration:line-through; opacity:0.5;' : 'color:var(--text0);'} flex:1;">
                            ${escHtml(sub.texto)}
                        </span>
                        ${sub.responsable ? `<span style="font-size:10px; background:var(--bg3); padding:2px 6px; border-radius:4px; color:var(--text2);">${escHtml(sub.responsable)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    return `
    <div class="tarea-card ${t.done ? 'done' : ''}" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div style="display:flex; gap:12px; flex:1;">
                <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}', ${!t.done})">
                    ${t.done ? '✓' : ''}
                </button>
                <div class="tarea-body">
                    <div class="tarea-titulo">${escHtml(t.titulo)}</div>
                    <div class="tarea-meta" style="margin-top:6px;">
                        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
                        ${t.responsable && (!t.subtareas || t.subtareas.length === 0) ? `<span class="tarea-badge badge-responsable" style="opacity:0.7;">👤 ${escHtml(t.responsable)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${tienePermiso ? `
                <button class="tarea-delete" onclick="eliminarTarea('${t.id}')" style="margin-left:10px;">
                    🗑️
                </button>
            ` : ''}
        </div>
        ${subTareasHtml}
    </div>`;
}

window.toggleSubtarea = async function(tareaId, subIdx, isDone) {
    const { doc, getDoc, updateDoc } = lib();
    try {
        const ref = doc(db(), 'ec_tareas', tareaId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        
        const data = snap.data();
        const subs = data.subtareas || [];
        
        if (subs[subIdx]) {
            subs[subIdx].done = isDone;
            
            // Evaluamos si todas las sub-tareas ya se completaron
            const todasCompletadas = subs.every(s => s.done);
            
            // Actualizamos el array en Firestore y, si todas están listas, marcamos la tarea principal como "done"
            await updateDoc(ref, { 
                subtareas: subs, 
                done: todasCompletadas 
            });
        }
    } catch (e) {
        console.error("Error al actualizar sub-tarea:", e);
    }
};

/* ═══════════════════════════════════════════════════
   BIBLIOTECA - SISTEMA DE REPISAS Y DRIVE (FINAL)
═══════════════════════════════════════════════════ */

// limpiarLinkDrive está declarada en la sección de utilidades (línea ~157)

function initBiblioteca() {
  if (!currentGroupId) return;

  // Manejo del botón "Nueva Repisa" para el Admin
  let btnAddCat = $('btnNuevaCatBiblio');
  if (!btnAddCat) {
    const header = document.querySelector('.biblio-actions');
    if (header) {
      btnAddCat = document.createElement('button');
      btnAddCat.id = 'btnNuevaCatBiblio';
      btnAddCat.className = 'btn-sm';
      btnAddCat.textContent = '+ Nueva Repisa';
      btnAddCat.style.marginRight = '8px';
      btnAddCat.onclick = () => openModal('modalNuevaCategoriaBiblio');
      header.prepend(btnAddCat);
    }
  }
  if (btnAddCat) btnAddCat.style.display = isAdmin ? 'inline-block' : 'none';

  if (!bibliotecaUiBound) {
    bibliotecaUiBound = true;

// 2. Abrir Modal de Libro
$('btnAgregarArchivoBiblioMain')?.addEventListener('click', () => {
  if (biblioCategorias.length === 0) {
    alert('El administrador debe crear una repisa primero.');
    return;
  }

  // Abrimos el modal
  openModal('modalAgregarBiblio');

  // Limpiamos los campos de texto
  if ($('biblioNombre')) $('biblioNombre').value = '';
  if ($('biblioUrl')) $('biblioUrl').value = '';

  // --- SOLUCIÓN PARA EL COLOR POR DEFECTO ---
  
  // 1. Buscamos TODOS los botones de colores
  const todosLosColores = document.querySelectorAll('.book-color-opt');
  
  // 2. Quitamos la clase 'selected' de todos para empezar de cero
  todosLosColores.forEach(b => b.classList.remove('selected'));

  // 3. Seleccionamos el primero de la lista (sea el color que sea)
  const primerColor = todosLosColores[0]; 

  if (primerColor) {
    primerColor.classList.add('selected'); // Lo marca visualmente
    selectedBiblioColor = primerColor.dataset.color; // Guarda el valor para la base de datos
  }
});

    // Color picker del modal
    document.querySelectorAll('.book-color-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.book-color-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedBiblioColor = btn.dataset.color;
      });
    });

    // Guardar Categoría (Admin)
    $('btnConfirmarCatBiblio')?.addEventListener('click', async () => {
      const nombre = $('nombreCatBiblio').value.trim();
      if (!nombre) return;
      const { collection, addDoc, serverTimestamp } = lib();
      try {
        await addDoc(collection(db(), 'ec_biblio_categorias'), {
          name: nombre,
          groupId: currentGroupId,
          createdAt: serverTimestamp()
        });
        closeModal('modalNuevaCategoriaBiblio');
        $('nombreCatBiblio').value = '';
      } catch (e) { console.error(e); }
    });

    // Guardar Libro
    const btnConfLibro = $('btnConfirmarBiblio');
    if (btnConfLibro) {
      btnConfLibro.onclick = async () => {
        const nombre = $('biblioNombre').value.trim();
        const urlOriginal = $('biblioUrl').value.trim();
        const catId = $('selectCatBiblio').value;

        if (!nombre || !urlOriginal || !catId) { alert('Faltan datos.'); return; }

        const urlLimpia = limpiarLinkDrive(urlOriginal);
        const descripcion = $('biblioDesc') ? $('biblioDesc').value.trim() : ''; // <-- NUEVA LÍNEA: Guarda la descripción

        btnConfLibro.disabled = true;
        btnConfLibro.textContent = '⏳...';

        const { collection, addDoc, serverTimestamp } = lib();
        try {
          await addDoc(collection(db(), 'ec_biblioteca'), {
            groupId: currentGroupId,
            categoriaId: catId,
            name: nombre,
            descripcion: descripcion, // <-- NUEVA LÍNEA: Se manda a Firebase
            url: urlLimpia,
            ext: (nombre.split('.').pop() || 'LINK').toUpperCase(),
            colorClass: selectedBiblioColor,
            authorUid: currentUser.uid,
            authorName: getUserAlias(),
            createdAt: serverTimestamp()
          });
          closeModal('modalAgregarBiblio');
        } catch (e) { alert(e.message); }
        finally {
          btnConfLibro.disabled = false;
          btnConfLibro.textContent = 'Guardar';
        }
      };
    }
  }
  loadBiblioCategorias();
}

function loadBiblioCategorias() {
  if (catBiblioUnsub) catBiblioUnsub();
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_biblio_categorias'), where('groupId', '==', currentGroupId));

  catBiblioUnsub = onSnapshot(q, snap => {
    biblioCategorias = [];
    snap.forEach(d => biblioCategorias.push({ id: d.id, ...d.data() }));

    const sel = $('selectCatBiblio');
    if (sel) {
      sel.innerHTML = biblioCategorias.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
        || '<option value="">Crea una repisa primero</option>';
    }
    renderBiblioteca();
  });
}

function renderBiblioteca() {
  const container = $('biblioList');
  if (!container) return;

  if (bibliotecaUnsub) bibliotecaUnsub();
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_biblioteca'), where('groupId', '==', currentGroupId));

  bibliotecaUnsub = onSnapshot(q, snap => {
    const todosLosLibros = [];
    snap.forEach(d => todosLosLibros.push({ id: d.id, ...d.data() }));

    if (biblioCategorias.length === 0) {
      container.innerHTML = '<div class="feed-loading">El admin debe crear una repisa.</div>';
      return;
    }

    container.innerHTML = biblioCategorias.map(cat => {
      const librosDeEstaCat = todosLosLibros.filter(l => l.categoriaId === cat.id);
      return `
        <div class="repisa-bloque" style="margin-bottom: 40px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:5px;">
            <h3 style="font-family:var(--font-display); font-size:16px;">📚 ${escHtml(cat.name)}</h3>
            ${isAdmin ? `<button class="btn-sm" style="color:var(--red);" onclick="eliminarCategoria('${cat.id}', '${cat.name}')">🗑️ Borrar</button>` : ''}
          </div>
          <div class="bookshelf-container">
            ${librosDeEstaCat.map(it => {
        const puedeBorrar = isAdmin || it.authorUid === currentUser.uid;
        return `
                <div class="book-wrapper" title="${escHtml(it.name)}">
                  <div class="book-item ${it.colorClass || 'book-default'}" onclick="event.stopPropagation(); window.abrirModalLibro('${it.id}')">
                    <div class="book-ext-badge">${escHtml(it.ext.substring(0, 4))}</div>
                    <div class="book-spine-title">${escHtml(it.name)}</div>
                  </div>
                  ${puedeBorrar ? `<button class="btn-mat-del" style="top:-10px; right:5px;" onclick="eliminarLibro('${it.id}')">✕</button>` : ''}
                </div>`;
      }).join('') || '<p style="font-size:12px; opacity:0.4; padding:20px; width:100%; text-align:center;">Vacía</p>'}
          </div>
        </div>`;
    }).join('');
  });
}

window.eliminarLibro = async function (id) {
  if (!confirm('¿Eliminar archivo?')) return;
  const { doc, deleteDoc } = lib();
  try { await deleteDoc(doc(db(), 'ec_biblioteca', id)); } catch (e) { }
};

window.eliminarCategoria = async function (id, nombre) {
  if (!confirm(`¿Eliminar repisa "${nombre}"?`)) return;
  const { doc, deleteDoc, collection, query, where, getDocs } = lib();
  const q = query(collection(db(), 'ec_biblioteca'), where('categoriaId', '==', id));
  const snap = await getDocs(q);
  for (const d of snap.docs) await deleteDoc(doc(db(), 'ec_biblioteca', d.id));
  await deleteDoc(doc(db(), 'ec_biblio_categorias', id));
};

/* ── VISTA CALENDARIO DE TAREAS ── */
function renderCalendarioTareas(tareas) {
  const container = $('tareasList');
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();

  // Agrupar tareas por fecha
  const tareasPorDia = {};
  tareas.filter(t => t.fecha && !t.done).forEach(t => {
    const d = new Date(t.fecha);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tareasPorDia[key]) tareasPorDia[key] = [];
    tareasPorDia[key].push(t);
  });

  // Días del mes
  const primerDia = new Date(año, mes, 1).getDay();
  const diasMes = new Date(año, mes + 1, 0).getDate();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nombresDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  let html = `<div class="cal-header">
    <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
    <span class="cal-mes-label">${nombresMes[mes]} ${año}</span>
    <button class="cal-nav" onclick="calNavegar(1)">›</button>
  </div>
  <div class="cal-grid">
    ${nombresDia.map(d => `<div class="cal-dia-header">${d}</div>`).join('')}`;

  // Espacios vacíos al inicio
  for (let i = 0; i < primerDia; i++) html += `<div class="cal-dia vacio"></div>`;

  for (let dia = 1; dia <= diasMes; dia++) {
    const key = `${año}-${mes}-${dia}`;
    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
    const tsDia = tareasPorDia[key] || [];
    html += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tsDia.length ? 'tiene-tarea' : ''}"
      onclick="calVerDia(${dia},${mes},${año})">
      <span class="cal-num">${dia}</span>
      ${tsDia.length ? `<span class="cal-punto">${tsDia.length}</span>` : ''}
    </div>`;
  }

  html += `</div>`;

  // Tareas del mes con fechas
  const proximas = tareas
    .filter(t => t.fecha && !t.done)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, 10);

  if (proximas.length) {
    html += `<div class="cal-proximas-label">📋 Próximas tareas</div>`;
    html += proximas.map(t => {
      const d = new Date(t.fecha);
      const diasRestantes = Math.ceil((d - hoy) / 86400000);
      const urgente = diasRestantes <= 2 && diasRestantes >= 0;
      const vencida = diasRestantes < 0;
      return `<div class="cal-tarea-item ${urgente ? 'urgente' : ''} ${vencida ? 'vencida-cal' : ''}">
        <div class="cal-tarea-fecha">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          <span class="cal-dias-rest">${vencida ? '⚠️ Vencida' : diasRestantes === 0 ? '¡Hoy!' : `en ${diasRestantes}d`}</span>
        </div>
        <div class="cal-tarea-titulo">${escHtml(t.titulo)}</div>
        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
      </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

let calMesOffset = 0;
window.calNavegar = function (dir) {
  calMesOffset += dir;
  // Rebuscar tareas con el nuevo mes
  const { collection, query, where, orderBy, getDocs } = lib();
  getDocs(query(collection(db(), 'ec_tareas'), where('groupId', '==', currentGroupId), orderBy('createdAt', 'desc')))
    .then(snap => {
      const tareas = [];
      snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
      const hoy = new Date();
      const target = new Date(hoy.getFullYear(), hoy.getMonth() + calMesOffset, 1);
      renderCalMes(tareas, target.getFullYear(), target.getMonth());
    });
};

function renderCalMes(tareas, año, mes) {
  const container = $('tareasList');
  const hoy = new Date();
  const tareasPorDia = {};
  
  // 1. Agrupar las tareas del mes
  tareas.filter(t => t.fecha && !t.done).forEach(t => {
    const d = new Date(t.fecha);
    if (d.getFullYear() === año && d.getMonth() === mes) {
      const key = `${d.getDate()}`;
      if (!tareasPorDia[key]) tareasPorDia[key] = [];
      tareasPorDia[key].push(t);
    }
  });
  
  const primerDia = new Date(año, mes, 1).getDay();
  const diasMes = new Date(año, mes + 1, 0).getDate();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nombresDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // 2. Construir el Header y los días de la semana
  let html = `<div class="cal-header">
    <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
    <span class="cal-mes-label">${nombresMes[mes]} ${año}</span>
    <button class="cal-nav" onclick="calNavegar(1)">›</button>
  </div><div class="cal-grid">
    ${nombresDia.map(d => `<div class="cal-dia-header">${d}</div>`).join('')}`;
    
  // 3. Espacios vacíos antes del día 1
  for (let i = 0; i < primerDia; i++) {
    html += `<div class="cal-dia vacio"></div>`;
  }
  
  // 4. Dibujar los números del mes
  for (let dia = 1; dia <= diasMes; dia++) {
    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
    const tsDia = tareasPorDia[String(dia)] || [];
    
    html += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tsDia.length ? 'tiene-tarea' : ''}"
      onclick="calVerDia(${dia},${mes},${año})">
      <span class="cal-num">${dia}</span>
      ${tsDia.length ? `<span class="cal-punto">${tsDia.length}</span>` : ''}
    </div>`;
  }
  
  // AQUI CERRAMOS EL CALENDARIO CORRECTAMENTE
  html += `</div>`; 

  // -------------------------------------------------------------------------
  // 5. EL CONTENEDOR PARA CUANDO HACES CLIC EN UN DÍA (Vacío al principio)
  // -------------------------------------------------------------------------
  html += `<div id="calListaTareasAbajo" style="margin-top:20px;"></div>`;

  // -------------------------------------------------------------------------
  // 6. EL CONTENEDOR DE PRÓXIMAS TAREAS (Visible al principio)
  // -------------------------------------------------------------------------
  const proximas = tareas.filter(t => t.fecha && !t.done).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 8);
  
  html += `<div id="contenedorProximasTareas">`;
  if (proximas.length > 0) {
    html += `<div class="cal-proximas-label" style="margin-top:20px; margin-bottom:10px;">📋 Próximas tareas</div>`;
    // Usamos la nueva tarjeta de diseño
    html += proximas.map(t => buildTareaHTML(t)).join('');
  }
  html += `</div>`;

  // Finalmente insertamos todo de golpe sin parpadeos
  container.innerHTML = html;
}

window.calVerDia = function (dia, mes, año) {
    // 1. UI: Resaltar día en el calendario
    qsa('.cal-dia').forEach(el => el.classList.remove('selected'));
    const target = qsa('.cal-num').find(el => 
        parseInt(el.textContent) === dia && !el.closest('.cal-dia').classList.contains('vacio')
    );
    if (target) target.closest('.cal-dia').classList.add('selected');

    calDiaSeleccionado = { dia, mes, año };

    // 2. Ocultamos las "Próximas Tareas" generales para que no haya duplicados
    const proxDiv = $('contenedorProximasTareas');
    if (proxDiv) proxDiv.style.display = 'none';

    // 3. Consultamos Firebase para obtener las tareas
    const { collection, query, where, getDocs } = lib();
    const q = query(collection(db(), 'ec_tareas'), where('groupId', '==', currentGroupId));

    getDocs(q).then(snap => {
        const filtradas = [];
        snap.forEach(d => {
            const t = d.data();
            if (t.fecha) {
                // Hay que usar Date local, no toDate() directamente porque viene en string desde tu input type="datetime-local"
                const dTarea = new Date(t.fecha);
                if (dTarea.getDate() === dia && dTarea.getMonth() === mes && dTarea.getFullYear() === año) {
                    filtradas.push({ id: d.id, ...t });
                }
            }
        });

        // 4. Renderizamos el resultado en el contenedor de abajo
        const listaAbajo = $('calListaTareasAbajo');
        if (!listaAbajo) return;

        const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        listaAbajo.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="font-size:14px; color:var(--accent2); margin:0;">📌 Tareas del ${dia} de ${nombresMes[mes]}</h4>
                <button onclick="resetVistaCalendario()" style="background:none; border:none; color:var(--text3); font-size:11px; cursor:pointer; text-decoration:underline;">
                    Ver próximas tareas
                </button>
            </div>
            ${filtradas.length === 0 
                ? `<div style="padding:20px; text-align:center; background:var(--bg3); border-radius:12px; border:1px dashed var(--border); font-size:13px; color:var(--text2);">No hay tareas para este día.</div>` 
                : filtradas.map(t => buildTareaHTML(t)).join('')
            }
        `;
    });
};

// Función para volver al estado inicial (Quitar el filtro)
window.resetVistaCalendario = function() {
    qsa('.cal-dia').forEach(el => el.classList.remove('selected'));
    calDiaSeleccionado = null; // Borramos la selección
    
    const listaAbajo = $('calListaTareasAbajo');
    if (listaAbajo) listaAbajo.innerHTML = ''; // Limpiamos el detalle
    
    const proxDiv = $('contenedorProximasTareas');
    if (proxDiv) proxDiv.style.display = 'block'; // Mostramos las próximas de nuevo
};

function renderTareasEnListaPrincipal(tareas, dia, mes) {
    const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const contenedor = $('tareasList'); // El contenedor que ya tienes abajo
    
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h4 style="font-size:14px; color:var(--accent2); margin:0;">
                📌 Tareas del ${dia} de ${nombresMes[mes]}
            </h4>
            <button onclick="initTareas()" style="background:none; border:none; color:var(--text2); font-size:11px; cursor:pointer; text-decoration:underline;">
                Ver todas las tareas
            </button>
        </div>
    `;

    if (tareas.length === 0) {
        html += `
            <div style="padding:30px; text-align:center; opacity:0.6; border:1px dashed var(--border); border-radius:12px;">
                <p>No hay tareas pendientes para este día.</p>
            </div>`;
    } else {
        html += `<div class="tareas-grid-propia">
                    ${tareas.map(t => buildTareaHTML(t)).join('')}
                 </div>`;
    }

    contenedor.innerHTML = html;
    
    // Opcional: Hacer scroll suave hacia la lista para ver los resultados
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.toggleTarea = async function (id, done) {
  const { doc, updateDoc } = lib();
  await updateDoc(doc(db(), 'ec_tareas', id), { done });
};

window.eliminarTarea = async function (id) {
    const { doc, getDoc, deleteDoc } = lib();
    try {
        const snap = await getDoc(doc(db(), 'ec_tareas', id));
        if (!snap.exists()) return;
        const data = snap.data();

        // LÓGICA DE PERMISOS: Admin O Creador de la tarea
        const esCreador = data.authorUid === currentUser.uid;

        if (!isAdmin && !esCreador) {
            alert("Acceso denegado: Solo el administrador o quien creó la tarea pueden eliminarla.");
            return;
        }

        if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
        
        await deleteDoc(doc(db(), 'ec_tareas', id));
        
        // Si hay un detalle abierto, refrescar
        if (calDiaSeleccionado) calVerDia(calDiaSeleccionado.dia, calDiaSeleccionado.mes, calDiaSeleccionado.año);
        
    } catch (e) { 
        alert("Error: " + e.message); 
    }
};

// 1. Botones de Filtro (Todas, Pendientes, Completadas)
qsa('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tareasFilter = btn.dataset.filter;
    tareasVistaCalendario = false;
    
    // --- MAGIA: Limpiar memoria del calendario al salir ---
    calMesOffset = 0; 
    calDiaSeleccionado = null; 
    
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('btnCalendarioTareas')?.classList.remove('active');
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
    initTareas();
  });
});

// 2. Botón para abrir/cerrar el Calendario
$('btnCalendarioTareas')?.addEventListener('click', () => {
  tareasVistaCalendario = !tareasVistaCalendario;
  $('btnCalendarioTareas').classList.toggle('active', tareasVistaCalendario);
  
  if (tareasVistaCalendario) {
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    $('tareasList').innerHTML = '<div class="feed-loading">Cargando calendario…</div>';
    
    calMesOffset = 0; // Asegurar que abra en el mes actual
    // --- MAGIA: Pre-seleccionar HOY automáticamente al entrar ---
    const hoy = new Date();
    calDiaSeleccionado = { dia: hoy.getDate(), mes: hoy.getMonth(), año: hoy.getFullYear() };
    
  } else {
    qsa('.filter-btn')[0]?.classList.add('active');
    
    // --- MAGIA: Limpiar memoria al cerrar el calendario ---
    calMesOffset = 0; 
    calDiaSeleccionado = null; 
  }
  
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  initTareas();
});

// 1. Abrir el modal de nueva tarea y limpiar la lista de temas si había algo escrito antes
$('btnNuevaTarea').addEventListener('click', () => {
  const lista = $('subtareasList');
  if (lista) lista.innerHTML = ''; 
  openModal('modalNuevaTarea');
});

// 2. Darle función al botón de "+ Agregar tema"
$('btnAddSubtarea')?.addEventListener('click', () => {
  const list = $('subtareasList');
  if (!list) return;
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '6px';
  div.innerHTML = `
      <input type="text" class="modal-input sub-texto" placeholder="Ej: Tema" style="flex:2; margin:0; padding:6px 10px; font-size:12px;">
      <input type="text" class="modal-input sub-resp" placeholder="¿Quién?" style="flex:1; margin:0; padding:6px 10px; font-size:12px;">
      <button type="button" onclick="this.parentElement.remove()" style="background:var(--bg4); color:var(--red); border:none; border-radius:6px; padding:0 8px; font-size:12px; cursor:pointer;">✕</button>
  `;
  list.appendChild(div);
});

// 3. Confirmar y guardar la tarea (AQUÍ ESTÁ TU CÓDIGO ANTERIOR INTEGRADO CON LOS SUB-TEMAS)
$('btnConfirmarTarea').addEventListener('click', async () => {
  const titulo = $('tareaTitulo').value.trim();
  if (!titulo) { alert('Escribe el título de la tarea.'); return; }
  
  // --- NUEVO: Recolectar las sub-tareas ---
  const subtareas = [];
  qsa('#subtareasList > div').forEach(div => {
      const texto = div.querySelector('.sub-texto').value.trim();
      const resp = div.querySelector('.sub-resp').value.trim();
      if (texto) {
          subtareas.push({ texto: texto, responsable: resp, done: false });
      }
  });

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
      subtareas: subtareas, // <-- Guardamos la lista dinámica en Firebase
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      createdAt: serverTimestamp()
    };
    
    // Guardar en la colección de tareas
    await addDoc(collection(db(), 'ec_tareas'), tarea);
    
    // Publicar en el Feed
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      text: `📋 Nueva tarea: "${titulo}"${tarea.responsable ? ` · Responsable: ${tarea.responsable}` : ''}${tarea.fecha ? ` · Fecha: ${new Date(tarea.fecha).toLocaleDateString('es-MX')}` : ''}`,
      type: 'tarea', images: [],
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      likes: 0, likedBy: [], commentCount: 0,
      createdAt: serverTimestamp()
    });
    
    closeModal('modalNuevaTarea');
    
    // Limpiamos los campos después de guardar
    ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaMateria'].forEach(id => $(id).value = '');
    $('subtareasList').innerHTML = ''; 
    
  } catch (e) { alert('Error: ' + e.message); }
});

/* ═══════════════════════════════════════════════════
   APUNTES
═══════════════════════════════════════════════════ */


$('apuntesSearch')?.addEventListener('input', e => {
  apuntesSearchTerm = e.target.value.trim().toLowerCase();
  renderSemestres();
});

function initApuntes() {
  const toolbar = document.querySelector('.apuntes-toolbar');
  if (toolbar) toolbar.style.display = isAdmin ? 'flex' : 'none';

  // Agregar botón de Ordenar Semestres al lado del buscador
  const searchWrap = document.querySelector('.apuntes-search-wrap');
  if (searchWrap && !$('btnOrdenarSemestres')) {
    searchWrap.style.display = 'flex';
    searchWrap.style.gap = '10px';
    searchWrap.style.alignItems = 'center';

    const searchInput = $('apuntesSearch');
    if (searchInput) searchInput.style.flex = '1';

    const btnSortSem = document.createElement('button');
    btnSortSem.id = 'btnOrdenarSemestres';
    btnSortSem.className = 'btn-sm';
    btnSortSem.innerHTML = `↕️ Sem: ${ordenSemestres === 'alfabetico' ? 'A-Z' : 'Fecha'}`;
    btnSortSem.onclick = () => {
      ordenSemestres = (ordenSemestres === 'creacion') ? 'alfabetico' : 'creacion';
      localStorage.setItem('ze_orden_semestres', ordenSemestres);
      btnSortSem.innerHTML = `↕️ Sem: ${ordenSemestres === 'alfabetico' ? 'A-Z' : 'Fecha'}`;
      renderSemestres();
    };
    searchWrap.appendChild(btnSortSem);
  }

  loadSemestres();
  setupApunteUpload();
}

window.toggleOrdenMaterias = function (e) {
  e.stopPropagation();
  ordenMaterias = (ordenMaterias === 'creacion') ? 'alfabetico' : 'creacion';
  localStorage.setItem('ze_orden_materias', ordenMaterias);
  renderSemestres();
};

function loadSemestres() {
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }

  const { collection, query, where, onSnapshot } = lib();
  // Traemos todos, el ordenamiento lo haremos en memoria (renderSemestres)
  const q = query(collection(db(), 'ec_semestres'), where('groupId', '==', currentGroupId));

  semestresUnsub = onSnapshot(q, snap => {
    semestres = [];
    snap.forEach(d => semestres.push({ id: d.id, ...d.data() }));
    loadGalerias();
  });
}

function loadGalerias() {
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_galerias'), where('groupId', '==', currentGroupId));

  galeriasUnsub = onSnapshot(q, snap => {
    galerias = [];
    snap.forEach(d => galerias.push({ id: d.id, ...d.data() }));
    renderSemestres();
  });
}

const SEM_PASTEL_PALETTE = [
  { label: 'Lila', c1: '#c4b5fd', c2: '#a78bfa', text: '#4c1d95' },
  { label: 'Rosa', c1: '#fda4af', c2: '#fb7185', text: '#881337' },
  { label: 'Menta', c1: '#6ee7b7', c2: '#34d399', text: '#064e3b' },
  { label: 'Amarillo', c1: '#fde68a', c2: '#fcd34d', text: '#78350f' },
  { label: 'Cielo', c1: '#bae6fd', c2: '#7dd3fc', text: '#0c4a6e' },
  { label: 'Durazno', c1: '#fed7aa', c2: '#fdba74', text: '#7c2d12' }
];

function renderSemestres() {
  const container = $('apuntesGroupsContainer');
  if (!container) return;
  const term = apuntesSearchTerm;

  // 1. Ordenar semestres en memoria según selección
  let semestresOrdenados = [...semestres];
  if (ordenSemestres === 'alfabetico') {
    semestresOrdenados.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Por fecha de creación
    semestresOrdenados.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });
  }

  // 2. Filtrar por búsqueda
  let semestresMostrar = semestresOrdenados.map(sem => {
    let mats = galerias.filter(g => g.semestreId === sem.id);
    if (term) {
      const matchSem = sem.name.toLowerCase().includes(term);
      const matsFiltradas = mats.filter(m => m.name.toLowerCase().includes(term));
      if (!matchSem && matsFiltradas.length === 0) return null;
      if (!matchSem) mats = matsFiltradas;
    }
    return { ...sem, mats };
  }).filter(Boolean);

  if (!semestresMostrar.length) {
    container.innerHTML = `<div class="sem-empty"><p>${term ? 'Sin resultados' : 'Sin semestres aún'}</p></div>`;
    return;
  }

  // CORRECCIÓN CRUCIAL: Solo forzamos el display: grid si NO estamos en la vista de galería.
  // Esto evita el bug donde la pantalla se parte en dos al poner una portada.
  if (!galeriaActual) {
    container.style.display = 'grid';
  }

  container.innerHTML = semestresMostrar.map((semData) => {
    const { mats, ...sem } = semData;
    const isSavedOpen = semestresAbiertos.has(sem.id);
    const isOpenClass = (term || isSavedOpen) ? 'open' : '';
    const rotateStyle = (term || isSavedOpen) ? 'style="transform:rotate(90deg)"' : '';
    const primeraCover = sem.coverImage || mats.find(m => m.coverImage)?.coverImage || '';

    // --- NUEVO: Lógica para ordenar las materias ---
    let matsOrdenadas = [...mats];
    if (ordenMaterias === 'alfabetico') {
      matsOrdenadas.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Ordenar por fecha de creación (de más antiguo a más nuevo)
      matsOrdenadas.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
    }

    // Usamos matsOrdenadas en lugar de mats
    const materiasHtml = matsOrdenadas.map(m => {
      const tag = (m.name || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
      return `
        <div class="album-card-wrap">
          <article class="album-card" onclick="abrirGaleria('${m.id}')">
            <div class="album-cover">
              ${m.coverImage ? `<img src="${escHtml(m.coverImage)}" alt="">` : ''}
              <span class="album-icon">${escHtml(m.icon || '📚')}</span>
            </div>
            <div class="album-info">
              <h3 class="album-name">${escHtml(m.name)}</h3>
              <p class="album-count">${m.fotosCount || 0} fotos</p>
              <p class="album-tag">#${tag}</p>
            </div>
            <div class="album-actions" onclick="event.stopPropagation()">
              <button class="album-action-btn primary" onclick="abrirGaleria('${m.id}')">Abrir</button>
              <button class="album-action-btn" onclick="abrirNotas('${m.id}')">Notas</button>
            </div>
          </article>
          ${isAdmin ? `<button class="materia-delete" onclick="event.stopPropagation(); eliminarMateria('${m.id}','${escHtml(m.name)}')">🗑️</button>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="group-accordion ${isOpenClass}" id="sem-${sem.id}">
        <div class="group-header" onclick="toggleSemestre('${sem.id}')">
          <div class="group-card-top">
            ${primeraCover ? `<div class="group-header-bg" style="background-image:url('${primeraCover}')"></div>` : ''}
            <span class="group-icon">${escHtml(sem.icon || '📅')}</span>
          </div>
          <div class="group-card-info">
            <span class="group-name">${escHtml(sem.name)}</span>
            <span class="group-count">${mats.length} materias</span>
          </div>
          <div class="group-mini-actions" onclick="event.stopPropagation()">
            <button class="group-mini-btn btn-abrir-semestre" onclick="toggleSemestre('${sem.id}')">Abrir</button>
            <button class="group-mini-btn primary btn-notas-semestre" onclick="abrirNotasSemestre('${sem.id}')">Notas</button>
            <button class="group-mini-btn btn-ordenar-materias" onclick="toggleOrdenMaterias(event)" title="Ordenar materias" style="flex: 0 0 auto; padding: 8px 14px;">
              ${ordenMaterias === 'alfabetico' ? '↕️ A-Z' : '📅 Fecha'}
            </button>
          </div>
          <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${rotateStyle}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
          ${isAdmin ? `<button class="group-delete" onclick="event.stopPropagation(); eliminarSemestre('${sem.id}','${escHtml(sem.name)}')">🗑️</button>` : ''}
        </div>
        <div class="group-body">
          <div class="carousel-wrap">
            <div class="albums-carousel">${mats.length ? materiasHtml : '<p style="font-size:12px;opacity:0.6;padding:10px;">Sin materias</p>'}</div>
          </div>
          ${isAdmin ? `<button class="btn-add-to-group" onclick="openNewMateriaModal('${sem.id}')">➕ Agregar materia</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

window.toggleSemestre = function (id) {
  const grup = $('sem-' + id);
  if (!grup) return;
  const isNowOpen = grup.classList.toggle('open');
  const tog = grup.querySelector('.group-chevron');
  if (tog) tog.style.transform = isNowOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  isNowOpen ? semestresAbiertos.add(id) : semestresAbiertos.delete(id);

  if (isNowOpen) {
    setTimeout(() => {
      const yOffset = -70;
      const y = grup.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 50);
  }
};

window.abrirNotasSemestre = function (semestreId) {
  const sem = semestres.find(s => s.id === semestreId);
  if (!sem) return;
  $('notasGaleriaTitulo').textContent = `${sem.icon || '📅'} Notas de ${sem.name}`;
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = `sem_${semestreId}`;
  openModal('modalNotasGaleria');
  cargarNotas(`sem_${semestreId}`);
};

// ── NAVEGACIÓN ENTRE SEMESTRES Y GALERÍA DE FOTOS ──
window.abrirGaleria = function (galeriaId) {
  galeriaActual = galerias.find(g => g.id === galeriaId);
  if (!galeriaActual) return;

  // Guardamos scroll antes de ocultar
  scrollPosicionApuntes = window.scrollY || document.documentElement.scrollTop;

  $('galeriaTitle').textContent = `${galeriaActual.icon || '📚'} ${galeriaActual.name}`;
  $('apuntesGroupsContainer').style.display = 'none';
  $('apuntesGaleriaView').style.display = 'block';
  $('apuntesUploadZone').style.display = 'none';

  $('btnUploadApunte').style.display = 'inline-flex';

  cargarFotosGaleria();
  window.scrollTo(0, 0); // Te manda arriba DENTRO de la galería
};

$('btnApuntesBack')?.addEventListener('click', () => {
  galeriaActual = null;
  $('apuntesGroupsContainer').style.display = 'grid';
  $('apuntesGaleriaView').style.display = 'none';

  renderSemestres(); // Redibujamos las tarjetas

  // Damos 50ms para que el navegador acomode las cajas antes de hacer scroll
  setTimeout(() => {
    window.scrollTo({
      top: scrollPosicionApuntes,
      left: 0,
      behavior: 'instant'
    });
  }, 50);
});

function cargarFotosGaleria() {
  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_fotos'),
    where('galeriaId', '==', galeriaActual.id)
  );
  const grid = $('apuntesGrid');
  grid.innerHTML = '<div class="feed-loading">Cargando fotos…</div>';
  muroFeedUnsub = onSnapshot(q, snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    // Ordenar descendente
    fotos.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    renderFotosGaleria(fotos);
  }, err => {
    grid.innerHTML = '<div class="feed-loading">Error al cargar fotos.</div>';
  });
}

function renderFotosGaleria(fotos) {
  lightboxPhotos = fotos;
  const grid = $('apuntesGrid');
  if (!fotos.length) {
    grid.innerHTML = '<div class="feed-loading">Sin fotos aún. ¡Sube tus apuntes!</div>';
    return;
  }

  grid.innerHTML = fotos.map((f, i) => {
    const esAutor = currentUser && f.authorUid === currentUser.uid;
    const puedeActuar = esAutor || isAdmin;

    // --- EL BOTÓN DEL COHETE QUE NECESITAS ---
    const btnCompartirTablero = `<button class="foto-publish-btn" style="left: 75px; background: var(--accent);" title="Compartir en cualquier Tablero" 
        onclick="event.stopPropagation(); compartirNotaAlTablero('${f.id}', '${escHtml(f.url)}')">🚀</button>`;

    // Busca esta línea dentro de renderFotosGaleria en app.js y reemplázala:
    const btnPublicar = puedeActuar
      ? `<button class="foto-publish-btn ${f.publishedToFeed ? 'published' : ''}" 
       style="right: 40px; top: 10px;" 
       title="${f.publishedToFeed ? 'Ya publicada en Novedades' : 'Publicar en Novedades'}"
       onclick="event.stopPropagation(); publicarFotoEnFeed('${escHtml(f.id)}')">
       ${f.publishedToFeed ? '✅' : '📢'}
     </button>`
      : (f.publishedToFeed ? `<span class="foto-published-badge" title="Publicada en Novedades">✅</span>` : '');

    const btnEliminar = puedeActuar
      ? `<button class="foto-del-btn" title="Eliminar foto" onclick="event.stopPropagation(); eliminarFotoApunte('${escHtml(f.id)}')">🗑️</button>`
      : '';

    const btnPortada = puedeActuar
      ? `<button class="foto-del-btn" style="left: 40px; background: rgba(0,0,0,0.55);" title="Usar como portada de materia" onclick="event.stopPropagation(); establecerPortadaMateria('${escHtml(f.url)}')">⭐</button>`
      : '';

    const autorLabel = f.authorName ? `<span class="foto-autor-label">📷 ${escHtml(f.authorName)}</span>` : '';
    const likeCount = f.likes || 0;
    const isLiked = f.likedBy?.includes(currentUser.uid);

    return `<div class="photo-thumb" data-foto-id="${escHtml(f.id)}">
      <img src="${escHtml(f.url)}" loading="lazy" alt="" onclick="openLightbox(${i})">
      <div class="photo-thumb-overlay" onclick="openLightbox(${i})">${autorLabel}</div>
      <div class="photo-actions-bar">
        <button class="photo-action-btn feed-action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleFotoLike('${f.id}', this)">
          <span class="foco-icon" style="font-size: 16px;">💡</span> (<span class="like-count">${likeCount}</span>)
        </button>
        <button class="photo-action-btn" onclick="event.stopPropagation(); abrirNotasDeFoto('${f.url}', '${escHtml(f.caption || '')}')">
          💬 Notas
        </button>
      </div>
      ${btnPublicar} ${btnEliminar} ${btnPortada} ${btnCompartirTablero} 
    </div>`;
  }).join('');
}
// Guardar portada sin salirte de la materia
// Guardar portada sin salirte de la materia
window.establecerPortadaMateria = async function (url) {
  if (!galeriaActual) return;
  const { doc, updateDoc } = lib();
  try {
    await updateDoc(doc(db(), 'ec_galerias', galeriaActual.id), { coverImage: url });
    galeriaActual.coverImage = url;
    const index = galerias.findIndex(g => g.id === galeriaActual.id);
    if (index !== -1) galerias[index].coverImage = url;

    // Solo un pequeño aviso visual sutil
    const toast = document.createElement('div');
    toast.textContent = '✅ Portada de la materia actualizada';
    toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--accent); color:white; padding:10px 20px; border-radius:20px; font-size:13px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.2); animation: fadeInOut 3s forwards; pointer-events:none;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (e) {
    alert('Error al actualizar portada: ' + e.message);
  }
};

$('btnUploadApunte').addEventListener('click', () => {
  const zone = $('apuntesUploadZone');
  zone.style.display = zone.style.display === 'none' ? 'block' : 'none';
});

window.toggleFotoLike = async function (fotoId, btnEl) {
  if (!currentUser) return;
  const isLiked = btnEl.classList.contains('liked');
  btnEl.classList.toggle('liked');
  
  const span = btnEl.querySelector('span:last-child'); // El span que tiene el número
  let currentLikes = parseInt(span.textContent) || 0;
  
  span.textContent = isLiked ? (currentLikes - 1) : (currentLikes + 1);

  const { doc, updateDoc, arrayUnion, arrayRemove, increment } = lib();
  try {
    await updateDoc(doc(db(), 'ec_fotos', fotoId), {
      likedBy: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likes: increment(isLiked ? -1 : 1)
    });
  } catch (e) { console.error('Error al dar like:', e); }
}

window.abrirNotasDeFoto = function (fotoUrl, caption) {
  const fotoUnicaId = btoa(fotoUrl).replace(/\//g, '_');
  $('notasGaleriaTitulo').textContent = caption ? `Notas: ${caption}` : 'Notas de esta foto';
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = `foto_${fotoUnicaId}`;
  openModal('modalNotasGaleria');
  cargarNotas(`foto_${fotoUnicaId}`);
};

function setupApunteUpload() {
  const onChange = e => {
    const nuevos = [...e.target.files].filter(f => f.type.startsWith('image/'));
    apunteFiles = [...apunteFiles, ...nuevos];
    renderApuntePreview();
    $('btnApunteSend').disabled = !apunteFiles.length;
  };
  $('apunteFileInput').addEventListener('change', onChange);
  $('apunteCameraInput').addEventListener('change', onChange);

  const dropArea = $('apuntesDropArea');
  if (dropArea) {
    dropArea.addEventListener('dragover', e => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--accent)';
      dropArea.style.background = 'rgba(124, 106, 247, 0.05)';
    });
    dropArea.addEventListener('dragleave', e => {
      e.preventDefault();
      dropArea.style.borderColor = '';
      dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', e => {
      e.preventDefault();
      dropArea.style.borderColor = '';
      dropArea.style.background = '';
      if (e.dataTransfer.files.length) {
        const nuevos = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
        apunteFiles = [...apunteFiles, ...nuevos];
        renderApuntePreview();
        $('btnApunteSend').disabled = !apunteFiles.length;
      }
    });
  }

  const btnSend = $('btnApunteSend');
  const newBtnSend = btnSend.cloneNode(true);
  btnSend.parentNode.replaceChild(newBtnSend, btnSend);

  newBtnSend.addEventListener('click', async () => {
    if (!apunteFiles.length || !galeriaActual) return;
    const caption = $('apunteCaption').value.trim();
    newBtnSend.disabled = true;
    $('apunteProgress').style.display = 'block';
    const { collection, addDoc, serverTimestamp } = lib();
    let done = 0;
    try {
      for (const file of apunteFiles) {
        const url = await uploadToCloudinary(file, galeriaActual.cloudinaryTag);
        if (url) {
          await addDoc(collection(db(), 'ec_fotos'), {
            galeriaId: galeriaActual.id,
            groupId: currentGroupId,
            url, caption,
            authorUid: currentUser.uid,
            authorName: currentUser.name,
            publishedToFeed: false,
            createdAt: serverTimestamp()
          });
        }
        done++;
        $('apunteProgressBar').style.width = `${Math.round(done / apunteFiles.length * 100)}%`;
      }
      apunteFiles = [];
      $('apuntePreviewList').innerHTML = '';
      $('apunteCaption').value = '';
    } catch (e) {
      alert('Error al subir apunte: ' + e.message);
      newBtnSend.disabled = false;
    } finally {
      setTimeout(() => {
        $('apunteProgress').style.display = 'none';
        $('apunteProgressBar').style.width = '0%';
      }, 800);
    }
  });
}

function renderApuntePreview() {
  const container = $('apuntePreviewList');
  container.innerHTML = apunteFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="upload-preview-item" style="position:relative; width:85px; height:85px; border-radius:8px; overflow:hidden; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
        <img src="${url}" alt="" onclick="openLightboxPrevia(${i})" style="width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in;">
        <button onclick="removerFotoPrevia(${i})" style="position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:50%; background:rgba(0,0,0,0.6); color:white; border:none; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center;">✕</button>
      </div>`;
  }).join('');
}

window.removerFotoPrevia = function (idx) {
  apunteFiles.splice(idx, 1);
  renderApuntePreview();
  $('btnApunteSend').disabled = !apunteFiles.length;
};

window.openLightboxPrevia = function (idx) {
  lightboxPhotos = apunteFiles.map(f => ({
    url: URL.createObjectURL(f),
    caption: f.name
  }));
  lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('open');
  $('lightboxPrev').style.display = '';
  $('lightboxNext').style.display = '';
};

/* ── MODALES APUNTES ── */
let selectedSemestreEmoji = '📅';
let selectedSemestreColor = SEM_PASTEL_PALETTE[0].c1;
let selectedMateriaEmoji = '📚';

$('btnNewSubjectGroup').addEventListener('click', () => {
  if (!isAdmin) { alert('Solo el administrador puede crear semestres.'); return; }
  renderEmojiPicker('semestreEmojiPicker', EMOJIS_SEMESTRE, '📅', em => selectedSemestreEmoji = em);
  selectedSemestreEmoji = '📅';
  selectedSemestreColor = SEM_PASTEL_PALETTE[0].c1;
  renderColorPicker('semestreColorPicker', c => selectedSemestreColor = c);
  const prev = $('semestreColorPreview');
  if (prev) prev.style.background = `linear-gradient(135deg,${SEM_PASTEL_PALETTE[0].c1},${SEM_PASTEL_PALETTE[0].c2})`;
  openModal('modalNuevoSemestre');
});

let _creandoSemestre = false;
$('btnConfirmarSemestre').addEventListener('click', async () => {
  if (_creandoSemestre) return;
  const nombre = $('semestreNombre').value.trim();
  if (!nombre) { alert('Escribe el nombre.'); return; }
  if (!currentGroupId) { alert('Selecciona un grupo primero.'); return; }
  _creandoSemestre = true;
  const btn = $('btnConfirmarSemestre');
  btn.disabled = true; btn.textContent = '⏳ Guardando…';
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_semestres'), {
      name: nombre, icon: selectedSemestreEmoji, color: selectedSemestreColor,
      groupId: currentGroupId, createdAt: serverTimestamp()
    });
    closeModal('modalNuevoSemestre');
    $('semestreNombre').value = '';
  } catch (e) { alert('Error al crear semestre: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Crear';
  _creandoSemestre = false;
});

$('btnNewMateria').addEventListener('click', () => {
  if (!isAdmin) { alert('Solo el administrador puede crear materias.'); return; }
  openNewMateriaModal('');
});
window.openNewMateriaModal = function (semestreId) {
  if (!isAdmin) { alert('Solo el administrador puede crear materias.'); return; }
  renderEmojiPicker('materiaEmojiPicker', EMOJIS_MATERIA, '📚', em => selectedMateriaEmoji = em);
  selectedMateriaEmoji = '📚';
  const defaultId = semestreId || (semestres[0]?.id || '');
  $('materiaSemestreSelect').innerHTML =
    semestres.map(s => `<option value="${s.id}" ${s.id === defaultId ? 'selected' : ''}>
      ${escHtml(s.icon || '📅')} ${escHtml(s.name)}
    </option>`).join('') || '<option value="" disabled>— No hay semestres —</option>';
  openModal('modalNuevaMateria');
};

let _creandoMateria = false;
$('btnConfirmarMateria').addEventListener('click', async () => {
  if (_creandoMateria) return;
  const nombre = $('materiaNombre').value.trim();
  if (!nombre) { alert('Escribe el nombre de la materia.'); return; }
  if (!currentGroupId) { alert('Selecciona un grupo primero.'); return; }
  if (!$('materiaSemestreSelect').value) { alert('⚠️ Debes seleccionar un semestre para la materia.'); return; }
  _creandoMateria = true;
  const btn = $('btnConfirmarMateria');
  btn.disabled = true; btn.textContent = '⏳';
  const tag = nombre.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_galerias'), {
      name: nombre, icon: selectedMateriaEmoji,
      semestreId: $('materiaSemestreSelect').value || '',
      cloudinaryTag: `ec_${tag}_${currentGroupId.slice(-6)}`,
      groupId: currentGroupId, coverImage: '',
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevaMateria');
    $('materiaNombre').value = '';
  } catch (e) { alert('Error al crear materia: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Crear';
  _creandoMateria = false;
});

/* ── Eliminar foto de apuntes (solo autor o admin) ── */
window.eliminarFotoApunte = async function (fotoId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  const { doc, deleteDoc } = lib();
  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-del-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await deleteDoc(doc(db(), 'ec_fotos', fotoId));
  } catch (e) {
    alert('Error al eliminar: ' + e.message);
    if (btn) { btn.textContent = '🗑️'; btn.disabled = false; }
  }
};

window.publicarFotoEnFeed = async function (fotoId) {
  const foto = (lightboxPhotos || []).find(f => f.id === fotoId);
  if (!foto || !galeriaActual) return;

  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-publish-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  const {
    collection, query, where, getDocs, addDoc,
    doc, updateDoc, arrayUnion, serverTimestamp
  } = lib();

  try {
    // Buscar si ya existe un post de esta galería en el feed (sin límite de fecha)
    const feedQ = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('galeriaId', '==', galeriaActual.id),
      where('type', '==', 'apunte')
    );
    const feedSnap = await getDocs(feedQ);

    if (!feedSnap.empty) {
      // Ya existe — agregar la foto si no estaba y subirlo al inicio actualizando createdAt
      const feedDoc = feedSnap.docs[0];
      await updateDoc(doc(db(), 'ec_feed', feedDoc.id), {
        images: arrayUnion(foto.url),
        createdAt: serverTimestamp()
      });
    } else {
      // No existe — crear nueva publicación
      const gal = galeriaActual;
      const sem = semestres.find(s => s.id === gal.semestreId);
      const semNombre = sem ? sem.name : '';
      await addDoc(collection(db(), 'ec_feed'), {
        groupId: currentGroupId,
        galeriaId: gal.id,
        type: 'apunte',
        text: `📸 Apuntes de ${gal.icon || '📚'} ${gal.name}${semNombre ? ` · ${semNombre}` : ''}`,
        images: [foto.url],
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        likes: 0, likedBy: [], commentCount: 0,
        createdAt: serverTimestamp()
      });
    }

    await updateDoc(doc(db(), 'ec_fotos', fotoId), { publishedToFeed: true });
    if (btn) { btn.textContent = '✅'; btn.classList.add('published'); btn.disabled = false; btn.title = 'Ya publicada en Novedades'; }

  } catch (e) {
    if (btn) { btn.textContent = '📢'; btn.disabled = false; }
    alert('Error al publicar: ' + e.message);
  }
};
document.addEventListener('click', async e => {
  if (!e.target.matches('#btnGuardarNotas')) return;
  const galeriaId = $('modalNotasGaleria').dataset.galeriaId;
  if (!galeriaId) return;
  const texto = $('notasGaleriaTexto').value.trim();
  if (!texto) return;
  const btn = $('btnGuardarNotas');
  btn.disabled = true; btn.textContent = '⏳';
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_notas'), {
      galeriaId,
      groupId: currentGroupId,
      texto,
      autorUid: currentUser.uid,
      autorNombre: getUserAlias(),
      autorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });
    $('notasGaleriaTexto').value = '';
  } catch (e2) { alert('Error al guardar: ' + e2.message); }
  btn.disabled = false; btn.textContent = '💾 Publicar nota';
});

/* ═══════════════════════════════════════════════════
   CLOUDINARY UPLOAD
═══════════════════════════════════════════════════ */
// REEMPLAZAR: uploadToCloudinary
async function uploadToCloudinary(file, tag = '') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);

  if (tag) {
    fd.append('tags', tag);
    // NUEVO: Organizar en carpetas dentro de Cloudinary
    fd.append('folder', `ZonaEscolar/${tag}`);
    fd.append('asset_folder', `ZonaEscolar/${tag}`);
  }

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST', body: fd
    });
    const data = await res.json();
    if (data.error) {
      console.error('Error exacto de Cloudinary:', data.error.message);
      return null;
    }
    return data.secure_url || null;
  } catch (e) {
    console.error('Fallo de conexión con Cloudinary:', e);
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

qsa('.btn-dinamica[data-open]').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.open));
});

/* ─────────────── RULETA ─────────────── */
function initRuleta() {
  if (currentGroupData?.miembros) {
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
  const extra = Math.floor(Math.random() * 3 + 5) * 360 + Math.floor(Math.random() * 360);
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
    ctx.fill(); ctx.stroke();
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
  inp.type = 'text'; inp.className = 'modal-input opcion-input'; inp.placeholder = `Opción ${n}`;
  wrap.appendChild(inp);
});

$('btnLanzarVotacion').addEventListener('click', async () => {
  const pregunta = $('votacionPregunta').value.trim();
  const opciones = [...qsa('.opcion-input')].map(i => i.value.trim()).filter(Boolean);
  if (!pregunta || opciones.length < 2) { alert('Agrega una pregunta y al menos 2 opciones.'); return; }
  const btn = $('btnLanzarVotacion');
  btn.disabled = true; btn.textContent = '⏳';
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const ref = await addDoc(collection(db(), 'ec_votaciones'), {
      groupId: currentGroupId, pregunta, opciones, votos: {}, votantes: [], userVotes: {},
      activa: true, createdAt: serverTimestamp()
    });
    // Publicar en el feed para que todos lo vean
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      type: 'votacion',
      votacionId: ref.id,
      pregunta,
      opciones,
      votos: {},        // <-- ESTO ES LO NUEVO
      votantes: [],     // <-- ESTO ES LO NUEVO
      userVotes: {},
      activa: true,     // <-- ESTO ES LO NUEVO
      text: `🗳️ Votación: "${pregunta}"`,
      images: [],
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      likes: 0, likedBy: [], commentCount: 0,
      createdAt: serverTimestamp()
    });
    $('votacionPregunta').value = '';
    qsa('.opcion-input').forEach(i => i.value = '');
    closeModal('modalVotacion');
    // Ir al feed para verla
    currentSection = 'feed';
    setActiveNav('feed');
    activarSeccion('feed');
  } catch (e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Lanzar votación';
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
      renderVotacionActiva({ id: snap.docs[0].id, ...snap.docs[0].data() });
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
  const votoActual = Number(v?.userVotes?.[currentUser.uid]);
  const totalVotos = Object.values(v.votos || {}).reduce((a, b) => a + b, 0);

  // Siempre mostrar los botones de opciones (para votar o cambiar voto)
  $('votacionOpciones').innerHTML = v.opciones.map((op, i) => {
    const esMiVoto = yaVoto && Number.isInteger(votoActual) && votoActual === i;
    const claseExtra = esMiVoto ? ' votacion-opcion-seleccionada' : '';
    const icono = esMiVoto ? ' ✔' : '';
    return `<button class="votacion-opcion-btn${claseExtra}" onclick="votar('${v.id}',${i})">${escHtml(op)}${icono}</button>`;
  }).join('');

  // Texto de ayuda según estado
  const ayudaEl = $('votacionAyuda');
  if (ayudaEl) {
    ayudaEl.textContent = yaVoto ? '✔ Ya votaste — puedes cambiar tu voto tocando otra opción.' : 'Selecciona una opción para votar.';
  }

  $('votacionResultados').innerHTML = v.opciones.map((op, i) => {
    const cnt = v.votos?.[i] || 0;
    const pct = totalVotos ? Math.round(cnt / totalVotos * 100) : 0;
    const esMiVoto = yaVoto && Number.isInteger(votoActual) && votoActual === i;
    return `<div class="votacion-resultado-item${esMiVoto ? ' mi-voto' : ''}">
      <span class="votacion-bar-label">${escHtml(op)}${esMiVoto ? ' <span style=\'font-size:11px;opacity:0.8\'>(tu voto)</span>' : ''}</span>
      <div class="votacion-bar-wrap"><div class="votacion-bar" style="width:${pct}%"></div></div>
      <span class="votacion-bar-count">${cnt} (${pct}%)</span>
    </div>`;
  }).join('');
}

window.votar = async function (votacionId, opcionIdx) {
  const { doc, getDoc, updateDoc, arrayUnion, increment, collection, query, where, getDocs } = lib();
  try {
    const vSnap = await getDoc(doc(db(), 'ec_votaciones', votacionId));
    if (!vSnap.exists()) return;
    const vData = vSnap.data();
    if (!vData.activa) { alert('Esta votación ya cerró.'); return; }

    const votoAnterior = Number(vData?.userVotes?.[currentUser.uid]);
    if (Number.isInteger(votoAnterior) && votoAnterior === opcionIdx) return;
    const patch = { votantes: arrayUnion(currentUser.uid), [`userVotes.${currentUser.uid}`]: opcionIdx };
    if (Number.isInteger(votoAnterior)) patch[`votos.${votoAnterior}`] = increment(-1);
    patch[`votos.${opcionIdx}`] = increment(1);
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), patch);
    const feedSnap = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', votacionId)));
    if (!feedSnap.empty) await updateDoc(doc(db(), 'ec_feed', feedSnap.docs[0].id), patch);
  } catch (e) { alert('Error al votar: ' + e.message); }
};

// Votar desde el card del feed (sin abrir modal)
window.votarDesdeFeed = async function (votacionId, opcionIdx, feedPostId) {
  const { doc, getDoc, updateDoc, increment, arrayUnion } = lib();
  try {
    const snap = await getDoc(doc(db(), 'ec_votaciones', votacionId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.activa) { alert('Esta votación ya cerró.'); return; }

    const votoAnterior = Number(data?.userVotes?.[currentUser.uid]);
    if (Number.isInteger(votoAnterior) && votoAnterior === opcionIdx) return;
    const patch = {
      [`votos.${opcionIdx}`]: increment(1),
      votantes: arrayUnion(currentUser.uid),
      [`userVotes.${currentUser.uid}`]: opcionIdx
    };
    if (Number.isInteger(votoAnterior)) patch[`votos.${votoAnterior}`] = increment(-1);
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), patch);
    if (feedPostId) await updateDoc(doc(db(), 'ec_feed', feedPostId), patch);
  } catch (e) { alert('Error: ' + e.message); }
};

window.irADinamicas = function () {
  currentSection = 'dinamicas';
  setActiveNav('dinamicas');
  activarSeccion('dinamicas');
  closeSidebar();
};

$('btnCerrarVotacion').addEventListener('click', async () => {
  if (!confirm('¿Cerrar esta votación?')) return;
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
    const votacionId = snap.docs[0].id;
    // Cerrar en Dinámicas
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), { activa: false });
    // Cerrar en el Feed al instante
    const feedSnap = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', votacionId)));
    if (!feedSnap.empty) {
      await updateDoc(doc(db(), 'ec_feed', feedSnap.docs[0].id), { activa: false });
    }
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
window.triviaEliminar = function (i) { triviaBanco.splice(i, 1); renderTriviaBanco(); };

$('btnAgregarPregunta').addEventListener('click', () => {
  const pregunta = $('triviaPreguntaInput').value.trim();
  const resps = qsa('.trivia-resp-input').map(i => i.value.trim()).filter(Boolean);
  if (!pregunta || resps.length < 2) { alert('Agrega la pregunta y al menos la respuesta correcta + 1 opción.'); return; }
  triviaBanco.push({ pregunta, respuestas: resps });
  $('triviaPreguntaInput').value = '';
  qsa('.trivia-resp-input').forEach(i => i.value = '');
  renderTriviaBanco();
});

$('btnIniciarTrivia').addEventListener('click', async () => {
  if (!triviaBanco.length) { alert('Agrega al menos una pregunta.'); return; }
  // Publicar en el feed que inició una trivia
  try {
    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_feed'), {
      groupId: currentGroupId,
      type: 'trivia',
      text: `🧠 ¡Trivia iniciada! ${triviaBanco.length} pregunta${triviaBanco.length > 1 ? 's' : ''}. Ve a Dinámicas → Trivia para participar.`,
      images: [],
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      likes: 0, likedBy: [], commentCount: 0,
      createdAt: serverTimestamp()
    });
  } catch (_) { }
  triviaIdx = 0; triviaScore = 0;
  $('triviaCrear').style.display = 'none';
  $('triviaJuego').style.display = 'block';
  mostrarPreguntaTrivia();
});

function mostrarPreguntaTrivia() {
  if (triviaIdx >= triviaBanco.length) {
    $('triviaJuego').innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:40px;margin-bottom:12px">🏆</div>
      <h3 style="font-family:var(--font-display);font-size:22px;margin-bottom:8px">¡Trivia terminada!</h3>
      <p style="color:var(--text1)">Puntuación: <strong>${triviaScore} / ${triviaBanco.length}</strong></p>
      <button class="btn-primary" style="margin-top:20px" onclick="reiniciarTrivia()">Jugar de nuevo</button>
    </div>`;
    return;
  }
  const p = triviaBanco[triviaIdx];
  const opciones = [...p.respuestas].sort(() => Math.random() - 0.5);
  const correcta = p.respuestas[0];
  $('triviaProgreso').textContent = `Pregunta ${triviaIdx + 1} de ${triviaBanco.length} · Puntos: ${triviaScore}`;
  $('triviaPreguntaText').textContent = p.pregunta;
  $('triviaFeedback').textContent = '';
  $('triviaOpciones').innerHTML = opciones.map(op =>
    `<button class="trivia-opcion" onclick="responderTrivia('${escHtml(op)}','${escHtml(correcta)}',this)">
      ${escHtml(op)}
    </button>`).join('');
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
    qsa('.trivia-opcion').forEach(b => { if (b.textContent.trim() === correcta) b.classList.add('correcto'); });
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
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}',-1)">−</button>
        <span class="puntos-num">${j.pts}</span>
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}',1)">+</button>
      </div>
    </div>`).join('');
}
$('btnAgregarJugador').addEventListener('click', () => {
  const nombre = $('puntosNombre').value.trim();
  if (!nombre) return;
  if (!puntosMarcador.find(j => j.nombre === nombre)) { puntosMarcador.push({ nombre, pts: 0 }); renderPuntos(); }
  $('puntosNombre').value = '';
});
$('btnResetPuntos').addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos los puntos?')) return;
  puntosMarcador.forEach(j => j.pts = 0); renderPuntos();
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

document.addEventListener('click', e => {
  const closeBtn = e.target.closest('.modal-close[data-close]');
  if (closeBtn) closeModal(closeBtn.dataset.close);
  const cancelBtn = e.target.closest('.btn-cancel[data-close]');
  if (cancelBtn) closeModal(cancelBtn.dataset.close);
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});


/* ═══════════════════════════════════════════════════
   EDITAR PERFIL (AVATAR + NOMBRE)
═══════════════════════════════════════════════════ */
const EMOJIS_AVATAR = ['😊', '🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🦄', '🐺', '🎭',
  '🚀', '⭐', '🔥', '💎', '🌙', '🎯', '🏆', '🌈', '🎪', '🎨',
  '👾', '🤖', '👽', '🎃', '💀', '🦋', '🌸', '🌺', '🍀', '🌊'];

let _avatarPendiente = null; // {type:'url'|'emoji'|'initial', value: string}

$('btnEditarAvatar')?.addEventListener('click', () => abrirModalPerfil());
// También al hacer clic en el nombre del muro propio
$('muroNombre')?.addEventListener('click', () => {
  if (!muroViendoUid) abrirModalPerfil();
});

function abrirModalPerfil() {
  _avatarPendiente = null;

  // Prellenar nombre actual
  const inputNombre = $('editPerfilNombre');
  if (inputNombre) inputNombre.value = currentUser.name || '';

  // Mostrar foto de Google si la tiene (photoURL original de Firebase Auth)
  const googlePhotoEl = $('avatarPreviewGoogle');
  const googleOpcion = $('avatarOpcionGoogle');
  const googlePhoto = window._auth?.currentUser?.photoURL || '';
  if (googlePhotoEl && googleOpcion) {
    if (googlePhoto) {
      googlePhotoEl.src = googlePhoto;
      googleOpcion.style.display = 'block';
    } else {
      googleOpcion.style.display = 'none';
    }
  }

  // Grid de emojis
  const grid = $('avatarEmojiGrid');
  if (grid) {
    grid.innerHTML = EMOJIS_AVATAR.map(em =>
      `<button class="avatar-emoji-opt ${currentUser.avatar === em ? 'selected' : ''}" data-em="${em}">${em}</button>`
    ).join('');
    grid.querySelectorAll('.avatar-emoji-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _avatarPendiente = { type: 'emoji', value: btn.dataset.em };
        mostrarPreviewAvatar(btn.dataset.em, false);
        $('avatarFileNombre').textContent = 'Sin archivo';
      });
    });
  }

  // Reset file input
  const fileInput = $('avatarFileInput');
  if (fileInput) fileInput.value = '';
  $('avatarFileNombre').textContent = 'Sin archivo';
  $('avatarPreviewWrap').style.display = 'none';

  openModal('modalEditarAvatar');
}

// Usar foto de Google
$('btnUsarFotoGoogle')?.addEventListener('click', () => {
  const url = window._auth?.currentUser?.photoURL || '';
  if (!url) return;
  _avatarPendiente = { type: 'url', value: url };
  mostrarPreviewAvatar(url, true);
  const grid = $('avatarEmojiGrid');
  if (grid) grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
});

// Seleccionar archivo
$('avatarFileInput')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  $('avatarFileNombre').textContent = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    _avatarPendiente = { type: 'file', value: file };
    mostrarPreviewAvatar(ev.target.result, true);
    const grid = $('avatarEmojiGrid');
    if (grid) grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
  };
  reader.readAsDataURL(file);
});

function mostrarPreviewAvatar(valor, esImagen) {
  const wrap = $('avatarPreviewWrap');
  const prev = $('avatarModalPreview');
  if (!wrap || !prev) return;
  wrap.style.display = 'block';
  if (esImagen) {
    prev.style.backgroundImage = `url(${valor})`;
    prev.style.backgroundSize = 'cover';
    prev.style.backgroundPosition = 'center';
    prev.textContent = '';
  } else {
    prev.style.backgroundImage = '';
    prev.textContent = valor;
  }
}

// Guardar perfil
$('btnGuardarAvatar')?.addEventListener('click', async () => {
  const inputNombre = $('editPerfilNombre');
  const nuevoNombre = inputNombre ? inputNombre.value.trim() : '';

  const btn = $('btnGuardarAvatar');
  btn.disabled = true; btn.textContent = '⏳';

  let nuevoAvatar = currentUser.avatar; // conservar el actual si no cambia

  if (_avatarPendiente) {
    if (_avatarPendiente.type === 'url') {
      nuevoAvatar = _avatarPendiente.value;
    } else if (_avatarPendiente.type === 'emoji') {
      nuevoAvatar = _avatarPendiente.value;
    } else if (_avatarPendiente.type === 'file') {
      const url = await uploadToCloudinary(_avatarPendiente.value);
      if (url) nuevoAvatar = url;
      else { alert('Error al subir la imagen.'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    }
  }

  const nombre = nuevoNombre || currentUser.name;

  // Guardar en Firestore
  const { doc, setDoc } = lib();
  try {
    await setDoc(doc(db(), 'ec_users', currentUser.uid), {
      name: nombre,
      email: currentUser.email,
      avatar: nuevoAvatar,
      updatedAt: lib().serverTimestamp()
    }, { merge: true });

    // NUEVO: Guardar el ALIAS específico para este grupo
    if (currentGroupId) {
      const emailKey = currentUser.email.replace(/\./g, '_');
      const { updateDoc } = lib();
      await updateDoc(doc(db(), 'ec_grupos', currentGroupId), {
        [`miembroNombres.${emailKey}`]: nombre
      });
      if (!currentGroupData.miembroNombres) currentGroupData.miembroNombres = {};
      currentGroupData.miembroNombres[emailKey] = nombre;
    }

    currentUser.name = nombre;
    currentUser.avatar = nuevoAvatar;

    refreshAvatarUI();
    $('userName').textContent = getUserAlias();
    if ($('muroNombre') && !muroViendoUid) $('muroNombre').textContent = getUserAlias();

    closeModal('modalEditarAvatar');
    _avatarPendiente = null;
  } catch (e) { alert('Error al guardar: ' + e.message); }

  btn.disabled = false; btn.textContent = 'Guardar';
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
   COLOR PICKER (para semestres pastel)
═══════════════════════════════════════════════════ */
function renderColorPicker(containerId, onChange) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = SEM_PASTEL_PALETTE.map((p, i) =>
    `<button class="color-swatch ${i === 0 ? 'selected' : ''}" 
      data-c1="${p.c1}" data-c2="${p.c2}" data-txt="${p.text}"
      style="background:linear-gradient(135deg,${p.c1},${p.c2})"
      title="${p.label}"></button>`
  ).join('');
  container.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onChange(btn.dataset.c1);
      // Preview en el modal
      const preview = $(containerId.replace('ColorPicker', 'ColorPreview'));
      if (preview) preview.style.background = `linear-gradient(135deg,${btn.dataset.c1},${btn.dataset.c2})`;
    });
  });
}

/* ── Notas de materia — comentarios por usuario ── */
let notasUnsub = null;

window.abrirNotas = function (galeriaId) {
  const gal = galerias.find(g => g.id === galeriaId);
  if (!gal) return;
  $('notasGaleriaTitulo').textContent = `${gal.icon || '📚'} ${gal.name}`;
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = galeriaId;
  openModal('modalNotasGaleria');
  cargarNotas(galeriaId);
};

function cargarNotas(galeriaId) {
  if (notasUnsub) { notasUnsub(); notasUnsub = null; }
  // Sin orderBy para evitar requerir índice compuesto — ordenamos en memoria
  const { collection, query, where, onSnapshot } = lib();
  const lista = $('notasLista');
  const q = query(
    collection(db(), 'ec_notas'),
    where('galeriaId', '==', galeriaId)
  );
  notasUnsub = onSnapshot(q, { includeMetadataChanges: false }, snap => {
    const notas = [];
    snap.forEach(d => notas.push({ id: d.id, ...d.data() }));
    // Ordenar en memoria por fecha ascendente
    notas.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    if (!notas.length) {
      lista.innerHTML = '<div class="notas-vacio">Sin notas aún. ¡Sé el primero!</div>';
      return;
    }
    lista.innerHTML = notas.map(n => {
      const esMia = n.autorUid === currentUser.uid;
      const fecha = n.createdAt ? fmtTime(n.createdAt) : '';
      const btnDel = (esMia || isAdmin)
        ? `<button class="nota-item-del" onclick="eliminarNota('${n.id}')">🗑️</button>` : '';
      return `<div class="nota-item">
        <div class="nota-item-header">
          <span class="nota-item-autor">${escHtml(n.autorNombre || '?')}</span>
          <span class="nota-item-fecha">${fecha}</span>
          ${btnDel}
        </div>
        <div class="nota-item-texto">${escHtml(n.texto)}</div>
      </div>`;
    }).join('');
    lista.scrollTop = lista.scrollHeight;
  }, err => {
    console.error('Error cargando notas:', err);
    lista.innerHTML = '<div class="notas-vacio" style="color:var(--red)">Error al cargar notas.</div>';
  });
}

window.eliminarNota = async function (notaId) {
  if (!confirm('¿Eliminar esta nota?')) return;
  const { doc, deleteDoc } = lib();
  try { await deleteDoc(doc(db(), 'ec_notas', notaId)); }
  catch (e) { alert('Error: ' + e.message); }
};

// Cerrar listener al cerrar modal
document.addEventListener('click', e => {
  if (e.target.closest('.modal-close[data-close="modalNotasGaleria"]') ||
    e.target.closest('.btn-cancel[data-close="modalNotasGaleria"]')) {
    if (notasUnsub) { notasUnsub(); notasUnsub = null; }
  }
});

/* ═══════════════════════════════════════════════════
   ARRANQUE
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   CHAT BURBUJA FLOTANTE
   Accesible desde cualquier sección sin salir de la vista actual
═══════════════════════════════════════════════════ */
let chatBurbujaAbierta = false;
let chatBurbujaUnsub = null;
let chatBurbujaUnreadCount = 0;
let chatBurbujaLastDate = '';

function initChatBurbuja() {
  const fab = $('chatFab');
  const panel = $('chatBurbujaPanel');
  const closeBtn = $('chatBurbujaClose');
  const sendBtn = $('chatBurbujaEnviar');
  const input = $('chatBurbujaInput');
  const msgBox = $('chatBurbujaMsgs');
  if (!fab || !panel) return;

  // Abrir / cerrar
  fab.addEventListener('click', () => {
    chatBurbujaAbierta = !chatBurbujaAbierta;
    panel.classList.toggle('open', chatBurbujaAbierta);
    fab.classList.toggle('active', chatBurbujaAbierta);
    if (chatBurbujaAbierta) {
      resetBurbujaUnread();
      conectarChatBurbuja();
      setTimeout(() => input?.focus(), 200);
    } else {
      desconectarChatBurbuja();
    }
  });

  closeBtn?.addEventListener('click', () => {
    chatBurbujaAbierta = false;
    panel.classList.remove('open');
    fab.classList.remove('active');
    desconectarChatBurbuja();
  });

  // Enviar mensaje
  const doSend = async () => {
    const text = input.value.trim();
    if (!text || !currentGroupId || !currentUser) return;
    input.value = '';
    input.style.height = 'auto';
    const { collection, addDoc, serverTimestamp } = lib();
    try {
      await addDoc(collection(db(), 'ec_chat'), {
        groupId: currentGroupId,
        text,
        authorUid: currentUser.uid,
        authorName: getUserAlias(),
        authorAvatar: currentUser.avatar || '',
        createdAt: serverTimestamp()
      });
      msgBox.scrollTop = msgBox.scrollHeight;
    } catch (e) { console.error('Burbuja send:', e); }
  };

  sendBtn?.addEventListener('click', doSend);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  input?.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });
}

function conectarChatBurbuja() {
  if (!currentGroupId) return;
  desconectarChatBurbuja();
  chatBurbujaLastDate = '';
  const msgBox = $('chatBurbujaMsgs');
  if (msgBox) msgBox.innerHTML = '<div class="chat-burbuja-loading">Cargando…</div>';
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  let isFirst = true;

  const startListener = (ordered) => {
    if (chatBurbujaUnsub) { chatBurbujaUnsub(); chatBurbujaUnsub = null; }
    const q = ordered
      ? query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc'),
        limit(80)
      )
      : query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        limit(80)
      );

    chatBurbujaUnsub = onSnapshot(q, snap => {
      const msgBox = $('chatBurbujaMsgs');
      if (!msgBox) return;
      const loading = msgBox.querySelector('.chat-burbuja-loading');
      if (loading) loading.remove();
      const wasNearBottom = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 120;
      const prevIds = new Set([...msgBox.querySelectorAll('[data-id]')].map(el => el.dataset.id));

      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getChatMsgMillis(a) - getChatMsgMillis(b));

      const nuevosExternos = !isFirst && !chatBurbujaAbierta && mensajes.some(m => (
        !prevIds.has(m.id) && m.authorUid !== currentUser?.uid
      ));

      chatBurbujaLastDate = '';
      msgBox.innerHTML = '';
      mensajes.forEach(m => appendBurbujaMsg(m, msgBox));

      if (isFirst || wasNearBottom) msgBox.scrollTop = msgBox.scrollHeight;
      if (nuevosExternos) incrementBurbujaUnread();
      isFirst = false;
    }, err => {
      console.error('Burbuja chat error:', err);
      if (ordered && err.code === 'failed-precondition') {
        isFirst = true;
        startListener(false);
      }
    });
  };

  startListener(true);
}

function appendBurbujaMsg(m, box) {
  const mine = m.authorUid === currentUser?.uid;
  const dateStr = m.createdAt ? fmtDateChat(m.createdAt) : '';
  if (dateStr && dateStr !== chatBurbujaLastDate) {
    const div = document.createElement('div');
    div.className = 'chat-date-divider';
    div.innerHTML = `<span>${escHtml(dateStr)}</span>`;
    box.appendChild(div);
    chatBurbujaLastDate = dateStr;
  }
  const el = document.createElement('div');
  el.className = `chat-burbuja-msg ${mine ? 'mine' : ''}`;
  el.dataset.id = m.id;
  let content = m.imageUrl
    ? `<img src="${escHtml(m.imageUrl)}" style="max-width:180px;border-radius:8px;display:block;">`
    : escHtml(m.text);
  el.innerHTML = `
    <div class="chat-burbuja-bubble">${content}</div>
    <div class="chat-burbuja-meta">${escHtml(mine ? 'Tú' : (m.authorName || 'Compañero'))} · ${fmtTimeChat(m.createdAt)}</div>`;
  box.appendChild(el);
}

function desconectarChatBurbuja() {
  if (chatBurbujaUnsub) { chatBurbujaUnsub(); chatBurbujaUnsub = null; }
}

function incrementBurbujaUnread() {
  chatBurbujaUnreadCount++;
  const badge = $('chatFabBadge');
  if (badge) { badge.textContent = chatBurbujaUnreadCount > 9 ? '9+' : chatBurbujaUnreadCount; badge.style.display = 'flex'; }
}
function resetBurbujaUnread() {
  chatBurbujaUnreadCount = 0;
  const badge = $('chatFabBadge');
  if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
}

function setBurbujaUnreadCount(n) {
  const count = Math.max(0, Number(n) || 0);
  chatBurbujaUnreadCount = count;
  const badge = $('chatFabBadge');
  if (!badge) return;
  if (count <= 0) {
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = 'flex';
}

async function markChatAsRead() {
  if (!currentGroupId || !currentUser) return;
  try {
    const { doc, setDoc, serverTimestamp } = lib();
    const nowMs = Date.now();
    chatLastReadMs = Math.max(chatLastReadMs, nowMs);
    await setDoc(doc(db(), 'ec_chat_reads', `${currentGroupId}_${currentUser.uid}`), {
      groupId: currentGroupId,
      uid: currentUser.uid,
      lastReadAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (_) { /* silencioso */ }
}

// Reconectar burbuja y activar Notificaciones Globales
let globalNotifUnsub = null;
let _lastNotifMsgId = null;

function hookBurbujaEnGrupo() {
  if (globalNotifUnsub) { globalNotifUnsub(); globalNotifUnsub = null; }
  _lastNotifMsgId = null;
  if (!currentGroupId) return;

  const { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } = lib();
  let isFirstNotif = true;

  chatLastReadMs = 0;
  getDoc(doc(db(), 'ec_chat_reads', `${currentGroupId}_${currentUser.uid}`))
    .then(s => {
      if (!s.exists()) return;
      const data = s.data() || {};
      const ts = data.lastReadAt;
      if (ts?.toMillis) chatLastReadMs = ts.toMillis();
      else if (ts) {
        const d = new Date(ts);
        if (Number.isFinite(d.getTime())) chatLastReadMs = d.getTime();
      }
    })
    .catch(() => { });

  const startNotifListener = (ordered) => {
    if (globalNotifUnsub) { globalNotifUnsub(); globalNotifUnsub = null; }
    const q = ordered
      ? query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      : query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        limit(40)
      );

    globalNotifUnsub = onSnapshot(q, snap => {
      if (snap.empty) return;
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getChatMsgMillis(b) - getChatMsgMillis(a));
      const latest = sorted[0];
      if (!latest) return;

      const panel = $('chatBurbujaPanel');
      const panelAbierto = panel && panel.classList.contains('open');
      const seccionChatActiva = (currentSection === 'chat');

      if (!panelAbierto && !seccionChatActiva) {
        const unread = sorted.filter(m => (
          m.authorUid !== currentUser?.uid &&
          getChatMsgMillis(m) > chatLastReadMs
        )).length;
        setBurbujaUnreadCount(unread);
      } else {
        setBurbujaUnreadCount(0);
      }

      if (isFirstNotif) {
        isFirstNotif = false;
        _lastNotifMsgId = latest.id;
        return;
      }
      if (latest.id === _lastNotifMsgId) return;
      _lastNotifMsgId = latest.id;

      const data = latest;
      const esMio = data.authorUid === currentUser?.uid;

      if (!panelAbierto && !seccionChatActiva && !esMio) {
        if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`💬 ${data.authorName || 'Compañero'}`, {
            body: data.imageUrl ? '📷 Imagen' : (data.text || ''),
            icon: './icons/icon.png',
            tag: 'ze-chat-msg'
          });
        }
      }
    }, err => {
      console.error('Notif chat error:', err);
      if (ordered && err.code === 'failed-precondition') {
        isFirstNotif = true;
        startNotifListener(false);
      }
    });
  };

  startNotifListener(true);
}
initTheme();
waitForFirebase(() => initAuth());

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  });
}

// --- ELIMINAR GRUPO ---
const btnDeleteGroup = $('btnDeleteGroup');
if (btnDeleteGroup) {
  btnDeleteGroup.addEventListener('click', async () => {
    if (!isAdmin) return;
    if (!confirm(`¿Estás 100% seguro de eliminar el grupo "${currentGroupData.name}"? Esto lo borrará para todos los miembros.`)) return;

    const { doc, deleteDoc } = lib();
    try {
      // Borrar el documento del grupo en Firestore
      await deleteDoc(doc(db(), 'ec_grupos', currentGroupId));
      alert('Grupo eliminado correctamente.');
      // Refrescar la página para limpiar todo
      window.location.reload();
    } catch (e) {
      alert('Error al eliminar grupo: ' + e.message);
    }
  });
}

window.eliminarSemestre = async function (id, nombre) {
  const mats = galerias.filter(g => g.semestreId === id);
  const totalMats = mats.length;
  const advertencia = totalMats > 0
    ? `⚠️ ADVERTENCIA:\n\nEsto eliminará permanentemente:\n• El semestre "${nombre}"\n• ${totalMats} materia${totalMats !== 1 ? 's' : ''} dentro de él\n• Todas las fotos de apuntes de cada materia\n\n¿Estás completamente seguro? Esta acción NO se puede deshacer.`
    : `¿Eliminar el semestre "${nombre}"? Esta acción no se puede deshacer.`;
  if (!confirm(advertencia)) return;

  const { doc, deleteDoc, collection, query, where, getDocs } = lib();
  try {
    // 1. Borrar todas las fotos de cada materia del semestre
    for (const mat of mats) {
      const fotosSnap = await getDocs(query(collection(db(), 'ec_fotos'), where('galeriaId', '==', mat.id)));
      for (const f of fotosSnap.docs) await deleteDoc(doc(db(), 'ec_fotos', f.id));
      // 2. Borrar la materia (galería)
      await deleteDoc(doc(db(), 'ec_galerias', mat.id));
    }
    // 3. Borrar el semestre
    await deleteDoc(doc(db(), 'ec_semestres', id));
  } catch (e) { alert("Error al eliminar: " + e.message); }
};

window.eliminarMateria = async function (id, nombre) {
  if (!confirm(`⚠️ ADVERTENCIA:\n\nEsto eliminará la materia "${nombre}" y TODAS sus fotos de apuntes de forma permanente.\n\n¿Estás seguro? Esta acción no se puede deshacer.`)) return;
  const { doc, deleteDoc, collection, query, where, getDocs } = lib();
  try {
    // Borrar todas las fotos de la materia
    const fotosSnap = await getDocs(query(collection(db(), 'ec_fotos'), where('galeriaId', '==', id)));
    for (const f of fotosSnap.docs) await deleteDoc(doc(db(), 'ec_fotos', f.id));
    // Borrar la materia
    await deleteDoc(doc(db(), 'ec_galerias', id));
  } catch (e) { alert("Error al eliminar: " + e.message); }
};

// Activar Emojis en el chat principal (delegación de eventos)
document.addEventListener('click', e => {
  if (e.target.classList.contains('q-emoji')) {
    const input = $('chatInput');
    if (input) {
      input.value += e.target.textContent;
      input.focus();
    }
  }
});

/* ═══════════════════════════════════════════════════════
   VIDEOTUTORIALES — Cajas de DVD con thumbnails de YouTube
═══════════════════════════════════════════════════════ */

let dvdUnsub = null;
let dvdColorSeleccionado = '#1a237e';
let dvdFiltroCategoria = 'all';
let dvdBusqueda = '';

/* ── Utilidad: extraer Video ID de una URL de YouTube ── */
function extraerYoutubeId(url) {
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return u.searchParams.get('v');
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0];
    }
    // youtube.com/shorts/ID o /embed/ID
    const match = u.pathname.match(/(?:shorts|embed|v)\/([^/?&]+)/);
    if (match) return match[1];
  } catch (_) {}
  return null;
}

/* ── Thumbnail de YouTube por ID ── */
function ytThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/* ── Construir HTML de tarjeta de video tutorial (rectangular) ── */
/* ── Construir HTML de tarjeta de video tutorial (rectangular) ── */
function buildDvdCard(dvd, puedeBorrar) {
  const thumb = dvd.thumbnail || (dvd.videoId ? ytThumb(dvd.videoId) : '');
  const titulo = escHtml(dvd.titulo || 'Sin título');
  const cat = escHtml(dvd.categoria || '');
  const color = dvd.color || '#1a237e';
  const desc = escHtml(dvd.descripcion || '');
  const addedBy = escHtml(dvd.addedBy || '');
  
  const delBtn = puedeBorrar
    ? `<button class="dvd-del-btn" data-id="${dvd.id}" title="Eliminar">✕</button>`
    : '';

  // Botón compartir siempre activo
  const avatarLetra = addedBy ? addedBy.trim().charAt(0).toUpperCase() : '?';

  return `
    <div class="dvd-item dvd-item-rect" data-id="${dvd.id}" data-cat="${escHtml(dvd.categoria || '')}" data-titulo="${titulo.toLowerCase()}">
      ${delBtn}
      <div class="dvd-rect-thumb" style="background:${color}">
        ${thumb ? `<img src="${thumb}" alt="${titulo}" loading="lazy" class="dvd-rect-img">` : '<div class="dvd-rect-noimg">▶</div>'}
        <div class="dvd-rect-play-overlay">▶</div>
        ${cat ? `<div class="dvd-cat-badge">${cat}</div>` : ''}
      </div>
      <div class="dvd-rect-info">
        <div class="dvd-rect-title">${titulo}</div>
        ${desc ? `<div class="dvd-rect-desc">${desc}</div>` : ''}
        ${addedBy ? `<div class="dvd-rect-meta"><div class="dvd-rect-meta-avatar">${avatarLetra}</div><span>${addedBy}</span></div>` : ''}
        <button class="dvd-share-btn" onclick="event.stopPropagation(); compartirDvd('${dvd.id}')">📢 Compartir al Tablero</button>
      </div>
    </div>`;
}

/* ── Inicializar sección ── */
function initVideotutoriales() {
  if (!currentGroupId) return;

  // Configurar buscador
  const searchEl = $('dvdSearch');
  if (searchEl && !searchEl._dvdListener) {
    searchEl._dvdListener = true;
    searchEl.addEventListener('input', () => {
      dvdBusqueda = searchEl.value.toLowerCase();
      filtrarDvds();
    });
  }

  // Botón agregar
  const btnAgregar = $('btnAgregarDvd');
  if (btnAgregar && !btnAgregar._dvdListener) {
    btnAgregar._dvdListener = true;
    btnAgregar.addEventListener('click', () => abrirModalDvd());
  }

  // Cargar DVDs desde Firestore con listener en tiempo real
  // Nota: ordenamos en el cliente para evitar requerir índice compuesto en Firestore
  if (dvdUnsub) { dvdUnsub(); dvdUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();

  const q = query(
    collection(db(), 'ec_videotutoriales'),
    where('groupId', '==', currentGroupId)
  );

  dvdUnsub = onSnapshot(q, snap => {
    const dvds = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
    renderDvdGrid(dvds);
    renderDvdCats(dvds);
  }, err => {
    console.error('DVD listener error:', err);
    const grid = $('dvdGrid');
    if (grid) grid.innerHTML = `<div class="dvd-empty"><div class="dvd-empty-icon">⚠️</div><div class="dvd-empty-text">Error al cargar tutoriales.<br>Revisa la consola.</div></div>`;
  });
}

/* ── Renderizar categorías ── */
function renderDvdCats(dvds) {
  const bar = $('dvdCatsBar');
  if (!bar) return;
  const cats = [...new Set(dvds.map(d => d.categoria).filter(Boolean))];
  bar.innerHTML = `<button class="dvd-cat-btn ${dvdFiltroCategoria === 'all' ? 'active' : ''}" data-cat="all">Todos</button>` +
    cats.map(c => `<button class="dvd-cat-btn ${dvdFiltroCategoria === c ? 'active' : ''}" data-cat="${escHtml(c)}">${escHtml(c)}</button>`).join('');

  bar.querySelectorAll('.dvd-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dvdFiltroCategoria = btn.dataset.cat;
      bar.querySelectorAll('.dvd-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtrarDvds();
    });
  });
}

/* ── Renderizar grid ── */
function renderDvdGrid(dvds) {
  const grid = $('dvdGrid');
  if (!grid) return;

  // Guardar dvds en memoria para filtrar
  grid._dvds = dvds;

  if (!dvds.length) {
    grid.innerHTML = `<div class="dvd-empty">
      <div class="dvd-empty-icon">📀</div>
      <div class="dvd-empty-text">Aún no hay tutoriales.<br>¡Agrega el primero!</div>
    </div>`;
    return;
  }

  filtrarDvds();
}

/* ── Filtrar DVDs visibles ── */
function filtrarDvds() {
  const grid = $('dvdGrid');
  if (!grid || !grid._dvds) return;
  const dvds = grid._dvds;

  const filtrados = dvds.filter(d => {
    const matchCat = dvdFiltroCategoria === 'all' || d.categoria === dvdFiltroCategoria;
    const matchSearch = !dvdBusqueda || (d.titulo || '').toLowerCase().includes(dvdBusqueda) ||
      (d.categoria || '').toLowerCase().includes(dvdBusqueda);
    return matchCat && matchSearch;
  });

  if (!filtrados.length) {
    grid.innerHTML = `<div class="dvd-empty">
      <div class="dvd-empty-icon">🔍</div>
      <div class="dvd-empty-text">No se encontraron tutoriales.</div>
    </div>`;
    return;
  }

  const puedeBorrar = isAdmin;
  grid.innerHTML = filtrados.map(d => buildDvdCard(d, puedeBorrar)).join('');

  // Click en DVD → abrir YouTube
  grid.querySelectorAll('.dvd-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.classList.contains('dvd-del-btn')) return;
      const dvd = dvds.find(d => d.id === item.dataset.id);
      if (dvd && dvd.url) window.open(dvd.url, '_blank', 'noopener');
    });
  });

  // Botones eliminar
  grid.querySelectorAll('.dvd-del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este tutorial?')) return;
      const { doc, deleteDoc } = lib();
      await deleteDoc(doc(db(), 'ec_videotutoriales', btn.dataset.id));
    });
  });
}

/* ── Modal: abrir ── */
function abrirModalDvd() {
  $('dvdYoutubeUrl').value = '';
  $('dvdTitulo').value = '';
  $('dvdCategoria').value = '';
  if ($('dvdDesc')) $('dvdDesc').value = '';
  $('dvdPreviewWrap').style.display = 'none';
  dvdColorSeleccionado = '#1a237e';
  // Reset color picker
  $('dvdColorPicker').querySelectorAll('.dvd-color-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.color === dvdColorSeleccionado);
  });
  openModal('modalAgregarDvd');
}

/* ── Vista previa al pegar URL ── */
const btnDvdPreview = $('btnDvdPreview');
if (btnDvdPreview) {
  btnDvdPreview.addEventListener('click', () => {
    const url = ($('dvdYoutubeUrl')?.value || '').trim();
    const videoId = extraerYoutubeId(url);
    if (!videoId) { alert('No se reconoce como un link de YouTube válido.'); return; }
    const thumb = ytThumb(videoId);
    $('dvdPreviewThumb').src = thumb;
    $('dvdPreviewWrap').style.display = 'block';
    // Poner el videoId en título de preview
    $('dvdPreviewTitle').textContent = 'Vista previa cargada ✓';
  });
}

/* ── Color picker del modal ── */
const dvdColorPickerEl = $('dvdColorPicker');
if (dvdColorPickerEl) {
  dvdColorPickerEl.addEventListener('click', e => {
    const btn = e.target.closest('.dvd-color-opt');
    if (!btn) return;
    dvdColorSeleccionado = btn.dataset.color;
    dvdColorPickerEl.querySelectorAll('.dvd-color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
}

/* ── Guardar DVD ── */
const btnConfirmarDvd = $('btnConfirmarDvd');
if (btnConfirmarDvd) {
  btnConfirmarDvd.addEventListener('click', async () => {
    const url = ($('dvdYoutubeUrl')?.value || '').trim();
    const titulo = ($('dvdTitulo')?.value || '').trim();
    const categoria = ($('dvdCategoria')?.value || '').trim();

    if (!url) { alert('Pega un link de YouTube.'); return; }
    const videoId = extraerYoutubeId(url);
    if (!videoId) { alert('No se reconoce como un link de YouTube válido.'); return; }
    if (!titulo) { alert('Escribe un título para el tutorial.'); return; }

    btnConfirmarDvd.disabled = true;
    btnConfirmarDvd.textContent = '⏳ Guardando…';

    const { collection, addDoc, serverTimestamp } = lib();
    try {
      const descripcion = ($('dvdDesc')?.value || '').trim();
      await addDoc(collection(db(), 'ec_videotutoriales'), {
        groupId: currentGroupId,
        url,
        videoId,
        thumbnail: ytThumb(videoId),
        titulo,
        categoria,
        descripcion,
        color: dvdColorSeleccionado,
        addedBy: getUserAlias(),
        addedByUid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      closeModal('modalAgregarDvd');
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    }

    btnConfirmarDvd.disabled = false;
    btnConfirmarDvd.textContent = '💾 Guardar DVD';
  });
}

/* ═══════════════════════════════════════════════════
   SELECTOR DE TABLERO (compartir)
═══════════════════════════════════════════════════ */

// yaCompartidoEn: Set de tableroIds donde ya existe la publicación ('' = feed general)
function mostrarSelectorTablero(desc, onSelect, yaCompartidoEn = new Set()) {
  const lista = $('selectorTableroLista');
  const descEl = $('selectorTableroDesc');
  if (!lista) return;
  if (descEl) descEl.textContent = desc || 'Elige el tablero donde quieres publicar.';

  lista.innerHTML = '<div class="feed-loading" style="padding:20px 0">Cargando tableros…</div>';
  openModal('modalSelectorTablero');

  const { collection, query, where, getDocs } = lib();
  getDocs(query(
    collection(db(), 'ec_tableros'),
    where('groupId', '==', currentGroupId)
  )).then(snap => {
    const tableros = [];
    snap.forEach(d => tableros.push({ id: d.id, ...d.data() }));
    tableros.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

    // Feed general
    const generalYa = yaCompartidoEn.has('');
    let html = `
      <button class="selector-tablero-item general ${generalYa ? 'ya-compartido' : ''}" data-id="" data-nombre="Feed general">
        <div class="selector-tablero-item-color" style="background:var(--accent2,#3b3b6b)">🏠</div>
        <div class="selector-tablero-item-info">
          <div class="selector-tablero-item-nombre">Feed general</div>
          <div class="selector-tablero-item-meta">${generalYa ? '✅ Ya compartido aquí' : 'Publicaciones del grupo'}</div>
        </div>
        ${generalYa ? '<span class="selector-tablero-check">✅</span>' : ''}
      </button>`;

    tableros.forEach(t => {
      const icono = t.icono || getTableroIcono(t.nombre);
      const yaEsta = yaCompartidoEn.has(t.id);
      html += `
        <button class="selector-tablero-item ${yaEsta ? 'ya-compartido' : ''}"
                data-id="${t.id}" data-nombre="${escHtml(t.nombre)}"
                style="border-left: 4px solid ${t.color || '#1a237e'}">
          <div class="selector-tablero-item-color" style="background:${t.color || '#1a237e'}">${icono}</div>
          <div class="selector-tablero-item-info">
            <div class="selector-tablero-item-nombre">${escHtml(t.nombre)}</div>
            <div class="selector-tablero-item-meta">${yaEsta ? '✅ Ya compartido aquí' : 'Tablero temático'}</div>
          </div>
          ${yaEsta ? '<span class="selector-tablero-check">✅</span>' : ''}
        </button>`;
    });

    lista.innerHTML = html;

    lista.querySelectorAll('.selector-tablero-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id || null;
        const nombre = btn.dataset.nombre || 'Feed general';
        closeModal('modalSelectorTablero');
        onSelect(id, nombre);
      });
    });
  }).catch(() => {
    const generalYa = yaCompartidoEn.has('');
    lista.innerHTML = `
      <button class="selector-tablero-item general ${generalYa ? 'ya-compartido' : ''}" data-id="" data-nombre="Feed general">
        <div class="selector-tablero-item-color" style="background:var(--accent2,#3b3b6b)">🏠</div>
        <div class="selector-tablero-item-info">
          <div class="selector-tablero-item-nombre">Feed general</div>
          <div class="selector-tablero-item-meta">${generalYa ? '✅ Ya compartido aquí' : 'Publicaciones del grupo'}</div>
        </div>
        ${generalYa ? '<span class="selector-tablero-check">✅</span>' : ''}
      </button>`;
    lista.querySelector('.selector-tablero-item')?.addEventListener('click', () => {
      closeModal('modalSelectorTablero');
      onSelect(null, 'Feed general');
    });
  });
}
let libroSeleccionado = null;

window.abrirModalLibro = function(libroId) {
  const { doc, getDoc } = lib();
  getDoc(doc(db(), 'ec_biblioteca', libroId)).then(snap => {
    if(!snap.exists()) return;
    libroSeleccionado = { id: snap.id, ...snap.data() };
    
    $('libroModalTitulo').textContent = libroSeleccionado.name;
    $('libroModalBadge').textContent = libroSeleccionado.ext;
    $('libroModalAutor').textContent = libroSeleccionado.authorName || 'Anónimo';
    $('libroModalDesc').textContent = libroSeleccionado.descripcion || 'Sin descripción disponible para este archivo.';
    
    const colorClasses = {
      'book-pdf': '#dc2626', 'book-doc': '#2563eb', 'book-xls': '#16a34a', 
      'book-default': '#7c6af7', 'book-cyan': '#06b6d4', 'book-ppt': '#ea580c'
    };
    $('libroModalLomo').style.background = colorClasses[libroSeleccionado.colorClass] || '#7c6af7';
    
    // El botón siempre estará visible con su estilo flex original
    const btnCompartir = $('btnCompartirLibro');
    if (btnCompartir) {
        btnCompartir.style.display = 'flex'; 
    }

    openModal('modalLibroAbierto');
  });
};

$('btnLeerLibro')?.addEventListener('click', () => {
  if(libroSeleccionado && libroSeleccionado.url) window.open(libroSeleccionado.url, '_blank');
});

$('btnCompartirLibro')?.addEventListener('click', async () => {
  if(!libroSeleccionado || !currentGroupId) return;
  closeModal('modalLibroAbierto');

  // Consultar en qué tableros ya existe este libro
  const { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } = lib();
  const existingSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    where('type', '==', 'libro'),
    where('libroData.id', '==', libroSeleccionado.id)
  )).catch(() => null);

  const yaEn = new Set();
  existingSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    `¿En qué tablero compartir "${libroSeleccionado.name}"?`,
    async (tableroId, tableroNombre) => {
      try {
        const feedRef = collection(db(), 'ec_feed');
        // Buscar si ya existe en ESE tablero específico
        const enEste = existingSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));

        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), {
            createdAt: serverTimestamp(),
            'libroData.colorClass': libroSeleccionado.colorClass,
            'libroData.name': libroSeleccionado.name
          });
          alert(`🚀 ¡El archivo subió al inicio de "${tableroNombre}"!`);
        } else {
          await addDoc(feedRef, {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            type: 'libro',
            libroData: {
              id: libroSeleccionado.id,
              name: libroSeleccionado.name,
              ext: libroSeleccionado.ext,
              colorClass: libroSeleccionado.colorClass,
              url: libroSeleccionado.url
            },
            text: `📚 Te recomiendo este archivo de la biblioteca.`,
            images: [], authorUid: currentUser.uid, authorName: currentUser.name,
            authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db(), 'ec_biblioteca', libroSeleccionado.id), { compartidoEnTablero: true });
          alert(`📢 ¡Libro compartido en "${tableroNombre}"!`);
        }
      } catch (e) { alert('Error al compartir: ' + e.message); }
    },
    yaEn
  );
});

// Compartir VideoTutorial
window.compartirDvd = async function(dvdId) {
  const { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } = lib();
  try {
    const snap = await getDoc(doc(db(), 'ec_videotutoriales', dvdId));
    if (!snap.exists()) return;
    const dvd = snap.data();

    // Consultar en qué tableros ya existe este video
    const existingSnap = await getDocs(query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('type', '==', 'videotutorial'),
      where('dvdData.url', '==', dvd.url)
    )).catch(() => null);

    const yaEn = new Set();
    existingSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

    mostrarSelectorTablero(
      `¿En qué tablero compartir "${dvd.titulo}"?`,
      async (tableroId, tableroNombre) => {
        try {
          const enEste = existingSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
          if (enEste) {
            await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
            alert(`🚀 ¡Video subido al inicio de "${tableroNombre}"!`);
          } else {
            await addDoc(collection(db(), 'ec_feed'), {
              groupId: currentGroupId,
              tableroId: tableroId || '',
              type: 'videotutorial',
              dvdData: { titulo: dvd.titulo, thumbnail: dvd.thumbnail, url: dvd.url },
              text: `📀 Chequen este video tutorial que agregué a la colección.`,
              images: [], authorUid: currentUser.uid, authorName: currentUser.name,
              authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
              createdAt: serverTimestamp()
            });
            alert(`📢 ¡Video compartido en "${tableroNombre}"!`);
          }
        } catch (e) { alert('Error: ' + e.message); }
      },
      yaEn
    );
  } catch (e) { alert('Error: ' + e.message); }
};



/* ── Responsive: re-renderizar feed al cambiar tamaño de ventana ── */
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (currentSection === 'feed') initFeed();
  }, 250);
});


window.compartirNotaAlTablero = async function(fotoId, url) {
  const materiaNombre = galeriaActual ? galeriaActual.name : 'Apuntes';
  
  mostrarSelectorTablero(
    `¿En qué tablero quieres compartir esta nota de ${materiaNombre}?`,
    async (tableroId, tableroNombre) => {
      try {
        const { collection, addDoc, serverTimestamp } = window._fbLib;
        await addDoc(collection(window._db, 'ec_feed'), {
          groupId: currentGroupId,
          tableroId: tableroId || '',
          type: 'foto',
          text: `📖 Apuntes compartidos de la materia: ${materiaNombre}`,
          images: [url],
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          likes: 0, likedBy: [], commentCount: 0,
          createdAt: serverTimestamp()
        });
        alert(`¡Nota compartida en ${tableroNombre}! 📢`);
      } catch(e) { alert('Error al compartir: ' + e.message); }
    }
  );
};
