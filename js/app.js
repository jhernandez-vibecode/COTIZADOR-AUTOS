/**
 * Cotizador SDI · Orquestacion principal
 *
 * Conecta TODO: drop zone, navegacion entre vistas, populate de formularios,
 * vista previa en vivo del correo, descarga del PDF limpio y envio final
 * por Gmail. Es el ultimo modulo que se carga.
 *
 * Eventos cableados al cargar el DOM:
 *   - Drop zone + file input (vista 1)
 *   - Botones Continuar/Volver entre vistas
 *   - Boton descargar PDF limpio
 *   - Inputs del correo con debounce de 300ms para vista previa
 *   - Boton enviar (autorizar Gmail + enviar)
 *   - Boton reset (vista 4 -> vista 1)
 *
 * El token de Gmail se cachea en S.accessToken por 1h: el primer envio
 * abre el popup de Google, los siguientes en la misma sesion son silenciosos.
 */

document.addEventListener('DOMContentLoaded', function () {

  // ============ VISTA 1 · Drop zone + file input ============
  const dropZone  = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  ['dragover', 'dragenter'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  // ============ VISTA 2 · Navegacion + descarga PDF ============
  document.getElementById('btnBack2').addEventListener('click', function () {
    if (confirm('Volver al inicio? Se perdera el PDF cargado.')) {
      resetAll();
      showView(1);
    }
  });

  document.getElementById('btnNext2').addEventListener('click', function () {
    if (validateView2()) {
      _syncDataFromView2();
      populateView3();
      showView(3);
    }
  });

  document.getElementById('btnDownloadPDF').addEventListener('click', downloadPDF);

  // ============ VISTA 3 · Navegacion + preview live + enviar ============
  document.getElementById('btnBack3').addEventListener('click', function () {
    showView(2);
  });

  document.getElementById('btnSend').addEventListener('click', handleSend);

  // Inputs que actualizan la vista previa con debounce
  ['m-name', 'm-vehicle', 'm-note', 'm-subject'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', schedulePreview);
  });

  // Toggle "vehiculo electrico" — actualiza preview al cambiar
  document.getElementById('f-electric').addEventListener('change', schedulePreview);
  document.getElementById('f-asia').addEventListener('change', schedulePreview);
  document.getElementById('f-gama').addEventListener('change', schedulePreview);

  // ============ VISTA 4 · Reset + compartir WhatsApp ============
  document.getElementById('btnReset').addEventListener('click', function () {
    resetAll();
    showView(1);
  });

  // Al escribir el WhatsApp del cliente, regenerar el link del boton
  // (directo al chat si hay numero; selector si queda vacio).
  document.getElementById('m-wa-cliente').addEventListener('input', function () {
    if (!S.lastEntry) return;
    const waBtn = document.getElementById('btnWhatsApp');
    if (waBtn) waBtn.href = buildWaShareUrl(S.lastEntry, this.value);
  });

  // Al compartir, persistir el numero en el historial para que el modal 🕘
  // tambien abra el chat directo. Es sincrono: corre antes de abrir WhatsApp.
  document.getElementById('btnWhatsApp').addEventListener('click', function () {
    const wa = document.getElementById('m-wa-cliente').value.trim();
    if (wa) setLatestHistoryWa(wa);
  });

  // ============ MODAL DE CONFIGURACION DEL AGENTE ============
  document.getElementById('btnSettings').addEventListener('click', function () {
    openProfileModal(false);
  });
  document.getElementById('btnProfileClose').addEventListener('click', closeProfileModal);
  document.getElementById('btnProfileCancel').addEventListener('click', closeProfileModal);
  document.getElementById('btnProfileSave').addEventListener('click', handleProfileSave);
  // Borrar perfil: util en computadoras compartidas. Recarga para volver
  // al estado de primera configuracion.
  document.getElementById('btnProfileDelete').addEventListener('click', function () {
    if (confirm('¿Borrar tus datos de agente de este navegador? Tendras que configurarlos de nuevo.')) {
      clearProfile();
      location.reload();
    }
  });

  // ============ MODAL DE HISTORIAL DE ENVIOS ============
  document.getElementById('btnHistory').addEventListener('click', openHistoryModal);
  document.getElementById('btnHistoryClose').addEventListener('click', closeHistoryModal);
  document.getElementById('btnHistoryExit').addEventListener('click', closeHistoryModal);
  document.getElementById('btnHistoryClear').addEventListener('click', function () {
    if (confirm('¿Borrar todo el historial de cotizaciones enviadas?')) {
      clearHistory();
      renderHistory();
      showToast('Historial borrado.', 'success');
    }
  });

  // ============ PESTAÑA DE ESTADÍSTICAS (📊) ============
  document.getElementById('btnStats').addEventListener('click', openStatsModal);
  document.getElementById('btnStatsClose').addEventListener('click', closeStatsModal);
  document.getElementById('btnStatsExit').addEventListener('click', closeStatsModal);
  // Delegacion: los contenedores siempre existen, los hijos se repintan.
  document.getElementById('statsMonths').addEventListener('click', _onStatsMonthClick);
  document.getElementById('statsFilters').addEventListener('click', _onStatsFilterClick);
  document.getElementById('statsList').addEventListener('change', _onStatsListChange);
  document.getElementById('statsList').addEventListener('click', _onStatsListClick);
  // Buscador por placa / cliente (input estático: el listener se registra una vez).
  const _statsSearchInput = document.getElementById('statsSearch');
  if (_statsSearchInput) {
    _statsSearchInput.addEventListener('input', _onStatsSearch);
    _statsSearchInput.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') _clearStatsSearch(); });
  }
  const _statsSearchClear = document.getElementById('statsSearchClear');
  if (_statsSearchClear) _statsSearchClear.addEventListener('click', _clearStatsSearch);

  // ============ AVISO DE SEGUIMIENTOS PENDIENTES (al inicio) ============
  document.getElementById('btnAvisoSendAll').addEventListener('click', sendAllFollowUps);
  document.getElementById('btnAvisoLater').addEventListener('click', snoozeAvisoToday);
  document.getElementById('btnAvisoClose').addEventListener('click', snoozeAvisoToday);
  document.getElementById('btnAvisoStats').addEventListener('click', function () {
    closeAvisoModal();
    openStatsModal();
  });
  document.getElementById('avisoList').addEventListener('click', _onAvisoListClick);
  document.getElementById('avisoCitas').addEventListener('click', _onAvisoCitasClick);

  // ============ CARGAR PERFIL DEL AGENTE ============
  // Si hay perfil guardado en localStorage, lo aplicamos sobre CFG.
  // Si NO hay (primer uso en este navegador), abrimos el modal forzando configurar.
  const savedProfile = loadProfile();
  if (savedProfile) {
    applyProfile(savedProfile);
    // Aviso al inicio (citas de hoy + seguimientos +3d). Solo con perfil
    // configurado; pequeño delay para no chocar con el render inicial.
    setTimeout(maybeShowAviso, 400);
  } else {
    openProfileModal(true);
  }

  // ============ Inicializar GIS cuando este disponible ============
  _tryInitTokenClient();
});

