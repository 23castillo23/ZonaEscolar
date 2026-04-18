/* ═══════════════════════════════════════════════════
   APUNTES — Semestres, materias/galerías,
   fotos de pizarrón, notas de materia,
   búsqueda de apuntes.
   
   Dependencias: core.js, grupos.js
   Colecciones: ec_semestres, ec_galerias,
                ec_fotos, ec_notas
   
   REGLA: Solo lógica de apuntes aquí.
   uploadToCloudinary está en core.js (compartida).
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   APUNTES
═══════════════════════════════════════════════════ */


$('apuntesSearch')?.addEventListener('input', e => {
  apuntesSearchTerm = e.target.value.trim().toLowerCase();
  renderSemestres();
});

function initApuntes() {
  // BUG FIX: guard de currentGroupId — igual que initFeed e initTableros.
  // Sin esto, si el resize u otro evento llama a initApuntes sin grupo activo,
  // la query a Firestore falla con groupId=null y deja la sección en blanco.
  if (!currentGroupId) return;

  const toolbar = document.querySelector('.apuntes-toolbar');
  if (toolbar) toolbar.style.display = isAdmin ? 'flex' : 'none';

  // Agregar botón de Ordenar Semestres al lado del buscador
  const searchWrap = document.querySelector('.apuntes-search-wrap');
  if (searchWrap && !$('btnOrdenarSemestres')) {
    searchWrap.style.display = 'flex';
    searchWrap.style.gap = '10px';
    searchWrap.style.alignItems = 'center';

    const searchInput = $('apuntesSearch');
    if (searchInput) searchInput.style.flex = '1';

    const btnSortSem = document.createElement('button');
    btnSortSem.id = 'btnOrdenarSemestres';
    btnSortSem.className = 'btn-sm';
    btnSortSem.innerHTML = `↕️ Sem: ${ordenSemestres === 'alfabetico' ? 'A-Z' : 'Fecha'}`;
    btnSortSem.onclick = () => {
      ordenSemestres = (ordenSemestres === 'creacion') ? 'alfabetico' : 'creacion';
      localStorage.setItem('ze_orden_semestres', ordenSemestres);
      btnSortSem.innerHTML = `↕️ Sem: ${ordenSemestres === 'alfabetico' ? 'A-Z' : 'Fecha'}`;
      renderSemestres();
    };
    searchWrap.appendChild(btnSortSem);
  }

  loadSemestres();
  setupApunteUpload();
}

window.toggleOrdenMaterias = function (e) {
  e.stopPropagation();
  ordenMaterias = (ordenMaterias === 'creacion') ? 'alfabetico' : 'creacion';
  localStorage.setItem('ze_orden_materias', ordenMaterias);
  renderSemestres();
};

function loadSemestres() {
  if (semestresUnsub) { semestresUnsub(); semestresUnsub = null; }
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }

  const { collection, query, where, onSnapshot } = lib();
  // Traemos todos, el ordenamiento lo haremos en memoria (renderSemestres)
  const q = query(collection(db(), 'ec_semestres'), where('groupId', '==', currentGroupId));

  semestresUnsub = onSnapshot(q, snap => {
    semestres = [];
    snap.forEach(d => semestres.push({ id: d.id, ...d.data() }));
    loadGalerias();
  });
}

