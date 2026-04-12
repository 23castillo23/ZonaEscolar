/* ═══════════════════════════════════════════════════
   DINÁMICAS — Ruleta, votación, trivia, puntos,
   lightbox, compartir al tablero.
   
   Dependencias: core.js, grupos.js, utils-extra.js
   Colecciones: ec_votaciones, ec_trivias
   
   REGLA: Votaciones y trivias NO se autopublican.
   Para compartir → botón 📌 → selector de tablero.
   Para eliminar definitivamente → botón 🗑️ aquí.
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════════════ */
window.openLightbox = function (idx) {
  lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('open');
};
window.openLightboxFeed = function (imgEl) {
  lightboxPhotos = [{ url: imgEl.src, caption: '' }];
  lightboxIdx = 0;
  updateLightbox();
  $('lightbox').classList.add('open');
};
function updateLightbox() {
  const p = lightboxPhotos[lightboxIdx];
  if (!p) return;
  $('lightboxImg').src = p.url || p;
  $('lightboxCaption').textContent = p.caption || '';
  $('lightboxPrev').style.opacity = lightboxIdx > 0 ? '1' : '0.3';
  $('lightboxNext').style.opacity = lightboxIdx < lightboxPhotos.length - 1 ? '1' : '0.3';
}
$('lightboxClose').addEventListener('click', () => $('lightbox').classList.remove('open'));
$('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) $('lightbox').classList.remove('open'); });
$('lightboxPrev').addEventListener('click', () => { if (lightboxIdx > 0) { lightboxIdx--; updateLightbox(); } });
$('lightboxNext').addEventListener('click', () => { if (lightboxIdx < lightboxPhotos.length - 1) { lightboxIdx++; updateLightbox(); } });
document.addEventListener('keydown', e => {
  if (!$('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') $('lightbox').classList.remove('open');
  if (e.key === 'ArrowLeft' && lightboxIdx > 0) { lightboxIdx--; updateLightbox(); }
  if (e.key === 'ArrowRight' && lightboxIdx < lightboxPhotos.length - 1) { lightboxIdx++; updateLightbox(); }
});

/* ═══════════════════════════════════════════════════
   DINÁMICAS
═══════════════════════════════════════════════════ */
function initDinamicas() {
  initRuleta();
  renderPuntos();
  // Votaciones y trivias se cargan al entrar a su vista inline
}

qsa('.btn-dinamica[data-open]').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.open));
});

/* ─────────────── RULETA ─────────────── */
function initRuleta() {
  if (currentGroupData?.miembros) {
    const nombres = currentGroupData.miembros.map(email => {
      const key = email.replace(/\./g, '_');
      return currentGroupData.miembroNombres?.[key] || email.split('@')[0];
    });
    ruletaMiembros = nombres;
    $('ruletaMiembros').value = nombres.join('\n');
  } else {
    ruletaMiembros = [currentUser.name];
    $('ruletaMiembros').value = currentUser.name;
  }
  dibujarRuleta();
}

$('btnRuletaActualizar').addEventListener('click', () => {
  ruletaMiembros = $('ruletaMiembros').value.split('\n').map(s => s.trim()).filter(Boolean);
  dibujarRuleta();
  $('ruletaResultado').textContent = '';
});

$('btnSpin').addEventListener('click', () => {
  if (ruletaSpinning || !ruletaMiembros.length) return;
  ruletaSpinning = true;
  $('ruletaResultado').textContent = '⏳';
  $('btnSpin').disabled = true;
  const extra = Math.floor(Math.random() * 3 + 5) * 360 + Math.floor(Math.random() * 360);
  const duration = 4000;
  const start = performance.now();
  const startAngle = ruletaAngulo;
  function step(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 4);
    ruletaAngulo = startAngle + extra * ease;
    dibujarRuleta();
    if (t < 1) { requestAnimationFrame(step); }
    else {
      ruletaSpinning = false;
      $('btnSpin').disabled = false;
      const n = ruletaMiembros.length;
      const segAngle = 360 / n;
      const normalized = (((-ruletaAngulo % 360) + 360) % 360);
      const idx = Math.floor(normalized / segAngle) % n;
      $('ruletaResultado').textContent = `🎯 ${ruletaMiembros[idx]}`;
    }
  }
  requestAnimationFrame(step);
});

function dibujarRuleta() {
  const canvas = $('ruletaCanvas');
  const ctx = canvas.getContext('2d');
  const cx = 150, cy = 150, r = 140;
  const n = ruletaMiembros.length || 1;
  const segAngle = (Math.PI * 2) / n;
  const colores = ['#7c6af7', '#a594f9', '#4f46e5', '#6366f1', '#818cf8', '#c4b5fd', '#8b5cf6', '#ddd6fe'];
  ctx.clearRect(0, 0, 300, 300);
  for (let i = 0; i < n; i++) {
    const start = (ruletaAngulo * Math.PI / 180) + i * segAngle - Math.PI / 2;
    const end = start + segAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = colores[i % colores.length];
    ctx.strokeStyle = '#0e0e16';
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    const midAngle = start + segAngle / 2;
    const tx = cx + (r * 0.65) * Math.cos(midAngle);
    const ty = cy + (r * 0.65) * Math.sin(midAngle);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    const nombre = ruletaMiembros[i] || '';
    ctx.fillText(nombre.length > 10 ? nombre.slice(0, 9) + '…' : nombre, 0, 0);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0e16';
  ctx.fill();
  ctx.strokeStyle = '#7c6af7';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ─────────────── VOTACIÓN — vista inline ─────────────── */

let votacionesUnsub = null;

/* Abre la vista inline de votaciones */
window.abrirVistaVotacion = function () {
  $('dinamicasHome').style.display = 'none';
  $('dinamicasVistaVotacion').style.display = 'block';
  $('dinamicasVistaTrivia').style.display = 'none';
  $('dinamicasJuegoTrivia').style.display = 'none';
  loadVotacionActiva();
};

window.cerrarVistaDinamica = function () {
  $('dinamicasHome').style.display = 'block';
  $('dinamicasVistaVotacion').style.display = 'none';
  $('dinamicasVistaTrivia').style.display = 'none';
  $('dinamicasJuegoTrivia').style.display = 'none';
  if (votacionesUnsub) { votacionesUnsub(); votacionesUnsub = null; }
  if (typeof triviasUnsub !== 'undefined' && triviasUnsub) { triviasUnsub(); triviasUnsub = null; }
};

window.abrirFormNuevaVotacion = function () {
  // Limpiar campos del modal
  const pregEl = $('votacionPregunta');
  if (pregEl) pregEl.value = '';
  const wrap = $('votacionOpcionesInputs');
  if (wrap) {
    [...wrap.querySelectorAll('.opcion-input')].slice(2).forEach(e => e.remove());
    wrap.querySelectorAll('.opcion-input').forEach(i => i.value = '');
  }
  const fechaEl = $('votacionFechaCierre');
  if (fechaEl) fechaEl.value = '';
  const horaEl = $('votacionHoraCierre');
  if (horaEl) horaEl.value = '';
  openModal('modalNuevaVotacion');
  _bindVotacionForm();
};
window.cerrarFormNuevaVotacion = function () {
  closeModal('modalNuevaVotacion');
};

/* Carga reactiva de TODAS las votaciones del grupo */
function loadVotacionActiva() {
  if (!currentGroupId) return;
  if (votacionesUnsub) { votacionesUnsub(); votacionesUnsub = null; }
  if (typeof votacionUnsub !== 'undefined' && votacionUnsub) { votacionUnsub(); votacionUnsub = null; }
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_votaciones'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc')
  );
  votacionesUnsub = onSnapshot(q, snap => {
    const todas = [];
    snap.forEach(d => todas.push({ id: d.id, ...d.data() }));
    _autoCerrarVencidas(todas);
    renderPanelVotaciones(todas);
  });
}

async function _autoCerrarVencidas(lista) {
  const ahora = new Date();
  const { doc, updateDoc, collection, query, where, getDocs } = lib();
  for (const v of lista) {
    if (v.activa && v.cierreAt) {
      const fechaCierre = new Date(v.cierreAt);
      if (!isNaN(fechaCierre) && fechaCierre <= ahora) {
        try {
          await updateDoc(doc(db(), 'ec_votaciones', v.id), { activa: false });
          const feedSnap = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', v.id)));
          if (!feedSnap.empty) await updateDoc(doc(db(), 'ec_feed', feedSnap.docs[0].id), { activa: false });
        } catch (_) {}
      }
    }
  }
}

function renderPanelVotaciones(lista) {
  // Vista inline
  const listaEl = $('votacionesListaInline');
  if (listaEl) {
    if (!lista.length) {
      listaEl.innerHTML = `<div class="din-empty-state">
        <div style="font-size:48px;margin-bottom:12px">🗳️</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">Aún no hay votaciones</div>
        <div style="font-size:13px;color:var(--text2)">Pulsa "➕ Nueva votación" para crear la primera</div>
      </div>`;
    } else {
      listaEl.innerHTML = lista.map(v => _renderTarjetaVotacion(v)).join('');
    }
  }
  // Modal fallback (compatibilidad con feed)
  const panel = $('votacionPanel');
  if (panel) {
    panel.innerHTML = lista.length
      ? lista.map(v => _renderTarjetaVotacion(v)).join('')
      : `<div style="text-align:center;padding:20px;font-size:13px;color:var(--text2)">Sin votaciones 🗳️</div>`;
  }
  _bindVotacionForm();
}

