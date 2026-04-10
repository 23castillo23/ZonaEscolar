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
      // Actualizaciones en tiempo real: actualizar datos PRIMERO, luego renderizar
      if (currentGroupId) {
        const grupoActual = grupos.find(g => g.id === currentGroupId);
        if (grupoActual) {
          currentGroupData = grupoActual; // ← datos frescos antes de renderizar
          // Verificar si el usuario actual sigue siendo miembro
          const sigueEnGrupo = grupoActual.miembros?.includes(currentUser.email);
          if (!sigueEnGrupo) {
            _manejarExpulsion();
            return;
          }
        } else {
          // El grupo ya no aparece en la query (usuario fue removido del array miembros)
          _manejarExpulsion();
          return;
        }
      }
      // Renderizar con los datos ya actualizados
      renderGroupSelector();
      renderSidebarMiembros();
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
 // Cancelar TODOS los listeners activos antes de cambiar de grupo
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  if (salasUnsub) { salasUnsub(); salasUnsub = null; }
  if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  if (votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }
  if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
  if (tablerosUnsub) { tablerosUnsub(); tablerosUnsub = null; }
  if (tableroFeedUnsub) { tableroFeedUnsub(); tableroFeedUnsub = null; }
  currentTableroId = null;
  if (sidebarOnlineUnsub) { sidebarOnlineUnsub(); sidebarOnlineUnsub = null; }
  if (catBiblioUnsub) { catBiblioUnsub(); catBiblioUnsub = null; }
  if (dvdUnsub) { dvdUnsub(); dvdUnsub = null; }
  if (muroFeedUnsub) { muroFeedUnsub(); muroFeedUnsub = null; }
  if (muroFotosUnsub) { muroFotosUnsub(); muroFotosUnsub = null; }
  if (muroAlbumsUnsub) { muroAlbumsUnsub(); muroAlbumsUnsub = null; }
  muroAlbumActualId = null;
  muroAlbumsCache = [];
  if (window._apuntesFotosUnsub) { window._apuntesFotosUnsub(); window._apuntesFotosUnsub = null; }
  if (_onlineHeartbeatTimer) { clearInterval(_onlineHeartbeatTimer); _onlineHeartbeatTimer = null; }
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

/* ── Manejar cuando el usuario actual es expulsado en tiempo real ── */
function _manejarExpulsion() {
  // Cancelar todos los listeners activos
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  if (salasUnsub) { salasUnsub(); salasUnsub = null; }
  if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  if (votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }
  if (tablerosUnsub) { tablerosUnsub(); tablerosUnsub = null; }
  if (dvdUnsub) { dvdUnsub(); dvdUnsub = null; }
  if (muroFeedUnsub) { muroFeedUnsub(); muroFeedUnsub = null; }
  if (muroFotosUnsub) { muroFotosUnsub(); muroFotosUnsub = null; }
  if (muroAlbumsUnsub) { muroAlbumsUnsub(); muroAlbumsUnsub = null; }
  if (sidebarOnlineUnsub) { sidebarOnlineUnsub(); sidebarOnlineUnsub = null; }
  if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
  if (_onlineHeartbeatTimer) { clearInterval(_onlineHeartbeatTimer); _onlineHeartbeatTimer = null; }

  // Cerrar cualquier modal abierto
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  const commentsModal = document.getElementById('comments-modal-overlay');
  if (commentsModal) commentsModal.classList.remove('active');

  // Limpiar estado del grupo
  const nombreGrupo = currentGroupData?.name || 'el grupo';
  currentGroupId = null;
  currentGroupData = null;
  isAdmin = false;

  // Ocultar nav y FAB
  const fab = $('chatFab');
  if (fab) fab.style.display = 'none';

  // Mostrar toast y pantalla de expulsado
  showToast(`Has sido removido de "${nombreGrupo}".`, 'info');
  showSection('expulsado');
  setActiveNav('');

  // Actualizar selector (el grupo ya no aparecerá)
  renderGroupSelector();
}

window.expulsarMiembro = async function (emailExpulsado) {
  showConfirm({
    title: 'Expulsar integrante',
    message: `¿Estás seguro de expulsar a ${emailExpulsado} del grupo? Se le quitará el acceso.`,
    confirmText: 'Expulsar',
    onConfirm: async () => {
  const { doc, updateDoc, arrayRemove } = lib();
  try {
    await updateDoc(doc(db(), 'ec_grupos', currentGroupId), {
      miembros: arrayRemove(emailExpulsado)
    });
    showToast(`El usuario ${emailExpulsado} ha sido expulsado.`, 'success');
  } catch (e) {
    showToast('No se pudo expulsar al usuario. ' + friendlyError(e), 'error');
  }
    }
  });
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

  if (!customName) { showToast('Por favor, dinos cómo te llamas.', 'info'); return; }
  if (!grupoNombre) { showToast('Escribe un nombre para el grupo.', 'warning'); return; }

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
    showToast('No se pudo crear el grupo. ' + friendlyError(e), 'error');
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
  if (!email || !nombre) { showToast('Completa el correo y nombre.', 'warning'); return; }
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
    showToast(`✅ ${nombre} agregado al grupo.`, 'success');
  } catch (e) { showToast(friendlyError(e), 'error'); }
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
  // Si no hay grupo y no es muro, verificar si fue expulsado o simplemente no tiene grupo
  if (!currentGroupId && section !== 'muro') {
    // Si la sección expulsado está activa, no redirigir a noGroup (ya está bien)
    const expulsadoEl = $('sectionExpulsado');
    if (expulsadoEl && expulsadoEl.classList.contains('active')) return;
    showSection('noGroup');
    return;
  }

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

  // --- LIMPIAR ONLINE AL SALIR DEL CHAT (el heartbeat de presencia sigue activo en todo el grupo) ---
  if (section !== 'chat') {
    if (chatOnlineUnsub) { chatOnlineUnsub(); chatOnlineUnsub = null; }
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
    const vistaGaleria = $('vistaTableros');
    const vistaFeed = $('vistaFeedTablero');
    if (!dentroDeTablero) {
      if (vistaGaleria) vistaGaleria.style.display = '';
      if (vistaFeed) vistaFeed.style.display = 'none';
    }
    initTableros();
    initFeed();
  }


  if (section === 'chat') {
    const yaEstabaEnChat = currentSection === 'chat';
    initSalasChat();
    // Restaurar sala solo si venimos de OTRA sección (no si ya estábamos en chat)
    if (!yaEstabaEnChat) {
      const lastSala = localStorage.getItem('ze_last_sala');
      if (lastSala) {
        try {
          const { salaId, nombre, color } = JSON.parse(lastSala);
          setTimeout(() => abrirSalaChat(salaId, nombre, color), 100);
        } catch(e) {
          localStorage.removeItem('ze_last_sala');
        }
      }
    }
    const scrollToMine = () => {
      const v = $('vistaChatSala');
      if (v && v.style.display === 'none') return;
      scrollChatToMyLastMessage();
    };
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
    expulsado: 'sectionExpulsado',
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