function loadGalerias() {
  if (galeriasUnsub) { galeriasUnsub(); galeriasUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_galerias'), where('groupId', '==', currentGroupId));

  galeriasUnsub = onSnapshot(q, snap => {
    galerias = [];
    snap.forEach(d => galerias.push({ id: d.id, ...d.data() }));
    renderSemestres();
  });
}

const SEM_PASTEL_PALETTE = [
  { label: 'Lila',     c1: '#e9e4ff', c2: '#7c3aed', text: '#4c1d95' },
  { label: 'Rosa',     c1: '#ffe4e6', c2: '#e11d48', text: '#881337' },
  { label: 'Menta',    c1: '#d1fae5', c2: '#059669', text: '#064e3b' },
  { label: 'Amarillo', c1: '#fef9c3', c2: '#d97706', text: '#78350f' },
  { label: 'Cielo',    c1: '#e0f2fe', c2: '#0284c7', text: '#0c4a6e' },
  { label: 'Durazno',  c1: '#ffedd5', c2: '#ea580c', text: '#7c2d12' },
  { label: 'Lima',     c1: '#f7fee7', c2: '#65a30d', text: '#1a2e05' },
  { label: 'Azul',     c1: '#dbeafe', c2: '#1d4ed8', text: '#1e3a8a' },
  { label: 'Fucsia',   c1: '#fdf4ff', c2: '#a21caf', text: '#581c87' },
  { label: 'Coral',    c1: '#fff1f2', c2: '#f43f5e', text: '#4c0519' }
];

function renderSemestres() {
  const container = $('apuntesGroupsContainer');
  if (!container) return;
  const term = apuntesSearchTerm;

  // 1. Ordenar semestres en memoria según selección
  let semestresOrdenados = [...semestres];
  if (ordenSemestres === 'alfabetico') {
    semestresOrdenados.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Por fecha de creación
    semestresOrdenados.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });
  }

  // 2. Filtrar por búsqueda
  let semestresMostrar = semestresOrdenados.map(sem => {
    let mats = galerias.filter(g => g.semestreId === sem.id);
    if (term) {
      const matchSem = sem.name.toLowerCase().includes(term);
      const matsFiltradas = mats.filter(m => m.name.toLowerCase().includes(term));
      if (!matchSem && matsFiltradas.length === 0) return null;
      if (!matchSem) mats = matsFiltradas;
    }
    return { ...sem, mats };
  }).filter(Boolean);

  if (!semestresMostrar.length) {
    container.innerHTML = `<div class="sem-empty"><p>${term ? 'Sin resultados' : 'Sin semestres aún'}</p></div>`;
    return;
  }

  // CORRECCIÓN CRUCIAL: Solo forzamos el display: grid si NO estamos en la vista de galería.
  // Esto evita el bug donde la pantalla se parte en dos al poner una portada.
  if (!galeriaActual) {
    container.style.display = 'grid';
  }

  container.innerHTML = semestresMostrar.map((semData) => {
    const { mats, ...sem } = semData;
    const isSavedOpen = semestresAbiertos.has(sem.id);
    const isOpenClass = (term || isSavedOpen) ? 'open' : '';
    const rotateStyle = (term || isSavedOpen) ? 'style="transform:rotate(90deg)"' : '';
    const primeraCover = sem.coverImage || mats.find(m => m.coverImage)?.coverImage || '';

    // --- NUEVO: Lógica para ordenar las materias ---
    let matsOrdenadas = [...mats];
    if (ordenMaterias === 'alfabetico') {
      matsOrdenadas.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Ordenar por fecha de creación (de más antiguo a más nuevo)
      matsOrdenadas.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
    }

    // Usamos matsOrdenadas en lugar de mats
    const materiasHtml = matsOrdenadas.map(m => {
      const tag = (m.name || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
      return `
        <div class="album-card-wrap">
          <article class="album-card" onclick="abrirGaleria('${m.id}')">
            <div class="album-cover">
              ${m.coverImage ? `<img src="${escHtml(m.coverImage)}" alt="">` : ''}
              <span class="album-icon">${escHtml(m.icon || '📚')}</span>
            </div>
            <div class="album-info">
              <h3 class="album-name">${escHtml(m.name)}</h3>
              <p class="album-count">${m.fotosCount || 0} fotos</p>
              <p class="album-tag">#${tag}</p>
            </div>
            <div class="album-actions" onclick="event.stopPropagation()">
              <button class="album-action-btn primary" onclick="abrirGaleria('${m.id}')">Abrir</button>
              <button class="album-action-btn" onclick="abrirNotas('${m.id}')">Notas</button>
            </div>
          </article>
          ${isAdmin ? `<button class="materia-delete" onclick="event.stopPropagation(); eliminarMateria('${m.id}',${JSON.stringify(m.name)})">🗑️</button>` : ''} <!-- BUG FIX: JSON.stringify para nombres con apóstrofes -->
        </div>`;
    }).join('');

    const semColor1 = sem.color ? sem.color + '55' : '';
    const semColor2 = sem.color ? sem.color + 'cc' : '';
    const cardTopStyle = semColor1
      ? `background: linear-gradient(135deg, ${semColor1} 0%, ${semColor2} 100%);`
      : '';
    const headerOpenStyle = semColor1
      ? `background: linear-gradient(90deg, ${semColor1} 0%, ${semColor2} 60%);`
      : '';

    return `
      <div class="group-accordion ${isOpenClass}" id="sem-${sem.id}">
        <div class="group-header" onclick="toggleSemestre('${sem.id}')" style="${headerOpenStyle}">
          <div class="group-card-top" style="${cardTopStyle}">
            ${primeraCover ? `<div class="group-header-bg" style="background-image:url('${primeraCover}')"></div>` : ''}
            <span class="group-icon">${escHtml(sem.icon || '📅')}</span>
          </div>
          <div class="group-card-info">
            <span class="group-name">${escHtml(sem.name)}</span>
            <span class="group-count">${mats.length} materias</span>
          </div>
          <div class="group-mini-actions" onclick="event.stopPropagation()">
            <button class="group-mini-btn btn-abrir-semestre" onclick="toggleSemestre('${sem.id}')">Abrir</button>
            <button class="group-mini-btn primary btn-notas-semestre" onclick="abrirNotasSemestre('${sem.id}')">Notas</button>
            <button class="group-mini-btn btn-ordenar-materias" onclick="toggleOrdenMaterias(event)" title="Ordenar materias" style="flex: 0 0 auto; padding: 8px 14px;">
              ${ordenMaterias === 'alfabetico' ? '↕️ A-Z' : '📅 Fecha'}
            </button>
          </div>
          <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${rotateStyle}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
          ${isAdmin ? `<button class="group-delete" onclick="event.stopPropagation(); eliminarSemestre('${sem.id}',${JSON.stringify(sem.name)})">🗑️</button>` : ''} <!-- BUG FIX: JSON.stringify para nombres con apóstrofes -->
        </div>
        <div class="group-body">
          <div class="carousel-wrap">
            <div class="albums-carousel">${mats.length ? materiasHtml : '<p style="font-size:12px;opacity:0.6;padding:10px;">Sin materias</p>'}</div>
          </div>
          ${isAdmin ? `<button class="btn-add-to-group" onclick="openNewMateriaModal('${sem.id}')">➕ Agregar materia</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

window.toggleSemestre = function (id) {
  const grup = $('sem-' + id);
  if (!grup) return;

  const yaEstabaAbierto = grup.classList.contains('open');
  const isNowOpen = grup.classList.toggle('open');
  const tog = grup.querySelector('.group-chevron');
  if (tog) tog.style.transform = isNowOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  isNowOpen ? semestresAbiertos.add(id) : semestresAbiertos.delete(id);

  // Al abrir: scroll al carrusel de materias (group-body) tras la animación CSS
  if (isNowOpen) {
    setTimeout(() => {
      const body = grup.querySelector('.group-body') || grup;
      body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 320);
  }
};

window.abrirNotasSemestre = function (semestreId) {
  const sem = semestres.find(s => s.id === semestreId);
  if (!sem) return;
  $('notasGaleriaTitulo').textContent = `${sem.icon || '📅'} Notas de ${sem.name}`;
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = `sem_${semestreId}`;
  openModal('modalNotasGaleria');
  cargarNotas(`sem_${semestreId}`);
};

// ── NAVEGACIÓN ENTRE SEMESTRES Y GALERÍA DE FOTOS ──
// Guardamos el id de la galería abierta para resaltarla al volver
let _galeriaAnteriorId = null;

window.abrirGaleria = function (galeriaId) {
  galeriaActual = galerias.find(g => g.id === galeriaId);
  if (!galeriaActual) return;

  // Guardamos scroll y el id antes de ocultar
  scrollPosicionApuntes = window.scrollY || document.documentElement.scrollTop;
  _galeriaAnteriorId = galeriaId;

  $('galeriaTitle').textContent = `${galeriaActual.icon || '📚'} ${galeriaActual.name}`;
  $('apuntesGroupsContainer').style.display = 'none';
  $('apuntesGaleriaView').style.display = 'block';
  $('apuntesUploadZone').style.display = 'none';

  $('btnUploadApunte').style.display = 'inline-flex';

  cargarFotosGaleria();
  window.scrollTo(0, 0);
};

$('btnApuntesBack')?.addEventListener('click', () => {
  const semestreIdAnterior = galeriaActual?.semestreId || null;
  const galeriaIdAnterior  = _galeriaAnteriorId;
  galeriaActual     = null;
  _galeriaAnteriorId = null;

  // Aseguramos que el semestre quede abierto al volver
  if (semestreIdAnterior) semestresAbiertos.add(semestreIdAnterior);

  $('apuntesGroupsContainer').style.display = 'grid';
  $('apuntesGaleriaView').style.display = 'none';

  renderSemestres();

  // Doble rAF: espera que el navegador termine de pintar antes de calcular posiciones
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // 1. Scroll directo al card de la materia que se abrió
      if (galeriaIdAnterior) {
        const cardEl = document.querySelector(`.album-card[onclick*="${galeriaIdAnterior}"]`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Resaltar brevemente para ubicar visualmente
          cardEl.style.transition = 'box-shadow 0.3s';
          cardEl.style.boxShadow = '0 0 0 3px var(--accent, #6c63ff)';
          setTimeout(() => { cardEl.style.boxShadow = ''; }, 1500);
          return;
        }
      }
      // 2. Fallback: scroll al semestre padre
      if (semestreIdAnterior) {
        const semEl = document.getElementById('sem-' + semestreIdAnterior);
        if (semEl) { semEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      }
      // 3. Último recurso: posición guardada
      window.scrollTo({ top: scrollPosicionApuntes, behavior: 'instant' });
    });
  });
});


// (Aquí continúa tu código normal...)
function cargarFotosGaleria() {
  if (window._apuntesFotosUnsub) { window._apuntesFotosUnsub(); window._apuntesFotosUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_fotos'),
    where('galeriaId', '==', galeriaActual.id)
  );
  const grid = $('apuntesGrid');
  grid.innerHTML = '<div class="feed-loading">Cargando fotos…</div>';
  window._apuntesFotosUnsub = onSnapshot(q, snap => {
    const fotos = [];
    snap.forEach(d => fotos.push({ id: d.id, ...d.data() }));
    // Ordenar descendente
    fotos.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    renderFotosGaleria(fotos);
  }, err => {
    grid.innerHTML = '<div class="feed-loading">Error al cargar fotos.</div>';
  });
}

// Variable local de apuntes para no pisar lightboxPhotos de otros módulos (Mis Aportes, Muro, etc.)
let _apuntesLightboxPhotos = [];

window.openApuntesLightbox = function(index) {
  lightboxPhotos = _apuntesLightboxPhotos;
  openLightbox(index);
};

function renderFotosGaleria(fotos) {
  _apuntesLightboxPhotos = fotos;
  const grid = $('apuntesGrid');
  if (!fotos.length) {
    grid.innerHTML = '<div class="feed-loading">Sin fotos aún. ¡Sube tus apuntes!</div>';
    return;
  }

  grid.innerHTML = fotos.map((f, i) => {
    const esAutor = currentUser && f.authorUid === currentUser.uid;
    const puedeActuar = esAutor || isAdmin;

    const btnPublicar = puedeActuar
      ? `<button class="foto-publish-btn" title="Publicar en tablero" onclick="event.stopPropagation(); publicarFotoEnFeed('${escHtml(f.id)}')">📌</button>`
      : '';

    // --- EL BOTÓN DEL COHETE QUE NECESITAS ---
    const btnCompartirTablero = `<button class="foto-publish-btn" style="left: 75px; background: var(--accent);" title="Compartir en cualquier Tablero" 
        onclick="event.stopPropagation(); compartirNotaAlTablero('${f.id}', '${escHtml(f.url)}')">📌</button>`;

    const btnEliminar = puedeActuar
      ? `<button class="foto-del-btn" title="Eliminar foto" onclick="event.stopPropagation(); eliminarFotoApunte('${escHtml(f.id)}')">🗑️</button>`
      : '';

    const btnPortada = puedeActuar
      ? `<button class="foto-del-btn" style="left: 40px; background: rgba(0,0,0,0.55);" title="Usar como portada de materia" onclick="event.stopPropagation(); establecerPortadaMateria('${escHtml(f.url)}')">⭐</button>`
      : '';

    const autorLabel = f.authorName ? `<span class="foto-autor-label">📷 ${escHtml(f.authorName)}</span>` : '';
    const likeCount = f.likes || 0;
    const isLiked = f.likedBy?.includes(currentUser.uid);

    return `<div class="photo-thumb" data-foto-id="${escHtml(f.id)}">
      <img src="${escHtml(f.url)}" loading="lazy" alt="" onclick="openApuntesLightbox(${i})">
      <div class="photo-thumb-overlay" onclick="openApuntesLightbox(${i})">${autorLabel}</div>
      <div class="photo-actions-bar">
        <button class="photo-action-btn feed-action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleFotoLike('${f.id}', this)">
          <span class="foco-icon" style="font-size: 16px;">💡</span> (<span class="like-count">${likeCount}</span>)
        </button>
        <button class="photo-action-btn btn-notas-foto"
          data-url="${escHtml(f.url)}"
          data-caption="${escHtml(f.caption || '')}">
          💬 Notas
        </button>
      </div>
      ${btnPublicar} ${btnEliminar} ${btnPortada} ${btnCompartirTablero} 
    </div>`;
  }).join('');
}
// Guardar portada sin salirte de la materia
// Guardar portada sin salirte de la materia
window.establecerPortadaMateria = async function (url) {
  if (!galeriaActual) return;
  const { doc, updateDoc } = lib();
  try {
    await updateDoc(doc(db(), 'ec_galerias', galeriaActual.id), { coverImage: url });
    galeriaActual.coverImage = url;
    const index = galerias.findIndex(g => g.id === galeriaActual.id);
    if (index !== -1) galerias[index].coverImage = url;

    // Solo un pequeño aviso visual sutil
    const toast = document.createElement('div');
    toast.textContent = '✅ Portada de la materia actualizada';
    toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--accent); color:white; padding:10px 20px; border-radius:20px; font-size:13px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.2); animation: fadeInOut 3s forwards; pointer-events:none;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (e) {
    showToast('No se pudo actualizar la portada. ' + friendlyError(e), 'error');
  }
};

