/* ═══════════════════════════════════════════════════
   TAREAS — Crear/completar/filtrar tareas,
   subtareas, calendario mensual.
   
   Dependencias: core.js, grupos.js
   Colecciones: ec_tareas
   
   REGLA: Todo lo de tareas va aquí.
   toggleTarea,
   compartirTarea y eliminarTarea viven aquí,
   NO en biblioteca.js.
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   TAREAS
═══════════════════════════════════════════════════ */

function initTareas() {
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }

    const { collection, query, where, orderBy, onSnapshot } = lib();
    const q = query(
        collection(db(), 'ec_tareas'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc')
    );

    $('tareasList').innerHTML = '<div class="feed-loading">Cargando tareas…</div>';

    tareasUnsub = onSnapshot(q, snap => {
        const tareas = [];
        snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
        renderTareas(tareas);
    });
}

function renderTareas(tareas) {
  let filtradas = tareas;
  if (tareasFilter === 'pending') filtradas = tareas.filter(t => !t.done);
  if (tareasFilter === 'done') filtradas = tareas.filter(t => t.done);

  if (!filtradas.length) {
    $('tareasList').innerHTML = '<div class="feed-loading">No hay tareas aquí.</div>';
    return;
  }
  // Reutilizamos buildTareaHTML para tener permisos correctos y subtareas visibles en ambas vistas
  $('tareasList').innerHTML = filtradas.map(t => buildTareaHTML(t)).join('');
}

