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

    // En lugar de limpiar TODO el contenedor, solo ponemos el loading en la parte de la lista
    // Si la vista es calendario, mantenemos la estructura.
    if (!tareasVistaCalendario) {
        $('tareasList').innerHTML = '<div class="feed-loading">Cargando tareas…</div>';
    }

    tareasUnsub = onSnapshot(q, snap => {
        const tareas = [];
        snap.forEach(d => tareas.push({ id: d.id, ...d.data() }));
        
        if (tareasVistaCalendario) {
            const hoy = new Date();
            const año = hoy.getFullYear() + Math.floor((hoy.getMonth() + calMesOffset) / 12);
            const mes = ((hoy.getMonth() + calMesOffset) % 12 + 12) % 12;
            renderCalMes(tareas, año, mes);
        } else {
            renderTareas(tareas);
        }
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
  const now = new Date();
  $('tareasList').innerHTML = filtradas.map(t => {
    const vence = t.fecha ? new Date(t.fecha) : null;
    const vencida = vence && vence < now && !t.done;
    return `<div class="tarea-card ${t.done ? 'done' : ''}">
      <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}',${!t.done})">${t.done ? '✓' : ''}</button>
      <div class="tarea-body">
        <div class="tarea-titulo">${escHtml(t.titulo)}</div>
        ${t.desc ? `<div class="tarea-desc">${escHtml(t.desc)}</div>` : ''}
        <div class="tarea-meta">
          ${t.responsable ? `<span class="tarea-badge badge-responsable">👤 ${escHtml(t.responsable)}</span>` : ''}
          ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
          ${vence ? `<span class="tarea-badge badge-fecha ${vencida ? 'vencida' : ''}">
            ${vencida ? '⚠️' : '📅'} ${vence.toLocaleDateString('es-MX')}
          </span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <button class="tarea-share-btn" title="Compartir en tablero" onclick="compartirTarea('${t.id}')">📌</button>
        <button class="tarea-delete" onclick="eliminarTarea('${t.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
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

    return `
    <div class="tarea-card ${t.done ? 'done' : ''}" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div style="display:flex; gap:12px; flex:1;">
                <button class="tarea-check ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}', ${!t.done})">
                    ${t.done ? '✓' : ''}
                </button>
                <div class="tarea-body">
                    <div class="tarea-titulo">${escHtml(t.titulo)}</div>
                    <div class="tarea-meta" style="margin-top:6px;">
                        ${t.materia ? `<span class="tarea-badge badge-materia">📖 ${escHtml(t.materia)}</span>` : ''}
                        ${t.responsable && (!t.subtareas || t.subtareas.length === 0) ? `<span class="tarea-badge badge-responsable" style="opacity:0.7;">👤 ${escHtml(t.responsable)}</span>` : ''}
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

