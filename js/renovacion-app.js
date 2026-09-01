/**
 * Cotizador SDI · Orquestación del módulo "Renovación confirmada"
 *
 * Flujo (sub-página renovaciones/): cargar el/los Comprobantes de Pago del INS →
 * revisar los datos extraídos → redactar → enviar por Gmail con los comprobantes
 * adjuntos → avisar al cliente por WhatsApp con el enlace corto de la guía.
 *
 * VARIOS RECIBOS EN UN SOLO CORREO (JC, 10 ago 2026). Un cliente puede tener dos
 * pólizas y un plan familiar llega a cinco o más. Se cargan todos juntos, la app
 * los lista y manda UN correo con el detalle y el total. En el plan familiar los
 * recibos vienen a nombre de distintas personas de la familia: el correo se
 * dirige al DUEÑO DEL PLAN (lo pone el agente) y la tabla dice de quién es cada
 * póliza. Se puede enviar a VARIOS correos (p. ej. esposo y esposa).
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
 * los recibió cuando se emitió la póliza; acá van solo sus comprobantes.
 * Sin backend y sin localStorage propio (solo el perfil del agente compartido).
 */
(function () {
  'use strict';

  var state = {
    files: [],     // adjuntos: [{ file, name, size }]
    recibos: [],   // comprobantes leídos: [{ srcName, data }] (data = RenovacionParse.extractAll)
    cliente: {},   // { nombre, saludo } del dueño del plan
    waEnviado: false,
    canal: 'ambos',   // 'ambos' = correo + WhatsApp | 'wa' = solo WhatsApp
    urlGuiaCorta: '', // alias /a de la guia, pedido una vez por sesion
    pidiendoGuia: false,
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

  /** Deja la carga como recién abierta. `conservarCliente` mantiene a quién se le envía. */
  function limpiarCarga(conservarCliente) {
    // El canal vuelve SIEMPRE a correo+WhatsApp. Si quedara pegado en 'wa', al
    // siguiente cliente -que si tiene correo- no le llegaria nada y el agente
    // no se enteraria: el flujo terminaria igual, en la pantalla de exito.
    setCanal('ambos');
    state.files = [];
    state.recibos = [];
    if (!conservarCliente) state.cliente = {};
    if ($('fileInput'))  $('fileInput').value = '';
    if ($('fileInput2')) $('fileInput2').value = '';
    setProgress(0, '');
    renderDocs();
    renderRecibos();
    renderEstado();
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

    // 🔴 Cargar por el paso 1 EMPIEZA DE CERO (conservando al cliente si el
    // agente eligió "otro recibo del mismo cliente"). Si solo se apilara, el que
    // se equivoca de comprobante y vuelve a cargar seguiría viendo los datos del
    // anterior y el guard del "Pagado" leería el estado viejo.
    if (doExtract) limpiarCarga(true);

    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      var dup = state.files.some(function (x) { return x.name === f.name && x.size === f.size; });
      if (dup) continue;
      state.files.push({ file: f, name: f.name, size: f.size });
    }

    await leerComprobantes();
    if (doExtract) {
      fillReview();
      setStep(2);
    } else {
      renderRecibos();
      renderEstado();
    }
    renderDocs();
  }

  /** Lee TODOS los PDF cargados y arma la lista de recibos. */
  async function leerComprobantes() {
    setProgress(20, 'Leyendo los comprobantes…');
    var previos = {};
    state.recibos.forEach(function (r) { previos[r.srcName] = r; });

    var nuevos = [], noLeidos = 0;
    for (var i = 0; i < state.files.length; i++) {
      var nombre = state.files[i].name;
      // Si ya se leyó en una pasada anterior, se conserva CON las correcciones
      // que el agente haya hecho a mano.
      if (previos[nombre]) { nuevos.push(previos[nombre]); continue; }
      setProgress(20 + Math.round((i / state.files.length) * 70), 'Leyendo ' + (i + 1) + ' de ' + state.files.length + '…');
      try {
        var texto = await RenovacionParse.readPdfText(state.files[i].file);
        var d = RenovacionParse.extractAll(texto);
        if (d.esComprobante && (d.poliza || d.numComprobante)) {
          nuevos.push({ srcName: nombre, data: d });
        } else { noLeidos++; }
      } catch (e) { noLeidos++; }
    }
    setProgress(100, '');
    state.recibos = nuevos;

    if (!state.recibos.length) {
      showToast('No pude leer ningún Comprobante de Pago del INS — revisá el PDF o completá los datos a mano.', 'error');
    } else if (noLeidos) {
      showToast(noLeidos + ' archivo(s) no son comprobantes del INS: van adjuntos, pero no suman al detalle.', 'info');
    }
    if (state.recibos.some(function (r) { return r.data.placaIncierta; })) {
      showToast('Revisá las placas marcadas: vienen en un formato que no reconozco.', 'info');
    }

    // El cliente (dueño del plan) se propone con el titular del primer recibo.
    if (state.recibos.length && !state.cliente.nombre) {
      state.cliente.nombre = state.recibos[0].data.cliente || '';
      state.cliente.saludo = state.recibos[0].data.nombrePila || '';
    }
  }

  // ----- Vista 2: revisar -----
  function fillReview() {
    $('f-cliente').value = state.cliente.nombre || '';
    $('f-saludo').value  = state.cliente.saludo || '';
    renderRecibos();
    renderEstado();
  }

  function syncCliente() {
    state.cliente.nombre = $('f-cliente').value.trim();
    state.cliente.saludo = $('f-saludo').value.trim();
  }

  /** Vuelca a state.recibos lo que el agente haya corregido en cada renglón. */
  function syncRecibos() {
    var filas = document.querySelectorAll('#recibosList [data-rec]');
    Array.prototype.forEach.call(filas, function (fila) {
      var i = parseInt(fila.getAttribute('data-rec'), 10);
      var r = state.recibos[i];
      if (!r) return;
      var get = function (campo) {
        var el = fila.querySelector('[data-campo="' + campo + '"]');
        return el ? el.value.trim() : '';
      };
      r.data.poliza       = get('poliza');
      r.data.placa        = get('placa');
      r.data.vehiculo     = get('vehiculo');
      r.data.periodoDesde = get('desde');
      r.data.periodoHasta = get('hasta');
      var mt = get('monto');
      if (mt !== r.data.montoTexto) {   // el agente lo corrigió: reparsear el número
        r.data.montoTexto = mt;
        r.data.monto = RenovacionParse.parseMonto(mt);
      }
    });
  }

  function syncReview() { syncCliente(); syncRecibos(); }

  /** Suma de los recibos, ya formateada. '' si algún monto no es legible. */
  function totalTexto() {
    if (!state.recibos.length) return '';
    var suma = 0;
    for (var i = 0; i < state.recibos.length; i++) {
      var v = state.recibos[i].data.monto;
      if (typeof v !== 'number' || !isFinite(v)) return '';
      suma += v;
    }
    return RenovacionParse.fmtMonto(suma, state.recibos[0].data.moneda || 'CRC');
  }

  function renderRecibos() {
    var box = $('recibosList');
    var tit = $('recibosTitulo');
    var tot = $('recibosTotal');
    if (!box) return;

    if (tit) tit.textContent = state.recibos.length
      ? (state.recibos.length === 1 ? '1 recibo leído' : state.recibos.length + ' recibos leídos')
      : 'Sin recibos leídos';

    if (!state.recibos.length) {
      box.innerHTML = '<p class="doc-empty">Cargá el comprobante de pago para ver el detalle.</p>';
      if (tot) tot.style.display = 'none';
      return;
    }

    box.innerHTML = state.recibos.map(function (r, i) {
      var d = r.data;
      var pagado = RenovacionParse.estaPagado(d.estado);
      return '<div class="rec" data-rec="' + i + '">' +
        '<div class="rec-head">' +
          '<span class="rec-pill ' + (pagado ? 'ok' : 'bad') + '">' + (pagado ? 'PAGADO' : esc(d.estado || 'SIN ESTADO')) + '</span>' +
          '<span class="rec-n">Recibo ' + (i + 1) +
            (d.numComprobante ? ' · <span class="mono">' + esc(d.numComprobante) + '</span>' : '') + '</span>' +
          '<button type="button" class="rec-del" data-del="' + i + '" title="Quitar este recibo" aria-label="Quitar">&times;</button>' +
        '</div>' +
        '<div class="rec-grid">' +
          _campo('Póliza', 'poliza', d.poliza) +
          _campo('Placa', 'placa', d.placa) +
          _campo('Vehículo (opcional)', 'vehiculo', d.vehiculo || '') +
          _campo('Desde', 'desde', d.periodoDesde) +
          _campo('Hasta', 'hasta', d.periodoHasta) +
          _campo('Monto', 'monto', d.montoTexto) +
        '</div>' +
        (d.cliente && state.cliente.nombre && d.cliente !== state.cliente.nombre
          ? '<div class="rec-aseg">Asegurado: <b>' + esc(d.cliente) + '</b></div>' : '') +
      '</div>';
    }).join('');

    if (tot) {
      var t = totalTexto();
      tot.style.display = state.recibos.length > 1 ? 'block' : 'none';
      tot.innerHTML = 'Total pagado: <b>' + (t ? esc(t) : '—') + '</b>';
    }

    Array.prototype.forEach.call(box.querySelectorAll('.rec-del'), function (b) {
      b.addEventListener('click', function () {
        syncReview();
        var i = parseInt(b.getAttribute('data-del'), 10);
        var quitado = state.recibos.splice(i, 1)[0];
        // El PDF de ese recibo deja de ir adjunto: mandar un comprobante que el
        // correo no menciona confunde al cliente.
        if (quitado) {
          state.files = state.files.filter(function (f) { return f.name !== quitado.srcName; });
        }
        renderRecibos(); renderEstado(); renderDocs(); updateCount();
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('input'), function (inp) {
      inp.addEventListener('input', function () { syncRecibos(); renderTotalSolo(); });
    });
  }

  function _campo(label, campo, valor) {
    return '<label class="rec-f"><span>' + label + '</span>' +
      '<input class="form-control" data-campo="' + campo + '" value="' + esc(valor || '') + '" /></label>';
  }

  /** Actualiza solo el total (al teclear no conviene repintar toda la lista). */
  function renderTotalSolo() {
    var tot = $('recibosTotal');
    if (!tot || state.recibos.length < 2) return;
    var t = totalTexto();
    tot.innerHTML = 'Total pagado: <b>' + (t ? esc(t) : '—') + '</b>';
  }

  /**
   * Guard de estado (decisión D7 + D2 de JC).
   *
   * El correo AFIRMA que el pago fue aplicado. JC lo dejó explícito para el caso
   * de varios recibos: "el envío de los recibos es solo cuando todos están
   * pagados, no existe esa opción". Así que TODOS tienen que decir "Pagado"; si
   * uno no lo está, se quita de la lista o no se envía. No hay forma de forzarlo.
   */
  function estadoOk() {
    if (!state.recibos.length) return false;
    return state.recibos.every(function (r) { return RenovacionParse.estaPagado(r.data.estado); });
  }

  function renderEstado() {
    var box = $('estadoBox');
    if (!box) return;

    if (!state.recibos.length) {
      box.className = 'estado-box warn';
      box.innerHTML = 'Cargá el comprobante de pago para revisar su estado.';
      renderNext2(); return;
    }

    var pendientes = state.recibos.filter(function (r) { return !RenovacionParse.estaPagado(r.data.estado); });

    if (!pendientes.length) {
      box.className = 'estado-box ok';
      box.innerHTML = state.recibos.length === 1
        ? '<b>✓ Comprobante pagado.</b> El INS lo reporta como <b>Pagado</b>, así que se puede enviar la confirmación.'
        : '<b>✓ Los ' + state.recibos.length + ' recibos están pagados.</b> Se puede enviar la confirmación.';
    } else {
      box.className = 'estado-box bad';
      box.innerHTML = '<b>⛔ ' + (pendientes.length === 1
          ? 'Hay un recibo que NO está pagado'
          : 'Hay ' + pendientes.length + ' recibos que NO están pagados') + '.</b> ' +
        'Esta pantalla solo envía recibos <b>ya pagados</b>: el correo le confirma al cliente que su pago fue aplicado. ' +
        'Quitá de la lista el que no corresponda (✕) y seguí con los demás.' +
        '<div style="margin-top:8px;font-size:12.5px;">' + pendientes.map(function (r) {
          return '· <span class="mono">' + esc(r.data.poliza || r.data.numComprobante || 'recibo') + '</span> → ' + esc(r.data.estado || 'sin estado');
        }).join('<br>') + '</div>';
    }

    // Plan familiar: los recibos vienen a nombre de distintas personas y eso es
    // NORMAL (D3 de JC). No se bloquea: se avisa para que el agente confirme
    // quién es el dueño del plan, que es a quien se dirige el correo.
    var titulares = [];
    state.recibos.forEach(function (r) {
      var c = (r.data.cliente || '').trim();
      if (c && titulares.indexOf(c) === -1) titulares.push(c);
    });
    if (titulares.length > 1) {
      box.innerHTML += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid currentColor;opacity:.9;">' +
        '<b>👪 Los recibos son de ' + titulares.length + ' titulares distintos</b> (plan familiar). ' +
        'El correo se dirige al <b>dueño del plan</b>: revisá arriba que el nombre y el saludo sean los suyos. ' +
        'En el detalle, cada póliza aparece con su asegurado.</div>';
    }
    renderNext2();
  }

  function renderNext2() {
    var btn = $('btnNext2');
    if (!btn) return;
    var ok = estadoOk();
    btn.disabled = !ok;
    btn.title = ok ? '' : 'Solo se pueden enviar recibos ya pagados.';
    btn.style.opacity = ok ? '' : '.5';
    btn.style.cursor = ok ? '' : 'not-allowed';
  }

  function renderDocs() {
    var ul = $('docList');
    if (!ul) return;
    if (!state.files.length) { ul.innerHTML = '<li class="doc-empty">Sin documentos cargados.</li>'; return; }
    ul.innerHTML = state.files.map(function (x, idx) {
      var esRecibo = state.recibos.some(function (r) { return r.srcName === x.name; });
      return '<li class="doc-item">' +
        '<span class="doc-ico">📄</span>' +
        '<span class="doc-meta"><span class="doc-name">' + esc(x.name) + '</span>' +
        '<span class="doc-size">' + fmtSize(x.size) + '</span></span>' +
        '<span class="doc-badge ' + (esRecibo ? 'std' : 'up') + '">' + (esRecibo ? 'Recibo' : 'Adjunto') + '</span>' +
        '<button class="doc-remove" data-idx="' + idx + '" title="Quitar" aria-label="Quitar">&times;</button>' +
      '</li>';
    }).join('');
    Array.prototype.forEach.call(ul.querySelectorAll('.doc-remove'), function (b) {
      b.addEventListener('click', function () {
        var quitado = state.files.splice(parseInt(b.getAttribute('data-idx'), 10), 1)[0];
        // Si el PDF quitado era un recibo, sus datos se van con él: dejarlos
        // permitiría un correo que habla de un comprobante que ya no se adjunta.
        if (quitado) {
          var antes = state.recibos.length;
          state.recibos = state.recibos.filter(function (r) { return r.srcName !== quitado.name; });
          if (state.recibos.length !== antes) {
            showToast('Quitaste un comprobante: su detalle sale del correo.', 'info');
          }
        }
        renderDocs(); renderRecibos(); renderEstado(); updateCount();
      });
    });
  }

  // ----- Vista 3: redactar -----
  function fillCompose() {
    _prefill('m-to', '');
    _prefill('m-subject', _asunto());
    _prefill('m-saludo', state.cliente.saludo || state.cliente.nombre || '');
    updateCount();
    updatePreview();
  }

  function _asunto() {
    if (state.recibos.length > 1) {
      return '✅ Su renovación está confirmada · ' + state.recibos.length + ' pólizas';
    }
    var p = state.recibos.length ? state.recibos[0].data.poliza : '';
    return '✅ Su renovación está confirmada' + (p ? ' · Póliza ' + p : '');
  }

  /** Solo pisa lo que el agente NO tocó (fillCompose corre en cada "Continuar"). */
  function _prefill(id, valor) {
    var el = $(id);
    if (!el) return;
    if (el.dataset.touched === '1') return;
    el.value = valor;
  }

  function updateCount() {
    var c = $('m-count'); if (c) c.textContent = String(state.files.length);
  }

  /**
   * Destinatarios: JC pidió poder mandarle el mismo correo a varias personas
   * (p. ej. esposo y esposa en un plan familiar). Se aceptan separados por coma,
   * punto y coma o espacio. Se limpian CR/LF para que nadie pueda inyectar
   * cabeceras en el MIME.
   */
  function destinatarios() {
    var crudo = ($('m-to') ? $('m-to').value : '').replace(/[\r\n]/g, ' ');
    return crudo.split(/[,;\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // ==================== Canal del aviso (19 ago 2026) ====================
  // Opción A aprobada por JC: hay clientes que se avisan SOLO por WhatsApp,
  // porque no tienen correo o no lo usan. El canal se elige arriba del paso 3 y
  // la pantalla se acomoda sola: los campos del correo llevan data-canal="correo"
  // y los del aviso data-canal="wa".

  function esSoloWa() { return state.canal === 'wa'; }

  /**
   * El alias corto de la guia se pide UNA sola vez y se guarda: el enlace /a
   * depende solo de la ficha del agente -- no del cliente --, asi que es el
   * mismo para todos los avisos y el servidor devuelve siempre el mismo id.
   *
   * Sirve para que la vista previa muestre el enlace QUE DE VERDAD SE MANDA.
   * Sin esto previsualizaba la URL larga (~180 caracteres) y el mensaje salia
   * con la corta: el agente veia una cosa y el cliente recibia otra.
   */
  function precargarGuiaCorta() {
    if (state.urlGuiaCorta || state.pidiendoGuia) return;
    state.pidiendoGuia = true;
    acortarEnlace(_renovAsistenciaUrl(), 'a').then(function (corto) {
      state.pidiendoGuia = false;
      state.urlGuiaCorta = corto || '';
      if (esSoloWa()) updatePreview();
      refreshWaBtn();
    }).catch(function () {
      // Si falla, waParams deja urlGuia vacio y el mensaje cae al enlace largo:
      // acortar nunca puede impedir que el agente avise.
      state.pidiendoGuia = false;
    });
  }

  /** Cambia el canal y acomoda el paso 3 completo (campos, boton y vista previa). */
  function setCanal(canal) {
    state.canal = canal === 'wa' ? 'wa' : 'ambos';
    var wa = esSoloWa();

    var ops = document.querySelectorAll('[data-canal-op]');
    for (var i = 0; i < ops.length; i++) {
      var on = ops[i].getAttribute('data-canal-op') === state.canal;
      ops[i].classList.toggle('is-on', on);
      ops[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    var zonas = document.querySelectorAll('[data-canal]');
    for (var j = 0; j < zonas.length; j++) {
      var soloCorreo = zonas[j].getAttribute('data-canal') === 'correo';
      zonas[j].hidden = wa ? soloCorreo : !soloCorreo;
    }

    var btn = $('btnSend');
    if (btn) btn.textContent = wa ? 'Preparar aviso por WhatsApp' : 'Autorizar Gmail y Enviar';

    var bajarTxt = $('bajarPdfTxt');
    if (bajarTxt) {
      bajarTxt.textContent = state.files.length > 1
        ? ('Descargar los ' + state.files.length + ' comprobantes')
        : 'Descargar comprobante';
    }

    if (wa) precargarGuiaCorta();
    updatePreview();
  }

  /**
   * Deja el comprobante en la maquina para arrastrarlo al chat: WhatsApp no
   * permite adjuntar archivos desde un enlace, asi que sin correo este es el
   * unico camino por el que el cliente recibe su PDF.
   */
  function bajarComprobantes() {
    if (!state.files.length) { showToast('No hay comprobante cargado.', 'error'); return; }
    state.files.forEach(function (f, i) {
      // Escalonadas: varias descargas en el mismo tick las bloquea el navegador.
      setTimeout(function () {
        var url = URL.createObjectURL(f.file);
        var a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      }, i * 400);
    });
    showToast(state.files.length > 1
      ? ('Descargando ' + state.files.length + ' comprobantes…')
      : 'Descargando el comprobante…', 'info');
  }

  /**
   * Salida del paso 3 cuando NO hay correo: no se envia nada, se pasa derecho al
   * aviso. El guard de estado ya corrio en send(), igual que en el camino largo.
   */
  function irAvisoWa() {
    var pre = $('m-wa-pre');
    var v4 = $('m-wa-cliente');
    if (pre && v4) v4.value = pre.value;   // el telefono se digito en el paso 3

    state.waEnviado = false;
    refreshWaBtn();

    var wrap = $('waShareWrap');
    if (wrap) wrap.style.display = 'flex';
    // Pedir el telefono otra vez seria pedir dos veces lo mismo.
    var telWrap = $('waTelWrap');
    if (telWrap) telWrap.hidden = true;

    var t = $('successTitle');
    if (t) t.textContent = '¡Renovación confirmada!';
    var m = $('successMsg');
    if (m) {
      m.textContent = 'No se envió correo. Avisale por WhatsApp y adjuntale '
        + (state.recibos.length > 1 ? 'los comprobantes' : 'el comprobante') + ' en el chat.';
    }

    setStep(4);
  }

  function currentEmailParams() {
    return {
      nombrePila: ($('m-saludo') ? $('m-saludo').value.trim() : '') || state.cliente.saludo || state.cliente.nombre || '',
      cliente:    state.cliente.nombre || '',
      recibos:    state.recibos.map(function (r) {
        return {
          poliza: r.data.poliza, placa: r.data.placa, vehiculo: r.data.vehiculo,
          periodoDesde: r.data.periodoDesde, periodoHasta: r.data.periodoHasta,
          montoTexto: r.data.montoTexto, monto: r.data.monto, asegurado: r.data.cliente
        };
      }),
      numComprobante: state.recibos.length === 1 ? state.recibos[0].data.numComprobante : '',
      fechaPago:      state.recibos.length ? state.recibos[0].data.fechaPago : '',
      totalTexto:     state.recibos.length > 1 ? totalTexto() : '',
      notaAdicional:  $('m-nota') ? $('m-nota').value : ''
    };
  }

  function updatePreview() {
    // Previsualizar un correo que no se va a enviar seria enganar al agente.
    if (esSoloWa()) {
      var prev = $('waPrev');
      if (prev) prev.textContent = buildRenovacionWaTexto(waParams());
      return;
    }
    var fr = $('preview');
    if (fr) fr.srcdoc = buildRenovacionEmail(currentEmailParams());
  }

  /** Datos del aviso por WhatsApp: los MISMOS del correo + el teléfono. */
  function waParams() {
    var p = currentEmailParams();
    // En solo-WhatsApp el telefono se digita en el paso 3 (m-wa-pre); en el
    // camino con correo, en la pantalla de exito (m-wa-cliente).
    var pre = $('m-wa-pre');
    var waIn = $('m-wa-cliente');
    p.telCliente = (esSoloWa() && pre && pre.value.trim()) ? pre.value : (waIn ? waIn.value : '');
    p.sinCorreo = esSoloWa();
    // Vacio = todavia no llego el alias corto: buildRenovacionWaTexto cae al largo.
    if (state.urlGuiaCorta) p.urlGuia = state.urlGuiaCorta;
    return p;
  }

  /** Deja el enlace LARGO en el href: vale si el acortador falla o si el clic no pasa por el handler. */
  function refreshWaBtn() {
    var btn = $('btnWhatsApp');
    if (btn) btn.href = buildRenovacionWaUrl(waParams());
  }

  /** Clic en "Avisar por WhatsApp": acorta la guía y recién ahí abre el chat. */
  function shareWa(ev) {
    ev.preventDefault();
    state.waEnviado = true;
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
      showToast('Solo se pueden enviar recibos ya pagados.', 'error');
      setStep(2); return;
    }
    if (!state.files.length) {
      showToast('Adjuntá el comprobante de pago.', 'error');
      return;
    }

    // Solo WhatsApp: no hay correo que enviar. Se salta el envio y se pasa
    // derecho al aviso -- pero DESPUES del guard de estado de arriba, que es el
    // que impide confirmarle a un cliente un pago que no entro.
    if (esSoloWa()) { irAvisoWa(); return; }

    var para = destinatarios();
    var mal = para.filter(function (c) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c); });
    if (!para.length || mal.length) {
      showToast(mal.length ? ('Revisá este correo: ' + mal[0]) : 'Ingresá el correo del cliente.', 'error');
      $('m-to').focus(); return;
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
      var subject = ($('m-subject').value.trim() || _asunto()).replace(/[\r\n]/g, ' ');
      var fromHeader = CFG.FROM_NAME ? ('"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>') : CFG.FROM_EMAIL;

      var raw = buildMIMEMulti({
        to: para.join(', '),          // varios destinatarios en el mismo correo
        from: fromHeader, subject: subject, html: html, attachments: attachments
      });

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

      var t4 = $('successTitle');
      if (t4) t4.textContent = '¡Comprobante enviado!';
      var telWrap4 = $('waTelWrap');
      if (telWrap4) telWrap4.hidden = false;
      $('successMsg').textContent = (state.recibos.length > 1
        ? 'Los ' + state.recibos.length + ' comprobantes fueron enviados a '
        : 'El comprobante de renovación fue enviado a ') + para.join(' y ') + '.';

      // Aviso por WhatsApp. Nada de esto puede tumbar el flujo: el correo YA salió.
      try {
        state.waEnviado = false;
        var waIn = $('m-wa-cliente');
        if (waIn) waIn.value = '';
        refreshWaBtn();
        var wrap = $('waShareWrap');
        if (wrap) wrap.style.display = 'flex';
      } catch (e) { console.warn('[renovacion] aviso WhatsApp:', e); }

      setStep(4);
      showToast('✅ Enviado a ' + para.join(', '), 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al enviar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  /**
   * Salir de la pantalla de éxito. Si todavía no se avisó por WhatsApp, se
   * pregunta —con opción de seguir igual, como pidió JC—: el botón borra el
   * aviso y habría que escribirlo a mano.
   */
  function confirmarSalida() {
    if (state.waEnviado) return true;
    var wrap = $('waShareWrap');
    if (!wrap || wrap.style.display === 'none') return true;
    return window.confirm('Todavía no le avisaste al cliente por WhatsApp.\n\nSi continuás, ese aviso se pierde y habría que escribirlo a mano.\n\n¿Continuar igual?');
  }

  /** "Enviar otro recibo — mismo cliente": conserva a quién se le envía. */
  function otroDelMismo() {
    if (!confirmarSalida()) return;
    limpiarCarga(true);
    if ($('waShareWrap')) $('waShareWrap').style.display = 'none';
    if ($('waTelWrap')) $('waTelWrap').hidden = false;
    if ($('m-wa-pre')) $('m-wa-pre').value = '';
    state.waEnviado = false;
    if ($('m-nota')) $('m-nota').value = '';
    if ($('m-wa-cliente')) $('m-wa-cliente').value = '';
    // El asunto se vuelve a proponer con la póliza del recibo nuevo; el correo y
    // el saludo del cliente se conservan.
    var subj = $('m-subject'); if (subj) { subj.value = ''; delete subj.dataset.touched; }
    showToast('Listo: cargá el otro recibo de ' + (state.cliente.saludo || 'este cliente') + '.', 'info');
    setStep(1);
  }

  /** "Enviar a otro cliente": borra todo y empieza de cero. */
  function resetAll() {
    if (!confirmarSalida()) return;
    limpiarCarga(false);
    state.waEnviado = false;
    if ($('m-nota')) $('m-nota').value = '';
    if ($('m-wa-cliente')) $('m-wa-cliente').value = '';
    if ($('waShareWrap')) $('waShareWrap').style.display = 'none';
    if ($('waTelWrap')) $('waTelWrap').hidden = false;
    if ($('m-wa-pre')) $('m-wa-pre').value = '';
    ['m-to', 'm-subject', 'm-saludo'].forEach(function (id) {
      var el = $(id); if (el) { el.value = ''; delete el.dataset.touched; }
    });
    if ($('f-cliente')) $('f-cliente').value = '';
    if ($('f-saludo'))  $('f-saludo').value = '';
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

    // 🔴 Sin perfil configurado, CFG conserva los defaults del dueño y el correo
    // saldría firmado con SU nombre y SU licencia SUGESE. La consola principal ya
    // obliga a configurarlo (app.js abre el modal ⚙); esta sub-página no tiene ⚙,
    // así que manda de vuelta al inicio a configurarlo.
    try {
      if (typeof isFirstTime === 'function' && isFirstTime()) {
        showToast('Configurá tu perfil de agente antes de enviar correos.', 'error');
        var bs = $('btnSend'); if (bs) bs.disabled = true;
        setTimeout(function () { location.href = '../'; }, 2500);
        return;
      }
    } catch (e) {}

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

    // "Volver" es el camino natural cuando el agente se equivocó de comprobante:
    // deja la carga en blanco para que el próximo PDF entre limpio.
    $('btnBack2').addEventListener('click', function () { limpiarCarga(false); setStep(1); });
    $('btnNext2').addEventListener('click', function () {
      syncReview();
      if (!estadoOk()) { showToast('Solo se pueden enviar recibos ya pagados.', 'error'); return; }
      fillCompose();
      setStep(3);
    });
    $('btnBack3').addEventListener('click', function () { setStep(2); });
    $('btnSend').addEventListener('click', send);
    $('btnReset').addEventListener('click', otroDelMismo);
    if ($('btnOtroCliente')) $('btnOtroCliente').addEventListener('click', resetAll);

    // Al corregir el nombre del dueño del plan, se repinta el detalle (la nota
    // "Asegurado:" de cada recibo depende de ese nombre).
    ['f-cliente', 'f-saludo'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { syncCliente(); renderRecibos(); });
    });

    var waIn = $('m-wa-cliente');
    if (waIn) waIn.addEventListener('input', function () { refreshWaBtn(); });

    var sw = $('canalSw');
    if (sw) sw.addEventListener('click', function (ev) {
      var op = ev.target && ev.target.closest ? ev.target.closest('[data-canal-op]') : null;
      if (op) setCanal(op.getAttribute('data-canal-op'));
    });

    var bajar = $('btnBajarPdf');
    if (bajar) bajar.addEventListener('click', bajarComprobantes);

    var waPre = $('m-wa-pre');
    if (waPre) waPre.addEventListener('input', function () { updatePreview(); refreshWaBtn(); });

    var waBtn = $('btnWhatsApp');
    if (waBtn) waBtn.addEventListener('click', shareWa);

    // Vista previa en vivo al editar el correo
    ['m-saludo', 'm-nota'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('input', updatePreview);
    });
    // Marca los campos que tocó el agente para que fillCompose no los pise.
    ['m-to', 'm-subject', 'm-saludo'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { el.dataset.touched = '1'; });
    });

    renderDocs();
    renderRecibos();
    renderEstado();   // deja "Continuar" bloqueado hasta que haya recibos pagados
    setStep(1);
  });
})();