function _bindVotacionForm() {
  const btnAdd = $('btnAgregarOpcion');
  const btnLanzar = $('btnLanzarVotacion');
  if (btnAdd) {
    btnAdd.onclick = () => {
      const wrap = $('votacionOpcionesInputs');
      const n = wrap.querySelectorAll('.opcion-input').length + 1;
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'modal-input opcion-input';
      inp.placeholder = `Opción ${n}`; inp.style.marginBottom = '6px';
      wrap.appendChild(inp);
    };
  }
  if (btnLanzar) {
    btnLanzar.onclick = async () => {
      const pregunta = $('votacionPregunta')?.value.trim();
      const opciones = [...($('votacionOpcionesInputs')?.querySelectorAll('.opcion-input') || [])].map(i => i.value.trim()).filter(Boolean);
      if (!pregunta || opciones.length < 2) { showToast('Agrega una pregunta y al menos 2 opciones.', 'warning'); return; }
      const fechaCierreInput = $('votacionFechaCierre')?.value || '';
      const horaCierreInput = $('votacionHoraCierre')?.value || '';
      let cierreTimestamp = null;
      if (fechaCierreInput) {
        const hora = horaCierreInput || '23:59';
        const d = new Date(fechaCierreInput + 'T' + hora + ':00');
        if (!isNaN(d.getTime())) cierreTimestamp = d.toISOString();
      }
      btnLanzar.disabled = true; btnLanzar.textContent = '⏳';
      const { collection, addDoc, serverTimestamp } = lib();
      try {
        await addDoc(collection(db(), 'ec_votaciones'), {
          groupId: currentGroupId, pregunta, opciones,
          votos: {}, votantes: [], userVotes: {},
          activa: true, cierreAt: cierreTimestamp || null,
          authorUid: currentUser.uid, authorName: currentUser.name, authorAvatar: currentUser.avatar || '',
          createdAt: serverTimestamp()
        });
        $('votacionPregunta').value = '';
        if ($('votacionFechaCierre')) $('votacionFechaCierre').value = '';
        if ($('votacionHoraCierre')) $('votacionHoraCierre').value = '';
        const wrap = $('votacionOpcionesInputs');
        [...wrap.querySelectorAll('.opcion-input')].slice(2).forEach(e => e.remove());
        wrap.querySelectorAll('.opcion-input').forEach(i => i.value = '');
        cerrarFormNuevaVotacion();
        showToast('¡Votación creada! Usa 📌 Compartir para publicarla.', 'success');
      } catch (e) { showToast(friendlyError(e), 'error'); }
      finally { btnLanzar.disabled = false; btnLanzar.textContent = 'Crear votación'; }
    };
  }
}

