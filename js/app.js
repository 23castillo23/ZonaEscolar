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
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function fmtTimeChat(ts) {
  if (!ts) return 'Enviando...'; // Evita que se rompa si el mensaje es nuevo
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateChat(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
function waitForFirebase(cb) {
  if (window._firebaseReady) { cb(); return; }
  window.addEventListener('firebase-ready', cb, { once: true });
}
function db() { return window._db; }
function lib() { return window._fbLib; }

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
  $('userRole').textContent = 'Miembro';
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

  $('userRole').textContent = isAdmin ? 'Admin' : 'Miembro';
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

  renderGroupSelector();
  renderSidebarMiembros();

  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  if (votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }

  hookBurbujaEnGrupo();

  // Mostrar FAB del chat burbuja
  const fab = $('chatFab');

  // Pedir permiso de notificaciones del sistema (si aún no se ha dado)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
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
      ? `<button class="btn-expulsar" title="Quitar miembro" onclick="event.stopPropagation(); expulsarMiembro('${escHtml(email)}')">✕</button>`
      : '';

    return `<div class="sidebar-member-btn ${esYo ? 'me' : ''}" style="display:flex; align-items:center; cursor:pointer;" onclick="verMuroDeUsuario('${escHtml(email)}','${escHtml(nombre)}')">
          <span class="sidebar-member-initial">${escHtml(nombre.charAt(0).toUpperCase())}</span>
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

window.verMuroDeUsuario = function (email, nombre) {
  // Si es el propio usuario, ir a Mi Muro normal
  if (email === currentUser.email) {
    muroViendoUid = null;
    muroViendoEmail = null;
    muroViendoNombre = null;
    currentSection = 'muro';
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();
    return;
  }
  // Buscar UID en ec_users por email
  const { collection, query, where, getDocs } = lib();
  getDocs(query(collection(db(), 'ec_users'), where('email', '==', email))).then(snap => {
    if (snap.empty) {
      // Usuario aún no se ha logueado, mostrar muro vacío con nombre
      muroViendoUid = '__pending__';
      muroViendoEmail = email;
      muroViendoNombre = nombre;
    } else {
      const d = snap.docs[0];
      muroViendoUid = d.id;
      muroViendoEmail = email;
      muroViendoNombre = d.data().name || nombre;
    }
    currentSection = 'muro';
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();
  }).catch(() => {
    muroViendoUid = '__pending__';
    muroViendoEmail = email;
    muroViendoNombre = nombre;
    currentSection = 'muro';
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();
  });
};

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
  if (!miembros.length) { container.innerHTML = '<p style="font-size:12px;color:var(--text3)">Sin miembros aún.</p>'; return; }
  container.innerHTML = '<p style="font-size:11px;color:var(--text3);margin-bottom:6px">Miembros actuales:</p>' +
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
  feed: 'Novedades', muro: 'Mi Muro', apuntes: 'Apuntes',
  chat: 'Chat', tareas: 'Tareas', dinamicas: 'Dinámicas'
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

  // --- FIX: CERRAR BURBUJA AL ENTRAR AL CHAT GRANDE ---
  if (section === 'chat') {
    const panel = $('chatBurbujaPanel');
    const fab = $('chatFab');
    if (panel) panel.classList.remove('open');
    if (fab) fab.classList.remove('active');
    chatBurbujaAbierta = false;
    
    // Detener el listener de la burbuja para ahorrar recursos
    if (chatBurbujaUnsub) { 
      chatBurbujaUnsub(); 
      chatBurbujaUnsub = null; 
    }
  }
  // ---------------------------------------------------

  showSection(section);
  
  const chatFabEl = $('chatFab');
  if (chatFabEl) chatFabEl.style.opacity = section === 'chat' ? '0' : '1';
  
  if (section === 'feed') initFeed();
  if (section === 'chat') { if (!chatUnsub) initChat(); }
  if (section === 'tareas') initTareas();
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
    tareas: 'sectionTareas', dinamicas: 'sectionDinamicas'
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
  // Siempre cancelar listener anterior y crear uno nuevo para garantizar tiempo real
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc'),
    limit(40)
  );
  $('feedList').innerHTML = '<div class="feed-loading">Cargando…</div>';
  feedUnsub = onSnapshot(q, { includeMetadataChanges: false }, snap => {
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    renderFeed(posts);
  }, err => {
    console.error('Feed error:', err);
    // Ahora imprimirá el error real en color rojo
    $('feedList').innerHTML = `<div class="feed-loading" style="color:var(--red);">⚠️ Error Firebase: ${err.message}</div>`;
  });
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
        toggleBtn.textContent = 'Ocultar comentarios';
        section.style.display = 'block';
      } else {
        section.dataset.open = '0';
        toggleBtn.textContent = `💬 Comentar`;
        section.style.display = 'none';
      }
    });
  }

  const sendBtn = cardEl.querySelector('.feed-comment-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const input = sendBtn.previousElementSibling;
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

function renderFeed(posts) {
  const list = $('feedList');
  if (!posts.length) {
    list.innerHTML = '<div class="feed-loading">El feed está vacío. ¡Sé el primero en publicar!</div>';
    return;
  }

  const existingIds = new Set(
    [...list.querySelectorAll('.feed-card[data-id]')].map(el => el.dataset.id)
  );
  const newIds = new Set(posts.map(p => p.id));

  // Eliminar cards que ya no existen
  list.querySelectorAll('.feed-card[data-id]').forEach(el => {
    if (!newIds.has(el.dataset.id)) el.remove();
  });

  // Agregar o actualizar cards
  posts.forEach((p, idx) => {
    let card = list.querySelector(`.feed-card[data-id="${p.id}"]`);
    if (!card) {
      // Card nueva: insertar en posición correcta
      const html = buildFeedCard(p);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      card = tmp.firstElementChild;
      card.dataset.id = p.id;

      // Insertar en posición correcta (posts ya vienen ordenados desc)
      const allCards = [...list.querySelectorAll('.feed-card[data-id]')];
      if (idx === 0 || allCards.length === 0) {
        list.insertAdjacentElement('afterbegin', card);
      } else {
        const before = list.querySelector(`.feed-card[data-id="${posts[idx - 1]?.id}"]`);
        if (before) before.insertAdjacentElement('afterend', card);
        else list.appendChild(card);
      }

      bindFeedCard(card, p.id);
    } else {
      // Card existente: solo actualizar contadores (like y comentarios)
      // sin tocar la sección de comentarios si está abierta
      const likeBtn = card.querySelector('.feed-action-btn[data-like]');
      if (likeBtn) {
        const isLiked = p.likedBy?.includes(currentUser.uid);
        likeBtn.className = `feed-action-btn ${isLiked ? 'liked' : ''}`;
        likeBtn.innerHTML = `<span>${isLiked ? '❤️' : '🤍'}</span> ${p.likes || 0}`;
      }
      const commentToggle = card.querySelector('.feed-comments-toggle');
      if (commentToggle && card.querySelector('.feed-comments-section')?.dataset.open !== '1') {
        const cnt = p.commentCount || 0;
        commentToggle.textContent = `💬 ${cnt > 0 ? cnt + ' comentario' + (cnt > 1 ? 's' : '') : 'Comentar'}`;
      }
    }
  });

  // Si el feed estaba vacío (solo tenía el loading div), limpiarlo
  const loadingEl = list.querySelector('.feed-loading');
  if (loadingEl && list.querySelectorAll('.feed-card[data-id]').length > 0) loadingEl.remove();
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
    const activa = p.activa !== false; // true por defecto
    const totalVotos = Object.values(p.votos || {}).reduce((a, b) => a + b, 0);

    let pollHtml = '';
    // Si ya votó o si la encuesta está cerrada, mostramos resultados
    if (!activa) {
      pollHtml = (p.opciones || []).map((op, i) => {
        const cnt = p.votos?.[i] || 0;
        const pct = totalVotos ? Math.round((cnt / totalVotos) * 100) : 0;
        return `
          <div class="feed-votacion-resultado-bar">
            <div class="feed-votacion-bar-fill" style="width:${pct}%"></div>
            <div class="feed-votacion-bar-text">
              <span>${escHtml(op)}</span>
              <span>${cnt} voto${cnt !== 1 ? 's' : ''} (${pct}%)</span>
            </div>
          </div>
        `;
      }).join('');
      
      pollHtml += `<div style="text-align:center; font-size:12px; color:var(--text2); margin-top:10px;">
        ${!activa ? '🔒 Votación cerrada' : '✅ Tu voto fue registrado'} · ${totalVotos} votos en total
      </div>`;
    } else {
      // Si está activa y no ha votado, mostramos botones
      pollHtml = (p.opciones || []).map((op, i) =>
        `<button class="feed-votacion-opcion" onclick="votarDesdeFeed('${p.votacionId}',${i},'${p.id}')">
          ${escHtml(op)}
        </button>`
      ).join('');
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

  let imgHtml = '';
  if (p.images && p.images.length) {
    if (p.images.length === 1) {
      // Agregamos onclick para el zoom
      imgHtml = `<img src="${escHtml(p.images[0])}" class="feed-card-img" alt="" onclick="openLightboxFeed(this)" style="cursor:pointer;">`;
    } else {
      // Agregamos onclick a cada imagen de la cuadrícula
      imgHtml = `<div class="feed-card-images-grid count-${p.images.length}">` + p.images.map(img =>
        `<img src="${escHtml(img)}" alt="" onclick="openLightboxFeed(this)" style="cursor:pointer;">`
      ).join('') + `</div>`;
    }
  }

  const likeCount = p.likes || 0;
  const commentCount = p.commentCount || 0;
  const isLiked = p.likedBy?.includes(currentUser.uid);

  return `<div class="feed-card" data-id="${p.id}">
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
      <button class="feed-action-btn ${isLiked ? 'liked' : ''}" data-like="${p.id}">
        <span>${isLiked ? '❤️' : '🤍'}</span> ${likeCount}
      </button>
      <button class="feed-comments-toggle" data-post="${p.id}">
        💬 ${commentCount > 0 ? commentCount + ' comentario' + (commentCount > 1 ? 's' : '') : 'Comentar'}
      </button>
      
      ${canDelete ? `<button class="feed-action-btn" style="margin-left:auto" onclick="eliminarPost('${p.id}')"><span>🗑️</span></button>` : ''}
    </div>
    <div class="feed-comments-section" data-open="0" style="display:none">
      <div class="feed-comments-list"></div>
      <div class="feed-comment-compose">
        <img class="feed-comment-avatar" src="${escHtml(currentUser.avatar || '')}" alt="" onerror="this.style.display='none'">
        <input type="text" class="feed-comment-input" placeholder="Escribe un comentario…" maxlength="300">
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
    // Diff incremental: evita parpadeo al re-renderizar toda la lista
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const c = { id: change.doc.id, ...change.doc.data() };
        // Evitar duplicados
        if (list.querySelector(`[data-comment-id="${c.id}"]`)) return;
        const esMio = c.authorUid === currentUser.uid;
        const btnDel = (esMio || isAdmin)
          ? `<button class="comment-del-btn" onclick="eliminarComentario('${c.id}','${postId}')" title="Eliminar">🗑️</button>`
          : '';
        const el = document.createElement('div');
        el.className = 'feed-comment-item';
        el.dataset.commentId = c.id;
        el.innerHTML = `
          <img class="feed-comment-avatar" src="${escHtml(c.authorAvatar || '')}" alt="" onerror="this.style.display='none'">
          <div class="feed-comment-bubble">
            <div class="feed-comment-author">${escHtml(c.authorName || 'Anónimo')}</div>
            <div class="feed-comment-text">${escHtml(c.text)}</div>
            <div class="feed-comment-time">${fmtTime(c.createdAt)} ${btnDel}</div>
          </div>`;
        // Quitar mensaje "Sé el primero"
        const empty = list.querySelector('.comment-empty-msg');
        if (empty) empty.remove();
        list.appendChild(el);
      }
      if (change.type === 'removed') {
        const el = list.querySelector(`[data-comment-id="${change.doc.id}"]`);
        if (el) el.remove();
        if (!list.querySelector('.feed-comment-item')) {
          list.innerHTML = '<div class="comment-empty-msg" style="font-size:12px;color:var(--text3);padding:4px 0">Sé el primero en comentar.</div>';
        }
      }
    });
    // Si está vacío al inicio
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
  } catch (e) { console.error("Error al comentar:", e); }
}

