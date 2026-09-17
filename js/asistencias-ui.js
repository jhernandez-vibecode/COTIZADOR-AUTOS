/**
 * Cotizador SDI · Modal "Asistencias a cliente con póliza"
 *
 * Cuarto envío de la consola (17 set 2026). Sin PDF: el agente escribe nombre
 * de pila, correo, la prima anual vigente (con IVA, la del recibo) y la forma
 * de pago; opcionalmente el vehículo, el WhatsApp y una nota. A la derecha ve
 * el correo armarse en vivo. Al enviar, el modal pasa a la pantalla de éxito
 * con 1 · Avisar por WhatsApp (enlace corto /p con la prima adentro) y
 * 2 · Otro cliente.
 *
 * Decisión D4 de JC: NO entra al registro de Cotizaciones. Por eso este
 * módulo no toca history.js.
 *
 * Solo depende de: asistencias-email.js (buildAsistenciasEmail / WA),
 * email-template.js (_buildPlanesUrl), wizard.js (esEmailValido,
 * enviarConReintento), mime-builder.js (buildMIMESimple), shortlink.js
 * (acortarEnlace) y showToast. Nada de app.js. Cada id se busca con guard:
 * un id inexistente no puede tumbar el arranque de la consola (render
 * cascade failure del proyecto).
 *
 * Orden de carga: después de asistencias-email.js y antes de app.js.
 */

var _asiFp = 'a';
var _asiUltimo = null;      // { nombre, urlPlanes, prima, tel } del último envío, para el WhatsApp
var _asiPrevTimer = null;

function _asiEl(id) { return document.getElementById(id); }
function _asiVal(id) { var el = _asiEl(id); return el ? String(el.value || '').trim() : ''; }

/** Lo que el agente tecleó, ya normalizado. Una sola fuente para preview, envío y WhatsApp. */
function _asiParams() {
  var prima = asiParseMonto(_asiVal('as-prima'));
  return {
    nombrePila:    _asiVal('as-nom'),
    correo:        _asiVal('as-mail'),
    primaVigente:  prima,
    formaPago:     _asiFp,
    vehiculo:      _asiVal('as-veh'),
    telCliente:    _asiVal('as-wa'),
    notaAdicional: _asiVal('as-nota'),
    urlPlanes:     _buildPlanesUrl({ clientName: _asiVal('as-nom'), vehicle: _asiVal('as-veh'), primaVigente: prima, formaPago: _asiFp })
  };
}

function openAsistenciasModal() {
  var m = _asiEl('asiModal');
  if (!m) return;
  _asiReset();
  m.classList.add('active');
  var nom = _asiEl('as-nom');
  if (nom) setTimeout(function () { nom.focus(); }, 50);
}

function closeAsistenciasModal() {
  var m = _asiEl('asiModal');
  if (m) m.classList.remove('active');
}

/** Vuelve el modal al formulario vacío (también al elegir "Otro cliente"). */
function _asiReset() {
  ['as-nom', 'as-mail', 'as-prima', 'as-veh', 'as-wa', 'as-nota'].forEach(function (id) {
    var el = _asiEl(id); if (el) el.value = '';
  });
  _asiSetFp('a');
  _asiUltimo = null;
  var form = _asiEl('asiForm'), done = _asiEl('asiDone');
  if (form) form.hidden = false;
  if (done) done.hidden = true;
  var btn = _asiEl('btnAsiSend');
  if (btn) { btn.disabled = false; btn.textContent = 'Enviar correo'; }
  _asiRepintar();
}

function _asiSetFp(fp) {
  _asiFp = /^[astm]$/.test(fp) ? fp : 'a';
  var btns = document.querySelectorAll('#as-fp [data-fp]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-fp') === _asiFp ? 'true' : 'false');
  }
}

