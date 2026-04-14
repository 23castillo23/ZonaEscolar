/**
 * ZonaEscolar — core.js v2
 * Google Auth · Grupos privados · Feed + Comentarios + Likes
 * Chat · Tareas · Muro Personal · Apuntes · Dinámicas
 * Cloudinary: dwjzn6n0a / preset: zonaescolar_unsigned
 *
 * ── ARQUITECTURA AppState ──────────────────────────
 * Todas las variables globales viven en AppState._data.
 * Los módulos leen con AppState.get() y escriben con
 * AppState.set(). Cuando un valor cambia, AppState
 * dispara 'ze:stateChange' para que solo el módulo
 * afectado reaccione — sin cadenas de efectos ocultos.
 *
 * COMPATIBILIDAD: Las variables sueltas (currentGroupId,
 * isAdmin, etc.) se mantienen como getters/setters que
 * apuntan a AppState. Así los módulos existentes siguen
 * funcionando SIN ningún cambio hasta que los migres.
 * ──────────────────────────────────────────────────
 */

const CLOUDINARY_CLOUD  = 'dwjzn6n0a';
const CLOUDINARY_PRESET = 'zonaescolar_unsigned';

/* ═══════════════════════════════════════════════════
   APP STATE — Fuente única de verdad
   ───────────────────────────────────────────────────
   CÓMO USARLO EN MÓDULOS NUEVOS O MIGRADOS:
     Leer  → AppState.get('currentGroupId')
     Escribir → AppState.set('currentGroupId', id)
     Escuchar cambios → AppState.on('currentGroupId', fn)
   ───────────────────────────────────────────────────
   Los valores iniciales aquí definen el estado limpio
   de la app. teardownAllListeners() resetea los unsubs.
═══════════════════════════════════════════════════ */
const AppState = (() => {
  /* Estado interno — no acceder directamente */
  const _data = {
    /* ── Auth ── */
    currentUser:        null,
    currentGroupId:     null,
    currentGroupData:   null,
    isAdmin:            false,

    /* ── Listas globales ── */
    grupos:             [],
    semestres:          [],
    galerias:           [],
    galeriaActual:      null,
    apunteFiles:        [],

    /* ── Listeners de Firestore (unsubs) ── */
    feedUnsub:          null,
    chatUnsub:          null,
    tareasUnsub:        null,
    votacionUnsub:      null,
    gruposUnsub:        null,
    chatOnlineUnsub:    null,
    salasUnsub:         null,
    bibliotecaUnsub:    null,
    catBiblioUnsub:     null,
    semestresUnsub:     null,
    galeriasUnsub:      null,
    tablerosUnsub:      null,
    tableroFeedUnsub:   null,
    sidebarOnlineUnsub: null,
    muroFeedUnsub:      null,
    muroFotosUnsub:     null,
    muroAlbumsUnsub:    null,

    /* ── Paginación feed ── */
    feedOldestDoc:      null,
    feedHayMas:         true,
    feedCargandoMas:    false,

    /* ── Paginación chat ── */
    chatOldestDoc:      null,
    chatHayMas:         true,
    chatCargandoMas:    false,
    currentSalaId:      null,
    salaChatColorSeleccionado: '#1a237e',
    salaChatEmojiSeleccionado: '💬',
    chatLastReadMs:     0,
    _onlineHeartbeatTimer: null,

    /* ── Navegación ── */
    currentSection:     'feed',

    /* ── Tareas ── */
    tareasFilter:       'all',
    tareasVistaCalendario: false,

    /* ── Lightbox ── */
    lightboxPhotos:     [],
    lightboxIdx:        0,

    /* ── Dinámicas ── */
    ruletaMiembros:     [],
    ruletaAngulo:       0,
    ruletaSpinning:     false,
    triviaBanco:        [],
    triviaIdx:          0,
    triviaScore:        0,
    puntosMarcador:     [],

    /* ── Tableros temáticos ── */
    currentTableroId:   null,
    dentroDeTablero:    false,

    /* ── Muro ── */
    muroAlbumActualId:  null,
    muroAlbumsCache:    [],

    /* ── Apuntes ── */
    semestresAbiertos:  new Set(),
    scrollPosicionApuntes: 0,
    ordenSemestres:     localStorage.getItem('ze_orden_semestres') || 'creacion',
    ordenMaterias:      localStorage.getItem('ze_orden_materias')  || 'creacion',
    apuntesSearchTerm:  '',

    /* ── Biblioteca ── */
    selectedBiblioColor: 'book-pdf',
    biblioCategorias:    [],
    bibliotecaUiBound:   false,

    /* ── Calendario ── */
    calDiaSeleccionado: null,
    calMesOffset:       0,
  };

  /* Registro de listeners por clave */
  const _listeners = {};

  /* ── API pública ── */
  return {
    /**
     * Leer un valor del estado.
     * @param {string} key
     * @returns {*}
     */
    get(key) {
      return _data[key];
    },

    /**
     * Escribir un valor en el estado y notificar suscriptores.
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
      _data[key] = value;
      /* Notificar suscriptores de esta clave */
      (_listeners[key] || []).forEach(fn => { try { fn(value); } catch(e) { console.error('[AppState]', key, e); } });
      /* Evento global para módulos que prefieren escuchar el bus */
      document.dispatchEvent(new CustomEvent('ze:stateChange', { detail: { key, value } }));
    },

    /**
     * Suscribirse a cambios de una clave específica.
     * Devuelve una función para cancelar la suscripción.
     * @param {string} key
     * @param {function} fn  Recibe (nuevoValor)
     * @returns {function}   Llama para desuscribirse
     */
    on(key, fn) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(fn);
      return () => {
        _listeners[key] = _listeners[key].filter(f => f !== fn);
      };
    },

    /**
     * Cancelar un unsub guardado en el estado y poner null.
     * Equivale al patrón: if (feedUnsub) { feedUnsub(); feedUnsub = null; }
     * @param {string} key  Nombre del unsub (ej: 'feedUnsub')
     */
    unsub(key) {
      const fn = _data[key];
      if (typeof fn === 'function') { fn(); }
      _data[key] = null;
    },

    /**
     * Resetear el estado a valores limpios tras logout o cambio de grupo.
     * No toca las preferencias de usuario (tema, orden, etc.).
     */
    resetSession() {
      const preserve = ['ordenSemestres','ordenMaterias'];
      const clean = {
        currentUser: null, currentGroupId: null, currentGroupData: null, isAdmin: false,
        grupos: [], semestres: [], galerias: [], galeriaActual: null, apunteFiles: [],
        feedUnsub: null, chatUnsub: null, tareasUnsub: null, votacionUnsub: null,
        gruposUnsub: null, chatOnlineUnsub: null, salasUnsub: null, bibliotecaUnsub: null,
        catBiblioUnsub: null, semestresUnsub: null, galeriasUnsub: null, tablerosUnsub: null,
        tableroFeedUnsub: null, sidebarOnlineUnsub: null, muroFeedUnsub: null,
        muroFotosUnsub: null, muroAlbumsUnsub: null,
        feedOldestDoc: null, feedHayMas: true, feedCargandoMas: false,
        chatOldestDoc: null, chatHayMas: true, chatCargandoMas: false,
        currentSalaId: null, chatLastReadMs: 0, _onlineHeartbeatTimer: null,
        salaChatColorSeleccionado: '#1a237e', salaChatEmojiSeleccionado: '💬',
        currentSection: 'feed', tareasFilter: 'all', tareasVistaCalendario: false,
        lightboxPhotos: [], lightboxIdx: 0,
        ruletaMiembros: [], ruletaAngulo: 0, ruletaSpinning: false,
        triviaBanco: [], triviaIdx: 0, triviaScore: 0, puntosMarcador: [],
        currentTableroId: null, dentroDeTablero: false,
        muroAlbumActualId: null, muroAlbumsCache: [],
        semestresAbiertos: new Set(), scrollPosicionApuntes: 0, apuntesSearchTerm: '',
        selectedBiblioColor: 'book-pdf', biblioCategorias: [], bibliotecaUiBound: false,
        calDiaSeleccionado: null, calMesOffset: 0,
      };
      Object.entries(clean).forEach(([k, v]) => {
        if (!preserve.includes(k)) _data[k] = v;
      });
    },

    /* Exponer _data internamente para compatibilidad con módulos sin migrar */
    _data,
  };
})();