async function toggleFeedLike(postId, btn) {
  const { doc, updateDoc, arrayUnion, arrayRemove, increment } = lib();
  const uid = currentUser.uid;
  const isLiked = btn.classList.contains('liked');
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
  composeFiles = [...e.target.files];
  renderComposePreview();
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
      createdAt: serverTimestamp()
    });
    $('composeInput').value = '';
    composeFiles = [];
    $('composePhoto').value = '';
    renderComposePreview();
  } catch (e) { alert('Error al publicar: ' + e.message); }

  btn.disabled = false;
  btn.textContent = '➤';
});

$('composeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composeSend').click(); }
});

/* ═══════════════════════════════════════════════════
   LÓGICA DEL MURO (PERFIL PROPIO Y DE TERCEROS)
═══════════════════════════════════════════════════ */
let muroActualUid = null;
let muroActualNombre = '';
let muroFotosUnsub = null;
let muroFeedUnsub = null;

// Esta función se activa cuando haces clic en un miembro en la barra lateral
window.verMuroDeUsuario = async function (email, nombre) {
  // Si das clic en tu propio nombre
  if (email === currentUser.email) {
    muroActualUid = currentUser.uid;
    muroActualNombre = currentUser.name || nombre;
    activarSeccion('muro');
    return;
  }

  // Si das clic en el nombre de un compañero, buscamos su ID en la base de datos
  const { collection, query, where, getDocs } = lib();
  try {
    const q = query(collection(db(), 'ec_users'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      alert('Este compañero fue invitado, pero aún no ha iniciado sesión en la app.');
      return;
    }

    // Guardamos los datos del compañero y abrimos la sección del muro
    muroActualUid = snap.docs[0].id;
    muroActualNombre = nombre;
    activarSeccion('muro');
  } catch (e) {
    console.error(e);
    alert('Error al buscar el perfil del usuario.');
  }
};

/* ── ABRIR EL MURO DE UN COMPAÑERO DESDE LA BARRA LATERAL ── */
// Declaramos las variables globales que usa tu initMuro (por si no estaban declaradas arriba)
window.muroViendoUid = null;
window.muroViendoEmail = null;
window.muroViendoNombre = null;

window.verMuroDeUsuario = async function (email, nombre) {
  // 1. Si das clic en tu propio nombre, limpiamos las variables para ver tu muro
  if (email === currentUser.email) {
    muroViendoUid = null;
    muroViendoEmail = null;
    muroViendoNombre = null;
    activarSeccion('muro');
    return;
  }

  // 2. Si es un compañero, buscamos su ID en la base de datos
  const { collection, query, where, getDocs } = lib();
  try {
    const q = query(collection(db(), 'ec_users'), where('email', '==', email));
    const snap = await getDocs(q);

    // 3. Si el usuario fue invitado pero no ha iniciado sesión, usamos tu lógica de '__pending__'
    if (snap.empty) {
      muroViendoUid = '__pending__';
      muroViendoEmail = email;
      muroViendoNombre = nombre;
      activarSeccion('muro');
      return;
    }

    // 4. Si el compañero sí existe, llenamos tus variables y abrimos la sección
    muroViendoUid = snap.docs[0].id;
    muroViendoEmail = email;
    muroViendoNombre = nombre;
    activarSeccion('muro');

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

  // --- SOLUCIÓN: Forzar que siempre se abra en la pestaña de "Fotos" ---
  qsa('.muro-tab').forEach(t => t.classList.remove('active'));
  const tabFotos = document.querySelector('.muro-tab[data-tab="fotos"]');
  if (tabFotos) tabFotos.classList.add('active');
  const content = $('muroContent');
  if (content) content.innerHTML = `<div class="muro-photos-grid" id="muroFotosGrid"></div>`;
  // ---------------------------------------------------------------------

  cargarMuroFotos(uid, esPropio);
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

  onSnapshot(q, snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    lightboxPhotos = fotos;

    if (!fotos.length) {
      grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1;padding:30px">
        ${prop ? 'No has subido fotos todavía.' : 'Este miembro aún no tiene fotos.'}<br>
        ${prop ? '<span style="font-size:12px;color:var(--text3)">Usa el botón "+ Foto" para subir al muro.</span>' : ''}
      </div>`;
      return;
    }

    grid.innerHTML = fotos.map((f, i) => {
      // Si estamos en nuestro propio muro, SIEMPRE podemos eliminar nuestras fotos.
      // Si es un muro ajeno, solo el admin puede eliminar.
      const canDelFoto = prop || f.authorUid === currentUser.uid || isAdmin;
      const btnDelFoto = canDelFoto
        ? `<button class="muro-photo-del" onclick="event.stopPropagation(); eliminarFotoMuro('${f.id}')" title="Eliminar foto">🗑️</button>`
        : '';
      return `<div class="muro-photo-thumb" onclick="openLightbox(${i})">
        <img src="${escHtml(f.url)}" loading="lazy" alt="">
        ${btnDelFoto}
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

// Subir foto al muro (solo muro propio)
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
      // Guardar en ec_muro_fotos
      const muroRef = await addDoc(collection(db(), 'ec_muro_fotos'), {
        url,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        groupId: currentGroupId,
        createdAt: serverTimestamp()
      });
      // Publicar en el feed del grupo con likes y comentarios
      await addDoc(collection(db(), 'ec_feed'), {
        groupId: currentGroupId,
        type: 'foto',
        muroFotoId: muroRef.id,   // referencia para poder eliminar del muro tb
        text: '',
        images: [url],
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        likes: 0, likedBy: [], commentCount: 0,
        createdAt: serverTimestamp()
      });
    }
  }
  $('btnMuroSubir').disabled = false;
  $('btnMuroSubir').textContent = '+ Foto';
  $('muroFileInput').value = '';
  initMuro();
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
  onSnapshot(q, snap => {
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    if (!posts.length) {
      list.innerHTML = `<div class="feed-loading">${esPropio ? 'Aún no tienes publicaciones en este grupo.' : 'Este miembro aún no tiene publicaciones.'}</div>`;
      return;
    }

    const newIds = new Set(posts.map(p => p.id));

    // Eliminar cards que ya no existen
    list.querySelectorAll('.feed-card[data-id]').forEach(el => {
      if (!newIds.has(el.dataset.id)) el.remove();
    });

    // Limpiar loading si existe
    const loadingEl = list.querySelector('.feed-loading');

    posts.forEach((p, idx) => {
      let card = list.querySelector(`.feed-card[data-id="${p.id}"]`);
      if (!card) {
        // Card nueva: crear e insertar en posición correcta
        const tmp = document.createElement('div');
        tmp.innerHTML = buildFeedCard(p);
        card = tmp.firstElementChild;

        const allCards = [...list.querySelectorAll('.feed-card[data-id]')];
        if (idx === 0 || allCards.length === 0) {
          list.insertAdjacentElement('afterbegin', card);
        } else {
          const before = list.querySelector(`.feed-card[data-id="${posts[idx - 1]?.id}"]`);
          if (before) before.insertAdjacentElement('afterend', card);
          else list.appendChild(card);
        }

        bindFeedCard(card, p.id);
      } else {
        // Card existente: solo actualizar contadores sin tocar la sección de comentarios
        const likeBtn = card.querySelector('.feed-action-btn[data-like]');
        if (likeBtn) {
          const isLiked = p.likedBy?.includes(currentUser.uid);
          likeBtn.className = `feed-action-btn ${isLiked ? 'liked' : ''}`;
          likeBtn.innerHTML = `<span>${isLiked ? '❤️' : '🤍'}</span> ${p.likes || 0}`;
        }
        const commentToggle = card.querySelector('.feed-comments-toggle');
        if (commentToggle && card.querySelector('.feed-comments-section')?.dataset.open !== '1') {
          const cnt = p.commentCount || 0;
          commentToggle.textContent = `💬 ${cnt > 0 ? cnt + ' comentario' + (cnt > 1 ? 's' : '') : 'Comentar'}`;
        }
      }
    });

    if (loadingEl) loadingEl.remove();
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

function initChat() {
  if (!currentGroupId) return;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  const box = $('chatMessages');
  box.innerHTML = '<div class="feed-loading" id="chatLoading">Conectando…</div>';
  lastChatDateStr = '';

  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc'),
    limit(100)
  );

  let isFirst = true;

  // includeMetadataChanges: true es VITAL para ver lo que escribes al segundo
  chatUnsub = onSnapshot(q, { includeMetadataChanges: true }, snap => {
    const loading = $('chatLoading');
    if (loading) loading.remove();

    if (isFirst) {
      isFirst = false;
      box.innerHTML = '';
      snap.docs.forEach(d => {
        appendChatMessageObj({ id: d.id, ...d.data() }, box);
      });
      box.scrollTop = box.scrollHeight;
    } else {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = { id: change.doc.id, ...change.doc.data() };
          if (box.querySelector(`.chat-msg[data-id="${m.id}"]`)) return;

          appendChatMessageObj(m, box);
          
          if (m.authorUid === currentUser.uid || (box.scrollHeight - box.scrollTop - box.clientHeight < 200)) {
            box.scrollTop = box.scrollHeight;
          }
        }
      });
    }
  }, err => {
    console.error("Error en Chat:", err);
    // Si el error es por falta de índice, verás un link en la consola (F12)
    if (err.code === 'failed-precondition') {
      box.innerHTML = '<div class="feed-loading" style="color:var(--amber);">⚠️ Falta crear un índice en Firestore. Revisa la consola F12.</div>';
    }
  });
}

function appendChatMessageObj(m, box) {
  const mine = m.authorUid === currentUser?.uid;
  
  // Si no hay fecha (mensaje enviándose), usamos la hora actual de la PC
  const rawDate = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : new Date();
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
        ${fmtTimeChat(m.createdAt)}
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

  // 1. Limpiamos el input
  input.value = '';
  // 2. 🔥 Disparamos un evento 'input' simulado para que la caja regrese 
  // a su tamaño normal suavemente usando su propia lógica.
  input.dispatchEvent(new Event('input'));

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
  } catch (e) {
    console.error("Error al enviar:", e);
    alert("No se pudo enviar el mensaje.");
  }
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
    if (!url) { alert('No se pudo subir la imagen.'); return; }

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
    console.error('Error enviando imagen al chat:', err);
    alert('Error al enviar imagen.');
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

  // SOLUCIÓN: Quitamos la línea que forzaba tareasVistaCalendario a false.
  // Solo reseteamos el mes si NO estamos viendo el calendario.
  if (!tareasVistaCalendario) {
    calMesOffset = 0;
  }

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
    if (tareasVistaCalendario) {
      const hoy = new Date();
      renderCalMes(tareas, hoy.getFullYear() + Math.floor((hoy.getMonth() + calMesOffset) / 12),
        ((hoy.getMonth() + calMesOffset) % 12 + 12) % 12);
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
  // Actualizar renderCalendarioTareas con el mes correcto
  const container = $('tareasList');
  const hoy = new Date();
  const tareasPorDia = {};
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
  let html = `<div class="cal-header">
    <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
    <span class="cal-mes-label">${nombresMes[mes]} ${año}</span>
    <button class="cal-nav" onclick="calNavegar(1)">›</button>
  </div><div class="cal-grid">
    ${nombresDia.map(d => `<div class="cal-dia-header">${d}</div>`).join('')}`;
  for (let i = 0; i < primerDia; i++) html += `<div class="cal-dia vacio"></div>`;
  for (let dia = 1; dia <= diasMes; dia++) {
    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
    const tsDia = tareasPorDia[String(dia)] || [];
    html += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tsDia.length ? 'tiene-tarea' : ''}"
      onclick="calVerDia(${dia},${mes},${año})">
      <span class="cal-num">${dia}</span>
      ${tsDia.length ? `<span class="cal-punto">${tsDia.length}</span>` : ''}
    </div>`;
  }
  html += `</div>`;
  const proximas = tareas.filter(t => t.fecha && !t.done).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 8);
  if (proximas.length) {
    html += `<div class="cal-proximas-label">📋 Próximas tareas</div>`;
    html += proximas.map(t => {
      const d = new Date(t.fecha);
      const dr = Math.ceil((d - hoy) / 86400000);
      const u = dr <= 2 && dr >= 0; const v = dr < 0;
      return `<div class="cal-tarea-item ${u ? 'urgente' : ''} ${v ? 'vencida-cal' : ''}">
        <div class="cal-tarea-fecha">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          <span class="cal-dias-rest">${v ? '⚠️ Vencida' : dr === 0 ? '¡Hoy!' : `en ${dr}d`}</span>
        </div>
        <div class="cal-tarea-titulo">${escHtml(t.titulo)}</div>
        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
      </div>`;
    }).join('');
  }
  container.innerHTML = html;
}

window.calVerDia = function (dia, mes, año) {
  // Resaltar día seleccionado (visual)
  document.querySelectorAll('.cal-dia').forEach(el => el.classList.remove('selected'));
  // Buscar el día clickeado y resaltarlo
  const num = parseInt(dia);
  document.querySelectorAll('.cal-num').forEach(el => {
    if (parseInt(el.textContent) === num) el.closest('.cal-dia')?.classList.add('selected');
  });
};

window.toggleTarea = async function (id, done) {
  const { doc, updateDoc } = lib();
  await updateDoc(doc(db(), 'ec_tareas', id), { done });
};

// SOLUCIÓN: Solo el administrador puede borrar tareas ahora
window.eliminarTarea = async function (id) {
  if (!isAdmin) {
    alert("Acceso denegado: Solo el administrador del grupo puede eliminar tareas.");
    return;
  }
  if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
  const { doc, deleteDoc } = lib();
  try {
    await deleteDoc(doc(db(), 'ec_tareas', id));
  } catch (e) { alert("Error: " + e.message); }
};

qsa('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tareasFilter = btn.dataset.filter;
    tareasVistaCalendario = false;
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('btnCalendarioTareas')?.classList.remove('active');
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
    initTareas();
  });
});

$('btnCalendarioTareas')?.addEventListener('click', () => {
  tareasVistaCalendario = !tareasVistaCalendario;
  $('btnCalendarioTareas').classList.toggle('active', tareasVistaCalendario);
  // Quitar filtros activos
  if (tareasVistaCalendario) {
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    $('tareasList').innerHTML = '<div class="feed-loading">Cargando calendario…</div>';
  } else {
    qsa('.filter-btn')[0]?.classList.add('active');
  }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  initTareas();
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
    ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaMateria'].forEach(id => $(id).value = '');
  } catch (e) { alert('Error: ' + e.message); }
});

/* ═══════════════════════════════════════════════════
   APUNTES
═══════════════════════════════════════════════════ */
let semestresUnsub = null;
let galeriasUnsub = null;

function initApuntes() {
  // Mostrar/ocultar toolbar de admin
  const toolbar = document.querySelector('.apuntes-toolbar');
  if (toolbar) toolbar.style.display = isAdmin ? 'flex' : 'none';
  loadSemestres();
  setupApunteUpload();
}

function loadSemestres() {
  // Cancelar listener anterior para evitar duplicados
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }

  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_semestres'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc')
  );
  semestresUnsub = onSnapshot(q, snap => {
    semestres = [];
    snap.forEach(d => semestres.push({ id: d.id, ...d.data() }));
    loadGalerias();
  });
}

function loadGalerias() {
  // Cancelar listener anterior para evitar duplicados
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }

  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_galerias'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc')
  );
  galeriasUnsub = onSnapshot(q, snap => {
    galerias = [];
    snap.forEach(d => galerias.push({ id: d.id, ...d.data() }));
    renderSemestres();
  });
}

/* Paleta de colores PASTEL para semestres */
const SEM_COLORS = [
  ['#c4b5fd', '#a78bfa'], ['#fda4af', '#fb7185'], ['#6ee7b7', '#34d399'],
  ['#fde68a', '#fcd34d'], ['#bae6fd', '#7dd3fc'], ['#fed7aa', '#fdba74'],
  ['#a5f3fc', '#67e8f9'], ['#d9f99d', '#bef264'], ['#fecaca', '#fca5a5'],
  ['#c7d2fe', '#a5b4fc'], ['#f5d0fe', '#e879f9'], ['#bbf7d0', '#86efac'],
];

const SEM_PASTEL_PALETTE = [
  { label: 'Lila', c1: '#c4b5fd', c2: '#a78bfa', text: '#4c1d95' },
  { label: 'Rosa', c1: '#fda4af', c2: '#fb7185', text: '#881337' },
  { label: 'Menta', c1: '#6ee7b7', c2: '#34d399', text: '#064e3b' },
  { label: 'Amarillo', c1: '#fde68a', c2: '#fcd34d', text: '#78350f' },
  { label: 'Cielo', c1: '#bae6fd', c2: '#7dd3fc', text: '#0c4a6e' },
  { label: 'Durazno', c1: '#fed7aa', c2: '#fdba74', text: '#7c2d12' },
  { label: 'Aqua', c1: '#a5f3fc', c2: '#67e8f9', text: '#164e63' },
  { label: 'Lima', c1: '#d9f99d', c2: '#bef264', text: '#365314' },
  { label: 'Coral', c1: '#fecaca', c2: '#fca5a5', text: '#7f1d1d' },
  { label: 'Indigo', c1: '#c7d2fe', c2: '#a5b4fc', text: '#312e81' },
  { label: 'Malva', c1: '#f5d0fe', c2: '#e879f9', text: '#581c87' },
  { label: 'Esmeralda', c1: '#bbf7d0', c2: '#86efac', text: '#14532d' },
  { label: 'Tiza', c1: '#e2e8f0', c2: '#cbd5e1', text: '#1e293b' },
  { label: 'Lavanda', c1: '#ede9fe', c2: '#ddd6fe', text: '#4c1d95' },
  { label: 'Salmón', c1: '#ffe4e6', c2: '#fecdd3', text: '#9f1239' },
];

function renderSemestres() {
  const container = $('apuntesGroupsContainer');
  if (!semestres.length) {
    container.innerHTML = isAdmin
      ? `<div class="sem-empty"><div class="sem-empty-icon">📚</div><p>Aún no hay semestres.<br>Crea el primero con <strong>"+ Semestre"</strong>.</p></div>`
      : `<div class="sem-empty"><div class="sem-empty-icon">📚</div><p>Aún no hay semestres en este grupo.</p></div>`;
    return;
  }
  container.innerHTML = semestres.map((sem, idx) => {
    const mats = galerias.filter(g => g.semestreId === sem.id);
    // Use stored color or fallback to palette by index
    let c1, c2, textColor;
    if (sem.color) {
      const found = SEM_PASTEL_PALETTE.find(p => p.c1 === sem.color);
      c1 = sem.color; c2 = found ? found.c2 : sem.color; textColor = found ? found.text : '#1e293b';
    } else {
      const pal = SEM_PASTEL_PALETTE[idx % SEM_PASTEL_PALETTE.length];
      c1 = pal.c1; c2 = pal.c2; textColor = pal.text;
    }
    const btnDelSem = isAdmin
      ? `<button class="sem-del-btn" onclick="event.stopPropagation(); eliminarSemestre('${sem.id}','${escHtml(sem.name)}')" title="Eliminar semestre">🗑️</button>`
      : '';
    const addMatBtn = isAdmin
      ? `<div class="materia-card2 materia-card-add" onclick="openNewMateriaModal('${sem.id}')">
           <div class="materia-card2-icon">➕</div>
           <div class="materia-card2-name">Nueva materia</div>
         </div>`
      : '';

    return `<div class="semestre-group2" id="sem-${sem.id}">
      <div class="semestre-banner" style="background:linear-gradient(135deg,${c1},${c2})" onclick="toggleSemestre('${sem.id}')">
        <div class="semestre-banner-left">
          <span class="semestre-banner-icon">${escHtml(sem.icon || '📅')}</span>
          <div class="semestre-banner-info">
            <span class="semestre-banner-name" style="color:${textColor}">${escHtml(sem.name)}</span>
            <span class="semestre-banner-count" style="color:${textColor}99">${mats.length} materia${mats.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="semestre-banner-right">
          ${btnDelSem}
          <span class="semestre-toggle2" style="color:${textColor}">›</span>
        </div>
      </div>
      <div class="materias-grid2" style="display:none">
        ${mats.map(m => buildMateriaCard(m, c1, c2, textColor)).join('')}
        ${addMatBtn}
      </div>
    </div>`;
  }).join('');
}

window.toggleSemestre = function (id) {
  const grup = $('sem-' + id);
  const grid = grup?.querySelector('.materias-grid2');
  const tog = grup?.querySelector('.semestre-toggle2');
  if (!grid) return;
  const open = grid.style.display !== 'none';
  grid.style.display = open ? 'none' : 'grid';
  if (tog) tog.style.transform = open ? '' : 'rotate(90deg)';
  grup.classList.toggle('open', !open);
};

function buildMateriaCard(m, accentColor, accentColor2, textColor) {
  const btnDelMat = isAdmin
    ? `<button class="materia-del-btn" onclick="event.stopPropagation(); eliminarMateria('${m.id}','${escHtml(m.name)}')" title="Eliminar materia">✕</button>`
    : '';
  const c1 = accentColor || 'var(--accent)';
  const c2 = accentColor2 || accentColor || 'var(--accent)';
  const txt = textColor || '#1e293b';
  const tag = (m.name || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  return `<div class="materia-card2" onclick="abrirGaleria('${m.id}')" style="--mat-c1:${c1};--mat-c2:${c2};--mat-txt:${txt}">
    ${btnDelMat}
    <div class="materia-card2-header">
      ${m.coverImage ? `<img class="materia-card2-cover" src="${escHtml(m.coverImage)}" alt="">` : ''}
      <div class="materia-card2-icon">${escHtml(m.icon || '📚')}</div>
    </div>
    <div class="materia-card2-body">
      <div class="materia-card2-name">${escHtml(m.name)}</div>
      <div class="materia-card2-tag">#${tag}</div>
      <div class="materia-card2-footer">
        <span class="materia-card2-count">${m.fotosCount || 0} fotos</span>
      </div>
      <div class="materia-card2-actions" onclick="event.stopPropagation()">
        <button class="materia-btn-abrir" onclick="abrirGaleria('${m.id}')">Abrir</button>
        <button class="materia-btn-notas" onclick="abrirNotas('${m.id}')">Notas</button>
      </div>
    </div>
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
  const { collection, query, where, onSnapshot } = lib();
  // ✅ Solo where sin orderBy → no requiere índice compuesto en Firestore
  // El orden se hace en cliente para que todos los miembros puedan verlas
  const q = query(
    collection(db(), 'ec_fotos'),
    where('galeriaId', '==', galeriaActual.id)
  );
  const grid = $('apuntesGrid');
  grid.innerHTML = '<div class="feed-loading">Cargando fotos…</div>';
  onSnapshot(q, snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    // Ordenar por fecha descendente en el cliente
    fotos.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    renderFotosGaleria(fotos);
  }, err => {
    console.error('Error cargando fotos galería:', err);
    grid.innerHTML = '<div class="feed-loading">Error al cargar fotos. Revisa tu conexión.</div>';
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

    const btnPublicar = puedeActuar
      ? `<button class="foto-publish-btn ${f.publishedToFeed ? 'published' : ''}"
           title="${f.publishedToFeed ? 'Ya publicada en Novedades' : 'Publicar en Novedades'}"
           onclick="event.stopPropagation(); publicarFotoEnFeed('${escHtml(f.id)}')">
           ${f.publishedToFeed ? '✅' : '📢'}
         </button>`
      : (f.publishedToFeed
        ? `<span class="foto-published-badge" title="Publicada en Novedades">✅</span>`
        : '');

    const btnEliminar = puedeActuar
      ? `<button class="foto-del-btn"
           title="Eliminar foto"
           onclick="event.stopPropagation(); eliminarFotoApunte('${escHtml(f.id)}')">🗑️</button>`
      : '';

    const autorLabel = f.authorName
      ? `<span class="foto-autor-label">📷 ${escHtml(f.authorName)}</span>`
      : '';

    return `<div class="photo-thumb" data-foto-id="${escHtml(f.id)}">
      <img src="${escHtml(f.url)}" loading="lazy" alt="" onclick="openLightbox(${i})">
      <div class="photo-thumb-overlay" onclick="openLightbox(${i})">
        ${autorLabel}
        <span class="photo-thumb-caption">${escHtml(f.caption || '')}</span>
      </div>
      ${btnPublicar}
      ${btnEliminar}
    </div>`;
  }).join('');
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
  const onChange = e => {
    apunteFiles = [...e.target.files];
    renderApuntePreview();
    $('btnApunteSend').disabled = !apunteFiles.length;
  };
  $('apunteFileInput').addEventListener('change', onChange);
  $('apunteCameraInput').addEventListener('change', onChange);

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
          url, caption,
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          publishedToFeed: false,   // ← NO se publica automáticamente
          createdAt: serverTimestamp()
        });
        // ✋ Ya NO se crea publicación en ec_feed aquí
      }
      done++;
      $('apunteProgressBar').style.width = `${Math.round(done / apunteFiles.length * 100)}%`;
    }
    apunteFiles = [];
    $('apuntePreviewList').innerHTML = '';
    $('apunteCaption').value = '';
    $('btnApunteSend').disabled = true;
    setTimeout(() => {
      $('apunteProgress').style.display = 'none';
      $('apunteProgressBar').style.width = '0%';
    }, 800);
  });
}

