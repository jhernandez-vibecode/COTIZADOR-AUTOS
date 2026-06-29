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
 *   ASSIST_URL (Centro de Asistencia, con ?a=<id> del agente),
 *   XSELL_VIAJE_URL / XSELL_ESTUDIANTIL_URL (botones "Comprar" del cross-sell).
 *
 * Email-friendly: tablas anidadas + estilos inline + texto/color. Sin imágenes
 * salvo el logo INS del encabezado (hosteado). El footer SDI se recrea en HTML
 * (Gmail bloquea SVG/base64), igual que en email-template.js.
 *
 * API: buildPolizaActivaEmail({ nombrePila, cliente, poliza, vehiculo, placa,
 *                               notaAdicional }) -> string HTML
 */
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

  // Datos del agente (perfil → CFG)
  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  var web      = (CFG.WEBSITE   || 'www.segurosdelins.com').replace(/^https?:\/\//i, '');
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';

  // Links saneados (solo http/https). Si un cross-sell viene vacío, cae al sitio del agente.
  var siteFallback = web ? ('https://' + web) : '#';
  var assistUrl = _safe(CFG.ASSIST_URL) || siteFallback;
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  // Identificación del vehículo para el párrafo de confirmación.
  var vehTxt = e(vehiculo || 'su vehículo');
  var placaTxt = placa ? (' placa <b style="color:#0c2340;">' + e(placa) + '</b>') : '';
  var polizaTxt = poliza ? ('No. <b style="color:#0c2340;">' + e(poliza) + '</b>') : '';

  var notaHtml = nota ? (
    '<tr><td style="padding:6px 28px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:4px solid #ea580c;border-radius:8px;">' +
        '<tr><td style="padding:12px 16px;">' +
          '<p style="margin:0 0 3px;font-size:11px;font-weight:bold;color:#9a3412;letter-spacing:.06em;text-transform:uppercase;">Nota de tu agente</p>' +
          '<p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.55;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>'
  ) : '';

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Tu póliza está activa &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER
  '<tr><td bgcolor="#0c2340" style="background:#0c2340;color:#ffffff;padding:26px 32px;text-align:center;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="44" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;height:44px;">' +
    '<h1 style="margin:0;font-family:' + fontFam + ';font-size:21px;font-weight:700;letter-spacing:-.01em;">Póliza de Automóviles</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.78;">Seguros del INS &middot; Tu protección al volante</p>' +
  '</td></tr>' +

  // 2. SALUDO + confirmación (verde)
  '<tr><td style="padding:26px 32px 4px;">' +
    '<p style="margin:0 0 14px;font-family:' + fontFam + ';font-size:18px;font-weight:700;color:#0c2340;">Hola ' + e(saludo) + ',</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:10px;">' +
      '<tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;color:#065f46;">' +
        'Es un gusto saludarle. Le confirmo que su póliza ' + polizaTxt + ', que protege el vehículo <b style="color:#0c2340;">' + vehTxt + '</b>' + placaTxt + ', <b style="color:#047857;">ya se encuentra activa</b>. &#9989;' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 3. CENTRO DE ASISTENCIA DIGITAL
  '<tr><td style="padding:20px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">' +
      '<tr><td style="padding:18px;text-align:center;">' +
        '<p style="margin:0 0 4px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c4a6e;">Centro de Asistencia Digital (Exclusivo)</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.55;">Si tiene un accidente o avería, no pierda tiempo buscando números: esta guía le dice qué hacer paso a paso y le conecta al instante con el contacto correcto.</p>' +
        '<a href="' + assistUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;font-family:' + fontFam + ';font-weight:700;font-size:14px;">&#128241; Abrir mi guía de emergencias &rarr;</a>' +
        '<p style="margin:10px 0 0;font-size:11px;color:#64748b;line-height:1.5;">Ábrala en el celular y elija <b>"Añadir a pantalla de inicio"</b> para tenerla siempre a mano, como una App. Sin descargas.</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 4. DOCUMENTACIÓN ADJUNTA
  '<tr><td style="padding:18px 32px 0;">' +
    '<p style="margin:0 0 6px;font-family:' + fontFam + ';font-size:13px;font-weight:700;color:#0c2340;">&#128193; Documentación adjunta</p>' +
    '<p style="margin:0;font-size:13px;color:#334155;line-height:1.95;">' +
      '&#9989; Tarjeta del seguro<br>' +
      '&#9989; Condiciones Particulares y Generales<br>' +
      '&#9989; Comprobante de pago<br>' +
      '&#9989; Guía de asistencia en carretera' +
    '</p>' +
  '</td></tr>' +

  // 5. CONTACTOS DE EMERGENCIA
  '<tr><td style="padding:16px 32px 0;">' +
    '<p style="margin:0 0 6px;font-family:' + fontFam + ';font-size:13px;font-weight:700;color:#0c2340;">&#128222; Contactos de emergencia (guárdelos)</p>' +
    '<p style="margin:0;font-size:13px;color:#334155;line-height:1.9;">' +
      'Colisiones (Inspector): <b style="color:#0c2340;">800-800-8000</b> y <b style="color:#0c2340;">911</b><br>' +
      'Asistencia en carretera (grúa / avería): <b style="color:#0c2340;">800-800-8001</b>' +
    '</p>' +
  '</td></tr>' +

  // 6. NOTA IMPORTANTE (ámbar)
  '<tr><td style="padding:16px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;">' +
      '<tr>' +
        '<td width="30" valign="top" style="padding:12px 0 12px 14px;color:#f59e0b;font-size:16px;line-height:1.2;">&#9888;</td>' +
        '<td valign="top" style="padding:12px 14px 12px 4px;">' +
          '<p style="margin:0;font-size:12px;color:#78350f;line-height:1.55;"><b style="color:#422006;">Importante:</b> nunca realice acuerdos con terceros sin la autorización previa del INS, para no afectar la validez de su cobertura.</p>' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</td></tr>' +

  notaHtml +

  // 7. CROSS-SELL — Otros seguros que le pueden interesar (personalizable por agente)
  '<tr><td style="padding:22px 32px 0;">' +
    '<h2 style="margin:0 0 12px;font-family:' + fontFam + ';font-size:13px;font-weight:700;color:#0c2340;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e0e7ef;padding-bottom:8px;">Otros seguros que le pueden interesar</h2>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>' +
      // Viaje
      '<td width="50%" valign="top" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;">' +
        '<p style="margin:0 0 2px;font-size:22px;line-height:1;">&#9992;&#65039;</p>' +
        '<p style="margin:6px 0 2px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c2340;">Seguros de Viaje</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5;">Proteja su próxima aventura dentro y fuera del país.</p>' +
        '<a href="' + viajeUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">Comprar &rarr;</a>' +
      '</td>' +
      // Estudiantil
      '<td width="50%" valign="top" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">' +
        '<p style="margin:0 0 2px;font-size:22px;line-height:1;">&#127891;</p>' +
        '<p style="margin:6px 0 2px;font-family:' + fontFam + ';font-size:14px;font-weight:700;color:#0c2340;">Seguro Estudiantil</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5;">Asegure el futuro de sus hijos durante todo el año lectivo.</p>' +
        '<a href="' + estUrl + '" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">Comprar &rarr;</a>' +
      '</td>' +
    '</tr></table>' +
  '</td></tr>' +

  // 8. FIRMA
  '<tr><td style="padding:24px 32px 0;border-top:1px solid #e0e7ef;">' +
    '<p style="margin:18px 0 0;font-size:13px;color:#475569;line-height:1.5;">Quedo a su entera disposición para cualquier consulta. Atentamente,</p>' +
    '<p style="margin:10px 0 0;font-family:' + fontFam + ';font-weight:700;color:#0c2340;font-size:14px;">' + e(agente) + '</p>' +
    '<p style="margin:2px 0 0;font-size:11px;color:#64748b;line-height:1.6;">Agente de Seguros Exclusivo &middot; Instituto Nacional de Seguros<br>' +
      'Licencia SUGESE ' + e(lic) + ' &middot; Tel: ' + e(tel) + '<br>' +
      '<a href="mailto:' + e(correoAg) + '" style="color:#0369a1;text-decoration:none;">' + e(correoAg) + '</a> &middot; ' + e(web) +
    '</p>' +
  '</td></tr>' +

  // 9. FOOTER SDI (recreado en HTML, sin imagen)
  '<tr><td bgcolor="#0c2340" style="background:#0c2340;color:#cbd5e1;padding:24px 32px 22px;text-align:center;">' +
    '<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;"><tr>' +
      '<td valign="middle" style="font-family:' + fontFam + ';font-weight:500;font-size:30px;letter-spacing:-1px;color:#ffffff;line-height:1;">SDI</td>' +
      '<td valign="middle" style="padding-left:10px;"><table cellpadding="0" cellspacing="0" border="0">' +
        '<tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:20px;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
        '<tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>' +
        '<tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:20px;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
        '<tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>' +
        '<tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:20px;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
      '</table></td>' +
    '</tr></table>' +
    '<p style="margin:0;font-size:12px;color:#cbd5e1;">Plataforma de <b style="color:#ffffff;">Seguros Digitales SDI&reg;</b></p>' +
    '<p style="margin:8px 0 0;font-size:10px;color:#64748b;">&copy; 2026 Propiedad Intelectual de ' + e(agente) + '</p>' +
  '</td></tr>' +

'</table></td></tr></table></body></html>';
}

// Export para tests Node (sin romper el browser).
if (typeof module !== 'undefined' && module.exports) { module.exports = { buildPolizaActivaEmail: buildPolizaActivaEmail }; }
