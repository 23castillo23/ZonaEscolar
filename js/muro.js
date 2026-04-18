/* ═══════════════════════════════════════════════════
   MURO — Perfil propio y de terceros, álbumes,
   fotos, publicaciones del muro.
   
   Dependencias: core.js, grupos.js
   Colecciones: ec_muro_fotos, ec_muro_albums, ec_feed
   
   REGLA: Todo lo del muro va aquí.
   No editar chat.js para lógica del muro.
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   LÓGICA DEL MURO (PERFIL PROPIO Y DE TERCEROS)
═══════════════════════════════════════════════════ */
let muroFotosUnsub = null;
let muroFeedUnsub = null;
let muroAlbumsUnsub = null;       // listener de álbumes
/* BUG FIX: Se eliminaron las declaraciones "let muroFotosUnsub", "let muroFeedUnsub"
   y "let muroAlbumsUnsub" que existían aquí. Estas variables ya están definidas como
   proxies de AppState en core.js (Object.defineProperty). Mantenerlas como "let" de
   módulo creaba variables locales que sombreaban los proxies en algunos entornos,
   impidiendo que teardownAllListeners() en grupos.js las cancelara correctamente.
   Ahora usan directamente los proxies globales de AppState. */
// NOTE: muroAlbumActualId y muroAlbumsCache están centralizadas en core.js (línea ~50)
let _muroFilesBuffer = [];        // fotos pendientes de asignar a álbum
/* BUG FIX: debounce timer como variable de módulo independiente, en lugar de
   renderMuroAlbums._debounceTimer. Una propiedad de función se perdería si la
   función se redeclara, causando renders duplicados. */
let _muroAlbumsDebounce = null;

const EMOJIS_ALBUM = [
  '📁','📂','🖼️','📸','🌅','🌄','🏔️','🌊','🌿','🎨',
  '🎓','📚','✏️','🔬','💻','🎵','⚽','🏀','🎭','🌸',
  '🍕','✈️','🚗','🎮','💡','🔥','⭐','💎','🎯','🦋'
];

/* ══════════════════════════════════════════════════════
   ÁLBUMES DEL MURO
══════════════════════════════════════════════════════ */

