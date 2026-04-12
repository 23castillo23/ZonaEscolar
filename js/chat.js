/* ═══════════════════════════════════════════════════
   CHAT — Salas en tiempo real, mensajes, imágenes,
   typing, presencia online, burbuja flotante.

   Dependencias: core.js, grupos.js
   Colecciones: ec_chat, ec_salas_chat, ec_chat_reads,
                ec_typing, ec_online

   REGLA: Todo lo del chat va aquí.
   La lógica del MURO está en muro.js (no aquí).
═══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   ESTADO INTERNO DEL MÓDULO
══════════════════════════════════════════ */
let lastChatDateStr = '';
let chatUnreadDividerInserted = false;

/* ══════════════════════════════════════════
   SCROLL HELPERS
══════════════════════════════════════════ */

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

/* ══════════════════════════════════════════
   SALAS DE CHAT
══════════════════════════════════════════ */

function initSalasChat() {
  if (!currentGroupId) return;
  if (salasUnsub) { salasUnsub(); salasUnsub = null; }

  // Mostrar galería, ocultar chat
  const vistaGaleria = $('vistaSalasChat');
  const vistaChat = $('vistaChatSala');
  if (vistaGaleria) vistaGaleria.style.display = '';
  if (vistaChat) vistaChat.style.display = 'none';

  // Botón nueva sala solo para admin
  const btnNueva = $('btnNuevaSalaChat');
  if (btnNueva) btnNueva.style.display = isAdmin ? '' : 'none';

  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_salas_chat'), where('groupId', '==', currentGroupId));

  salasUnsub = onSnapshot(q, snap => {
    const salas = [];
    snap.forEach(d => salas.push({ id: d.id, ...d.data() }));
    salas.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    renderGaleriaSalas(salas);
  });
}

