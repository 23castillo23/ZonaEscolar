/* ═══════════════════════════════════════════════════
   LÓGICA DEL MURO (PERFIL PROPIO Y DE TERCEROS)
═══════════════════════════════════════════════════ */
let muroFotosUnsub = null;
let muroFeedUnsub = null;
let muroAlbumsUnsub = null;       // listener de álbumes
// NOTE: muroAlbumActualId y muroAlbumsCache están centralizadas en core.js (línea ~50)
let _muroFilesBuffer = [];        // fotos pendientes de asignar a álbum

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

  if (!albums.length && !esPropio) {
    grid.innerHTML = `<div class="feed-loading" style="grid-column:1/-1;padding:30px">
      Este integrante aún no tiene álbumes.
    </div>`;
    return;
  }

  // Contar fotos sin álbum (sin filtro groupId: fotos viejas no tienen ese campo)
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
      No hay álbumes. Usa "➕ Nuevo álbum" para crear uno.
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
    <button class="muro-album-back" onclick="volverAAlbumes()">← Álbumes</button>
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
  const emoji = $('albumEmojiSeleccionado')?.textContent || '📁';  
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const { collection, addDoc, serverTimestamp } = lib();
  try {
    await addDoc(collection(db(), 'ec_muro_albums'), {
      nombre, emoji,
      authorUid: currentUser.uid,
      authorName: currentUser.name,
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
  const btn = $('btnMuroSubir');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const { collection, addDoc, serverTimestamp } = lib();
  for (const file of files) {
    const url = await uploadToCloudinary(file);
    if (url) {
      await addDoc(collection(db(), 'ec_muro_fotos'), {
        url,
        albumId: albumId || null,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        groupId: currentGroupId,
        createdAt: serverTimestamp()
      });
    }
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

  // 2. Si es un compañero, buscamos su ID en la base de datos
  const { collection, query, where, getDocs } = lib();
  try {
    const q = query(collection(db(), 'ec_users'), where('email', '==', email));
    const snap = await getDocs(q);

    // 3. Si el usuario fue invitado pero no ha iniciado sesión, usamos '__pending__'
    if (snap.empty) {
      muroViendoUid = '__pending__';
      muroViendoEmail = email;
      muroViendoNombre = nombre;
      setActiveNav('muro');
      activarSeccion('muro');
      closeSidebar();
      return;
    }

    // 4. Si el compañero sí existe, llenamos las variables y abrimos la sección
    muroViendoUid = snap.docs[0].id;
    muroViendoEmail = email;
    muroViendoNombre = snap.docs[0].data().name || nombre;
    setActiveNav('muro');
    activarSeccion('muro');
    closeSidebar();

  } catch (e) {
    console.error(e);
    showToast('Error al buscar el perfil del compañero.', 'error');
  }
};