function _renderTarjetaVotacion(v) {
  const esPropietario = v.authorUid === currentUser.uid;
  const puedeGestionar = isAdmin || esPropietario;
  const yaVoto = v.votantes?.includes(currentUser.uid);
  const miVoto = Number(v?.userVotes?.[currentUser.uid]);
  const totalVotos = Object.values(v.votos || {}).reduce((a, b) => a + b, 0);
  const activa = v.activa !== false;

  let tiempoHtml = '';
  if (v.cierreAt && activa) {
    const cierre = new Date(v.cierreAt);
    const diff = cierre - new Date();
    if (diff > 0) {
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
      const dias = Math.floor(h / 24), horasRest = h % 24;
      const t = dias > 0 ? `${dias}d ${horasRest}h restantes` : h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`;
      tiempoHtml = `<div style="font-size:11px;color:var(--accent);margin-bottom:8px">⏰ ${t} · Cierra ${cierre.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</div>`;
    }
  } else if (v.cierreAt && !activa) {
    const cierre = new Date(v.cierreAt);
    tiempoHtml = `<div style="font-size:11px;color:var(--text2);margin-bottom:8px">🔒 Cerró el ${cierre.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</div>`;
  }

  const opcionesHtml = activa
    ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">` +
      v.opciones.map((op, i) => {
        const selec = yaVoto && Number.isInteger(miVoto) && miVoto === i;
        return `<button class="votacion-opcion-btn${selec ? ' votacion-opcion-seleccionada' : ''}"
          onclick="votarEnPanel('${v.id}',${i})"
          style="text-align:left;padding:8px 12px;border-radius:8px;font-size:13px">
          ${escHtml(op)}${selec ? ' ✔' : ''}
        </button>`;
      }).join('') + `</div>` : '';

  const resultadosHtml = v.opciones.map((op, i) => {
    const cnt = v.votos?.[i] || 0;
    const pct = totalVotos ? Math.round(cnt / totalVotos * 100) : 0;
    const esMio = yaVoto && Number.isInteger(miVoto) && miVoto === i;
    return `<div class="votacion-resultado-item${esMio ? ' mi-voto' : ''}" style="margin-bottom:6px">
      <span class="votacion-bar-label">${escHtml(op)}${esMio ? ' <span style="font-size:10px;opacity:0.7">(tu voto)</span>' : ''}</span>
      <div class="votacion-bar-wrap"><div class="votacion-bar" style="width:${pct}%"></div></div>
      <span class="votacion-bar-count">${cnt} (${pct}%)</span>
    </div>`;
  }).join('');

  const estadoBadge = activa
    ? `<span style="font-size:10px;background:var(--green);color:#fff;padding:2px 7px;border-radius:10px;font-weight:700">ABIERTA</span>`
    : `<span style="font-size:10px;background:var(--text2);color:#fff;padding:2px 7px;border-radius:10px;font-weight:700">CERRADA</span>`;

  // Botones de gestión (solo para propietario/admin)
  let btnsCierre = '';
  if (puedeGestionar) {
    btnsCierre = activa
      ? `<button class="btn-sm btn-sm-danger" onclick="cerrarVotacionPanel('${v.id}')">🔒 Cerrar</button>
         <button class="btn-sm btn-sm-danger" onclick="eliminarVotacionPanel('${v.id}','${escHtml(v.pregunta)}')">🗑️ Eliminar</button>`
      : `<button class="btn-sm" onclick="reabrirVotacionPanel('${v.id}')">🔓 Reabrir</button>
         <button class="btn-sm btn-sm-danger" onclick="eliminarVotacionPanel('${v.id}','${escHtml(v.pregunta)}')">🗑️ Eliminar</button>`;
  }

  return `<div class="din-tarjeta-votacion">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
      <div style="font-size:13px;font-weight:700;color:var(--text0);flex:1">🗳️ ${escHtml(v.pregunta)}</div>
      ${estadoBadge}
    </div>
    ${tiempoHtml}
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px">Por ${escHtml(v.authorName || 'Anónimo')} · ${totalVotos} voto${totalVotos !== 1 ? 's' : ''}</div>
    ${opcionesHtml}${resultadosHtml}
    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;align-items:center">
      <button class="tarea-share-btn" onclick="compartirVotacion('${v.id}','${escHtml(v.pregunta)}')">📌 Compartir</button>
      ${btnsCierre}
    </div>
  </div>`;
}

window.votarEnPanel = async function (votacionId, opcionIdx) {
  const { doc, getDoc, updateDoc, arrayUnion, increment, collection, query, where, getDocs } = lib();
  try {
    const vSnap = await getDoc(doc(db(), 'ec_votaciones', votacionId));
    if (!vSnap.exists()) return;
    const vData = vSnap.data();
    if (!vData.activa) { showToast('Esta votación ya cerró.', 'info'); return; }
    const votoAnterior = Number(vData?.userVotes?.[currentUser.uid]);
    if (Number.isInteger(votoAnterior) && votoAnterior === opcionIdx) return;
    const patch = { votantes: arrayUnion(currentUser.uid), [`userVotes.${currentUser.uid}`]: opcionIdx };
    if (Number.isInteger(votoAnterior)) patch[`votos.${votoAnterior}`] = increment(-1);
    patch[`votos.${opcionIdx}`] = increment(1);
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), patch);
    const feedSnap = await getDocs(query(collection(db(), 'ec_feed'), where('votacionId', '==', votacionId)));
    if (!feedSnap.empty) await updateDoc(doc(db(), 'ec_feed', feedSnap.docs[0].id), patch);
  } catch (e) { showToast('No se pudo registrar tu voto. ' + friendlyError(e), 'error'); }
};
window.cerrarVotacionPanel = function (vid) {
  showConfirm({ title:'Cerrar votación', message:'¿Cerrar esta votación?', confirmText:'Cerrar', onConfirm: async () => {
    const { doc, updateDoc, collection, query, where, getDocs } = lib();
    try {
      await updateDoc(doc(db(),'ec_votaciones',vid),{activa:false});
      const fs = await getDocs(query(collection(db(),'ec_feed'),where('votacionId','==',vid)));
      if(!fs.empty) await updateDoc(doc(db(),'ec_feed',fs.docs[0].id),{activa:false});
      showToast('Votación cerrada.','success');
    } catch(e){showToast(friendlyError(e),'error');}
  }});
};
window.reabrirVotacionPanel = function (vid) {
  showConfirm({ title:'Reabrir votación', message:'¿Reabrir esta votación?', confirmText:'Reabrir', onConfirm: async () => {
    const { doc, updateDoc, collection, query, where, getDocs } = lib();
    try {
      await updateDoc(doc(db(),'ec_votaciones',vid),{activa:true});
      const fs = await getDocs(query(collection(db(),'ec_feed'),where('votacionId','==',vid)));
      if(!fs.empty) await updateDoc(doc(db(),'ec_feed',fs.docs[0].id),{activa:true});
      showToast('¡Votación reabierta!','success');
    } catch(e){showToast(friendlyError(e),'error');}
  }});
};
window.eliminarVotacionPanel = function (vid, pregunta) {
  showConfirm({ title:'Eliminar votación', message:`¿Eliminar "${pregunta}"?`, confirmText:'Eliminar', danger:true, onConfirm: async () => {
    const { doc, deleteDoc, collection, query, where, getDocs } = lib();
    try {
      await deleteDoc(doc(db(),'ec_votaciones',vid));
      const fs = await getDocs(query(collection(db(),'ec_feed'),where('votacionId','==',vid)));
      for(const d of fs.docs) await deleteDoc(doc(db(),'ec_feed',d.id));
      showToast('Votación eliminada.','success');
    } catch(e){showToast(friendlyError(e),'error');}
  }});
};
window.votar = async function (votacionId, opcionIdx) { await window.votarEnPanel(votacionId, opcionIdx); };

window.votarDesdeFeed = async function (votacionId, opcionIdx, feedPostId) {
  const { doc, getDoc, updateDoc, increment, arrayUnion } = lib();
  try {
    // 1. Leer estado actual
    const snap = await getDoc(doc(db(), 'ec_votaciones', votacionId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.activa) { showToast('Esta votación ya cerró.', 'info'); return; }

    const votoAnterior = Number(data?.userVotes?.[currentUser.uid]);
    if (Number.isInteger(votoAnterior) && votoAnterior === opcionIdx) return; // mismo voto, no hacer nada

    // 2. Calcular nuevo estado local para actualización optimista
    const nuevosVotos = Object.assign({}, data.votos || {});
    nuevosVotos[opcionIdx] = (nuevosVotos[opcionIdx] || 0) + 1;
    if (Number.isInteger(votoAnterior)) {
      nuevosVotos[votoAnterior] = Math.max(0, (nuevosVotos[votoAnterior] || 1) - 1);
    }
    const nuevosVotantes = [...(data.votantes || [])];
    if (!nuevosVotantes.includes(currentUser.uid)) nuevosVotantes.push(currentUser.uid);
    const nuevosUserVotes = Object.assign({}, data.userVotes || {});
    nuevosUserVotes[currentUser.uid] = opcionIdx;

    // 3. Actualizar DOM del card inmediatamente (sin esperar a Firestore)
    _actualizarCardVotacionDOM(feedPostId, {
      opciones: data.opciones,
      votos: nuevosVotos,
      votantes: nuevosVotantes,
      userVotes: nuevosUserVotes,
      activa: true,
      votacionId,
      pregunta: data.pregunta,
      authorUid: data.authorUid
    });

    // 4. También actualizar el cache local del feed
    if (window._feedPostsCache) {
      window._feedPostsCache = window._feedPostsCache.map(p => {
        if (p.id === feedPostId) {
          return { ...p, votos: nuevosVotos, votantes: nuevosVotantes, userVotes: nuevosUserVotes };
        }
        return p;
      });
    }

    // 5. Persistir en Firestore
    const patch = {
      [`votos.${opcionIdx}`]: increment(1),
      votantes: arrayUnion(currentUser.uid),
      [`userVotes.${currentUser.uid}`]: opcionIdx
    };
    if (Number.isInteger(votoAnterior)) patch[`votos.${votoAnterior}`] = increment(-1);
    await updateDoc(doc(db(), 'ec_votaciones', votacionId), patch);
    if (feedPostId) await updateDoc(doc(db(), 'ec_feed', feedPostId), patch);

  } catch (e) { showToast(friendlyError(e), 'error'); }
};

/* Actualiza el DOM del card de votación en el feed sin re-renderizar todo */
function _actualizarCardVotacionDOM(feedPostId, v) {
  const contenedor = document.getElementById('fv-' + feedPostId);
  if (!contenedor) return;

  const yaVoto = v.votantes?.includes(currentUser.uid);
  const miVoto = Number(v.userVotes?.[currentUser.uid]);
  const totalVotos = Object.values(v.votos || {}).reduce((a, b) => a + b, 0);

  // Botones de opciones
  const botonesHtml = (v.opciones || []).map((op, i) => {
    const selec = yaVoto && Number.isInteger(miVoto) && miVoto === i;
    return `<button class="feed-votacion-opcion${selec ? ' votacion-opcion-seleccionada' : ''}"
      onclick="votarDesdeFeed('${v.votacionId}',${i},'${feedPostId}')">
      ${escHtml(op)}${selec ? ' ✔' : ''}
    </button>`;
  }).join('');

  // Barras de resultados
  const resultadosHtml = (v.opciones || []).map((op, i) => {
    const cnt = v.votos?.[i] || 0;
    const pct = totalVotos ? Math.round(cnt / totalVotos * 100) : 0;
    const isMine = yaVoto && Number.isInteger(miVoto) && miVoto === i;
    return `<div class="feed-votacion-resultado-bar${isMine ? ' mi-voto' : ''}">
      <div class="feed-votacion-bar-fill" style="width:${pct}%"></div>
      <div class="feed-votacion-bar-text">
        <span>${escHtml(op)}${isMine ? ' ✔' : ''}</span>
        <span>${cnt} voto${cnt !== 1 ? 's' : ''} (${pct}%)</span>
      </div>
    </div>`;
  }).join('');

  contenedor.innerHTML = `
    <div class="feed-votacion-opciones-cta">${botonesHtml}</div>
    <div style="font-size:12px;color:var(--text2);margin:8px 0 6px;">
      ${yaVoto ? 'Puedes cambiar tu voto mientras esté abierta.' : 'Elige una opción para votar.'}
    </div>
    ${resultadosHtml}
    <div style="text-align:center;font-size:12px;color:var(--text2);margin-top:8px;">${totalVotos} votos en total</div>`;
}

window.irADinamicas = function () {
  currentSection = 'dinamicas';
  setActiveNav('dinamicas');
  activarSeccion('dinamicas');
  closeSidebar();
};

/* ─────────────── TRIVIA — vista inline con Firestore ─────────────── */

let triviasUnsub = null;
let _triviaJugandoData = null; // trivia actualmente jugando

window.abrirVistaTrivia = function () {
  $('dinamicasHome').style.display = 'none';
  $('dinamicasVistaTrivia').style.display = 'block';
  $('dinamicasVistaVotacion').style.display = 'none';
  $('dinamicasJuegoTrivia').style.display = 'none';
  loadTriviasGuardadas();
};


function loadTriviasGuardadas() {
  if (!currentGroupId) return;
  if (triviasUnsub) { triviasUnsub(); triviasUnsub = null; }
  const { collection, query, where, orderBy, onSnapshot } = lib();
  const q = query(
    collection(db(), 'ec_trivias'),
    where('groupId', '==', currentGroupId),
    orderBy('createdAt', 'desc')
  );
  const listaEl = $('triviasListaInline');
  if (listaEl) listaEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:13px">Cargando…</div>';
  triviasUnsub = onSnapshot(q, snap => {
    const trivias = [];
    snap.forEach(d => trivias.push({ id: d.id, ...d.data() }));
    renderTriviasLista(trivias);
  }, err => {
    console.error('loadTriviasGuardadas:', err);
    if (listaEl) listaEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">Error al cargar trivias.</div>';
  });
}

function renderTriviasLista(trivias) {
  const listaEl = $('triviasListaInline');
  if (!listaEl) return;
  if (!trivias.length) {
    listaEl.innerHTML = `<div class="din-empty-state">
      <div style="font-size:48px;margin-bottom:12px">🧠</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">Aún no hay trivias guardadas</div>
      <div style="font-size:13px;color:var(--text2)">Pulsa "➕ Nueva trivia" para crear la primera</div>
    </div>`;
    return;
  }
  listaEl.innerHTML = trivias.map(t => {
    const esPropietario = t.authorUid === currentUser.uid;
    const puedeEliminar = isAdmin || esPropietario;
    const totalPregs = t.preguntas?.length || 0;
    const delBtn = puedeEliminar
      ? `<button class="btn-sm btn-sm-danger" onclick="eliminarTriviaGuardada('${t.id}','${escHtml(t.nombre)}')">🗑️ Eliminar</button>`
      : '';
    return `<div class="din-tarjeta-trivia">
      <div class="din-trivia-card-header">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text0)">🧠 ${escHtml(t.nombre)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">${totalPregs} pregunta${totalPregs !== 1 ? 's' : ''} · Por ${escHtml(t.authorName || 'Anónimo')}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <button class="btn-primary" style="flex:1;font-size:13px" onclick="jugarTrivia('${t.id}')">▶️ Jugar</button>
        <button class="tarea-share-btn" onclick="compartirTrivia('${t.id}','${escHtml(t.nombre)}')">📌 Compartir</button>
        ${delBtn}
      </div>
    </div>`;
  }).join('');
}

window.jugarTrivia = function (triviaId) {
  const { doc, getDoc } = lib();
  getDoc(doc(db(), 'ec_trivias', triviaId)).then(snap => {
    if (!snap.exists()) { showToast('No se encontró la trivia.', 'error'); return; }
    _triviaJugandoData = { id: snap.id, ...snap.data() };
    triviaBanco = _triviaJugandoData.preguntas || [];
    triviaIdx = 0; triviaScore = 0;
    $('dinamicasVistaTrivia').style.display = 'none';
    $('dinamicasJuegoTrivia').style.display = 'block';
    if ($('triviaJuegoTitulo')) $('triviaJuegoTitulo').textContent = `🧠 ${_triviaJugandoData.nombre}`;
    mostrarPreguntaTrivia();
  }).catch(e => showToast('Error al cargar trivia.', 'error'));
};

window.volverAListaTrivias = function () {
  $('dinamicasJuegoTrivia').style.display = 'none';
  $('dinamicasVistaTrivia').style.display = 'block';
  _triviaJugandoData = null;
};

window.eliminarTriviaGuardada = function (id, nombre) {
  showConfirm({
    title: 'Eliminar trivia',
    message: `¿Eliminar la trivia "${nombre}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar', danger: true,
    onConfirm: async () => {
      const { doc, deleteDoc } = lib();
      try { await deleteDoc(doc(db(), 'ec_trivias', id)); showToast('Trivia eliminada.', 'success'); }
      catch (e) { showToast(friendlyError(e), 'error'); }
    }
  });
};

/* — Modal nueva trivia: banco local independiente — */
let _triviaBancoModal = [];

window.abrirFormNuevaTrivia = function () {
  _triviaBancoModal = [];
  _renderBancoModal();
  const n = $('mt_nombre'); if (n) n.value = '';
  const p = $('mt_pregunta'); if (p) p.value = '';
  const wrap = $('mt_respuestasWrap');
  if (wrap) {
    wrap.innerHTML = `
      <div class="mt-resp-row" style="display:flex;gap:6px;align-items:center">
        <span style="font-size:13px;width:20px;text-align:center;flex-shrink:0">✅</span>
        <input type="text" class="modal-input mt-resp-input" placeholder="Respuesta correcta" style="flex:1">
      </div>
      <div class="mt-resp-row" style="display:flex;gap:6px;align-items:center">
        <span style="font-size:13px;width:20px;text-align:center;flex-shrink:0">❌</span>
        <input type="text" class="modal-input mt-resp-input" placeholder="Opción incorrecta" style="flex:1">
      </div>
      <div class="mt-resp-row" style="display:flex;gap:6px;align-items:center">
        <span style="font-size:13px;width:20px;text-align:center;flex-shrink:0">❌</span>
        <input type="text" class="modal-input mt-resp-input" placeholder="Opción incorrecta" style="flex:1">
      </div>`;
  }
  openModal('modalNuevaTrivia');
};

window.cerrarFormNuevaTrivia = function () { closeModal('modalNuevaTrivia'); };

function _renderBancoModal() {
  const el = $('mt_banco');
  if (!el) return;
  if (!_triviaBancoModal.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text2);padding:4px 0">Aún no hay preguntas. Agrégalas arriba.</p>';
    return;
  }
  el.innerHTML = `<p style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:600">${_triviaBancoModal.length} pregunta(s) lista(s):</p>` +
    _triviaBancoModal.map((p, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:8px 12px;margin-bottom:6px;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text0)">${escHtml(p.pregunta)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${p.respuestas.length} opciones · ✅ ${escHtml(p.respuestas[0])}</div>
        </div>
        <button onclick="_triviaBancoModal.splice(${i},1);_renderBancoModal()"
          style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;flex-shrink:0">🗑️</button>
      </div>`).join('');
}

document.addEventListener('click', e => {
  // Agregar fila de respuesta extra
  if (e.target.id === 'mt_btnAddResp') {
    const wrap = $('mt_respuestasWrap');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'mt-resp-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center';
    row.innerHTML = `
      <span style="font-size:13px;width:20px;text-align:center;flex-shrink:0">❌</span>
      <input type="text" class="modal-input mt-resp-input" placeholder="Opción incorrecta" style="flex:1">
      <button type="button" onclick="this.parentElement.remove()"
        style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:0 4px;flex-shrink:0">✕</button>`;
    wrap.appendChild(row);
    row.querySelector('input').focus();
  }

  // Guardar pregunta al banco local del modal
  if (e.target.id === 'mt_btnGuardarPregunta') {
    const pregunta = ($('mt_pregunta')?.value || '').trim();
    const resps = [...document.querySelectorAll('#mt_respuestasWrap .mt-resp-input')]
      .map(i => i.value.trim()).filter(Boolean);
    if (!pregunta) { showToast('Escribe la pregunta.', 'warning'); return; }
    if (resps.length < 2) { showToast('Agrega al menos la respuesta correcta y una opción incorrecta.', 'warning'); return; }
    // Deduplicar: eliminar respuestas repetidas (case-insensitive) antes de guardar
    const seen = new Set();
    const respsSinDuplicados = resps.filter(r => {
      const key = r.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (respsSinDuplicados.length < 2) { showToast('Las opciones no pueden ser iguales.', 'warning'); return; }
    _triviaBancoModal.push({ pregunta, respuestas: respsSinDuplicados });
    $('mt_pregunta').value = '';
    document.querySelectorAll('#mt_respuestasWrap .mt-resp-input').forEach(i => i.value = '');
    _renderBancoModal();
    showToast('Pregunta guardada ✓', 'success');
  }

  // Guardar trivia completa
  if (e.target.id === 'mt_btnGuardarTrivia') {
    _guardarTriviaEnFirestore();
  }
});

async function _guardarTriviaEnFirestore() {
  if (!_triviaBancoModal.length) { showToast('Agrega al menos una pregunta antes de guardar.', 'warning'); return; }
  const nombre = ($('mt_nombre')?.value || '').trim() || `Trivia ${new Date().toLocaleDateString('es-MX')}`;
  const btn = $('mt_btnGuardarTrivia');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  try {
    const { collection, addDoc, serverTimestamp } = lib();
    await addDoc(collection(db(), 'ec_trivias'), {
      groupId: currentGroupId,
      nombre,
      preguntas: _triviaBancoModal,
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp()
    });
    _triviaBancoModal = [];
    cerrarFormNuevaTrivia();
    showToast(`¡Trivia "${nombre}" guardada! Usa 📌 Compartir para publicarla.`, 'success');
  } catch (e) { showToast(friendlyError(e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar trivia'; } }
}

// Estado interno del juego — nunca se expone en el HTML
let _triviaCorrectaActual = '';
let _triviaOpcionesActuales = [];

function mostrarPreguntaTrivia() {
  if (triviaIdx >= triviaBanco.length) {
    $('triviaJuego').innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:40px;margin-bottom:12px">🏆</div>
      <h3 style="font-family:var(--font-display);font-size:22px;margin-bottom:8px">¡Trivia terminada!</h3>
      <p style="color:var(--text1)">Puntuación: <strong>${triviaScore} / ${triviaBanco.length}</strong></p>
      <button class="btn-primary" style="margin-top:20px" onclick="volverAListaTrivias()">← Volver a trivias</button>
    </div>`;
    return;
  }
  const p = triviaBanco[triviaIdx];

  // Deduplicar por si los datos en Firestore ya tienen duplicados (compatibilidad con trivias antiguas)
  const seen = new Set();
  const unicas = (p.respuestas || []).filter(r => {
    const k = (r || '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // Fisher-Yates shuffle — mezcla uniforme
  const opciones = [...unicas];
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
  }

  // Guardar en variables de módulo — la respuesta correcta NO aparece en el HTML
  _triviaCorrectaActual   = p.respuestas[0];
  _triviaOpcionesActuales = opciones;

  $('triviaProgreso').textContent = `Pregunta ${triviaIdx + 1} de ${triviaBanco.length} · Puntos: ${triviaScore}`;
  $('triviaPreguntaText').textContent = p.pregunta;
  $('triviaFeedback').textContent = '';

  // Solo índice numérico en onclick — nada de texto de respuesta en el DOM
  $('triviaOpciones').innerHTML = opciones.map((op, i) =>
    `<button class="trivia-opcion" data-idx="${i}" onclick="responderTrivia(${i},this)">
      ${escHtml(op)}
    </button>`).join('');
}

window.responderTrivia = function (idx, btn) {
  const elegida = _triviaOpcionesActuales[idx];
  const correcta = _triviaCorrectaActual;
  qsa('.trivia-opcion').forEach(b => { b.disabled = true; });
  const correcto = elegida === correcta;
  if (correcto) {
    btn.classList.add('correcto'); triviaScore++;
    $('triviaFeedback').textContent = '✅ ¡Correcto!';
    $('triviaFeedback').style.color = 'var(--green)';
  } else {
    btn.classList.add('incorrecto');
    qsa('.trivia-opcion').forEach(b => {
      if (_triviaOpcionesActuales[parseInt(b.dataset.idx)] === correcta) b.classList.add('correcto');
    });
    $('triviaFeedback').textContent = `❌ Era: ${correcta}`;
    $('triviaFeedback').style.color = 'var(--red)';
  }
  setTimeout(() => { triviaIdx++; mostrarPreguntaTrivia(); }, 1800);
};
window.reiniciarTrivia = function () { volverAListaTrivias(); };

/* ─────────────── COMPARTIR EN TABLERO ─────────────── */

window.compartirVotacion = async function (votacionId, pregunta) {
  if (!currentGroupId) return;
  const { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } = lib();

  // Ver en qué tableros ya está compartida
  const existSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    where('type', '==', 'votacion'),
    where('votacionId', '==', votacionId)
  )).catch(() => null);

  const yaEn = new Set();
  existSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    `¿En qué tablero compartir la votación "${pregunta}"?`,
    async (tableroId, tableroNombre) => {
      try {
        // Si ya existe en ese tablero, la sube al inicio
        const enEste = existSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
          showToast(`📌 ¡Votación subida al inicio de "${tableroNombre}"!`, 'success');
          return;
        }
        // Si no existe, obtiene datos actuales y publica
        const { getDoc } = lib();
        const vSnap = await getDoc(doc(db(), 'ec_votaciones', votacionId));
        if (!vSnap.exists()) { showToast('No se encontró la votación.', 'error'); return; }
        const vData = vSnap.data();
        await addDoc(collection(db(), 'ec_feed'), {
          groupId: currentGroupId,
          tableroId: tableroId || '',
          type: 'votacion',
          votacionId: votacionId,
          pregunta: vData.pregunta,
          opciones: vData.opciones,
          votos: vData.votos || {},
          votantes: vData.votantes || [],
          userVotes: vData.userVotes || {},
          activa: vData.activa !== false,
          cierreAt: vData.cierreAt || null,
          text: `🗳️ Votación: "${vData.pregunta}"`,
          images: [],
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar || '',
          likes: 0, likedBy: [], commentCount: 0,
          createdAt: serverTimestamp()
        });
        showToast(`📌 ¡Votación compartida en "${tableroNombre}"!`, 'success');
      } catch (e) { showToast('No se pudo compartir. ' + friendlyError(e), 'error'); }
    },
    yaEn
  );
};

window.compartirTrivia = async function (triviaId, nombre) {
  if (!currentGroupId) return;
  const { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp } = lib();

  // Ver en qué tableros ya está compartida
  const existSnap = await getDocs(query(
    collection(db(), 'ec_feed'),
    where('groupId', '==', currentGroupId),
    where('type', '==', 'trivia_compartida'),
    where('triviaId', '==', triviaId)
  )).catch(() => null);

  const yaEn = new Set();
  existSnap?.forEach(d => yaEn.add(d.data().tableroId ?? ''));

  mostrarSelectorTablero(
    `¿En qué tablero compartir la trivia "${nombre}"?`,
    async (tableroId, tableroNombre) => {
      try {
        // Si ya existe en ese tablero, la sube al inicio
        const enEste = existSnap?.docs.find(d => (d.data().tableroId ?? '') === (tableroId || ''));
        if (enEste) {
          await updateDoc(doc(db(), 'ec_feed', enEste.id), { createdAt: serverTimestamp() });
          showToast(`📌 ¡Trivia subida al inicio de "${tableroNombre}"!`, 'success');
          return;
        }
        const tSnap = await getDoc(doc(db(), 'ec_trivias', triviaId));
        if (!tSnap.exists()) { showToast('No se encontró la trivia.', 'error'); return; }
        const tData = tSnap.data();
        await addDoc(collection(db(), 'ec_feed'), {
          groupId: currentGroupId,
          tableroId: tableroId || '',
          type: 'trivia_compartida',
          triviaId: triviaId,
          text: `🧠 Trivia: "${tData.nombre}" · ${tData.preguntas?.length || 0} preguntas — Ve a Dinámicas → Trivia para jugar.`,
          images: [],
          authorUid: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar || '',
          likes: 0, likedBy: [], commentCount: 0,
          createdAt: serverTimestamp()
        });
        showToast(`📌 ¡Trivia compartida en "${tableroNombre}"!`, 'success');
      } catch (e) { showToast('No se pudo compartir. ' + friendlyError(e), 'error'); }
    },
    yaEn
  );
};

/* ─────────────── PUNTOS ─────────────── */
function renderPuntos() {
  const marc = $('puntosMarcador');
  if (!puntosMarcador.length) {
    marc.innerHTML = '<div class="feed-loading" style="padding:20px 0">Agrega jugadores abajo.</div>';
    return;
  }
  const sorted = [...puntosMarcador].sort((a, b) => b.pts - a.pts);
  marc.innerHTML = sorted.map((j, i) => `
    <div class="puntos-jugador">
      <span style="font-size:16px;opacity:0.6">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
      <span class="puntos-jugador-nombre">${escHtml(j.nombre)}</span>
      <div class="puntos-btns">
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}',-1)">−</button>
        <span class="puntos-num">${j.pts}</span>
        <button class="puntos-btn" onclick="cambiarPuntos('${escHtml(j.nombre)}',1)">+</button>
      </div>
    </div>`).join('');
}
$('btnAgregarJugador').addEventListener('click', () => {
  const nombre = $('puntosNombre').value.trim();
  if (!nombre) return;
  if (!puntosMarcador.find(j => j.nombre === nombre)) { puntosMarcador.push({ nombre, pts: 0 }); renderPuntos(); }
  $('puntosNombre').value = '';
});
$('btnResetPuntos').addEventListener('click', () => {
  showConfirm({
    title: 'Reiniciar puntos',
    message: '¿Reiniciar los puntos de todos los participantes a cero?',
    confirmText: 'Reiniciar',
    onConfirm: () => { puntosMarcador.forEach(j => j.pts = 0); renderPuntos(); }
  });
});
window.cambiarPuntos = function (nombre, delta) {
  const j = puntosMarcador.find(j => j.nombre === nombre);
  if (j) { j.pts = Math.max(0, j.pts + delta); renderPuntos(); }
};

/* ═══════════════════════════════════════════════════
   MODALES — utilidades
═══════════════════════════════════════════════════ */
// ── Helpers para bloquear/restaurar scroll (fix iOS Safari) ──────────────────
function _lockBodyScroll() {
  if (document.body.dataset.scrollLocked) return; // ya bloqueado
  const scrollY = window.scrollY;
  document.body.dataset.scrollY = scrollY;
  document.body.dataset.scrollLocked = '1';
  document.body.style.cssText = `overflow:hidden; position:fixed; top:-${scrollY}px; left:0; right:0;`;
}
function _unlockBodyScroll() {
  if (!document.body.dataset.scrollLocked) return;
  const scrollY = parseInt(document.body.dataset.scrollY || '0');
  delete document.body.dataset.scrollLocked;
  document.body.style.cssText = '';
  window.scrollTo(0, scrollY);
}

function openModal(id) {
  $(id)?.classList.add('open');
  _lockBodyScroll();
}

function closeModal(id) {
  $(id)?.classList.remove('open');
  if (id === 'modalDetalleDvd' && dvdDetalleUnsub) {
    dvdDetalleUnsub();
    dvdDetalleUnsub = null;
  }
  // Solo desbloquear si no queda ningún modal abierto
  if (!document.querySelector('.modal-overlay.open, .comments-modal-overlay.active')) {
    _unlockBodyScroll();
  }
}

document.addEventListener('click', e => {
  const closeBtn = e.target.closest('.modal-close[data-close]');
  if (closeBtn) closeModal(closeBtn.dataset.close);
  const cancelBtn = e.target.closest('.btn-cancel[data-close]');
  if (cancelBtn) closeModal(cancelBtn.dataset.close);
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open, .comments-modal-overlay.active')) {
      _unlockBodyScroll();
    }
  }
});


/* ═══════════════════════════════════════════════════
   EDITAR PERFIL (AVATAR + NOMBRE)
═══════════════════════════════════════════════════ */
const EMOJIS_AVATAR = ['😊', '🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🦄', '🐺', '🎭',
  '🚀', '⭐', '🔥', '💎', '🌙', '🎯', '🏆', '🌈', '🎪', '🎨',
  '👾', '🤖', '👽', '🎃', '💀', '🦋', '🌸', '🌺', '🍀', '🌊'];

let _avatarPendiente = null; // {type:'url'|'emoji'|'initial', value: string}

$('btnEditarAvatar')?.addEventListener('click', () => abrirModalPerfil());
// También al hacer clic en el nombre del muro propio
$('muroNombre')?.addEventListener('click', () => {
  if (!muroViendoUid) abrirModalPerfil();
});

function abrirModalPerfil() {
  _avatarPendiente = null;

  // Prellenar nombre actual
  const inputNombre = $('editPerfilNombre');
  if (inputNombre) inputNombre.value = currentUser.name || '';

  // Mostrar foto de Google si la tiene (photoURL original de Firebase Auth)
  const googlePhotoEl = $('avatarPreviewGoogle');
  const googleOpcion = $('avatarOpcionGoogle');
  const googlePhoto = window._auth?.currentUser?.photoURL || '';
  if (googlePhotoEl && googleOpcion) {
    if (googlePhoto) {
      googlePhotoEl.src = googlePhoto;
      googleOpcion.style.display = 'block';
    } else {
      googleOpcion.style.display = 'none';
    }
  }

  // Grid de emojis
  const grid = $('avatarEmojiGrid');
  if (grid) {
    grid.innerHTML = EMOJIS_AVATAR.map(em =>
      `<button class="avatar-emoji-opt ${currentUser.avatar === em ? 'selected' : ''}" data-em="${em}">${em}</button>`
    ).join('');
    grid.querySelectorAll('.avatar-emoji-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _avatarPendiente = { type: 'emoji', value: btn.dataset.em };
        mostrarPreviewAvatar(btn.dataset.em, false);
        $('avatarFileNombre').textContent = 'Sin archivo';
      });
    });
  }

  // Reset file input
  const fileInput = $('avatarFileInput');
  if (fileInput) fileInput.value = '';
  $('avatarFileNombre').textContent = 'Sin archivo';
  $('avatarPreviewWrap').style.display = 'none';

  openModal('modalEditarAvatar');
}

// Usar foto de Google
$('btnUsarFotoGoogle')?.addEventListener('click', () => {
  const url = window._auth?.currentUser?.photoURL || '';
  if (!url) return;
  _avatarPendiente = { type: 'url', value: url };
  mostrarPreviewAvatar(url, true);
  const grid = $('avatarEmojiGrid');
  if (grid) grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
});

// Seleccionar archivo
$('avatarFileInput')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  $('avatarFileNombre').textContent = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    _avatarPendiente = { type: 'file', value: file };
    mostrarPreviewAvatar(ev.target.result, true);
    const grid = $('avatarEmojiGrid');
    if (grid) grid.querySelectorAll('.avatar-emoji-opt').forEach(b => b.classList.remove('selected'));
  };
  reader.readAsDataURL(file);
});

function mostrarPreviewAvatar(valor, esImagen) {
  const wrap = $('avatarPreviewWrap');
  const prev = $('avatarModalPreview');
  if (!wrap || !prev) return;
  wrap.style.display = 'block';
  if (esImagen) {
    prev.style.backgroundImage = `url(${valor})`;
    prev.style.backgroundSize = 'cover';
    prev.style.backgroundPosition = 'center';
    prev.textContent = '';
  } else {
    prev.style.backgroundImage = '';
    prev.textContent = valor;
  }
}

// Guardar perfil
$('btnGuardarAvatar')?.addEventListener('click', async () => {
  const inputNombre = $('editPerfilNombre');
  const nuevoNombre = inputNombre ? inputNombre.value.trim() : '';

  const btn = $('btnGuardarAvatar');
  btn.disabled = true; btn.textContent = '⏳';

  let nuevoAvatar = currentUser.avatar; // conservar el actual si no cambia

  if (_avatarPendiente) {
    if (_avatarPendiente.type === 'url') {
      nuevoAvatar = _avatarPendiente.value;
    } else if (_avatarPendiente.type === 'emoji') {
      nuevoAvatar = _avatarPendiente.value;
    } else if (_avatarPendiente.type === 'file') {
      const url = await uploadToCloudinary(_avatarPendiente.value);
      if (url) nuevoAvatar = url;
      else { showToast('Error al subir la imagen.', 'error'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    }
  }

  const nombre = nuevoNombre || currentUser.name;

  // Guardar en Firestore
  const { doc, setDoc } = lib();
  try {
    await setDoc(doc(db(), 'ec_users', currentUser.uid), {
      name: nombre,
      email: currentUser.email,
      avatar: nuevoAvatar,
      updatedAt: lib().serverTimestamp()
    }, { merge: true });

    // NUEVO: Guardar el ALIAS específico para este grupo
    if (currentGroupId) {
      const emailKey = currentUser.email.replace(/\./g, '_');
      const { updateDoc } = lib();
      await updateDoc(doc(db(), 'ec_grupos', currentGroupId), {
        [`miembroNombres.${emailKey}`]: nombre
      });
      if (!currentGroupData.miembroNombres) currentGroupData.miembroNombres = {};
      currentGroupData.miembroNombres[emailKey] = nombre;
    }

    currentUser.name = nombre;
    currentUser.avatar = nuevoAvatar;

    refreshAvatarUI();
    $('userName').textContent = getUserAlias();
    if ($('muroNombre') && !muroViendoUid) $('muroNombre').textContent = getUserAlias();

    closeModal('modalEditarAvatar');
    _avatarPendiente = null;
  } catch (e) { showToast('No se pudo guardar. ' + friendlyError(e), 'error'); }

  btn.disabled = false; btn.textContent = 'Guardar';
});

/* ═══════════════════════════════════════════════════
   EMOJI PICKER
═══════════════════════════════════════════════════ */
function renderEmojiPicker(containerId, emojis, selected, onChange) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = emojis.map(em =>
    `<span class="emoji-option ${em === selected ? 'selected' : ''}" data-em="${em}">${em}</span>`
  ).join('');
  container.querySelectorAll('.emoji-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      onChange(opt.dataset.em);
    });
  });
}

function updateSemestreSlider() {
  const p = selectedSemestrePalette;
  const t = selectedSemestreSlider / 100;
  // Interpola entre c1 (claro) y c2 (oscuro)
  function lerpHex(a, b, t) {
    const h = s => parseInt(s, 16);
    const r = Math.round(h(a.slice(1,3)) + (h(b.slice(1,3)) - h(a.slice(1,3))) * t);
    const g = Math.round(h(a.slice(3,5)) + (h(b.slice(3,5)) - h(a.slice(3,5))) * t);
    const bv= Math.round(h(a.slice(5,7)) + (h(b.slice(5,7)) - h(a.slice(5,7))) * t);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
  }
  const picked = lerpHex(p.c1, p.c2, t);
  selectedSemestreColor = picked;
  const prev = $('semestreColorPreview');
  if (prev) prev.style.background = `linear-gradient(90deg, ${p.c1}, ${p.c2})`;
  const slider = $('semestreColorSlider');
  if (slider) {
    slider.style.background = `linear-gradient(90deg, ${p.c1}, ${p.c2})`;
    slider.style.setProperty('--thumb-color', picked);
  }
}

/* ═══════════════════════════════════════════════════
   COLOR PICKER (para semestres pastel)
═══════════════════════════════════════════════════ */
function renderColorPicker(containerId, onChange) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = SEM_PASTEL_PALETTE.map((p, i) =>
    `<button class="color-swatch ${i === 0 ? 'selected' : ''}" 
      data-c1="${p.c1}" data-c2="${p.c2}" data-txt="${p.text}"
      style="background:linear-gradient(135deg,${p.c1},${p.c2})"
      title="${p.label}"></button>`
  ).join('');
  container.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const palette = SEM_PASTEL_PALETTE.find(p => p.c1 === btn.dataset.c1) || SEM_PASTEL_PALETTE[0];
      onChange(btn.dataset.c1, palette);
      const preview = $(containerId.replace('ColorPicker', 'ColorPreview'));
      if (preview) preview.style.background = `linear-gradient(135deg,${btn.dataset.c1},${btn.dataset.c2})`;
    });
  });
}

/* ── Notas de materia — comentarios por usuario ── */
let notasUnsub = null;

window.abrirNotas = function (galeriaId) {
  const gal = galerias.find(g => g.id === galeriaId);
  if (!gal) return;
  $('notasGaleriaTitulo').textContent = `${gal.icon || '📚'} ${gal.name}`;
  $('notasGaleriaTexto').value = '';
  $('modalNotasGaleria').dataset.galeriaId = galeriaId;
  openModal('modalNotasGaleria');
  cargarNotas(galeriaId);
};

function cargarNotas(galeriaId) {
  if (notasUnsub) { notasUnsub(); notasUnsub = null; }
  // Sin orderBy para evitar requerir índice compuesto — ordenamos en memoria
  const { collection, query, where, onSnapshot } = lib();
  const lista = $('notasLista');
  const q = query(
    collection(db(), 'ec_notas'),
    where('galeriaId', '==', galeriaId)
  );
  notasUnsub = onSnapshot(q, { includeMetadataChanges: false }, snap => {
    const notas = [];
    snap.forEach(d => notas.push({ id: d.id, ...d.data() }));
    // Ordenar en memoria por fecha ascendente
    notas.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    if (!notas.length) {
      lista.innerHTML = '<div class="notas-vacio">Sin notas aún. ¡Sé el primero!</div>';
      return;
    }
    lista.innerHTML = notas.map(n => {
      const esMia = n.autorUid === currentUser.uid;
      const fecha = n.createdAt ? fmtTime(n.createdAt) : '';
      const btnDel = (esMia || isAdmin)
        ? `<button class="nota-item-del" onclick="eliminarNota('${n.id}')">🗑️</button>` : '';
      return `<div class="nota-item">
        <div class="nota-item-header">
          <span class="nota-item-autor">${escHtml(n.autorNombre || '?')}</span>
          <span class="nota-item-fecha">${fecha}</span>
          ${btnDel}
        </div>
        <div class="nota-item-texto">${escHtml(n.texto)}</div>
      </div>`;
    }).join('');
    lista.scrollTop = lista.scrollHeight;
  }, err => {
    console.error('Error cargando notas:', err);
    lista.innerHTML = '<div class="notas-vacio" style="color:var(--red)">Error al cargar notas.</div>';
  });
}

window.eliminarNota = function (notaId) {
  showConfirm({
    title: 'Eliminar nota',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarNota('${notaId}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc } = lib();
      try { await deleteDoc(doc(db(), 'ec_notas', notaId)); }
      catch (e) { showToast(friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

// Cerrar listener al cerrar modal
document.addEventListener('click', e => {
  if (e.target.closest('.modal-close[data-close="modalNotasGaleria"]') ||
    e.target.closest('.btn-cancel[data-close="modalNotasGaleria"]')) {
    if (notasUnsub) { notasUnsub(); notasUnsub = null; }
  }
});

/* ═══════════════════════════════════════════════════
   ARRANQUE
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   CHAT BURBUJA FLOTANTE
   Accesible desde cualquier sección sin salir de la vista actual
═══════════════════════════════════════════════════ */
let chatBurbujaAbierta = false;
let chatBurbujaUnsub = null;
let chatBurbujaUnreadCount = 0;
let chatBurbujaLastDate = '';
let burbujaCurrentSalaId = null; // null = sala General

function initChatBurbuja() {
  const fab = $('chatFab');
  const panel = $('chatBurbujaPanel');
  const closeBtn = $('chatBurbujaClose');
  const sendBtn = $('chatBurbujaEnviar');
  const input = $('chatBurbujaInput');
  const msgBox = $('chatBurbujaMsgs');
  const select = $('chatBurbujaSelect');
  if (!fab || !panel) return;
  
  // Cargar salas en el selector
  async function cargarSalasBurbuja() {
    if (!select || !currentGroupId) return;
    const { collection, query, where, getDocs } = lib();
    select.innerHTML = '<option value="general">💬 General</option>';
    try {
      const snap = await getDocs(query(
        collection(db(), 'ec_salas_chat'),
        where('groupId', '==', currentGroupId)
      ));
      snap.forEach(d => {
        const s = d.data();
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = (s.emoji || '💬') + ' ' + (s.nombre || 'Sala');
        select.appendChild(opt);
      });
      // Restaurar sala seleccionada si existe
      if (burbujaCurrentSalaId) {
        select.value = burbujaCurrentSalaId;
        if (!select.value) { burbujaCurrentSalaId = null; select.value = 'general'; }
      }
    } catch(e) { console.error('cargarSalasBurbuja:', e); }
  }

  // Cambiar de sala
  select?.addEventListener('change', () => {
    const val = select.value;
    burbujaCurrentSalaId = val === 'general' ? null : val;
    desconectarChatBurbuja();
    conectarChatBurbuja();
  });

  // Abrir / cerrar
  fab.addEventListener('click', () => {
    chatBurbujaAbierta = !chatBurbujaAbierta;
    panel.classList.toggle('open', chatBurbujaAbierta);
    fab.classList.toggle('active', chatBurbujaAbierta);
    if (chatBurbujaAbierta) {
      resetBurbujaUnread();
      cargarSalasBurbuja();
      conectarChatBurbuja();
      setTimeout(() => input?.focus(), 200);
    } else {
      desconectarChatBurbuja();
    }
  });

  closeBtn?.addEventListener('click', () => {
    chatBurbujaAbierta = false;
    panel.classList.remove('open');
    fab.classList.remove('active');
    desconectarChatBurbuja();
  });

  // Enviar mensaje
  const doSend = async () => {
    const text = input.value.trim();
    if (!text || !currentGroupId || !currentUser) return;
    input.value = '';
    input.style.height = 'auto';
    const { collection, addDoc, serverTimestamp } = lib();
    try {
      await addDoc(collection(db(), 'ec_chat'), {
        groupId: currentGroupId,
        salaId: burbujaCurrentSalaId || 'general',
        text,
        authorUid: currentUser.uid,
        authorName: getUserAlias(),
        authorAvatar: currentUser.avatar || '',
        createdAt: serverTimestamp()
      });
      msgBox.scrollTop = msgBox.scrollHeight;
    } catch (e) { console.error('Burbuja send:', e); }
  };

  sendBtn?.addEventListener('click', doSend);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  input?.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });
}

function conectarChatBurbuja() {
  if (!currentGroupId) return;
  desconectarChatBurbuja();
  chatBurbujaLastDate = '';
  const msgBox = $('chatBurbujaMsgs');
  if (msgBox) msgBox.innerHTML = '<div class="chat-burbuja-loading">Cargando…</div>';
  const { collection, query, where, orderBy, limit, onSnapshot } = lib();
  let isFirst = true;

  const startListener = (ordered) => {
    if (chatBurbujaUnsub) { chatBurbujaUnsub(); chatBurbujaUnsub = null; }
    const salaFiltro = burbujaCurrentSalaId || 'general';
    const q = ordered
      ? query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        where('salaId', '==', salaFiltro),
        orderBy('createdAt', 'desc'),
        limit(80)
      )
      : query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        where('salaId', '==', salaFiltro),
        limit(80)
      );

    chatBurbujaUnsub = onSnapshot(q, snap => {
      const msgBox = $('chatBurbujaMsgs');
      if (!msgBox) return;
      const loading = msgBox.querySelector('.chat-burbuja-loading');
      if (loading) loading.remove();
      const wasNearBottom = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 120;
      const prevIds = new Set([...msgBox.querySelectorAll('[data-id]')].map(el => el.dataset.id));

      const mensajes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getChatMsgMillis(a) - getChatMsgMillis(b));

      const nuevosExternos = !isFirst && !chatBurbujaAbierta && mensajes.some(m => (
        !prevIds.has(m.id) && m.authorUid !== currentUser?.uid
      ));

      chatBurbujaLastDate = '';
      msgBox.innerHTML = '';
      mensajes.forEach(m => appendBurbujaMsg(m, msgBox));

      if (isFirst || wasNearBottom) msgBox.scrollTop = msgBox.scrollHeight;
      if (nuevosExternos) incrementBurbujaUnread();
      isFirst = false;
    }, err => {
      console.error('Burbuja chat error:', err);
      if (ordered && err.code === 'failed-precondition') {
        isFirst = true;
        startListener(false);
      }
    });
  };

  startListener(true);
}

function appendBurbujaMsg(m, box) {
  const mine = m.authorUid === currentUser?.uid;
  const dateStr = m.createdAt ? fmtDateChat(m.createdAt) : '';
  if (dateStr && dateStr !== chatBurbujaLastDate) {
    const div = document.createElement('div');
    div.className = 'chat-date-divider';
    div.innerHTML = `<span>${escHtml(dateStr)}</span>`;
    box.appendChild(div);
    chatBurbujaLastDate = dateStr;
  }
  const el = document.createElement('div');
  el.className = `chat-burbuja-msg ${mine ? 'mine' : ''}`;
  el.dataset.id = m.id;
  let content = m.imageUrl
    ? `<img src="${escHtml(m.imageUrl)}" style="max-width:180px;border-radius:8px;display:block;">`
    : escHtml(m.text);
  el.innerHTML = `
    <div class="chat-burbuja-bubble">${content}</div>
    <div class="chat-burbuja-meta">${escHtml(mine ? 'Tú' : (m.authorName || 'Compañero'))} · ${fmtTimeChat(m.createdAt)}</div>`;
  box.appendChild(el);
}

function desconectarChatBurbuja() {
  if (chatBurbujaUnsub) { chatBurbujaUnsub(); chatBurbujaUnsub = null; }
}

function incrementBurbujaUnread() {
  chatBurbujaUnreadCount++;
  const badge = $('chatFabBadge');
  if (badge) { badge.textContent = chatBurbujaUnreadCount > 9 ? '9+' : chatBurbujaUnreadCount; badge.style.display = 'flex'; }
}
function resetBurbujaUnread() {
  chatBurbujaUnreadCount = 0;
  const badge = $('chatFabBadge');
  if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
}
// Exponer globalmente — grupos.js las llama desde activarSeccion()
window.resetBurbujaUnread = resetBurbujaUnread;

function setBurbujaUnreadCount(n) {
  const count = Math.max(0, Number(n) || 0);
  chatBurbujaUnreadCount = count;
  const badge = $('chatFabBadge');
  if (!badge) return;
  if (count <= 0) {
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = 'flex';
}

async function markChatAsRead() {
  if (!currentGroupId || !currentUser) return;
  try {
    const { doc, setDoc, serverTimestamp } = lib();
    const nowMs = Date.now();
    chatLastReadMs = Math.max(chatLastReadMs, nowMs);
    await setDoc(doc(db(), 'ec_chat_reads', `${currentGroupId}_${currentUser.uid}`), {
      groupId: currentGroupId,
      uid: currentUser.uid,
      lastReadAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (_) { /* silencioso */ }
}
// Exponer globalmente — grupos.js la llama desde activarSeccion()
window.markChatAsRead = markChatAsRead;

// Reconectar burbuja y activar Notificaciones Globales
let globalNotifUnsub = null;
let _lastNotifMsgId = null;

function hookBurbujaEnGrupo() {
  if (globalNotifUnsub) { globalNotifUnsub(); globalNotifUnsub = null; }
  _lastNotifMsgId = null;
  if (!currentGroupId) return;

  const { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } = lib();
  let isFirstNotif = true;

  chatLastReadMs = 0;
  getDoc(doc(db(), 'ec_chat_reads', `${currentGroupId}_${currentUser.uid}`))
    .then(s => {
      if (!s.exists()) return;
      const data = s.data() || {};
      const ts = data.lastReadAt;
      if (ts?.toMillis) chatLastReadMs = ts.toMillis();
      else if (ts) {
        const d = new Date(ts);
        if (Number.isFinite(d.getTime())) chatLastReadMs = d.getTime();
      }
    })
    .catch(() => { });

  const startNotifListener = (ordered) => {
    if (globalNotifUnsub) { globalNotifUnsub(); globalNotifUnsub = null; }
    const q = ordered
      ? query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      : query(
        collection(db(), 'ec_chat'),
        where('groupId', '==', currentGroupId),
        limit(40)
      );

    globalNotifUnsub = onSnapshot(q, snap => {
      if (snap.empty) return;
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getChatMsgMillis(b) - getChatMsgMillis(a));
      const latest = sorted[0];
      if (!latest) return;

      const panel = $('chatBurbujaPanel');
      const panelAbierto = panel && panel.classList.contains('open');
      const seccionChatActiva = (currentSection === 'chat');

      if (!panelAbierto && !seccionChatActiva) {
        const unread = sorted.filter(m => (
          m.authorUid !== currentUser?.uid &&
          getChatMsgMillis(m) > chatLastReadMs
        )).length;
        setBurbujaUnreadCount(unread);
      } else {
        setBurbujaUnreadCount(0);
      }

      if (isFirstNotif) {
        isFirstNotif = false;
        _lastNotifMsgId = latest.id;
        return;
      }
      if (latest.id === _lastNotifMsgId) return;
      _lastNotifMsgId = latest.id;

      const data = latest;
      const esMio = data.authorUid === currentUser?.uid;

      if (!panelAbierto && !seccionChatActiva && !esMio) {
        if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`💬 ${data.authorName || 'Compañero'}`, {
            body: data.imageUrl ? '📷 Imagen' : (data.text || ''),
            icon: './image/icon-512.png',
            tag: 'ze-chat-msg'
          });
        }
      }
    }, err => {
      console.error('Notif chat error:', err);
      if (ordered && err.code === 'failed-precondition') {
        isFirstNotif = true;
        startNotifListener(false);
      }
    });
  };

  startNotifListener(true);
}
initTheme();
waitForFirebase(() => initAuth());

// ══════════════════════════════════════════════════════════════════
//  PWA — Service Worker + Banner "Nueva versión" + Indicador offline
// ══════════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // Si hay un SW esperando desde antes (recarga sin aceptar), mostramos banner
      if (reg.waiting) mostrarBannerUpdate(reg.waiting);

      // Cuando termina de instalar un SW nuevo queda en "waiting"
      reg.addEventListener('updatefound', () => {
        const nuevoSW = reg.installing;
        nuevoSW.addEventListener('statechange', () => {
          if (nuevoSW.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarBannerUpdate(nuevoSW);
          }
        });
      });

      // Cuando el SW hace skipWaiting, el controlador cambia → recargamos
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!recargando) { recargando = true; window.location.reload(); }
      });

    } catch (e) { /* registro fallido, no critico */ }
  });
}

function mostrarBannerUpdate(swEsperando) {
  if (document.getElementById('sw-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.innerHTML = `
    <span>🚀 Nueva versión disponible</span>
    <button id="sw-update-btn">Actualizar ahora</button>
    <button id="sw-update-dismiss">✕</button>`;
  banner.style.cssText = [
    'position:fixed', 'bottom:72px', 'left:50%', 'transform:translateX(-50%)',
    'background:var(--accent)', 'color:#fff', 'border-radius:12px',
    'padding:10px 16px', 'display:flex', 'align-items:center', 'gap:12px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.35)', 'z-index:99999',
    'font-size:14px', 'font-weight:600', 'white-space:nowrap',
    'animation:slideUpBanner 0.3s cubic-bezier(0.34,1.56,0.64,1)'
  ].join(';');

  if (!document.getElementById('sw-banner-style')) {
    const st = document.createElement('style');
    st.id = 'sw-banner-style';
    st.textContent = `
      @keyframes slideUpBanner {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
      #sw-update-btn {
        background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.5);
        color:#fff; border-radius:8px; padding:5px 14px;
        font-size:13px; font-weight:700; cursor:pointer;
      }
      #sw-update-btn:hover { background:rgba(255,255,255,0.4); }
      #sw-update-dismiss {
        background:none; border:none; color:rgba(255,255,255,0.8);
        font-size:16px; cursor:pointer; padding:0 2px; line-height:1;
      }`;
    document.head.appendChild(st);
  }

  document.body.appendChild(banner);

  document.getElementById('sw-update-btn').addEventListener('click', () => {
    swEsperando.postMessage({ type: 'SKIP_WAITING' });
    banner.remove();
  });
  document.getElementById('sw-update-dismiss').addEventListener('click', () => {
    banner.remove();
  });
}

// ── Indicador online / offline ────────────────────────────────────────────────
(function setupOfflineIndicator() {
  let toastEl = null;

  function mostrarToast(msg, color, duracion) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.textContent = msg;
    toastEl.style.cssText = [
      'position:fixed', 'bottom:72px', 'left:50%', 'transform:translateX(-50%)',
      `background:${color}`, 'color:#fff', 'border-radius:10px',
      'padding:8px 20px', 'font-size:13px', 'font-weight:600',
      'z-index:99998', 'box-shadow:0 3px 14px rgba(0,0,0,0.3)',
      'animation:slideUpBanner 0.3s cubic-bezier(0.34,1.56,0.64,1)'
    ].join(';');
    document.body.appendChild(toastEl);
    if (duracion) setTimeout(() => { toastEl?.remove(); toastEl = null; }, duracion);
  }

  window.addEventListener('offline', () => {
    mostrarToast('📵 Sin conexión — modo offline', '#e53935', 0);
  });
  window.addEventListener('online', () => {
    toastEl?.remove(); toastEl = null;
    mostrarToast('✅ Conexión restaurada', '#43a047', 3000);
  });
}());

// --- ELIMINAR GRUPO ---
const btnDeleteGroup = $('btnDeleteGroup');
if (btnDeleteGroup) {
  btnDeleteGroup.addEventListener('click', async () => {
    if (!isAdmin) return;
    showConfirm({
      title: `Eliminar grupo "${currentGroupData.name}"`,
      message: 'Esto borrará el grupo para TODOS los miembros. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar grupo',
      onConfirm: async () => {
        btnDeleteGroup.disabled = true; btnDeleteGroup.textContent = '⏳ Eliminando…';
        const { doc, deleteDoc } = lib();
        try {
          await deleteDoc(doc(db(), 'ec_grupos', currentGroupId));
          showToast('Grupo eliminado correctamente.', 'success');
          window.location.reload();
        } catch (e) {
          showToast('No se pudo eliminar el grupo. ' + friendlyError(e), 'error');
          btnDeleteGroup.disabled = false; btnDeleteGroup.textContent = 'Eliminar grupo';
        }
      }
    });
  });
}

window.eliminarSemestre = function (id, nombre) {
  const mats = galerias.filter(g => g.semestreId === id);
  const totalMats = mats.length;
  const msg = totalMats > 0
    ? `Esto eliminará el semestre "${nombre}", ${totalMats} materia${totalMats !== 1 ? 's' : ''} y todas sus fotos. Esta acción NO se puede deshacer.`
    : `¿Eliminar el semestre "${nombre}"? Esta acción no se puede deshacer.`;
  showConfirm({
    title: 'Eliminar semestre',
    message: msg,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarSemestre('${id}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc, collection, query, where, getDocs } = lib();
      try {
        for (const mat of mats) {
          const fotosSnap = await getDocs(query(collection(db(), 'ec_fotos'), where('galeriaId', '==', mat.id)));
          for (const f of fotosSnap.docs) await deleteDoc(doc(db(), 'ec_fotos', f.id));
          await deleteDoc(doc(db(), 'ec_galerias', mat.id));
        }
        await deleteDoc(doc(db(), 'ec_semestres', id));
      } catch (e) { showToast('No se pudo eliminar. ' + friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

window.eliminarMateria = function (id, nombre) {
  showConfirm({
    title: 'Eliminar materia',
    message: `Esto eliminará la materia "${nombre}" y TODAS sus fotos de apuntes de forma permanente. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      const btn = document.querySelector(`[onclick*="eliminarMateria('${id}'"]`);
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      const { doc, deleteDoc, collection, query, where, getDocs } = lib();
      try {
        const fotosSnap = await getDocs(query(collection(db(), 'ec_fotos'), where('galeriaId', '==', id)));
        for (const f of fotosSnap.docs) await deleteDoc(doc(db(), 'ec_fotos', f.id));
        await deleteDoc(doc(db(), 'ec_galerias', id));
      } catch (e) { showToast('No se pudo eliminar. ' + friendlyError(e), 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🗑️'; } }
    }
  });
};

