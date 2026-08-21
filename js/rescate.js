/**
 * Cotizador SDI · Rescate de cotizaciones desde versiones anteriores del respaldo
 *
 * POR QUÉ EXISTE (21 ago 2026): hasta hoy el control del navegador guardaba un
 * máximo de 100 cotizaciones, y el respaldo automático subía a Drive esa misma
 * lista recortada. Al pasar de 100, las cotizaciones más viejas se caían del
 * navegador Y del respaldo: así desapareció julio 2026, y por eso "Restaurar de
 * Drive" no devolvía nada (Drive ya traía las mismas 100).
 *
 * El bug de raíz está corregido (history.js: el tope solo aplica al navegador;
 * a Drive se sube la unión completa). Esta página recupera lo que se llegó a
 * perder ANTES del arreglo, leyendo las VERSIONES ANTERIORES que Google Drive
 * conserva de cada archivo.
 *
 * Todo lo que hace sobre Drive es LECTURA, y la recuperación es una FUSIÓN:
 * nunca borra ni pisa una cotización existente.
 */

var R = { fileId: null, revs: [], versiones: [], recuperables: [] };

function _r(id) { return document.getElementById(id); }

/** Cuenta cotizaciones por mes. @returns {object} { '2026-07': 12, ... } */
function _mesesResumen(arr) {
  const c = {};
  (Array.isArray(arr) ? arr : []).forEach(function (e) {
    const k = historyMonthKey(e);
    c[k] = (c[k] || 0) + 1;
  });
  return c;
}

const _MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function _mesLabel(k) {
  if (k === 'sin-fecha') return 'sin fecha';
  const p = String(k).split('-');
  const i = parseInt(p[1], 10) - 1;
  return (_MESES[i] || '?') + ' ' + p[0];
}

/** "ago 2026 (100) · jul 2026 (38)" */
function _mesesTexto(arr) {
  const c = _mesesResumen(arr);
  const ks = Object.keys(c).sort().reverse();
  if (!ks.length) return '—';
  return ks.map(function (k) { return _mesLabel(k) + ' (' + c[k] + ')'; }).join(' · ');
}

