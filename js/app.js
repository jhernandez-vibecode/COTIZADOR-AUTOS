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

  // Al compartir: persistir el numero en el historial (para que el modal 🕘
  // tambien abra el chat directo) y acortar el link de la guia, que con sus
  // 13 parametros WhatsApp corta con "Leer mas".
  document.getElementById('btnWhatsApp').addEventListener('click', function (ev) {
    const wa = document.getElementById('m-wa-cliente').value.trim();
    if (wa) setLatestHistoryWa(wa);
    if (!S.lastEntry) return;

    ev.preventDefault();
    // La pestaña se reserva ANTES del await: abrirla despues de una llamada de
    // red ya no cuenta como gesto del usuario y el navegador la bloquea.
    const win = window.open('', '_blank');
    acortarGuia(S.lastEntry.guideUrl).then(function (corto) {
      const url = buildWaShareUrl(S.lastEntry, wa, corto);
      if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
    });
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

  // ============ RESPALDO EN GOOGLE DRIVE (dentro del modal ⚙) ============
  var _btnDriveSync = document.getElementById('btnDriveSync');
  if (_btnDriveSync) _btnDriveSync.addEventListener('click', driveSyncNow);
  var _btnDriveRestore = document.getElementById('btnDriveRestore');
  if (_btnDriveRestore) _btnDriveRestore.addEventListener('click', driveRestoreNow);
  // Barra de invitación (una vez) a activar el respaldo
  var _btnInviteAct = document.getElementById('btnDriveInviteActivate');
  if (_btnInviteAct) _btnInviteAct.addEventListener('click', driveSyncNow);
  var _btnInviteDis = document.getElementById('btnDriveInviteDismiss');
  if (_btnInviteDis) _btnInviteDis.addEventListener('click', dismissDriveInvite);

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
  document.getElementById('statsList').addEventListener('click', _onStatsListClick);
  // Buscador por placa / cliente (input estático: el listener se registra una vez).
  const _statsSearchInput = document.getElementById('statsSearch');
  if (_statsSearchInput) {
    _statsSearchInput.addEventListener('input', _onStatsSearch);
    _statsSearchInput.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') _clearStatsSearch(); });
  }
  const _statsSearchClear = document.getElementById('statsSearchClear');
  if (_statsSearchClear) _statsSearchClear.addEventListener('click', _clearStatsSearch);


  // ============ CARGAR PERFIL DEL AGENTE ============
  // Si hay perfil guardado en localStorage, lo aplicamos sobre CFG.
  // Si NO hay (primer uso en este navegador), abrimos el modal forzando configurar.
  // ============ MENU LATERAL ============
  // El rail queda pegado justo debajo del header, que es sticky y puede
  // cambiar de alto al envolverse en pantallas angostas: se mide en vez de
  // hardcodear los 64px.
  _syncHeaderHeight();
  window.addEventListener('resize', _syncHeaderHeight);

  const savedProfile = loadProfile();
  paintRailAgent();            // con perfil o con los defaults de CFG
  if (savedProfile) {
    applyProfile(savedProfile);
    paintRailAgent();          // ya con los datos del agente aplicados
    // La limpieza del registro (cotizaciones sin póliza de más de 90 días) NO
    // se hace acá: vive en driveBackup y corre solo cuando el respaldo quedó
    // confirmado. Borrar en el arranque dejaba sin red al agente que no tiene
    // Drive, y convertía cualquier bug del predicado en pérdida irreversible.
    // Invitación (una vez) a activar el respaldo en Drive si aún no lo hizo.
    maybeShowDriveInvite();
  } else {
    openProfileModal(true);
  }

  // ============ Inicializar GIS cuando este disponible ============
  _tryInitTokenClient();
});

/**
 * Alto real del header sticky -> variable CSS --header-h, que usa .side-rail
 * para pegarse justo debajo. El header envuelve sus filas en pantallas
 * angostas, asi que el valor no es constante.
 */
function _syncHeaderHeight() {
  const h = document.querySelector('.app-header');
  if (!h) return;
  document.documentElement.style.setProperty('--header-h', Math.round(h.getBoundingClientRect().height) + 'px');
}

/**
 * Ficha del agente en el menu lateral (nombre + licencia) e iniciales en el
 * header. Multi-agente: sale de CFG, que agent-profile.js ya sobreescribio
 * con el perfil del navegador. Se vuelve a llamar al guardar el perfil.
 */
