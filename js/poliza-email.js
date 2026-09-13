/**
 * Cotizador SDI · Plantilla del correo "Póliza Activa"
 *
 * Se envía cuando una póliza de autos del INS ya está emitida y activa.
 * Replica el correo que el agente enviaba a mano: confirmación de póliza activa,
 * Centro de Asistencia Digital (con tip para "instalar" la app), documentación
 * adjunta, contactos de emergencia, nota de terceros, cross-sell (Viaje +
 * Estudiantil) y firma del agente.
 *
 * 100% personalizable por agente: TODO sale de CFG (perfil en localStorage):
 *   firma/licencia/teléfono/web (FROM_*, LICENSE, PHONE, WEBSITE),
 *   ASSIST_URL (Centro de Asistencia; se le embeben los datos del agente por URL),
 *   XSELL_VIAJE_URL / XSELL_ESTUDIANTIL_URL (botones "Comprar" del cross-sell).
 *
 * Email-friendly: tablas anidadas + estilos inline. Imágenes solo hosteadas en el
 * sitio (logo INS, logo SDI del pie, iconos del cross-sell): Gmail bloquea SVG y
 * base64. Rediseño en línea clara SDI el 13 sep 2026 (orden nuevo, sin barras a
 * la izquierda, píldoras, tarjeta del vehículo compartida con la cotización).
 *
 * API: buildPolizaActivaEmail({ nombrePila, cliente, poliza, vehiculo, placa,
 *                               notaAdicional }) -> string HTML
 */
/**
 * Numero de telefono en formato internacional CR, solo digitos.
 * 8 digitos (numero tico pelado) -> se le antepone el 506.
 * @param {string} v
 * @returns {string}
 */
function polizaWaIntl(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 8) d = '506' + d;
  return d;
}

/**
 * URL del Centro de Asistencia CON la ficha del agente actual embebida
 * (?n,tel,wa,em,lic,web). Sin esto la app de asistencia muestra al agente
 * por defecto y no a quien de verdad mando la poliza.
 *
 * Devuelve la URL CRUDA (sin escapar): el correo la escapa por su cuenta,
 * WhatsApp la necesita tal cual. Cadena vacia si CFG.ASSIST_URL no es http(s).
 * @returns {string}
 */