$('btnUploadApunte').addEventListener('click', () => {
  const zone = $('apuntesUploadZone');
  zone.style.display = zone.style.display === 'none' ? 'block' : 'none';
});

window.toggleFotoLike = async function (fotoId, btnEl) {
  if (!currentUser) return;
  const isLiked = btnEl.classList.contains('liked');
  btnEl.classList.toggle('liked');
  
  const span = btnEl.querySelector('.like-count'); // El span que tiene el número
  let currentLikes = parseInt(span.textContent) || 0;
  
  span.textContent = isLiked ? (currentLikes - 1) : (currentLikes + 1);

  const { doc, updateDoc, arrayUnion, arrayRemove, increment } = lib();
  try {
    await updateDoc(doc(db(), 'ec_fotos', fotoId), {
      likedBy: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likes: increment(isLiked ? -1 : 1)
    });
  } catch (e) { console.error('Error al dar like:', e); }
}

window.abrirNotasDeFoto = function (fotoUrl, caption) {
  const fotoUnicaId = btoa(fotoUrl).replace(/\//g, '_');
  $('notasGaleriaTitulo').textContent = caption ? `Notas: ${caption}` : 'Notas de esta foto';
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = `foto_${fotoUnicaId}`;
  openModal('modalNotasGaleria');
  cargarNotas(`foto_${fotoUnicaId}`);
};

function setupApunteUpload() {
  if ($('btnApunteSend').dataset.bound) return;
  $('btnApunteSend').dataset.bound = '1';
  const onChange = e => {
    const nuevos = [...e.target.files].filter(f => f.type.startsWith('image/'));
    apunteFiles = [...apunteFiles, ...nuevos];
    renderApuntePreview();
    $('btnApunteSend').disabled = !apunteFiles.length;
  };
  $('apunteFileInput').addEventListener('change', onChange);
  $('apunteCameraInput').addEventListener('change', onChange);

  const dropArea = $('apuntesDropArea');
  if (dropArea) {
    dropArea.addEventListener('dragover', e => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--accent)';
      dropArea.style.background = 'rgba(124, 106, 247, 0.05)';
    });
    dropArea.addEventListener('dragleave', e => {
      e.preventDefault();
      dropArea.style.borderColor = '';
      dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', e => {
      e.preventDefault();
      dropArea.style.borderColor = '';
      dropArea.style.background = '';
      if (e.dataTransfer.files.length) {
        const nuevos = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
        apunteFiles = [...apunteFiles, ...nuevos];
        renderApuntePreview();
        $('btnApunteSend').disabled = !apunteFiles.length;
      }
    });
  }

  const btnSend = $('btnApunteSend');
  const newBtnSend = btnSend.cloneNode(true);
  btnSend.parentNode.replaceChild(newBtnSend, btnSend);

  newBtnSend.addEventListener('click', async () => {
    if (!apunteFiles.length || !galeriaActual) return;
    const caption = $('apunteCaption').value.trim();
    newBtnSend.disabled = true;
    $('apunteProgress').style.display = 'block';
    const { collection, addDoc, serverTimestamp } = lib();
    let done = 0;
    try {
      for (const file of apunteFiles) {
        const url = await uploadToCloudinary(file, galeriaActual.cloudinaryTag);
        if (url) {
          await addDoc(collection(db(), 'ec_fotos'), {
            galeriaId: galeriaActual.id,
            groupId: currentGroupId,
            url, caption,
            authorUid: currentUser.uid,
            /* BUG FIX: usar getUserAlias() para respetar el alias del grupo en lugar
               del nombre real de la cuenta, consistente con el resto de módulos. */
            authorName: getUserAlias(),
            publishedToFeed: false,
            createdAt: serverTimestamp()
          });
        }
        done++;
        $('apunteProgressBar').style.width = `${Math.round(done / apunteFiles.length * 100)}%`;
      }
      apunteFiles = [];
      $('apuntePreviewList').innerHTML = '';
      $('apunteCaption').value = '';
    } catch (e) {
      showToast('No se pudo subir el apunte. ' + friendlyError(e), 'error');
      newBtnSend.disabled = false;
    } finally {
      setTimeout(() => {
        $('apunteProgress').style.display = 'none';
        $('apunteProgressBar').style.width = '0%';
      }, 800);
    }
  });
}

