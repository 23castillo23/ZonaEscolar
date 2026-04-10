/* ═══════════════════════════════════════════════════
   MURO PERSONAL / MURO DE OTRO MIEMBRO
═══════════════════════════════════════════════════ */
function initMuro() {
  // Resetear vista de álbum al entrar/cambiar de muro
  muroAlbumActualId = null;
  muroAlbumsCache = [];

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

  // Respetar la pestaña activa; si ninguna está activa, abrir en fotos
  const tabActiva = document.querySelector('.muro-tab.active');
  const tipoTab = tabActiva ? tabActiva.dataset.tab : 'fotos';
  qsa('.muro-tab').forEach(t => t.classList.remove('active'));
  const tabTarget = document.querySelector(`.muro-tab[data-tab="${tipoTab}"]`);
  if (tabTarget) tabTarget.classList.add('active');
  const content = $('muroContent');
  if (tipoTab === 'fotos') {
    loadMuroAlbums(uid, esPropio);
  } else {
    if (content) content.innerHTML = `<div class="feed-list" id="muroPostsList"><div class="feed-loading">Cargando…</div></div>`;
    cargarMuroPublicaciones();
  }
  // ---------------------------------------------------------------------

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

  // Filtrar por álbum activo
  // NOTA: fotos viejas no tienen groupId ni albumId; filtramos solo por authorUid
  // y aplicamos filtro de álbum en memoria para máxima compatibilidad
  const constraints = [
    where('authorUid', '==', targetUid),
    orderBy('createdAt', 'desc')
  ];

  const q = query(collection(db(), 'ec_muro_fotos'), ...constraints);

  const grid = $('muroFotosGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="feed-loading" style="grid-column:1/-1">Cargando fotos…</div>';

  if (muroFotosUnsub) { muroFotosUnsub(); muroFotosUnsub = null; }
  muroFotosUnsub = onSnapshot(q, async snap => {
    let fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));

    // Filtro en memoria por álbum (cubre fotos viejas sin campo albumId)
    if (muroAlbumActualId === '__none__') {
      fotos = fotos.filter(f => !f.albumId);
    } else if (muroAlbumActualId) {
      fotos = fotos.filter(f => f.albumId === muroAlbumActualId);
    }

    lightboxPhotos = fotos;

    if (!fotos.length) {
      const msg = muroAlbumActualId
        ? (prop ? 'Este álbum está vacío. Sube fotos con el botón "+ Foto".' : 'Este álbum está vacío.')
        : (prop ? 'No has subido fotos todavía.' : 'Este integrante aún no tiene fotos.');
      grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1;padding:30px">
        ${msg}<br>
        ${(prop && !muroAlbumActualId) ? '<span style="font-size:12px;color:var(--text3)">Usa el botón "+ Foto" para subir.</span>' : ''}
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
        const tablerosNombres = { '': '🏠 Tablero general' };
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
             ${yaCompartida ? '📌 Volver a compartir' : '📌 Compartir al Tablero'}
           </button>`
        : '';

      return `<div class="muro-photo-thumb" onclick="openLightbox(${i})">
        <img src="${escHtml(f.url)}" loading="lazy" alt="">
        ${btnDelFoto}
        <div class="muro-photo-overlay">
          ${badge}
          ${btnPublicar}
        </div>
      </div>`;
    }).join('');

    if ($('muroStats')) $('muroStats').textContent = `${fotos.length} foto${fotos.length !== 1 ? 's' : ''}`;
  });
}

// Eliminar foto del muro (propia o admin)
window.eliminarFotoMuro = function (fotoId) {
  showConfirm({
    title: 'Eliminar foto',
    message: '¿Eliminar esta foto de tu muro? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const { doc, deleteDoc, collection, query, where, getDocs } = lib();
      try {
        await deleteDoc(doc(db(), 'ec_muro_fotos', fotoId));
        const snap = await getDocs(query(collection(db(), 'ec_feed'), where('muroFotoId', '==', fotoId)));
        for (const d of snap.docs) await deleteDoc(doc(db(), 'ec_feed', d.id));
      } catch (e) { showToast('No se pudo eliminar. ' + friendlyError(e), 'error'); }
    }
  });
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
          showToast(`📌 ¡Publicación subida al inicio de "${tableroNombre}"!`, 'success');
        } else {
          // Reemplazar prompt() nativo con modal personalizado
          pedirTextoFotoModal(async (texto) => {
            try {
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
              showToast(`¡Foto publicada en "${tableroNombre}"! 📌`, 'success');
            } catch(e) { showToast('No se pudo publicar. ' + friendlyError(e), 'error'); }
          });
        }
      } catch(e) { showToast('No se pudo publicar. ' + friendlyError(e), 'error'); }
    },
    yaEn
  );
};


$('btnMuroSubir').addEventListener('click', () => {
  muroViendoUid = null;
  $('muroFileInput').click();
});
$('muroFileInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  $('muroFileInput').value = '';
  mostrarSelectorAlbum(files);
});

// Tabs del muro
qsa('.muro-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qsa('.muro-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tipo = tab.dataset.tab;
    const content = $('muroContent');
    const esAjeno = muroViendoUid && muroViendoUid !== '__pending__';
    const esPropio = !muroViendoUid;
    const uid = esAjeno ? muroViendoUid : currentUser.uid;
    if (tipo === 'fotos') {
      muroAlbumActualId = null;
      loadMuroAlbums(uid, esPropio);
    } else {
      muroAlbumActualId = null;
      if (muroAlbumsUnsub) { muroAlbumsUnsub(); muroAlbumsUnsub = null; }
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

  // Aplicar orden
  const orden = window._ordenSalas || 'fecha';
  const salasSorted = [...salas];
  if (orden === 'nombre') {
    salasSorted.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else {
    salasSorted.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }

  let html = '';

  // 1. Card "Nueva sala" (solo admin) — PRIMERO
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

  // 2. Card "General" — siempre visible
  html += `
    <button class="tablero-card tablero-general" onclick="abrirSalaChat('general','💬 General','')">
      <div class="tablero-card-inner">
        <div class="tablero-card-content">
          <span class="tablero-card-icon">💬</span>
          <div class="tablero-card-nombre">General</div>
        </div>
      </div>
    </button>`;

  // 3. Cards de salas creadas
  salasSorted.forEach(s => {
    const bg = (s.color && s.color.trim()) ? s.color : '#1a237e';
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

  // Guardar en salaFeedTitulo (oculto, para compatibilidad)
  const titulo = $('salaFeedTitulo');
  if (titulo) {
    titulo.textContent = nombre;
    if (color) titulo.style.color = color;
  }

  // ── Inyectar botón ← Salas + nombre en el topbar ──
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

  // ── Restaurar el topbar al título normal de la sección ──
  const topbarTitle = $('topbarTitle');
  if (topbarTitle) topbarTitle.innerHTML = 'Chat';
}

window.eliminarSalaActiva = function() {
  // Obtener el id desde el título (guardamos en dataset)
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

function abrirModalNuevaSala() {
  $('salaChatNombre').value = '';
  salaChatColorSeleccionado = '#1a237e';
  salaChatEmojiSeleccionado = '💬';
  $('salaChatColorPicker').querySelectorAll('.dvd-color-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.color === salaChatColorSeleccionado);
  });
  $('salaChatEmojiPicker').querySelectorAll('.tablero-emoji-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.emoji === salaChatEmojiSeleccionado);
  });
  openModal('modalNuevaSalaChat');
}
window.abrirModalNuevaSala = abrirModalNuevaSala;

// Color picker de sala ← HANDLER FALTANTE
const salaChatColorPickerEl = $('salaChatColorPicker');
if (salaChatColorPickerEl) {
  salaChatColorPickerEl.addEventListener('click', e => {
    const btn = e.target.closest('.dvd-color-opt');
    if (!btn) return;
    salaChatColorSeleccionado = btn.dataset.color;
    salaChatColorPickerEl.querySelectorAll('.dvd-color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
}
const salaChatEmojiPickerEl = $('salaChatEmojiPicker');
if (salaChatEmojiPickerEl) {
  salaChatEmojiPickerEl.addEventListener('click', e => {
    const btn = e.target.closest('.tablero-emoji-opt');
    if (!btn) return;
    salaChatEmojiSeleccionado = btn.dataset.emoji;
    salaChatEmojiPickerEl.querySelectorAll('.tablero-emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
}

// Confirmar crear sala
const btnConfirmarSala = $('btnConfirmarSalaChat');
if (btnConfirmarSala) {
  btnConfirmarSala.addEventListener('click', async () => {
    const nombre = ($('salaChatNombre')?.value || '').trim();
    if (!nombre) { showToast('Escribe un nombre para la sala.', 'warning'); return; }

    btnConfirmarSala.disabled = true;
    btnConfirmarSala.textContent = '⏳ Creando…';

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

    btnConfirmarSala.disabled = false;
    btnConfirmarSala.textContent = '💬 Crear sala';
  });
}

function initChat() {
  if (!currentGroupId) return;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  // Resetear estado de paginación al entrar a una sala
  chatOldestDoc = null;
  chatHayMas = true;
  chatCargandoMas = false;

  const box = $('chatMessages');
  if (!box) return;
  box.innerHTML = '<div class="feed-loading" id="chatLoading">Conectando…</div>';
  lastChatDateStr = '';

  const { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot } = lib();
  const LIMIT = 50;

  // ── 1. Carga inicial: los últimos 50 mensajes ──
  const qInicial = query(
    collection(db(), 'ec_chat'),
    where('groupId', '==', currentGroupId),
    where('salaId', '==', currentSalaId || 'general'),
    orderBy('createdAt', 'desc'),
    limit(LIMIT)
  );

  getDocs(qInicial).then(snap => {
    const loading = $('chatLoading');
    if (loading) loading.remove();

    if (snap.empty) {
      chatHayMas = false;
    } else {
      chatOldestDoc = snap.docs[snap.docs.length - 1]; // el más antiguo de los 50
      chatHayMas = snap.docs.length === LIMIT;

      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse(); // más antiguo primero

      lastChatDateStr = '';
      mensajes.forEach(m => appendChatMessageObj(m, box));
    }

    // Mostrar botón "cargar mensajes anteriores" si hay más
    _actualizarBotonMasChat();

    // Scroll al final en la carga inicial
    requestAnimationFrame(() => scrollChatToMyLastMessage());

    // ── 2. Listener en tiempo real solo para mensajes NUEVOS ──
    // Usamos el timestamp del mensaje más reciente como punto de partida
    const tsInicio = snap.empty ? new Date() : (snap.docs[0].data().createdAt?.toDate?.() || new Date());
    const { Timestamp } = lib();

    const qNuevos = query(
      collection(db(), 'ec_chat'),
      where('groupId', '==', currentGroupId),
      where('salaId', '==', currentSalaId || 'general'),
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
  markChatAsRead();
}

// Agrega o quita el botón "Ver mensajes anteriores" en el chat
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
    box.prepend(btn); // va arriba del todo
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

      // Insertar antes del botón (o al principio)
      const ancla = $('chatLoadMoreBtn');
      const tempDiv = document.createElement('div');
      const lastDateStr = lastChatDateStr;
      lastChatDateStr = ''; // reset para reconstruir separadores
      mensajes.forEach(m => appendChatMessageObj(m, tempDiv));
      lastChatDateStr = lastDateStr;

      if (ancla) {
        // insertBefore mantiene el orden correcto
        while (tempDiv.firstChild) {
          box.insertBefore(tempDiv.firstChild, ancla);
        }
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

window.eliminarMensaje = function (msgId) {
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

/** Avatar en burbuja: foto URL, emoji o inicial (incluye mensajes propios). */
window._zeChatAvatarBroken = function (el) {
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

  let bubbleContent = m.imageUrl
    ? `<img src="${escHtml(m.imageUrl)}" class="chat-msg-img" onclick="openChatImgLightbox('${escHtml(m.imageUrl)}')" style="cursor:pointer;max-width:220px;border-radius:10px;display:block;margin-top:4px;">`
    : escHtml(m.text);

  // ✔ enviado / ✔✔ visto
  let statusHtml = '';
  if (mine) {
    const seenByOthers = m.seenBy && Object.keys(m.seenBy).some(uid => uid !== currentUser.uid);
    statusHtml = seenByOthers
      ? `<span class="chat-seen" style="color:var(--accent2);">✔✔</span>`
      : `<span class="chat-seen">✔</span>`;
    // Marcar como visto si es ajeno
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

async function enviarMensaje() {
  const input = $('chatInput');
  const text = input?.value.trim();
  if (!text || !currentGroupId) return;

  const btn = $('chatSend');
  if (btn) btn.disabled = true;

  input.value = '';
  input.dispatchEvent(new Event('input'));

  // ── Append optimista: mostrar el mensaje al instante ──
  const msgBox = $('chatMessages');
  const tempId = 'optimist-' + Date.now();
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
      // Ahora que tenemos el ID real, inyectar el botón eliminar que faltaba
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

/* ── LISTENERS CHAT (solo si existe el DOM; evita errores en vistas parciales) ── */
const _chatSend = $('chatSend');
const _chatInput = $('chatInput');
if (_chatSend) _chatSend.addEventListener('click', enviarMensaje);

if (_chatInput) {
  _chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  _chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  _chatInput.addEventListener('focus', () => {
    setTimeout(() => ajustarScrollChat(false), 300);
    setTimeout(() => ajustarScrollChat(false), 600);
  });

  _chatInput.addEventListener('blur', () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 150);
  });
}

const _chatImgBtn = $('chatImgBtn');
const _chatImgInput = $('chatImgInput');
if (_chatImgBtn && _chatImgInput) {
  _chatImgBtn.addEventListener('click', () => _chatImgInput.click());
}

if (_chatImgInput) _chatImgInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || !currentGroupId) return;

  const btn = _chatImgBtn || $('chatImgBtn');
  if (btn) {
    btn.textContent = '⏳';
    btn.disabled = true;
  }

  try {
    const url = await uploadToCloudinary(file);
    if (!url) { showToast('No se pudo subir la imagen.', 'error'); throw new Error('upload_failed'); }

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
    if (err.message !== 'upload_failed') {
      console.error('Error enviando imagen al chat:', err);
      showToast('No se pudo enviar la imagen. Intenta de nuevo.', 'error');
    }
  } finally {
    if (btn) {
      btn.textContent = '📷';
      btn.disabled = false;
    }
    _chatImgInput.value = '';
  }
});


/* ── Modal de texto para compartir foto del muro ── */
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
