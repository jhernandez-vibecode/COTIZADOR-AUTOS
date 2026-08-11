/**
 * Cotizador SDI · Plantilla del correo "Renovación confirmada"
 *
 * Se envía cuando el cliente YA PAGÓ la renovación de su póliza de automóviles
 * y el agente le manda el Comprobante de Pago del INS.
 *
 * NO ES UN CORREO DE COBRO — y esa es la decisión de diseño que lo ordena todo
 * (JC, 10 ago 2026): el recibo llega pagado, así que el correo confirma,
 * agradece y entrega información de servicio. Nada de "pague antes de", montos
 * pendientes ni formas de pago. Lo que ocupa el centro es lo que al cliente le
 * sirve de verdad: qué hacer si ocurre un evento y qué asistencias mantiene
 * vivas su renovación.
 *
 * Cara al cliente ⇒ marca INS arriba y visible, SDI al pie como plataforma.
 * Registro "usted" de punta a punta, SIN "Estimado/Estimada": del PDF sale el
 * nombre, no el género, y equivocarse ahí es peor que sonar menos formal.
 *
 * 100% personalizable por agente: todo sale de CFG (perfil ⚙ en localStorage).
 * Email-friendly: tablas anidadas + estilos inline. Sin imágenes salvo el logo
 * INS del encabezado; el logotipo SDI del pie se recrea en HTML (Gmail bloquea
 * SVG y base64), con la barra de 4 colores del kit v1.2 — la misma variante que
 * estrenó el header de las consolas.
 *
 * API:
 *   buildRenovacionEmail({ nombrePila, cliente, poliza, placa, vehiculo,
 *                          numComprobante, montoTexto, periodoDesde,
 *                          periodoHasta, fechaPago, notaAdicional }) -> HTML
 *   buildRenovacionWaUrl({ nombrePila, poliza, placa, telCliente, urlGuia }) -> URL
 */

// La ficha del agente en la guía de emergencias y la normalización del teléfono
// ya viven en poliza-email.js y están probadas en producción: se reusan tal cual
// para que el correo y el WhatsApp de los dos módulos manden exactamente la
// misma ficha. Si mandaran fichas distintas, el cliente vería un agente en un
// lado y otro en el otro.
var _RENOV_PE = (typeof polizaAsistenciaUrl === 'undefined' && typeof require !== 'undefined')
  ? require('./poliza-email.js') : null;

function _renovAsistenciaUrl() {
  return _RENOV_PE ? _RENOV_PE.polizaAsistenciaUrl() : polizaAsistenciaUrl();
}
function _renovWaIntl(v) {
  return _RENOV_PE ? _RENOV_PE.polizaWaIntl(v) : polizaWaIntl(v);
}

/**
 * URL de WhatsApp para avisarle al cliente que su renovación quedó confirmada.
 *
 * SIEMPRE web.whatsapp.com/send/ — wa.me corrompe los emojis del mensaje.
 * Con teléfono abre el chat directo; sin teléfono, WhatsApp abre el selector de
 * contactos del agente.
 *
 * `urlGuia` es el alias corto (/a/XXXXXXXXXX) que devuelve acortarEnlace: la URL
 * de asistencia con la ficha del agente ronda los 180 caracteres y empuja el
 * mensaje al "Leer más" de WhatsApp. Si no viene — porque el acortador falló o
 * porque se llama sin él — cae a la URL larga, que funciona igual.
 *
 * @param {object} params - { nombrePila, poliza, placa, telCliente, urlGuia }
 * @returns {string}
 */