function renderApuntePreview() {
  $('apuntePreviewList').innerHTML = apunteFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    // Le metemos el CSS directo al HTML para que la caché no nos estorbe
    return `<div class="upload-preview-item" onclick="openLightboxPrevia(${i})" 
              style="width: 85px; height: 85px; border-radius: 8px; overflow: hidden; border: 2px solid transparent; cursor: zoom-in; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            </div>`;
  }).join('');
}

// Nueva función que conecta las fotos seleccionadas con tu Lightbox
window.openLightboxPrevia = function (idx) {
  // Convertimos los archivos locales a un formato que el visor entienda
  lightboxPhotos = apunteFiles.map(f => ({
    url: URL.createObjectURL(f),
    caption: f.name
  }));
  lightboxIdx = idx;
  updateLightbox();

  // Mostramos el visor y nos aseguramos de que las flechas de navegación funcionen
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
  // Inicializar preview con el primer color
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
  // Sin opción "Sin semestre" — siempre debe elegirse uno
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

/* ══════════════════════════════════════════════════════
   PUBLICAR FOTO DE APUNTES EN EL FEED
   Agrupa todas las fotos de la misma materia publicadas
   el mismo día en UNA SOLA publicación del feed.
══════════════════════════════════════════════════════ */

/* ── Eliminar foto de apuntes (solo autor o admin) ── */
window.eliminarFotoApunte = async function (fotoId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  const { doc, deleteDoc } = lib();
  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-del-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await deleteDoc(doc(db(), 'ec_fotos', fotoId));
    // El onSnapshot actualiza la galería automáticamente
  } catch (e) {
    console.error('eliminarFotoApunte:', e);
    alert('Error al eliminar: ' + e.message);
    if (btn) { btn.textContent = '🗑️'; btn.disabled = false; }
  }
};

