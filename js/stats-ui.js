/**
 * Cotizador SDI · Pestaña de estadísticas (modal 📊)
 *
 * Solo render y handlers de UI. La capa de datos —métricas, agrupación por mes,
 * purga, cierres por póliza— vive en history.js y es pura: acá no se calcula
 * nada que valga la pena testear aparte del HTML que se pinta.
 *
 * Se separó de app.js el 9 set 2026, en la revisión de calidad: app.js tenía más
 * de 1400 líneas y seis responsabilidades sin relación entre sí (respaldo en
 * Drive, historial, estadísticas, flujo del wizard, render y helpers). El 📊 era
 * el corte más limpio porque no depende del flujo de cotización.
 *
 * Lleva su propio `_esc` en lugar de usar el `_escapeHtml` de app.js — mismo
 * criterio que email-marca.js con `_escMarca`: el módulo no depende de quién se
 * cargue antes y se puede probar en Node sin montar toda la app.
 *
 * Orden de carga: después de history.js, antes de app.js (que engancha los
 * botones del rail).
 */

/** Escapa texto para insertarlo como HTML. Local a propósito (ver cabecera). */
function _esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STATS_HIGH_THRESHOLD = 10000000; // ₡10M: umbral de "alto valor" para seguimiento

var _statsMonth  = null;    // clave YYYY-MM activa, o null = todas
var _statsFilter = 'all';   // 'all' | 'high' (≥₡10M) | 'followup' (>3d sin confirmar, vigente)
var _statsSearch = '';      // texto de búsqueda por placa / cliente (vacío = sin filtro)

function openStatsModal() {
  _statsMonth  = null;
  _statsFilter = 'all';
  _statsSearch = '';
  const inp = document.getElementById('statsSearch');
  if (inp) inp.value = '';
  const clr = document.getElementById('statsSearchClear');
  if (clr) clr.hidden = true;
  renderStats();
  document.getElementById('statsModal').classList.add('active');
  // Foco al buscador: el caso típico es abrir 📊 para encontrar una cotización ya.
  if (inp) inp.focus();
}

function closeStatsModal() {
  document.getElementById('statsModal').classList.remove('active');
}


/**
 * Aplica los filtros activos del 📊 sobre las cotizaciones vivas.
 * Orden: mes → chip → búsqueda. Al final, las más recientes primero.
 * @param {Array<object>} entries
 * @returns {Array<object>}
 */
function _applyStatsFilters(entries) {
  let arr = entries.slice();
  if (_statsMonth) {
    arr = arr.filter(function (e) { return historyMonthKey(e) === _statsMonth; });
  }
  if (_statsFilter === 'high') {
    arr = arr.filter(function (e) { return historyEntryValue(e) >= STATS_HIGH_THRESHOLD; });
  } else if (_statsFilter === 'poliza') {
    arr = arr.filter(function (e) { return historyTienePoliza(e); });
  }
  if (_statsSearch) {
    arr = arr.filter(function (e) { return historyMatchesSearch(e, _statsSearch); });
  }
  return arr;
}

/**
 * Repinta el 📊 completo con lo que hay en localStorage.
 *
 * Desde el 9 set 2026 la pantalla no tiene nada que marcar: una cotización se
 * cuenta como cerrada sola, cuando se le envía la póliza activa. A los números
 * se les suma el conteo de lo ya purgado (loadResumen) para que el histórico
 * no se desdibuje a medida que se borran las viejas.
 */