/* ═══════════════════════════════════════════════════
   COMPATIBILIDAD — Variables globales como proxies
   ───────────────────────────────────────────────────
   Todos los módulos existentes usan las variables
   sueltas directamente (currentGroupId, isAdmin…).
   Aquí las convertimos en getters/setters que leen y
   escriben en AppState. Así NO necesitas cambiar
   ningún módulo hoy — la migración es gradual.

   Cuando migres un módulo, cambia sus accesos a
   AppState.get/set y borra la entrada de aquí.
═══════════════════════════════════════════════════ */
Object.defineProperties(window, {
  /* ── Auth ── */
  currentUser:        { get: () => AppState.get('currentUser'),        set: v => AppState.set('currentUser', v),        configurable: true },
  currentGroupId:     { get: () => AppState.get('currentGroupId'),     set: v => AppState.set('currentGroupId', v),     configurable: true },
  currentGroupData:   { get: () => AppState.get('currentGroupData'),   set: v => AppState.set('currentGroupData', v),   configurable: true },
  isAdmin:            { get: () => AppState.get('isAdmin'),            set: v => AppState.set('isAdmin', v),            configurable: true },

  /* ── Listas ── */
  grupos:             { get: () => AppState.get('grupos'),             set: v => AppState.set('grupos', v),             configurable: true },
  semestres:          { get: () => AppState.get('semestres'),          set: v => AppState.set('semestres', v),          configurable: true },
  galerias:           { get: () => AppState.get('galerias'),          set: v => AppState.set('galerias', v),           configurable: true },
  galeriaActual:      { get: () => AppState.get('galeriaActual'),     set: v => AppState.set('galeriaActual', v),      configurable: true },
  apunteFiles:        { get: () => AppState.get('apunteFiles'),        set: v => AppState.set('apunteFiles', v),        configurable: true },

  /* ── Unsubs ── */
  feedUnsub:          { get: () => AppState.get('feedUnsub'),          set: v => AppState.set('feedUnsub', v),          configurable: true },
  chatUnsub:          { get: () => AppState.get('chatUnsub'),          set: v => AppState.set('chatUnsub', v),          configurable: true },
  tareasUnsub:        { get: () => AppState.get('tareasUnsub'),        set: v => AppState.set('tareasUnsub', v),        configurable: true },
  votacionUnsub:      { get: () => AppState.get('votacionUnsub'),      set: v => AppState.set('votacionUnsub', v),      configurable: true },
  gruposUnsub:        { get: () => AppState.get('gruposUnsub'),        set: v => AppState.set('gruposUnsub', v),        configurable: true },
  chatOnlineUnsub:    { get: () => AppState.get('chatOnlineUnsub'),    set: v => AppState.set('chatOnlineUnsub', v),    configurable: true },
  salasUnsub:         { get: () => AppState.get('salasUnsub'),         set: v => AppState.set('salasUnsub', v),         configurable: true },
  bibliotecaUnsub:    { get: () => AppState.get('bibliotecaUnsub'),    set: v => AppState.set('bibliotecaUnsub', v),    configurable: true },
  catBiblioUnsub:     { get: () => AppState.get('catBiblioUnsub'),     set: v => AppState.set('catBiblioUnsub', v),     configurable: true },
  semestresUnsub:     { get: () => AppState.get('semestresUnsub'),     set: v => AppState.set('semestresUnsub', v),     configurable: true },
  galeriasUnsub:      { get: () => AppState.get('galeriasUnsub'),      set: v => AppState.set('galeriasUnsub', v),      configurable: true },
  tablerosUnsub:      { get: () => AppState.get('tablerosUnsub'),      set: v => AppState.set('tablerosUnsub', v),      configurable: true },
  tableroFeedUnsub:   { get: () => AppState.get('tableroFeedUnsub'),   set: v => AppState.set('tableroFeedUnsub', v),   configurable: true },
  sidebarOnlineUnsub: { get: () => AppState.get('sidebarOnlineUnsub'), set: v => AppState.set('sidebarOnlineUnsub', v), configurable: true },
  muroFeedUnsub:      { get: () => AppState.get('muroFeedUnsub'),      set: v => AppState.set('muroFeedUnsub', v),      configurable: true },
  muroFotosUnsub:     { get: () => AppState.get('muroFotosUnsub'),     set: v => AppState.set('muroFotosUnsub', v),     configurable: true },
  muroAlbumsUnsub:    { get: () => AppState.get('muroAlbumsUnsub'),    set: v => AppState.set('muroAlbumsUnsub', v),    configurable: true },

  /* ── Paginación feed ── */
  feedOldestDoc:      { get: () => AppState.get('feedOldestDoc'),      set: v => AppState.set('feedOldestDoc', v),      configurable: true },
  feedHayMas:         { get: () => AppState.get('feedHayMas'),         set: v => AppState.set('feedHayMas', v),         configurable: true },
  feedCargandoMas:    { get: () => AppState.get('feedCargandoMas'),    set: v => AppState.set('feedCargandoMas', v),    configurable: true },

  /* ── Paginación / chat ── */
  chatOldestDoc:      { get: () => AppState.get('chatOldestDoc'),      set: v => AppState.set('chatOldestDoc', v),      configurable: true },
  chatHayMas:         { get: () => AppState.get('chatHayMas'),         set: v => AppState.set('chatHayMas', v),         configurable: true },
  chatCargandoMas:    { get: () => AppState.get('chatCargandoMas'),    set: v => AppState.set('chatCargandoMas', v),    configurable: true },
  currentSalaId:      { get: () => AppState.get('currentSalaId'),      set: v => AppState.set('currentSalaId', v),      configurable: true },
  salaChatColorSeleccionado: { get: () => AppState.get('salaChatColorSeleccionado'), set: v => AppState.set('salaChatColorSeleccionado', v), configurable: true },
  salaChatEmojiSeleccionado: { get: () => AppState.get('salaChatEmojiSeleccionado'), set: v => AppState.set('salaChatEmojiSeleccionado', v), configurable: true },
  chatLastReadMs:     { get: () => AppState.get('chatLastReadMs'),      set: v => AppState.set('chatLastReadMs', v),     configurable: true },
  _onlineHeartbeatTimer: { get: () => AppState.get('_onlineHeartbeatTimer'), set: v => AppState.set('_onlineHeartbeatTimer', v), configurable: true },

  /* ── Navegación ── */
  currentSection:     { get: () => AppState.get('currentSection'),     set: v => AppState.set('currentSection', v),     configurable: true },

  /* ── Tareas ── */
  tareasFilter:       { get: () => AppState.get('tareasFilter'),       set: v => AppState.set('tareasFilter', v),       configurable: true },
  tareasVistaCalendario: { get: () => AppState.get('tareasVistaCalendario'), set: v => AppState.set('tareasVistaCalendario', v), configurable: true },

  /* ── Lightbox ── */
  lightboxPhotos:     { get: () => AppState.get('lightboxPhotos'),     set: v => AppState.set('lightboxPhotos', v),     configurable: true },
  lightboxIdx:        { get: () => AppState.get('lightboxIdx'),        set: v => AppState.set('lightboxIdx', v),        configurable: true },

  /* ── Dinámicas ── */
  ruletaMiembros:     { get: () => AppState.get('ruletaMiembros'),     set: v => AppState.set('ruletaMiembros', v),     configurable: true },
  ruletaAngulo:       { get: () => AppState.get('ruletaAngulo'),       set: v => AppState.set('ruletaAngulo', v),       configurable: true },
  ruletaSpinning:     { get: () => AppState.get('ruletaSpinning'),     set: v => AppState.set('ruletaSpinning', v),     configurable: true },
  triviaBanco:        { get: () => AppState.get('triviaBanco'),        set: v => AppState.set('triviaBanco', v),        configurable: true },
  triviaIdx:          { get: () => AppState.get('triviaIdx'),          set: v => AppState.set('triviaIdx', v),          configurable: true },
  triviaScore:        { get: () => AppState.get('triviaScore'),        set: v => AppState.set('triviaScore', v),        configurable: true },
  puntosMarcador:     { get: () => AppState.get('puntosMarcador'),     set: v => AppState.set('puntosMarcador', v),     configurable: true },

  /* ── Tableros ── */
  currentTableroId:   { get: () => AppState.get('currentTableroId'),   set: v => AppState.set('currentTableroId', v),   configurable: true },
  dentroDeTablero:    { get: () => AppState.get('dentroDeTablero'),    set: v => AppState.set('dentroDeTablero', v),    configurable: true },

  /* ── Muro ── */
  muroAlbumActualId:  { get: () => AppState.get('muroAlbumActualId'),  set: v => AppState.set('muroAlbumActualId', v),  configurable: true },
  muroAlbumsCache:    { get: () => AppState.get('muroAlbumsCache'),    set: v => AppState.set('muroAlbumsCache', v),    configurable: true },

  /* ── Apuntes ── */
  semestresAbiertos:  { get: () => AppState.get('semestresAbiertos'),  set: v => AppState.set('semestresAbiertos', v),  configurable: true },
  scrollPosicionApuntes: { get: () => AppState.get('scrollPosicionApuntes'), set: v => AppState.set('scrollPosicionApuntes', v), configurable: true },
  ordenSemestres:     { get: () => AppState.get('ordenSemestres'),     set: v => AppState.set('ordenSemestres', v),     configurable: true },
  ordenMaterias:      { get: () => AppState.get('ordenMaterias'),      set: v => AppState.set('ordenMaterias', v),      configurable: true },
  apuntesSearchTerm:  { get: () => AppState.get('apuntesSearchTerm'),  set: v => AppState.set('apuntesSearchTerm', v),  configurable: true },

  /* ── Biblioteca ── */
  selectedBiblioColor: { get: () => AppState.get('selectedBiblioColor'), set: v => AppState.set('selectedBiblioColor', v), configurable: true },
  biblioCategorias:   { get: () => AppState.get('biblioCategorias'),   set: v => AppState.set('biblioCategorias', v),   configurable: true },
  bibliotecaUiBound:  { get: () => AppState.get('bibliotecaUiBound'),  set: v => AppState.set('bibliotecaUiBound', v),  configurable: true },

  /* ── Calendario ── */
  calDiaSeleccionado: { get: () => AppState.get('calDiaSeleccionado'), set: v => AppState.set('calDiaSeleccionado', v), configurable: true },
  calMesOffset:       { get: () => AppState.get('calMesOffset'),       set: v => AppState.set('calMesOffset', v),       configurable: true },
});