window.publicarFotoEnFeed = async function (fotoId) {
  const foto = (lightboxPhotos || []).find(f => f.id === fotoId);
  if (!foto || !galeriaActual) return;

  // Botón feedback
  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-publish-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  const {
    collection, query, where, getDocs, addDoc,
    doc, updateDoc, arrayUnion, serverTimestamp, Timestamp
  } = lib();

  try {
    // Rango del día de hoy (medianoche → medianoche)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

    // Buscar si ya existe una publicación de feed de ESTA materia HOY
    const feedQ = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('galeriaId', '==', galeriaActual.id),
      where('type', '==', 'apunte'),
      where('createdAt', '>=', Timestamp.fromDate(hoy)),
      where('createdAt', '<', Timestamp.fromDate(manana))
    );
    const feedSnap = await getDocs(feedQ);

    if (!feedSnap.empty) {
      // ✅ Ya hay una publicación de hoy para esta materia → agregar la foto
      const feedDoc = feedSnap.docs[0];
      await updateDoc(doc(db(), 'ec_feed', feedDoc.id), {
        images: arrayUnion(foto.url)
      });
    } else {
      // 🆕 No existe → crear nueva publicación agrupadora
      const gal = galeriaActual;
      const sem = semestres.find(s => s.id === gal.semestreId);
      const semNombre = sem ? sem.name : '';
      await addDoc(collection(db(), 'ec_feed'), {
        groupId: currentGroupId,
        galeriaId: gal.id,                           // clave para agrupar
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

    // Marcar la foto como publicada en Firestore
    await updateDoc(doc(db(), 'ec_fotos', fotoId), { publishedToFeed: true });

    // Actualizar UI del botón
    if (btn) { btn.textContent = '✅'; btn.classList.add('published'); btn.disabled = false; btn.title = 'Ya publicada en Novedades'; }

  } catch (e) {
    console.error('publicarFotoEnFeed:', e);
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
      groupId: currentGroupId, pregunta, opciones, votos: {}, votantes: [],
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
  const totalVotos = Object.values(v.votos || {}).reduce((a, b) => a + b, 0);

  // Recuperar el índice del voto anterior desde localStorage
  const storageKey = `ze_prev_vote_${currentUser?.uid}_${v.id}`;
  const votoAnteriorIdx = localStorage.getItem(storageKey);

  // Siempre mostrar los botones de opciones (para votar o cambiar voto)
  $('votacionOpciones').innerHTML = v.opciones.map((op, i) => {
    const esMiVoto = yaVoto && votoAnteriorIdx !== null && parseInt(votoAnteriorIdx) === i;
    const claseExtra = esMiVoto ? ' votacion-opcion-seleccionada' : '';
    const icono = esMiVoto ? ' ✔' : '';
    return `<button class="votacion-opcion-btn${claseExtra}" onclick="votar('${v.id}',${i},'${escHtml(op)}')">${escHtml(op)}${icono}</button>`;
  }).join('');

  // Texto de ayuda según estado
  const ayudaEl = $('votacionAyuda');
  if (ayudaEl) {
    ayudaEl.textContent = yaVoto ? '✔ Ya votaste — puedes cambiar tu voto tocando otra opción.' : 'Selecciona una opción para votar.';
  }

  $('votacionResultados').innerHTML = v.opciones.map((op, i) => {
    const cnt = v.votos?.[i] || 0;
    const pct = totalVotos ? Math.round(cnt / totalVotos * 100) : 0;
    const esMiVoto = yaVoto && votoAnteriorIdx !== null && parseInt(votoAnteriorIdx) === i;
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

    const storageKey = `ze_prev_vote_${currentUser.uid}_${votacionId}`;
    const votoAnterior = localStorage.getItem(storageKey);

    if (votoAnterior !== null) {
      if (parseInt(votoAnterior) === opcionIdx) { alert('Ya votaste por esta opción.'); return; }
      if (!confirm('¿Quieres cambiar tu voto?')) return;
      // Restar 1 a la opción anterior
      const dec = { [`votos.${votoAnterior}`]: increment(-1) };
      await updateDoc(doc(db(), 'ec_votaciones', votacionId), dec);
      const feedSnap = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', votacionId)));
      if (!feedSnap.empty) await updateDoc(doc(db(), 'ec_feed', feedSnap.docs[0].id), dec);
    } else if (vData.votantes?.includes(currentUser.uid)) {
      if (!confirm('Ya habías votado antes. ¿Quieres cambiar tu voto?')) return;
    }

    // Sumar 1 a la opción nueva
    const inc = { [`votos.${opcionIdx}`]: increment(1), votantes: arrayUnion(currentUser.uid) };
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), inc);
    const feedSnap2 = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', votacionId)));
    if (!feedSnap2.empty) await updateDoc(doc(db(), 'ec_feed', feedSnap2.docs[0].id), inc);

    localStorage.setItem(storageKey, opcionIdx);
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

    const storageKey = `ze_prev_vote_${currentUser.uid}_${votacionId}`;
    const votoAnterior = localStorage.getItem(storageKey);

    // Si ya había votado antes en esta misma sesión/navegador
    if (votoAnterior !== null) {
      if (parseInt(votoAnterior) === opcionIdx) { alert('Ya votaste por esta opción.'); return; }
      if (!confirm('¿Quieres cambiar tu voto anterior?')) return;
      
      // Restamos 1 a la opción vieja
      const dec = { [`votos.${votoAnterior}`]: increment(-1) };
      await updateDoc(doc(db(), 'ec_votaciones', votacionId), dec);
      if (feedPostId) await updateDoc(doc(db(), 'ec_feed', feedPostId), dec);
    } else if (data.votantes?.includes(currentUser.uid)) {
      // Si ya votó pero no tenemos el índice en local, simplemente sumamos el nuevo
      if (!confirm('Ya habías votado. ¿Quieres sumar este nuevo voto?')) return;
    }

    // Sumamos 1 a la nueva opción
    const inc = { 
      [`votos.${opcionIdx}`]: increment(1),
      votantes: arrayUnion(currentUser.uid)
    };
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), inc);
    if (feedPostId) await updateDoc(doc(db(), 'ec_feed', feedPostId), inc);
    
    localStorage.setItem(storageKey, opcionIdx);
    alert('✅ Voto registrado con éxito.');
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
    const { collection, addDoc } = lib();
    try {
      await addDoc(collection(db(), 'ec_chat'), {
        groupId: currentGroupId,
        text,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        createdAt: new Date()
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
  const q = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'asc'),
    limit(60)
  );

  let isFirst = true;
  chatBurbujaUnsub = onSnapshot(q, { includeMetadataChanges: true }, snap => {
    const msgBox = $('chatBurbujaMsgs');
    if (!msgBox) return;

    if (isFirst) {
      msgBox.innerHTML = '';
      snap.docs.forEach(d => appendBurbujaMsg({ id: d.id, ...d.data() }, msgBox));
      msgBox.scrollTop = msgBox.scrollHeight;
      isFirst = false;
    } else {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added') {
          const m = { id: ch.doc.id, ...ch.doc.data() };
          if (msgBox.querySelector(`[data-id="${m.id}"]`)) return;

          const loading = msgBox.querySelector('.chat-burbuja-loading');
          if (loading) loading.remove();

          appendBurbujaMsg(m, msgBox);
          
          if (msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 100 || m.authorUid === currentUser.uid) {
            msgBox.scrollTop = msgBox.scrollHeight;
          }
        }
      });
    }
  });
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

