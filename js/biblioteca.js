/* ═══════════════════════════════════════════════════
   BIBLIOTECA - SISTEMA DE REPISAS Y DRIVE (FINAL)
═══════════════════════════════════════════════════ */

// limpiarLinkDrive está declarada en la sección de utilidades (línea ~157)

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

  // --- SOLUCIÓN PARA EL COLOR POR DEFECTO ---
  
  // 1. Buscamos TODOS los botones de colores
  const todosLosColores = document.querySelectorAll('.book-color-opt');
  
  // 2. Quitamos la clase 'selected' de todos para empezar de cero
  todosLosColores.forEach(b => b.classList.remove('selected'));

  // 3. Seleccionamos el primero de la lista (sea el color que sea)
  const primerColor = todosLosColores[0]; 

  if (primerColor) {
    primerColor.classList.add('selected'); // Lo marca visualmente
    selectedBiblioColor = primerColor.dataset.color; // Guarda el valor para la base de datos
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

/* ── VISTA CALENDARIO DE TAREAS ── */
function renderCalendarioTareas(tareas) {
  const container = $('tareasList');
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();

  // Agrupar tareas por fecha
  const tareasPorDia = {};
  tareas.filter(t => t.fecha && !t.done).forEach(t => {
    const d = new Date(t.fecha);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tareasPorDia[key]) tareasPorDia[key] = [];
    tareasPorDia[key].push(t);
  });

  // Días del mes
  const primerDia = new Date(año, mes, 1).getDay();
  const diasMes = new Date(año, mes + 1, 0).getDate();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nombresDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  let html = `<div class="cal-header">
    <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
    <span class="cal-mes-label">${nombresMes[mes]} ${año}</span>
    <button class="cal-nav" onclick="calNavegar(1)">›</button>
  </div>
  <div class="cal-grid">
    ${nombresDia.map(d => `<div class="cal-dia-header">${d}</div>`).join('')}`;

  // Espacios vacíos al inicio
  for (let i = 0; i < primerDia; i++) html += `<div class="cal-dia vacio"></div>`;

  for (let dia = 1; dia <= diasMes; dia++) {
    const key = `${año}-${mes}-${dia}`;
    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
    const tsDia = tareasPorDia[key] || [];
    html += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tsDia.length ? 'tiene-tarea' : ''}"
      onclick="calVerDia(${dia},${mes},${año})">
      <span class="cal-num">${dia}</span>
      ${tsDia.length ? `<span class="cal-punto">${tsDia.length}</span>` : ''}
    </div>`;
  }

  html += `</div>`;

  // Tareas del mes con fechas
  const proximas = tareas
    .filter(t => t.fecha && !t.done)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, 10);

  if (proximas.length) {
    html += `<div class="cal-proximas-label">📋 Próximas tareas</div>`;
    html += proximas.map(t => {
      const d = new Date(t.fecha);
      const diasRestantes = Math.ceil((d - hoy) / 86400000);
      const urgente = diasRestantes <= 2 && diasRestantes >= 0;
      const vencida = diasRestantes < 0;
      return `<div class="cal-tarea-item ${urgente ? 'urgente' : ''} ${vencida ? 'vencida-cal' : ''}">
        <div class="cal-tarea-fecha">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          <span class="cal-dias-rest">${vencida ? '⚠️ Vencida' : diasRestantes === 0 ? '¡Hoy!' : `en ${diasRestantes}d`}</span>
        </div>
        <div class="cal-tarea-titulo">${escHtml(t.titulo)}</div>
        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
      </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

let calMesOffset = 0;
window.calNavegar = function (dir) {
  calMesOffset += dir;
  // Rebuscar tareas con el nuevo mes
  const { collection, query, where, orderBy, getDocs } = lib();
  getDocs(query(collection(db(), 'ec_tareas'), where('groupId', '==', currentGroupId), orderBy('createdAt', 'desc')))
    .then(snap => {
      const tareas = [];
      snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
      const hoy = new Date();
      const target = new Date(hoy.getFullYear(), hoy.getMonth() + calMesOffset, 1);
      renderCalMes(tareas, target.getFullYear(), target.getMonth());
    });
};

function renderCalMes(tareas, año, mes) {
  const container = $('tareasList');
  const hoy = new Date();
  const tareasPorDia = {};
  
  // 1. Agrupar las tareas del mes
  tareas.filter(t => t.fecha && !t.done).forEach(t => {
    const d = new Date(t.fecha);
    if (d.getFullYear() === año && d.getMonth() === mes) {
      const key = `${d.getDate()}`;
      if (!tareasPorDia[key]) tareasPorDia[key] = [];
      tareasPorDia[key].push(t);
    }
  });
  
  const primerDia = new Date(año, mes, 1).getDay();
  const diasMes = new Date(año, mes + 1, 0).getDate();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nombresDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // 2. Construir el Header y los días de la semana
  let html = `<div class="cal-header">
    <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
    <span class="cal-mes-label">${nombresMes[mes]} ${año}</span>
    <button class="cal-nav" onclick="calNavegar(1)">›</button>
  </div><div class="cal-grid">
    ${nombresDia.map(d => `<div class="cal-dia-header">${d}</div>`).join('')}`;
    
  // 3. Espacios vacíos antes del día 1
  for (let i = 0; i < primerDia; i++) {
    html += `<div class="cal-dia vacio"></div>`;
  }
  
  // 4. Dibujar los números del mes
  for (let dia = 1; dia <= diasMes; dia++) {
    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
    const tsDia = tareasPorDia[String(dia)] || [];
    
    html += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tsDia.length ? 'tiene-tarea' : ''}"
      onclick="calVerDia(${dia},${mes},${año})">
      <span class="cal-num">${dia}</span>
      ${tsDia.length ? `<span class="cal-punto">${tsDia.length}</span>` : ''}
    </div>`;
  }
  
  // AQUI CERRAMOS EL CALENDARIO CORRECTAMENTE
  html += `</div>`; 

  // -------------------------------------------------------------------------
  // 5. EL CONTENEDOR PARA CUANDO HACES CLIC EN UN DÍA (Vacío al principio)
  // -------------------------------------------------------------------------
  html += `<div id="calListaTareasAbajo" style="margin-top:20px;"></div>`;

  // -------------------------------------------------------------------------
  // 6. EL CONTENEDOR DE PRÓXIMAS TAREAS (Visible al principio)
  // -------------------------------------------------------------------------
  const proximas = tareas.filter(t => t.fecha && !t.done).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 8);
  
  html += `<div id="contenedorProximasTareas">`;
  if (proximas.length > 0) {
    html += `<div class="cal-proximas-label" style="margin-top:20px; margin-bottom:10px;">📋 Próximas tareas</div>`;
    // Usamos la nueva tarjeta de diseño
    html += proximas.map(t => buildTareaHTML(t)).join('');
  }
  html += `</div>`;

  // Finalmente insertamos todo de golpe sin parpadeos
  container.innerHTML = html;
}

window.calVerDia = function (dia, mes, año) {
    // 1. UI: Resaltar día en el calendario
    qsa('.cal-dia').forEach(el => el.classList.remove('selected'));
    const target = qsa('.cal-num').find(el => 
        parseInt(el.textContent) === dia && !el.closest('.cal-dia').classList.contains('vacio')
    );
    if (target) target.closest('.cal-dia').classList.add('selected');

    calDiaSeleccionado = { dia, mes, año };

    // 2. Ocultamos las "Próximas Tareas" generales para que no haya duplicados
    const proxDiv = $('contenedorProximasTareas');
    if (proxDiv) proxDiv.style.display = 'none';

    // 3. Consultamos Firebase para obtener las tareas
    const { collection, query, where, getDocs } = lib();
    const q = query(collection(db(), 'ec_tareas'), where('groupId', '==', currentGroupId));

    getDocs(q).then(snap => {
        const filtradas = [];
        snap.forEach(d => {
            const t = d.data();
            if (t.fecha) {
                // Hay que usar Date local, no toDate() directamente porque viene en string desde tu input type="datetime-local"
                const dTarea = new Date(t.fecha);
                if (dTarea.getDate() === dia && dTarea.getMonth() === mes && dTarea.getFullYear() === año) {
                    filtradas.push({ id: d.id, ...t });
                }
            }
        });

        // 4. Renderizamos el resultado en el contenedor de abajo
        const listaAbajo = $('calListaTareasAbajo');
        if (!listaAbajo) return;

        const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        listaAbajo.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="font-size:14px; color:var(--accent2); margin:0;">📌 Tareas del ${dia} de ${nombresMes[mes]}</h4>
                <button onclick="resetVistaCalendario()" style="background:none; border:none; color:var(--text3); font-size:11px; cursor:pointer; text-decoration:underline;">
                    Ver próximas tareas
                </button>
            </div>
            ${filtradas.length === 0 
                ? `<div style="padding:20px; text-align:center; background:var(--bg3); border-radius:12px; border:1px dashed var(--border); font-size:13px; color:var(--text2);">No hay tareas para este día.</div>` 
                : filtradas.map(t => buildTareaHTML(t)).join('')
            }
        `;
    });
};

