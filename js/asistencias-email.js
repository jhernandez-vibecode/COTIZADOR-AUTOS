/**
 * Cotizador SDI · Correo "Asistencias a cliente con póliza" + aviso de WhatsApp
 *
 * Cuarto envío de la consola (17 set 2026). El agente le escribe a un cliente
 * que YA tiene póliza vigente para contarle que, desde el 28 de setiembre de
 * 2026, el INS permite sumarle planes de asistencia (cobertura ASI, SVA V32).
 * No hay PDF: el correo lleva la prima que el cliente paga hoy, los seis planes
 * con su precio y un botón al configurador (/asistencias/), que con esa prima
 * le muestra en cuánto quedaría su seguro.
 *
 * Transcrito del mockup aprobado por JC el 17 set 2026
 * (docs/superpowers/specs/2026-09-17-asistencias-cliente-existente-mockup.html)
 * con sus cinco decisiones:
 *   D1 (corregida por JC el 17 set, 2.ª vuelta): la prima que se escribe es LO
 *      QUE PAGA EN CADA RECIBO, con IVA (la cuota de su forma de pago). Las
 *      asistencias se le suman en esa misma cuota, con recargo e IVA.
 *   D2 (corregida por JC el mismo 17 set): la cuota SÍ lleva el recargo por
 *      fraccionamiento del INS (8/11/13 %) y después el IVA — asiCosto(). El
 *      correo ya NO hace la cuenta (JC: "ese texto es innecesario"): muestra
 *      la prima vigente y manda al configurador, que sí la hace.
 *   D3 trato de vos, como el correo de cotización y el configurador.
 *   D4 NO entra al registro de Cotizaciones.
 *   D5 el configurador es el mismo de la cotización nueva; llega con `pv`.
 *
 * Los datos de los planes salen de PLANES_ASI (js/planes-asistencia.js), la
 * misma fuente que leen la tarjeta del correo de cotización y la página.
 *
 * Orden de carga: después de email-marca.js (usa _fileteSDI y _pieSDI) y de
 * email-template.js (usa _buildPlanesUrl). Paleta LITERAL dentro de la
 * función, como en los otros tres correos: no usa las SDI_* de email-marca.
 */

/** Forma de pago → cuotas por año y nombre de la cuota. */
var ASI_FORMAS = {
  a: { n: 1,  cuota: 'año',       nombre: 'anual' },
  s: { n: 2,  cuota: 'semestre',       nombre: 'semestral' },
  t: { n: 4,  cuota: 'trimestre',      nombre: 'trimestral' },
  m: { n: 12, cuota: 'mes',            nombre: 'mensual' }
};

/**
 * "487.300" / "₡487 300" / "487,300.00" / 487300 → 487300. 0 si no se lee.
 * El agente lo teclea a mano: acepta punto o coma de miles y basura alrededor.
 */
function asiParseMonto(v) {
  return asiMonto(v);   // js/planes-asistencia.js: una sola lectura de montos
}

/**
 * HTML del correo.
 * @param {object} p
 * @param {string} p.nombrePila     - saludo ("Mariela")
 * @param {number} p.primaVigente   - lo que paga HOY en cada recibo, con IVA: la cuota de su forma de pago (D1, corregida)
 * @param {string} [p.formaPago]    - a|s|t|m (default 'a': la prima es el año)
 * @param {string} [p.vehiculo]     - opcional, solo se nombra
 * @param {string} [p.notaAdicional]
 * @param {string} [p.urlPlanes]    - se calcula con _buildPlanesUrl si no viene
 * @returns {string}
 */