/* ═══════════════════════════════════════════════════
   CONSTANTES — Listas de emojis
═══════════════════════════════════════════════════ */
const EMOJIS_SEMESTRE = [
  '📅', '📚', '🎓', '🌱', '☀️', '🍂', '❄️', '📖', '🏫', '✏️',
  '🗓️', '🌸', '🌻', '🍃', '🌊', '⭐', '🔖', '🎒', '🖊️', '📋',
  '🏆', '🌙', '🎯', '🧩', '🌈', '🎪', '🚀', '💫', '🎀', '🌟'
];
const EMOJIS_MATERIA = [
  '📐', '🔢', '🧮', '📊', '➕', '➗', '🔣', '∫', 'π', '📈',
  '🔬', '⚗️', '🧪', '🧫', '🧬', '🔭', '⚛️', '🌡️', '🧲', '💊',
  '💻', '🖥️', '📱', '⌨️', '🖱️', '🖨️', '💾', '💿', '🔌', '🛜',
  '🤖', '👾', '🕹️', '📡', '🔧', '⚙️', '🛠️', '🔩', '🖧', '📟',
  '🌍', '🗺️', '📜', '🏛️', '🗽', '⚖️', '🏦', '📰', '🎭', '🗣️',
  '🎨', '✏️', '🖌️', '🖍️', '📸', '🎬', '🎵', '🎼', '🎹', '🎸',
  '📝', '📖', '✍️', '🔤', '💬', '📕', '📗', '📘', '📙', '🔡',
  '💰', '📉', '🏢', '💼', '🤝', '📦', '🏪', '💳', '🧾', '📑',
  '🏃', '⚽', '🏀', '🏊', '🧘', '💪', '🦷', '🩺', '🧠', '🫀',
  '🏫', '🎒', '📏', '📌', '📍', '🗂️', '🗃️', '📂', '🗒️', '⏰'
];
const EMOJIS_GRUPO = ['👥', '🚀', '⭐', '🔥', '💎', '🌙', '🎯', '🏆', '🌈', '🎪'];