function polizaAsistenciaUrl() {
  var base = String(CFG.ASSIST_URL == null ? '' : CFG.ASSIST_URL).trim();
  if (!/^https?:\/\//i.test(base)) return '';   // sin base valida no hay guia
  // web: valor CRUDO del perfil (no el fallback al sitio del owner), asi un
  // agente sin web propia no arrastra la de otro a su guia.
  var webRaw = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var tel    = CFG.PHONE || '';
  var pairs = [
    ['n',   CFG.FROM_NAME || ''], ['tel', tel], ['wa', polizaWaIntl(CFG.WHATSAPP || tel)],
    ['em',  CFG.FROM_EMAIL || ''], ['lic', CFG.LICENSE || ''], ['web', webRaw]
  ];
  var qs = pairs
    .filter(function (x) { return x[1] != null && String(x[1]).trim() !== ''; })
    .map(function (x) { return x[0] + '=' + encodeURIComponent(String(x[1]).trim()); })
    .join('&');
  return qs ? base + (base.indexOf('?') >= 0 ? '&' : '?') + qs : base;
}

/**
 * URL de WhatsApp para avisarle al cliente que su poliza ya esta activa.
 *
 * SIEMPRE web.whatsapp.com/send/ — wa.me corrompe los emojis del mensaje.
 * Con telefono abre el chat directo del cliente; sin telefono, WhatsApp abre
 * el selector de contactos del agente.
 *
 * El saludo NO lleva "Estimado/Estimada": del PDF solo sacamos el nombre, no
 * el genero, y equivocarse ahi con un cliente es peor que sonar menos formal.
 *
 * `urlGuia` es el alias corto (/a/XXXXXXXXXX) que devuelve acortarEnlace: la
 * URL de asistencia con la ficha del agente ronda los 180 caracteres y empuja
 * el mensaje al "Leer mas" de WhatsApp. Si no viene — porque el acortador
 * fallo o porque se llama sin el — cae a la URL larga, que funciona igual.
 *
 * @param {object} params - { nombrePila, poliza, vehiculo, placa, telCliente, urlGuia }
 * @returns {string}
 */
function buildPolizaWaUrl(params) {
  var p = params || {};
  var saludo   = String(p.nombrePila || '').trim();
  var poliza   = String(p.poliza     || '').trim();
  var vehiculo = String(p.vehiculo   || '').trim();
  var placa    = String(p.placa      || '').trim();
  var guia     = String(p.urlGuia    || '').trim() || polizaAsistenciaUrl();

  // Identificacion: "Su numero de poliza es X (Toyota Yaris, placa BRK454)."
  var ident = '';
  if (poliza) {
    var detalle = [vehiculo, placa ? 'placa ' + placa : ''].filter(Boolean).join(', ');
    ident = 'Su número de póliza es ' + poliza + (detalle ? ' (' + detalle + ')' : '') + '.\n';
  }

  var msg =
    '¡' + (saludo ? saludo + ', su' : 'Su') + ' póliza de automóvil está lista! 🚗✅\n\n' +
    'Le acabamos de enviar todos los documentos del seguro a su correo electrónico. 📧\n' +
    ident + '\n' +
    'Recuerde que ante cualquier choque, avería o emergencia en carretera, debe reportarlo de inmediato.\n\n' +
    'Para facilitarle el proceso, nuestra oficina diseñó esta app exclusiva con la guía paso a paso y todos los números de asistencia a un clic:\n\n' +
    (guia ? '👉 ' + guia + '\n\n' : '') +
    '¡Guárdela en sus favoritos y conduzca con total tranquilidad! 🛡️';

  var phone = polizaWaIntl(p.telCliente);
  return 'https://web.whatsapp.com/send/?'+ (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(msg);
}

function buildPolizaActivaEmail(params) {
  // Escape HTML (XSS-safe) y sanitizador de URL — LOCALES para no contaminar el
  // espacio global (la sub-página comparte scripts con el resto de la app).
  var e = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var _safe = function (u) {
    return /^https?:\/\//i.test(String(u || '')) ? e(String(u)) : '';
  };

  var p = params || {};
  var saludo   = (p.nombrePila || p.cliente || '').trim();
  var poliza   = (p.poliza   || '').trim();
  var vehiculo = (p.vehiculo || '').trim();
  var placa    = (p.placa    || '').trim();
  var nota     = (p.notaAdicional || '').trim();

  var fontFam  = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
  var fontBody = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

  // Paleta (literal, como en email-template.js: buildEmail no usa las SDI_* de
  // email-marca.js para no depender del orden de <script> ni romper el eval de
  // los tests).
  var NAVY = '#0c2340', AZUL = '#0369a1', VERDE = '#047857', GRIS = '#64748b';
  var LINEA = '#e2e8f0', BANDA = '#eef4f9';

  // Datos del agente (perfil → CFG)
  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  // website: valor CRUDO del perfil, SIN fallback al sitio del owner. Si el agente
  // no tiene web propia, queda '' y NO se muestra en la firma (no arrastramos
  // www.segurosdelins.com de JC al correo de otro agente). Para JC, el default de
  // config.js ya trae su sitio, así que a él sí le sale.
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';
  // Iconos del cross-sell: PNG alojados en el sitio, igual que el logo del INS
  // (Gmail bloquea SVG y base64; una imagen hosteada con URL absoluta sí pasa).
  // Si el cliente bloquea imágenes, queda el círculo pálido y el texto completo.
  var icoBase  = String(logoUrl).replace(/\/[^\/]*$/, '/');
  var icoViaje = icoBase + 'ico-viaje.png';
  var icoEst   = icoBase + 'ico-estudiantil.png';

  // Guía de emergencia personalizada: embebemos la ficha del agente actual
  // (nombre, contacto, licencia, web) como parámetros para que la app de
  // asistencia muestre a ESTE agente y no al owner por default. Respeta la
  // query previa que traiga ASSIST_URL (p.ej. ?a=<id>).
  // La arma polizaAsistenciaUrl() (arriba), compartida con el WhatsApp de la
  // vista 4: si el correo y el mensaje mandaran fichas distintas, el cliente
  // vería un agente en un lado y otro en el otro.
  var _assistUrl = polizaAsistenciaUrl;

  // Links saneados (solo http/https). Si un cross-sell viene vacío, cae al sitio
  // del agente — PERO solo si el agente tiene web propia. Si no la tiene, queda ''
  // (el botón se oculta abajo) en lugar de arrastrar el sitio del owner.
  // Escapado UNA vez: entra crudo a tres href (assistUrl / viajeUrl / estUrl) y
  // el resto del archivo ya pasa todo por e() o _safe().
  var siteFallback = web ? e('https://' + web) : '';
  // El botón de asistencia es el CTA central: nunca lo dejamos con href vacío
  // (ASSIST_URL trae un default real, así que en la práctica siempre resuelve).
  var assistUrl = e(_assistUrl()) || siteFallback || '#';
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  // ---- Piezas repetidas (línea clara: sin barras de color a la izquierda) ----
  var rotulo = function (t) {
    return '<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:' + GRIS + ';letter-spacing:0.1em;text-transform:uppercase;">' + t + '</p>';
  };
  // Bloque con rótulo sobre una regla de 1 px (mismo criterio que _bloqueSobrio,
  // pero el contenido es una tabla, no un párrafo).
  var seccion = function (rot, inner, padTop) {
    return '<tr><td style="padding:' + padTop + 'px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + LINEA + ';">' +
      '<tr><td style="padding:14px 0 0;">' + rotulo(rot) + inner + '</td></tr></table></td></tr>';
  };
  var pildora = function (href, texto) {
    return '<a href="' + href + '" style="display:inline-block;background:' + AZUL + ';color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 26px;font-family:' + fontFam + ';font-weight:700;font-size:14px;">' + texto + '</a>';
  };
  var pildoraBorde = function (href, texto) {
    return '<a href="' + href + '" style="display:inline-block;background:#ffffff;color:' + AZUL + ';text-decoration:none;border:1.5px solid ' + AZUL + ';border-radius:999px;padding:9px 18px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">' + texto + '</a>';
  };
  var docu = function (t) {
    return '<tr><td width="22" valign="top" style="color:' + VERDE + ';font-weight:700;padding:3px 0;font-size:13.5px;">&#10003;</td>' +
      '<td style="padding:3px 0;font-size:13.5px;color:#334155;line-height:1.5;">' + t + '</td></tr>';
  };
  var telefono = function (rot, num, ultimo) {
    var borde = ultimo ? '' : 'border-bottom:1px solid ' + LINEA + ';';
    return '<tr><td style="padding:6px 0;' + borde + 'font-size:13px;color:#475569;">' + rot + '</td>' +
      '<td align="right" style="padding:6px 0;' + borde + 'font-family:' + fontFam + ';font-size:16px;font-weight:700;color:' + NAVY + ';white-space:nowrap;">' + num + '</td></tr>';
  };
  // Tarjeta de cross-sell: icono en círculo pálido + título + texto + píldora.
  var xsell = function (icono, alt, titulo, texto, href) {
    return '<td width="50%" valign="top" style="background:#ffffff;border:1px solid ' + LINEA + ';border-radius:16px;padding:18px 16px 16px;">' +
      '<table width="48" cellpadding="0" cellspacing="0" border="0" style="width:48px;"><tr>' +
        '<td width="48" height="48" align="center" valign="middle" bgcolor="' + BANDA + '" style="background:' + BANDA + ';border-radius:24px;width:48px;height:48px;">' +
          '<img src="' + e(icono) + '" alt="' + alt + '" width="24" height="24" style="display:block;border:0;width:24px;height:24px;"></td></tr></table>' +
      '<p style="margin:12px 0 3px;font-family:' + fontFam + ';font-size:15px;font-weight:700;color:' + NAVY + ';">' + titulo + '</p>' +
      '<p style="margin:0 0 14px;font-size:12.5px;color:#475569;line-height:1.5;">' + texto + '</p>' +
      (href ? pildoraBorde(href, 'Comprar &rarr;') : '') +
    '</td>';
  };

  // Tarjeta del vehículo asegurado (módulo compartido) con el N.º de póliza
  // debajo del vehículo. La placa se dibuja como matrícula: roja si es CL.
  var polizaLinea = poliza
    ? '<p style="margin:6px 0 0;font-size:12.5px;color:' + GRIS + ';">P&oacute;liza N.&ordm; <b style="color:' + NAVY + ';letter-spacing:0.02em;">' + e(poliza) + '</b></p>'
    : '';
  var tarjetaHtml = _tarjetaVehiculo({
    vehiculo: vehiculo || 'Su vehículo', plate: placa, plateClass: p.plateClass,
    fontFam: fontFam, rotulo: 'Veh&iacute;culo asegurado', extra: polizaLinea
  });

  var notaHtml = nota ? (
    '<tr><td style="padding:14px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;">' +
        '<tr><td style="padding:12px 16px;">' +
          rotulo('Nota de su agente') +
          '<p style="margin:0;font-size:13px;color:#334155;line-height:1.55;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>') : '';

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Su póliza está activa &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER navy + filete de marca SDI (igual al correo de cotización)
  '<tr><td bgcolor="' + NAVY + '" style="background:' + NAVY + ';color:#ffffff;padding:28px 32px;text-align:center;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="46" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;height:46px;">' +
    '<h1 style="margin:0;font-family:' + fontFam + ';font-size:22px;font-weight:700;letter-spacing:-.01em;">Su p&oacute;liza est&aacute; activa</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.75;">Seguros del INS &middot; P&oacute;liza de Autom&oacute;viles</p>' +
  '</td></tr>' +
  _fileteSDI() +

  // 2. SALUDO
  '<tr><td style="padding:28px 32px 12px;">' +
    '<p style="margin:0;font-size:11px;color:' + GRIS + ';font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Hola</p>' +
    '<p style="margin:4px 0 0;font-family:' + fontFam + ';font-size:24px;font-weight:700;color:' + NAVY + ';letter-spacing:-0.01em;">' + e(saludo) + ',</p>' +
  '</td></tr>' +

  // 3. TARJETA DEL VEHÍCULO ASEGURADO (placa + N.º de póliza)
  tarjetaHtml +

  // 4. CONFIRMACIÓN (sello verde pálido + párrafo)
  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0 0 10px;"><span style="display:inline-block;background:#ecfdf5;color:' + VERDE + ';font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;">&#9679;&nbsp; P&oacute;liza activa</span></p>' +
    '<p style="margin:0;font-size:14px;line-height:1.65;color:#334155;">Es un gusto saludarle. Le confirmo que su p&oacute;liza <b style="color:' + NAVY + ';">ya se encuentra activa</b> y su veh&iacute;culo queda protegido desde este momento. Abajo le dejo lo que necesita tener a mano.</p>' +
  '</td></tr>' +

  // 5. DOCUMENTACIÓN ADJUNTA
  seccion('Documentaci&oacute;n adjunta',
    '<table cellpadding="0" cellspacing="0" border="0">' +
      docu('Tarjeta del seguro') +
      docu('Condiciones Particulares y Generales') +
      docu('Comprobante de pago') +
      docu('Gu&iacute;a de asistencia en carretera') +
    '</table>', 24) +

  // 6. CENTRO DE ASISTENCIA DIGITAL (debajo de los documentos, sobre banda pálida)
  '<tr><td style="padding:24px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + BANDA + '" style="background:' + BANDA + ';border-radius:16px;">' +
      '<tr><td style="padding:24px 22px;text-align:center;">' +
        '<p style="margin:0 0 6px;font-family:' + fontFam + ';font-size:16px;font-weight:700;color:' + NAVY + ';">Centro de Asistencia Digital</p>' +
        '<p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.55;">Si tiene un accidente o una aver&iacute;a, no pierda tiempo buscando n&uacute;meros: esta gu&iacute;a le dice qu&eacute; hacer paso a paso y le conecta al instante con el contacto correcto.</p>' +
        pildora(assistUrl, 'Abrir mi gu&iacute;a de emergencias &rarr;') +
        '<p style="margin:14px 0 0;font-size:11.5px;color:' + GRIS + ';line-height:1.5;">&Aacute;brala en el celular y elija <b style="color:#334155;">&laquo;A&ntilde;adir a pantalla de inicio&raquo;</b> para tenerla siempre a mano, como una app. Sin descargas.</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 7. CONTACTOS DE EMERGENCIA (teléfonos en tinta)
  seccion('Contactos de emergencia &middot; gu&aacute;rdelos',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
      telefono('Colisiones (Inspector)', '800-800-8000 &middot; 911', false) +
      telefono('Asistencia en carretera (gr&uacute;a / aver&iacute;a)', '800-800-8001', true) +
    '</table>', 24) +

  // 8. IMPORTANTE (única advertencia: regla dorada ARRIBA, no barra a la izquierda)
  '<tr><td style="padding:22px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border-top:3px solid #C9A227;border-radius:0 0 10px 10px;">' +
      '<tr><td style="padding:12px 16px 13px;font-size:12.5px;color:#713f12;line-height:1.55;"><b style="color:#422006;">Importante:</b> nunca realice acuerdos con terceros sin la autorizaci&oacute;n previa del INS, para no afectar la validez de su cobertura.</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 9. NOTA DEL AGENTE (solo si la escribe)
  notaHtml +

  // 10. CROSS-SELL con iconos (personalizable por agente)
  '<tr><td style="padding:28px 32px 0;">' +
    '<p style="margin:0 0 12px;font-family:' + fontFam + ';font-size:15px;font-weight:700;color:' + NAVY + ';">Otros seguros que le pueden interesar</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>' +
      xsell(icoViaje, 'Avi&oacute;n', 'Seguros de Viaje', 'Proteja su pr&oacute;xima aventura fuera del pa&iacute;s.', viajeUrl) +
      xsell(icoEst, 'Birrete', 'Seguro Estudiantil', 'Asegure el futuro de sus hijos durante todo el a&ntilde;o lectivo.', estUrl) +
    '</tr></table>' +
  '</td></tr>' +

  // 11. FIRMA
  '<tr><td style="padding:26px 32px 26px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + LINEA + ';"><tr><td style="padding-top:18px;">' +
      '<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">Quedo a su entera disposici&oacute;n para cualquier consulta. Atentamente,</p>' +
      '<p style="margin:12px 0 0;font-family:' + fontFam + ';font-weight:700;color:' + NAVY + ';font-size:15px;">' + e(agente) + '</p>' +
      '<p style="margin:3px 0 0;font-size:11.5px;color:' + GRIS + ';line-height:1.6;">Agente de Seguros Exclusivo &middot; Instituto Nacional de Seguros<br>' +
        'Licencia SUGESE ' + e(lic) + ' &middot; Tel: ' + e(tel) + '<br>' +
        '<a href="mailto:' + e(correoAg) + '" style="color:' + AZUL + ';text-decoration:none;">' + e(correoAg) + '</a>' + (web ? (' &middot; ' + e(web)) : '') +
      '</p>' +
    '</td></tr></table>' +
  '</td></tr>' +

  // 12. PIE con la marca SDI (modulo compartido js/email-marca.js)
  _pieSDI({
    logo: CFG.LOGO_SDI_URL, correo: correoAg, web: web,
    tel: tel, agente: agente, licencia: lic
  }) +

'</table></td></tr></table></body></html>';
}

// Export para tests Node (sin romper el browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildPolizaActivaEmail: buildPolizaActivaEmail,
    buildPolizaWaUrl:       buildPolizaWaUrl,
    polizaAsistenciaUrl:    polizaAsistenciaUrl,
    polizaWaIntl:           polizaWaIntl
  };
}
