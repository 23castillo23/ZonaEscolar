/* ═══════════════════════════════════════════════════
   BIBLIOTECA — Archivos PDF/links, categorías/
   repisas, compartir al tablero.
   
   Dependencias: core.js, grupos.js, utils-extra.js
   Colecciones: ec_biblioteca, ec_biblio_categorias
   
   MIGRADO a AppState v2:
   · Variables propias leídas/escritas con AppState.get/set
   · AppState.unsub() reemplaza el patrón if(x){x();x=null}
   · AppState.on('currentGroupId') recarga limpio al cambiar grupo
   · window.eliminarLibro / window.eliminarCategoria → delegación
═══════════════════════════════════════════════════ */

/* ── Reaccionar al cambio de grupo ─────────────────
   Cuando el usuario cambia de grupo, bibliotecaUiBound
   se resetea para que el nuevo grupo pueda registrar
   sus propios listeners de UI sin conflicto.
─────────────────────────────────────────────────── */
AppState.on('currentGroupId', (nuevoId) => {
  /* Cancelar listeners del grupo anterior */
  AppState.unsub('bibliotecaUnsub');
  AppState.unsub('catBiblioUnsub');
  /* Permitir que initBiblioteca re-registre listeners de UI para el nuevo grupo */
  AppState.set('bibliotecaUiBound', false);
});

function initBiblioteca() {
  if (!AppState.get('currentGroupId')) return;

  /* Botón "+ Nueva Repisa" — solo admin */
  let btnAddCat = $('btnNuevaCatBiblio');
  if (!btnAddCat) {
    const header = document.querySelector('.biblio-actions');
    if (header) {
      btnAddCat = document.createElement('button');
      btnAddCat.id = 'btnNuevaCatBiblio';
      btnAddCat.className = 'btn-sm';
      btnAddCat.textContent = '+ Nueva Repisa';
      btnAddCat.style.marginRight = '8px';
      btnAddCat.onclick = () => openModal('modalNuevaCategoriaBiblio');
      header.prepend(btnAddCat);
    }
  }
  if (btnAddCat) btnAddCat.style.display = AppState.get('isAdmin') ? 'inline-block' : 'none';

  if (!AppState.get('bibliotecaUiBound')) {
    AppState.set('bibliotecaUiBound', true);

    /* Abrir modal de libro */
    $('btnAgregarArchivoBiblioMain')?.addEventListener('click', () => {
      if (AppState.get('biblioCategorias').length === 0) {
        showToast('El administrador debe crear una repisa primero.', 'info');
        return;
      }
      openModal('modalAgregarBiblio');
      if ($('biblioNombre')) $('biblioNombre').value = '';
      if ($('biblioUrl'))    $('biblioUrl').value    = '';

      const todosLosColores = document.querySelectorAll('.book-color-opt');
      todosLosColores.forEach(b => b.classList.remove('selected'));
      const defaultColor = document.querySelector('.book-color-opt[data-color="book-pdf"]');
      const primerColor  = defaultColor || todosLosColores[0];
      if (primerColor) {
        primerColor.classList.add('selected');
        AppState.set('selectedBiblioColor', primerColor.dataset.color);
      }
    });

    /* Color picker */
    document.querySelectorAll('.book-color-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.book-color-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        AppState.set('selectedBiblioColor', btn.dataset.color);
      });
    });

    /* Guardar categoría (admin) */
    $('btnConfirmarCatBiblio')?.addEventListener('click', async () => {
      const nombre = $('nombreCatBiblio').value.trim();
      if (!nombre) return;
      const { collection, addDoc, serverTimestamp } = lib();
      try {
        await addDoc(collection(db(), 'ec_biblio_categorias'), {
          name: nombre,
          groupId: AppState.get('currentGroupId'),
          createdAt: serverTimestamp()
        });
        closeModal('modalNuevaCategoriaBiblio');
        $('nombreCatBiblio').value = '';
      } catch (e) { console.error(e); }
    });

    /* Guardar libro */
    const btnConfLibro = $('btnConfirmarBiblio');
    if (btnConfLibro) {
      btnConfLibro.onclick = async () => {
        const nombre      = $('biblioNombre').value.trim();
        const urlOriginal = $('biblioUrl').value.trim();
        const catId       = $('selectCatBiblio').value;

        if (!nombre || !urlOriginal || !catId) { showToast('Faltan datos.', 'error'); return; }

        const urlLimpia    = limpiarLinkDrive(urlOriginal);
        const descripcion  = $('biblioDesc') ? $('biblioDesc').value.trim() : '';
        const cu           = AppState.get('currentUser');

        btnConfLibro.disabled    = true;
        btnConfLibro.textContent = '⏳...';

        const { collection, addDoc, serverTimestamp } = lib();
        try {
          await addDoc(collection(db(), 'ec_biblioteca'), {
            groupId:    AppState.get('currentGroupId'),
            categoriaId: catId,
            name:        nombre,
            descripcion,
            url:         urlLimpia,
            ext:         (nombre.split('.').pop() || 'LINK').toUpperCase(),
            colorClass:  AppState.get('selectedBiblioColor'),
            authorUid:   cu.uid,
            authorName:  getUserAlias(),
            createdAt:   serverTimestamp()
          });
          closeModal('modalAgregarBiblio');
        } catch (e) { showToast(friendlyError(e), 'info'); }
        finally {
          btnConfLibro.disabled    = false;
          btnConfLibro.textContent = 'Guardar';
        }
      };
    }
  }

  loadBiblioCategorias();
}