function renderStats() {
  const entries  = ensureHistoryIds().filter(function (e) { return !esTombstone(e); });
  const months   = groupHistoryByMonth(entries);
  const filtered = _applyStatsFilters(entries);

  // Los totales de arriba miran SIEMPRE todo el registro (más lo purgado), no
  // el filtro: son el tablero del negocio, no del recorte que se esté viendo.
  const resumen = loadResumen();
  const global  = { cot: 0, pol: 0 };
  Object.keys(resumen).forEach(function (k) {
    global.cot += Number(resumen[k].cot) || 0;
    global.pol += Number(resumen[k].pol) || 0;
  });

  document.getElementById('statsKpis').innerHTML    = _statsKpisHtml(computeHistoryStats(entries, global));
  document.getElementById('statsMonths').innerHTML  = _statsMonthsHtml(months);
  document.getElementById('statsFilters').innerHTML = _statsFiltersHtml();
  document.getElementById('statsList').innerHTML    = _statsListHtml(filtered);

  // Handlers que venían del 🕘. Se enganchan acá porque la lista se repinta
  // entera en cada render.
  const _hr = document.getElementById('btnStatsRestore');
  if (_hr) _hr.addEventListener('click', driveRestoreNow);

  document.getElementById('statsList').querySelectorAll('button[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const e = filtered[parseInt(btn.dataset.copy, 10)];
      if (!e || !e.guideUrl) return;
      // Se copia el link CORTO: es el que el cliente ve crudo al pegarlo.
      acortarGuia(e.guideUrl).then(function (corto) {
        navigator.clipboard.writeText(corto).then(function () {
          showToast('Link de la guía copiado.', 'success');
        }, function () {
          // Tras el await el navegador puede negar el portapapeles.
          window.prompt('Copiá el link manualmente:', corto);
        });
      });
    });
  });

  const cnt = document.getElementById('statsSearchCount');
  if (cnt) {
    cnt.textContent = _statsSearch
      ? filtered.length + (filtered.length === 1 ? ' resultado' : ' resultados')
      : '';
  }
}

/** Formatea la conversión (0-100) como porcentaje; "—" si no hay dato. */
function _fmtRate(r) {
  if (r == null) return '—';
  return (Math.round(r * 10) / 10) + '%';
}

/** ₡ en millones, corto: 12,4M */
function _fmtMillones(n) {
  if (!n) return '';
  return '₡' + (Math.round((n / 1000000) * 10) / 10).toString().replace('.', ',') + 'M';
}

/** Los tres números de arriba: cotizadas, con póliza y conversión. */
function _statsKpisHtml(s) {
  function kpi(num, label, cls) {
    return '<div class="stats-kpi' + (cls ? ' ' + cls : '') + '">'
      + '<div class="stats-kpi-num">' + num + '</div>'
      + '<div class="stats-kpi-label">' + label + '</div></div>';
  }
  return kpi(s.total, 'Cotizadas')
    + kpi(s.conPoliza, 'Con póliza emitida', 'pol')
    + '<div class="stats-kpi rate"><div class="stats-kpi-num">' + _fmtRate(s.rate) + '</div>'
    + '<div class="stats-kpi-label">Conversión</div></div>';
}

/** Barras por mes: total cotizado y, encima, la parte que llegó a póliza. */
function _statsMonthsHtml(months) {
  if (!months.length) {
    return '<div class="history-empty">Aún no hay cotizaciones registradas.</div>';
  }
  const maxTotal = months.reduce(function (mx, m) { return Math.max(mx, m.stats.total); }, 0) || 1;
  let html = months.map(function (m) {
    const pct    = Math.round((m.stats.total / maxTotal) * 100);
    const pctPol = Math.round((m.stats.conPoliza / maxTotal) * 100);
    const active = (_statsMonth === m.key) ? ' active' : '';
    return '<div class="stats-month' + active + '" data-month-key="' + _esc(m.key) + '">'
      + '<div class="stats-month-label">' + _esc(m.label) + '</div>'
      + '<div class="stats-month-bar-wrap">'
        + '<div class="stats-month-bar" style="width:' + pct + '%"></div>'
        + '<div class="stats-month-bar pol" style="width:' + pctPol + '%"></div>'
      + '</div>'
      + '<div class="stats-month-meta">' + m.stats.total + ' cot &middot; '
        + '<b class="pol-txt">' + m.stats.conPoliza + ' con póliza</b>'
        + (m.stats.rate != null ? ' &middot; ' + _fmtRate(m.stats.rate) : '')
      + '</div></div>';
  }).join('');
  if (_statsMonth) {
    html += '<button class="stats-chip" data-month-clear="1" style="align-self:flex-start;margin-top:2px;">↺ Ver todos los meses</button>';
  }
  return html;
}

