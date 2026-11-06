/**
 * Cotizador SDI · Cuadro "Fotos para asegurar" (6 nov 2026)
 *
 * Manda el correo "Paso 1 · Fotografías" (fotos-email.js). Se abre de dos
 * formas (mockup aprobado por JC, F1):
 *   - desde el botón 📷 Fotos de una fila de Cotizaciones: nombre, correo,
 *     placa, vehículo y WhatsApp llegan llenos y se pueden corregir;
 *   - desde "+ Fotos a un cliente que no está en la lista": el mismo cuadro vacío.
 * En los dos casos el agente pega el enlace del INS, que cambia por cliente.
 * Solo se acepta uno de asegurarte.grupoins.com.
 *
 * Al enviar desde una fila, la cotización queda marcada "📷 Fotos enviadas"
 * (F3, marcarFotosEnviadas en history.js). Un cliente manual no entra al registro.
 *
 * Depende de: fotos-email.js, email-marca.js (_placaEsRelleno), history.js,
 * wizard.js (esEmailValido, enviarConReintento), mime-builder.js
 * (buildMIMESimple) y showToast. Cada id se busca con guard: un id inexistente
 * no puede tumbar el arranque (render cascade failure del proyecto).
 * Orden de carga: después de fotos-email.js y antes de app.js.
 */

var _fotosEntryId = null;   // id de la cotización de origen; null = cliente manual
var _fotosUltimo  = null;   // parámetros del último envío, para el WhatsApp
var _fotosPrevTimer = null;
var _FOTOS_CAMPOS = ['fo-nom', 'fo-placa', 'fo-veh', 'fo-mail', 'fo-link', 'fo-wa', 'fo-nota'];

function _foEl(id) { return document.getElementById(id); }
function _foVal(id) { var el = _foEl(id); return el ? String(el.value || '').trim() : ''; }
function _foSet(id, v) { var el = _foEl(id); if (el) el.value = v == null ? '' : String(v); }

/** Lo que hay en el cuadro, normalizado. Una sola fuente para vista previa, envío y WhatsApp. */
function _fotosParams() {
  return {
    nombrePila:    _foVal('fo-nom'),
    placa:         _foVal('fo-placa').toUpperCase(),
    vehiculo:      _foVal('fo-veh'),
    correo:        _foVal('fo-mail'),
    enlace:        _foVal('fo-link'),
    telCliente:    _foVal('fo-wa'),
    notaAdicional: _foVal('fo-nota')
  };
}

/**
 * Los datos de una cotización del registro, como los pide el cuadro.
 * PURA (sin DOM) para poder probarla en Node.
 */
function fotosDatosDeCotizacion(e) {
  var x = e || {};
  var placa = typeof historyEntryPlate === 'function' ? historyEntryPlate(x) : String(x.plate || '');
  // El relleno del cero kilómetros (000111) no es la placa del cliente.
  if (typeof _placaEsRelleno === 'function' && _placaEsRelleno(placa)) placa = '';
  return {
    nombrePila: String(x.client || '').trim(),
    placa:      String(placa || '').trim().toUpperCase(),
    vehiculo:   String(x.vehicle || '').trim(),
    correo:     String(x.email || '').trim(),
    telCliente: String(x.waCliente || '').trim()
  };
}