function paintRailAgent() {
  const nombre = String(CFG.FROM_NAME || '').trim();
  const lic    = String(CFG.LICENSE   || '').trim();

  const elName = document.getElementById('railAgentName');
  if (elName) elName.textContent = nombre || ' ';
  const elLic = document.getElementById('railAgentLic');
  if (elLic) elLic.textContent = lic ? ('Licencia SUGESE ' + lic) : '';

  const elIni = document.getElementById('hdrAgentIni');
  if (elIni) {
    // Dos iniciales: del PDF del INS no salen, estas vienen del perfil que el
    // propio agente escribio, asi que basta con partir por espacios.
    const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    elIni.textContent = ini;
    elIni.title = nombre ? ('Enviando como ' + nombre) : 'Agente';
  }
}

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

  if (typeof _refreshDriveStatus === 'function') _refreshDriveStatus();

  modal.classList.add('active');
  setTimeout(function () { document.getElementById('p-name').focus(); }, 100);
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// =====================================================================
// RESPALDO EN GOOGLE DRIVE (⚙) — historial + estados 📊 + perfil del agente
// La lógica de red/OAuth vive en drive-sync.js; acá van UI, toasts y re-render.
// =====================================================================

/** Refresca la línea de estado del respaldo en el modal ⚙. */
function _refreshDriveStatus() {
  const el = document.getElementById('driveStatus');
  if (!el) return;
  if (typeof driveBackupEnabled !== 'function' || !driveBackupEnabled()) {
    el.textContent = '⚪ Respaldo desactivado. Tocá “Sincronizar ahora” para guardar tu control en tu Google Drive.';
    return;
  }
  const last = driveLastBackup();
  let when = 'aún sin subir';
  if (last) {
    const d = new Date(last);
    if (!isNaN(d.getTime())) {
      when = d.toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  }
  el.textContent = '✅ Respaldo activo en tu Google Drive · Último: ' + when + '.';
}

/** Repinta las listas abiertas (historial / estadísticas) tras cambiar los datos. */
function _refreshOpenLists() {
  const hist = document.getElementById('historyModal');
  if (hist && hist.classList.contains('active') && typeof renderHistory === 'function') renderHistory();
  const stats = document.getElementById('statsModal');
  if (stats && stats.classList.contains('active') && typeof renderStats === 'function') renderStats();
}

/** Botón "Sincronizar ahora": activa el respaldo y deja Drive ↔ local idénticos. */
async function driveSyncNow() {
  const btn = document.getElementById('btnDriveSync');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
  try {
    const res = await driveSync();

    // Si de paso se recupero el PERFIL del agente (caso "limpie el navegador":
    // driveSync llama a driveRestore, que restaura el perfil cuando el navegador
    // no tiene ninguno), hay que recargar igual que en driveRestoreNow.
    //
    // Sin esto el modal ⚙ se queda abierto con los inputs que se llenaron ANTES
    // desde los defaults de CFG — o sea con el nombre y la licencia SUGESE del
    // dueno de la app — y en primer uso el unico boton disponible es "Guardar":
    // el agente lo pulsa, pisa el perfil que se acaba de recuperar y sube esa
    // suplantacion a SU propio Drive. Terminaria cotizando con una licencia
    // ajena sin enterarse.
    if (res && res.profileRestored) {
      driveEnable();
      driveResetAuto();
      showToast('Recuperé tu configuración y ' + res.merged + ' cotizaciones. Recargando…', 'success');
      setTimeout(function () { location.reload(); }, 1100);
      return;
    }

    _hideDriveInvite();
    _refreshDriveStatus();
    _refreshOpenLists();
    paintRailAgent();
    const n = (res && res.found) ? res.merged : loadHistoryVivas().length;
    showToast('Respaldo activado. Tu control quedó guardado en tu Google Drive (' + n + (n === 1 ? ' cotización' : ' cotizaciones') + ').', 'success');
  } catch (e) {
    console.error('[drive] sync:', e);
    showToast('No se pudo sincronizar con Drive: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

/** Botón "Restaurar de Drive": trae y fusiona el respaldo (y el perfil si falta). */
async function driveRestoreNow() {
  const btn = document.getElementById('btnDriveRestore');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Restaurando…'; }
  try {
    const res = await driveRestore();
    if (!res.found) {
      showToast('No hay respaldo en tu Drive todavía. Usá “Sincronizar ahora” para crearlo.', 'info');
      return;
    }
    driveEnable();
    driveResetAuto();
    if (res.profileRestored) {
      // Se recuperó también el perfil (caso "limpié el navegador"): recargamos
      // para que la app arranque ya configurada y con el historial de vuelta.
      showToast('Recuperé tu configuración y ' + res.merged + ' cotizaciones. Recargando…', 'success');
      setTimeout(function () { location.reload(); }, 1100);
      return;
    }
    _refreshDriveStatus();
    _refreshOpenLists();
    showToast('Recuperé ' + res.merged + ' cotizaciones desde tu Drive.', 'success');
  } catch (e) {
    console.error('[drive] restore:', e);
    showToast('No se pudo restaurar desde Drive: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

// ---- Barra de invitación (una vez) a activar el respaldo en Drive ----
var DRIVE_INVITE_DISMISS_KEY = 'cotizador_sdi_drive_invite_dismissed_v1';

/** Muestra la barra si el agente ya tiene perfil, aún no activó el respaldo y no la descartó. */
function maybeShowDriveInvite() {
  var el = document.getElementById('driveInvite');
  if (!el) return;
  if (!loadProfile()) return;                                             // primer uso: no molestar
  if (typeof driveBackupEnabled === 'function' && driveBackupEnabled()) return;  // ya activo
  try { if (localStorage.getItem(DRIVE_INVITE_DISMISS_KEY) === '1') return; } catch (e) { /* noop */ }
  el.style.display = 'flex';
}

function _hideDriveInvite() {
  var el = document.getElementById('driveInvite');
  if (el) el.style.display = 'none';
}

/** "Ahora no": oculta la barra y no la vuelve a mostrar en este navegador. */
function dismissDriveInvite() {
  try { localStorage.setItem(DRIVE_INVITE_DISMISS_KEY, '1'); } catch (e) { /* noop */ }
  _hideDriveInvite();
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
  const entries = loadHistoryVivas();

  if (!entries.length) {
    list.innerHTML =
      '<div class="history-empty">Aún no has enviado cotizaciones desde este navegador.</div>' +
      '<div style="margin-top:14px;text-align:center;">' +
        '<p style="margin:0 0 8px;font-size:12px;color:var(--gray-500,#64748b);">' +
          '¿Ya usabas la app antes o limpiaste este navegador? Recuperá tu control desde tu Google Drive:</p>' +
        '<button class="btn btn-secondary" id="btnHistoryRestore" type="button">☁️ Restaurar de Drive</button>' +
      '</div>';
    var _hr = document.getElementById('btnHistoryRestore');
    if (_hr) _hr.addEventListener('click', driveRestoreNow);
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
        '<div class="history-title">' + _escapeHtml(historyClientName(e) || '(sin nombre)') +
          (e.plate ? ' · ' + _escapeHtml(e.plate) : '') + ' ' + badge + '</div>' +
        '<div class="history-meta">' + fecha + ' · ' + _escapeHtml(e.email || '') +
          (e.vehicle ? ' · ' + _escapeHtml(e.vehicle) : '') + '</div>' +
      '</div>' +
      '<div class="history-actions">' +
        '<a class="history-btn" href="' + _escapeHtml(e.guideUrl || '#') + '" target="_blank" rel="noopener" title="Abrir la guía explicada">🔗</a>' +
        '<button class="history-btn" data-copy="' + i + '" title="Copiar link de la guía">📄</button>' +
        '<a class="history-btn" data-wa="' + i + '" href="' + _escapeHtml(buildWaShareUrl(e)) + '" target="_blank" rel="noopener" title="Compartir por WhatsApp">💬</a>' +
      '</div>' +
    '</div>';
  }).join('');

  // Compartir por WhatsApp desde el historial: mismo acortado que la vista 4.
  // El href queda con el link largo como respaldo por si el JS no corre.
  list.querySelectorAll('a[data-wa]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      const e = entries[parseInt(a.dataset.wa, 10)];
      if (!e || !e.guideUrl) return;
      ev.preventDefault();
      const win = window.open('', '_blank');   // reservar ANTES del await
      acortarGuia(e.guideUrl).then(function (corto) {
        const url = buildWaShareUrl(e, null, corto);
        if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
      });
    });
  });

  // Botones de copiar (delegado simple por data-copy)
  list.querySelectorAll('button[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const e = entries[parseInt(btn.dataset.copy, 10)];
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
    return '<div class="stats-month' + active + '" data-month-key="' + _escapeHtml(m.key) + '">'
      + '<div class="stats-month-label">' + _escapeHtml(m.label) + '</div>'
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
    return '<div class="history-empty">No hay cotizaciones para este filtro.</div>';
  }
  return entries.map(function (e) {
    const value   = historyEntryValue(e);
    const high    = value >= STATS_HIGH_THRESHOLD;
    const elapsed = historyDaysSince(e);
    const sent    = e.date ? new Date(e.date) : null;
    const fecha   = sent ? sent.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
    const id      = _escapeHtml(e.id || '');
    const placa   = historyEntryPlate(e);

    let marca;
    if (historyTienePoliza(e)) {
      marca = '<span class="history-badge pol" title="Se le envió la póliza activa">✓ Póliza emitida</span>';
    } else {
      const ago = (elapsed == null) ? '' : (elapsed === 0 ? 'hoy' : elapsed === 1 ? 'ayer' : elapsed + ' d');
      marca = '<span class="history-badge esp" title="Todavía sin póliza">Sin póliza' + (ago ? ' &middot; ' + ago : '') + '</span>';
    }

    const meta = [
      placa ? _escapeHtml(placa) : '',
      e.vehicle ? _escapeHtml(e.vehicle) : '',
      value ? (high ? '⭐ ' : '') + _fmtMillones(value) : ''
    ].filter(Boolean).join(' &middot; ');

    return '<div class="stat-row' + (historyTienePoliza(e) ? ' con-poliza' : '') + '">'
      + '<div class="stat-fecha">' + _escapeHtml(fecha) + '</div>'
      + '<div class="stat-main">'
        + '<div class="stat-cli">' + _escapeHtml(historyClientName(e) || '(sin nombre)') + '</div>'
        + '<div class="stat-meta">' + meta + '</div>'
      + '</div>'
      + '<div class="stat-marca">' + marca + '</div>'
      + '<div class="stat-acc">'
        + '<a class="history-btn" href="' + _escapeHtml(buildWaFollowUpUrl(e)) + '" target="_blank" rel="noopener" title="Escribirle por WhatsApp">💬</a>'
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
    paintRailAgent();          // el pie del menú y las iniciales del header
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  // Si el respaldo en Drive está activo, sube también la configuración nueva.
  if (typeof scheduleDriveBackup === 'function') scheduleDriveBackup();

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

  // Si el agente corrigio el tipo de repuesto, re-seleccionar la columna de la
  // matriz FORMA DE PAGO para que el correo/explicador usen el monto correcto.
  var pm = S.data.priceMatrix;
  if (pm && pm.centers && pm.centers.length > 1 && typeof selectPriceColumn === 'function') {
    var sel = selectPriceColumn(pm, S.data.sustRepos);
    S.data.prices = pricesForColumn(pm, sel);
    S.data.reposColumn = {
      index:     sel,
      label:     (pm.labels || [])[sel] || '',
      confident: (typeof priceColumnConfident === 'function') ? priceColumnConfident(pm, S.data.sustRepos) : true,
      count:     pm.centers.length
    };
  }
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
    plate:         _placaEsRelleno(S.data.plate, S.data.plateClass) ? '' : S.data.plate,
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
    plateClass:    S.data.plateClass,
    year:          S.data.year,
    valor:         S.data.valor,
    vehicleType:   _isElectricChecked() ? 'electric' : S.data.vehicleType,
    origenAsia:    _isAsiaChecked(),
    altaGama:      _isGamaChecked(),
    dedDFH:        S.data.dedDFH,
    // Lo que cubre la cotizacion, tal como viene del PDF. El juego de
    // coberturas cambia en cada una: una lista fija le prometeria al
    // cliente algo que no contrato.
    coberturas:    S.data.coberturas,
    deducibles:    S.data.deductibles
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
      plateClass:    S.data.plateClass,
      year:          S.data.year,
      valor:         S.data.valor,
      vehicleType:   _isElectricChecked() ? 'electric' : S.data.vehicleType,
      origenAsia:    _isAsiaChecked(),
      altaGama:      _isGamaChecked(),
      dedDFH:        S.data.dedDFH,
      // Lo que cubre la cotizacion, tal como viene del PDF. El juego de
      // coberturas cambia en cada una: una lista fija le prometeria al
      // cliente algo que no contrato.
      coberturas:    S.data.coberturas,
      deducibles:    S.data.deductibles
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
        client:    document.getElementById('m-name').value.trim(),   // nombre de pila → saludo de los mensajes
        clientFull: String(S.data.clientName || '').trim(),           // nombre completo → mostrar y buscar por apellido
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
    _reposNote() +
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

/**
 * Nota sobre la columna de precios elegida. El PDF INS (jul 2026) trae una
 * matriz de precios por tipo de repuesto; mostramos SEGUN cual se calcularon
 * estos montos para que el agente confirme (o corrija el campo Repuestos).
 * Solo aparece cuando hay matriz (>1 columna). Estilo inline: no depende de CSS.
 */
function _reposNote() {
  const rc = S.data ? S.data.reposColumn : null;
  if (!rc || !(rc.count > 1)) return '';
  const repos = (S.data.sustRepos || rc.label || '').trim();
  const base = 'margin:0 0 12px;padding:8px 11px;border-radius:8px;font-size:12px;line-height:1.45;';
  if (rc.confident) {
    return '<div style="' + base + 'background:#eff6ff;border:1px solid #bfdbfe;color:#0c4a6e;">'
      + '\uD83D\uDCCB Precios seg\u00FAn el repuesto elegido: <b>' + _escapeHtml(repos || '\u2014') + '</b></div>';
  }
  return '<div style="' + base + 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e;">'
    + '\u26A0\uFE0F Verific\u00E1 el <b>tipo de repuesto</b>: no se pudo confirmar a qu\u00E9 columna corresponde. '
    + 'Se us\u00F3 <b>' + _escapeHtml(repos || '\u2014') + '</b>.</div>';
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