function _statsFiltersHtml() {
  function chip(val, label) {
    return '<button class="stats-chip' + (_statsFilter === val ? ' active' : '') + '" data-filter="' + val + '">' + label + '</button>';
  }
  return chip('all', 'Todas')
    + chip('high', '⭐ Alto valor ≥₡10M')
    + chip('poliza', '✓ Con póliza');
}

/**
 * Una fila por cotización. Sin selector de estado ni fecha de cita: la única
 * marca es "✓ Póliza emitida", y la pone la app cuando se envía la póliza.
 */
function _statsListHtml(entries) {
  if (!entries.length) {
    // Con el registro entero vacío se ofrece restaurar: es el caso de haber
    // limpiado el navegador. Lo traía el 🕘 y no se puede perder.
    const vacioDeVerdad = !_statsMonth && _statsFilter === 'all' && !_statsSearch;
    if (!vacioDeVerdad) {
      return '<div class="history-empty">No hay cotizaciones para este filtro.</div>';
    }
    return '<div class="history-empty">Aún no has enviado cotizaciones desde este navegador.</div>'
      + '<div style="margin-top:14px;text-align:center;">'
        + '<p style="margin:0 0 8px;font-size:12px;color:var(--gray-500,#64748b);">'
          + '¿Ya usabas la app antes o limpiaste este navegador? Recuperá tu control desde tu Google Drive:</p>'
        + '<button class="btn btn-secondary" id="btnStatsRestore" type="button">☁️ Restaurar de Drive</button>'
      + '</div>';
  }
  return entries.map(function (e, i) {
    const cerrada = historyTienePoliza(e);
    const value   = historyEntryValue(e);
    const elapsed = historyDaysSince(e);
    const sent    = e.date ? new Date(e.date) : null;
    const fecha   = sent ? sent.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
    const id      = _esc(e.id || '');
    const placa   = historyEntryPlate(e);

    // La vigencia venía del 🕘: una cotización del INS vale 15 días. Se fundió
    // en la misma marca en vez de sumar una segunda insignia.
    let marca;
    if (cerrada) {
      marca = '<span class="history-badge pol" title="Se le envió la póliza activa">✓ Póliza emitida</span>';
    } else if (elapsed == null) {
      marca = '<span class="history-badge esp">Sin póliza</span>';
    } else if (elapsed < 15) {
      const quedan = 15 - elapsed;
      marca = '<span class="history-badge esp" title="La cotización del INS vale 15 días">Sin póliza &middot; vence en '
            + quedan + ' d</span>';
    } else {
      marca = '<span class="history-badge off" title="Pasaron los 15 días que vale la cotización del INS">Cotización vencida</span>';
    }

    const meta = [
      placa ? _esc(placa) : '',
      e.vehicle ? _esc(e.vehicle) : '',
      value ? (value >= STATS_HIGH_THRESHOLD ? '⭐ ' : '') + _fmtMillones(value) : '',
      // El número de póliza ya venía guardado del envío; mostrarlo evita tener
      // que ir a buscarlo al correo.
      e.poliza ? 'póliza ' + _esc(e.poliza) : '',
      // Este cliente nunca cotizó por la app: entró al registro por el envío de
      // su póliza. Sin esta marca, su fecha se lee como fecha de cotización.
      e.origen === 'poliza' ? 'sin cotización previa' : ''
    ].filter(Boolean).join(' &middot; ');

    // El correo va en su propia línea (como en el 🕘): metido en la meta empujaba
    // la placa y el vehículo fuera del ancho de la fila.
    const mail = e.email
      ? '<div class="stat-mail">' + _esc(e.email) + '</div>'
      : '';

    // 🔴 El 💬 manda el mensaje de SEGUIMIENTO de una cotización ("¿tuvo chance
    // de revisarla?"). A quien ya tiene la póliza emitida eso no se le puede
    // decir, así que en esas filas el botón no aparece.
    const wa = cerrada ? ''
      : '<a class="history-btn" href="' + _esc(buildWaFollowUpUrl(e)) + '" target="_blank" rel="noopener" title="Escribirle por WhatsApp">💬</a>';

    // 🔗 y 📄 venían del 🕘: abrir la guía del cliente y copiar su enlace.
    const guia = e.guideUrl
      ? '<a class="history-btn" href="' + _esc(e.guideUrl) + '" target="_blank" rel="noopener" title="Abrir la guía explicada">🔗</a>'
        + '<button class="history-btn" data-copy="' + i + '" title="Copiar el enlace de la guía">📄</button>'
      : '';

    return '<div class="stat-row' + (cerrada ? ' con-poliza' : '') + '">'
      + '<div class="stat-fecha">' + _esc(fecha) + '</div>'
      + '<div class="stat-main">'
        + '<div class="stat-cli">' + _esc(historyClientName(e) || '(sin nombre)') + '</div>'
        + '<div class="stat-meta">' + meta + '</div>'
        + mail
      + '</div>'
      + '<div class="stat-marca">' + marca + '</div>'
      + '<div class="stat-acc">'
        + guia
        + wa
        + '<button class="history-btn danger" data-del="' + id + '" title="Eliminar del registro">🗑</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function _onStatsMonthClick(e) {
  if (e.target.closest('[data-month-clear]')) { _statsMonth = null; renderStats(); return; }
  const el = e.target.closest('.stats-month');
  if (!el) return;
  const key = el.dataset.monthKey;
  _statsMonth = (_statsMonth === key) ? null : key;
  renderStats();
}

function _onStatsFilterClick(e) {
  const chip = e.target.closest('.stats-chip');
  if (!chip) return;
  _statsFilter = chip.dataset.filter || 'all';
  renderStats();
}

/** Búsqueda por placa / cliente — se dispara en cada tecla (input estático). */
function _onStatsSearch(ev) {
  _statsSearch = (ev.target.value || '').trim();
  const clr = document.getElementById('statsSearchClear');
  if (clr) clr.hidden = !_statsSearch;
  renderStats();
}

/** Limpia el buscador (botón ✕ o tecla Escape) y devuelve el foco al input. */
function _clearStatsSearch() {
  _statsSearch = '';
  const inp = document.getElementById('statsSearch');
  if (inp) { inp.value = ''; inp.focus(); }
  const clr = document.getElementById('statsSearchClear');
  if (clr) clr.hidden = true;
  renderStats();
}

function _onStatsListClick(e) {
  // Eliminar registro (prueba/duplicado) — con confirmación, es permanente.
  const del = e.target.closest('[data-del]');
  if (del) {
    const entry = loadHistory().find(function (x) { return x && x.id === del.dataset.del; });
    const quien = historyClientName(entry) || 'este registro';
    if (confirm('¿Eliminar el registro de ' + quien + '?\nEsta acción no se puede deshacer.')) {
      deleteHistoryEntry(del.dataset.del);
      showToast('Registro eliminado.', 'success');
      renderStats();
    }
    return;
  }
}

// Export para tests en Node (tests/test-stats-ui.js). En el navegador no existe
// `module`, así que este bloque se ignora.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _applyStatsFilters: _applyStatsFilters,
    _statsKpisHtml: _statsKpisHtml,
    _statsMonthsHtml: _statsMonthsHtml,
    _statsFiltersHtml: _statsFiltersHtml,
    _statsListHtml: _statsListHtml,
    _fmtRate: _fmtRate,
    _fmtMillones: _fmtMillones,
    _esc: _esc,
    STATS_HIGH_THRESHOLD: STATS_HIGH_THRESHOLD
  };
}