/* ═══════════════════════════════════════════════════
   UTILIDADES DOM
═══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ═══════════════════════════════════════════════════
   UTILIDADES DE FORMATO Y TEXTO
═══════════════════════════════════════════════════ */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function fmtTimeChat(ts) {
  if (!ts) return 'Enviando...';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'Enviando...';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateChat(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getChatMsgMillis(m) {
  const ts = m?.createdAt ?? m?.timestamp ?? m?.fecha ?? m?.date ?? null;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    return Number.isFinite(d?.getTime?.()) ? d.getTime() : 0;
  }
  const d = new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}
function getChatMsgDate(m) {
  const ts = m?.createdAt ?? m?.timestamp ?? m?.fecha ?? m?.date ?? null;
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    return (d instanceof Date && Number.isFinite(d.getTime())) ? d : null;
  }
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}

/* ═══════════════════════════════════════════════════
   ACCESO A FIREBASE
═══════════════════════════════════════════════════ */
function waitForFirebase(cb) {
  if (window._firebaseReady) { cb(); return; }
  window.addEventListener('firebase-ready', cb, { once: true });
}
function db()  { return window._db; }
function lib() { return window._fbLib; }

/* ═══════════════════════════════════════════════════
   HELPERS DE DOMINIO
═══════════════════════════════════════════════════ */
function parseUserVoteIndex(raw) {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function limpiarLinkDrive(url) {
  if (url.includes('drive.google.com')) {
    const matchPath = url.match(/\/d\/([a-zA-Z0-9_-]+)\/(view|edit|usp|preview)/);
    if (matchPath?.[1]) return `https://drive.google.com/file/d/${matchPath[1]}/preview`;
    const matchId = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId?.[1]) return `https://drive.google.com/file/d/${matchId[1]}/preview`;
    const matchQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchQuery?.[1]) return `https://drive.google.com/file/d/${matchQuery[1]}/preview`;
  }
  return url;
}

