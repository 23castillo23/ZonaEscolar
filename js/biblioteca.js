/* ═══════════════════════════════════════════════════
   BIBLIOTECA — Archivos PDF/links, categorías/
   repisas, compartir al tablero.
   
   Dependencias: core.js, grupos.js, utils-extra.js
   Colecciones: ec_biblioteca, ec_biblio_categorias
   
   REGLA: Solo lógica de biblioteca aquí.
   Las tareas y el calendario están en tareas.js.
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   BIBLIOTECA - SISTEMA DE REPISAS Y DRIVE (FINAL)
═══════════════════════════════════════════════════ */

// limpiarLinkDrive está declarada en core.js

function initBiblioteca() {
  if (!currentGroupId) return;

  // Manejo del botón "Nueva Repisa" para el Admin
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
  if (btnAddCat) btnAddCat.style.display = isAdmin ? 'inline-block' : 'none';

  if (!bibliotecaUiBound) {
    bibliotecaUiBound = true;

// 2. Abrir Modal de Libro
$('btnAgregarArchivoBiblioMain')?.addEventListener('click', () => {
  if (biblioCategorias.length === 0) {
    showToast('El administrador debe crear una repisa primero.', 'info');
    return;
  }

  // Abrimos el modal
  openModal('modalAgregarBiblio');

  // Limpiamos los campos de texto
  if ($('biblioNombre')) $('biblioNombre').value = '';
  if ($('biblioUrl')) $('biblioUrl').value = '';

  // BUG FIX: Sincronizar selectedBiblioColor con el botón que ya tiene
  // la clase 'selected' en el HTML (book-pdf), en lugar de asumir [0].
  // Así el estado JS siempre coincide con lo visual al abrir el modal.
  const todosLosColores = document.querySelectorAll('.book-color-opt');
  todosLosColores.forEach(b => b.classList.remove('selected'));

  // Buscar el botón 'book-pdf' que es el predeterminado en el HTML
  const defaultColor = document.querySelector('.book-color-opt[data-color="book-pdf"]');
  const primerColor = defaultColor || todosLosColores[0];

  if (primerColor) {
    primerColor.classList.add('selected');
    selectedBiblioColor = primerColor.dataset.color;
  }
});

    // Color picker del modal
    document.querySelectorAll('.book-color-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.book-color-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedBiblioColor = btn.dataset.color;
      });
    });

    // Guardar Categoría (Admin)
    $('btnConfirmarCatBiblio')?.addEventListener('click', async () => {
      const nombre = $('nombreCatBiblio').value.trim();
      if (!nombre) return;
      const { collection, addDoc, serverTimestamp } = lib();
      try {
        await addDoc(collection(db(), 'ec_biblio_categorias'), {
          name: nombre,
          groupId: currentGroupId,
          createdAt: serverTimestamp()
        });
        closeModal('modalNuevaCategoriaBiblio');
        $('nombreCatBiblio').value = '';
      } catch (e) { console.error(e); }
    });

    // Guardar Libro
    const btnConfLibro = $('btnConfirmarBiblio');
    if (btnConfLibro) {
      btnConfLibro.onclick = async () => {
        const nombre = $('biblioNombre').value.trim();
        const urlOriginal = $('biblioUrl').value.trim();
        const catId = $('selectCatBiblio').value;

        if (!nombre || !urlOriginal || !catId) { showToast('Faltan datos.', 'error'); return; }

        const urlLimpia = limpiarLinkDrive(urlOriginal);
        const descripcion = $('biblioDesc') ? $('biblioDesc').value.trim() : ''; // <-- NUEVA LÍNEA: Guarda la descripción

        btnConfLibro.disabled = true;
        btnConfLibro.textContent = '⏳...';

        const { collection, addDoc, serverTimestamp } = lib();
        try {
          await addDoc(collection(db(), 'ec_biblioteca'), {
            groupId: currentGroupId,
            categoriaId: catId,
            name: nombre,
            descripcion: descripcion, // <-- NUEVA LÍNEA: Se manda a Firebase
            url: urlLimpia,
            ext: (nombre.split('.').pop() || 'LINK').toUpperCase(),
            colorClass: selectedBiblioColor,
            authorUid: currentUser.uid,
            authorName: getUserAlias(),
            createdAt: serverTimestamp()
          });
          closeModal('modalAgregarBiblio');
        } catch (e) { showToast(friendlyError(e), 'info'); }
        finally {
          btnConfLibro.disabled = false;
          btnConfLibro.textContent = 'Guardar';
        }
      };
    }
  }
  loadBiblioCategorias();
}

