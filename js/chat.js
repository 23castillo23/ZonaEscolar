/* ═══════════════════════════════════════════════════
   CHAT — Salas en tiempo real, mensajes, imágenes,
   typing, presencia online, burbuja flotante.

   Dependencias: core.js, grupos.js
   Colecciones: ec_chat, ec_salas_chat, ec_chat_reads,
                ec_typing, ec_online

   MIGRADO a AppState v2:
   · AppState.unsub() reemplaza el patrón if(x){x();x=null}
   · AppState.get/set para currentGroupId, currentSalaId, etc.
   · AppState.on('currentGroupId') limpia el estado al cambiar grupo
═══════════════════════════════════════════════════ */

/* ── Estado interno del módulo (no compartido) ── */
let lastChatDateStr          = '';
let chatUnreadDividerInserted = false;

/* ── Limpiar al cambiar de grupo ── */
AppState.on('currentGroupId', () => {
  AppState.unsub('chatUnsub');
  AppState.unsub('salasUnsub');
  AppState.unsub('chatOnlineUnsub');
  AppState.set('currentSalaId',   null);
  AppState.set('chatOldestDoc',   null);
  AppState.set('chatHayMas',      true);
  AppState.set('chatCargandoMas', false);
  AppState.set('chatLastReadMs',  0);
  lastChatDateStr = '';
});

/* ══════════════════════════════════════════
   SCROLL HELPERS
══════════════════════════════════════════ */

function ajustarScrollChat(isInitialLoad) {
  const box = $('chatMessages');
  if (!box) return;
  setTimeout(() => {
    if (isInitialLoad) {
      const unreadMark = $('chatUnreadMark');
      if (unreadMark) unreadMark.scrollIntoView({ behavior: 'instant', block: 'center' });
      else            box.scrollTop = box.scrollHeight;
    } else {
      box.scrollTop = box.scrollHeight;
    }
  }, 50);
}

function scrollChatToMyLastMessage() {
  const box  = $('chatMessages');
  if (!box) return;
  const mine     = qsa('.chat-msg.mine', box);
  const lastMine = mine[mine.length - 1];
  if (lastMine) lastMine.scrollIntoView({ behavior: 'instant', block: 'end' });
  else          box.scrollTop = box.scrollHeight;
}

/* ══════════════════════════════════════════
   SALAS DE CHAT
══════════════════════════════════════════ */

function initSalasChat() {
  if (!AppState.get('currentGroupId')) return;
  AppState.unsub('salasUnsub');

  const vistaGaleria = $('vistaSalasChat');
  const vistaChat    = $('vistaChatSala');
  const secChat      = $('sectionChat');
  if (vistaGaleria) vistaGaleria.style.display = '';
  if (vistaChat)    vistaChat.style.display    = 'none';
  /* Modo galería: CSS se adapta solo igual que cualquier .section normal */
  if (secChat) secChat.classList.add('modo-galeria');

  const btnNueva = $('btnNuevaSalaChat');
  if (btnNueva) btnNueva.style.display = AppState.get('isAdmin') ? '' : 'none';

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_salas_chat'),
    where('groupId', '==', AppState.get('currentGroupId'))
  );

  AppState.set('salasUnsub', onSnapshot(q, snap => {
    const salas = [];
    snap.forEach(d => salas.push({ id: d.id, ...d.data() }));
    salas.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    renderGaleriaSalas(salas);
  }));
}