/** Abre el cuadro. Con una cotización, lo llena; sin ella, queda vacío (cliente manual). */
function openFotosModal(entry) {
  var m = _foEl('fotosModal');
  if (!m) return;
  _fotosReset();
  var desde = _foEl('fotosDesde'), titulo = _foEl('fotosTitulo');
  if (entry && entry.id) {
    _fotosEntryId = entry.id;
    var d = fotosDatosDeCotizacion(entry);
    _foSet('fo-nom', d.nombrePila); _foSet('fo-placa', d.placa); _foSet('fo-veh', d.vehiculo);
    _foSet('fo-mail', d.correo);    _foSet('fo-wa', d.telCliente);
    var f = entry.date ? new Date(entry.date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
    if (desde) desde.textContent = 'Datos tomados de la cotización' + (f ? ' del ' + f : '') + '. Podés corregirlos.';
    if (titulo) titulo.textContent = 'Fotos para asegurar';
  } else {
    if (desde) desde.textContent = 'Este cliente no está en tu lista. Escribí sus datos.';
    if (titulo) titulo.textContent = 'Fotos para asegurar · cliente nuevo';
  }
  _fotosRepintar();
  m.classList.add('active');
  // El foco va al primer campo que falta: casi siempre el enlace del INS.
  var foco = _foEl(entry && entry.id ? 'fo-link' : 'fo-nom');
  if (foco) setTimeout(function () { foco.focus(); }, 50);
}

function closeFotosModal() {
  var m = _foEl('fotosModal');
  if (m) m.classList.remove('active');
}

function _fotosReset() {
  _FOTOS_CAMPOS.forEach(function (id) { _foSet(id, ''); });
  _fotosEntryId = null;
  _fotosUltimo = null;
  var form = _foEl('fotosForm'), done = _foEl('fotosDone');
  if (form) form.hidden = false;
  if (done) done.hidden = true;
  var btn = _foEl('btnFotosSend');
  if (btn) { btn.disabled = false; btn.textContent = 'Enviar correo'; }
}

/** Aviso bajo el campo del enlace: verde si es del INS, rojo si no. */
function _fotosPintarEnlace() {
  var v = _foVal('fo-link'), ok = _foEl('fo-link-ok'), inp = _foEl('fo-link');
  var bien = esEnlaceFotosIns(v);
  if (ok) {
    ok.className = 'asi-hint' + (v ? (bien ? ' fo-ok' : ' fo-mal') : '');
    ok.textContent = !v ? 'Pegá el enlace que te da la plataforma del INS para este cliente.'
      : bien ? '✓ Enlace de la plataforma del INS'
      : 'Este enlace no es de la plataforma del INS (asegurarte.grupoins.com).';
  }
  if (inp) inp.classList.toggle('fo-inp-mal', !!v && !bien);
}

function _fotosRepintar() {
  _fotosPintarEnlace();
  clearTimeout(_fotosPrevTimer);
  _fotosPrevTimer = setTimeout(function () {
    var box = _foEl('fo-prev');
    if (!box) return;
    var iframe = box.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = 'none';
      // Sin allow-scripts: el correo es HTML estático, nada debe ejecutarse aquí.
      iframe.setAttribute('sandbox', 'allow-same-origin allow-popups');
      box.innerHTML = '';
      box.appendChild(iframe);
    }
    iframe.srcdoc = buildFotosEmail(_fotosParams());
  }, 250);
}

async function _fotosEnviar() {
  var p = _fotosParams();
  var foco = function (id) { var el = _foEl(id); if (el) el.focus(); };
  if (!p.nombrePila) { showToast('Escribí el nombre de pila del cliente.', 'error'); foco('fo-nom'); return; }
  if (!esEmailValido(p.correo)) { showToast('El correo del cliente no parece válido.', 'error'); foco('fo-mail'); return; }
  if (!esEnlaceFotosIns(p.enlace)) { showToast('Pegá el enlace de la plataforma del INS (asegurarte.grupoins.com).', 'error'); foco('fo-link'); return; }

  var btn = _foEl('btnFotosSend');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    var raw = buildMIMESimple({
      to:      p.correo,
      from:    '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>',
      subject: fotosAsunto(p),
      html:    buildFotosEmail(p)
    });
    await enviarConReintento(raw);
    _fotosUltimo = p;
    showToast('Correo enviado a ' + p.correo, 'success');
    // La marca en la fila no puede tumbar el éxito: el correo ya salió.
    try {
      if (_fotosEntryId && marcarFotosEnviadas(_fotosEntryId) && typeof renderStats === 'function') renderStats();
    } catch (err) { console.warn('[fotos] no se pudo marcar la cotización:', err); }
    var form = _foEl('fotosForm'), done = _foEl('fotosDone'), msg = _foEl('fotosDoneMsg');
    if (msg) msg.textContent = 'El correo salió a ' + p.correo + '. Si querés, avisale también por WhatsApp.';
    if (form) form.hidden = true;
    if (done) done.hidden = false;
    var wa = _foEl('btnFotosWa');
    if (wa) wa.href = buildFotosWaUrl(p);
  } catch (err) {
    console.error('[fotos] envio fallo:', err);
    showToast('No se pudo enviar: ' + (err && err.message ? err.message : err), 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar correo'; }
  }
}

/** Engancha los controles. La llama app.js en el DOMContentLoaded, con guard typeof. */
function initFotosModal() {
  var on = function (id, ev, fn) { var el = _foEl(id); if (el) el.addEventListener(ev, fn); };
  on('btnFotosNuevo',    'click', function () { openFotosModal(null); });
  on('btnFotosClose',    'click', closeFotosModal);
  on('btnFotosCancel',   'click', closeFotosModal);
  on('btnFotosSend',     'click', _fotosEnviar);
  on('btnFotosVolver',   'click', closeFotosModal);
  on('btnFotosDoneClose','click', closeFotosModal);
  _FOTOS_CAMPOS.forEach(function (id) { on(id, 'input', _fotosRepintar); });
  var m = _foEl('fotosModal');
  if (m) m.addEventListener('click', function (e) { if (e.target === m) closeFotosModal(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fotosDatosDeCotizacion: fotosDatosDeCotizacion, initFotosModal: initFotosModal };
}
