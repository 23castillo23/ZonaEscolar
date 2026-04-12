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
// — Paginación feed —
let feedOldestDoc = null;
let feedHayMas = true;
let feedCargandoMas = false;
// — Paginación chat —
let chatOldestDoc = null;
let chatHayMas = true;
let chatCargandoMas = false;
let currentSalaId = null;
let salasUnsub = null;
let salaChatColorSeleccionado = '#1a237e';
let salaChatEmojiSeleccionado = '💬';
let tareasUnsub = null;
let votacionUnsub = null;
let gruposUnsub = null;
let chatOnlineUnsub = null;
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
let dentroDeTablero = false;
let tableroFeedUnsub = null;   // listener del feed filtrado por tablero

// ── MURO (Centralizado desde chat.js y muro.js para evitar duplicación) ──
let muroAlbumActualId = null;     // null = vista de álbumes, string = dentro de un álbum
let muroAlbumsCache = [];         // caché local de álbemes del usuario visto

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
let calMesOffset = 0;             // Offset de mes para calendarios (debe ser global)

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
// Acceso global a Firebase
function db() { return window._db; }
function lib() { return window._fbLib; }

/** Índice de opción en userVotes de votaciones (0 es válido; undefined → null). */
function parseUserVoteIndex(raw) {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

// Función para convertir links de Drive a links directos de previsualización
function limpiarLinkDrive(url) {
  if (url.includes('drive.google.com')) {
    // Formato 1: /d/ID/view, /d/ID/edit, /d/ID/preview (el más común)
    const matchPath = url.match(/\/d\/([a-zA-Z0-9_-]+)\/(view|edit|usp|preview)/);
    if (matchPath && matchPath[1]) {
      return `https://drive.google.com/file/d/${matchPath[1]}/preview`;
    }
    // Formato 2: /d/ID sin segmento de ruta (p.ej. /d/ID?usp=sharing)
    const matchId = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      return `https://drive.google.com/file/d/${matchId[1]}/preview`;
    }
    // Formato 3: open?id=ID o ?id=ID
    const matchQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchQuery && matchQuery[1]) {
      return `https://drive.google.com/file/d/${matchQuery[1]}/preview`;
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
// FIX #1: El listener se registra después de que el DOM esté disponible
// para evitar TypeError si el script carga antes que el HTML.
function _initThemeToggle() {
  const btn = $('btnThemeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = localStorage.getItem('ze_theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initThemeToggle);
} else {
  _initThemeToggle();
}

/* ═══════════════════════════════════════════════════
   SAFARI / CROSS-BROWSER UNIVERSAL LAYOUT FIXES
   
   1. --ze-topbar-h: alto real del topbar medido con JS
   2. --ze-real-vh: 1% del viewport real de Safari
      (Safari cambia el tamaño al aparecer/ocultar la
       barra de dirección, rompiendo 100vh)
   3. Clase .visible en chat-online-bar (reemplaza :has
      que no existe en Safari < 15.4)
═══════════════════════════════════════════════════ */
function _setTopbarHeight() {
  const topbar = document.querySelector('header.topbar');
  if (!topbar) return;
  const h = topbar.getBoundingClientRect().height;
  if (h > 0) {
    document.documentElement.style.setProperty('--ze-topbar-h', h + 'px');
  }
}

/** Alto real de la bottom nav (móvil); en escritorio 0. Evita hueco/solape con valores fijos 48px. */
function _setBottomNavClearance() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) {
    document.documentElement.style.setProperty('--ze-bottom-nav-clearance', '0px');
    return;
  }
  const h = nav.getBoundingClientRect().height;
  if (h > 0) {
    document.documentElement.style.setProperty('--ze-bottom-nav-clearance', h + 'px');
  } else {
    document.documentElement.style.removeProperty('--ze-bottom-nav-clearance');
  }
}

function _setRealVh() {
  // En Safari la barra de dirección hace que 100vh > viewport real.
  // Guardamos el valor real como variable CSS para usarla en los cálculos.
  const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--ze-real-vh', vh + 'px');
}

function _initSafariFixes() {
  const _layoutTick = () => {
    _setRealVh();
    _setTopbarHeight();
    _setBottomNavClearance();
  };

  _layoutTick();

  // Escuchar visualViewport (Safari lo soporta desde iOS 13)
  // Se dispara cuando la barra de dirección aparece/desaparece
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _layoutTick, { passive: true });
  }

  window.addEventListener('resize', _layoutTick, { passive: true });

  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(_layoutTick);
  }, { passive: true });

  try {
    window.matchMedia('(max-width: 768px)').addEventListener('change', _layoutTick);
  } catch (_) {
    window.matchMedia('(max-width: 768px)').addListener(_layoutTick);
  }

  requestAnimationFrame(() => requestAnimationFrame(_layoutTick));
  // Segunda medición tras aplicar safe-areas en iOS
  setTimeout(_layoutTick, 100);
  setTimeout(_layoutTick, 600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initSafariFixes);
} else {
  _initSafariFixes();
}

