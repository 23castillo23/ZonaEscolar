/* ═══════════════════════════════════════════════════
   UTILS-EXTRA — Selector de tablero, compartir
   libro/DVD, fix de teclado iOS, resize.
   
   Dependencias: core.js, grupos.js, tableros.js,
                 videotutoriales.js, biblioteca.js
   
   REGLA: Utilidades compartidas entre módulos.
   · mostrarSelectorTablero → abre modal con tableros
   · abrirModalLibro        → detalle de libro
   · compartirDvd           → comparte video al tablero
   · compartirNotaAlTablero → comparte foto de apuntes
   
   NOTA: abrirDetalleDvd se llama directamente desde
   videotutoriales.js — no necesita window.* aquí.
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
SELECTOR DE TABLERO (compartir)
═══════════════════════════════════════════════════ */

// yaCompartidoEn: Set de tableroIds donde ya existe la publicación ('' = feed general)
function mostrarSelectorTablero(desc, onSelect, yaCompartidoEn = new Set()) {
  const lista = $('selectorTableroLista');
  const descEl = $('selectorTableroDesc');
  if (!lista) return;
  if (descEl) descEl.textContent = desc || 'Elige el tablero donde quieres publicar.';

  lista.innerHTML = '<div class="feed-loading" style="padding:20px 0">Cargando tableros…</div>';
  openModal('modalSelectorTablero');

  const { collection, query, where, getDocs } = lib();
  getDocs(query(
    collection(db(), 'ec_tableros'),
    where('groupId', '==', currentGroupId)
  )).then(snap => {
    const tableros = [];
    snap.forEach(d => tableros.push({ id: d.id, ...d.data() }));
    tableros.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

    // Tablero general
    const generalYa = yaCompartidoEn.has('');
    let html = `
      <button class="selector-tablero-item general ${generalYa ? 'ya-compartido' : ''}" data-id="" data-nombre="Tablero general">
        <div class="selector-tablero-item-color" style="background:var(--accent2,#3b3b6b)">🏠</div>
        <div class="selector-tablero-item-info">
          <div class="selector-tablero-item-nombre">Tablero general</div>
          <div class="selector-tablero-item-meta">${generalYa ? '✅ Ya compartido aquí' : 'Publicaciones del grupo'}</div>
        </div>
        ${generalYa ? '<span class="selector-tablero-check">✅</span>' : ''}
      </button>`;

    tableros.forEach(t => {
      const icono = t.icono || getTableroIcono(t.nombre);
      const yaEsta = yaCompartidoEn.has(t.id);
      html += `
        <button class="selector-tablero-item ${yaEsta ? 'ya-compartido' : ''}"
                data-id="${t.id}" data-nombre="${escHtml(t.nombre)}"
                style="border-left: 4px solid ${t.color || '#1a237e'}">
          <div class="selector-tablero-item-color" style="background:${t.color || '#1a237e'}">${icono}</div>
          <div class="selector-tablero-item-info">
            <div class="selector-tablero-item-nombre">${escHtml(t.nombre)}</div>
            <div class="selector-tablero-item-meta">${yaEsta ? '✅ Ya compartido aquí' : 'Tablero temático'}</div>
          </div>
          ${yaEsta ? '<span class="selector-tablero-check">✅</span>' : ''}
        </button>`;
    });

    lista.innerHTML = html;

    lista.querySelectorAll('.selector-tablero-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id || null;
        const nombre = btn.dataset.nombre || 'Tablero general';
        closeModal('modalSelectorTablero');
        onSelect(id, nombre);
      });
    });
  }).catch(err => {
    console.error('Error al cargar tableros:', err);
    const generalYa = yaCompartidoEn.has('');
    lista.innerHTML = `
      <button class="selector-tablero-item general ${generalYa ? 'ya-compartido' : ''}" data-id="" data-nombre="Tablero general">
        <div class="selector-tablero-item-color" style="background:var(--accent2,#3b3b6b)">🏠</div>
        <div class="selector-tablero-item-info">
          <div class="selector-tablero-item-nombre">Tablero general</div>
          <div class="selector-tablero-item-meta">${generalYa ? '✅ Ya compartido aquí' : 'Publicaciones del grupo'}</div>
        </div>
        ${generalYa ? '<span class="selector-tablero-check">✅</span>' : ''}
      </button>`;
    lista.querySelector('.selector-tablero-item')?.addEventListener('click', () => {
      closeModal('modalSelectorTablero');
      onSelect(null, 'Tablero general');
    });
  });
}
let libroSeleccionado = null;