/** Resumen numérico + vista previa. Debounced: el iframe no se rehace en cada tecla. */
function _asiRepintar() {
  var p = _asiParams();
  var col = function (n) { return '₡' + Math.round(n).toLocaleString('de-DE'); };
  var hoy = _asiEl('as-r-hoy'), min = _asiEl('as-r-min'), max = _asiEl('as-r-max');
  var todos = PLANES_ASI.reduce(function (a, pl) { return a + pl.prima; }, 0);
  if (hoy) hoy.textContent = p.primaVigente > 0 ? col(p.primaVigente) : '—';
  // Con el recargo por fraccionamiento de la forma de pago elegida y el IVA.
  if (min) min.textContent = p.primaVigente > 0 ? col(p.primaVigente + asiCosto(asiDesde(), _asiFp).anual) : '—';
  if (max) max.textContent = p.primaVigente > 0 ? col(p.primaVigente + asiCosto(todos, _asiFp).anual) : '—';

  clearTimeout(_asiPrevTimer);
  _asiPrevTimer = setTimeout(function () {
    var box = _asiEl('as-prev');
    if (!box) return;
    var html = buildAsistenciasEmail(p);
    var iframe = box.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = 'none';
      // Sin allow-scripts: el correo es HTML estático, nada debe ejecutarse aquí.
      iframe.setAttribute('sandbox', 'allow-same-origin allow-popups');
      box.innerHTML = '';
      box.appendChild(iframe);
    }
    iframe.srcdoc = html;
  }, 250);
}

async function _asiEnviar() {
  var p = _asiParams();
  if (!p.nombrePila) { showToast('Escribí el nombre de pila del cliente.', 'error'); var n = _asiEl('as-nom'); if (n) n.focus(); return; }
  if (!esEmailValido(p.correo)) { showToast('El correo del cliente no parece válido.', 'error'); var m = _asiEl('as-mail'); if (m) m.focus(); return; }
  if (!(p.primaVigente > 0)) { showToast('Escribí la prima anual vigente (la del recibo, con IVA).', 'error'); var pr = _asiEl('as-prima'); if (pr) pr.focus(); return; }

  var btn = _asiEl('btnAsiSend');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    var html = buildAsistenciasEmail(p);
    var raw = buildMIMESimple({
      to:      p.correo,
      from:    '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>',
      subject: p.nombrePila + ', ahora podés sumarle asistencias a tu seguro de autos',
      html:    html
    });
    await enviarConReintento(raw);
    _asiUltimo = p;
    showToast('Correo enviado a ' + p.correo, 'success');
    var form = _asiEl('asiForm'), done = _asiEl('asiDone'), msg = _asiEl('asiDoneMsg');
    if (msg) msg.textContent = 'El correo salió a ' + p.correo + '. Si querés, avisale también por WhatsApp.';
    if (form) form.hidden = true;
    if (done) done.hidden = false;
    var wa = _asiEl('btnAsiWa');
    if (wa) wa.href = buildAsistenciasWaUrl(p);     // largo como red de seguridad; el clic acorta
  } catch (err) {
    console.error('[asistencias] envio fallo:', err);
    showToast('No se pudo enviar: ' + (err && err.message ? err.message : err), 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar correo'; }
  }
}

/** El clic del WhatsApp: reserva la pestaña ANTES del await y acorta el enlace (/p). */
function _asiWaClick(ev) {
  if (!_asiUltimo) return;
  ev.preventDefault();
  var p = _asiUltimo;
  var win = window.open('', '_blank');
  acortarEnlace(p.urlPlanes, 'p').then(function (corto) {
    var url = buildAsistenciasWaUrl(Object.assign({}, p, { urlPlanes: corto }));
    if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
  });
}

/** Engancha los controles. La llama app.js en el DOMContentLoaded, con guard typeof. */
function initAsistenciasModal() {
  var on = function (id, ev, fn) { var el = _asiEl(id); if (el) el.addEventListener(ev, fn); };
  on('btnAsistencias', 'click', openAsistenciasModal);
  on('btnAsiClose',    'click', closeAsistenciasModal);
  on('btnAsiCancel',   'click', closeAsistenciasModal);
  on('btnAsiSend',     'click', _asiEnviar);
  on('btnAsiWa',       'click', _asiWaClick);
  on('btnAsiOtro',     'click', _asiReset);
  on('btnAsiDoneClose','click', closeAsistenciasModal);
  ['as-nom', 'as-mail', 'as-prima', 'as-veh', 'as-nota'].forEach(function (id) { on(id, 'input', _asiRepintar); });
  var fp = _asiEl('as-fp');
  if (fp) fp.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fp]');
    if (!b) return;
    _asiSetFp(b.getAttribute('data-fp'));
    _asiRepintar();
  });
  var m = _asiEl('asiModal');
  if (m) m.addEventListener('click', function (e) { if (e.target === m) closeAsistenciasModal(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _asiParams: _asiParams, initAsistenciasModal: initAsistenciasModal };
}
