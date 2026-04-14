/* ═══════════════════════════════════════════════════
   VIDEOTUTORIALES — Cajas DVD, comentarios de video,
   categorías, favoritos, compartir al tablero.
   
   Dependencias: core.js, grupos.js, utils-extra.js
   Colecciones: ec_videotutoriales
   
   REGLA: abrirDetalleDvd() vive aquí.
   utils-extra.js lo expone vía onclick directo.
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   VIDEOTUTORIALES — Cajas de DVD con thumbnails de YouTube
═══════════════════════════════════════════════════════ */

let dvdUnsub = null;
let dvdColorSeleccionado = '#1a237e';
let dvdFiltroCategoria = 'all';
let dvdBusqueda = '';
let dvdFiltroFavs = false;
let dvdOrden = 'fecha_desc'; // 'fecha_desc' | 'fecha_asc' | 'az' | 'za'

const DVD_ORDENES = [
  { key: 'fecha_desc', icon: '📅', label: 'Recientes' },
  { key: 'fecha_asc',  icon: '📅', label: 'Antiguos'  },
  { key: 'az',         icon: '🔤', label: 'A → Z'     },
  { key: 'za',         icon: '🔤', label: 'Z → A'     },
];

window.dvdCiclarOrden = function() {
  const idx = DVD_ORDENES.findIndex(o => o.key === dvdOrden);
  dvdOrden = DVD_ORDENES[(idx + 1) % DVD_ORDENES.length].key;
  dvdActualizarBtnOrden();
  filtrarDvds();
};

function dvdActualizarBtnOrden() {
  const config = DVD_ORDENES.find(o => o.key === dvdOrden) || DVD_ORDENES[0];
  const iconEl = $('dvdSortIcon');
  const labelEl = $('dvdSortLabel');
  const btn = $('btnDvdSort');
  if (iconEl) iconEl.textContent = config.icon;
  if (labelEl) labelEl.textContent = config.label;
  if (btn) btn.classList.toggle('active', dvdOrden !== 'fecha_desc');
}

function dvdOrdenarArray(dvds) {
  const arr = [...dvds];
  if (dvdOrden === 'fecha_desc') {
    arr.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } else if (dvdOrden === 'fecha_asc') {
    arr.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  } else if (dvdOrden === 'az') {
    arr.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' }));
  } else if (dvdOrden === 'za') {
    arr.sort((a, b) => (b.titulo || '').localeCompare(a.titulo || '', 'es', { sensitivity: 'base' }));
  }
  return arr;
}

/** Convierte #RGB / #RRGGBB / rgb(r,g,b) a {r,g,b} o null */
function dvdHexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim();

  // BUG-33: Soporte para formato rgb(r, g, b)
  const rgbMatch = h.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }

  if (h.length === 4 && h[0] === '#') {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null;
}

/** Luminancia relativa 0–1 (WCAG) — colores oscuros < ~0.3 */
function dvdColorLuminance(hex) {
  const rgb = dvdHexToRgb(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Estilos de botón de categoría: en modo oscuro los bordes/textos con color puro (#1a237e, etc.)
 * casi no se ven. Usamos fondo tintado + borde aclarado y texto con variable de tema.
 */
function dvdCatBtnStyles(hex, isActive) {
  // Solo usamos el color para la línea inferior (--dvd-cat-line),
  // el diseño de tabs lo controla el CSS. No inyectamos background ni border.
  if (!hex) return '';
  return `--dvd-cat-line:${hex};`;
}

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
  const esFav = getDvdFavs().includes(dvd.id);
  const favBtn = `<button class="dvd-fav-toggle ${esFav ? 'active' : ''}" data-id="${dvd.id}" title="${esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" onclick="event.stopPropagation()">${esFav ? '★' : '☆'}</button>`;

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
          ${favBtn}
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

  // Iniciar listener de favoritos del usuario (Firestore)
  initDvdFavs();

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
    dvdActualizarCategoriasConocidas(dvds);
    renderDvdGrid(dvds);
    renderDvdCats(dvds);
  }, err => {
    console.error('DVD listener error:', err);
    const grid = $('dvdGrid');
    if (grid) grid.innerHTML = `<div class="dvd-empty"><div class="dvd-empty-icon">⚠️</div><div class="dvd-empty-text">Error al cargar tutoriales.<br>Revisa la consola.</div></div>`;
  });
}

/* ── Scroll de categorías con flechas ── */
window.dvdScrollCats = function(dir) {
  const bar = $('dvdCatsBar');
  if (!bar) return;
  bar.scrollBy({ left: dir * 200, behavior: 'smooth' });
};