window.abrirModalLibro = function(libroId) {
  const { doc, getDoc } = lib();
  getDoc(doc(db(), 'ec_biblioteca', libroId)).then(snap => {
    if(!snap.exists()) return;
    libroSeleccionado = { id: snap.id, ...snap.data() };
    
    $('libroModalTitulo').textContent = libroSeleccionado.name;
    $('libroModalBadge').textContent = libroSeleccionado.ext;
    $('libroModalAutor').textContent = libroSeleccionado.authorName || 'Anónimo';
    $('libroModalDesc').textContent = libroSeleccionado.descripcion || 'Sin descripción disponible para este archivo.';
    
    const colorClasses = {
      'book-pdf': '#dc2626', 'book-doc': '#2563eb', 'book-xls': '#16a34a', 
      'book-default': '#7c6af7', 'book-cyan': '#06b6d4', 'book-ppt': '#ea580c'
    };
    $('libroModalLomo').style.background = colorClasses[libroSeleccionado.colorClass] || '#7c6af7';

    // ← agrega estas 3 líneas:
    const color = colorClasses[libroSeleccionado.colorClass] || '#7c6af7';
    $('libroModalContent').style.background = `linear-gradient(135deg, ${color}18 0%, var(--bg2) 40%)`;
    $('btnLeerLibro').style.background = color;
    $('btnLeerLibro').style.borderColor = color;
    
    // El botón siempre estará visible con su estilo flex original
    const btnCompartir = $('btnCompartirLibro');
    if (btnCompartir) {
        btnCompartir.style.display = 'flex'; 
    }

    openModal('modalLibroAbierto');
  });
};

$('btnLeerLibro')?.addEventListener('click', () => {
  if(libroSeleccionado && libroSeleccionado.url) window.open(libroSeleccionado.url, '_blank');
});

$('btnCompartirLibro')?.addEventListener('click', async () => {
  if(!libroSeleccionado || !currentGroupId) return;
  closeModal('modalLibroAbierto');

  // Consultar en qué tableros ya existe este libro
  const { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } = lib();
  const existingSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    where('type', '==', 'libro'),
    where('libroData.id', '==', libroSeleccionado.id)
  )).catch(() => null);

  const yaEn = new Set();
  existingSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    `¿En qué tablero compartir "${libroSeleccionado.name}"?`,
    async (tableroId, tableroNombre) => {
      try {
        const feedRef = collection(db(), 'ec_feed');
        // Buscar si ya existe en ESE tablero específico
        const enEste = existingSnap?.docs?.find(d => (d.data().tableroId ?? '') === (tableroId || ''));

        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), {
            createdAt: serverTimestamp(),
            'libroData.colorClass': libroSeleccionado.colorClass,
            'libroData.name': libroSeleccionado.name
          });
          showToast(`📌 ¡El archivo subió al inicio de "${tableroNombre}"!`, 'success');
        } else {
          await addDoc(feedRef, {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            type: 'libro',
            libroData: {
              id: libroSeleccionado.id,
              name: libroSeleccionado.name,
              ext: libroSeleccionado.ext,
              colorClass: libroSeleccionado.colorClass,
              url: libroSeleccionado.url
            },
            text: `📚 Te recomiendo este archivo de la biblioteca.`,
            images: [], authorUid: currentUser.uid, authorName: getUserAlias(),
            authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db(), 'ec_biblioteca', libroSeleccionado.id), { compartidoEnTablero: true });
          showToast(`📌 ¡Libro compartido en "${tableroNombre}"!`, 'success');
        }
      // FIX #4: usar friendlyError para no exponer mensajes técnicos de Firebase al usuario
      } catch (e) { showToast('Error al compartir: ' + friendlyError(e), 'error'); }
    },
    yaEn
  );
});

// Compartir VideoTutorial
// abrirDetalleDvd is defined in videotutoriales.js and called directly via onclick