/**
 * Abre el modal de configuracion del agente.
 * @param {boolean} firstTime - true si es el primer uso (mostrar hint amarillo + bloquear cancelar)
 */
function openProfileModal(firstTime) {
  const modal = document.getElementById('profileModal');
  const hint  = document.getElementById('profileHint');
  const btnCancel = document.getElementById('btnProfileCancel');
  const btnClose  = document.getElementById('btnProfileClose');
  const btnDelete = document.getElementById('btnProfileDelete');
  // Sin perfil guardado no hay nada que borrar
  if (btnDelete) btnDelete.style.display = firstTime ? 'none' : '';

  // Pre-llenar con valores actuales de CFG (default o perfil cargado)
  document.getElementById('p-name').value     = CFG.FROM_NAME  || '';
  document.getElementById('p-email').value    = CFG.FROM_EMAIL || '';
  document.getElementById('p-phone').value    = CFG.PHONE      || '';
  document.getElementById('p-whatsapp').value = CFG.WHATSAPP   || '';
  document.getElementById('p-license').value  = CFG.LICENSE    || '';
  document.getElementById('p-website').value  = CFG.WEBSITE    || '';
  document.getElementById('p-agenda').value   = CFG.AGENDA_URL || '';
  // Envío de pólizas activas (links del correo "Póliza Activa")
  var pAssist = document.getElementById('p-assist');
  var pXViaje = document.getElementById('p-xsell-viaje');
  var pXEst   = document.getElementById('p-xsell-estudiantil');
  if (pAssist) pAssist.value = CFG.ASSIST_URL            || '';
  if (pXViaje) pXViaje.value = CFG.XSELL_VIAJE_URL       || '';
  if (pXEst)   pXEst.value   = CFG.XSELL_ESTUDIANTIL_URL || '';

  if (firstTime) {
    hint.textContent = 'Bienvenido. Antes de empezar, configura tus datos como agente. Solo se guardan en este navegador.';
    hint.classList.add('first-time');
    btnCancel.style.display = 'none';
    btnClose.style.display  = 'none';
  } else {
    hint.textContent = 'Personaliza tus datos. Aparecerán en el correo y el PDF que reciba el cliente.';
    hint.classList.remove('first-time');
    btnCancel.style.display = '';
    btnClose.style.display  = '';
  }

  modal.classList.add('active');
  setTimeout(function () { document.getElementById('p-name').focus(); }, 100);
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// =====================================================================
// HISTORIAL DE ENVIOS (modal 🕘)
// =====================================================================

function openHistoryModal() {
  renderHistory();
  document.getElementById('historyModal').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('active');
}

/**
 * Pinta la lista del historial. La cotizacion INS vale 15 dias —
 * cada fila muestra cuantos dias le quedan.
 */
function renderHistory() {
  const list = document.getElementById('historyList');
  const entries = loadHistory();

  if (!entries.length) {
    list.innerHTML = '<div class="history-empty">Aún no has enviado cotizaciones desde este navegador.</div>';
    return;
  }

  list.innerHTML = entries.map(function (e, i) {
    const sent = new Date(e.date);
    const daysLeft = 15 - Math.floor((Date.now() - sent.getTime()) / 86400000);
    const badge = daysLeft > 0
      ? '<span class="history-badge ok">Vigente · ' + daysLeft + 'd</span>'
      : '<span class="history-badge off">Vencida</span>';
    const fecha = sent.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
    return '<div class="history-item">' +
      '<div class="history-main">' +
        '<div class="history-title">' + _escapeHtml(e.client || '(sin nombre)') +
          (e.plate ? ' · ' + _escapeHtml(e.plate) : '') + ' ' + badge + '</div>' +
        '<div class="history-meta">' + fecha + ' · ' + _escapeHtml(e.email || '') +
          (e.vehicle ? ' · ' + _escapeHtml(e.vehicle) : '') + '</div>' +
      '</div>' +
      '<div class="history-actions">' +
        '<a class="history-btn" href="' + _escapeHtml(e.guideUrl || '#') + '" target="_blank" rel="noopener" title="Abrir la guía explicada">🔗</a>' +
        '<button class="history-btn" data-copy="' + i + '" title="Copiar link de la guía">📄</button>' +
        '<a class="history-btn" href="' + _escapeHtml(buildWaShareUrl(e)) + '" target="_blank" rel="noopener" title="Compartir por WhatsApp">💬</a>' +
      '</div>' +
    '</div>';
  }).join('');

  // Botones de copiar (delegado simple por data-copy)
  list.querySelectorAll('button[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const e = entries[parseInt(btn.dataset.copy, 10)];
      if (!e || !e.guideUrl) return;
      navigator.clipboard.writeText(e.guideUrl).then(function () {
        showToast('Link de la guía copiado.', 'success');
      }, function () {
        showToast('No se pudo copiar el link.', 'error');
      });
    });
  });
}

// =====================================================================
// PESTAÑA DE ESTADISTICAS (modal 📊)
// =====================================================================
// La capa de datos (ids, confirmada, valor, metricas, agrupacion por mes)
// vive en history.js. Aca solo va el render y los handlers de UI.

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

/** Aplica los filtros activos (mes y/o alto valor) a un set de cotizaciones. */
/** Orden de embudo para la lista: concretadas arriba, luego agendadas, pendientes, desechadas. */
function _estadoOrden(e) {
  const st = historyEstado(e);
  return st === 'concretada' ? 0 : st === 'agendada' ? 1 : st === 'pendiente' ? 2 : 3;
}

function _applyStatsFilters(entries) {
  var arr = Array.isArray(entries) ? entries.slice() : [];
  if (_statsMonth) {
    arr = arr.filter(function (e) { return historyMonthKey(e) === _statsMonth; });
  }
  if (_statsFilter === 'high') {
    arr = arr.filter(function (e) { return historyEntryValue(e) >= STATS_HIGH_THRESHOLD; });
  } else if (_statsFilter === 'followup') {
    arr = arr.filter(function (e) { return historyNeedsFollowUp(e); });
  }
  // Búsqueda por placa / cliente (se combina con los filtros anteriores).
  if (_statsSearch) {
    arr = arr.filter(function (e) { return historyMatchesSearch(e, _statsSearch); });
  }
  // Orden de embudo: Concretada → Agendada → Pendiente → Desechada. Dentro de
  // agendadas, la cita más próxima primero; en el resto se mantiene el orden
  // existente (más reciente primero, por el sort estable de JS).
  arr.sort(function (a, b) {
    const oa = _estadoOrden(a), ob = _estadoOrden(b);
    if (oa !== ob) return oa - ob;
    if (oa === 1) {  // agendadas: por fecha de cita ascendente (la más próxima primero)
      const ca = String(a.citaFecha || '9999-99-99'), cb = String(b.citaFecha || '9999-99-99');
      if (ca !== cb) return ca < cb ? -1 : 1;
    }
    return 0;
  });
  return arr;
}