// Reconectar burbuja y activar Notificaciones Globales
let globalNotifUnsub = null;
let _lastNotifMsgId = null;

function hookBurbujaEnGrupo() {
  if (globalNotifUnsub) { globalNotifUnsub(); globalNotifUnsub = null; }
  _lastNotifMsgId = null;
  if (!currentGroupId) return;

  const { collection, query, where, onSnapshot, orderBy, limit } = lib();
  const q = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  let isFirstNotif = true;
  globalNotifUnsub = onSnapshot(q, snap => {
    if (snap.empty) return;
    const latest = snap.docs[0];

    // Ignorar el primer snapshot (carga inicial)
    if (isFirstNotif) {
      isFirstNotif = false;
      _lastNotifMsgId = latest.id;
      return;
    }

    // Solo actuar si es un mensaje realmente nuevo
    if (latest.id === _lastNotifMsgId) return;
    _lastNotifMsgId = latest.id;

    const panel = $('chatBurbujaPanel');
    const panelAbierto = panel && panel.classList.contains('open');
    const seccionChatActiva = (currentSection === 'chat');
    const data = latest.data();
    const esMio = data.authorUid === currentUser?.uid;

    if (!panelAbierto && !seccionChatActiva && !esMio) {
      // Incrementar badge del FAB (usa el elemento chatFabBadge del HTML)
      incrementBurbujaUnread();

      // Notificación del sistema si la pestaña está en segundo plano
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`💬 ${data.authorName || 'Compañero'}`, {
          body: data.imageUrl ? '📷 Imagen' : (data.text || ''),
          icon: './icons/icon.png',
          tag: 'ze-chat-msg'
        });
      }
    }
  });
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