function renderApuntePreview() {
  const container = $('apuntePreviewList');
  // Revocar URLs anteriores para evitar memory leaks
  container.querySelectorAll('img[src^="blob:"]').forEach(img => URL.revokeObjectURL(img.src));
  container.innerHTML = apunteFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="upload-preview-item" style="position:relative; width:85px; height:85px; border-radius:8px; overflow:hidden; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
        <img src="${url}" alt="" onclick="openLightboxPrevia(${i})" style="width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in;">
        <button onclick="removerFotoPrevia(${i})" style="position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:50%; background:rgba(0,0,0,0.6); color:white; border:none; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center;">✕</button>
      </div>`;
  }).join('');
}

window.removerFotoPrevia = function (idx) {
  // Revocar Object URL de la foto eliminada
  const imgs = $('apuntePreviewList').querySelectorAll('img[src^="blob:"]');
  if (imgs[idx]) URL.revokeObjectURL(imgs[idx].src);
  apunteFiles.splice(idx, 1);
  renderApuntePreview();
  $('btnApunteSend').disabled = !apunteFiles.length;
};

window.openLightboxPrevia = function (idx) {
  lightboxPhotos = apunteFiles.map(f => ({
    url: URL.createObjectURL(f),
    caption: f.name
  }));
  lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('open');
  $('lightboxPrev').style.display = '';
  $('lightboxNext').style.display = '';
};

/* ── MODALES APUNTES ── */
let selectedSemestreEmoji = '📅';
let selectedSemestreColor = SEM_PASTEL_PALETTE[0].c1;
let selectedSemestrePalette = SEM_PASTEL_PALETTE[0];
let selectedSemestreSlider = 50;
let selectedMateriaEmoji = '📚';

$('btnNewSubjectGroup').addEventListener('click', () => {
  if (!isAdmin) { showToast('Solo el administrador puede crear semestres.', 'error'); return; }
  renderEmojiPicker('semestreEmojiPicker', EMOJIS_SEMESTRE, '📅', em => selectedSemestreEmoji = em);
  selectedSemestreEmoji = '📅';
  selectedSemestrePalette = SEM_PASTEL_PALETTE[0];
  selectedSemestreSlider = 50;
  selectedSemestreColor = SEM_PASTEL_PALETTE[0].c1;
  renderColorPicker('semestreColorPicker', (c1, palette) => {
    selectedSemestrePalette = palette;
    updateSemestreSlider();
  });
  const slider = $('semestreColorSlider');
  if (slider) {
    slider.value = 50;
    slider.oninput = () => { selectedSemestreSlider = +slider.value; updateSemestreSlider(); };
  }
  updateSemestreSlider();
  openModal('modalNuevoSemestre');
});

let _creandoSemestre = false;
$('btnConfirmarSemestre').addEventListener('click', async () => {
  if (_creandoSemestre) return;
  const nombre = $('semestreNombre').value.trim();
  if (!nombre) { showToast('Escribe el nombre.', 'warning'); return; }
  if (!currentGroupId) { showToast('Selecciona un grupo primero.', 'warning'); return; }
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
  } catch (e) { showToast('No se pudo crear el semestre. ' + friendlyError(e), 'error'); }
  btn.disabled = false; btn.textContent = 'Crear';
  _creandoSemestre = false;
});

$('btnNewMateria').addEventListener('click', () => {
  if (!isAdmin) { showToast('Solo el administrador puede crear materias.', 'error'); return; }
  openNewMateriaModal('');
});
window.openNewMateriaModal = function (semestreId) {
  if (!isAdmin) { showToast('Solo el administrador puede crear materias.', 'error'); return; }
  renderEmojiPicker('materiaEmojiPicker', EMOJIS_MATERIA, '📚', em => selectedMateriaEmoji = em);
  selectedMateriaEmoji = '📚';
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
  if (!nombre) { showToast('Escribe el nombre de la materia.', 'warning'); return; }
  if (!currentGroupId) { showToast('Selecciona un grupo primero.', 'warning'); return; }
  if (!$('materiaSemestreSelect').value) { showToast('⚠️ Debes seleccionar un semestre para la materia.', 'warning'); return; }
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
  } catch (e) { showToast('No se pudo crear la materia. ' + friendlyError(e), 'error'); }
  btn.disabled = false; btn.textContent = 'Crear';
  _creandoMateria = false;
});

/* ── Eliminar foto de apuntes (solo autor o admin) ── */
window.eliminarFotoApunte = async function (fotoId) {
  showConfirm({
    title: 'Eliminar foto',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
  const { doc, deleteDoc } = lib();
  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-del-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await deleteDoc(doc(db(), 'ec_fotos', fotoId));
  } catch (e) {
    showToast('No se pudo eliminar. ' + friendlyError(e), 'error');
    if (btn) { btn.textContent = '🗑️'; btn.disabled = false; }
  }
    }
  });
};

window.publicarFotoEnFeed = async function (fotoId) {
  const foto = (lightboxPhotos || []).find(f => f.id === fotoId);
  if (!foto || !galeriaActual) return;

  const btn = document.querySelector(`[data-foto-id="${fotoId}"] .foto-publish-btn`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  const {
    collection, query, where, getDocs, addDoc,
    doc, updateDoc, arrayUnion, serverTimestamp
  } = lib();

  try {
    // Buscar si ya existe un post de esta galería en el feed (sin límite de fecha)
    const feedQ = query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('galeriaId', '==', galeriaActual.id),
      where('type', '==', 'apunte')
    );
    const feedSnap = await getDocs(feedQ);

    if (!feedSnap.empty) {
      // Ya existe — agregar la foto si no estaba y subirlo al inicio actualizando createdAt
      const feedDoc = feedSnap.docs[0];
      await updateDoc(doc(db(), 'ec_feed', feedDoc.id), {
        images: arrayUnion(foto.url),
        createdAt: serverTimestamp()
      });
    } else {
      // No existe — crear nueva publicación
      const gal = galeriaActual;
      const sem = semestres.find(s => s.id === gal.semestreId);
      const semNombre = sem ? sem.name : '';
      await addDoc(collection(db(), 'ec_feed'), {
        groupId: currentGroupId,
        galeriaId: gal.id,
        type: 'apunte',
        text: `📸 Apuntes de ${gal.icon || '📚'} ${gal.name}${semNombre ? ` · ${semNombre}` : ''}`,
        images: [foto.url],
        authorUid: currentUser.uid,
        authorName: getUserAlias(),
        authorAvatar: currentUser.avatar || '',
        likes: 0, likedBy: [], commentCount: 0,
        createdAt: serverTimestamp()
      });
    }

    await updateDoc(doc(db(), 'ec_fotos', fotoId), { publishedToFeed: true });
    if (btn) { btn.textContent = '✅'; btn.classList.add('published'); btn.disabled = false; btn.title = 'Ya publicada en Novedades'; }

  } catch (e) {
    if (btn) { btn.textContent = '📌'; btn.disabled = false; }
    showToast('No se pudo publicar. ' + friendlyError(e), 'error');
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
  } catch (e2) { showToast('No se pudo guardar. ' + friendlyError(e2), 'error'); }
  btn.disabled = false; btn.textContent = '💾 Publicar nota';
});

/* ═══════════════════════════════════════════════════
   CLOUDINARY UPLOAD
═══════════════════════════════════════════════════ */

/* ── Delegación para botón "💬 Notas" de cada foto ──
   Se usa data-url y data-caption en lugar de pasar los
   valores directo al onclick, porque JSON.stringify genera
   comillas dobles que rompen el atributo HTML onclick. */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-notas-foto');
  if (!btn) return;
  e.stopPropagation();
  const url     = btn.dataset.url     || '';
  const caption = btn.dataset.caption || '';
  abrirNotasDeFoto(url, caption);
});
