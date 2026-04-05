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
  dentroDeTablero = true;
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
    titulo.textContent = '🏠 Tablero general';
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
  dentroDeTablero = false;
  currentTableroId = null;
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }

  const vistaFeed = $('vistaFeedTablero');
  const vistaTableros = $('vistaTableros');

  // Ocultamos el feed del tablero
  if (vistaFeed) vistaFeed.style.display = 'none';

  // Si venías de la galería de tableros, la volvemos a mostrar
if (currentSection === 'feed' && vistaTableros) {
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
window._ordenSalas = localStorage.getItem('ze_orden_salas') || 'fecha';
window.toggleOrdenSalas = function() {
  window._ordenSalas = window._ordenSalas === 'fecha' ? 'nombre' : 'fecha';
  localStorage.setItem('ze_orden_salas', window._ordenSalas);
  const btn = $('btnSortSalas');
  if (btn) btn.textContent = window._ordenSalas === 'nombre' ? '🔤 A-Z' : '📅 Fecha';
  // Re-renderizar con el nuevo orden
  if (salasUnsub) initSalasChat();
};
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
  if (!nombre) { showToast('Escribe el nombre del tablero.', 'warning'); return; }
  if (!isAdmin) { showToast('Solo el administrador puede crear tableros.', 'error'); return; }

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
    showToast('No se pudo crear el tablero. ' + friendlyError(e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear Tablero';
  }
});

