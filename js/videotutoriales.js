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
  const infoBtn = `<button class="dvd-info-btn" data-id="${dvd.id}" title="Ver descripción y comentarios" onclick="event.stopPropagation()">ℹ️</button>`;
  const avatarLetra = addedBy ? addedBy.trim().charAt(0).toUpperCase() : '?';

  return `
    <div class="dvd-item dvd-item-rect" data-id="${dvd.id}" data-cat="${escHtml(dvd.categoria || '')}" data-titulo="${titulo.toLowerCase()}" style="border-top: 4px solid ${color}">
      ${delBtn}
      <div class="dvd-rect-thumb" style="background:${color}">
        ${thumb ? `<img src="${thumb}" alt="${titulo}" loading="lazy" class="dvd-rect-img">` : '<div class="dvd-rect-noimg">▶</div>'}
        <div class="dvd-rect-play-overlay">▶</div>
        ${cat ? `<div class="dvd-cat-badge">${cat}</div>` : ''}
      </div>
      <div class="dvd-rect-info">
        <div class="dvd-rect-title">${titulo}</div>
        ${desc ? `<div class="dvd-rect-desc">${desc}</div>` : ''}
        <div class="dvd-rect-bottom">
        ${addedBy ? `
          <div class="dvd-rect-meta">
            <div class="dvd-rect-meta-avatar">${avatarLetra}</div>
            <span>${addedBy}</span>
          </div>` : '<div></div>'}
        <div style="display:flex;gap:6px">
          ${infoBtn}
          <button class="dvd-share-btn" onclick="event.stopPropagation(); compartirDvd('${dvd.id}')" title="Compartir al Tablero">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 3C16 2.44772 15.5523 2 15 2H9C8.44772 2 8 2.44772 8 3V4C8 4.55228 8.44772 5 9 5H9.5L8.28 10H5C4.44772 10 4 10.4477 4 11V12C4 12.5523 4.44772 13 5 13H11V21C11 21.5523 11.4477 22 12 22C12.5523 22 13 21.5523 13 21V13H19C19.5523 13 20 12.5523 20 12V11C20 10.4477 19.5523 10 19 10H15.72L14.5 5H15C15.5523 5 16 4.55228 16 4V3Z"/>
              </svg>
            </button>
          </div>
        </div>
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

  // Calcular el color más frecuente por categoría
  const catColor = {};
  dvds.forEach(d => {
    if (d.categoria && d.color) {
      if (!catColor[d.categoria]) catColor[d.categoria] = {};
      catColor[d.categoria][d.color] = (catColor[d.categoria][d.color] || 0) + 1;
    }
  });
  const getTopColor = cat => {
    if (!catColor[cat]) return null;
    return Object.entries(catColor[cat]).sort((a, b) => b[1] - a[1])[0][0];
  };

  bar.innerHTML = `<button class="dvd-cat-btn ${dvdFiltroCategoria === 'all' ? 'active' : ''}" data-cat="all">Todos</button>` +
    cats.map(c => {
      const col = getTopColor(c);
      const colStyle = col ? `style="border-color:${col};color:${col}"` : '';
      const activeStyle = col ? `style="background:${col};border-color:${col};color:#fff"` : '';
      return `<button class="dvd-cat-btn ${dvdFiltroCategoria === c ? 'active' : ''}" data-cat="${escHtml(c)}" ${dvdFiltroCategoria === c ? activeStyle : colStyle}>${escHtml(c)}</button>`;
    }).join('');

  bar.querySelectorAll('.dvd-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dvdFiltroCategoria = btn.dataset.cat;
      bar.querySelectorAll('.dvd-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Re-renderizar con el color activo aplicado
      renderDvdCats(dvds);
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
      if (e.target.classList.contains('dvd-info-btn')) return;
      const dvd = dvds.find(d => d.id === item.dataset.id);
      if (dvd && dvd.url) window.open(dvd.url, '_blank', 'noopener');
    });
  });

  // Botones eliminar
  grid.querySelectorAll('.dvd-del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      showConfirm({
        title: 'Eliminar tutorial',
        message: '¿Eliminar este tutorial? Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        onConfirm: async () => {
          const { doc, deleteDoc } = lib();
          await deleteDoc(doc(db(), 'ec_videotutoriales', btn.dataset.id));
        }
      });
    });
  });

  // Botón info → abrir modal de detalle
  grid.querySelectorAll('.dvd-info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dvd = dvds.find(d => d.id === btn.dataset.id);
      if (!dvd) return;
      abrirDetalleDvd(dvd);
    });
  });
}

/* ── Modal Detalle DVD ── */
let dvdDetalleUnsub = null;

function abrirDetalleDvd(dvd) {
  const color = dvd.color || '#1a237e';
  $('dvdDetalleTitulo').textContent = dvd.titulo || 'Sin título';
  $('dvdDetalleThumb').src = dvd.thumbnail || '';
  $('dvdDetalleLink').href = dvd.url || '#';
  const catEl = $('dvdDetalleCat');
  catEl.textContent = dvd.categoria || '';
  catEl.style.background = color;
  $('dvdDetalleThumbWrap').style.borderTop = `4px solid ${color}`;
  $('dvdDetalleDesc').textContent = dvd.descripcion || 'Sin descripción.';

  // Limpiar comentarios previos
  const list = $('dvdDetalleCommentsList');
  list.innerHTML = '<div class="comment-empty-msg" style="font-size:12px;color:var(--text3)">Sé el primero en comentar.</div>';
  if (dvdDetalleUnsub) { dvdDetalleUnsub(); dvdDetalleUnsub = null; }

  // Cargar comentarios en tiempo real
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_comentarios'),
    where('postId', '==', dvd.id),
    orderBy('createdAt', 'asc')
  );
  dvdDetalleUnsub = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const c = { id: change.doc.id, ...change.doc.data() };
        if (list.querySelector(`[data-comment-id="${c.id}"]`)) return;
        const esMio = c.authorUid === currentUser.uid;
        const btnDel = (esMio || isAdmin)
          ? `<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--red)" onclick="eliminarComentarioDvd('${c.id}','${dvd.id}')">🗑️</button>`
          : '';
        const el = document.createElement('div');
        el.dataset.commentId = c.id;
        el.style.cssText = 'display:flex;gap:8px;align-items:flex-start';
        el.innerHTML = `
          <img src="${escHtml(c.authorAvatar || '')}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">
          <div style="flex:1;background:var(--bg2);border-radius:8px;padding:6px 10px">
            <div style="font-size:11px;font-weight:600;color:var(--text1)">${escHtml(c.authorName || 'Anónimo')}</div>
            <div style="font-size:13px;color:var(--text2);margin-top:2px">${escHtml(c.text)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">${fmtTime(c.createdAt)} ${btnDel}</div>
          </div>`;
        const empty = list.querySelector('.comment-empty-msg');
        if (empty) empty.remove();
        list.appendChild(el);
        list.scrollTop = list.scrollHeight;
      }
      if (change.type === 'removed') {
        const el = list.querySelector(`[data-comment-id="${change.doc.id}"]`);
        if (el) el.remove();
        if (!list.querySelector('[data-comment-id]')) {
          list.innerHTML = '<div class="comment-empty-msg" style="font-size:12px;color:var(--text3)">Sé el primero en comentar.</div>';
        }
      }
    });
  });

  // Enviar comentario
  const input = $('dvdDetalleCommentInput');
  const sendBtn = $('dvdDetalleCommentSend');
  // Clonar para quitar listeners anteriores
  const newSend = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSend, sendBtn);
  input.value = '';

  const enviar = async () => {
    const text = input.value.trim();
    if (!text) return;
    newSend.disabled = true;
    const { collection: col, addDoc, serverTimestamp } = lib();
    try {
      await addDoc(col(db(), 'ec_comentarios'), {
        postId: dvd.id,
        groupId: currentGroupId,
        text,
        authorUid: currentUser.uid,
        authorName: getUserAlias(),
        authorEmail: currentUser.email,
        authorAvatar: currentUser.avatar || '',
        createdAt: serverTimestamp()
      });
      input.value = '';
    } catch(e) { showToast(friendlyError(e), 'error'); }
    newSend.disabled = false;
  };

  newSend.addEventListener('click', enviar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

  openModal('modalDetalleDvd');
}

window.eliminarComentarioDvd = async function(comentarioId, dvdId) {
  showConfirm({
    title: 'Eliminar comentario',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
  const { doc, deleteDoc } = lib();
  try { await deleteDoc(doc(db(), 'ec_comentarios', comentarioId)); }
  catch(e) { showToast(friendlyError(e), 'error'); }
    }
  });
};

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
    if (!videoId) { showToast('No se reconoce como un link de YouTube válido.', 'info'); return; }
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

    if (!url) { showToast('Pega un link de YouTube.', 'warning'); return; }
    const videoId = extraerYoutubeId(url);
    if (!videoId) { showToast('No se reconoce como un link de YouTube válido.', 'info'); return; }
    if (!titulo) { showToast('Escribe un título para el tutorial.', 'warning'); return; }

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
      showToast('No se pudo guardar. ' + friendlyError(e), 'error');
    }

    btnConfirmarDvd.disabled = false;
    btnConfirmarDvd.textContent = '💾 Guardar DVD';
  });
}