/* ═══════════════════════════════════════════════════
   TEMA — Modo oscuro / claro
═══════════════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem('ze_theme') || 'dark';
  applyTheme(saved);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  const btn = $('btnThemeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  const meta = $('metaThemeColor');
  if (meta) meta.content = theme === 'light' ? '#ffffff' : '#1a1a2e';
  localStorage.setItem('ze_theme', theme);
}
function _initThemeToggle() {
  const btn = $('btnThemeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = localStorage.getItem('ze_theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initThemeToggle);
} else {
  _initThemeToggle();
}

/* ═══════════════════════════════════════════════════
   SAFARI / CROSS-BROWSER LAYOUT FIXES
═══════════════════════════════════════════════════ */
function _setTopbarHeight() {
  const topbar = document.querySelector('header.topbar');
  if (!topbar) return;
  const h = topbar.getBoundingClientRect().height;
  if (h > 0) document.documentElement.style.setProperty('--ze-topbar-h', h + 'px');
}
function _setBottomNavClearance() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) {
    document.documentElement.style.setProperty('--ze-bottom-nav-clearance', '0px');
    return;
  }
  const h = nav.getBoundingClientRect().height;
  if (h > 0) document.documentElement.style.setProperty('--ze-bottom-nav-clearance', h + 'px');
  else        document.documentElement.style.removeProperty('--ze-bottom-nav-clearance');
}
function _setRealVh() {
  const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--ze-real-vh', vh + 'px');
}
function _initSafariFixes() {
  const tick = () => { _setRealVh(); _setTopbarHeight(); _setBottomNavClearance(); };
  tick();
  if (window.visualViewport) window.visualViewport.addEventListener('resize', tick, { passive: true });
  window.addEventListener('resize', tick, { passive: true });
  window.addEventListener('orientationchange', () => requestAnimationFrame(tick), { passive: true });
  try { window.matchMedia('(max-width: 768px)').addEventListener('change', tick); }
  catch (_) { window.matchMedia('(max-width: 768px)').addListener(tick); }
  requestAnimationFrame(() => requestAnimationFrame(tick));
  setTimeout(tick, 100);
  setTimeout(tick, 600);
  /* FIX: bottom nav puede estar oculto al arrancar (display:none en CSS base).
     Si h=0 al medir, --ze-bottom-nav-clearance se elimina y el nav queda mal.
     Medimos de nuevo más tarde para capturar la altura real una vez visible. */
  setTimeout(tick, 1200);
  setTimeout(tick, 2500);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initSafariFixes);
} else {
  _initSafariFixes();
}