// Función para volver al estado inicial (Quitar el filtro)
window.resetVistaCalendario = function() {
    qsa('.cal-dia').forEach(el => el.classList.remove('selected'));
    calDiaSeleccionado = null; // Borramos la selección
    
    const listaAbajo = $('calListaTareasAbajo');
    if (listaAbajo) listaAbajo.innerHTML = ''; // Limpiamos el detalle
    
    const proxDiv = $('contenedorProximasTareas');
    if (proxDiv) proxDiv.style.display = 'block'; // Mostramos las próximas de nuevo
};

function renderTareasEnListaPrincipal(tareas, dia, mes) {
    const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const contenedor = $('tareasList'); // El contenedor que ya tienes abajo
    
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h4 style="font-size:14px; color:var(--accent2); margin:0;">
                📌 Tareas del ${dia} de ${nombresMes[mes]}
            </h4>
            <button onclick="initTareas()" style="background:none; border:none; color:var(--text2); font-size:11px; cursor:pointer; text-decoration:underline;">
                Ver todas las tareas
            </button>
        </div>
    `;

    if (tareas.length === 0) {
        html += `
            <div style="padding:30px; text-align:center; opacity:0.6; border:1px dashed var(--border); border-radius:12px;">
                <p>No hay tareas pendientes para este día.</p>
            </div>`;
    } else {
        html += `<div class="tareas-grid-propia">
                    ${tareas.map(t => buildTareaHTML(t)).join('')}
                 </div>`;
    }

    contenedor.innerHTML = html;
    
    // Opcional: Hacer scroll suave hacia la lista para ver los resultados
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.toggleTarea = async function (id, done) {
  const checkBtn = document.querySelector(`.tarea-check[onclick*="'${id}'"]`) 
                || document.querySelector(`.tarea-check[onclick*='"${id}"']`);
  if (checkBtn) { checkBtn.style.opacity = '0.4'; checkBtn.style.pointerEvents = 'none'; }
  const { doc, updateDoc } = lib();
  try {
    await updateDoc(doc(db(), 'ec_tareas', id), { done });
  } finally {
    if (checkBtn) { checkBtn.style.opacity = ''; checkBtn.style.pointerEvents = ''; }
  }
};

window.compartirTarea = async function(tareaId) {
  if (!currentGroupId) return;

  const { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp } = lib();

  // Obtener datos de la tarea primero
  const tareaSnap = await getDoc(doc(db(), 'ec_tareas', tareaId)).catch(() => null);
  if (!tareaSnap?.exists()) { showToast('No se encontró la tarea.', 'error'); return; }
  const tData = tareaSnap.data();
  const titulo = tData.titulo || 'Tarea';

  // Consultar en qué tableros ya existe esta tarea compartida en el feed
  const existingSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    where('type', '==', 'tarea_compartida'),
    where('tareaId', '==', tareaId)
  )).catch(() => null);

  const yaEn = new Set();
  existingSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    `¿En qué tablero compartir "${titulo}"?`,
    async (tableroId, tableroNombre) => {
      try {
        const enEste = existingSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
          showToast(`📌 ¡La tarea subió al inicio de "${tableroNombre}"!`, 'success');
        } else {

          const metaPartes = [];
          if (tData.responsable) metaPartes.push(`Responsable: ${tData.responsable}`);
          if (tData.fecha) metaPartes.push(`Fecha: ${new Date(tData.fecha).toLocaleDateString('es-MX')}`);

          await addDoc(collection(db(), 'ec_feed'), {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            type: 'tarea_compartida',
            tareaId: tareaId,
            text: `📋 Nueva tarea: "${titulo}"${metaPartes.length ? ' · ' + metaPartes.join(' · ') : ''}`,
            images: [],
            authorUid: currentUser.uid,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            likes: 0, likedBy: [], commentCount: 0,
            createdAt: serverTimestamp()
          });
          showToast(`📌 ¡Tarea compartida en "${tableroNombre}"!`, 'success');
        }
      } catch (e) { showToast('No se pudo compartir. ' + friendlyError(e), 'error'); }
    },
    yaEn
  );
};

window.eliminarTarea = async function (id) {
    const { doc, getDoc, deleteDoc } = lib();
    try {
        const snap = await getDoc(doc(db(), 'ec_tareas', id));
        if (!snap.exists()) return;
        const data = snap.data();

        // LÓGICA DE PERMISOS: Admin O Creador de la tarea
        const esCreador = data.authorUid === currentUser.uid;

        if (!isAdmin && !esCreador) {
            showToast("Acceso denegado: Solo el administrador o quien creó la tarea pueden eliminarla.", 'error');
            return;
        }

        showConfirm({
          title: 'Eliminar tarea',
          message: '¿Estás seguro de eliminar esta tarea? Esta acción no se puede deshacer.',
          confirmText: 'Eliminar',
          onConfirm: async () => {
            try {
              await deleteDoc(doc(db(), 'ec_tareas', id));
              if (calDiaSeleccionado) calVerDia(calDiaSeleccionado.dia, calDiaSeleccionado.mes, calDiaSeleccionado.año);
            } catch (e) { showToast(friendlyError(e), 'error'); }
          }
        });
    } catch (e) { 
        showToast(friendlyError(e), 'error'); 
    }
};

// 1. Botones de Filtro (Todas, Pendientes, Completadas)
qsa('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tareasFilter = btn.dataset.filter;
    tareasVistaCalendario = false;
    
    // --- MAGIA: Limpiar memoria del calendario al salir ---
    calMesOffset = 0; 
    calDiaSeleccionado = null; 
    
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('btnCalendarioTareas')?.classList.remove('active');
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
    initTareas();
  });
});

// 2. Botón para abrir/cerrar el Calendario
$('btnCalendarioTareas')?.addEventListener('click', () => {
  tareasVistaCalendario = !tareasVistaCalendario;
  $('btnCalendarioTareas').classList.toggle('active', tareasVistaCalendario);
  
  if (tareasVistaCalendario) {
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    $('tareasList').innerHTML = '<div class="feed-loading">Cargando calendario…</div>';
    
    calMesOffset = 0; // Asegurar que abra en el mes actual
    // --- MAGIA: Pre-seleccionar HOY automáticamente al entrar ---
    const hoy = new Date();
    calDiaSeleccionado = { dia: hoy.getDate(), mes: hoy.getMonth(), año: hoy.getFullYear() };
    
  } else {
    qsa('.filter-btn')[0]?.classList.add('active');
    
    // --- MAGIA: Limpiar memoria al cerrar el calendario ---
    calMesOffset = 0; 
    calDiaSeleccionado = null; 
  }
  
  if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
  initTareas();
});

// 1. Abrir el modal de nueva tarea y limpiar la lista de temas si había algo escrito antes
$('btnNuevaTarea').addEventListener('click', () => {
  const lista = $('subtareasList');
  if (lista) lista.innerHTML = ''; 
  openModal('modalNuevaTarea');
});

// 2. Darle función al botón de "+ Agregar tema"
$('btnAddSubtarea')?.addEventListener('click', () => {
  const list = $('subtareasList');
  if (!list) return;
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '6px';
  div.innerHTML = `
      <input type="text" class="modal-input sub-texto" placeholder="Ej: Tema" style="flex:2; margin:0; padding:6px 10px; font-size:12px;">
      <input type="text" class="modal-input sub-resp" placeholder="¿Quién?" style="flex:1; margin:0; padding:6px 10px; font-size:12px;">
      <button type="button" onclick="this.parentElement.remove()" style="background:var(--bg4); color:var(--red); border:none; border-radius:6px; padding:0 8px; font-size:12px; cursor:pointer;">✕</button>
  `;
  list.appendChild(div);
});

// 3. Confirmar y guardar la tarea (AQUÍ ESTÁ TU CÓDIGO ANTERIOR INTEGRADO CON LOS SUB-TEMAS)
$('btnConfirmarTarea').addEventListener('click', async () => {
  const titulo = $('tareaTitulo').value.trim();
  if (!titulo) { showToast('Escribe el título de la tarea.', 'warning'); return; }
  
  // --- NUEVO: Recolectar las sub-tareas ---
  const subtareas = [];
  qsa('#subtareasList > div').forEach(div => {
      const texto = div.querySelector('.sub-texto').value.trim();
      const resp = div.querySelector('.sub-resp').value.trim();
      if (texto) {
          subtareas.push({ texto: texto, responsable: resp, done: false });
      }
  });

  const btn = $('btnConfirmarTarea');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Guardando…';

  const { collection, addDoc, serverTimestamp } = lib();
  try {
    const tarea = {
      groupId: currentGroupId,
      titulo,
      desc: $('tareaDesc').value.trim(),
      responsable: $('tareaResponsable').value.trim(),
      fecha: $('tareaFecha').value || null,
      materia: $('tareaMateria').value.trim(),
      done: false,
      subtareas: subtareas, // <-- Guardamos la lista dinámica en Firebase
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      createdAt: serverTimestamp()
    };
    
    // Guardar en la colección de tareas
    await addDoc(collection(db(), 'ec_tareas'), tarea);
    
    closeModal('modalNuevaTarea');
    
    // Limpiamos los campos después de guardar
    ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaMateria'].forEach(id => $(id).value = '');
    $('subtareasList').innerHTML = ''; 
    
  } catch (e) { showToast(friendlyError(e), 'error'); }
  finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