function buildTareaHTML(t) {
    const esMio = t.authorUid === currentUser.uid;
    const tienePermiso = isAdmin || esMio;

    // --- NUEVO: Renderizar sub-tareas si existen ---
    let subTareasHtml = '';
    if (t.subtareas && t.subtareas.length > 0) {
        const total = t.subtareas.length;
        const completadas = t.subtareas.filter(s => s.done).length;
        const progreso = total === 0 ? 0 : Math.round((completadas / total) * 100);

        subTareasHtml = `
        <div style="margin-top:12px; background:var(--bg1); padding:10px; border-radius:8px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:11px; color:var(--text2);">
                <span>Progreso del equipo: ${completadas}/${total}</span>
                <span>${progreso}%</span>
            </div>
            <div style="width:100%; height:4px; background:var(--bg3); border-radius:2px; margin-bottom:12px; overflow:hidden;">
                <div style="width:${progreso}%; height:100%; background:var(--green); transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${t.subtareas.map((sub, idx) => `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" style="accent-color:var(--accent); width:14px; height:14px; cursor:pointer;" 
                               ${sub.done ? 'checked' : ''} 
                               onchange="toggleSubtarea('${t.id}', ${idx}, this.checked)">
                        <span style="font-size:12px; ${sub.done ? 'text-decoration:line-through; opacity:0.5;' : 'color:var(--text0);'} flex:1;">
                            ${escHtml(sub.texto)}
                        </span>
                        ${sub.responsable ? `<span style="font-size:10px; background:var(--bg3); padding:2px 6px; border-radius:4px; color:var(--text2);">${escHtml(sub.responsable)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // FIX #5: parsear la fecha con hora local explícita para evitar el desfase de zona
    // horaria. Sin 'T00:00:00', new Date("YYYY-MM-DD") interpreta como UTC medianoche,
    // lo que hace que la tarea aparezca vencida un día antes en UTC-6 (México).
    const vence = t.fecha ? new Date(t.fecha + 'T00:00:00') : null;
    const vencida = vence && vence < new Date() && !t.done;

    return `
    <div class="tarea-card ${t.done ? 'done' : ''}" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div style="display:flex; gap:12px; flex:1;">
                <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}', ${!t.done})">
                    ${t.done ? '✓' : ''}
                </button>
                <div class="tarea-body">
                    <div class="tarea-titulo">${escHtml(t.titulo)}</div>
                    ${t.desc ? `<div class="tarea-desc">${escHtml(t.desc)}</div>` : ''}
                    <div class="tarea-meta" style="margin-top:6px;">
                        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
                        ${t.responsable && (!t.subtareas || t.subtareas.length === 0) ? `<span class="tarea-badge badge-responsable" style="opacity:0.7;">👤 ${escHtml(t.responsable)}</span>` : ''}
                        ${vence ? `<span class="tarea-badge badge-fecha ${vencida ? 'vencida' : ''}">
                            ${vencida ? '⚠️' : '📅'} ${vence.toLocaleDateString('es-MX')}${t.hora ? ' · ⏰ ' + t.hora : ''}
                        </span>` : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:10px;">
              <button class="tarea-share-btn" title="Compartir en tablero" onclick="compartirTarea('${t.id}')">📌</button>
              ${tienePermiso ? `<button class="tarea-delete" onclick="eliminarTarea('${t.id}')">🗑️</button>` : ''}
            </div>
        </div>
        ${subTareasHtml}
    </div>`;
}

window.toggleSubtarea = async function(tareaId, subIdx, isDone) {
    const { doc, getDoc, updateDoc } = lib();
    try {
        const ref = doc(db(), 'ec_tareas', tareaId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        
        const data = snap.data();
        const subs = data.subtareas || [];
        
        if (subs[subIdx]) {
            subs[subIdx].done = isDone;
            
            // Evaluamos si todas las sub-tareas ya se completaron
            const todasCompletadas = subs.every(s => s.done);
            
            // Actualizamos el array en Firestore y, si todas están listas, marcamos la tarea principal como "done"
            await updateDoc(ref, { 
                subtareas: subs, 
                done: todasCompletadas 
            });
        }
    } catch (e) {
        console.error("Error al actualizar sub-tarea:", e);
    }
};


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
          // FIX #5: parsear con hora local para evitar desfase UTC en México
          if (tData.fecha) {
            let fechaStr = new Date(tData.fecha + 'T00:00:00').toLocaleDateString('es-MX');
            if (tData.hora) fechaStr += ' · ⏰ ' + tData.hora;
            metaPartes.push(`Fecha: ${fechaStr}`);
          }

          await addDoc(collection(db(), 'ec_feed'), {
            groupId: currentGroupId,
            tableroId: tableroId || '',
            type: 'tarea_compartida',
            tareaId: tareaId,
            text: `📋 Nueva tarea: "${titulo}"${metaPartes.length ? ' · ' + metaPartes.join(' · ') : ''}`,
            images: [],
            authorUid: currentUser.uid,
            // BUG FIX: usar getUserAlias() en lugar de currentUser.name para
            // respetar el apodo/alias configurado por el usuario en el grupo.
            authorName: getUserAlias(),
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
            } catch (e) { showToast(friendlyError(e), 'error'); }
          }
        });
    } catch (e) { 
        showToast(friendlyError(e), 'error'); 
    }
};

/* ═══════════════════════════════════════════════════
   EVENTOS DE UI — Filtros
═══════════════════════════════════════════════════ */
// 1. Botones de Filtro (Todas, Pendientes, Completadas)
qsa('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tareasFilter = btn.dataset.filter;
    qsa('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (tareasUnsub) { tareasUnsub(); tareasUnsub = null; }
    initTareas();
  });
});

// 1. Abrir el modal de nueva tarea y limpiar la lista de temas si había algo escrito antes
$('btnNuevaTarea').addEventListener('click', () => {
  ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaHora', 'tareaMateria'].forEach(id => { if ($(id)) $(id).value = ''; });
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
    // BUG FIX: tareaFecha es datetime-local ("YYYY-MM-DDTHH:mm"), se normaliza
    // a solo la parte de fecha ("YYYY-MM-DD") para que todo el código de parseo
    // que concatena 'T00:00:00' siga funcionando correctamente.
    const fechaRaw = $('tareaFecha').value || null;
    const fechaNorm = fechaRaw ? fechaRaw.split('T')[0] : null;
    const horaNorm = $('tareaHora').value || null;

    const tarea = {
      groupId: currentGroupId,
      titulo,
      desc: $('tareaDesc').value.trim(),
      responsable: $('tareaResponsable').value.trim(),
      fecha: fechaNorm,
      hora: horaNorm,
      materia: $('tareaMateria').value.trim(),
      done: false,
      subtareas: subtareas, // <-- Guardamos la lista dinámica en Firebase
      authorUid: currentUser.uid,
      // BUG FIX: usar getUserAlias() para respetar el alias del grupo.
      authorName: getUserAlias(),
      createdAt: serverTimestamp()
    };
    
    // Guardar en la colección de tareas
    await addDoc(collection(db(), 'ec_tareas'), tarea);
    
    closeModal('modalNuevaTarea');
    
    // Limpiamos los campos después de guardar
    ['tareaTitulo', 'tareaDesc', 'tareaResponsable', 'tareaFecha', 'tareaHora', 'tareaMateria'].forEach(id => $(id).value = '');
    $('subtareasList').innerHTML = ''; 
    
  } catch (e) { showToast(friendlyError(e), 'error'); }
  finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