window.verComentariosDvdDesdeFeed = async function(dvdId, dvdUrl) {
  // Abre el video directo en YouTube sin salir del tablero
  const { doc, getDoc } = lib();
  try {
    let url = dvdUrl;
    if (dvdId && !url) {
      const snap = await getDoc(doc(db(), 'ec_videotutoriales', dvdId));
      if (snap.exists()) url = snap.data().url;
    }
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    // Si no hay URL directa, mostrar error
    showToast('No se encontró el enlace del video.', 'error');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

window.compartirDvd = async function(dvdId) {
  const { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } = lib();
  try {
    const snap = await getDoc(doc(db(), 'ec_videotutoriales', dvdId));
    if (!snap.exists()) return;
    const dvd = snap.data();

    // Consultar en qué tableros ya existe este video
    const existingSnap = await getDocs(query(
      collection(db(), 'ec_feed'),
      where('groupId', '==', currentGroupId),
      where('type', '==', 'videotutorial'),
      where('dvdData.url', '==', dvd.url)
    )).catch(() => null);

    const yaEn = new Set();
    existingSnap?.docs?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

    mostrarSelectorTablero(
      `¿En qué tablero compartir "${dvd.titulo}"?`,
      async (tableroId, tableroNombre) => {
        try {
          const enEste = existingSnap?.docs?.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
          if (enEste) {
            await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
            showToast(`📌 ¡Video subido al inicio de "${tableroNombre}"!`, 'success');
          } else {
            await addDoc(collection(db(), 'ec_feed'), {
              groupId: currentGroupId,
              tableroId: tableroId || '',
              type: 'videotutorial',
              dvdId: dvdId,
              dvdData: { titulo: dvd.titulo, thumbnail: dvd.thumbnail, url: dvd.url },
              text: `📀 Chequen este video tutorial que agregué a la colección.`,
              images: [], authorUid: currentUser.uid, authorName: getUserAlias(),
              authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
              createdAt: serverTimestamp()
            });
            showToast(`📌 ¡Video compartido en "${tableroNombre}"!`, 'success');
          }
        // FIX #4: usar friendlyError para no exponer mensajes técnicos de Firebase al usuario
        } catch (e) { showToast('Error: ' + friendlyError(e), 'error'); }
      },
      yaEn
    );
  // FIX #4: usar friendlyError para no exponer mensajes técnicos de Firebase al usuario
  } catch (e) { showToast('Error: ' + friendlyError(e), 'error'); }
};



/* ── Responsive: re-renderizar feed al cambiar tamaño de ventana ── */
let _resizeTimer = null;
let _lastInnerWidth = window.innerWidth;

window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (currentSection === 'feed' && window.innerWidth !== _lastInnerWidth) {
      _lastInnerWidth = window.innerWidth;
      initFeed();
    }
  }, 250);
});