function buildRenovacionWaUrl(params) {
  var p = params || {};
  var saludo = String(p.nombrePila || '').trim();
  var poliza = String(p.poliza || '').trim();
  var placa  = String(p.placa || '').trim();
  var guia   = String(p.urlGuia || '').trim() || _renovAsistenciaUrl();

  // "Su póliza 0101AUT… (placa BRJ665) continúa activa…". Sin número de póliza
  // la frase entera desaparece en vez de quedar colgando; sin placa se va solo
  // el paréntesis.
  var ident = '';
  if (poliza) {
    ident = 'Su póliza ' + poliza + (placa ? ' (placa ' + placa + ')' : '') +
            ' continúa activa y su vehículo protegido, sin trámites pendientes.\n';
  } else if (placa) {
    ident = 'Su vehículo placa ' + placa +
            ' continúa protegido, sin trámites pendientes.\n';
  }

  var msg =
    '¡' + (saludo ? saludo + ', su' : 'Su') + ' renovación está confirmada! ✅🚗\n\n' +
    'Le acabo de enviar a su correo el comprobante de pago oficial del INS.\n' +
    ident + '\n' +
    'Recuerde: ante un accidente o avería, repórtelo de inmediato. En esta guía tiene los pasos a seguir y los números de asistencia 24/7 a un clic:\n\n' +
    (guia ? '👉 ' + guia + '\n\n' : '') +
    'Gracias por renovar su confianza. Estoy para servirle. 🛡️';

  var phone = _renovWaIntl(p.telCliente);
  return 'https://web.whatsapp.com/send/?'
    + (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(msg);
}

function buildRenovacionEmail(params) {
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
  var placa    = (p.placa    || '').trim();
  var vehiculo = (p.vehiculo || '').trim();
  var comprob  = (p.numComprobante || '').trim();
  var montoTxt = (p.montoTexto || '').trim();
  var desde    = (p.periodoDesde  || '').trim();
  var hasta    = (p.periodoHasta  || '').trim();
  var fPago    = (p.fechaPago     || '').trim();
  var nota     = (p.notaAdicional || '').trim();

  var fontFam  = "'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif";
  var fontBody = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  var fontNum  = "'JetBrains Mono',Consolas,'Courier New',monospace";

  // Datos del agente (perfil → CFG)
  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  // website: valor CRUDO del perfil, SIN fallback al sitio del owner. Un agente
  // sin web propia no arrastra la de JC a su correo.
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';

  var siteFallback = web ? ('https://' + web) : '';
  // El botón de la guía lleva la URL LARGA a propósito: armar el correo no debe
  // depender de una llamada de red al acortador. El corto es cosa del WhatsApp,
  // donde el cliente ve la dirección cruda.
  var assistUrl = e(_renovAsistenciaUrl()) || siteFallback || '#';
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  // "su vehículo TOYOTA YARIS 2019 placa BRJ665" / "su vehículo placa BRJ665"
  var vehFrase = 'su vehículo' +
    (vehiculo ? ' <b style="color:#0c2340;">' + e(vehiculo) + '</b>' : '') +
    (placa ? ' placa <b style="color:#0c2340;">' + e(placa) + '</b>' : '');
  var polizaFrase = poliza
    ? ' de su póliza No. <b style="color:#0c2340;">' + e(poliza) + '</b>'
    : ' de su póliza de automóviles';

  // Datos del comprobante, en dos columnas. Solo se pintan los que el PDF trajo:
  // una celda vacía se vería como un error de la app.
  var datos = [];
  if (poliza) datos.push(['Póliza', poliza]);
  if (placa)  datos.push(['Placa', placa]);
  if (desde && hasta) datos.push(['Período pagado', desde + ' &rarr; ' + hasta]);
  if (fPago)  datos.push(['Fecha de pago', fPago]);

  var datosHtml = '';
  for (var i = 0; i < datos.length; i += 2) {
    var celdas = '';
    for (var j = i; j < i + 2; j++) {
      if (j < datos.length) {
        celdas += '<td width="50%" valign="top" style="padding:7px 0;">' +
          '<div style="font-family:' + fontNum + ';font-size:9.5px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;">' + datos[j][0] + '</div>' +
          '<div style="font-family:' + fontNum + ';font-size:13px;color:#e8eef5;padding-top:2px;">' + e(datos[j][1]).replace('&amp;rarr;', '&rarr;') + '</div>' +
        '</td>';
      } else {
        celdas += '<td width="50%">&nbsp;</td>';
      }
    }
    datosHtml += '<tr>' + celdas + '</tr>';
  }

  var notaHtml = nota ? (
    '<tr><td style="padding:6px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:4px solid #ea580c;border-radius:8px;">' +
        '<tr><td style="padding:12px 16px;">' +
          '<p style="margin:0 0 3px;font-size:11px;font-weight:bold;color:#9a3412;letter-spacing:.06em;text-transform:uppercase;">Nota de su agente</p>' +
          '<p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.55;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>'
  ) : '';

  // Una franja del logotipo SDI del pie (kit v1.2: barra de 4 colores).
  function franja(color) {
    return '<tr><td bgcolor="' + color + '" style="background:' + color + ';height:4px;width:20px;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
           '<tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>';
  }

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Su renovación está confirmada &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER (INS arriba: es la cara al cliente)
  '<tr><td bgcolor="#0c2340" style="background:#0c2340;color:#ffffff;padding:26px 32px;text-align:center;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="44" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;height:44px;">' +
    '<h1 style="margin:0;font-family:' + fontFam + ';font-size:21px;font-weight:700;letter-spacing:-.01em;">Su renovación está confirmada</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.78;">Seguros del INS &middot; Su protección al volante</p>' +
  '</td></tr>' +

  // 2. SALUDO + confirmación del pago (verde). El "Adjunto encontrará…" va en
  //    párrafo aparte con aire: JC pidió que no se leyera como un solo bloque.
  '<tr><td style="padding:26px 32px 4px;">' +
    '<p style="margin:0 0 14px;font-family:' + fontFam + ';font-size:18px;font-weight:700;color:#0c2340;">Hola ' + e(saludo) + ',</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:10px;">' +
      '<tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;color:#065f46;">' +
        '<p style="margin:0;">Es un gusto saludarle. Le confirmo que el pago de la renovación' + polizaFrase + ' fue aplicado correctamente y ' + vehFrase + ' continúa protegido, sin interrupciones.</p>' +
        '<p style="margin:10px 0 0;">Adjunto encontrará el comprobante de pago oficial del INS. &#9989;</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 3. TARJETA DEL COMPROBANTE (navy, filete dorado SDI abajo)
  (montoTxt || datos.length ?
  '<tr><td style="padding:18px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c2340;border-radius:12px;border-bottom:4px solid #c9a227;">' +
      '<tr><td style="padding:20px 22px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          '<td valign="top">' +
            (montoTxt ?
              '<div style="font-family:' + fontNum + ';font-size:10px;letter-spacing:.16em;color:#8ba3bf;text-transform:uppercase;">Monto pagado</div>' +
              '<div style="font-family:' + fontFam + ';font-size:34px;font-weight:700;color:#ffffff;letter-spacing:-.02em;padding:4px 0 2px;">' + e(montoTxt) + '</div>' +
              '<div style="font-size:11px;color:#8ba3bf;">Incluye IVA' + (comprob ? ' &middot; Comprobante N&ordm; ' + e(comprob) : '') + '</div>'
            : '') +
          '</td>' +
          '<td valign="top" align="right" style="white-space:nowrap;">' +
            '<span style="display:inline-block;background:#0f766e;color:#d1fae5;font-family:' + fontNum + ';font-size:10px;letter-spacing:.14em;padding:5px 12px;border-radius:999px;">PAGADO</span>' +
          '</td>' +
        '</tr></table>' +
        (datosHtml ?
          '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,.14);margin-top:14px;">' + datosHtml + '</table>'
        : '') +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' : '') +

  // 4. QUÉ HACER SI OCURRE UN EVENTO — el corazón del correo. Información de
  //    servicio, no venta. Solo teléfonos verificados del INS.
  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0 0 12px;font-family:' + fontFam + ';font-size:15px;font-weight:700;color:#0c2340;">&#128680; &iquest;Qu&eacute; hacer si ocurre un evento?</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
      '<tr><td width="26" valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;font-family:' + fontNum + ';font-size:11px;color:#c9a227;font-weight:600;">01</td>' +
        '<td valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;">' +
          '<p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:#0c2340;">Primero, las personas</p>' +
          '<p style="margin:0;font-size:12.5px;color:#475569;line-height:1.55;">Si hay personas lesionadas, llame de inmediato al <b style="color:#0c2340;">911</b>.</p>' +
        '</td></tr>' +
      '<tr><td width="26" valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;font-family:' + fontNum + ';font-size:11px;color:#c9a227;font-weight:600;">02</td>' +
        '<td valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;">' +
          '<p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:#0c2340;">Reporte el accidente de una vez</p>' +
          '<p style="margin:0;font-size:12.5px;color:#475569;line-height:1.55;">Llame a Colisiones del INS al <b style="color:#0c2340;">800-800-8000</b> para que le env&iacute;en un inspector. Y muy importante: <b style="color:#0c2340;">nunca haga acuerdos con terceros</b> sin la autorizaci&oacute;n previa del INS &mdash; eso protege la validez de su cobertura.</p>' +
        '</td></tr>' +
      '<tr><td width="26" valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;font-family:' + fontNum + ';font-size:11px;color:#c9a227;font-weight:600;">03</td>' +
        '<td valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;">' +
          '<p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:#0c2340;">&iquest;Aver&iacute;a en carretera?</p>' +
          '<p style="margin:0;font-size:12.5px;color:#475569;line-height:1.55;">Su asistencia 24/7 est&aacute; al <b style="color:#0c2340;">800-800-8001</b>: gr&uacute;a, cerrajer&iacute;a, cambio de llanta, paso de corriente y env&iacute;o de combustible. El alcance de su plan, seg&uacute;n la antig&uuml;edad de su veh&iacute;culo, est&aacute; en su gu&iacute;a.</p>' +
        '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 5. CTA — guía de emergencias con la ficha del agente
  '<tr><td style="padding:16px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">' +
      '<tr><td style="padding:18px;text-align:center;">' +
        '<p style="margin:0 0 4px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c4a6e;">Todo esto, paso a paso y a un clic</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.55;">Guarde su gu&iacute;a de emergencias: en el momento del evento le dice qu&eacute; hacer y le conecta con el contacto correcto al instante.</p>' +
        '<a href="' + assistUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;font-family:' + fontFam + ';font-weight:700;font-size:14px;">&#128241; Abrir mi gu&iacute;a de emergencias &rarr;</a>' +
        '<p style="margin:10px 0 0;font-size:11px;color:#64748b;line-height:1.5;">&Aacute;brala en el celular y elija <b>"A&ntilde;adir a pantalla de inicio"</b> para tenerla siempre a mano, como una App. Sin descargas.</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  notaHtml +

  // 6. CROSS-SELL (JC, 10 ago 2026: va SIEMPRE — este correo es a veces el único
  //    contacto del año con el cliente). Personalizable por agente.
  '<tr><td style="padding:22px 32px 0;">' +
    '<h2 style="margin:0 0 12px;font-family:' + fontFam + ';font-size:13px;font-weight:700;color:#0c2340;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e0e7ef;padding-bottom:8px;">Otros seguros que le pueden interesar</h2>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>' +
      '<td width="50%" valign="top" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;">' +
        '<p style="margin:0 0 2px;font-size:22px;line-height:1;">&#9992;&#65039;</p>' +
        '<p style="margin:6px 0 2px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c2340;">Seguros de Viaje</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5;">Proteja su pr&oacute;xima aventura dentro y fuera del pa&iacute;s.</p>' +
        (viajeUrl ? '<a href="' + viajeUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">Comprar &rarr;</a>' : '') +
      '</td>' +
      '<td width="50%" valign="top" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">' +
        '<p style="margin:0 0 2px;font-size:22px;line-height:1;">&#127891;</p>' +
        '<p style="margin:6px 0 2px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c2340;">Seguro Estudiantil</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5;">Asegure el futuro de sus hijos durante todo el a&ntilde;o lectivo.</p>' +
        (estUrl ? '<a href="' + estUrl + '" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">Comprar &rarr;</a>' : '') +
      '</td>' +
    '</tr></table>' +
  '</td></tr>' +

  // 7. FIRMA
  '<tr><td style="padding:24px 32px 0;border-top:1px solid #e0e7ef;">' +
    '<p style="margin:18px 0 0;font-size:13px;color:#475569;line-height:1.5;">Gracias por renovar su confianza. Quedo a su disposici&oacute;n para cualquier consulta. Atentamente,</p>' +
    '<p style="margin:10px 0 0;font-family:' + fontFam + ';font-weight:700;color:#0c2340;font-size:14px;">' + e(agente) + '</p>' +
    '<p style="margin:2px 0 0;font-size:11px;color:#64748b;line-height:1.6;">Agente de Seguros Exclusivo &middot; Instituto Nacional de Seguros<br>' +
      'Licencia SUGESE ' + e(lic) + ' &middot; Tel: ' + e(tel) + '<br>' +
      '<a href="mailto:' + e(correoAg) + '" style="color:#0369a1;text-decoration:none;">' + e(correoAg) + '</a>' + (web ? (' &middot; ' + e(web)) : '') +
    '</p>' +
  '</td></tr>' +

  // 8. FOOTER SDI — logotipo recreado en HTML (Gmail bloquea SVG), barra de 4
  //    colores del kit v1.2, la misma variante que estrenó el header.
  '<tr><td bgcolor="#0c2340" style="background:#0c2340;color:#cbd5e1;padding:24px 32px 22px;text-align:center;">' +
    '<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;"><tr>' +
      '<td valign="middle" style="font-family:' + fontFam + ';font-weight:500;font-size:30px;letter-spacing:-1px;color:#ffffff;line-height:1;">SDI</td>' +
      '<td valign="middle" style="padding-left:10px;"><table cellpadding="0" cellspacing="0" border="0">' +
        franja('#0369A1') + franja('#0D9488') + franja('#EA580C') +
        '<tr><td bgcolor="#C9A227" style="background:#C9A227;height:4px;width:20px;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
      '</table></td>' +
    '</tr></table>' +
    '<p style="margin:0;font-size:12px;color:#cbd5e1;">Plataforma de <b style="color:#ffffff;">Seguros Digitales SDI&reg;</b></p>' +
    '<p style="margin:8px 0 0;font-size:10px;color:#64748b;">&copy; 2026 Propiedad Intelectual de ' + e(agente) + '</p>' +
  '</td></tr>' +

'</table></td></tr></table></body></html>';
}

// Export para tests Node (sin romper el browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildRenovacionEmail: buildRenovacionEmail,
    buildRenovacionWaUrl: buildRenovacionWaUrl
  };
}