function loadMuroAlbums(targetUid, esPropio) {
  if (muroAlbumsUnsub) { muroAlbumsUnsub(); muroAlbumsUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  // Sin orderBy para no requerir índice compuesto; ordenamos en memoria
  const q = query(
    collection(db(), 'ec_muro_albums'),
    where('authorUid', '==', targetUid),
    where('groupId', '==', currentGroupId)
  );
  muroAlbumsUnsub = onSnapshot(q, snap => {
    muroAlbumsCache = [];
    snap.forEach(d => muroAlbumsCache.push({ id: d.id, ...d.data() }));
    muroAlbumsCache.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    renderMuroAlbums(targetUid, esPropio);
  }, err => {
    console.error('loadMuroAlbums error:', err);
    renderMuroAlbums(targetUid, esPropio);
  });
}

function renderMuroAlbums(targetUid, esPropio) {
  const content = $('muroContent');
  if (!content) return;

  const toolbarId = 'muroAlbumsToolbar';
  const addBtn = esPropio
    ? `<button class="btn-sm" id="${toolbarId}NewBtn" onclick="abrirModalNuevoAlbum()">➕ Nuevo álbum</button>`
    : '';

  let html = `<div class="muro-albums-toolbar" id="${toolbarId}">${addBtn}</div>
              <div class="muro-albums-grid" id="muroAlbumsGrid"></div>`;
  content.innerHTML = html;

  const grid = $('muroAlbumsGrid');

  // Tarjeta "Sin álbum" siempre visible al final
  const albums = [...muroAlbumsCache];

  /* BUG FIX: No hacer return aquí aunque !albums.length && !esPropio.
     El integrante puede tener fotos en "Sin álbum" aunque no tenga álbumes
     creados. Si hacemos return prematuro, esas fotos nunca se muestran al admin.
     Dejamos que _renderMuroAlbumsGrid consulte las fotos y decida qué mostrar. */

  // BUG-07: Debounce de 300ms para evitar race condition si el snapshot se dispara múltiples veces
  if (renderMuroAlbums._debounceTimer) clearTimeout(renderMuroAlbums._debounceTimer);
  renderMuroAlbums._debounceTimer = setTimeout(() => _renderMuroAlbumsGrid(targetUid, esPropio, albums, grid), 300);
}

function _renderMuroAlbumsGrid(targetUid, esPropio, albums, grid) {
  // Guardar referencia al grid actual para evitar escribir en un grid obsoleto
  const currentGrid = grid || $('muroAlbumsGrid');
  if (!currentGrid) return;

  const { collection, query, where, getDocs } = lib();
  getDocs(query(
    collection(db(), 'ec_muro_fotos'),
    where('authorUid', '==', targetUid)
  )).then(async snap => {
    const todasFotos = [];
    snap.forEach(d => todasFotos.push({ id: d.id, ...d.data() }));

    // Contar fotos por álbum
    const conteos = {};
    todasFotos.forEach(f => {
      const k = f.albumId || '__none__';
      conteos[k] = (conteos[k] || 0) + 1;
    });

    // Obtener portada de cada álbum (la foto más reciente)
    const covers = {};
    for (const alb of albums) {
      const fotosAlbum = todasFotos.filter(f => f.albumId === alb.id);
      if (fotosAlbum.length) covers[alb.id] = fotosAlbum[0].url;
    }
    const countSinAlbum = conteos['__none__'] || 0;
    const coverSinAlbum = todasFotos.find(f => !f.albumId)?.url || '';

    let cardsHtml = albums.map(alb => {
      const count = conteos[alb.id] || 0;
      const cover = covers[alb.id] || '';
      const delBtn = esPropio
        ? `<button class="album-muro-del" onclick="event.stopPropagation(); eliminarAlbumMuro('${alb.id}','${escHtml(alb.nombre)}')" title="Eliminar álbum">🗑️</button>`
        : '';
      const coverHtml = cover
        ? `<img class="album-muro-cover" src="${escHtml(cover)}" loading="lazy" alt="">`
        : `<div class="album-muro-cover-placeholder">${escHtml(alb.emoji || '📁')}</div>`;
      return `<div class="album-muro-card" onclick="abrirAlbumMuro('${alb.id}','${escHtml(alb.nombre)}','${escHtml(alb.emoji||'📁')}')">
        ${coverHtml}
        ${delBtn}
        <div class="album-muro-info">
          <div class="album-muro-name">${escHtml(alb.emoji || '📁')} ${escHtml(alb.nombre)}</div>
          <div class="album-muro-count">${count} foto${count !== 1 ? 's' : ''}</div>
        </div>
      </div>`;
    }).join('');

    // Tarjeta "Sin álbum" al final, solo si hay fotos sin álbum
    if (countSinAlbum > 0 || esPropio) {
      const coverNone = coverSinAlbum
        ? `<img class="album-muro-cover" src="${escHtml(coverSinAlbum)}" loading="lazy" alt="">`
        : `<div class="album-muro-cover-placeholder">📷</div>`;
      cardsHtml += `<div class="album-muro-card sin-album" onclick="abrirAlbumMuro('__none__','Sin álbum','📷')">
        ${coverNone}
        <div class="album-muro-info">
          <div class="album-muro-name">📷 Sin álbum</div>
          <div class="album-muro-count">${countSinAlbum} foto${countSinAlbum !== 1 ? 's' : ''}</div>
        </div>
      </div>`;
    }

    grid.innerHTML = cardsHtml || `<div class="feed-loading" style="grid-column:1/-1;padding:20px;font-size:13px;opacity:.6">
      ${esPropio ? 'No hay álbumes. Usa "➕ Nuevo álbum" para crear uno.' : 'Este integrante aún no tiene álbumes ni fotos.'}
    </div>`;
  }).catch(err => {
    console.error('Error al cargar álbumes del muro:', err);
    grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1">Error al cargar.</div>`;
  });
}

/* Abre un álbum y muestra sus fotos */
window.abrirAlbumMuro = function (albumId, nombre, emoji) {
  muroAlbumActualId = albumId;

  const esAjeno = muroViendoUid && muroViendoUid !== '__pending__';
  const esPropio = !muroViendoUid;
  const targetUid = esAjeno ? muroViendoUid : currentUser.uid;

  const content = $('muroContent');
  if (!content) return;
  content.innerHTML = `
    <button class="muro-album-back" onclick="volverAAlbumes()">← Álbum</button>
    <div style="font-size:15px;font-weight:700;margin-bottom:12px">${escHtml(emoji)} ${escHtml(nombre)}</div>
    <div class="muro-photos-grid" id="muroFotosGrid"></div>`;

  cargarMuroFotos(targetUid, esPropio);
};

window.volverAAlbumes = function () {
  muroAlbumActualId = null;
  const esAjeno = muroViendoUid && muroViendoUid !== '__pending__';
  const esPropio = !muroViendoUid;
  const targetUid = esAjeno ? muroViendoUid : currentUser.uid;
  loadMuroAlbums(targetUid, esPropio);
};

/* Modal: nuevo álbum */
window.abrirModalNuevoAlbum = function () {
  const picker = $('albumEmojiPicker');
  if (picker) {  // siempre re-renderizar para resetear selección
    picker.innerHTML = EMOJIS_ALBUM.map(e =>
      `<button class="album-emoji-btn" type="button" onclick="selAlbumEmoji(this, '${e}')">${e}</button>`
    ).join('');
  }
  if ($('albumNombreInput')) $('albumNombreInput').value = '';
  if ($('albumEmojiSeleccionado')) $('albumEmojiSeleccionado').textContent = '📁';
  const folderIcon = document.querySelector('.album-modal-folder-icon');
  if (folderIcon) folderIcon.textContent = '📁';
  openModal('modalNuevoAlbum');
};

window.selAlbumEmoji = function (btn, e) {
  if ($('albumEmojiSeleccionado')) $('albumEmojiSeleccionado').textContent = e;
  // Actualizar también el ícono grande del header
  const folderIcon = document.querySelector('.album-modal-folder-icon');
  if (folderIcon) folderIcon.textContent = e;
  // highlight seleccionado
  document.querySelectorAll('#albumEmojiPicker .album-emoji-btn').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
};

window.crearAlbumMuro = async function () {
  const btn = $('btnCrearAlbum');
  const nombre = ($('albumNombreInput')?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre para el álbum.', 'warning'); return; }
  if (!currentGroupId) { showToast('Selecciona un grupo primero.', 'warning'); return; }
  /* BUG FIX: guard de currentUser */
  if (!currentUser) { showToast('Tu sesión expiró. Vuelve a iniciar sesión.', 'error'); return; }
  const emoji = $('albumEmojiSeleccionado')?.textContent || '📁';
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_muro_albums'), {
      nombre, emoji,
      authorUid: currentUser.uid,
      // BUG FIX: getUserAlias() para respetar el alias del grupo.
      authorName: getUserAlias(),
      groupId: currentGroupId,
      createdAt: serverTimestamp()
    });
    closeModal('modalNuevoAlbum');
  } catch (e) {
    showToast('No se pudo crear el álbum. ' + friendlyError(e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear álbum'; }
  }
};

window.eliminarAlbumMuro = async function (albumId, nombre) {
  showConfirm({
    title: `Eliminar álbum`,
    message: `¿Eliminar el álbum "${nombre}"? Las fotos dentro quedarán en "Sin álbum".`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
  const { doc, deleteDoc, collection, query, where, getDocs, updateDoc } = lib();
  try {
    // Mover fotos al "sin álbum" (borrar el albumId)
    const snap = await getDocs(query(collection(db(), 'ec_muro_fotos'), where('albumId', '==', albumId)));
    for (const d of snap.docs) {
      await updateDoc(doc(db(), 'ec_muro_fotos', d.id), { albumId: null });
    }
    await deleteDoc(doc(db(), 'ec_muro_albums', albumId));
  } catch (e) { showToast('No se pudo eliminar. ' + friendlyError(e), 'error'); }
    }
  });
};