function _fechaLarga(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * "1 cotización" / "5 cotizaciones". El plural PIERDE la tilde: pegarle 'es'
 * a la palabra con tilde da "cotizaciónes", que es falta de ortografía en un
 * mensaje que ve el agente.
 */
function _plural(n) { return n + (n === 1 ? ' cotización' : ' cotizaciones'); }

/** Escapa texto antes de meterlo en innerHTML. */
function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/**
 * Corre `fn` sobre los items de a `n` en paralelo (no 300 fetch de un golpe).
 * @returns {Promise<Array>} resultados en el mismo orden (null si alguno falló)
 */
async function _enTandas(items, n, fn, onProgress) {
  const out = new Array(items.length);
  let i = 0, hechos = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); }
      catch (e) { console.warn('[rescate] no se pudo leer una version:', e); out[idx] = null; }
      hechos++;
      if (onProgress) onProgress(hechos, items.length);
    }
  }
  const workers = [];
  for (let k = 0; k < Math.min(n, items.length); k++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

/** Misma identidad que usa la fusión de history.js (id, o firma de la entrada). */
function _claveEntrada(e) {
  if (e && e.id) return 'id:' + e.id;
  return 'k:' + [
    (e && e.date) || '',
    (typeof historyEntryPlate === 'function' ? historyEntryPlate(e) : ''),
    (e && e.email) || '',
    (e && e.client) || ''
  ].join('|');
}

// ---------------------------------------------------------------------
// Pintado
// ---------------------------------------------------------------------

/** Estado del control que hay HOY en este navegador. */
function pintarEstadoActual() {
  const hist = loadHistory();
  _r('actualNum').textContent = hist.length;
  _r('actualMeses').textContent = _mesesTexto(hist);
}

function _setPaso(msg, mostrar) {
  const el = _r('progreso');
  el.hidden = !mostrar;
  if (mostrar) _r('progresoTxt').textContent = msg;
}

// ---------------------------------------------------------------------
// Buscar versiones anteriores
// ---------------------------------------------------------------------

async function buscarVersiones() {
  const btn = _r('btnBuscar');
  btn.disabled = true;
  _r('resultado').hidden = true;
  _r('vacio').hidden = true;
  _r('exito').hidden = true;

  try {
    _setPaso('Pidiendo permiso a Google Drive…', true);
    const token = await getDriveToken();

    _setPaso('Buscando versiones anteriores de tu respaldo…', true);
    const res = await driveListRevisions(token);

    if (!res.fileId) {
      _setPaso('', false);
      _r('vacio').hidden = false;
      _r('vacioTxt').textContent =
        'No hay ningún respaldo en tu Drive todavía. Abrí el cotizador, entrá a Configuración y tocá "Sincronizar ahora" para crear el primero.';
      return;
    }

    R.fileId = res.fileId;
    R.revs   = res.revisions;

    if (!res.revisions.length) {
      _setPaso('', false);
      _r('vacio').hidden = false;
      _r('vacioTxt').textContent =
        'Google Drive no conserva versiones anteriores de tu respaldo: solo está la versión actual, que es la que ya tenés en el navegador.';
      return;
    }

    // Descarga de cada versión (de la más nueva a la más vieja).
    const TOPE  = 300;
    const lista = res.revisions.slice(0, TOPE);
    const contenidos = await _enTandas(lista, 4, function (rev) {
      return driveReadRevision(token, res.fileId, rev.id);
    }, function (hechos, total) {
      _setPaso('Leyendo versión ' + hechos + ' de ' + total + '…', true);
    });

    R.versiones = lista.map(function (rev, i) {
      const data = contenidos[i];
      const hist = (data && Array.isArray(data.history)) ? data.history : null;
      return { rev: rev, hist: hist, ok: !!hist };
    });

    // Unión de TODAS las versiones + lo que hay hoy en el navegador.
    let union = ensureHistoryIds();
    R.versiones.forEach(function (v) {
      if (v.ok) union = mergeHistories(union, v.hist, Infinity);
    });

    const yaTengo = {};
    loadHistory().forEach(function (e) { yaTengo[_claveEntrada(e)] = true; });
    R.recuperables = union.filter(function (e) { return !yaTengo[_claveEntrada(e)]; });

    _setPaso('', false);
    pintarResultado(union);

  } catch (e) {
    console.error('[rescate]', e);
    _setPaso('', false);
    showToast('No se pudo leer el respaldo: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function pintarResultado(union) {
  _r('resultado').hidden = false;

  const n = R.recuperables.length;
  _r('recNum').textContent   = n;
  _r('recMeses').textContent = n ? _mesesTexto(R.recuperables) : '—';
  _r('totalNum').textContent = union.length;

  const btnRec = _r('btnRecuperar');
  const msg    = _r('recMsg');

  if (n > 0) {
    btnRec.hidden = false;
    btnRec.textContent = 'Recuperar ' + _plural(n);
    msg.textContent = 'Se suman a las que ya tenés. No se borra ni se cambia ninguna.';
  } else {
    btnRec.hidden = true;
    msg.textContent = 'Las versiones anteriores no traen ninguna cotización que no tengás ya. '
      + 'Es lo que pasa cuando el respaldo alcanzó a pisarlas todas antes del arreglo.';
  }

  const filas = R.versiones.map(function (v) {
    if (!v.ok) {
      return '<tr><td>' + _esc(_fechaLarga(v.rev.modifiedTime)) + '</td>'
        + '<td class="num">—</td><td class="warn">no se pudo leer</td></tr>';
    }
    return '<tr><td>' + _esc(_fechaLarga(v.rev.modifiedTime)) + '</td>'
      + '<td class="num">' + v.hist.length + '</td>'
      + '<td>' + _esc(_mesesTexto(v.hist)) + '</td></tr>';
  }).join('');

  _r('tablaVersiones').innerHTML = filas;
  _r('versionesNum').textContent = R.versiones.length;
}

// ---------------------------------------------------------------------
// Recuperar
// ---------------------------------------------------------------------

async function recuperar() {
  const btn  = _r('btnRecuperar');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Recuperando…';

  try {
    const antes = loadHistory().length;

    // FUSIÓN, no reemplazo: la unión conserva todo lo que ya había.
    let union = ensureHistoryIds();
    R.versiones.forEach(function (v) {
      if (v.ok) union = mergeHistories(union, v.hist, Infinity);
    });
    replaceHistory(union);

    const ahora   = loadHistory().length;
    const sumadas = ahora - antes;

    // Consolidar en Drive: desde el arreglo el respaldo ya no recorta, así que
    // esto deja la versión completa como la actual.
    _setPaso('Guardando el respaldo consolidado en tu Drive…', true);
    try {
      driveEnable();
      driveResetAuto();
      await driveBackup();
    } catch (e) {
      console.warn('[rescate] no se pudo consolidar en Drive:', e);
      showToast('Recuperé las cotizaciones en este navegador, pero no pude actualizar el respaldo. Entrá a Configuración y tocá "Sincronizar ahora".', 'error');
    }
    _setPaso('', false);

    pintarEstadoActual();
    _r('exito').hidden = false;
    _r('exitoTxt').textContent =
      'Recuperé ' + _plural(sumadas) + '. '
      + 'Tu control quedó con ' + ahora + ' en total: ' + _mesesTexto(loadHistory()) + '.';

    R.recuperables = [];
    btn.hidden = true;
    _r('recMsg').textContent = 'Listo. Ya podés volver al cotizador y verlas en Historial y en Estadísticas.';
    showToast('Recuperé ' + _plural(sumadas) + '.', 'success');

  } catch (e) {
    console.error('[rescate] recuperar:', e);
    showToast('No se pudo recuperar: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {
  // El perfil del agente manda sobre los defaults de CFG: sin esto la página
  // usaría el nombre y la licencia del dueño de la app.
  if (typeof applyProfile === 'function' && typeof loadProfile === 'function') {
    applyProfile(loadProfile());
  }
  pintarEstadoActual();
  _r('btnBuscar').addEventListener('click', buscarVersiones);
  _r('btnRecuperar').addEventListener('click', recuperar);
});
