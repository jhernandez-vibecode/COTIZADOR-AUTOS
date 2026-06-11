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

  // ============ CARGAR PERFIL DEL AGENTE ============
  // Si hay perfil guardado en localStorage, lo aplicamos sobre CFG.
  // Si NO hay (primer uso en este navegador), abrimos el modal forzando configurar.
  const savedProfile = loadProfile();
  if (savedProfile) {
    applyProfile(savedProfile);
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

  const profile = {
    name:      name,
    email:     email,
    phone:     phone,
    whatsapp:  whatsapp,
    license:   license,
    website:   cleanWebsite,
    agendaUrl: cleanAgenda
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

    const raw = buildMIME({
      to:       toAddr,
      from:     '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>',
      subject:  subject,
      html:     html,
      pdfBytes: S.modPDF,
      filename: fname
    });
    await sendEmail(raw);

    // Registrar en el historial + habilitar compartir por WhatsApp.
    // Nada de esto debe poder tumbar el flujo: el correo YA salió.
    try {
      const entry = {
        date:      new Date().toISOString(),
        client:    document.getElementById('m-name').value.trim(),
        agentName: CFG.FROM_NAME || '',
        email:     toAddr,
        plate:     S.data.plate,
        vehicle:   document.getElementById('m-vehicle').value.trim(),
        quote:     S.data.quoteNum,
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