function loadBiblioCategorias() {
  AppState.unsub('catBiblioUnsub');

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_biblio_categorias'),
    where('groupId', '==', AppState.get('currentGroupId'))
  );

  AppState.set('catBiblioUnsub', onSnapshot(q, snap => {
    const cats = [];
    snap.forEach(d => cats.push({ id: d.id, ...d.data() }));
    AppState.set('biblioCategorias', cats);

    const sel = $('selectCatBiblio');
    if (sel) {
      sel.innerHTML = cats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
        || '<option value="">Crea una repisa primero</option>';
    }
    renderBiblioteca();
  }));
}

function renderBiblioteca() {
  const container = $('biblioList');
  if (!container) return;

  AppState.unsub('bibliotecaUnsub');

  const { collection, query, where, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_biblioteca'),
    where('groupId', '==', AppState.get('currentGroupId'))
  );

  AppState.set('bibliotecaUnsub', onSnapshot(q, snap => {
    const todosLosLibros = [];
    snap.forEach(d => todosLosLibros.push({ id: d.id, ...d.data() }));

    const biblioCategorias = AppState.get('biblioCategorias');
    const isAdmin          = AppState.get('isAdmin');
    const cu               = AppState.get('currentUser');

    if (biblioCategorias.length === 0) {
      container.innerHTML = '<div class="feed-loading">El admin debe crear una repisa.</div>';
      return;
    }

    container.innerHTML = biblioCategorias.map(cat => {
      const librosDeEstaCat = todosLosLibros.filter(l => l.categoriaId === cat.id);
      return `
        <div class="repisa-bloque" style="margin-bottom: 40px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:5px;">
            <h3 style="font-family:var(--font-display); font-size:16px;">📚 ${escHtml(cat.name)}</h3>
            ${isAdmin ? `<button class="btn-sm" style="color:var(--red);" data-action="eliminar-categoria" data-id="${cat.id}" data-nombre="${escHtml(cat.name)}">🗑️ Borrar</button>` : ''}
          </div>
          <div class="bookshelf-container">
            ${librosDeEstaCat.map(it => {
              const puedeBorrar = isAdmin || it.authorUid === cu.uid;
              return `
                <div class="book-wrapper" title="${escHtml(it.name)}">
                  <div class="book-item ${it.colorClass || 'book-default'}"
                       data-action="abrir-libro" data-id="${it.id}">
                    <div class="book-ext-badge">${escHtml(it.ext.substring(0, 4))}</div>
                    <div class="book-spine-title">${escHtml(it.name)}</div>
                  </div>
                  ${puedeBorrar ? `<button class="btn-mat-del" style="top:-10px; right:5px;"
                      data-action="eliminar-libro" data-id="${it.id}">✕</button>` : ''}
                </div>`;
            }).join('') || '<p style="font-size:12px; opacity:0.4; padding:20px; width:100%; text-align:center;">Vacía</p>'}
          </div>
        </div>`;
    }).join('');
  }));
}

/* ── Delegación de eventos — sin window.* ────────── */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, nombre } = btn.dataset;

  if (action === 'abrir-libro') {
    e.stopPropagation();
    window.abrirModalLibro(id); /* definida en utils-extra.js */
  }

  if (action === 'eliminar-libro') {
    showConfirm({
      title: 'Eliminar archivo',
      message: '¿Eliminar este archivo de la biblioteca? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        const { doc, deleteDoc } = lib();
        try { await deleteDoc(doc(db(), 'ec_biblioteca', id)); } catch (e) {}
      }
    });
  }

  if (action === 'eliminar-categoria') {
    showConfirm({
      title: 'Eliminar repisa',
      message: `¿Eliminar la repisa "${nombre}" y todos sus archivos? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        const { doc, deleteDoc, collection, query, where, getDocs } = lib();
        const q    = query(collection(db(), 'ec_biblioteca'), where('categoriaId', '==', id));
        const snap = await getDocs(q);
        for (const d of snap.docs) await deleteDoc(doc(db(), 'ec_biblioteca', d.id));
        await deleteDoc(doc(db(), 'ec_biblio_categorias', id));
      }
    });
  }
});

/* Mantener window.eliminarLibro / window.eliminarCategoria por compatibilidad
   con cualquier llamada inline que aún exista en el HTML */
window.eliminarLibro = function(id) {
  document.dispatchEvent(new CustomEvent('click', { bubbles: true,
    detail: { action: 'eliminar-libro', id } }));
  /* Fallback directo */
  showConfirm({
    title: 'Eliminar archivo',
    message: '¿Eliminar este archivo? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const { doc, deleteDoc } = lib();
      try { await deleteDoc(doc(db(), 'ec_biblioteca', id)); } catch (e) {}
    }
  });
};

window.eliminarCategoria = function(id, nombre) {
  showConfirm({
    title: 'Eliminar repisa',
    message: `¿Eliminar la repisa "${nombre}" y todos sus archivos?`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const { doc, deleteDoc, collection, query, where, getDocs } = lib();
      const q    = query(collection(db(), 'ec_biblioteca'), where('categoriaId', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db(), 'ec_biblioteca', d.id));
      await deleteDoc(doc(db(), 'ec_biblio_categorias', id));
    }
  });
};