function renderGaleriaSalas(salas) {
  const galeria = $('salasGaleria');
  if (!galeria) return;

  const isAdmin = AppState.get('isAdmin');
  const orden   = window._ordenSalas || 'fecha';
  const salasSorted = [...salas];
  if (orden === 'nombre') salasSorted.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  else salasSorted.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  let html = '';
  
  /* ── Card "Nueva sala" (solo admin) — mismo patrón que tableros ── */
  if (isAdmin) {
    html += `
      <div class="tablero-card-wrap">
        <button class="tablero-card tablero-card-nuevo" onclick="abrirModalNuevaSala()">
          <div class="tablero-card-inner">
            <div class="tablero-card-content">
              <span class="tablero-card-icon">➕</span>
              <div class="tablero-card-nombre">Nueva sala</div>
            </div>
          </div>
        </button>
      </div>`;
  }

  /* ── Card "General" — misma estructura que tablero general ── */
  html += `
    <div class="tablero-card-wrap">
      <button class="tablero-card tablero-general" onclick="abrirSalaChat('general','💬 General','')">
        <div class="tablero-card-inner">
          <div class="tablero-card-content">
            <span class="tablero-card-icon">💬</span>
            <div class="tablero-card-nombre">General</div>
          </div>
        </div>
      </button>
    </div>`;

  /* ── Cards de salas creadas ── */
  salasSorted.forEach(s => {
    const bg    = (s.color && s.color.trim()) ? s.color : '#3b82f6';
    const icono = s.emoji || getTableroIcono(s.nombre);
    const delBtn = isAdmin
      ? `<button class="tablero-card-del" onclick="event.stopPropagation(); eliminarSala('${s.id}',${JSON.stringify(s.nombre)})">🗑️</button>` /* BUG FIX: JSON.stringify para nombre de sala con apóstrofes */
      : '';
    html += `
      <div class="tablero-card-wrap">
        <button class="tablero-card" style="background:${bg}" onclick="abrirSalaChat('${s.id}',${JSON.stringify(s.nombre)},'${bg}')"> <!-- BUG FIX: JSON.stringify para nombre de sala -->
          <div class="tablero-card-inner">
            <div class="tablero-card-content">
              <span class="tablero-card-icon">${icono}</span>
              <div class="tablero-card-nombre">${escHtml(s.nombre)}</div>
            </div>
          </div>
        </button>
        ${delBtn}
      </div>`;
  });

  galeria.innerHTML = html;
}

window.abrirSalaChat = function(salaId, nombre, color) {
  AppState.set('currentSalaId', salaId === 'general' ? null : salaId);
  localStorage.setItem('ze_last_sala', JSON.stringify({ salaId, nombre, color }));

  const vistaGaleria = $('vistaSalasChat');
  const vistaChat    = $('vistaChatSala');
  if (vistaGaleria) vistaGaleria.style.display = 'none';
  if (vistaChat)    vistaChat.style.display    = '';
  /* Salir del modo galería: CSS vuelve al layout de mensajes */
  const secChat = $('sectionChat');
  if (secChat) secChat.classList.remove('modo-galeria');
  
  /* Recalcular --chat-h ahora que el layout cambió a modo sala */
  (function _recalcChatH() {
    const vvH      = window.visualViewport?.height || window.innerHeight;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const getVar   = (v, fb) => { const r = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)); return Number.isFinite(r) && r > 0 ? r : fb; };
    const topbarH  = getVar('--ze-topbar-h', 56);
    const bottomH  = isMobile ? getVar('--ze-bottom-nav-clearance', 52) : 0;
    const chatH    = Math.max(vvH - topbarH - bottomH, 200);
    document.documentElement.style.setProperty('--chat-h', chatH + 'px');
    /* Segundo intento tras el repaint por si los valores aún no están listos */
    requestAnimationFrame(() => {
      const vvH2   = window.visualViewport?.height || window.innerHeight;
      const chatH2 = Math.max(vvH2 - topbarH - bottomH, 200);
      document.documentElement.style.setProperty('--chat-h', chatH2 + 'px');
    });
  })();

  const titulo = $('salaFeedTitulo');
  if (titulo) { titulo.textContent = nombre; if (color) titulo.style.color = color; }

  const topbarTitle = $('topbarTitle');
  if (topbarTitle) {
    topbarTitle.innerHTML = `
      <button class="tablero-back-btn" id="chatTopbarBack"
        onclick="cerrarSalaChat()"
        style="font-size:12px;padding:5px 10px;margin-right:8px">← Salas</button>
      <span id="chatTopbarNombre" style="font-size:15px;font-weight:700;color:${color || 'var(--text0)'};
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${escHtml(nombre)}</span>`;
  }

  const delBtn = $('salaFeedDel');
  if (delBtn) delBtn.style.display = 'none';

  AppState.unsub('chatUnsub');
  initChat();
};

function cerrarSalaChat() {
  AppState.unsub('chatUnsub');
  AppState.set('currentSalaId', null);
  localStorage.removeItem('ze_last_sala');

  const vistaGaleria = $('vistaSalasChat');
  const vistaChat    = $('vistaChatSala');
  if (vistaGaleria) vistaGaleria.style.display = '';
  if (vistaChat)    vistaChat.style.display    = 'none';
  /* Volver al modo galería */
  const secChatCerrar = $('sectionChat');
  if (secChatCerrar) secChatCerrar.classList.add('modo-galeria');

  const topbarTitle = $('topbarTitle');
  if (topbarTitle) topbarTitle.innerHTML = 'Chat';
}

