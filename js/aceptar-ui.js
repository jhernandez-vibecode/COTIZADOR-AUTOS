/**
 * Cotizador SDI · Cuadro "Guía para aceptar la póliza" (19 nov 2026)
 *
 * Mockup aprobado por JC el 19 nov 2026. Se abre de dos formas, como Fotos:
 *   - desde el botón ✍ Aceptar póliza de una fila de Cotizaciones (datos llenos);
 *   - desde "+ Guía de aceptación a un cliente que no está en la lista" (vacío).
 * No manda correo: arma el mensaje de WhatsApp con el enlace corto a /aceptar/
 * (aceptar-wa.js) y lo abre o lo copia. No toca el registro.
 *
 * Depende de: aceptar-wa.js, shortlink.js (acortarEnlace) y showToast.
 * Cada id se busca con guard: un id inexistente no puede tumbar el arranque.
 * Orden de carga: después de aceptar-wa.js y antes de app.js.
 */

var _AC_CAMPOS = ['ac-nom', 'ac-placa', 'ac-veh', 'ac-wa'];
var _acTimer = null;
var _acCortos = {};          // URL larga → corta, para no pedirla dos veces

function _acEl(id) { return document.getElementById(id); }
function _acVal(id) { var el = _acEl(id); return el ? String(el.value || '').trim() : ''; }
function _acSet(id, v) { var el = _acEl(id); if (el) el.value = v == null ? '' : String(v); }

/** Lo que hay en el cuadro. Una sola fuente para la vista previa, copiar y WhatsApp. */
function _acParams() {
  var k0 = _acEl('ac-0km');
  return {
    nombrePila: _acVal('ac-nom'),
    placa:      _acVal('ac-placa').toUpperCase(),
    vehiculo:   _acVal('ac-veh'),
    telCliente: _acVal('ac-wa'),
    ceroKm:     !!(k0 && k0.checked)
  };
}

/** La URL que va en el mensaje: la corta si ya se tiene, si no la larga. */
function _acUrlActual(p) {
  var larga = aceptarGuiaUrl(p);
  return _acCortos[larga] || larga;
}

async function _acAcortar(p) {
  var larga = aceptarGuiaUrl(p);
  if (!larga) return '';
  if (_acCortos[larga]) return _acCortos[larga];
  var corta = typeof acortarEnlace === 'function' ? await acortarEnlace(larga, 'k') : larga;
  if (corta && corta !== larga) _acCortos[larga] = corta;
  return corta || larga;
}

function _acPintar() {
  var p = _acParams();
  var box = _acEl('ac-msg');
  if (box) box.textContent = buildAceptarWaTexto(Object.assign({}, p, { urlGuia: _acUrlActual(p) }));
}

/** Repinta ya y, al dejar de teclear, pide el enlace corto para mostrarlo. */
function _acRepintar() {
  _acPintar();
  clearTimeout(_acTimer);
  _acTimer = setTimeout(function () { _acAcortar(_acParams()).then(_acPintar); }, 700);
}

function openAceptarModal(entry) {
  var m = _acEl('aceptarModal');
  if (!m) return;
  _AC_CAMPOS.forEach(function (id) { _acSet(id, ''); });
  var k0 = _acEl('ac-0km');
  var desde = _acEl('aceptarDesde');
  if (entry && entry.id) {
    var d = aceptarDatosDeCotizacion(entry);
    _acSet('ac-nom', d.nombrePila); _acSet('ac-placa', d.placa);
    _acSet('ac-veh', d.vehiculo);   _acSet('ac-wa', d.telCliente);
    if (k0) k0.checked = d.ceroKm;
    var f = entry.date ? new Date(entry.date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
    if (desde) desde.textContent = 'Datos tomados de la cotización' + (f ? ' del ' + f : '') + '. Podés corregirlos.';
  } else {
    if (k0) k0.checked = false;
    if (desde) desde.textContent = 'Este cliente no está en tu lista. Escribí sus datos.';
  }
  _acRepintar();
  m.classList.add('active');
  var foco = _acEl(entry && entry.id ? 'ac-wa' : 'ac-nom');
  if (foco) setTimeout(function () { foco.focus(); }, 50);
}

function closeAceptarModal() {
  var m = _acEl('aceptarModal');
  if (m) m.classList.remove('active');
}

/** Abre WhatsApp. La pestaña se reserva ANTES del await o el navegador la bloquea. */
async function _acAbrirWa() {
  var p = _acParams();
  if (!p.nombrePila) { showToast('Escribí el nombre de pila del cliente.', 'error'); var n = _acEl('ac-nom'); if (n) n.focus(); return; }
  var tab = window.open('', '_blank');
  var url = buildAceptarWaUrl(Object.assign({}, p, { urlGuia: await _acAcortar(p) }));
  _acPintar();
  if (tab) { try { tab.opener = null; } catch (e) {} tab.location.href = url; }
  else window.open(url, '_blank', 'noopener');
}

async function _acCopiar() {
  var p = _acParams();
  if (!p.nombrePila) { showToast('Escribí el nombre de pila del cliente.', 'error'); var n = _acEl('ac-nom'); if (n) n.focus(); return; }
  var texto = buildAceptarWaTexto(Object.assign({}, p, { urlGuia: await _acAcortar(p) }));
  _acPintar();
  try {
    await navigator.clipboard.writeText(texto);
    showToast('Mensaje copiado. Pegalo en el chat del cliente.', 'success');
  } catch (e) {
    window.prompt('Copiá el mensaje:', texto);
  }
}

/** Engancha los controles. La llama app.js en el DOMContentLoaded, con guard typeof. */
function initAceptarModal() {
  var on = function (id, ev, fn) { var el = _acEl(id); if (el) el.addEventListener(ev, fn); };
  on('btnAceptarNuevo',  'click', function () { openAceptarModal(null); });
  on('btnAceptarClose',  'click', closeAceptarModal);
  on('btnAceptarCopiar', 'click', _acCopiar);
  on('btnAceptarWa',     'click', _acAbrirWa);
  _AC_CAMPOS.forEach(function (id) { on(id, 'input', _acRepintar); });
  on('ac-0km', 'change', _acRepintar);
  var m = _acEl('aceptarModal');
  if (m) m.addEventListener('click', function (e) { if (e.target === m) closeAceptarModal(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initAceptarModal: initAceptarModal, openAceptarModal: openAceptarModal };
}