window.eliminarTablero = function(tableroId, nombre) {
  if (!isAdmin) return;
  showConfirm({
    title: 'Eliminar tablero',
    message: `¿Eliminar el tablero "${nombre}"? Las publicaciones dentro no se borran.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      try {
        const { doc, deleteDoc } = lib();
        await deleteDoc(doc(db(), 'ec_tableros', tableroId));
        if (currentTableroId === tableroId) cerrarTablero();
      } catch (e) {
        showToast('No se pudo eliminar. ' + friendlyError(e), 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════
   FEED
═══════════════════════════════════════════════════ */
function initFeed() {
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  window._feedPostsCache = [];

  const { collection, query, where, orderBy, limit, onSnapshot, startAfter, getDocs } = lib();

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
    feedOldestDoc = null;
    feedHayMas = true;
    feedCargandoMas = false;

    const { getDocs, startAfter } = lib();
    const LIMIT = 30;

    const qInicial = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      orderBy('createdAt', 'desc'),
      limit(LIMIT)
    );

    getDocs(qInicial).then(snap => {
      const posts = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.tableroId) posts.push({ id: d.id, ...data });
      });

      if (snap.docs.length > 0) {
        feedOldestDoc = snap.docs[snap.docs.length - 1];
        feedHayMas = snap.docs.length === LIMIT;
      } else {
        feedHayMas = false;
      }

      window._feedPostsCache = posts;
      renderFeed(posts);
      _actualizarBotonMasFeed();
    }).catch(onErr);

    // Tiempo real solo para posts nuevos
    feedUnsub = onSnapshot(query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('tableroId', '==', ''),
      orderBy('createdAt', 'desc'),
      limit(5)
    ), { includeMetadataChanges: false }, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const p = { id: change.doc.id, ...change.doc.data() };
          const cache = window._feedPostsCache || [];
          const yaEnCache = cache.find(x => x.id === p.id);
          if (!yaEnCache) {
            // Insertar al inicio del cache (mas reciente primero) y re-renderizar en columnas
            window._feedPostsCache = [p, ...cache];
            renderFeed(window._feedPostsCache);
            _actualizarBotonMasFeed();
          }
        }
        if (change.type === 'removed') {
          window._feedPostsCache = (window._feedPostsCache || []).filter(x => x.id !== change.doc.id);
          renderFeed(window._feedPostsCache);
          _actualizarBotonMasFeed();
        }
        if (change.type === 'modified') {
          const p = { id: change.doc.id, ...change.doc.data() };
          window._feedPostsCache = (window._feedPostsCache || []).map(x => x.id === p.id ? p : x);
          renderFeed(window._feedPostsCache);
        }
      });
    }, onErr);
  }
}

function _actualizarBotonMasFeed() {
  const feedList = $('feedList');
  if (!feedList) return;
  let btn = $('feedLoadMoreBtn');
  if (feedHayMas && !btn) {
    btn = document.createElement('div');
    btn.id = 'feedLoadMoreBtn';
    btn.className = 'feed-loading';
    btn.style.cssText = 'cursor:pointer;color:var(--accent);padding:16px;text-align:center;';
    btn.textContent = '↓ Ver publicaciones anteriores';
    btn.onclick = cargarMasPostsFeed;
    feedList.appendChild(btn);
  } else if (!feedHayMas && btn) {
    btn.remove();
  }
}

async function cargarMasPostsFeed() {
  if (feedCargandoMas || !feedHayMas || !feedOldestDoc) return;
  feedCargandoMas = true;

  const btn = $('feedLoadMoreBtn');
  if (btn) btn.textContent = '⏳ Cargando…';

  const { collection, query, where, orderBy, limit, startAfter, getDocs } = lib();
  const LIMIT = 30;

  try {
    const q = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      orderBy('createdAt', 'desc'),
      startAfter(feedOldestDoc),
      limit(LIMIT)
    );

    const snap = await getDocs(q);
    const posts = [];
    snap.forEach(d => {
      const data = d.data();
      if (!data.tableroId) posts.push({ id: d.id, ...data });
    });

    if (snap.docs.length > 0) {
      feedOldestDoc = snap.docs[snap.docs.length - 1];
      feedHayMas = snap.docs.length === LIMIT;
    } else {
      feedHayMas = false;
    }

    const feedList = $('feedList');
    const ancla = $('feedLoadMoreBtn');
    posts.forEach(p => {
      const card = document.createElement('div');
      card.innerHTML = buildFeedCard(p);
      const cardEl = card.firstElementChild;
      if (cardEl) {
        if (ancla) feedList.insertBefore(cardEl, ancla);
        else feedList.appendChild(cardEl);
        bindFeedCard(cardEl, p.id);
      }
    });

  } catch (e) {
    console.error('Error cargando más posts:', e);
  } finally {
    feedCargandoMas = false;
    _actualizarBotonMasFeed();
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
      const dvdId = toggleBtn.dataset.dvdId;
      const dvdUrl = toggleBtn.dataset.dvdUrl;
      if (dvdId || dvdUrl) {
        // Videotutorial: abrir modal con los comentarios del DVD
        abrirModalComentariosDvd(dvdId, dvdUrl, postId, cardEl, toggleBtn);
      } else {
        abrirModalComentarios(postId, cardEl);
      }
    });
  }
}

/* ── Modal comentarios para videotutorial compartido en feed ── */
async function abrirModalComentariosDvd(dvdId, dvdUrl, feedPostId, cardEl, toggleBtn) {
  const { collection, query, where, getDocs, doc, getDoc } = lib();
  let resolvedDvdId = dvdId;

  // Si no tenemos dvdId, buscar por URL
  if (!resolvedDvdId && dvdUrl) {
    try {
      const snap = await getDocs(query(collection(db(), 'ec_videotutoriales'), where('url', '==', dvdUrl)));
      if (!snap.empty) resolvedDvdId = snap.docs[0].id;
    } catch(e) { console.error(e); }
  }

  if (!resolvedDvdId) {
    // Fallback: abrir el modal normal del feed
    abrirModalComentarios(feedPostId, cardEl);
    return;
  }

  // Guardar dvdId en el botón para futuras veces
  if (toggleBtn) toggleBtn.dataset.dvdId = resolvedDvdId;

  // Abrir el modal de comentarios usando el dvdId como postId
  // pero sin actualizar commentCount del feed (los DVDs no tienen ese campo en feed)
  abrirModalComentariosConId(resolvedDvdId, cardEl, feedPostId, toggleBtn);
}

/* ── Modal comentarios genérico con postId explícito ── */
function abrirModalComentariosConId(commentPostId, cardEl, feedPostId, toggleBtn) {
  let modal = document.getElementById('comments-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'comments-modal-overlay';
    modal.className = 'comments-modal-overlay';
    modal.innerHTML = `
      <div class="comments-modal-window" id="comments-modal-window">
        <div class="comments-modal-header">
          <span class="comments-modal-title" id="comments-modal-title">💬 Comentarios</span>
          <button class="comments-modal-close" id="comments-modal-close">✕</button>
        </div>
        <div class="comments-modal-body">
          <div class="comments-modal-list" id="comments-modal-list"></div>
        </div>
        <div class="comments-modal-footer">
          <img class="feed-comment-avatar" id="comments-modal-avatar" src="${escHtml(currentUser.avatar || '')}" alt="" onerror="this.style.display='none'">
          <input type="text" class="comments-modal-input" id="comments-modal-input" placeholder="Escribe un comentario…" maxlength="300">
          <button class="comments-modal-send" id="comments-modal-send">➤</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  const list = document.getElementById('comments-modal-list');
  list.innerHTML = '';
  if (modal._prevUnsub) { modal._prevUnsub(); modal._prevUnsub = null; }

  document.getElementById('comments-modal-title').textContent = `💬 Comentarios del video`;
  modal.classList.add('active');
  _lockBodyScroll();

  const { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, increment, deleteDoc, serverTimestamp } = lib();
  const q = query(
    collection(db(), 'ec_comentarios'),
    where('postId', '==', commentPostId),
    orderBy('createdAt', 'asc')
  );

  const unsub = onSnapshot(q, snap => {
    const cnt = snap.size;
    // Actualizar botón toggle en la card del feed
    if (toggleBtn) toggleBtn.textContent = `📝 ${cnt > 0 ? cnt + ' notas' : 'Añadir nota'}`;

    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const c = { id: change.doc.id, ...change.doc.data() };
        if (list.querySelector(`[data-comment-id="${c.id}"]`)) return;
        const esMio = c.authorUid === currentUser.uid;
        const btnDel = (esMio || isAdmin)
          ? `<button class="comment-del-btn" onclick="eliminarComentarioDvd('${c.id}','${commentPostId}')" title="Eliminar">🗑️</button>`
          : '';
        const items = list.querySelectorAll('.feed-comment-item');
        const lastItem = items.length ? items[items.length - 1] : null;
        const sameAuthor = lastItem?.dataset.authorUid === c.authorUid;

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
        list.scrollTop = list.scrollHeight;
      }
      if (change.type === 'removed') {
        const el = list.querySelector(`[data-comment-id="${change.doc.id}"]`);
        if (el) {
          const next = el.nextElementSibling;
          if (next?.classList.contains('same-author') && !el.classList.contains('same-author')) next.classList.remove('same-author');
          el.remove();
        }
        if (!list.querySelector('.feed-comment-item')) {
          list.innerHTML = '<div class="comment-empty-msg">Sé el primero en comentar. 👋</div>';
        }
      }
    });
    if (!list.querySelector('.feed-comment-item') && !list.querySelector('.comment-empty-msg')) {
      list.innerHTML = '<div class="comment-empty-msg">Sé el primero en comentar. 👋</div>';
    }
  });
  modal._prevUnsub = unsub;
  modal._postId = commentPostId;

  const sendBtn = document.getElementById('comments-modal-send');
  const input = document.getElementById('comments-modal-input');
  const newSend = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSend, sendBtn);
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  async function enviar() {
    const text = newInput.value.trim();
    if (!text) return;
    newSend.disabled = true;
    try {
      await addDoc(collection(db(), 'ec_comentarios'), {
        postId: commentPostId,
        groupId: currentGroupId,
        text,
        authorUid: currentUser.uid,
        authorName: getUserAlias(),
        authorEmail: currentUser.email,
        authorAvatar: currentUser.avatar || '',
        createdAt: serverTimestamp()
      });
      newInput.value = '';
    } catch(e) { console.error('Error al comentar:', e); }
    finally { newSend.disabled = false; }
  }

  newSend.addEventListener('click', enviar);
  newInput.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

  // Cerrar modal
  const closeBtn = document.getElementById('comments-modal-close');
  const newClose = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);
  newClose.addEventListener('click', () => {
    modal.classList.remove('active');
    _unlockBodyScroll();
    if (modal._prevUnsub) { modal._prevUnsub(); modal._prevUnsub = null; }
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('active');
      _unlockBodyScroll();
      if (modal._prevUnsub) { modal._prevUnsub(); modal._prevUnsub = null; }
    }
  }, { once: true });
}