/* ── Chat online bar: clase .visible en lugar de :has() ── */
function _updateChatOnlineBarVisibility() {
  const bar  = document.querySelector('.chat-online-bar');
  const list = document.getElementById('chatOnlineList');
  if (!bar || !list) return;
  bar.classList.toggle('visible', list.style.display === 'flex');
}
if (typeof MutationObserver !== 'undefined') {
  const _onlineObserver = new MutationObserver(_updateChatOnlineBarVisibility);
  const _waitForOnlineList = setInterval(() => {
    const list = document.getElementById('chatOnlineList');
    if (list) { _onlineObserver.observe(list, { attributes: true, attributeFilter: ['style'] }); clearInterval(_waitForOnlineList); }
  }, 500);
}

/* ═══════════════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════════════ */
function getAvatarHtml(url, name, extraClass = '') {
  const initial  = (name || '?').charAt(0).toUpperCase();
  const safeUrl  = (url && typeof url === 'string') ? url.trim() : '';
  if (safeUrl) {
    return `
      <div class="avatar-fallback-container ${extraClass}">
        <img src="${escHtml(safeUrl)}" class="${extraClass}" alt=""
             style="display:block; width:100%; height:100%; object-fit:cover; border-radius:50%;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="sidebar-member-initial ${extraClass}" style="display:none; width:100%; height:100%;">${initial}</div>
      </div>`;
  }
  return `<div class="sidebar-member-initial ${extraClass}">${initial}</div>`;
}

/* ═══════════════════════════════════════════════════
   AUTENTICACIÓN CON GOOGLE
═══════════════════════════════════════════════════ */
function initAuth() {
  waitForFirebase(() => {
    const { onAuthStateChanged } = lib();
    onAuthStateChanged(window._auth, async user => {
      if (user) {
        AppState.set('currentUser', {
          uid:    user.uid,
          email:  user.email,
          name:   user.displayName || user.email.split('@')[0],
          avatar: user.photoURL || ''
        });
        try {
          const { doc, getDoc } = lib();
          const snap = await getDoc(doc(db(), 'ec_users', user.uid));
          if (snap.exists()) {
            const d = snap.data();
            const cu = AppState.get('currentUser');
            if (d.name)   cu.name   = d.name;
            if (d.avatar !== undefined && d.avatar !== null) cu.avatar = d.avatar;
            AppState.set('currentUser', cu);
          }
        } catch (_) {}
        showApp();
        await ensureUserDoc();
        loadGruposDelUsuario();
      } else {
        /* Cancelar todos los listeners antes de limpiar el estado */
        if (typeof window.teardownAllListeners === 'function') window.teardownAllListeners();
        AppState.set('currentUser',      null);
        AppState.set('currentGroupId',   null);
        AppState.set('currentGroupData', null);
        showLogin();
      }
    });
  });
}