/* ── Chat online bar: clase .visible en lugar de :has() ── */
function _updateChatOnlineBarVisibility() {
  const bar = document.querySelector('.chat-online-bar');
  const list = document.getElementById('chatOnlineList');
  if (!bar || !list) return;
  const isVisible = list.style.display === 'flex';
  bar.classList.toggle('visible', isVisible);
}
// Observar cambios de estilo en la lista online para actualizar la clase
if (typeof MutationObserver !== 'undefined') {
  const _onlineObserver = new MutationObserver(_updateChatOnlineBarVisibility);
  const _waitForOnlineList = setInterval(() => {
    const list = document.getElementById('chatOnlineList');
    if (list) {
      _onlineObserver.observe(list, { attributes: true, attributeFilter: ['style'] });
      clearInterval(_waitForOnlineList);
    }
  }, 500);
}

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
  Autenticación con Google
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
        // FIX: Cancelar TODOS los listeners activos antes de limpiar el estado.
        // Antes solo se ocultaba el DOM, dejando listeners de Firestore y el
        // heartbeat corriendo con currentUser=null → errores silenciosos y
        // riesgo de datos cruzados si el usuario cambia de cuenta en la misma pestaña.
        currentUser = null;
        currentGroupId = null;
        currentGroupData = null;

        // Delegar el teardown a grupos.js que tiene acceso directo a todas
        // las variables let de los módulos (son closures del mismo scope global).
        if (typeof window.teardownAllListeners === 'function') {
          window.teardownAllListeners();
        }

        showLogin();
      }
    });
  });
}

