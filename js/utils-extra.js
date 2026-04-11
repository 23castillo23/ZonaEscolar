
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
            images: [], authorUid: currentUser.uid, authorName: currentUser.name,
            authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db(), 'ec_biblioteca', libroSeleccionado.id), { compartidoEnTablero: true });
          showToast(`📌 ¡Libro compartido en "${tableroNombre}"!`, 'success');
        }
      } catch (e) { showToast('Error al compartir: ' + e.message, 'error'); }
    },
    yaEn
  );
});

// Compartir VideoTutorial
window.abrirDetalleDvd = abrirDetalleDvd;

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
              images: [], authorUid: currentUser.uid, authorName: currentUser.name,
              authorAvatar: currentUser.avatar, likes: 0, likedBy: [], commentCount: 0,
              createdAt: serverTimestamp()
            });
            showToast(`📌 ¡Video compartido en "${tableroNombre}"!`, 'success');
          }
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
      },
      yaEn
    );
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
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
   iOS KEYBOARD FIX — visualViewport API
   Cuando el teclado sube/baja en iPhone, reajustamos
   el chat y los modales para que no queden tapados
══════════════════════════════════════════════════════ */
(function setupIOSKeyboardFix() {
  if (!window.visualViewport) return;

  let _lastVVHeight = window.visualViewport.height;

  window.visualViewport.addEventListener('resize', () => {
    const vvHeight = window.visualViewport.height;
    const keyboardOpen = vvHeight < _lastVVHeight - 50;
    const keyboardClosed = vvHeight > _lastVVHeight + 50;
    _lastVVHeight = vvHeight;

    // 1. Ajustar sección activa para que no quede tapada
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
      if (keyboardOpen) {
        // Teclado subió: reducir altura del contenedor
        activeSection.style.maxHeight = vvHeight + 'px';
      } else if (keyboardClosed) {
        activeSection.style.maxHeight = '';
      }
    }

    // 2. Scroll del chat al fondo cuando aparece el teclado
    if (currentSection === 'chat' || currentSection === 'sectionChat') {
      const box = $('chatMessages');
      if (box) {
        setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
      }
    }

    // 3. Scroll de modales abiertos al campo activo
    const activeModal = document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
    if (activeModal && keyboardOpen) {
      const focused = activeModal.querySelector('input:focus, textarea:focus');
      if (focused) {
        setTimeout(() => focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
      }
    }
  });

  // Ajustar posición cuando el viewport se desplaza (iOS scroll con teclado)
  window.visualViewport.addEventListener('scroll', () => {
    if (currentSection === 'chat' || currentSection === 'sectionChat') {
      const chatCompose = document.querySelector('.chat-compose-wrapper');
      if (chatCompose) {
        const offsetY = window.visualViewport.offsetTop;
        chatCompose.style.transform = offsetY ? `translateY(${offsetY}px)` : '';
      }
    }
  });
})();


window.compartirNotaAlTablero = async function(fotoId, url) {
  const materiaNombre = galeriaActual ? galeriaActual.name : 'Apuntes';
  const galeriaId = galeriaActual ? galeriaActual.id : null;

  mostrarSelectorTablero(
    `¿En qué tablero quieres compartir esta nota de ${materiaNombre}?`,
    async (tableroId, tableroNombre) => {
      try {
        const { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, arrayUnion } = window._fbLib;
        const db = window._db;

        // Buscar si ya existe una publicación de esta galería+tablero del mismo autor
        let publicacionExistente = null;
        if (galeriaId) {
          const snap = await getDocs(query(
            collection(db, 'ec_feed'),
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
          await updateDoc(doc(db, 'ec_feed', publicacionExistente.id), {
            images: arrayUnion(url),
            createdAt: serverTimestamp()
          });
          showToast(`📌 Foto añadida a la publicación de ${materiaNombre} en "${tableroNombre}"`, 'success');
        } else {
          // No existe → crear publicación nueva
          await addDoc(collection(db, 'ec_feed'), {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            galeriaId: galeriaId || '',
            type: 'foto',
            text: `📖 Apuntes compartidos de la materia: ${materiaNombre}`,
            images: [url],
            authorUid: currentUser.uid,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          showToast(`¡Nota compartida en "${tableroNombre}"! 📌`, 'success');
        }
      } catch(e) { showToast('Error al compartir: ' + e.message, 'error'); }
    }
  );
};


/* ══════════════════════════════════════════════════════
   FIX MÓVIL: Teclado en Chat — iOS Safari no reduce
   dvh cuando sube el teclado nativo, así que usamos
   visualViewport para calcular la altura real disponible
   y la asignamos como variable CSS --chat-h
══════════════════════════════════════════════════════ */
(function fixChatKeyboardHeight() {
  if (!window.visualViewport) return;

  const BOTTOM_NAV_H = 48;  // altura de la bottom nav
  const TOP_BAR_H = 56;     // altura del topbar

  function updateChatHeight() {
    const vvHeight = window.visualViewport.height;
    const safeTop = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--sat') || '0') || 0;
    const safeBottom = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--sab') || '0') || 0;

    const chatH = vvHeight - TOP_BAR_H - BOTTOM_NAV_H - safeTop - safeBottom;
    document.documentElement.style.setProperty('--chat-h', Math.max(chatH, 200) + 'px');

    // Scroll al fondo de los mensajes cuando sube el teclado
    if (currentSection === 'chat' || currentSection === 'sectionChat') {
      const box = document.getElementById('chatMessages');
      if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
    }
    
    // Desplazar la sección de chat si el teclado cubre contenido
    const activeSection = document.querySelector('#sectionChat.active');
    if (activeSection) {
      const offsetY = window.visualViewport.offsetY;
      const offsetX = window.visualViewport.offsetX;
      if (offsetY > 0) {
        activeSection.style.transform = `translateY(-${Math.min(offsetY, 120)}px)`;
      } else {
        activeSection.style.transform = '';
      }
    }
  }

  window.visualViewport.addEventListener('resize', updateChatHeight);
  window.visualViewport.addEventListener('scroll', updateChatHeight);
  window.addEventListener('resize', updateChatHeight);
  updateChatHeight();
})();