/* ══════════════════════════════════════════════════════
   SUBIR FOTOS AL MURO (con selector de álbum)
══════════════════════════════════════════════════════ */
function mostrarSelectorAlbum(files) {
  _muroFilesBuffer = files;
  const lista = $('listaAlbumsElegir');
  if (!lista) return;

  const albums = [...muroAlbumsCache];

  // Si estamos dentro de un álbum concreto, subir directo sin preguntar
  if (muroAlbumActualId && muroAlbumActualId !== '__none__') {
    const alb = muroAlbumsCache.find(a => a.id === muroAlbumActualId);
    if (alb) {
      subirFotosMuro(files, muroAlbumActualId);
      return;
    }
  }

  // Si no hay álbumes creados, subir directo como "Sin álbum"
  if (!albums.length) {
    subirFotosMuro(files, null);
    return;
  }

  lista.innerHTML = '';

  const makeBtn = (albumId, nombre, emoji) => {
    const btn = document.createElement('button');
    btn.className = 'selector-album-btn';
    btn.style.cssText = 'text-align:left;font-size:14px;padding:10px 14px;border-radius:8px;width:100%;background:var(--bg3);color:var(--text0);border:1px solid var(--border);cursor:pointer;transition:background 0.15s;';
    btn.onmouseenter = () => btn.style.background = 'var(--bg4)';
    btn.onmouseleave = () => btn.style.background = 'var(--bg3)';
    btn.textContent = `${emoji} ${nombre}`;
    btn.onclick = () => {
      closeModal('modalElegirAlbum');
      subirFotosMuro(_muroFilesBuffer, albumId || null);
    };
    lista.appendChild(btn);
  };

  albums.forEach(a => makeBtn(a.id, a.nombre, a.emoji || '📁'));
  makeBtn(null, 'Sin álbum', '📷');

  openModal('modalElegirAlbum');
}