$('btnGoogleLogin').addEventListener('click', async () => {
  const btn = $('btnGoogleLogin');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Conectando…';
  waitForFirebase(async () => {
    const { GoogleAuthProvider, signInWithPopup } = lib();
    try {
      await signInWithPopup(window._auth, new GoogleAuthProvider());
    } catch (e) {
      showToast('No se pudo iniciar sesión. ' + friendlyError(e), 'error');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
});

$('btnLogout').addEventListener('click', () => {
  showConfirm({
    title: '¿Cerrar sesión?',
    message: 'Se cerrará tu sesión en este dispositivo.',
    confirmText: 'Cerrar sesión',
    danger: false,
    onConfirm: async () => {
      const btn = $('btnLogout');
      btn.disabled = true;
      btn.textContent = '⏳';
      const { signOut } = lib();
      try {
        await signOut(window._auth);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Cerrar sesión';
      }
    }
  });
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
   TOAST — Notificaciones visuales (reemplaza alert)
═══════════════════════════════════════════════════ */

/**
 * Convierte errores técnicos de Firebase/red en mensajes legibles para el usuario.
 * Los mensajes internos (e.message) nunca deben mostrarse en crudo.
 */
window.friendlyError = function(e) {
  if (!e) return 'Ocurrió un error inesperado.';
  const msg = (e.message || e.code || String(e)).toLowerCase();

  if (msg.includes('permission-denied') || msg.includes('missing or insufficient'))
    return 'No tienes permiso para realizar esta acción.';
  if (msg.includes('network') || msg.includes('unavailable') || msg.includes('offline'))
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (msg.includes('not-found') || msg.includes('no such document'))
    return 'El elemento ya no existe o fue eliminado.';
  if (msg.includes('already-exists') || msg.includes('email-already'))
    return 'Ya existe un registro con esos datos.';
  if (msg.includes('unauthenticated') || msg.includes('auth'))
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (msg.includes('quota-exceeded') || msg.includes('resource-exhausted'))
    return 'Límite del servicio alcanzado. Intenta más tarde.';
  if (msg.includes('deadline-exceeded') || msg.includes('timeout'))
    return 'La operación tardó demasiado. Intenta de nuevo.';
  if (msg.includes('upload') || msg.includes('cloudinary'))
    return 'No se pudo subir el archivo. Verifica el formato e intenta de nuevo.';

  // Si no hay un caso conocido, devolvemos el mensaje pero sin jerga técnica
  return 'Algo salió mal. Intenta de nuevo.';
};

/* ═══════════════════════════════════════════════════
   CONFIRM — Modal de confirmación destructiva
   Reemplaza confirm() nativo del navegador.
   Uso: showConfirm({ title, message, confirmText, onConfirm, danger })
═══════════════════════════════════════════════════ */
window.showConfirm = function({ title = '¿Estás seguro?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, danger = true } = {}) {
  const modal = document.getElementById('modalConfirmDestructivo');
  if (!modal) { console.error('Falta #modalConfirmDestructivo en index.html'); return; }

  // Rellenar contenido
  const elTitle   = document.getElementById('confirmTitle');
  const elMsg     = document.getElementById('confirmMessage');
  const btnOk     = document.getElementById('confirmBtnOk');
  const btnCancel = document.getElementById('confirmBtnCancel');

  if (elTitle)   elTitle.textContent   = title;
  if (elMsg)     elMsg.textContent     = message;
  if (btnOk)     btnOk.textContent     = confirmText;
  if (btnCancel) btnCancel.textContent = cancelText;

  // Color del botón: rojo si es destructivo, accent si no
  if (btnOk) {
    btnOk.className = danger ? 'confirm-btn-ok danger' : 'confirm-btn-ok';
  }

  // Limpiar listeners anteriores clonando el botón
  const newOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(newOk, btnOk);

  // Abrir modal
  modal.classList.add('open');
  if (typeof _lockBodyScroll === 'function') _lockBodyScroll();

  const close = () => {
    modal.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open, .comments-modal-overlay.active')) {
      if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
    }
  };

  // Confirmar
  newOk.addEventListener('click', () => { close(); onConfirm?.(); });

  // Cancelar — reusar el mismo botón que ya existe, guardando referencia antes de usarla
  const cancelBtnOld = document.getElementById('confirmBtnCancel');
  const newCancel = cancelBtnOld.cloneNode(true);
  cancelBtnOld.parentNode.replaceChild(newCancel, cancelBtnOld);
  newCancel.addEventListener('click', close);

  // Cerrar al hacer clic en el overlay
  const onOverlay = (e) => { if (e.target === modal) { close(); modal.removeEventListener('click', onOverlay); } };
  modal.addEventListener('click', onOverlay);
};

const _TOAST_MAX = 4; // máximo de toasts apilados al mismo tiempo

window.showToast = function(msg, type = 'info', duration = 3500) {
  // Crear contenedor si no existe
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.style.cssText = `
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      width: max-content;
      max-width: 90vw;
    `;
    document.body.appendChild(container);
  }

  // Deduplicación: si ya hay un toast con el mismo mensaje, no apilamos otro
  const existing = container.querySelectorAll('[data-toast-msg]');
  for (const el of existing) {
    if (el.dataset.toastMsg === msg) return;
  }

  // Límite de toasts: si hay demasiados, eliminar el más antiguo
  const allToasts = container.querySelectorAll('[data-toast-msg]');
  if (allToasts.length >= _TOAST_MAX) {
    allToasts[0].click(); // dispara su propio remove con animación
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = {
    success: 'var(--green, #16a34a)',
    error:   'var(--red,   #dc2626)',
    warning: '#f59e0b',
    info:    'var(--accent,#7c6af7)'
  };

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');           // accesibilidad: lectores de pantalla
  toast.setAttribute('aria-live', 'assertive'); // anuncia el mensaje inmediatamente
  toast.dataset.toastMsg = msg;                 // para deduplicación
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg2, #1e1e2e);
    color: var(--text0, #fff);
    border: 1px solid var(--border, rgba(255,255,255,0.1));
    border-left: 4px solid ${colors[type]};
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-family: var(--font, sans-serif);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    pointer-events: all;
    max-width: 88vw;
    line-height: 1.4;
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    transition: opacity 0.22s ease, transform 0.22s ease;
    cursor: pointer;
  `;
  toast.innerHTML = `<span style="font-size:16px;flex-shrink:0" aria-hidden="true">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);

  // Animar entrada
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Animar salida y eliminar
  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px) scale(0.96)';
    setTimeout(() => toast.remove(), 220);
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
};

/* ═══════════════════════════════════════════════════
   SUBIDA DE ARCHIVOS — CLOUDINARY
   Función compartida por: apuntes, muro, chat,
   tableros y dinámicas. Centralizada aquí para que
   cualquier módulo pueda usarla sin duplicar código.
═══════════════════════════════════════════════════ */
async function uploadToCloudinary(file, tag = '') {
  if (file.size > 10 * 1024 * 1024) {
    showToast('El archivo es muy pesado. Máximo 10 MB.', 'info');
    return null;
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);

  if (tag) {
    fd.append('tags', tag);
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
      // FIX: mostrar error al usuario en lugar de fallar silenciosamente
      showToast('No se pudo subir el archivo. Intenta de nuevo.', 'error');
      return null;
    }
    return data.secure_url || null;
  } catch (e) {
    console.error('Fallo de conexión con Cloudinary:', e);
    // FIX: feedback al usuario en error de red (común en móvil)
    showToast('Sin conexión. Verifica tu red e intenta de nuevo.', 'error');
    return null;
  }
}