/* ══════════════════════════════════════════════════════
   iOS KEYBOARD FIX — visualViewport API (unificado)
   Maneja teclado nativo en iPhone: ajusta --chat-h,
   hace scroll al fondo del chat, reposiciona el
   compose bar y enfoca campos en modales.
   Nota: fixChatKeyboardHeight está integrado aquí para
   evitar doble listener de resize/scroll.
══════════════════════════════════════════════════════ */
(function setupIOSKeyboardFix() {
  if (!window.visualViewport) return;

  let _lastVVHeight = window.visualViewport.height;
  /* Detectar iOS una sola vez */
  const _isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function _scrollChatToBottom() {
    const box = $('chatMessages');
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
  }

  /** Lee px ya resueltos de variables fijadas por core.js (--ze-topbar-h, --ze-bottom-nav-clearance). */
  function _readLayoutPx(prop, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function _updateChatHeight(vvHeight, keyboardOpen) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const topbarH  = _readLayoutPx('--ze-topbar-h', 56);
    // FIX iOS: cuando el teclado está abierto en iOS, visualViewport.height ya
    // excluye el teclado — restar también el bottom-nav descuenta espacio que
    // no existe, haciendo --chat-h demasiado pequeño y ocultando el contenido.
    // En Android el teclado NO reduce visualViewport, así que sí necesitamos
    // restar el bottom-nav siempre.
    const bottomH = (isMobile && !(_isIOS && keyboardOpen))
      ? _readLayoutPx('--ze-bottom-nav-clearance', 48)
      : 0;
    const chatH = vvHeight - topbarH - bottomH;
    document.documentElement.style.setProperty('--chat-h', Math.max(chatH, 200) + 'px');
  }

  window.visualViewport.addEventListener('resize', () => {
    const vvHeight = window.visualViewport.height;
    const keyboardOpen = vvHeight < _lastVVHeight - 50;
    _lastVVHeight = vvHeight;

    // 1. Actualizar variable CSS --chat-h (topbar/bottom nav medidos en core.js)
    _updateChatHeight(vvHeight, keyboardOpen);

    // 2. No tocar maxHeight de secciones no-chat: asignar vvHeight completo dejaba
    //    un hueco enorme bajo el contenido al abrir el teclado (viewport ≠ alto útil).

    // 3. Desplazar sección de chat si el teclado cubre contenido
    // FIX: eliminado translateY en el contenedor padre del chat. Aplicarlo aquí
    // mientras .chat-compose-wrapper también tiene su propio transform (listener
    // de scroll más abajo) causaba doble desplazamiento en Android Chrome.
    // El scroll al fondo es suficiente para mantener el input visible.

    // 4. Scroll del chat al fondo cuando aparece el teclado
    // FIX: eliminado alias 'sectionChat' — data-section siempre vale 'chat'
    if (currentSection === 'chat') {
      _scrollChatToBottom();
    }

    // 5. Scroll de modales abiertos al campo activo
    const activeModal = document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
    if (activeModal && keyboardOpen) {
      const focused = activeModal.querySelector('input:focus, textarea:focus');
      if (focused) {
        setTimeout(() => focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
      }
    }
  });

  // Ajustar posición cuando el viewport se desplaza (iOS scroll con teclado)
  // BUG FIX: translateY se eliminó del compose wrapper porque combinar ese
  // transform con el scroll simultáneo de chatMessages causaba doble
  // desplazamiento visible en Android Chrome e iOS Safari.
  // La solución correcta es dejar que el flexbox + --chat-h posicionen el
  // compose bar y solo hacer scroll al fondo del contenedor de mensajes.
  window.visualViewport.addEventListener('scroll', () => {
    const vvH = window.visualViewport?.height;
    // En el evento scroll no sabemos si el teclado está abierto, pero si vvH
    // es menor que _lastVVHeight es porque el teclado ya lo redujo.
    if (vvH) _updateChatHeight(vvH, vvH < _lastVVHeight - 50);

    if (currentSection === 'chat') {
      // Limpiar cualquier transform residual que pudiera haber quedado de
      // versiones anteriores del código
      const chatCompose = document.querySelector('.chat-compose-wrapper');
      if (chatCompose && chatCompose.style.transform) {
        chatCompose.style.transform = '';
      }
      _scrollChatToBottom();
    }
  });

  // NOTA: Se elimina el window.addEventListener('resize') que había aquí
  // porque era redundante con el visualViewport 'resize' de arriba.
  // Tener ambos causaba que _updateChatHeight se llamara dos veces por evento
  // con valores ligeramente distintos, generando un parpadeo de layout.

  // Inicializar --chat-h al cargar (teclado cerrado = keyboardOpen false)
  _updateChatHeight(window.visualViewport.height, false);
})();


window.compartirNotaAlTablero = async function(fotoId, url) {
  const materiaNombre = galeriaActual ? galeriaActual.name : 'Apuntes';
  const galeriaId = galeriaActual ? galeriaActual.id : null;

  mostrarSelectorTablero(
    `¿En qué tablero quieres compartir esta nota de ${materiaNombre}?`,
    async (tableroId, tableroNombre) => {
      try {
        const { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, arrayUnion } = lib();

        // Buscar si ya existe una publicación de esta galería+tablero del mismo autor
        let publicacionExistente = null;
        if (galeriaId) {
          const snap = await getDocs(query(
            collection(db(), 'ec_feed'),
            where('groupId', '==', currentGroupId),
            where('galeriaId', '==', galeriaId),
            where('tableroId', '==', tableroId || ''),
            where('authorUid', '==', currentUser.uid)
          )).catch(() => null);
          if (snap && !snap.empty) publicacionExistente = snap.docs[0];
        }

        if (publicacionExistente) {
          // Ya existe → agregar la foto al array y subir al tope con createdAt nuevo
          const yaImages = publicacionExistente.data().images || [];
          if (yaImages.includes(url)) {
            showToast('Esta foto ya está en la publicación.', 'info');
            return;
          }
          await updateDoc(doc(db(), 'ec_feed', publicacionExistente.id), {
            images: arrayUnion(url),
            createdAt: serverTimestamp()
          });
          showToast(`📌 Foto añadida a la publicación de ${materiaNombre} en "${tableroNombre}"`, 'success');
        } else {
          // No existe → crear publicación nueva
          await addDoc(collection(db(), 'ec_feed'), {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            galeriaId: galeriaId || '',
            type: 'foto',
            text: `📖 Apuntes compartidos de la materia: ${materiaNombre}`,
            images: [url],
            authorUid: currentUser.uid,
            authorName: getUserAlias(),
            authorAvatar: currentUser.avatar,
            likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          showToast(`¡Nota compartida en "${tableroNombre}"! 📌`, 'success');
        }
      // FIX #4: usar friendlyError para no exponer mensajes técnicos de Firebase al usuario
      } catch(e) { showToast('Error al compartir: ' + friendlyError(e), 'error'); }
    }
  );
};