function renderGaleriaSalas(salas) {
  const galeria = $('salasGaleria');
  if (!galeria) return;

  const orden = window._ordenSalas || 'fecha';
  const salasSorted = [...salas];
  if (orden === 'nombre') {
    salasSorted.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else {
    salasSorted.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }

  let html = '';

  // Card "Nueva sala" (solo admin)
  if (isAdmin) {
    html += `
      <button class="tablero-card tablero-card-nuevo" onclick="abrirModalNuevaSala()">
        <div class="tablero-card-inner">
          <div class="tablero-card-content">
            <span class="tablero-card-icon">➕</span>
            <div class="tablero-card-nombre">Nueva sala</div>
          </div>
        </div>
      </button>`;
  }

  // Card "General" siempre visible
  html += `
    <button class="tablero-card tablero-general" onclick="abrirSalaChat('general','💬 General','')">
      <div class="tablero-card-inner">
        <div class="tablero-card-content">
          <span class="tablero-card-icon">💬</span>
          <div class="tablero-card-nombre">General</div>
        </div>
      </div>
    </button>`;

  // Cards de salas creadas
  salasSorted.forEach(s => {
    const bg = (s.color && s.color.trim()) ? s.color : '#3b82f6';
    const icono = s.emoji || getTableroIcono(s.nombre);
    const delBtn = isAdmin
      ? `<button class="tablero-card-del" onclick="event.stopPropagation(); eliminarSala('${s.id}','${escHtml(s.nombre)}')">🗑️</button>`
      : '';
    html += `
      <div class="tablero-card-wrap" style="position:relative">
        <button class="tablero-card" style="background:${bg}" onclick="abrirSalaChat('${s.id}','${escHtml(s.nombre)}','${bg}')">
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
  currentSalaId = salaId === 'general' ? null : salaId;
  localStorage.setItem('ze_last_sala', JSON.stringify({ salaId, nombre, color }));

  const vistaGaleria = $('vistaSalasChat');
  const vistaChat = $('vistaChatSala');
  if (vistaGaleria) vistaGaleria.style.display = 'none';
  if (vistaChat) vistaChat.style.display = '';

  // Guardar título (compatibilidad)
  const titulo = $('salaFeedTitulo');
  if (titulo) {
    titulo.textContent = nombre;
    if (color) titulo.style.color = color;
  }

  // Inyectar botón ← Salas + nombre en el topbar
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

  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  initChat();
};

function cerrarSalaChat() {
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  currentSalaId = null;
  localStorage.removeItem('ze_last_sala');

  const vistaGaleria = $('vistaSalasChat');
  const vistaChat = $('vistaChatSala');
  if (vistaGaleria) vistaGaleria.style.display = '';
  if (vistaChat) vistaChat.style.display = 'none';

  // Restaurar el topbar al título normal de la sección
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
      try {
        await deleteDoc(doc(db(), 'ec_salas_chat', salaId));
      } catch(e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

window.abrirModalNuevaSala = function abrirModalNuevaSala() {
  const nombreEl = $('salaChatNombre');
  if (nombreEl) nombreEl.value = '';

  salaChatColorSeleccionado = '#3b82f6';
  salaChatEmojiSeleccionado = '💬';

  const colorPicker = $('salaChatColorPicker');
  if (colorPicker) {
    colorPicker.querySelectorAll('.dvd-color-opt').forEach(b => {
      b.classList.toggle('selected', b.dataset.color === salaChatColorSeleccionado);
    });
  }
  const emojiPicker = $('salaChatEmojiPicker');
  if (emojiPicker) {
    emojiPicker.querySelectorAll('.tablero-emoji-opt').forEach(b => {
      b.classList.toggle('selected', b.dataset.emoji === salaChatEmojiSeleccionado);
    });
  }
  openModal('modalNuevaSalaChat');
};

/* ══════════════════════════════════════════
   CARGA DE MENSAJES (paginación + realtime)
══════════════════════════════════════════ */

function initChat() {
  if (!currentGroupId) return;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  // Resetear paginación
  chatOldestDoc = null;
  chatHayMas = true;
  chatCargandoMas = false;

  const box = $('chatMessages');
  if (!box) return;
  box.innerHTML = '<div class="feed-loading" id="chatLoading">Conectando…</div>';
  lastChatDateStr = '';

  const { collection, query, where, orderBy, limit, getDocs, onSnapshot, Timestamp } = lib();
  const LIMIT = 50;
  const salaFiltro = currentSalaId || 'general';

  // 1. Carga inicial: los últimos 50 mensajes
  const qInicial = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    where('salaId', '==', salaFiltro),
    orderBy('createdAt', 'desc'),
    limit(LIMIT)
  );

  getDocs(qInicial).then(snap => {
    const loading = $('chatLoading');
    if (loading) loading.remove();

    if (snap.empty) {
      chatHayMas = false;
    } else {
      chatOldestDoc = snap.docs[snap.docs.length - 1];
      chatHayMas = snap.docs.length === LIMIT;

      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse(); // más antiguo primero

      lastChatDateStr = '';
      mensajes.forEach(m => appendChatMessageObj(m, box));
    }

    _actualizarBotonMasChat();
    requestAnimationFrame(() => scrollChatToMyLastMessage());

    // 2. Listener en tiempo real SOLO para mensajes nuevos
    // FIX: usamos Timestamp.now() en el momento exacto para evitar el gap
    // entre getDocs y onSnapshot.
    const tsInicio = Timestamp.now();

    const qNuevos = query(
      collection(db(), 'ec_chat'),
      where('groupId', '==', currentGroupId),
      where('salaId', '==', salaFiltro),
      orderBy('createdAt', 'asc'),
      where('createdAt', '>', tsInicio)
    );

    chatUnsub = onSnapshot(qNuevos, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = { id: change.doc.id, ...change.doc.data() };
          // Evitar duplicar si ya está en el DOM
          if (!box.querySelector(`[data-id="${m.id}"]`)) {
            appendChatMessageObj(m, box);
            const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 220;
            if (wasNearBottom) {
              requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
            }
          }
        }
        if (change.type === 'removed') {
          const el = box.querySelector(`[data-id="${change.doc.id}"]`);
          if (el) el.remove();
        }
      });
    }, err => {
      console.error('Chat realtime error:', err);
    });

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
  if (chatHayMas && !btn) {
    btn = document.createElement('div');
    btn.id = 'chatLoadMoreBtn';
    btn.className = 'feed-loading';
    btn.style.cssText = 'cursor:pointer;color:var(--accent);padding:8px;';
    btn.textContent = '↑ Ver mensajes anteriores';
    btn.onclick = cargarMasMensajesChat;
    box.prepend(btn);
  } else if (!chatHayMas && btn) {
    btn.remove();
  }
}

async function cargarMasMensajesChat() {
  if (chatCargandoMas || !chatHayMas || !chatOldestDoc) return;
  chatCargandoMas = true;

  const btn = $('chatLoadMoreBtn');
  if (btn) btn.textContent = '⏳ Cargando…';

  const { collection, query, where, orderBy, limit, startAfter, getDocs } = lib();
  const box = $('chatMessages');
  const LIMIT = 50;

  try {
    const q = query(
      collection(db(), 'ec_chat'),
      where('groupId', '==', currentGroupId),
      where('salaId', '==', currentSalaId || 'general'),
      orderBy('createdAt', 'desc'),
      startAfter(chatOldestDoc),
      limit(LIMIT)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      chatHayMas = false;
    } else {
      chatOldestDoc = snap.docs[snap.docs.length - 1];
      chatHayMas = snap.docs.length === LIMIT;

      // Guardar posición del scroll antes de insertar
      const alturaAntes = box.scrollHeight;

      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse();

      // BUG-22: Al insertar mensajes antiguos, resetear lastChatDateStr para que
      // los separadores de fecha se generen correctamente para esos mensajes.
      // NO restaurar el valor antiguo al terminar; en cambio, NO tocar lastChatDateStr
      // del hilo principal para evitar duplicar el separador del primer mensaje nuevo.
      const savedLastDateStr = lastChatDateStr;

      const tempDiv = document.createElement('div');
      lastChatDateStr = ''; // reset para separadores de los mensajes viejos
      mensajes.forEach(m => appendChatMessageObj(m, tempDiv));
      // Después de insertar los viejos, restauramos el valor del PRIMER mensaje
      // del hilo existente (el que ya está visible en pantalla), no el antiguo.
      // Si tempDiv generó separadores hasta cierta fecha, lastChatDateStr ya tiene
      // el valor correcto del último mensaje antiguo. Lo dejamos para que el hilo
      // nuevo no repita el separador de ese mismo día.
      // Solo restauramos si el tempDiv no generó ningún separador (sin mensajes).
      if (!tempDiv.querySelector('.chat-date-divider')) {
        lastChatDateStr = savedLastDateStr;
      }

      const ancla = $('chatLoadMoreBtn');
      while (tempDiv.firstChild) {
        box.insertBefore(tempDiv.firstChild, ancla || box.firstChild);
      }

      // Mantener la posición de scroll (no saltar al top)
      box.scrollTop = box.scrollHeight - alturaAntes;
    }
  } catch (e) {
    console.error('Error cargando más mensajes:', e);
  } finally {
    chatCargandoMas = false;
    _actualizarBotonMasChat();
  }
}

/* ══════════════════════════════════════════
   PRESENCIA ONLINE
══════════════════════════════════════════ */

function initChatOnline() {
  if (!currentGroupId || !currentUser) return;
  // FIX: El heartbeat de presencia (25 s) ya lo arranca grupos.js al seleccionar grupo.
  // Antes se creaba un segundo intervalo aquí (30 s) que sobreescribía
  // _onlineHeartbeatTimer sin cancelar el anterior, dejando intervalos huérfanos
  // cada vez que el usuario entraba al chat. Solo hacemos un ping inmediato.
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

/* ══════════════════════════════════════════
   SEEN BY ✔✔
══════════════════════════════════════════ */

async function marcarMensajeVisto(msgId) {
  if (!currentUser || !msgId) return;
  try {
    const { doc, updateDoc } = lib();
    await updateDoc(doc(db(), 'ec_chat', msgId), {
      [`seenBy.${currentUser.uid}`]: true
    });
  } catch (_) { /* silencioso */ }
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
        // Quitar del DOM inmediatamente sin esperar al listener
        const box = $('chatMessages');
        const el = box?.querySelector(`[data-id="${msgId}"]`);
        if (el) el.remove();
      } catch (e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

/* ══════════════════════════════════════════
   LIGHTBOX DE IMÁGENES DEL CHAT
══════════════════════════════════════════ */

window.openChatImgLightbox = function(url) {
  const lb = $('lightbox');
  const img = $('lightboxImg');
  if (!lb || !img) return;
  img.src = url;
  $('lightboxCaption').textContent = '';
  lb.classList.add('open');
  $('lightboxPrev').style.display = 'none';
  $('lightboxNext').style.display = 'none';
};

/* ══════════════════════════════════════════
   AVATAR DE BURBUJA
══════════════════════════════════════════ */

window._zeChatAvatarBroken = function(el) {
  const fb = document.createElement('span');
  fb.className = 'chat-msg-avatar chat-msg-avatar-fallback';
  fb.textContent = el.getAttribute('data-initial') || '?';
  el.replaceWith(fb);
};

function buildChatAvatarHtml(authorAvatar, authorName) {
  const av = (authorAvatar || '').trim();
  const initialOne = (authorName || '?').charAt(0).toUpperCase();
  const initialChar = escHtml(initialOne);
  const isUrl = av.startsWith('http');
  const isEmoji = av && !isUrl && [...av].length <= 2;
  if (isUrl) {
    return `<img class="chat-msg-avatar" src="${escHtml(av)}" alt="" data-initial="${initialChar}" onerror="_zeChatAvatarBroken(this)">`;
  }
  const inner = isEmoji ? escHtml(av) : initialChar;
  return `<span class="chat-msg-avatar chat-msg-avatar-fallback">${inner}</span>`;
}

/* ══════════════════════════════════════════
   RENDER DE UN MENSAJE
══════════════════════════════════════════ */

function appendChatMessageObj(m, box) {
  const mine = m.authorUid === currentUser?.uid;

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

  // ✔ enviado / ✔✔ visto
  let statusHtml = '';
  if (mine) {
    const seenByOthers = m.seenBy && Object.keys(m.seenBy).some(uid => uid !== currentUser.uid);
    statusHtml = seenByOthers
      ? `<span class="chat-seen" style="color:var(--accent2);">✔✔</span>`
      : `<span class="chat-seen">✔</span>`;
  } else {
    marcarMensajeVisto(m.id);
  }

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${mine ? 'mine' : ''}`;
  msgEl.dataset.id = m.id;
  msgEl.innerHTML = `
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
   ENVIAR MENSAJE DE TEXTO
══════════════════════════════════════════ */

async function enviarMensaje() {
  const input = $('chatInput');
  const text = input?.value.trim();
  if (!text || !currentGroupId) return;

  const btn = $('chatSend');
  if (btn) btn.disabled = true;

  input.value = '';
  input.dispatchEvent(new Event('input'));

  const msgBox = $('chatMessages');
  const tempId = 'optimist-' + Date.now();
  // BUG FIX: el mensaje optimista debe pasar por appendChatMessageObj para
  // actualizar lastChatDateStr. Si el mensaje es el primero del día, el
  // separador de fecha se dibuja correctamente para los mensajes reales
  // que llegan después a través del listener en tiempo real.
  const mensajeOptimista = {
    id: tempId,
    text,
    authorUid: currentUser.uid,
    authorName: getUserAlias(),
    authorAvatar: currentUser.avatar || '',
    createdAt: { toDate: () => new Date() }
  };
  if (msgBox) {
    appendChatMessageObj(mensajeOptimista, msgBox);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const docRef = await addDoc(collection(db(), 'ec_chat'), {
      groupId: currentGroupId,
      salaId: currentSalaId || 'general',
      text,
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });

    // Reemplazar el elemento optimista con el id real para evitar duplicados
    const optimEl = msgBox?.querySelector(`[data-id="${tempId}"]`);
    if (optimEl) {
      optimEl.dataset.id = docRef.id;
      // Inyectar el botón eliminar que faltaba en el mensaje optimista
      const timeDiv = optimEl.querySelector('.chat-msg-time');
      if (timeDiv && !timeDiv.querySelector('.chat-del-btn')) {
        const delBtn = document.createElement('button');
        delBtn.className = 'chat-del-btn';
        delBtn.title = 'Eliminar';
        delBtn.textContent = '🗑️';
        delBtn.setAttribute('onclick', `eliminarMensaje('${docRef.id}')`);
        timeDiv.appendChild(delBtn);
      }
    }

  } catch (e) {
    console.error('Error al enviar:', e);
    showToast('No se pudo enviar el mensaje. Revisa tu conexión.', 'error');
    // Quitar el mensaje optimista si falló
    msgBox?.querySelector(`[data-id="${tempId}"]`)?.remove();
    if (input) input.value = text;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   ENVIAR IMAGEN AL CHAT
══════════════════════════════════════════ */

async function enviarImagenChat(file) {
  if (!file || !currentGroupId) return;

  const btn = $('chatImgBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const url = await uploadToCloudinary(file);
    if (!url) { showToast('No se pudo subir la imagen.', 'error'); return; }

    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_chat'), {
      groupId: currentGroupId,
      salaId: currentSalaId || 'general',
      text: '',
      imageUrl: url,
      authorUid: currentUser.uid,
      authorName: getUserAlias(),
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
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
   MODAL CREAR NUEVA SALA — CONFIRMACIÓN
══════════════════════════════════════════ */

async function confirmarCrearSala() {
  const nombre = ($('salaChatNombre')?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre para la sala.', 'warning'); return; }

  const btnConf = $('btnConfirmarSalaChat');
  if (btnConf) { btnConf.disabled = true; btnConf.textContent = '⏳ Creando…'; }

  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_salas_chat'), {
      groupId: currentGroupId,
      nombre,
      color: salaChatColorSeleccionado,
      emoji: salaChatEmojiSeleccionado,
      adminUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevaSalaChat');
  } catch(e) { showToast(friendlyError(e), 'error'); }
  finally {
    if (btnConf) { btnConf.disabled = false; btnConf.textContent = '💬 Crear sala'; }
  }
}

/* ══════════════════════════════════════════
   EMOJI PICKER
══════════════════════════════════════════ */

function setupEmojiPicker() {
  const btnEmoji = $('chatEmojiBtn');
  const picker = $('chatEmojiPicker');
  if (!btnEmoji || !picker) return;
  // Evitar doble registro
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
      if (input) {
        input.value += e.target.innerText.trim();
        input.focus();
        input.dispatchEvent(new Event('input'));
      }
    }
  });

  // Cerrar picker al hacer clic fuera
  document.addEventListener('click', e => {
    if (!btnEmoji.contains(e.target) && !picker.contains(e.target)) {
      picker.style.display = 'none';
      btnEmoji.classList.remove('active');
    }
  });
}

/* ══════════════════════════════════════════
   LISTENERS DE UI — ÚNICO PUNTO DE ENTRADA
   Se ejecuta después de que el DOM esté listo
══════════════════════════════════════════ */

function initChatListeners() {

  // ── Enviar mensaje ──
  $('chatSend')?.addEventListener('click', enviarMensaje);
  $('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  // ── Auto-resize del textarea ──
  $('chatInput')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  // ── Scroll al enfocar teclado en móvil ──
  // BUG FIX: los tres setTimeout anidados (100/300/600 ms) causaban saltos
  // de scroll visibles en Android Chrome. Con un único setTimeout de 150 ms
  // es suficiente: el viewport ya terminó de reajustarse en ese tiempo.
  $('chatInput')?.addEventListener('focus', () => {
    setTimeout(() => ajustarScrollChat(false), 150);
  });

  $('chatInput')?.addEventListener('blur', () => {
    const box = $('chatMessages');
    if (box && box.scrollHeight > box.clientHeight) {
      box.scrollTop = box.scrollHeight;
    }
  });

  // ── Ajustar scroll cuando el viewport cambia (teclado abre/cierra) ──
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (document.activeElement === $('chatInput')) {
        ajustarScrollChat(false);
      }
    }, 50);
  });

  // ── Enviar imagen ──
  const chatImgBtn = $('chatImgBtn');
  const chatImgInput = $('chatImgInput');
  if (chatImgBtn && chatImgInput) {
    chatImgBtn.addEventListener('click', () => chatImgInput.click());
    chatImgInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) enviarImagenChat(file);
    });
  }

  // ── Color picker de nueva sala ──
  $('salaChatColorPicker')?.addEventListener('click', e => {
    const btn = e.target.closest('.dvd-color-opt');
    if (!btn) return;
    salaChatColorSeleccionado = btn.dataset.color;
    $('salaChatColorPicker').querySelectorAll('.dvd-color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // ── Emoji picker de nueva sala ──
  $('salaChatEmojiPicker')?.addEventListener('click', e => {
    const btn = e.target.closest('.tablero-emoji-opt');
    if (!btn) return;
    salaChatEmojiSeleccionado = btn.dataset.emoji;
    $('salaChatEmojiPicker').querySelectorAll('.tablero-emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // ── Confirmar crear sala ──
  $('btnConfirmarSalaChat')?.addEventListener('click', confirmarCrearSala);

  // ── Emoji picker del chat ──
  setupEmojiPicker();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatListeners);
} else {
  initChatListeners();
}

/* ══════════════════════════════════════════
   MODAL: TEXTO AL COMPARTIR FOTO DEL MURO
   (se llama desde muro.js, se define aquí
    porque usa closeModal/openModal de core)
══════════════════════════════════════════ */
function pedirTextoFotoModal(onConfirm) {
  const input = $('modalTextoFotoInput');
  const okBtn = $('modalTextoFotoOk');
  if (!input || !okBtn) { onConfirm(''); return; }

  input.value = '';
  openModal('modalTextoFoto');
  setTimeout(() => input.focus(), 150);

  // Limpiar listeners anteriores clonando el botón
  const nuevoBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(nuevoBtn, okBtn);

  const confirmar = () => {
    closeModal('modalTextoFoto');
    onConfirm(input.value || '');
  };

  nuevoBtn.addEventListener('click', confirmar);
  input.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      input.removeEventListener('keydown', handler);
      confirmar();
    }
  });
}

// BUG FIX: patchIOSKeyboard eliminado — su lógica estaba duplicada con
// setupIOSKeyboardFix en utils-extra.js. Tener dos listeners de
// visualViewport.resize operando en paralelo causaba saltos de layout y
// scroll errático al abrir/cerrar el teclado en iOS/Android.