/** Repinta TODO (resumen + meses + filtros + lista) según el estado actual. */
function renderStats() {
  const entries  = ensureHistoryIds();          // garantiza ids (migra viejas)
  const months   = groupHistoryByMonth(entries);
  const filtered  = _applyStatsFilters(entries);

  document.getElementById('statsKpis').innerHTML    = _statsKpisHtml(computeHistoryStats(filtered));
  document.getElementById('statsMonths').innerHTML  = _statsMonthsHtml(months);
  document.getElementById('statsFilters').innerHTML = _statsFiltersHtml();
  document.getElementById('statsList').innerHTML    = _statsListHtml(filtered);

  // Contador de coincidencias (solo cuando hay búsqueda activa). El input es
  // estático — renderStats NO lo toca, así no se pierde el foco al teclear.
  const cnt = document.getElementById('statsSearchCount');
  if (cnt) {
    cnt.textContent = _statsSearch
      ? (filtered.length + (filtered.length === 1 ? ' coincidencia' : ' coincidencias'))
      : '';
  }
}

// ---------- Formateadores ----------

function _fmtRate(r) {
  return (r == null) ? '—' : (String(r).replace('.', ',') + ' %');
}

/** Fecha de HOY en formato YYYY-MM-DD (local), para <input type="date">. */
function _todayISODate() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 14500000 → "₡14,5M" · 22000000 → "₡22M" (es-CR, coma decimal). */
function _fmtMillones(n) {
  if (!n) return '';
  const m = Math.round((n / 1e6) * 10) / 10;
  return '₡' + String(m).replace('.', ',') + 'M';
}

// ---------- Plantillas HTML ----------

function _statsKpisHtml(s) {
  function kpi(num, label) {
    return '<div class="stats-kpi"><div class="stats-kpi-num">' + num + '</div><div class="stats-kpi-label">' + label + '</div></div>';
  }
  return kpi(s.total, 'Enviadas')
    + kpi(s.agendada, 'Agendadas')
    + kpi(s.concretada, 'Concretadas')
    + kpi(s.desechada, 'Desechadas')
    + '<div class="stats-kpi rate"><div class="stats-kpi-num">' + _fmtRate(s.rate) + '</div><div class="stats-kpi-label">Conversión</div></div>';
}