function buildAsistenciasEmail(p) {
  var e = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var o = p || {};
  var saludo   = String(o.nombrePila || '').trim();
  var prima    = asiParseMonto(o.primaVigente);
  var fp       = ASI_FORMAS[o.formaPago] ? o.formaPago : 'a';
  var forma    = ASI_FORMAS[fp];
  var vehiculo = String(o.vehiculo || '').trim();
  var nota     = String(o.notaAdicional || '').trim();
  var url      = String(o.urlPlanes || '').trim() ||
                 (typeof _buildPlanesUrl === 'function'
                   ? _buildPlanesUrl({ clientName: saludo, vehicle: vehiculo, primaVigente: prima, formaPago: fp })
                   : '');

  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var wa       = CFG.WHATSAPP   || tel;
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';

  var fontFam  = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
  var fontBody = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  var mono     = "'Courier New',Courier,monospace";   // el ₡ de Arial se monta sobre el dígito
  var NAVY = '#0c2340', AZUL = '#0369a1', TINTA = '#1B1F23', GRIS = '#5A6570';
  var LINEA = '#DADCE0', BANDA = '#EEF4F9';

  var col = function (n) { return '₡' + Math.round(n).toLocaleString('de-DE'); };

  // Los seis planes, uno por fila, con su precio al año (sin IVA ni recargo,
  // como los publica el INS). La cuenta la hace el configurador, no el correo.
  var filas = '';
  for (var i = 0; i < PLANES_ASI.length; i++) {
    var pl = PLANES_ASI[i];
    filas += '<tr>' +
      '<td style="padding:9px 0;border-top:' + (i ? '1px solid ' + LINEA : '0') + ';font-size:14px;color:' + TINTA + ';font-weight:bold;line-height:1.4;">' + e(pl.nom) +
        '<br><span style="font-weight:normal;font-size:12.5px;color:' + GRIS + ';">' + e(pl.linea) + '</span></td>' +
      '<td align="right" valign="top" style="padding:9px 0 9px 12px;border-top:' + (i ? '1px solid ' + LINEA : '0') + ';font-family:' + mono + ';font-size:14px;color:' + TINTA + ';white-space:nowrap;">' + col(pl.prima) +
        '<br><span style="font-family:' + fontBody + ';font-size:11px;color:' + GRIS + ';">+ IVA</span></td>' +
    '</tr>';
  }

  var primaHtml = prima > 0 ? (
    '<tr><td style="padding:0 32px 22px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + BANDA + ';border-radius:16px;"><tr><td style="padding:18px 20px;">' +
        '<p style="margin:0;font-size:11px;letter-spacing:0.12em;color:' + GRIS + ';font-weight:bold;text-transform:uppercase;">Tu seguro hoy</p>' +
        '<p style="margin:4px 0 0;font-family:' + mono + ';font-size:28px;color:' + TINTA + ';font-weight:bold;">' + col(prima) + '</p>' +
        '<p style="margin:2px 0 0;font-size:12.5px;color:' + GRIS + ';">' + (forma.n > 1 ? 'por ' + forma.cuota + ', con IVA &middot; pago ' + forma.nombre : 'al a&ntilde;o, con IVA &middot; pago anual') + '</p>' +
      '</td></tr></table>' +
    '</td></tr>'
  ) : '';

  var notaHtml = nota ? (
    '<tr><td style="padding:18px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:14px;"><tr><td style="padding:14px 18px;">' +
        '<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;color:' + GRIS + ';font-weight:bold;text-transform:uppercase;">Nota de tu agente</p>' +
        '<p style="margin:0;font-size:14px;line-height:1.55;color:#334155;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
      '</td></tr></table>' +
    '</td></tr>'
  ) : '';

  var botonHtml = url ? (
    '<tr><td style="padding:22px 32px 8px;text-align:center;">' +
      '<a href="' + e(url) + '" style="display:inline-block;background:' + AZUL + ';color:#ffffff;font-family:' + fontFam + ';font-size:15px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:999px;">Ver qu&eacute; trae cada plan y en cu&aacute;nto queda mi seguro</a>' +
      '<p style="margin:10px 0 0;font-size:12px;color:' + GRIS + ';">Se abre con tu prima ya cargada. No compromete a nada.</p>' +
    '</td></tr>'
  ) : '';

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Ahora pod&eacute;s sumarle asistencias a tu seguro &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER navy + filete SDI (como los otros tres correos)
  '<tr><td bgcolor="' + NAVY + '" style="background:' + NAVY + ';color:#ffffff;padding:26px 32px 22px;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="28" style="display:block;border:0;outline:none;text-decoration:none;height:28px;">' +
    '<h1 style="margin:14px 0 0;font-family:' + fontFam + ';font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:#ffffff;">Ahora pod&eacute;s sumarle asistencias a tu seguro</h1>' +
    '<p style="margin:4px 0 0;font-size:13px;color:#b6c4d6;">Seguros del INS &middot; P&oacute;liza de Autom&oacute;viles</p>' +
  '</td></tr>' +
  _fileteSDI() +

  // 2. SALUDO + intro
  '<tr><td style="padding:26px 32px 8px;">' +
    '<p style="margin:0;font-size:11px;color:' + GRIS + ';font-weight:600;text-transform:uppercase;letter-spacing:0.12em;">Hola</p>' +
    '<p style="margin:2px 0 16px;font-family:' + fontFam + ';font-size:24px;font-weight:700;color:' + TINTA + ';letter-spacing:-0.01em;">' + e(saludo) + ',</p>' +
    '<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#334155;">Desde el <b>28 de setiembre</b> el INS permite sumarle <b>planes de asistencia</b> a tu p&oacute;liza de autom&oacute;viles' + (vehiculo ? ' del ' + e(vehiculo) : '') + '. Son servicios para vos, tu casa, tu carro o tu mascota, que se agregan a la misma p&oacute;liza y se cobran junto con el seguro.</p>' +
  '</td></tr>' +

  // 3. TU SEGURO HOY (solo si hay prima)
  primaHtml +

  // 4. LOS SEIS PLANES
  '<tr><td style="padding:0 32px 6px;">' +
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;color:' + GRIS + ';font-weight:bold;text-transform:uppercase;border-bottom:1px solid ' + LINEA + ';padding-bottom:8px;">Los seis planes &middot; precio al a&ntilde;o</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' + filas + '</table>' +
    '<p style="margin:10px 0 0;font-size:12px;color:' + GRIS + ';line-height:1.5;">Sin deducible. Se pueden llevar varios. Los precios son del INS y no llevan los descuentos de la p&oacute;liza.</p>' +
  '</td></tr>' +

  // 5. BOTÓN al configurador
  botonHtml +

  // 6. NOTA DEL AGENTE (solo si la escribe)
  notaHtml +

  // 7. FIRMA
  '<tr><td style="padding:24px 32px 26px;">' +
    '<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">Cualquier duda, hablemos. Si quer&eacute;s agregar alguno, me escrib&iacute;s y lo dejo en tu p&oacute;liza.</p>' +
    '<p style="margin:14px 0 0;font-family:' + fontFam + ';font-size:14px;color:' + TINTA + ';font-weight:bold;">' + e(agente) + '</p>' +
    '<p style="margin:2px 0 0;font-size:12.5px;color:' + GRIS + ';line-height:1.6;">Agente autorizado &middot; Seguros del INS &middot; WhatsApp ' + e(wa) + '</p>' +
  '</td></tr>' +

  // 8. PIE con la marca SDI (módulo compartido)
  _pieSDI({
    logo: CFG.LOGO_SDI_URL, correo: correoAg, web: web,
    tel: tel, agente: agente, licencia: lic
  }) +

'</table></td></tr></table></body></html>';
}