async function subirFotosMuro(files, albumId) {
  /* BUG FIX: guard de currentUser */
  if (!currentUser) { showToast('Tu sesión expiró. Vuelve a iniciar sesión.', 'error'); return; }
  const btn = $('btnMuroSubir');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const { collection, addDoc, serverTimestamp } = lib();
  let exitosas = 0;
  let fallidas = 0;
  for (const file of files) {
    const url = await uploadToCloudinary(file);
    if (url) {
      exitosas++;
      await addDoc(collection(db(), 'ec_muro_fotos'), {
        url,
        albumId: albumId || null,
        authorUid: currentUser.uid,
        // BUG FIX: getUserAlias() para respetar el alias del grupo.
        authorName: getUserAlias(),
        authorAvatar: currentUser.avatar,
        groupId: currentGroupId,
        createdAt: serverTimestamp()
      });
    } else {
      fallidas++;
    }
  }
  // BUG-24: Notificar si alguna foto no se pudo subir
  if (fallidas > 0) {
    showToast(
      exitosas > 0
        ? `Se subieron ${exitosas} de ${files.length} fotos. ${fallidas} no pudieron cargarse.`
        : `No se pudo subir ninguna foto. Intenta de nuevo.`,
      fallidas === files.length ? 'error' : 'warning'
    );
  }
  if (btn) { btn.disabled = false; btn.textContent = '+ Foto'; }
  if ($('muroFileInput')) $('muroFileInput').value = '';

  // Recargar vista actual
  if (muroAlbumActualId !== null) {
    // Ya estamos dentro de un álbum, recargar fotos
    cargarMuroFotos(currentUser.uid, true);
  } else {
    // Estamos en la vista de álbumes, si subimos a un álbum concreto, abrirlo
    if (albumId) {
      const alb = muroAlbumsCache.find(a => a.id === albumId);
      if (alb) { abrirAlbumMuro(albumId, alb.nombre, alb.emoji || '📁'); return; }
    }
    loadMuroAlbums(currentUser.uid, true);
  }
}



