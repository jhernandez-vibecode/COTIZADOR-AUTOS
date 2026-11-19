/**
 * Cotizador SDI · Guía para aceptar la póliza (19 nov 2026)
 *
 * Después de las fotos, el INS le manda al cliente un correo con un enlace y un
 * token para aceptar la póliza, y muchos se enredan. Esta guía le explica los
 * 6 pasos. Va SOLO por WhatsApp: el correo del token ya lo manda el INS.
 *
 *   aceptarGuiaUrl(p)        → /aceptar/ con la ficha del agente (n, l, w, wa,
 *                               em, cg), el nombre de pila (c) y el cero km (k0).
 *   buildAceptarWaTexto(p)   → el mensaje que redactó Claude y aprobó JC en el mockup.
 *   buildAceptarWaUrl(p)     → web.whatsapp.com/send/ (NUNCA wa.me).
 *   aceptarDatosDeCotizacion → los datos de una fila de Cotizaciones. PURA.
 *
 * La ficha sale de CFG (el perfil del ⚙), así que cada agente manda la suya:
 * José y Melanie salen como «Asesor/Asesora de Seguros · Oficina de Fernando
 * Hernández, agente» por SDI_ASESORES (email-marca.js).
 *
 * Depende de: config.js, email-marca.js (_cgAsesor, _asesor, _placaEsRelleno)
 * y history.js (historyEntryPlate). Todo con guard typeof.
 */

var ACEPTAR_ASUNTO_INS = 'Aceptación de proceso para emisión AutoVoluntario – INS';

/** 8 dígitos → 506XXXXXXXX; cualquier otro largo se deja como venga (solo dígitos). */
function _acWaIntl(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length === 8 ? '506' + d : d;
}

/** URL larga de la guía para este cliente, con la ficha del agente del perfil. */
function aceptarGuiaUrl(p) {
  var o = p || {};
  var base = String((typeof CFG !== 'undefined' && CFG.ACEPTAR_URL) || '').trim();
  if (!/^https?:\/\//i.test(base)) return '';
  var C = typeof CFG !== 'undefined' ? CFG : {};
  // web: valor crudo del perfil, sin el https:// (lo muestra la página como texto).
  var web = String(C.WEBSITE == null ? '' : C.WEBSITE).replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  var pares = [
    ['n',  C.FROM_NAME || ''],
    ['l',  C.LICENSE || ''],
    ['w',  web],
    ['wa', _acWaIntl(C.WHATSAPP || C.PHONE || '')],
    ['em', C.FROM_EMAIL || ''],
    ['cg', typeof _cgAsesor === 'function' ? _cgAsesor(C.FROM_EMAIL) : ''],
    ['c',  o.nombrePila || ''],
    ['k0', o.ceroKm ? '1' : '']
  ];
  var qs = pares
    .filter(function (x) { return String(x[1] == null ? '' : x[1]).trim() !== ''; })
    .map(function (x) { return x[0] + '=' + encodeURIComponent(String(x[1]).trim()); })
    .join('&');
  return qs ? base + (base.indexOf('?') >= 0 ? '&' : '?') + qs : base;
}

/** «su agente del INS» o, para un asesor, «su asesor/asesora de seguros del INS». */
function _acRol() {
  var correo = (typeof CFG !== 'undefined' && CFG.FROM_EMAIL) || '';
  var a = typeof _asesor === 'function' ? _asesor(correo) : null;
  if (!a) return 'su agente del INS';
  return /^asesora\b/i.test(String(a.cargo || '')) ? 'su asesora de seguros del INS' : 'su asesor de seguros del INS';
}

/** El mensaje de WhatsApp. De usted, como los avisos de póliza. */
function buildAceptarWaTexto(p) {
  var o = p || {};
  var nombre = String(o.nombrePila || '').trim();
  var veh    = String(o.vehiculo || '').trim();
  var placa  = String(o.placa || '').trim().toUpperCase();
  var agente = String((typeof CFG !== 'undefined' && CFG.FROM_NAME) || '').trim().split(/\s+/).slice(0, 2).join(' ');
  var que = veh ? 'su ' + veh + (placa ? ' (' + placa + ')' : '') : (placa ? 'su vehículo placa ' + placa : 'su vehículo');
  var url = String(o.urlGuia || '').trim();
  var t = 'Hola' + (nombre ? ' ' + nombre : '') + ', ' + (agente ? 'soy ' + agente + ', ' : 'le escribe ') + _acRol() + '. ';
  // Un cero kilómetros no lleva fotos (solo la factura de la agencia): no se le
  // puede decir que ya las tenemos.
  t += o.ceroKm
    ? 'El siguiente paso para asegurar ' + que + ' es aceptar la póliza'
    : 'Ya tenemos las fotos de ' + que + '. El siguiente paso es aceptar la póliza';
  t += ': el INS le va a enviar un correo con el asunto «' + ACEPTAR_ASUNTO_INS + '».';
  if (url) t += '\n\nAquí le dejo los 6 pasos para hacerlo sin enredos:\n' + url;
  t += '\n\nCualquier duda me escribe por aquí.';
  return t;
}

function buildAceptarWaUrl(p) {
  var o = p || {};
  var tel = _acWaIntl(o.telCliente);
  return 'https://web.whatsapp.com/send/?' + (tel ? 'phone=' + tel + '&' : '') + 'text=' + encodeURIComponent(buildAceptarWaTexto(o));
}

/** Los datos de una cotización del registro, como los pide el cuadro. PURA. */
function aceptarDatosDeCotizacion(e) {
  var x = e || {};
  var placa = typeof historyEntryPlate === 'function' ? historyEntryPlate(x) : String(x.plate || '');
  if (typeof _placaEsRelleno === 'function' && _placaEsRelleno(placa)) placa = '';
  return {
    nombrePila: String(x.client || '').trim(),
    placa:      String(placa || '').trim().toUpperCase(),
    vehiculo:   String(x.vehicle || '').trim(),
    telCliente: String(x.waCliente || '').trim(),
    ceroKm:     /[?&]k0=1(?:&|$)/.test(String(x.guideUrl || ''))
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ACEPTAR_ASUNTO_INS: ACEPTAR_ASUNTO_INS,
    aceptarGuiaUrl: aceptarGuiaUrl,
    buildAceptarWaTexto: buildAceptarWaTexto,
    buildAceptarWaUrl: buildAceptarWaUrl,
    aceptarDatosDeCotizacion: aceptarDatosDeCotizacion
  };
}