/* ── Modal comentarios del feed ── */
function abrirModalComentarios(postId, cardEl) {
  // Si ya existe el modal para este post, solo mostrarlo
  let modal = document.getElementById('comments-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'comments-modal-overlay';
    modal.className = 'comments-modal-overlay';
    modal.innerHTML = `
      <div class="comments-modal-window" id="comments-modal-window">
        <div class="comments-modal-header">
          <span class="comments-modal-title" id="comments-modal-title">💬 Comentarios</span>
          <button class="comments-modal-close" id="comments-modal-close">✕</button>
        </div>
        <div class="comments-modal-body">
          <div class="comments-modal-list" id="comments-modal-list"></div>
        </div>
        <div class="comments-modal-footer">
          <img class="feed-comment-avatar" id="comments-modal-avatar" src="${escHtml(currentUser.avatar || '')}" alt="" onerror="this.style.display='none'">
          <input type="text" class="comments-modal-input" id="comments-modal-input" placeholder="Escribe un comentario…" maxlength="300">
          <button class="comments-modal-send" id="comments-modal-send">➤</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Limpiar lista y estado previo
  const list = document.getElementById('comments-modal-list');
  list.innerHTML = '';
  if (modal._prevUnsub) { modal._prevUnsub(); modal._prevUnsub = null; }

  // Título con nombre de autor de la publicación
  const authorName = cardEl.querySelector('.feed-card-author')?.textContent || 'Publicación';
  document.getElementById('comments-modal-title').textContent = `💬 ${authorName}`;

  // Mostrar modal
  modal.classList.add('active');
  _lockBodyScroll();

  // Sección oculta original (se sigue usando para el contador)
  const section = cardEl.querySelector('.feed-comments-section');

  // Construir unsub de Firestore directo sobre el modal list
  const { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, increment, deleteDoc, serverTimestamp } = lib();
  const q = query(
    collection(db(), 'ec_comentarios'),
    where('postId', '==', postId),
    orderBy('createdAt', 'asc')
  );

  const unsub = onSnapshot(q, snap => {
    if (section) section.dataset.count = String(snap.size);
    // Actualizar botón en la card
    const toggleBtn = cardEl.querySelector('.feed-comments-toggle');
    if (toggleBtn) {
      const cnt = snap.size;
      toggleBtn.textContent = `📝 ${cnt > 0 ? cnt + ' notas' : 'Añadir nota'}`;
    }

    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const c = { id: change.doc.id, ...change.doc.data() };
        if (list.querySelector(`[data-comment-id="${c.id}"]`)) return;
        const esMio = c.authorUid === currentUser.uid;
        const btnDel = (esMio || isAdmin)
          ? `<button class="comment-del-btn" onclick="eliminarComentarioModal('${c.id}','${postId}')" title="Eliminar">🗑️</button>`
          : '';
        const items = list.querySelectorAll('.feed-comment-item');
        const lastItem = items.length ? items[items.length - 1] : null;
        const sameAuthor = lastItem?.dataset.authorUid === c.authorUid;

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
        list.scrollTop = list.scrollHeight;
      }
      if (change.type === 'removed') {
        const el = list.querySelector(`[data-comment-id="${change.doc.id}"]`);
        if (el) {
          const next = el.nextElementSibling;
          if (next?.classList.contains('same-author') && !el.classList.contains('same-author')) {
            next.classList.remove('same-author');
          }
          el.remove();
        }
        if (!list.querySelector('.feed-comment-item')) {
          list.innerHTML = '<div class="comment-empty-msg">Sé el primero en comentar. 👋</div>';
        }
      }
    });
    if (!list.querySelector('.feed-comment-item') && !list.querySelector('.comment-empty-msg')) {
      list.innerHTML = '<div class="comment-empty-msg">Sé el primero en comentar. 👋</div>';
    }
  });
  modal._prevUnsub = unsub;
  modal._postId = postId;

  // Enviar comentario
  const sendBtn = document.getElementById('comments-modal-send');
  const input = document.getElementById('comments-modal-input');

  // Limpiar listeners previos clonando los botones
  const newSend = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSend, sendBtn);
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  async function enviarDesdeModal() {
    const text = newInput.value.trim();
    if (!text) return;
    newSend.disabled = true;
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
      await updateDoc(doc(db(), 'ec_feed', postId), { commentCount: increment(1) });
      newInput.value = '';
    } catch (e) { console.error('Error al comentar:', e); }
    finally { newSend.disabled = false; }
  }

  newSend.addEventListener('click', enviarDesdeModal);
  newInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarDesdeModal(); }
  });
  setTimeout(() => newInput.focus(), 100);

  // Cerrar modal
  function cerrarModal() {
    modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.open, .comments-modal-overlay.active')) {
      _unlockBodyScroll();
    }
    if (modal._prevUnsub) { modal._prevUnsub(); modal._prevUnsub = null; }
  }
  const closeBtn = document.getElementById('comments-modal-close');
  const newClose = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);
  newClose.addEventListener('click', cerrarModal);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); }, { once: true });
}

window.eliminarComentarioModal = function(comentarioId, postId) {
  showConfirm({
    title: 'Eliminar comentario',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarComentarioModal('${comentarioId}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc, updateDoc, increment } = lib();
      try {
        await deleteDoc(doc(db(), 'ec_comentarios', comentarioId));
        await updateDoc(doc(db(), 'ec_feed', postId), { commentCount: increment(-1) });
      } catch (e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

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
    list.innerHTML = '<div class=\"feed-loading\">El tablero está vacío. ¡Sé el primero en publicar!</div>';
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

    const puedeGestionarVotacion = isAdmin || (p.authorUid === currentUser.uid);
    const votacionGestionHtml = puedeGestionarVotacion ? `
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${activa
          ? `<button class="btn-sm btn-sm-danger" style="font-size:11px" onclick="cerrarVotacionPanel('${p.votacionId}')">🔒 Cerrar</button>
             <button class="btn-sm btn-sm-danger" style="font-size:11px" onclick="eliminarVotacionPanel('${p.votacionId}','${escHtml(p.pregunta || '')}')">🗑️ Eliminar</button>`
          : `<button class="btn-sm" style="font-size:11px" onclick="reabrirVotacionPanel('${p.votacionId}')">🔓 Reabrir</button>
             <button class="btn-sm btn-sm-danger" style="font-size:11px" onclick="eliminarVotacionPanel('${p.votacionId}','${escHtml(p.pregunta || '')}')">🗑️ Eliminar</button>`
        }
      </div>` : '';

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
        ${votacionGestionHtml}
      </div>
      <div class="feed-card-actions">
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
    const dvdIdAttr = p.dvdId ? escHtml(p.dvdId) : '';
    const dvdUrlAttr = escHtml(p.dvdData.url || '');
    extraContentHtml = `
      <div class="feed-dvd-shared" style="cursor:pointer" onclick="verComentariosDvdDesdeFeed('${dvdIdAttr}','${dvdUrlAttr}')">
        <div class="dvd-rect-thumb">
          <img src="${p.dvdData.thumbnail}" alt="" class="dvd-rect-img">
          <div class="dvd-rect-play-overlay" style="opacity: 1; background: rgba(0,0,0,0.45);">▶</div>
        </div>
        <div class="feed-dvd-info">
          <h4>${escHtml(p.dvdData.titulo)}</h4>
          <span style="font-size:12px; color:var(--accent); margin-top:4px; display:inline-block;">💬 Ver y comentar →</span>
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
      <button class="feed-comments-toggle" data-post="${p.id}"${p.dvdId ? ` data-dvd-id="${escHtml(p.dvdId)}"` : p.dvdData?.url ? ` data-dvd-url="${escHtml(p.dvdData.url)}"` : ''}>
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

window.eliminarComentario = function (comentarioId, postId) {
  showConfirm({
    title: 'Eliminar comentario',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarComentario('${comentarioId}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc, updateDoc, increment } = lib();
      try {
        await deleteDoc(doc(db(), 'ec_comentarios', comentarioId));
        await updateDoc(doc(db(), 'ec_feed', postId), { commentCount: increment(-1) });
      } catch (e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
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
  const { doc, deleteDoc, getDoc } = lib();
  try {
    const snap = await getDoc(doc(db(), 'ec_feed', postId));
    if (!snap.exists()) return;
    const data = snap.data();

    const esMio = data.authorUid === currentUser.uid;
    const autorEnGrupo = data.authorEmail && currentGroupData?.miembros?.includes(data.authorEmail);

    // Puede eliminar: el propio autor, o el admin si el autor ya no está en el grupo
    if (!esMio && !(isAdmin && !autorEnGrupo)) {
      if (isAdmin && autorEnGrupo) {
        showToast('🛡️ No puedes borrar esto. Solo el autor puede eliminar sus publicaciones mientras siga en el grupo.', 'info');
      } else {
        showToast('Solo puedes eliminar tus propias publicaciones.', 'info');
      }
      return;
    }
    
    showConfirm({
      title: 'Eliminar publicación',
      message: '¿Eliminar esta publicación? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db(), 'ec_feed', postId));
          // El listener 'removed' del onSnapshot elimina la tarjeta del DOM automáticamente
        } catch (e) {
          showToast('No se pudo eliminar. ' + friendlyError(e), 'error');
        }
      }
    });
  } catch (e) { showToast('No se pudo eliminar. ' + friendlyError(e), 'error'); }
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
      showToast('❌ Error: Cloudinary rechazó la imagen. (Abre la consola F12 para ver el motivo exacto). Tienes que crear tu propia cuenta gratis en cloudinary.com y cambiar las credenciales al inicio de app.js', 'error');
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
    showToast('No se pudo publicar. ' + friendlyError(e), 'error');
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