$('btnGoogleLogin').addEventListener('click', async () => {
  const btn = $('btnGoogleLogin');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Conectando…';
  waitForFirebase(async () => {
    const { GoogleAuthProvider, signInWithPopup } = lib();
    try {
      await signInWithPopup(window._auth, new GoogleAuthProvider());
    } catch (e) {
      showToast('No se pudo iniciar sesión. ' + friendlyError(e), 'error');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
});

$('btnLogout').addEventListener('click', () => {
  showConfirm({
    title: '¿Cerrar sesión?',
    message: 'Se cerrará tu sesión en este dispositivo.',
    confirmText: 'Cerrar sesión',
    danger: false,
    onConfirm: async () => {
      const btn = $('btnLogout');
      btn.disabled = true; btn.textContent = '⏳';
      const { signOut } = lib();
      try { await signOut(window._auth); }
      finally { btn.disabled = false; btn.textContent = 'Salir'; }
    }
  });
});

async function ensureUserDoc() {
  const cu = AppState.get('currentUser');
  const { doc, setDoc } = lib();
  try {
    await setDoc(doc(db(), 'ec_users', cu.uid), {
      name: cu.name, email: cu.email, avatar: cu.avatar,
      updatedAt: lib().serverTimestamp()
    }, { merge: true });
  } catch (_) {}
}

function showLogin() {
  $('loginScreen').style.display = 'flex';
  $('appShell').style.display    = 'none';
}

function showApp() {
  $('loginScreen').style.display = 'none';
  $('appShell').style.display    = 'flex';
  refreshAvatarUI();
  $('userName').textContent = getUserAlias();
  $('userRole').textContent = 'Integrante';
  if ($('muroNombre')) $('muroNombre').textContent = getUserAlias();
  initChatBurbuja();
  showSection('loading');
}

window.getUserAlias = function () {
  const cu  = AppState.get('currentUser');
  const cgd = AppState.get('currentGroupData');
  if (cgd?.miembroNombres) {
    const key = cu.email.replace(/\./g, '_');
    if (cgd.miembroNombres[key]) return cgd.miembroNombres[key];
  }
  return cu.name;
};

function refreshAvatarUI() {
  const cu      = AppState.get('currentUser');
  const av      = cu.avatar || '';
  const isEmoji = av && [...av].length <= 2 && !av.startsWith('http');
  const isUrl   = av && av.startsWith('http');
  const initial = (cu.name || '?').charAt(0).toUpperCase();

  [$('userAvatar'), $('topbarAvatar'), $('composeAvatar')].forEach(el => {
    if (!el) return;
    if (isUrl) { el.src = av; el.style.display = ''; }
    else       { el.src = ''; el.style.display = 'none'; }
  });

  const muroAv = $('muroAvatar');
  const muroFb = $('muroAvatarFallback');
  if (muroAv && muroFb && !muroViendoUid) {
    if (isUrl) {
      muroAv.src = av; muroAv.style.display = 'block'; muroFb.style.display = 'none';
    } else {
      muroAv.style.display = 'none'; muroFb.style.display = 'flex';
      muroFb.textContent = isEmoji ? av : initial;
    }
  }

  const userAvEl = $('userAvatar');
  if (userAvEl) {
    if (!isUrl) {
      userAvEl.style.display = 'none';
      let pill = $('userPillInitial');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'userPillInitial';
        pill.className = 'sidebar-member-initial';
        pill.style.cssText = 'width:36px;height:36px;font-size:16px;flex-shrink:0;';
        userAvEl.parentElement.insertBefore(pill, userAvEl);
      }
      pill.textContent = isEmoji ? av : initial;
      pill.style.display = 'flex';
    } else {
      const pill = $('userPillInitial');
      if (pill) pill.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════════════════
   ERRORES AMIGABLES
═══════════════════════════════════════════════════ */
window.friendlyError = function(e) {
  if (!e) return 'Ocurrió un error inesperado.';
  const msg = (e.message || e.code || String(e)).toLowerCase();
  if (msg.includes('permission-denied') || msg.includes('missing or insufficient'))
    return 'No tienes permiso para realizar esta acción.';
  if (msg.includes('network') || msg.includes('unavailable') || msg.includes('offline'))
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (msg.includes('not-found') || msg.includes('no such document'))
    return 'El elemento ya no existe o fue eliminado.';
  if (msg.includes('already-exists') || msg.includes('email-already'))
    return 'Ya existe un registro con esos datos.';
  if (msg.includes('unauthenticated') || msg.includes('auth'))
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (msg.includes('quota-exceeded') || msg.includes('resource-exhausted'))
    return 'Límite del servicio alcanzado. Intenta más tarde.';
  if (msg.includes('deadline-exceeded') || msg.includes('timeout'))
    return 'La operación tardó demasiado. Intenta de nuevo.';
  if (msg.includes('upload') || msg.includes('cloudinary'))
    return 'No se pudo subir el archivo. Verifica el formato e intenta de nuevo.';
  return 'Algo salió mal. Intenta de nuevo.';
};

/* ═══════════════════════════════════════════════════
   CONFIRM — Modal de confirmación destructiva
═══════════════════════════════════════════════════ */
window.showConfirm = function({ title = '¿Estás seguro?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, danger = true } = {}) {
  const modal = document.getElementById('modalConfirmDestructivo');
  if (!modal) { console.error('Falta #modalConfirmDestructivo en index.html'); return; }
  const elTitle   = document.getElementById('confirmTitle');
  const elMsg     = document.getElementById('confirmMessage');
  const btnOk     = document.getElementById('confirmBtnOk');
  const btnCancel = document.getElementById('confirmBtnCancel');
  if (elTitle)   elTitle.textContent   = title;
  if (elMsg)     elMsg.textContent     = message;
  if (btnOk)     btnOk.textContent     = confirmText;
  if (btnCancel) btnCancel.textContent = cancelText;
  if (btnOk) btnOk.className = danger ? 'confirm-btn-ok danger' : 'confirm-btn-ok';
  const newOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(newOk, btnOk);
  modal.classList.add('open');
  if (typeof _lockBodyScroll === 'function') _lockBodyScroll();
  const close = () => {
    modal.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open, .comments-modal-overlay.active')) {
      if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
    }
  };
  newOk.addEventListener('click', () => { close(); onConfirm?.(); });
  const cancelBtnOld = document.getElementById('confirmBtnCancel');
  const newCancel = cancelBtnOld.cloneNode(true);
  cancelBtnOld.parentNode.replaceChild(newCancel, cancelBtnOld);
  newCancel.addEventListener('click', close);
  const onOverlay = (e) => { if (e.target === modal) { close(); modal.removeEventListener('click', onOverlay); } };
  modal.addEventListener('click', onOverlay);
};

/* ═══════════════════════════════════════════════════
   TOAST — Notificaciones visuales
═══════════════════════════════════════════════════ */
const _TOAST_MAX = 4;

window.showToast = function(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.style.cssText = `
      position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
      z-index: 99999; display: flex; flex-direction: column; align-items: center;
      gap: 8px; pointer-events: none; width: max-content; max-width: 90vw;`;
    document.body.appendChild(container);
  }
  const existing = container.querySelectorAll('[data-toast-msg]');
  for (const el of existing) { if (el.dataset.toastMsg === msg) return; }
  const allToasts = container.querySelectorAll('[data-toast-msg]');
  if (allToasts.length >= _TOAST_MAX) allToasts[0].click();
  const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = { success: 'var(--green, #16a34a)', error: 'var(--red, #dc2626)', warning: '#f59e0b', info: 'var(--accent,#7c6af7)' };
  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.dataset.toastMsg = msg;
  toast.style.cssText = `
    display: flex; align-items: center; gap: 10px;
    background: var(--bg2, #1e1e2e); color: var(--text0, #fff);
    border: 1px solid var(--border, rgba(255,255,255,0.1));
    border-left: 4px solid ${colors[type]};
    padding: 12px 18px; border-radius: 10px; font-size: 14px;
    font-family: var(--font, sans-serif); box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    pointer-events: all; max-width: 88vw; line-height: 1.4;
    opacity: 0; transform: translateY(-12px) scale(0.96);
    transition: opacity 0.22s ease, transform 0.22s ease; cursor: pointer;`;
  toast.innerHTML = `<span style="font-size:16px;flex-shrink:0" aria-hidden="true">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.opacity = '1'; toast.style.transform = 'translateY(0) scale(1)';
  }));
  const remove = () => {
    toast.style.opacity = '0'; toast.style.transform = 'translateY(-8px) scale(0.96)';
    setTimeout(() => toast.remove(), 220);
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
};

/* ═══════════════════════════════════════════════════
   CLOUDINARY — Subida de archivos
═══════════════════════════════════════════════════ */
async function uploadToCloudinary(file, tag = '') {
  if (file.size > 10 * 1024 * 1024) {
    showToast('El archivo es muy pesado. Máximo 10 MB.', 'info');
    return null;
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  if (tag) {
    fd.append('tags', tag);
    fd.append('folder', `ZonaEscolar/${tag}`);
    fd.append('asset_folder', `ZonaEscolar/${tag}`);
  }
  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast('No se pudo subir el archivo. Intenta de nuevo.', 'error'); return null; }
    return data.secure_url || null;
  } catch (e) {
    showToast('Sin conexión. Verifica tu red e intenta de nuevo.', 'error');
    return null;
  }
}