function loadBiblioCategorias() {
  if (catBiblioUnsub) { catBiblioUnsub(); catBiblioUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_biblio_categorias'), where('groupId', '==', currentGroupId));

  catBiblioUnsub = onSnapshot(q, snap => {
    biblioCategorias = [];
    snap.forEach(d => biblioCategorias.push({ id: d.id, ...d.data() }));

    const sel = $('selectCatBiblio');
    if (sel) {
      sel.innerHTML = biblioCategorias.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
        || '<option value="">Crea una repisa primero</option>';
    }
    renderBiblioteca();
  });
}

function renderBiblioteca() {
  const container = $('biblioList');
  if (!container) return;

  if (bibliotecaUnsub) { bibliotecaUnsub(); bibliotecaUnsub = null; }
  const { collection, query, where, onSnapshot } = lib();
  const q = query(collection(db(), 'ec_biblioteca'), where('groupId', '==', currentGroupId));

  bibliotecaUnsub = onSnapshot(q, snap => {
    const todosLosLibros = [];
    snap.forEach(d => todosLosLibros.push({ id: d.id, ...d.data() }));

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
            ${isAdmin ? `<button class="btn-sm" style="color:var(--red);" onclick="eliminarCategoria('${cat.id}', '${cat.name}')">🗑️ Borrar</button>` : ''}
          </div>
          <div class="bookshelf-container">
            ${librosDeEstaCat.map(it => {
        const puedeBorrar = isAdmin || it.authorUid === currentUser.uid;
        return `
                <div class="book-wrapper" title="${escHtml(it.name)}">
                  <div class="book-item ${it.colorClass || 'book-default'}" onclick="event.stopPropagation(); window.abrirModalLibro('${it.id}')">
                    <div class="book-ext-badge">${escHtml(it.ext.substring(0, 4))}</div>
                    <div class="book-spine-title">${escHtml(it.name)}</div>
                  </div>
                  ${puedeBorrar ? `<button class="btn-mat-del" style="top:-10px; right:5px;" onclick="eliminarLibro('${it.id}')">✕</button>` : ''}
                </div>`;
      }).join('') || '<p style="font-size:12px; opacity:0.4; padding:20px; width:100%; text-align:center;">Vacía</p>'}
          </div>
        </div>`;
    }).join('');
  });
}

window.eliminarLibro = function (id) {
  showConfirm({
    title: 'Eliminar archivo',
    message: '¿Eliminar este archivo de la biblioteca? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const { doc, deleteDoc } = lib();
      try { await deleteDoc(doc(db(), 'ec_biblioteca', id)); } catch (e) { }
    }
  });
};

window.eliminarCategoria = function (id, nombre) {
  showConfirm({
    title: 'Eliminar repisa',
    message: `¿Eliminar la repisa "${nombre}" y todos sus archivos? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const { doc, deleteDoc, collection, query, where, getDocs } = lib();
      const q = query(collection(db(), 'ec_biblioteca'), where('categoriaId', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db(), 'ec_biblioteca', d.id));
      await deleteDoc(doc(db(), 'ec_biblio_categorias', id));
    }
  });
};


// calMesOffset declarado en core.js
// _calTareasCache declarado en tareas.js