/**
 * Texto del aviso por WhatsApp. Mismo registro de vos que el correo. Con
 * `sinCorreo` no afirma que se mandó un correo (el cliente lo esperaría).
 */
function buildAsistenciasWaTexto(p) {
  var o = p || {};
  var nombre = String(o.nombrePila || '').trim();
  var url    = String(o.urlPlanes || '').trim();
  var prima  = asiParseMonto(o.primaVigente);
  var col = function (n) { return '₡' + Math.round(n).toLocaleString('de-DE'); };
  var t = 'Hola' + (nombre ? ' ' + nombre : '') + ', te saluda ' + (CFG.FROM_NAME || 'tu agente') + ', de Seguros del INS.\n\n';
  t += (o.sinCorreo ? 'Te cuento una novedad: ' : 'Te acabo de enviar un correo con una novedad: ') +
       'desde el 28 de setiembre el INS permite sumarle planes de asistencia a tu póliza de autos (mascota, funeraria, salud, carro y VIP), desde ' +
       col(asiDesde()) + ' al año más IVA.\n\n';
  var fpWa = ASI_FORMAS[o.formaPago] ? o.formaPago : 'a';
  if (prima > 0) t += 'Hoy pagás ' + col(prima) + (fpWa === 'a' ? ' al año. ' : ' por ' + ASI_FORMAS[fpWa].cuota + '. ');
  t += 'En este enlace ves qué trae cada plan y en cuánto quedaría tu seguro:\n' + url + '\n\n';
  t += 'Si te interesa alguno, me decís y lo agrego a tu póliza.';
  return t;
}

/**
 * URL de WhatsApp. Endpoint web.whatsapp.com/send/, NUNCA wa.me (regla del
 * proyecto). Sin teléfono abre el selector de contactos.
 */
function buildAsistenciasWaUrl(p) {
  var o = p || {};
  var tel = String(o.telCliente == null ? '' : o.telCliente).replace(/\D/g, '');
  if (tel.length === 8) tel = '506' + tel;
  var texto = buildAsistenciasWaTexto(o);
  return 'https://web.whatsapp.com/send/?' + (tel ? 'phone=' + tel + '&' : '') + 'text=' + encodeURIComponent(texto);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildAsistenciasEmail: buildAsistenciasEmail,
    buildAsistenciasWaTexto: buildAsistenciasWaTexto,
    buildAsistenciasWaUrl: buildAsistenciasWaUrl,
    asiParseMonto: asiParseMonto,
    ASI_FORMAS: ASI_FORMAS
  };
}
