/**
 * Cotizador SDI · Orquestación del módulo "Envío de pólizas activas"
 *
 * Flujo (sub-página polizas-activas/): subir PDF(s) → revisar datos extraídos →
 * redactar correo → enviar por Gmail con TODOS los PDF adjuntos.
 *
 * Reusa los módulos compartidos de la app:
 *   - agent-profile.js : applyProfile(loadProfile())  (multi-agente vía CFG)
 *   - poliza-extract.js: PolizaParse.extractAll / classifyFile / readPdfText
 *   - poliza-email.js  : buildPolizaActivaEmail(...)
 *   - mime-builder.js  : buildMIMEMulti(...)
 *   - gmail-auth.js    : getToken() / sendEmail(raw)  (usa el singleton S)
 *
 * Sin backend, sin localStorage propio (solo el perfil del agente compartido).
 */
(function () {
  'use strict';

  var state = {
    files: [],   // [{ file, name, size, kind }]
    data: {},    // { poliza, cliente, nombrePila, vehiculo, placa, anio, correo, ... }
    step: 1
  };

  var KIND_LABEL = {
    condiciones:     'Condiciones Particulares',
    tarjeta:         'Tarjeta del seguro',
    comprobante:     'Comprobante de pago',
    generales:       'Condiciones Generales',
    pacto:           'Pacto Amistoso',
    multiasistencia: 'Multiasistencia',
    beneficios:      'Beneficios Asistencia',
    otro:            'Documento'
  };

  function $(id) { return document.getElementById(id); }

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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

  // ----- Carga / clasificación de archivos -----
  async function onFiles(fileList, doExtract) {
    var arr = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /pdf$/i.test(f.name) || f.type === 'application/pdf';
    });
    if (!arr.length) { showToast('Seleccioná archivos PDF.', 'error'); return; }

    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      // evita duplicados por nombre+tamaño
      var dup = state.files.some(function (x) { return x.name === f.name && x.size === f.size; });
      if (dup) continue;
      state.files.push({ file: f, name: f.name, size: f.size, kind: PolizaParse.classifyFile(f.name) });
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

  // Extrae datos del mejor candidato: Condiciones Particulares; si no, el primero
  // que arroje un número de póliza válido.
  async function extractFromBest() {
    setProgress(20, 'Leyendo el PDF…');
    var cond = state.files.filter(function (x) { return x.kind === 'condiciones'; });
    var order = cond.concat(state.files.filter(function (x) { return x.kind !== 'condiciones'; }));
    var got = null;
    for (var i = 0; i < order.length; i++) {
      try {
        var text = await PolizaParse.readPdfText(order[i].file);
        var d = PolizaParse.extractAll(text);
        if (d.poliza || d.cliente) { got = d; if (d.poliza) break; }
      } catch (e) { /* sigue con el próximo */ }
    }
    setProgress(100, '');
    if (got) {
      state.data = got;
    } else {
      state.data = {};
      showToast('No pude leer los datos automáticamente — completalos a mano.', 'info');
    }
  }

  function setProgress(pct, label) {
    var wrap = $('progressWrap'), bar = $('progressBar'), lab = $('progressLabel');
    if (wrap) wrap.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
    if (bar) bar.style.width = (pct || 0) + '%';
    if (lab) lab.textContent = label || '';
  }

  // ----- Vista 2: revisar -----
  function fillReview() {
    var d = state.data || {};
    $('f-poliza').value   = d.poliza   || '';
    $('f-cliente').value  = d.cliente  || '';
    $('f-saludo').value   = d.nombrePila || d.cliente || '';
    $('f-correo').value   = d.correo   || '';
    $('f-vehiculo').value = d.vehiculo || '';
    $('f-placa').value    = d.placa    || '';
    $('f-anio').value     = d.anio     || '';
  }

  function syncReview() {
    var d = state.data || (state.data = {});
    d.poliza     = $('f-poliza').value.trim();
    d.cliente    = $('f-cliente').value.trim();
    d.nombrePila = $('f-saludo').value.trim();
    d.correo     = $('f-correo').value.trim();
    d.vehiculo   = $('f-vehiculo').value.trim();
    d.placa      = $('f-placa').value.trim();
    d.anio       = $('f-anio').value.trim();
  }

  function renderDocs() {
    var ul = $('docList');
    if (!ul) return;
    if (!state.files.length) { ul.innerHTML = '<li class="doc-empty">Sin documentos cargados.</li>'; return; }
    ul.innerHTML = state.files.map(function (x, idx) {
      var label = KIND_LABEL[x.kind] || 'Documento';
      return '<li class="doc-item">' +
        '<span class="doc-ico">📄</span>' +
        '<span class="doc-meta"><span class="doc-name">' + esc(x.name) + '</span>' +
        '<span class="doc-size">' + label + ' · ' + fmtSize(x.size) + '</span></span>' +
        '<span class="doc-badge up">Subido</span>' +
        '<button class="doc-remove" data-idx="' + idx + '" title="Quitar" aria-label="Quitar">&times;</button>' +
      '</li>';
    }).join('');
    Array.prototype.forEach.call(ul.querySelectorAll('.doc-remove'), function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-idx'), 10);
        state.files.splice(i, 1);
        renderDocs();
        updateCount();
      });
    });
  }

  // ----- Vista 3: redactar -----
  function fillCompose() {
    var d = state.data || {};
    $('m-to').value      = d.correo || '';
    $('m-subject').value = '✅ Póliza Activa: ' + (d.poliza || '');
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
      nombrePila:    $('m-saludo').value.trim() || d.nombrePila || d.cliente || '',
      cliente:       d.cliente || '',
      poliza:        d.poliza || '',
      vehiculo:      d.vehiculo || '',
      placa:         d.placa || '',
      notaAdicional: $('m-nota').value
    };
  }

  function updatePreview() {
    var html = buildPolizaActivaEmail(currentEmailParams());
    var fr = $('preview');
    if (fr) fr.srcdoc = html;
  }

  // ----- Envío -----
  async function send() {
    syncReview(); // por si volvió a editar
    var to = $('m-to').value.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showToast('Ingresá un correo válido para el cliente.', 'error');
      $('m-to').focus(); return;
    }
    if (!state.files.length) {
      showToast('Adjuntá al menos un PDF de la póliza.', 'error');
      return;
    }

    var btn = $('btnSend');
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = 'Preparando adjuntos…';

    try {
      // Lee los bytes de cada PDF
      var attachments = [];
      for (var i = 0; i < state.files.length; i++) {
        var buf = await state.files[i].file.arrayBuffer();
        attachments.push({ bytes: new Uint8Array(buf), filename: state.files[i].name });
      }

      var html = buildPolizaActivaEmail(currentEmailParams());
      var subject = $('m-subject').value.trim() || ('✅ Póliza Activa: ' + (state.data.poliza || ''));
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

      $('successMsg').textContent = 'El correo de póliza activa fue enviado a ' + to + '.';
      setStep(4);
      showToast('✅ Póliza enviada a ' + to, 'success');
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
    setProgress(0, '');
    renderDocs();
    setStep(1);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    // Perfil del agente (multi-agente). Si no hay, se usan los defaults de CFG.
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
      if (!$('f-correo').value.trim()) { showToast('Ingresá el correo del cliente.', 'error'); $('f-correo').focus(); return; }
      fillCompose();
      setStep(3);
    });
    $('btnBack3').addEventListener('click', function () { setStep(2); });
    $('btnSend').addEventListener('click', send);
    $('btnReset').addEventListener('click', resetAll);

    // Vista previa en vivo al editar el correo
    ['m-saludo', 'm-nota'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('input', updatePreview);
    });

    renderDocs();
    setStep(1);
  });
})();