window.eliminarSalaActiva = function() {
  const header = $('salaFeedHeader');
  if (header?.dataset.salaId) eliminarSala(header.dataset.salaId, '');
};

window.eliminarSala = function(salaId, nombre) {
  showConfirm({
    title: 'Eliminar sala',
    message: `¿Eliminar la sala "${nombre}"? Los mensajes del historial se conservan.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarSala('${salaId}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc } = lib();
      try { await deleteDoc(doc(db(), 'ec_salas_chat', salaId)); }
      catch(e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

window.abrirModalNuevaSala = function() {
  const nombreEl = $('salaChatNombre');
  if (nombreEl) nombreEl.value = '';

  AppState.set('salaChatColorSeleccionado', '#3b82f6');
  AppState.set('salaChatEmojiSeleccionado', '💬');

  $('salaChatColorPicker')?.querySelectorAll('.dvd-color-opt').forEach(b =>
    b.classList.toggle('selected', b.dataset.color === '#3b82f6'));
  $('salaChatEmojiPicker')?.querySelectorAll('.tablero-emoji-opt').forEach(b =>
    b.classList.toggle('selected', b.dataset.emoji === '💬'));

  openModal('modalNuevaSalaChat');
};

/* ══════════════════════════════════════════
   CARGA DE MENSAJES (paginación + realtime)
══════════════════════════════════════════ */

function initChat() {
  if (!AppState.get('currentGroupId')) return;
  AppState.unsub('chatUnsub');

  AppState.set('chatOldestDoc',   null);
  AppState.set('chatHayMas',      true);
  AppState.set('chatCargandoMas', false);

  const box = $('chatMessages');
  if (!box) return;
  box.innerHTML = '<div class="feed-loading" id="chatLoading">Conectando…</div>';
  lastChatDateStr = '';

  const { collection, query, where, orderBy, limit, getDocs, onSnapshot, Timestamp } = lib();
  const LIMIT       = 50;
  const groupId     = AppState.get('currentGroupId');
  const salaFiltro  = AppState.get('currentSalaId') || 'general';

  const qInicial = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', groupId),
    where('salaId',  '==', salaFiltro),
    orderBy('createdAt', 'desc'),
    limit(LIMIT)
  );

  getDocs(qInicial).then(snap => {
    $('chatLoading')?.remove();

    if (snap.empty) {
      AppState.set('chatHayMas', false);
    } else {
      AppState.set('chatOldestDoc', snap.docs[snap.docs.length - 1]);
      AppState.set('chatHayMas',    snap.docs.length === LIMIT);

      const mensajes = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      lastChatDateStr = '';
      mensajes.forEach(m => appendChatMessageObj(m, box));
    }

    _actualizarBotonMasChat();
    requestAnimationFrame(() => scrollChatToMyLastMessage());

    const tsInicio = Timestamp.now();
    const qNuevos  = query(
      collection(db(), 'ec_chat'),
      where('groupId',   '==', groupId),
      where('salaId',    '==', salaFiltro),
      orderBy('createdAt', 'asc'),
      where('createdAt', '>',  tsInicio)
    );

    AppState.set('chatUnsub', onSnapshot(qNuevos, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = { id: change.doc.id, ...change.doc.data() };
          if (!box.querySelector(`[data-id="${m.id}"]`)) {
            appendChatMessageObj(m, box);
            const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 220;
            if (wasNearBottom) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
          }
        }
        if (change.type === 'removed') {
          box.querySelector(`[data-id="${change.doc.id}"]`)?.remove();
        }
      });
    }, err => console.error('Chat realtime error:', err)));

  }).catch(err => {
    console.error('Chat carga inicial error:', err);
    const loading = $('chatLoading');
    if (loading) loading.innerHTML = '⚠️ Error al cargar mensajes';
  });

  initChatOnline();
}

/* ══════════════════════════════════════════
   PAGINACIÓN — MENSAJES ANTERIORES
══════════════════════════════════════════ */

function _actualizarBotonMasChat() {
  const box = $('chatMessages');
  if (!box) return;
  let btn = $('chatLoadMoreBtn');
  if (AppState.get('chatHayMas') && !btn) {
    btn = document.createElement('div');
    btn.id        = 'chatLoadMoreBtn';
    btn.className = 'feed-loading';
    btn.style.cssText = 'cursor:pointer;color:var(--accent);padding:8px;';
    btn.textContent   = '↑ Ver mensajes anteriores';
    btn.onclick       = cargarMasMensajesChat;
    box.prepend(btn);
  } else if (!AppState.get('chatHayMas') && btn) {
    btn.remove();
  }
}

async function cargarMasMensajesChat() {
  if (AppState.get('chatCargandoMas') || !AppState.get('chatHayMas') || !AppState.get('chatOldestDoc')) return;
  AppState.set('chatCargandoMas', true);

  const btn = $('chatLoadMoreBtn');
  if (btn) btn.textContent = '⏳ Cargando…';

  const { collection, query, where, orderBy, limit, startAfter, getDocs } = lib();
  const box   = $('chatMessages');
  const LIMIT = 50;

  try {
    const q = query(
      collection(db(), 'ec_chat'),
      where('groupId', '==', AppState.get('currentGroupId')),
      where('salaId',  '==', AppState.get('currentSalaId') || 'general'),
      orderBy('createdAt', 'desc'),
      startAfter(AppState.get('chatOldestDoc')),
      limit(LIMIT)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      AppState.set('chatHayMas', false);
    } else {
      AppState.set('chatOldestDoc', snap.docs[snap.docs.length - 1]);
      AppState.set('chatHayMas',    snap.docs.length === LIMIT);

      const alturaAntes       = box.scrollHeight;
      const savedLastDateStr  = lastChatDateStr;
      const mensajes          = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();

      const tempDiv = document.createElement('div');
      lastChatDateStr = '';
      mensajes.forEach(m => appendChatMessageObj(m, tempDiv));
      if (!tempDiv.querySelector('.chat-date-divider')) lastChatDateStr = savedLastDateStr;

      const ancla = $('chatLoadMoreBtn');
      while (tempDiv.firstChild) box.insertBefore(tempDiv.firstChild, ancla || box.firstChild);
      box.scrollTop = box.scrollHeight - alturaAntes;
    }
  } catch (e) {
    console.error('Error cargando más mensajes:', e);
  } finally {
    AppState.set('chatCargandoMas', false);
    _actualizarBotonMasChat();
  }
}

/* ══════════════════════════════════════════
   PRESENCIA ONLINE
══════════════════════════════════════════ */

function initChatOnline() {
  if (!AppState.get('currentGroupId') || !AppState.get('currentUser')) return;
  _setOnlineStatus();

  AppState.unsub('chatOnlineUnsub');

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_online'),
    where('groupId', '==', AppState.get('currentGroupId'))
  );

  AppState.set('chatOnlineUnsub', onSnapshot(q, snap => {
    const list = $('chatOnlineList');
    if (!list) return;
    const now    = Date.now();
    const cu     = AppState.get('currentUser');
    const online = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const ts   = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || 0);
      if (now - ts < 35000) online.push(data);
    });
    const others = online.filter(d => d.uid !== cu.uid);
    if (others.length === 0) {
      list.style.display = 'none';
    } else {
      list.style.display = 'flex';
      list.innerHTML = others
        .map(d => `<span class="chat-online-pill"><span class="online-dot"></span>${escHtml(d.name || 'Compañero')}</span>`)
        .join('');
    }
  }));
}

function initSidebarOnlinePresence() {
  if (!AppState.get('currentGroupId')) return;
  AppState.unsub('sidebarOnlineUnsub');

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_online'),
    where('groupId', '==', AppState.get('currentGroupId'))
  );

  AppState.set('sidebarOnlineUnsub', onSnapshot(q, snap => {
    const now          = Date.now();
    const onlineEmails = new Set();
    snap.docs.forEach(d => {
      const data = d.data();
      const ts   = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || 0);
      if (now - ts >= 35000) return;
      const em = (data.email || '').toString().trim().toLowerCase();
      if (em) onlineEmails.add(em);
    });
    qsa('.sidebar-member-btn[data-email]').forEach(el => {
      const raw = (el.dataset.email || '').trim().toLowerCase();
      el.classList.toggle('sidebar-member-online', Boolean(raw && onlineEmails.has(raw)));
    });
  }));
}

async function _setOnlineStatus() {
  const groupId = AppState.get('currentGroupId');
  const cu      = AppState.get('currentUser');
  if (!groupId || !cu) return;
  try {
    const { doc, setDoc, serverTimestamp } = lib();
    const emailNorm = (cu.email || '').toString().trim().toLowerCase();
    await setDoc(doc(db(), 'ec_online', `${groupId}_${cu.uid}`), {
      groupId,
      uid:       cu.uid,
      email:     emailNorm,
      name:      getUserAlias(),
      updatedAt: serverTimestamp()
    });
  } catch (_) {}
}

/* ══════════════════════════════════════════
   SEEN BY ✔✔
══════════════════════════════════════════ */

async function marcarMensajeVisto(msgId) {
  const cu = AppState.get('currentUser');
  if (!cu || !msgId) return;
  try {
    const { doc, updateDoc } = lib();
    await updateDoc(doc(db(), 'ec_chat', msgId), { [`seenBy.${cu.uid}`]: true });
  } catch (_) {}
}

/* ══════════════════════════════════════════
   ELIMINAR MENSAJE
══════════════════════════════════════════ */

window.eliminarMensaje = function(msgId) {
  showConfirm({
    title: 'Eliminar mensaje',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarMensaje('${msgId}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc } = lib();
      try {
        await deleteDoc(doc(db(), 'ec_chat', msgId));
        $('chatMessages')?.querySelector(`[data-id="${msgId}"]`)?.remove();
      } catch (e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

/* ══════════════════════════════════════════
   LIGHTBOX Y AVATAR
══════════════════════════════════════════ */

window.openChatImgLightbox = function(url) {
  const lb  = $('lightbox');
  const img = $('lightboxImg');
  if (!lb || !img) return;
  img.src = url;
  $('lightboxCaption').textContent = '';
  lb.classList.add('open');
  $('lightboxPrev').style.display = 'none';
  $('lightboxNext').style.display = 'none';
};

window._zeChatAvatarBroken = function(el) {
  const fb = document.createElement('span');
  fb.className   = 'chat-msg-avatar chat-msg-avatar-fallback';
  fb.textContent = el.getAttribute('data-initial') || '?';
  el.replaceWith(fb);
};

function buildChatAvatarHtml(authorAvatar, authorName) {
  const av          = (authorAvatar || '').trim();
  const initialChar = escHtml((authorName || '?').charAt(0).toUpperCase());
  const isUrl       = av.startsWith('http');
  const isEmoji     = av && !isUrl && [...av].length <= 2;
  if (isUrl) return `<img class="chat-msg-avatar" src="${escHtml(av)}" alt="" data-initial="${initialChar}" onerror="_zeChatAvatarBroken(this)">`;
  const inner = isEmoji ? escHtml(av) : initialChar;
  return `<span class="chat-msg-avatar chat-msg-avatar-fallback">${inner}</span>`;
}

/* ══════════════════════════════════════════
   RENDER DE UN MENSAJE
══════════════════════════════════════════ */

function appendChatMessageObj(m, box) {
  const cu   = AppState.get('currentUser');
  const mine = m.authorUid === cu?.uid;

  const rawDate = getChatMsgDate(m) || new Date();
  const msgDate = fmtDateChat(rawDate);

  if (msgDate && msgDate !== lastChatDateStr) {
    const divider = document.createElement('div');
    divider.className = 'chat-date-divider';
    divider.innerHTML = `<span>${escHtml(msgDate)}</span>`;
    box.appendChild(divider);
    lastChatDateStr = msgDate;
  }

  const bubbleContent = m.imageUrl
    ? `<img src="${escHtml(m.imageUrl)}" class="chat-msg-img" onclick="openChatImgLightbox('${escHtml(m.imageUrl)}')" style="cursor:pointer;max-width:220px;border-radius:10px;display:block;margin-top:4px;">`
    : escHtml(m.text);

  let statusHtml = '';
  if (mine) {
    const seenByOthers = m.seenBy && Object.keys(m.seenBy).some(uid => uid !== cu.uid);
    statusHtml = seenByOthers
      ? `<span class="chat-seen" style="color:var(--accent2);">✔✔</span>`
      : `<span class="chat-seen">✔</span>`;
  } else {
    marcarMensajeVisto(m.id);
  }

  const msgEl = document.createElement('div');
  msgEl.className  = `chat-msg ${mine ? 'mine' : ''}`;
  msgEl.dataset.id = m.id;
  msgEl.innerHTML  = `
    ${buildChatAvatarHtml(m.authorAvatar, m.authorName)}
    <div class="chat-msg-wrap">
      <div class="chat-msg-author" style="${mine ? 'text-align:right;color:var(--accent2);' : ''}">${escHtml(m.authorName || 'Compañero')}</div>
      <div class="chat-msg-bubble">${bubbleContent}</div>
      <div class="chat-msg-time">
        ${fmtTimeChat(getChatMsgDate(m) || m.createdAt)}
        ${mine ? statusHtml : ''}
        ${mine && !m.id.startsWith('optimist-') ? `<button class="chat-del-btn" onclick="eliminarMensaje('${m.id}')" title="Eliminar">🗑️</button>` : ''}
      </div>
    </div>`;
  box.appendChild(msgEl);
}

/* ══════════════════════════════════════════
   ENVIAR TEXTO
══════════════════════════════════════════ */

async function enviarMensaje() {
  const input = $('chatInput');
  const text  = input?.value.trim();
  const cu    = AppState.get('currentUser');
  if (!text || !AppState.get('currentGroupId')) return;

  const btn = $('chatSend');
  if (btn) btn.disabled = true;
  input.value = '';
  input.dispatchEvent(new Event('input'));

  const msgBox = $('chatMessages');
  const tempId = 'optimist-' + Date.now();
  const mensajeOptimista = {
    id: tempId, text,
    authorUid: cu.uid, authorName: getUserAlias(), authorAvatar: cu.avatar || '',
    createdAt: { toDate: () => new Date() }
  };
  if (msgBox) { appendChatMessageObj(mensajeOptimista, msgBox); msgBox.scrollTop = msgBox.scrollHeight; }

  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const docRef = await addDoc(collection(db(), 'ec_chat'), {
      groupId:     AppState.get('currentGroupId'),
      salaId:      AppState.get('currentSalaId') || 'general',
      text,
      authorUid:   cu.uid,
      authorName:  getUserAlias(),
      authorAvatar: cu.avatar || '',
      createdAt:   serverTimestamp()
    });
    const optimEl = msgBox?.querySelector(`[data-id="${tempId}"]`);
    if (optimEl) {
      optimEl.dataset.id = docRef.id;
      const timeDiv = optimEl.querySelector('.chat-msg-time');
      if (timeDiv && !timeDiv.querySelector('.chat-del-btn')) {
        const delBtn = document.createElement('button');
        delBtn.className = 'chat-del-btn'; delBtn.title = 'Eliminar'; delBtn.textContent = '🗑️';
        delBtn.setAttribute('onclick', `eliminarMensaje('${docRef.id}')`);
        timeDiv.appendChild(delBtn);
      }
    }
  } catch (e) {
    console.error('Error al enviar:', e);
    showToast('No se pudo enviar el mensaje. Revisa tu conexión.', 'error');
    msgBox?.querySelector(`[data-id="${tempId}"]`)?.remove();
    if (input) input.value = text;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   ENVIAR IMAGEN
══════════════════════════════════════════ */

async function enviarImagenChat(file) {
  if (!file || !AppState.get('currentGroupId')) return;
  const btn = $('chatImgBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const url = await uploadToCloudinary(file);
    if (!url) { showToast('No se pudo subir la imagen.', 'error'); return; }
    const cu  = AppState.get('currentUser');
    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_chat'), {
      groupId:     AppState.get('currentGroupId'),
      salaId:      AppState.get('currentSalaId') || 'general',
      text: '', imageUrl: url,
      authorUid:   cu.uid, authorName: getUserAlias(), authorAvatar: cu.avatar || '',
      createdAt:   serverTimestamp()
    });
  } catch (err) {
    console.error('Error enviando imagen al chat:', err);
    showToast('No se pudo enviar la imagen. Intenta de nuevo.', 'error');
  } finally {
    if (btn) { btn.textContent = '📷'; btn.disabled = false; }
    const imgInput = $('chatImgInput');
    if (imgInput) imgInput.value = '';
  }
}

/* ══════════════════════════════════════════
   CREAR NUEVA SALA
══════════════════════════════════════════ */

async function confirmarCrearSala() {
  const nombre = ($('salaChatNombre')?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre para la sala.', 'warning'); return; }
  const btnConf = $('btnConfirmarSalaChat');
  if (btnConf) { btnConf.disabled = true; btnConf.textContent = '⏳ Creando…'; }
  const cu = AppState.get('currentUser');
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_salas_chat'), {
      groupId: AppState.get('currentGroupId'),
      nombre,
      color:   AppState.get('salaChatColorSeleccionado'),
      emoji:   AppState.get('salaChatEmojiSeleccionado'),
      adminUid: cu.uid,
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevaSalaChat');
  } catch(e) { showToast(friendlyError(e), 'error'); }
  finally { if (btnConf) { btnConf.disabled = false; btnConf.textContent = '💬 Crear sala'; } }
}

/* ══════════════════════════════════════════
   EMOJI PICKER
══════════════════════════════════════════ */

function setupEmojiPicker() {
  const btnEmoji = $('chatEmojiBtn');
  const picker   = $('chatEmojiPicker');
  if (!btnEmoji || !picker) return;
  if (picker.dataset.emojiSetup === 'true') return;
  picker.dataset.emojiSetup = 'true';

  btnEmoji.addEventListener('click', e => {
    e.stopPropagation();
    const isVisible = picker.style.display !== 'none';
    picker.style.display = isVisible ? 'none' : 'flex';
    btnEmoji.classList.toggle('active', !isVisible);
  });

  picker.addEventListener('click', e => {
    if (e.target.classList.contains('q-emoji')) {
      const input = $('chatInput');
      if (input) { input.value += e.target.innerText.trim(); input.focus(); input.dispatchEvent(new Event('input')); }
    }
  });

  document.addEventListener('click', e => {
    if (!btnEmoji.contains(e.target) && !picker.contains(e.target)) {
      picker.style.display = 'none'; btnEmoji.classList.remove('active');
    }
  });
}

/* ══════════════════════════════════════════
   LISTENERS DE UI
══════════════════════════════════════════ */

function initChatListeners() {
  $('chatSend')?.addEventListener('click', enviarMensaje);
  $('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
  });
  $('chatInput')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
  $('chatInput')?.addEventListener('focus', () => {
    // FIX: siempre hacer scroll al fondo al enfocar, no solo cuando falta visualViewport.
    // En iOS/Android con visualViewport el teclado dispara 'resize' en el viewport,
    // pero hay un gap de ~100-200ms antes de que cambie la altura — este timeout
    // hace scroll cuando ya se recalculó --chat-h.
    setTimeout(() => ajustarScrollChat(false), 200);
  });
  $('chatInput')?.addEventListener('blur', () => {
    const box = $('chatMessages');
    if (box && box.scrollHeight > box.clientHeight) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
  });

  if (!window.visualViewport) {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (document.activeElement === $('chatInput')) ajustarScrollChat(false);
      }, 100);
    });
  }

  const chatImgBtn   = $('chatImgBtn');
  const chatImgInput = $('chatImgInput');
  if (chatImgBtn && chatImgInput) {
    chatImgBtn.addEventListener('click', () => chatImgInput.click());
    chatImgInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) enviarImagenChat(f); });
  }

  $('salaChatColorPicker')?.addEventListener('click', e => {
    const btn = e.target.closest('.dvd-color-opt');
    if (!btn) return;
    AppState.set('salaChatColorSeleccionado', btn.dataset.color);
    $('salaChatColorPicker').querySelectorAll('.dvd-color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  $('salaChatEmojiPicker')?.addEventListener('click', e => {
    const btn = e.target.closest('.tablero-emoji-opt');
    if (!btn) return;
    AppState.set('salaChatEmojiSeleccionado', btn.dataset.emoji);
    $('salaChatEmojiPicker').querySelectorAll('.tablero-emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  $('btnConfirmarSalaChat')?.addEventListener('click', confirmarCrearSala);
  setupEmojiPicker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initChatListeners);
else initChatListeners();

/* ══════════════════════════════════════════
   MODAL TEXTO FOTO (muro.js lo llama)
══════════════════════════════════════════ */

function pedirTextoFotoModal(onConfirm) {
  const input = $('modalTextoFotoInput');
  const okBtn = $('modalTextoFotoOk');
  if (!input || !okBtn) { onConfirm(''); return; }
  input.value = '';
  openModal('modalTextoFoto');
  setTimeout(() => input.focus(), 150);
  const nuevoBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(nuevoBtn, okBtn);
  const confirmar = () => { closeModal('modalTextoFoto'); onConfirm(input.value || ''); };
  nuevoBtn.addEventListener('click', confirmar);
  input.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.removeEventListener('keydown', handler); confirmar(); }
  });
}