/* ── ABRIR EL MURO DE UN COMPAÑERO DESDE LA BARRA LATERAL ── */

window.verMuroDeUsuario = async function (email, nombre) {
  // Cancelar listeners del muro anterior para evitar que datos viejos
  // sobreescriban la vista del nuevo muro mientras carga
  AppState.unsub('muroFeedUnsub');
  AppState.unsub('muroFotosUnsub');
  AppState.unsub('muroAlbumsUnsub');

  // BUG-12: Resetear el álbum actual antes de cambiar de muro
  muroAlbumActualId = null;

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

  // 2. Si es un compañero, buscamos su registro en ec_users
  //    BUG FIX: buscar también por email en minúsculas para tolerancia a
  //    variaciones de capitalización, y mostrar muro aunque no tenga docs
  //    en ec_users (el muro se basa en ec_muro_fotos por authorUid).
  const { collection, query, where, getDocs } = lib();
  try {
    // Intentar con el email tal como está en miembroNombres del grupo
    let snap = await getDocs(
      query(collection(db(), 'ec_users'), where('email', '==', email))
    );

    // Si no lo encontró, intentar con el email en minúsculas
    if (snap.empty) {
      snap = await getDocs(
        query(collection(db(), 'ec_users'), where('email', '==', email.toLowerCase()))
      );
    }

    // 3. Si el usuario fue invitado pero aún no ha iniciado sesión en ZonaEscolar,
    //    mostramos un estado "__pending__" amigable en lugar de error.
    if (snap.empty) {
      muroViendoUid = '__pending__';
      muroViendoEmail = email;
      muroViendoNombre = nombre;
      setActiveNav('muro');
      activarSeccion('muro');
      closeSidebar();
      return;
    }

    // 4. Usuario encontrado → abrir su muro
    const docData = snap.docs[0].data();
    muroViendoUid   = snap.docs[0].id;
    muroViendoEmail = email;
    // Usar el nombre del grupo si está disponible (miembroNombres), con fallback al de ec_users
    muroViendoNombre = nombre || docData.name || email.split('@')[0];
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();

  } catch (e) {
    console.error('verMuroDeUsuario error:', e);
    showToast('Error al buscar el perfil del compañero.', 'error');
  }
};


/* ═══════════════════════════════════════════════════
   INIT MURO — Punto de entrada principal
   (movido desde chat.js donde estaba mezclado)
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
    // Usuario invitado que aún no ha iniciado sesión en ZonaEscolar
    // Mostrar el mensaje en muroContent (donde se renderiza el resto del muro)
    const content = $('muroContent');
    if (content) content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  padding:40px 20px;text-align:center;gap:12px;opacity:.7">
        <div style="font-size:48px">👤</div>
        <div style="font-size:15px;font-weight:600;color:var(--text1)">
          ${escHtml(muroViendoNombre)} aún no ha iniciado sesión en ZonaEscolar
        </div>
        <div style="font-size:13px;color:var(--text3)">
          Su muro estará disponible cuando acceda por primera vez a la app.
        </div>
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
  }).catch(err => {
    console.error('Error al cargar estadísticas del muro:', err);
  });
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
                // BUG FIX: getUserAlias() para respetar el alias del grupo.
                authorName: getUserAlias(),
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

// Nota: lastChatDateStr y chatUnreadDividerInserted están declarados en chat.js