function _statsMonthsHtml(months) {
  if (!months.length) {
    return '<div class="history-empty">Aún no hay cotizaciones registradas.</div>';
  }
  const maxTotal = months.reduce(function (mx, m) { return Math.max(mx, m.stats.total); }, 0) || 1;
  let html = months.map(function (m) {
    const pct    = Math.round((m.stats.total / maxTotal) * 100);
    const active = (_statsMonth === m.key) ? ' active' : '';
    return '<div class="stats-month' + active + '" data-month-key="' + _escapeHtml(m.key) + '">'
      + '<div class="stats-month-label">' + _escapeHtml(m.label) + '</div>'
      + '<div class="stats-month-bar-wrap"><div class="stats-month-bar" style="width:' + pct + '%"></div></div>'
      + '<div class="stats-month-meta">' + m.stats.total + ' cot &middot; <b title="Concretadas">' + m.stats.concretada + ' concr.</b>'
        + (m.stats.rate != null ? ' &middot; ' + _fmtRate(m.stats.rate) : '') + '</div>'
      + '</div>';
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
    + chip('followup', '⏳ Para seguir (+3 d)');
}

function _statsListHtml(entries) {
  if (!entries.length) {
    return '<div class="history-empty">No hay cotizaciones para este filtro.</div>';
  }
  const ESTADOS = [['pendiente', 'Pendiente'], ['agendada', 'Agendada'], ['concretada', 'Concretada'], ['desechada', 'Desechada']];
  return entries.map(function (e) {
    const estado  = historyEstado(e);
    const value   = historyEntryValue(e);
    const high    = value >= STATS_HIGH_THRESHOLD;
    const elapsed = historyDaysSince(e);
    const sent    = e.date ? new Date(e.date) : null;
    const fecha   = sent ? sent.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
    const ago     = (elapsed == null) ? '' : (elapsed === 0 ? 'hoy' : elapsed === 1 ? 'ayer' : 'hace ' + elapsed + ' d');
    const id      = _escapeHtml(e.id || '');

    // Insignias según el estado del ciclo de vida
    let badges = '';
    if (estado === 'pendiente') {
      const daysLeft = (elapsed == null) ? -1 : 15 - elapsed;
      badges += (daysLeft > 0)
        ? '<span class="history-badge ok">Vigente &middot; ' + daysLeft + 'd</span>'
        : '<span class="history-badge off">Vencida</span>';
      const fuState = historyFollowUpState(e);
      if (fuState === 'seguir')  badges += ' <span class="history-badge fu" title="Vigente +3 días sin respuesta — conviene seguimiento">⏳ seguir</span>';
      else if (fuState === 'seguido') badges += ' <span class="history-badge seguido" title="Ya se le envió el seguimiento">✓ seguido</span>';
    } else if (estado === 'agendada' && historyCitaHoy(e)) {
      badges += '<span class="history-badge cita" title="La cita es hoy">📅 cita hoy</span>';
    }

    // Selector de estado + (si agendada) fecha de la cita
    const opts = ESTADOS.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === estado ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    const sel = '<select class="estado-select estado-' + estado + '" data-estado="' + id + '" aria-label="Estado de la cotización">' + opts + '</select>';
    const citaInput = (estado === 'agendada')
      ? '<label class="cita-wrap"><span class="cita-lbl">Cita:</span><input type="date" class="cita-date" data-cita="' + id + '" value="' + _escapeHtml(String(e.citaFecha || '').slice(0, 10)) + '" aria-label="Fecha de la cita" title="Fecha de la cita" /></label>'
      : '';

    return '<div class="stat-item estado-' + estado + (high ? ' high' : '') + '">'
      + '<div class="stat-main">'
        + '<div class="stat-title">'
          + (high ? '<span class="stat-star" title="Carro de alto valor (≥₡10M)">⭐</span>' : '')
          + _escapeHtml(e.client || '(sin nombre)')
          + (e.plate ? ' &middot; ' + _escapeHtml(e.plate) : '')
          + (value ? ' <span class="stat-value">' + _fmtMillones(value) + '</span>' : '')
          + (badges ? ' ' + badges : '')
        + '</div>'
        + '<div class="stat-meta">' + (ago ? '<b class="stat-ago">' + ago + '</b>' : '') + (ago && fecha ? ' &middot; ' : '') + fecha
          + (e.vehicle ? ' &middot; ' + _escapeHtml(e.vehicle) : '')
          + (e.email ? ' &middot; ' + _escapeHtml(e.email) : '')
        + '</div>'
      + '</div>'
      + '<div class="stat-actions">'
        + citaInput
        + sel
        + '<a class="history-btn" href="' + _escapeHtml(buildWaFollowUpUrl(e)) + '" target="_blank" rel="noopener" title="WhatsApp de seguimiento">💬</a>'
        + '<button class="history-btn" data-mail="' + id + '" title="Enviar correo de seguimiento">✉️</button>'
        + '<button class="history-btn danger" data-del="' + id + '" title="Eliminar este registro">🗑</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

// ---------- Handlers (delegados) ----------

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

function _onStatsListChange(e) {
  // Cambio de estado (Pendiente/Agendada/Concretada/Desechada)
  const sel = e.target.closest('.estado-select');
  if (sel) {
    const id = sel.dataset.estado;
    const nuevo = sel.value;
    let cita;
    if (nuevo === 'agendada') {
      const entry = loadHistory().find(function (x) { return x && x.id === id; });
      cita = (entry && entry.citaFecha) || _todayISODate();  // por defecto hoy; editable
    }
    // renderStats() reconstruye toda la lista → guardamos scroll y devolvemos el foco.
    const modal = document.getElementById('statsModal');
    const prevScroll = modal ? modal.scrollTop : 0;
    setHistoryEstado(id, nuevo, cita);
    renderStats();  // cambia color, muestra/oculta la fecha de cita y actualiza los KPIs
    if (modal) modal.scrollTop = prevScroll;
    const esc = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
    if (nuevo === 'agendada') {
      // foco a la fecha recién creada para que el agente la confirme/ajuste
      const nd = document.querySelector('.cita-date[data-cita="' + esc + '"]');
      if (nd) { nd.focus(); if (nd.showPicker) { try { nd.showPicker(); } catch (e2) {} } }
    } else {
      const again = document.querySelector('.estado-select[data-estado="' + esc + '"]');
      if (again) again.focus();
    }
    return;
  }
  // Cambio de fecha de la cita (sin re-render para no perder el foco del input)
  const dt = e.target.closest('.cita-date');
  if (dt) {
    setHistoryEstado(dt.dataset.cita, 'agendada', dt.value || _todayISODate());
  }
}

function _onStatsListClick(e) {
  // Eliminar registro (prueba/duplicado) — con confirmación, es permanente.
  const del = e.target.closest('[data-del]');
  if (del) {
    const entry = loadHistory().find(function (x) { return x && x.id === del.dataset.del; });
    const quien = (entry && entry.client) ? entry.client : 'este registro';
    if (confirm('¿Eliminar el registro de ' + quien + '?\nEsta acción no se puede deshacer.')) {
      deleteHistoryEntry(del.dataset.del);
      showToast('Registro eliminado.', 'success');
      renderStats();
    }
    return;
  }
  // Correo de seguimiento
  const btn = e.target.closest('[data-mail]');
  if (!btn) return;
  const entry = loadHistory().find(function (x) { return x && x.id === btn.dataset.mail; });
  if (entry) sendFollowUpEmail(entry, btn);
}

/**
 * Construye y envía UN correo de seguimiento por Gmail y marca followUpAt.
 * Requiere un token ya obtenido (getToken antes). Lanza si Gmail rechaza.
 * Núcleo reutilizado por el ✉️ por fila y por el envío en lote del aviso.
 * @param {object} entry
 */
async function _sendOneFollowUp(entry) {
  // Fail-closed ante localStorage corrupto/editado a mano: no concatenar un
  // correo inválido en el header To: (mismo regex que la validación de envío).
  if (!entry || !entry.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) {
    throw new Error('Correo del destinatario inválido: ' + ((entry && entry.email) || '(vacío)'));
  }
  const html = buildFollowUpEmail({
    nombre:   entry.client,
    vehiculo: entry.vehicle,
    guideUrl: entry.guideUrl
  });
  const raw = buildMIMESimple({
    to:      entry.email,
    from:    '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>',
    subject: 'Seguimiento a su cotización' + (entry.vehicle ? ' — ' + entry.vehicle : ''),
    html:    html
  });
  await sendEmail(raw);
  setHistoryFollowUp(entry.id, new Date().toISOString());
}

/**
 * Envía el correo de seguimiento de UNA cotización (botón ✉️). Pide
 * confirmación porque dispara un envío real desde la cuenta del agente.
 * Al enviar marca followUpAt → no vuelve a aparecer en el aviso.
 * @returns {Promise<boolean>} true si se envió
 */
async function sendFollowUpEmail(entry, btn) {
  if (!entry || !entry.email) {
    showToast('Esta cotización no tiene un correo guardado.', 'error');
    return false;
  }
  if (!confirm('¿Enviar correo de seguimiento a ' + (entry.client || 'el cliente') + ' (' + entry.email + ')?')) {
    return false;
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await getToken();
    await _sendOneFollowUp(entry);
    showToast('Correo de seguimiento enviado a ' + (entry.client || entry.email) + '.', 'success');
    if (document.getElementById('statsModal').classList.contains('active')) renderStats();
    return true;
  } catch (err) {
    console.error('[seguimiento] error al enviar:', err);
    showToast('No se pudo enviar el correo: ' + err.message, 'error');
    return false;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// =====================================================================
// AVISO DE SEGUIMIENTOS PENDIENTES (al abrir la app)
// =====================================================================
// Solo a los 3 días: cotizaciones +3d, sin confirmar, vigentes y SIN
// seguimiento previo (un único seguimiento). Tras enviarlo, se desestiman.

/**
 * Cotizaciones que necesitan el (único) seguimiento ahora mismo.
 * Usa ensureHistoryIds() (NO loadHistory) para migrar ids a entradas legacy:
 * sin id, setHistoryFollowUp(undefined) marcaría la entrada equivocada y podría
 * duplicar el correo. Ordena por antigüedad desc → la más próxima a vencer arriba.
 */
function _pendingFollowUps() {
  return ensureHistoryIds()
    .filter(function (e) { return historyNeedsFollowUp(e); })
    .sort(function (a, b) { return (historyDaysSince(b) || 0) - (historyDaysSince(a) || 0); });
}

/** Cotizaciones agendadas con cita HOY (para cerrar: concretar o desechar). */
function _citasHoy() {
  return ensureHistoryIds().filter(function (e) { return historyCitaHoy(e); });
}

/** Al abrir la app: si hay citas de hoy o seguimientos pendientes, muestra el aviso. */
function maybeShowAviso() {
  // Si el agente lo pospuso hoy ("Ahora no" / cerrar), no insistir hasta mañana
  // o hasta reabrir el navegador (sessionStorage).
  try {
    if (sessionStorage.getItem('cotizador_sdi_aviso_snooze') === new Date().toDateString()) return;
  } catch (e) { /* sessionStorage no disponible: seguimos */ }
  const citas = _citasHoy(), pend = _pendingFollowUps();
  if (!citas.length && !pend.length) return;
  renderAviso(citas, pend);
  document.getElementById('avisoModal').classList.add('active');
}

function closeAvisoModal() {
  document.getElementById('avisoModal').classList.remove('active');
}

/** Recalcula citas + pendientes; si no queda nada cierra el aviso, si no repinta. */
function _refreshAviso() {
  const citas = _citasHoy(), pend = _pendingFollowUps();
  if (!citas.length && !pend.length) { closeAvisoModal(); return; }
  renderAviso(citas, pend);
}

/** Cierra el aviso y lo pospone por hoy (para no reaparecer en cada recarga). */
function snoozeAvisoToday() {
  try { sessionStorage.setItem('cotizador_sdi_aviso_snooze', new Date().toDateString()); } catch (e) {}
  closeAvisoModal();
}

function _avisoListHtml(entries) {
  return entries.map(function (e) {
    const elapsed = historyDaysSince(e);
    const ago = (elapsed == null) ? '' : 'hace ' + elapsed + ' d';
    const id  = _escapeHtml(e.id || '');
    return '<div class="aviso-item">'
      + '<div class="aviso-main">'
        + '<div class="aviso-name">' + _escapeHtml(e.client || '(sin nombre)') + '</div>'
        + '<div class="aviso-meta">'
          + (e.vehicle ? _escapeHtml(e.vehicle) : '')
          + (e.plate ? ' &middot; ' + _escapeHtml(e.plate) : '')
          + (ago ? ' &middot; ' + ago : '')
        + '</div>'
      + '</div>'
      + '<div class="aviso-cita-btns">'
        + '<button class="history-btn" data-aviso-mail="' + id + '" title="Enviar seguimiento a este">✉️</button>'
        + '<button class="history-btn" data-seguir-no="' + id + '" title="No dar seguimiento (descartar sugerencia)">✕</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function _avisoCitasHtml(citas) {
  return citas.map(function (e) {
    const id = _escapeHtml(e.id || '');
    return '<div class="aviso-item cita">'
      + '<div class="aviso-main">'
        + '<div class="aviso-name">' + _escapeHtml(e.client || '(sin nombre)') + '</div>'
        + '<div class="aviso-meta">' + (e.vehicle ? _escapeHtml(e.vehicle) : '')
          + (e.plate ? ' &middot; ' + _escapeHtml(e.plate) : '') + '</div>'
      + '</div>'
      + '<div class="aviso-cita-btns">'
        + '<button class="aviso-mini ok" data-cita-ok="' + id + '">Concretada</button>'
        + '<button class="aviso-mini no" data-cita-no="' + id + '">Desechada</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function renderAviso(citas, pend) {
  const citasSec = document.getElementById('avisoCitasSection');
  if (citasSec) citasSec.style.display = citas.length ? '' : 'none';
  document.getElementById('avisoCitas').innerHTML = _avisoCitasHtml(citas);

  const segSec = document.getElementById('avisoSeguirSection');
  if (segSec) segSec.style.display = pend.length ? '' : 'none';
  document.getElementById('avisoList').innerHTML = _avisoListHtml(pend);

  const btnAll = document.getElementById('btnAvisoSendAll');
  if (btnAll) {
    btnAll.style.display = pend.length ? '' : 'none';
    btnAll.textContent = pend.length === 1 ? 'Enviar seguimiento' : 'Enviar seguimiento a las ' + pend.length;
  }
}

/** Envía el seguimiento a TODAS las pendientes (un permiso de Gmail). */
async function sendAllFollowUps() {
  const pend = _pendingFollowUps();
  if (!pend.length) { closeAvisoModal(); return; }
  const btn = document.getElementById('btnAvisoSendAll');
  const original = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  let ok = 0, fail = 0;
  try {
    await getToken();
  } catch (e) {
    showToast('No se pudo autorizar Gmail: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = original; }
    return;
  }
  for (let i = 0; i < pend.length; i++) {
    try {
      await _sendOneFollowUp(pend[i]);
      ok++;
    } catch (e) {
      // Token caducó/revocó a mitad del lote (sendEmail hizo clearToken). Reintentar UNA vez
      // re-autorizando, para no tumbar las filas restantes por un solo 401.
      if (typeof S !== 'undefined' && !S.accessToken) {
        try { await getToken(); await _sendOneFollowUp(pend[i]); ok++; continue; }
        catch (e2) { console.error('[aviso] reintento falló', pend[i] && pend[i].id, e2); }
      }
      console.error('[aviso] fallo envío', pend[i] && pend[i].id, e);
      fail++;
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = original; }
  showToast(ok + ' seguimiento' + (ok === 1 ? '' : 's') + ' enviado' + (ok === 1 ? '' : 's')
    + (fail ? ' · ' + fail + ' no se pudieron enviar' : '') + '.', fail ? 'error' : 'success');
  if (document.getElementById('statsModal').classList.contains('active')) renderStats();
  _refreshAviso();  // si quedan citas de hoy, el aviso sigue abierto con ellas
}

/** ✉️ por fila dentro del aviso: envía uno y refresca la lista. */
function _onAvisoListClick(e) {
  // Descartar la sugerencia (no enviar nunca seguimiento a este)
  const no = e.target.closest('[data-seguir-no]');
  if (no) {
    dismissFollowUp(no.dataset.seguirNo);
    showToast('Sugerencia de seguimiento descartada.', 'success');
    if (document.getElementById('statsModal').classList.contains('active')) renderStats();
    _refreshAviso();
    return;
  }
  const btn = e.target.closest('[data-aviso-mail]');
  if (!btn) return;
  const entry = loadHistory().find(function (x) { return x && x.id === btn.dataset.avisoMail; });
  if (!entry) return;
  sendFollowUpEmail(entry, btn).then(_refreshAviso);
}

/** Botones Concretada/Desechada de la sección "Citas de hoy" del aviso. */
function _onAvisoCitasClick(e) {
  const ok = e.target.closest('[data-cita-ok]');
  const no = e.target.closest('[data-cita-no]');
  if (!ok && !no) return;
  const id = ok ? ok.dataset.citaOk : no.dataset.citaNo;
  setHistoryEstado(id, ok ? 'concretada' : 'desechada');
  showToast(ok ? 'Marcada como concretada. ✅' : 'Marcada como desechada.', 'success');
  if (document.getElementById('statsModal').classList.contains('active')) renderStats();
  _refreshAviso();
}

/**
 * Valida y guarda el perfil del agente desde el modal.
 */
function handleProfileSave() {
  const name      = document.getElementById('p-name').value.trim();
  const email     = document.getElementById('p-email').value.trim();
  const phone     = document.getElementById('p-phone').value.trim();
  const whatsapp  = document.getElementById('p-whatsapp').value.trim();
  const license   = document.getElementById('p-license').value.trim();
  const website   = document.getElementById('p-website').value.trim();
  const agendaUrl = document.getElementById('p-agenda').value.trim();

  if (!name || name.split(/\s+/).length < 2) {
    showToast('Ingresa tu nombre completo (al menos dos palabras).', 'error');
    document.getElementById('p-name').focus();
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Ingresa un correo valido. Recuerda: debe ser el mismo de tu cuenta Gmail.', 'error');
    document.getElementById('p-email').focus();
    return;
  }
  if (!phone) {
    showToast('Ingresa tu telefono.', 'error');
    document.getElementById('p-phone').focus();
    return;
  }
  if (!license) {
    showToast('Ingresa tu numero de licencia SUGESE.', 'error');
    document.getElementById('p-license').focus();
    return;
  }
  if (!agendaUrl) {
    showToast('Ingresa el link de tu formulario de cita. Puede ser un Google Forms, Calendly o similar.', 'error');
    document.getElementById('p-agenda').focus();
    return;
  }

  // Normalizar website: quitar https:// o http:// si lo pusieron, dejar solo dominio
  const cleanWebsite = website.replace(/^https?:\/\//i, '').replace(/\/$/, '');

  // Normalizar agendaUrl: si no tiene protocolo, agregarle https://
  // (para que el link funcione en el correo)
  let cleanAgenda = agendaUrl;
  if (cleanAgenda && !/^https?:\/\//i.test(cleanAgenda)) {
    cleanAgenda = 'https://' + cleanAgenda;
  }

  // Validar formato basico del link de agenda si se puso algo
  if (cleanAgenda && !/^https?:\/\/[^\s]+\.[^\s]+/.test(cleanAgenda)) {
    showToast('El link del formulario de cita no parece valido. Ejemplo: https://forms.gle/AbCdEf123', 'error');
    document.getElementById('p-agenda').focus();
    return;
  }

  // Links de "Envío de pólizas activas" — normalizar (https:// si falta).
  // Se permiten vacíos (el agente puede no querer mostrar un cross-sell).
  const _normUrl = function (u) {
    const v = (u || '').trim();
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : 'https://' + v;
  };
  const assistUrl           = _normUrl(document.getElementById('p-assist') ? document.getElementById('p-assist').value : '');
  const xsellViajeUrl       = _normUrl(document.getElementById('p-xsell-viaje') ? document.getElementById('p-xsell-viaje').value : '');
  const xsellEstudiantilUrl = _normUrl(document.getElementById('p-xsell-estudiantil') ? document.getElementById('p-xsell-estudiantil').value : '');

  const profile = {
    name:      name,
    email:     email,
    phone:     phone,
    whatsapp:  whatsapp,
    license:   license,
    website:   cleanWebsite,
    agendaUrl: cleanAgenda,
    assistUrl:           assistUrl,
    xsellViajeUrl:       xsellViajeUrl,
    xsellEstudiantilUrl: xsellEstudiantilUrl
  };
  try {
    saveProfile(profile);
    applyProfile(profile);
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  showToast('Perfil guardado.', 'success');
  closeProfileModal();
  // Si estamos en la vista 3 (redactar), regenerar la previa con los nuevos datos
  if (S.step === 3) updatePreview();
}

// =====================================================================
// HANDLERS DE FLUJO
// =====================================================================

/**
 * Procesa un archivo seleccionado (drop o file input):
 * extrae datos, modifica el PDF, llena la vista 2 y avanza.
 */
async function handleFileSelect(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Por favor selecciona un archivo PDF.', 'error');
    return;
  }

  const wrap  = document.getElementById('progressWrap');
  const bar   = document.getElementById('progressBar');
  const label = document.getElementById('progressLabel');

  wrap.classList.add('active');
  _setProgress(bar, label, 10, 'Leyendo PDF...');

  try {
    const ab = await file.arrayBuffer();
    _setProgress(bar, label, 35, 'Extrayendo datos del PDF...');

    // Clonamos el ArrayBuffer porque PDF.js y pdf-lib lo consumen
    const ab1 = ab.slice(0);
    const ab2 = ab.slice(0);

    const data = await extractData(ab1);
    _setProgress(bar, label, 65, 'Limpiando PDF (Mensual y Deduccion)...');

    const modified = await modifyPDF(ab2, data.rowsToRemove, data.pageWidth);
    _setProgress(bar, label, 90, 'Preparando vista...');

    S.data        = data;
    S.modPDF      = modified;
    S.pdfFilename = file.name;

    populateView2();

    _setProgress(bar, label, 100, 'Listo');
    setTimeout(function () {
      wrap.classList.remove('active');
      bar.style.width = '0%';
      label.textContent = '';
      showView(2);
    }, 400);

  } catch (e) {
    console.error('Error procesando PDF:', e);
    wrap.classList.remove('active');
    bar.style.width = '0%';
    label.textContent = '';
    showToast('Error al procesar el PDF: ' + e.message, 'error');
    document.getElementById('fileInput').value = '';
  }
}

/**
 * Llena los campos de la vista 2 con los datos extraidos del PDF.
 */
function populateView2() {
  const d = S.data;
  _setVal('f-quote',   d.quoteNum);
  _setVal('f-client',  d.clientName);
  _setVal('f-plate',   d.plate);
  _setVal('f-year',    d.year);
  _setVal('f-vehicle', (_cleanVehicleType(d.vehicleType) + ' ' + d.year).trim());
  _setVal('f-valor',   '\u20A1 ' + d.valor); // ₡
  _setVal('f-forma',   d.formaAseg);
  _setVal('f-sust',    d.sustRepos);

  // Correo e Interes empiezan vacios para que el agente los llene
  document.getElementById('f-email').value   = '';
  document.getElementById('f-interes').value = '';

  _renderPriceTable();
  _renderDeductibles();
  _suggestGamaIfApplies();
}

/**
 * Si el valor asegurado extraido del PDF es >= ₡50.000.000 (umbral de
 * alta gama per Circular INS 0186-2025), muestra una sugerencia visual
 * junto al toggle 💎. NO activa el toggle — la decision es del agente.
 */
function _suggestGamaIfApplies() {
  const el = document.getElementById('gamaSuggest');
  if (!el || !S.data) return;
  const n = parseInt(String(S.data.valor || '').replace(/,/g, '').replace(/\.\d+$/, ''), 10);
  el.style.display = (!isNaN(n) && n >= 50000000) ? '' : 'none';
}

/**
 * Vuelca los campos editables de la vista 2 a S.data, para que el correo,
 * el PDF filename y el explicador usen las correcciones del agente.
 * El valor asegurado se guarda sin el simbolo ₡ que agrega populateView2.
 */
function _syncDataFromView2() {
  if (!S.data) return;
  S.data.clientName = document.getElementById('f-client').value.trim();
  S.data.plate      = document.getElementById('f-plate').value.trim();
  S.data.year       = document.getElementById('f-year').value.trim();
  S.data.valor      = document.getElementById('f-valor').value.replace(/[₡]/g, '').trim();
  S.data.formaAseg  = document.getElementById('f-forma').value.trim();
  S.data.sustRepos  = document.getElementById('f-sust').value.trim();
}

/**
 * Valida la vista 2: el correo del cliente es requerido y debe parecer valido.
 * @returns {boolean}
 */
function validateView2() {
  const email = document.getElementById('f-email').value.trim();
  if (!email) {
    showToast('El correo del cliente es requerido para enviar la cotizacion.', 'error');
    document.getElementById('f-email').focus();
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('El correo del cliente no parece valido. Verifica el formato (ejemplo: nombre@dominio.com).', 'error');
    document.getElementById('f-email').focus();
    return false;
  }
  return true;
}

/**
 * Llena los campos de la vista 3 con valores por defecto basados en la vista 2.
 */
function populateView3() {
  const d = S.data;
  const email   = document.getElementById('f-email').value.trim();
  const vehicle = document.getElementById('f-vehicle').value.trim();
  const interes = document.getElementById('f-interes').value;

  // Cachear interes para que updatePreview lo use sin re-leer del DOM de la vista anterior
  S.formData = { interes: interes };

  document.getElementById('m-to').value      = email;
  document.getElementById('m-subject').value = 'Oferta Seguro Automoviles - Placa ' + d.plate;
  document.getElementById('m-name').value    = _firstName(d.clientName);
  document.getElementById('m-vehicle').value = vehicle;
  document.getElementById('m-note').value    = '';
  document.getElementById('m-pdfname').textContent = _pdfFilename();

  updatePreview();
}

/**
 * Programa una actualizacion de la vista previa con debounce de 300ms.
 * Se llama en cada keystroke de los inputs del correo.
 */
function schedulePreview() {
  if (S.prevTimer) clearTimeout(S.prevTimer);
  S.prevTimer = setTimeout(updatePreview, 300);
}

/**
 * Lee el estado del toggle "Vehiculo electrico" en el formulario step 2.
 * Si esta marcado, el explicador mostrara la subseccion de cobertura
 * especial de bateria; si no, queda oculta.
 * @returns {boolean}
 */
function _isElectricChecked() {
  var el = document.getElementById('f-electric');
  return !!(el && el.checked);
}

function _isAsiaChecked() {
  var el = document.getElementById('f-asia');
  return !!(el && el.checked);
}

function _isGamaChecked() {
  var el = document.getElementById('f-gama');
  return !!(el && el.checked);
}

/**
 * Mismos extras que buildEmail() usa internamente para armar el URL del
 * explicador — para poder generar el MISMO link fuera del correo
 * (historial + boton de WhatsApp de la vista 4).
 */
function _guideExtras() {
  return {
    clientName:    document.getElementById('m-name').value,
    vehicle:       document.getElementById('m-vehicle').value,
    plate:         S.data.plate,
    year:          S.data.year,
    vehicleType:   _detectVehicleType(_isElectricChecked() ? 'electric' : S.data.vehicleType),
    origenAsia:    _isAsiaChecked(),
    altaGama:      _isGamaChecked(),
    valor:         S.data.valor,
    sustReposCode: _sustReposToCode(S.data.sustRepos),
    dedDFH:        S.data.dedDFH,
    prices:        S.data.prices
  };
}

/**
 * Regenera el HTML del correo y lo inyecta en el preview-box.
 * Usa un iframe con sandbox (sin scripts) para aislar el HTML del correo
 * del CSS y del contexto de la app.
 */
function updatePreview() {
  if (!S.data) return;

  const html = buildEmail({
    nombre:        document.getElementById('m-name').value,
    vehiculo:      document.getElementById('m-vehicle').value,
    prices:        S.data.prices,
    sustRepos:     S.data.sustRepos,
    interes:       S.formData ? S.formData.interes : '',
    notaAdicional: document.getElementById('m-note').value,
    plate:         S.data.plate,
    year:          S.data.year,
    valor:         S.data.valor,
    vehicleType:   _isElectricChecked() ? 'electric' : S.data.vehicleType,
    origenAsia:    _isAsiaChecked(),
    altaGama:      _isGamaChecked(),
    dedDFH:        S.data.dedDFH
  });

  const preview = document.getElementById('preview');
  preview.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.style.width  = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  // Sin allow-scripts: el correo es HTML estático, nada debe ejecutarse aquí.
  iframe.setAttribute('sandbox', 'allow-same-origin allow-popups');
  iframe.srcdoc = html;
  preview.appendChild(iframe);
}

/**
 * Maneja el click de "Autorizar Gmail y Enviar":
 * obtiene el token de Google y envia el correo via Gmail API.
 */
async function handleSend() {
  // Re-validar el destinatario: es editable en la vista 3
  const toCheck = document.getElementById('m-to').value.trim();
  if (!toCheck || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toCheck)) {
    showToast('El correo del destinatario no parece valido. Verificalo antes de enviar.', 'error');
    document.getElementById('m-to').focus();
    return;
  }

  const btn = document.getElementById('btnSend');
  const originalText = btn.textContent;
  btn.disabled = true;

  try {
    btn.textContent = 'Autorizando con Google...';
    await getToken();
    btn.textContent = 'Enviando correo...';

    const html = buildEmail({
      nombre:        document.getElementById('m-name').value,
      vehiculo:      document.getElementById('m-vehicle').value,
      prices:        S.data.prices,
      sustRepos:     S.data.sustRepos,
      interes:       S.formData ? S.formData.interes : '',
      notaAdicional: document.getElementById('m-note').value,
      plate:         S.data.plate,
      year:          S.data.year,
      valor:         S.data.valor,
      vehicleType:   _isElectricChecked() ? 'electric' : S.data.vehicleType,
      origenAsia:    _isAsiaChecked(),
      altaGama:      _isGamaChecked(),
      dedDFH:        S.data.dedDFH
    });

    const toAddr  = document.getElementById('m-to').value.trim();
    const subject = document.getElementById('m-subject').value.trim();
    const fname   = _pdfFilename();

    // Adjuntos: el PDF de cotización (sin mensual) + documentos estándar
    // (Deber de Información Autos). Best-effort: si un estándar falla, se avisa
    // pero el correo igual sale con la cotización.
    const attachments = [{ bytes: S.modPDF, filename: fname }];
    try {
      const std = await loadStdDocs(STD_DOCS.cotizacion);
      for (let i = 0; i < std.docs.length; i++) attachments.push(std.docs[i]);
      if (std.failed.length) showToast('No se pudo adjuntar: ' + std.failed.join(', '), 'error');
    } catch (e) { console.error('[cotizacion] docs estándar', e); }

    const raw = buildMIMEMulti({
      to:       toAddr,
      from:     '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>',
      subject:  subject,
      html:     html,
      attachments: attachments
    });
    await sendEmail(raw);

    // Registrar en el historial + habilitar compartir por WhatsApp.
    // Nada de esto debe poder tumbar el flujo: el correo YA salió.
    try {
      const entry = {
        id:        newHistoryId(),
        date:      new Date().toISOString(),
        client:    document.getElementById('m-name').value.trim(),
        agentName: CFG.FROM_NAME || '',
        email:     toAddr,
        plate:     S.data.plate,
        vehicle:   document.getElementById('m-vehicle').value.trim(),
        quote:     S.data.quoteNum,
        valor:     S.data.valor,      // valor asegurado → filtro de alto valor (≥₡10M)
        confirmed: false,             // el agente lo marca en la pestaña 📊 al cerrar
        guideUrl:  _buildGuideUrl(_guideExtras())
      };
      saveHistoryEntry(entry);
      S.lastEntry = entry;
      const waInput = document.getElementById('m-wa-cliente');
      const waBtn   = document.getElementById('btnWhatsApp');
      const waWrap  = document.getElementById('waShareWrap');
      if (waInput) waInput.value = '';
      if (waBtn)  waBtn.href = buildWaShareUrl(entry);
      if (waWrap) waWrap.style.display = 'flex';
    } catch (e) {
      console.warn('[history] registro post-envio fallo:', e);
    }

    document.getElementById('successMsg').textContent =
      'La cotizacion fue enviada a ' + toAddr;
    showView(4);

  } catch (e) {
    console.error('Error al enviar:', e);
    showToast('Error al enviar el correo: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Descarga el PDF modificado (sin Mensual ni Deduccion) como archivo local.
 */
function downloadPDF() {
  if (!S.modPDF) return;
  const blob = new Blob([S.modPDF], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = url;
  a.download = _pdfFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

/**
 * Limpia todo el estado para empezar una nueva cotizacion.
 * Conserva accessToken (dura 1h, util para multiples envios seguidos).
 */
function resetAll() {
  S.step        = 1;
  S.data        = null;
  S.modPDF      = null;
  S.formData    = null;
  S.pdfFilename = null;
  if (S.prevTimer) {
    clearTimeout(S.prevTimer);
    S.prevTimer = null;
  }

  document.getElementById('fileInput').value = '';
  document.querySelectorAll('input.form-control, textarea.form-control, select.form-control').forEach(function (el) {
    el.value = '';
  });
  // Reset toggles (default: off)
  var elec = document.getElementById('f-electric');
  if (elec) elec.checked = false;
  var asia = document.getElementById('f-asia');
  if (asia) asia.checked = false;
  var gama = document.getElementById('f-gama');
  if (gama) gama.checked = false;
  var gamaSuggest = document.getElementById('gamaSuggest');
  if (gamaSuggest) gamaSuggest.style.display = 'none';
  S.lastEntry = null;
  var waWrap = document.getElementById('waShareWrap');
  if (waWrap) waWrap.style.display = 'none';
  var waBtn = document.getElementById('btnWhatsApp');
  if (waBtn) waBtn.href = '#';
  document.getElementById('preview').innerHTML =
    '<p style="color:#6b7280;text-align:center;margin-top:40px;">Llena los campos a la izquierda para ver la vista previa.</p>';
  document.getElementById('priceTable').innerHTML       = '';
  document.getElementById('deductiblesList').innerHTML  = '';
}

// =====================================================================
// HELPERS DE RENDER
// =====================================================================

/**
 * Renderiza la tabla de precios en la vista 2 con los 5 montos.
 * Mensual y Deduccion Mensual aparecen como "removed" (rojo, tachado).
 * Anual aparece como "anual" (verde con badge -10%).
 */
function _renderPriceTable() {
  const t = document.getElementById('priceTable');
  const p = S.data.prices;
  t.innerHTML =
    _priceRow('Mensual',           p.mensual    || '0.00', 'removed') +
    _priceRow('Trimestral',        p.trimestral || '0.00', '')        +
    _priceRow('Semestral',         p.semestral  || '0.00', '')        +
    _priceRow('Anual',             p.anual      || '0.00', 'anual')   +
    _priceRow('Deduccion Mensual', p.deduccion  || '0.00', 'removed');
}

function _priceRow(label, value, klass) {
  const badge = klass === 'anual' ? '<span class="badge-discount">-10%</span>' : '';
  return '<div class="price-row ' + klass + '">' +
    '<div class="price-row-label">' + _escapeHtml(label) + badge + '</div>' +
    '<div class="price-row-value">\u20A1 ' + _escapeHtml(value) + '</div>' +
  '</div>';
}

function _renderDeductibles() {
  const ul = document.getElementById('deductiblesList');
  ul.innerHTML = '';
  (S.data.deductibles || []).forEach(function (text) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
}

// =====================================================================
// HELPERS GENERALES
// =====================================================================

function _setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function _setProgress(bar, label, pct, msg) {
  bar.style.width   = pct + '%';
  label.textContent = msg;
}

/**
 * Devuelve solo el primer nombre con capitalizacion natural.
 * El PDF da "APELLIDO APELLIDO NOMBRE [NOMBRE2...]" - tomamos el tercer token.
 * Si solo hay 1 o 2 tokens, retornamos el primero.
 */
function _firstName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length >= 3) return _capitalize(parts[2]);
  return _capitalize(parts[0] || '');
}

function _capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function _pdfFilename() {
  return 'COTIZACION-' + (S.data ? S.data.plate : 'INS') + '.pdf';
}

/**
 * Normaliza el tipo de vehiculo para el display de la vista 2.
 * El sistema del INS reporta algunos tipos con barra redundante que
 * el agente no usa en la descripcion del correo:
 *   "Rural/Jeep" -> "Rural"  (por convencion del agente)
 *
 * No altera el valor original en S.data.vehicleType: si el usuario
 * necesita "Rural/Jeep" tal cual, puede editarlo manualmente en el
 * input del paso 2.
 *
 * @param {string} type - tipo de vehiculo extraido del PDF
 * @returns {string} tipo normalizado para display
 */
function _cleanVehicleType(type) {
  if (!type) return '';
  const t = type.trim();
  // Caso conocido: INS reporta "Rural/Jeep", el agente usa solo "Rural"
  if (/^Rural\s*\/\s*Jeep$/i.test(t)) return 'Rural';
  return t;
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inicializa el token client de Google Identity Services en cuanto este disponible.
 * GIS es async/defer asi que puede no estar cargado cuando DOMContentLoaded dispara.
 * Reintenta cada 300ms hasta que window.google.accounts.oauth2 exista.
 */
function _tryInitTokenClient() {
  if (window.google && google.accounts && google.accounts.oauth2) {
    try {
      initTokenClient();
    } catch (e) {
      console.warn('No se pudo inicializar GIS:', e.message);
    }
  } else {
    setTimeout(_tryInitTokenClient, 300);
  }
}