function dvdUpdateArrows(bar) {
  const left = $('dvdCatsArrowLeft');
  const right = $('dvdCatsArrowRight');
  if (!left || !right) return;
  const canLeft = bar.scrollLeft > 4;
  const canRight = bar.scrollLeft < bar.scrollWidth - bar.clientWidth - 4;
  left.classList.toggle('visible', canLeft);
  right.classList.toggle('visible', canRight);
  // Ocultar flecha si no hay contenido que scrollear
  left.style.visibility = canLeft ? 'visible' : 'hidden';
  right.style.visibility = canRight ? 'visible' : 'hidden';
}

/* ── Renderizar categorías ── */
function renderDvdCats(dvds) {
  const bar = $('dvdCatsBar');
  if (!bar) return;

  // Conectar listener de scroll para actualizar flechas (solo una vez)
  if (!bar._arrowListener) {
    bar._arrowListener = true;
    bar.addEventListener('scroll', () => dvdUpdateArrows(bar), { passive: true });
  }

  const cats = [...new Set(dvds.map(d => d.categoria).filter(Boolean))];

  // Calcular color más frecuente por categoría (restaurado)
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

  // Contar videos por categoría
  const conteo = { all: dvds.length };
  dvds.forEach(d => {
    if (d.categoria) conteo[d.categoria] = (conteo[d.categoria] || 0) + 1;
  });

  // Contar favoritos
  const favIds = getDvdFavs();
  const countFavs = dvds.filter(d => favIds.includes(d.id)).length;

  bar.innerHTML =
    `<button class="dvd-cat-btn ${dvdFiltroCategoria === 'all' && !dvdFiltroFavs ? 'active' : ''}" data-cat="all">
      Todos <span class="dvd-cat-badge-count">${conteo.all}</span>
    </button>` +
    cats.map(c => {
      const col = getTopColor(c);
      const sel = dvdFiltroCategoria === c && !dvdFiltroFavs;
      const tint = col ? dvdCatBtnStyles(col, sel) : '';
      const st = tint ? ` style="${tint}"` : '';
      return `<button type="button" class="dvd-cat-btn${col ? ' dvd-cat-btn--tinted' : ''} ${sel ? 'active' : ''}" data-cat="${escHtml(c)}"${st}>
        ${escHtml(c)} <span class="dvd-cat-badge-count">${conteo[c] || 0}</span>
      </button>`;
    }).join('') +
    `<button class="dvd-cat-btn dvd-cat-fav ${dvdFiltroFavs ? 'active' : ''}" data-cat="__favs__">
      <span class="dvd-fav-star">⭐</span> Favoritos
      <span class="dvd-cat-badge-count">${countFavs}</span>
    </button>`;

  bar.querySelectorAll('.dvd-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cat === '__favs__') {
        dvdFiltroFavs = true;
        dvdFiltroCategoria = 'all';
      } else {
        dvdFiltroFavs = false;
        dvdFiltroCategoria = btn.dataset.cat;
      }
      renderDvdCats(dvds);
      filtrarDvds();
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Estado inicial de las flechas
  setTimeout(() => dvdUpdateArrows(bar), 60);
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

  const filtrados = dvdOrdenarArray(dvds.filter(d => {
    if (dvdFiltroFavs) return getDvdFavs().includes(d.id);
    const matchCat = dvdFiltroCategoria === 'all' || d.categoria === dvdFiltroCategoria;
    const matchSearch = !dvdBusqueda || (d.titulo || '').toLowerCase().includes(dvdBusqueda) ||
      (d.categoria || '').toLowerCase().includes(dvdBusqueda);
    return matchCat && matchSearch;
  }));

  if (!filtrados.length) {
    grid.innerHTML = dvdFiltroFavs
      ? `<div class="dvd-empty">
          <div class="dvd-empty-icon">⭐</div>
          <div class="dvd-empty-text">Aún no tienes favoritos.<br>Toca el <b>★</b> en cualquier video para guardarlo.</div>
        </div>`
      : `<div class="dvd-empty">
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
      if (e.target.classList.contains('dvd-fav-toggle')) return;
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

  // Botones favorito ★
  grid.querySelectorAll('.dvd-fav-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleDvdFav(btn.dataset.id, btn);
      // Actualizar badge del tab favoritos en tiempo real
      const bar = $('dvdCatsBar');
      if (bar) {
        const favBadge = bar.querySelector('.dvd-cat-fav .dvd-cat-badge-count');
        if (favBadge) favBadge.textContent = getDvdFavs().length;
      }
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
    /* BUG FIX: guard de currentUser */
    if (!currentUser) { showToast('Tu sesión expiró. Vuelve a iniciar sesión.', 'error'); return; }
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

/* ── Categorías conocidas (se actualizan con el snapshot) ── */
let _dvdCategoriasConocidas = [];

function dvdActualizarCategoriasConocidas(dvds) {
  _dvdCategoriasConocidas = [...new Set(dvds.map(d => d.categoria).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

function dvdMostrarSugerencias(valor) {
  const box = $('dvdCatSuggestions');
  if (!box) return;
  const q = valor.trim().toLowerCase();
  const matches = q
    ? _dvdCategoriasConocidas.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== q)
    : _dvdCategoriasConocidas;

  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(c =>
    `<div class="dvd-cat-suggestion-item" data-cat="${escHtml(c)}">${escHtml(c)}</div>`
  ).join('');
  box.style.display = 'block';
  box.querySelectorAll('.dvd-cat-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      $('dvdCategoria').value = item.dataset.cat;
      box.style.display = 'none';
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
  // Ocultar sugerencias al abrir
  if ($('dvdCatSuggestions')) $('dvdCatSuggestions').style.display = 'none';
  openModal('modalAgregarDvd');

  // Listener de sugerencias (se inicializa aquí para que siempre esté fresco)
  const input = $('dvdCategoria');
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  newInput.addEventListener('input', () => {
    dvdMostrarSugerencias(newInput.value);

  });
  newInput.addEventListener('focus', () => dvdMostrarSugerencias(newInput.value));
  newInput.addEventListener('blur', () => setTimeout(() => {
    if ($('dvdCatSuggestions')) $('dvdCatSuggestions').style.display = 'none';
  }, 150));
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
    /* BUG FIX: guard de currentUser */
    if (!currentUser) { showToast('Tu sesión expiró. Vuelve a iniciar sesión.', 'error'); return; }

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

/* ── Favoritos (Firestore — sincronizados por usuario y grupo) ──
   Documento: ec_dvd_favs/{uid}_{groupId}
   Campos: { uid, groupId, favIds: [...] }
─────────────────────────────────────────────────────────────── */

// Caché local para no esperar a Firestore en cada render
let _dvdFavsCache = [];

/** Inicia el listener en tiempo real de favoritos del usuario actual.
 *  Se llama desde initVideotutoriales() para tener los favs listos. */
function initDvdFavs() {
  if (window._dvdFavsUnsub) { window._dvdFavsUnsub(); window._dvdFavsUnsub = null; }
  if (!currentUser?.uid || !currentGroupId) return;

  const { doc, onSnapshot } = lib();
  const ref = doc(db(), 'ec_dvd_favs', `${currentUser.uid}_${currentGroupId}`);

  window._dvdFavsUnsub = onSnapshot(ref, snap => {
    _dvdFavsCache = snap.exists() ? (snap.data().favIds || []) : [];
    // Refrescar la grid y el badge del tab en tiempo real
    filtrarDvds();
    const bar = $('dvdCatsBar');
    if (bar) {
      const favBadge = bar.querySelector('.dvd-cat-fav .dvd-cat-badge-count');
      if (favBadge) favBadge.textContent = _dvdFavsCache.length;
    }
  }, err => {
    console.warn('initDvdFavs error:', err);
    _dvdFavsCache = [];
  });
}

/** Devuelve el array de IDs favoritos desde la caché local (síncrono). */
function getDvdFavs() {
  return _dvdFavsCache;
}

/** Agrega o quita un favorito en Firestore y actualiza el botón al instante. */
async function toggleDvdFav(dvdId, btn) {
  if (!currentUser?.uid || !currentGroupId) return;

  const esFav = _dvdFavsCache.includes(dvdId);
  // Actualizar UI de forma optimista antes de esperar a Firestore
  if (btn) {
    btn.classList.toggle('active', !esFav);
    btn.textContent = !esFav ? '★' : '☆';
    btn.title = !esFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
    btn.disabled = true; // evitar doble clic mientras guarda
  }

  const { doc, setDoc, arrayUnion, arrayRemove } = lib();
  const ref = doc(db(), 'ec_dvd_favs', `${currentUser.uid}_${currentGroupId}`);

  try {
    await setDoc(ref, {
      uid: currentUser.uid,
      groupId: currentGroupId,
      favIds: esFav ? arrayRemove(dvdId) : arrayUnion(dvdId)
    }, { merge: true });
  } catch (e) {
    // Revertir UI si falla
    if (btn) {
      btn.classList.toggle('active', esFav);
      btn.textContent = esFav ? '★' : '☆';
    }
    showToast('No se pudo guardar el favorito. ' + friendlyError(e), 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
