/**
 * Cotizador SDI · Orquestación del módulo "Renovación confirmada"
 *
 * Flujo (sub-página renovaciones/): cargar el Comprobante de Pago del INS →
 * revisar los datos extraídos → redactar → enviar por Gmail con el comprobante
 * adjunto → avisar al cliente por WhatsApp con el enlace corto de la guía.
 *
 * Reusa los módulos compartidos de la app:
 *   - agent-profile.js     : applyProfile(loadProfile())  (multi-agente vía CFG)
 *   - poliza-extract.js    : helpers de nombre + readPdfText (vía RenovacionParse)
 *   - renovacion-extract.js: RenovacionParse.extractAll / estaPagado
 *   - renovacion-email.js  : buildRenovacionEmail / buildRenovacionWaUrl
 *   - shortlink.js         : acortarEnlace(url, 'a')
 *   - mime-builder.js      : buildMIMEMulti(...)
 *   - gmail-auth.js        : getToken() / sendEmail(raw)  (singleton S)
 *
 * NO adjunta los documentos estándar del INS (standard-docs.js): el cliente ya
 * los recibió cuando se emitió la póliza; acá va solo su comprobante.
 * Sin backend y sin localStorage propio (solo el perfil del agente compartido).
 */
(function () {
  'use strict';

  var state = {
    files: [],   // [{ file, name, size }]
    data: {},    // lo que devuelve RenovacionParse.extractAll + lo que edite el agente
    step: 1
  };

  function $(id) { return document.getElementById(id); }

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ----- Navegación entre vistas -----
  function setStep(n) {
    state.step = n;
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle('active', views[i].id === ('view' + n));
    }
    var steps = document.querySelectorAll('#stepNav .step');
    for (var j = 0; j < steps.length; j++) {
      var s = parseInt(steps[j].getAttribute('data-step'), 10);
      steps[j].classList.toggle('active', s === n);
      steps[j].classList.toggle('done', s < n);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setProgress(pct, label) {
    var wrap = $('progressWrap'), bar = $('progressBar'), lab = $('progressLabel');
    if (wrap) wrap.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
    if (bar) bar.style.width = (pct || 0) + '%';
    if (lab) lab.textContent = label || '';
  }

  // ----- Carga de archivos -----
  async function onFiles(fileList, doExtract) {
    // Array.from ANTES de cualquier await: input.files es una lista VIVA y se
    // vacía al reasignar el input, así que un for...of con await dentro solo
    // procesaría el primer archivo.
    var arr = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /pdf$/i.test(f.name) || f.type === 'application/pdf';
    });
    if (!arr.length) { showToast('Seleccioná archivos PDF.', 'error'); return; }

    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      var dup = state.files.some(function (x) { return x.name === f.name && x.size === f.size; });
      if (dup) continue;
      state.files.push({ file: f, name: f.name, size: f.size });
    }

    if (doExtract) {
      await extractFromBest();
      fillReview();
      renderDocs();
      setStep(2);
    } else {
      renderDocs();
    }
  }

  /** Extrae del primer PDF que parezca un Comprobante de Pago del INS. */
  async function extractFromBest() {
    setProgress(20, 'Leyendo el comprobante…');
    var got = null, primero = null;
    for (var i = 0; i < state.files.length; i++) {
      try {
        var text = await RenovacionParse.readPdfText(state.files[i].file);
        var d = RenovacionParse.extractAll(text);
        if (!primero) primero = d;
        if (d.esComprobante && (d.poliza || d.numComprobante)) { got = d; break; }
      } catch (e) { /* sigue con el próximo */ }
    }
    setProgress(100, '');

    state.data = got || primero || {};

    if (!got && primero) {
      showToast('Este PDF no parece un Comprobante de Pago del INS — revisá los datos.', 'info');
    } else if (!got && !primero) {
      showToast('No pude leer los datos automáticamente — completalos a mano.', 'info');
    }
    if (state.data.placaIncierta) {
      showToast('Revisá la placa: el comprobante la trae en un formato que no reconozco.', 'info');
    }
    if (state.data.polizasEncontradas > 1) {
      showToast('El comprobante trae ' + state.data.polizasEncontradas + ' pólizas. Revisá que los datos sean los de la que querés enviar.', 'info');
    }
  }

  // ----- Vista 2: revisar -----
  function fillReview() {
    var d = state.data || {};
    $('f-comprobante').value = d.numComprobante || '';
    $('f-poliza').value      = d.poliza     || '';
    $('f-cliente').value     = d.cliente    || '';
    $('f-saludo').value      = d.nombrePila || d.cliente || '';
    $('f-correo').value      = d.correo     || '';
    $('f-vehiculo').value    = d.vehiculo   || '';
    $('f-placa').value       = d.placa      || '';
    $('f-desde').value       = d.periodoDesde || '';
    $('f-hasta').value       = d.periodoHasta || '';
    $('f-fpago').value       = d.fechaPago  || '';
    $('f-monto').value       = d.montoTexto || '';
    renderEstado();
  }

  function syncReview() {
    var d = state.data || (state.data = {});
    d.numComprobante = $('f-comprobante').value.trim();
    d.poliza         = $('f-poliza').value.trim();
    d.cliente        = $('f-cliente').value.trim();
    d.nombrePila     = $('f-saludo').value.trim();
    d.correo         = $('f-correo').value.trim();
    d.vehiculo       = $('f-vehiculo').value.trim();
    d.placa          = $('f-placa').value.trim();
    d.periodoDesde   = $('f-desde').value.trim();
    d.periodoHasta   = $('f-hasta').value.trim();
    d.fechaPago      = $('f-fpago').value.trim();
    d.montoTexto     = $('f-monto').value.trim();
  }

  /**
   * Guard de estado (decisión D7 de JC, 10 ago 2026).
   *
   * Este correo AFIRMA que el pago fue aplicado. Enviarlo sobre un comprobante
   * que no está pagado sería confirmarle al cliente un pago que no ocurrió, y
   * quien responde por eso es el agente con su licencia. Por eso:
   *   · dice "Pagado"        → se puede enviar
   *   · dice OTRA cosa       → bloqueo, sin escape (es lo que pidió JC)
   *   · no se pudo leer      → el agente lo confirma con la casilla; el flujo no
   *                            se muere por un PDF que el parser no entendió
   */
  function estadoOk() {
    var est = String((state.data && state.data.estado) || '').trim();
    if (RenovacionParse.estaPagado(est)) return true;
    if (!est) { var c = $('chkPagado'); return !!(c && c.checked); }
    return false;
  }

  function renderEstado() {
    var box = $('estadoBox');
    if (!box) return;
    var est = String((state.data && state.data.estado) || '').trim();

    if (RenovacionParse.estaPagado(est)) {
      box.className = 'estado-box ok';
      box.innerHTML = '<b>✓ Comprobante pagado.</b> El INS reporta <b>Estado: ' + esc(est) + '</b>, así que se puede enviar la confirmación.';
    } else if (est) {
      box.className = 'estado-box bad';
      box.innerHTML = '<b>⛔ Este comprobante NO está pagado.</b> El INS reporta <b>Estado: ' + esc(est) +
        '</b>. Esta pantalla es solo para enviar recibos <b>ya pagados</b>: el correo le confirma al cliente que su pago fue aplicado, y no se puede afirmar eso todavía.';
    } else {
      box.className = 'estado-box warn';
      box.innerHTML = '<b>No pude leer el estado del comprobante.</b> Esta pantalla es solo para recibos <b>ya pagados</b>. ' +
        '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:600;cursor:pointer;">' +
        '<input type="checkbox" id="chkPagado" style="width:16px;height:16px;cursor:pointer;"> Confirmo que este recibo ya está pagado</label>';
      var c = $('chkPagado');
      if (c) c.addEventListener('change', function () { renderNext2(); });
    }
    renderNext2();
  }

  function renderNext2() {
    var btn = $('btnNext2');
    if (!btn) return;
    var ok = estadoOk();
    btn.disabled = !ok;
    btn.title = ok ? '' : 'Solo se pueden enviar comprobantes ya pagados.';
    btn.style.opacity = ok ? '' : '.5';
    btn.style.cursor = ok ? '' : 'not-allowed';
  }

  function renderDocs() {
    var ul = $('docList');
    if (!ul) return;
    if (!state.files.length) { ul.innerHTML = '<li class="doc-empty">Sin documentos cargados.</li>'; return; }
    ul.innerHTML = state.files.map(function (x, idx) {
      return '<li class="doc-item">' +
        '<span class="doc-ico">📄</span>' +
        '<span class="doc-meta"><span class="doc-name">' + esc(x.name) + '</span>' +
        '<span class="doc-size">' + fmtSize(x.size) + '</span></span>' +
        '<span class="doc-badge up">Adjunto</span>' +
        '<button class="doc-remove" data-idx="' + idx + '" title="Quitar" aria-label="Quitar">&times;</button>' +
      '</li>';
    }).join('');
    Array.prototype.forEach.call(ul.querySelectorAll('.doc-remove'), function (b) {
      b.addEventListener('click', function () {
        state.files.splice(parseInt(b.getAttribute('data-idx'), 10), 1);
        renderDocs();
        updateCount();
      });
    });
  }

  // ----- Vista 3: redactar -----
  function fillCompose() {
    var d = state.data || {};
    $('m-to').value      = d.correo || '';
    $('m-subject').value = '✅ Su renovación está confirmada' + (d.poliza ? ' · Póliza ' + d.poliza : '');
    $('m-saludo').value  = d.nombrePila || d.cliente || '';
    updateCount();
    updatePreview();
  }

  function updateCount() {
    var c = $('m-count'); if (c) c.textContent = String(state.files.length);
  }

  function currentEmailParams() {
    var d = state.data || {};
    return {
      nombrePila:     $('m-saludo').value.trim() || d.nombrePila || d.cliente || '',
      cliente:        d.cliente || '',
      poliza:         d.poliza || '',
      placa:          d.placa || '',
      vehiculo:       d.vehiculo || '',
      numComprobante: d.numComprobante || '',
      montoTexto:     d.montoTexto || '',
      periodoDesde:   d.periodoDesde || '',
      periodoHasta:   d.periodoHasta || '',
      fechaPago:      d.fechaPago || '',
      notaAdicional:  $('m-nota').value
    };
  }

  function updatePreview() {
    var fr = $('preview');
    if (fr) fr.srcdoc = buildRenovacionEmail(currentEmailParams());
  }

  /** Datos del aviso por WhatsApp: los MISMOS del correo + el teléfono. */
  function waParams() {
    var p = currentEmailParams();
    var waIn = $('m-wa-cliente');
    p.telCliente = waIn ? waIn.value : '';
    return p;
  }

  /**
   * Deja el enlace LARGO en el href: es el que vale si el acortador falla o si
   * el clic no pasa por el handler (JS caído, "abrir en pestaña nueva").
   */
  function refreshWaBtn() {
    var btn = $('btnWhatsApp');
    if (btn) btn.href = buildRenovacionWaUrl(waParams());
  }

  /** Clic en "Avisar por WhatsApp": acorta la guía y recién ahí abre el chat. */
  function shareWa(ev) {
    ev.preventDefault();
    // La pestaña se reserva ANTES del await: abrirla después de una llamada de
    // red ya no cuenta como gesto del usuario y el navegador la bloquea.
    var win = window.open('', '_blank');
    acortarEnlace(_renovAsistenciaUrl(), 'a').then(function (corto) {
      var p = waParams();
      p.urlGuia = corto;
      var url = buildRenovacionWaUrl(p);
      if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
    });
  }

  // ----- Envío -----
  async function send() {
    syncReview();

    if (!estadoOk()) {
      showToast('Solo se pueden enviar comprobantes ya pagados.', 'error');
      setStep(2); return;
    }
    var to = $('m-to').value.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showToast('Ingresá un correo válido para el cliente.', 'error');
      $('m-to').focus(); return;
    }
    if (!state.files.length) {
      showToast('Adjuntá el comprobante de pago.', 'error');
      return;
    }

    var btn = $('btnSend');
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = 'Preparando adjuntos…';

    try {
      var attachments = [];
      for (var i = 0; i < state.files.length; i++) {
        var buf = await state.files[i].file.arrayBuffer();
        attachments.push({ bytes: new Uint8Array(buf), filename: state.files[i].name });
      }

      var html = buildRenovacionEmail(currentEmailParams());
      var subject = $('m-subject').value.trim() ||
        ('✅ Su renovación está confirmada' + (state.data.poliza ? ' · Póliza ' + state.data.poliza : ''));
      var fromHeader = CFG.FROM_NAME ? ('"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>') : CFG.FROM_EMAIL;

      var raw = buildMIMEMulti({ to: to, from: fromHeader, subject: subject, html: html, attachments: attachments });

      btn.textContent = 'Enviando…';
      await getToken();
      try {
        await sendEmail(raw);
      } catch (err) {
        // token vencido a mitad: limpiar y reintentar una vez
        if (/\b401\b|expir|token/i.test(err.message || '')) {
          clearToken();
          await getToken();
          await sendEmail(raw);
        } else { throw err; }
      }

      $('successMsg').textContent = 'El comprobante de renovación fue enviado a ' + to + '.';

      // Aviso por WhatsApp. Nada de esto puede tumbar el flujo: el correo YA salió.
      try {
        var waIn = $('m-wa-cliente');
        if (waIn) waIn.value = '';
        refreshWaBtn();
        var wrap = $('waShareWrap');
        if (wrap) wrap.style.display = 'flex';
      } catch (e) { console.warn('[renovacion] aviso WhatsApp:', e); }

      setStep(4);
      showToast('✅ Comprobante enviado a ' + to, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al enviar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  function resetAll() {
    state.files = [];
    state.data = {};
    $('fileInput').value = '';
    if ($('fileInput2')) $('fileInput2').value = '';
    $('m-nota').value = '';
    if ($('m-wa-cliente')) $('m-wa-cliente').value = '';
    if ($('waShareWrap')) $('waShareWrap').style.display = 'none';
    setProgress(0, '');
    renderDocs();
    // Repinta el aviso de estado con los datos ya vacíos: si no, el próximo
    // comprobante arrancaría con el cartel del anterior a la vista.
    renderEstado();
    setStep(1);
  }

  // ----- Drag & drop -----
  function wireDropZone() {
    var dz = $('dropZone');
    if (!dz) return;
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag-over'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) onFiles(e.dataTransfer.files, true);
    });
  }

  // ----- Init -----
  document.addEventListener('DOMContentLoaded', function () {
    // Perfil del agente (multi-agente). Sin esto el correo sale con la licencia
    // del owner aunque lo mande otro agente.
    try { if (typeof loadProfile === 'function') { var p = loadProfile(); if (p) applyProfile(p); } } catch (e) {}
    try { if (typeof initTokenClient === 'function') initTokenClient(); } catch (e) {}

    $('fileInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) onFiles(e.target.files, true);
      e.target.value = '';
    });
    if ($('fileInput2')) {
      $('fileInput2').addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) onFiles(e.target.files, false);
        e.target.value = '';
      });
    }
    wireDropZone();

    $('btnBack2').addEventListener('click', function () { setStep(1); });
    $('btnNext2').addEventListener('click', function () {
      syncReview();
      if (!estadoOk()) { showToast('Solo se pueden enviar comprobantes ya pagados.', 'error'); return; }
      if (!$('f-correo').value.trim()) { showToast('Ingresá el correo del cliente.', 'error'); $('f-correo').focus(); return; }
      fillCompose();
      setStep(3);
    });
    $('btnBack3').addEventListener('click', function () { setStep(2); });
    $('btnSend').addEventListener('click', send);
    $('btnReset').addEventListener('click', resetAll);

    var waIn = $('m-wa-cliente');
    if (waIn) waIn.addEventListener('input', function () { refreshWaBtn(); });

    var waBtn = $('btnWhatsApp');
    if (waBtn) waBtn.addEventListener('click', shareWa);

    // Vista previa en vivo al editar el correo
    ['m-saludo', 'm-nota'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('input', updatePreview);
    });

    renderDocs();
    setStep(1);
  });
})();
