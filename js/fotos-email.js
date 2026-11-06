/**
 * Cotizador SDI · Correo "Paso 1 · Fotografías" (6 nov 2026)
 *
 * El correo que el agente le manda al cliente cuando confirma la cita: el
 * enlace de la plataforma del INS (asegurarte.grupoins.com) para tomar las
 * fotos del vehículo. Antes JC lo armaba a mano en Gmail con un código QR;
 * ahora va SOLO con el enlace (decisión de JC: el cliente casi siempre lee el
 * correo en el celular y un QR no se puede escanear desde la misma pantalla).
 *
 * Mockup aprobado por JC el 6 nov 2026 (F1-F4). Los textos son los de su
 * correo, en el mismo orden; solo el paso 2 dejó de hablar del QR.
 *
 * 🔴 El enlace CAMBIA con cada cliente: no se guarda en el perfil. Y solo se
 * acepta uno de la plataforma del INS (esEnlaceFotosIns), para que un dedazo
 * no le mande al cliente un enlace ajeno firmado con la licencia del agente.
 *
 * Depende de: config.js (CFG) y email-marca.js (_fileteSDI, _tarjetaVehiculo,
 * _pieSDI, _lineasAsesor, _asesor). Orden de carga: después de email-marca.js.
 */

/** ¿Es un enlace de la plataforma de fotos del INS? Solo https y host exacto. */
function esEnlaceFotosIns(url) {
  var u = String(url == null ? '' : url).trim();
  if (!u || /[\s<>"']/.test(u)) return false;
  var m = u.match(/^https:\/\/([^\/?#]+)(\/[^?#]*)?/i);
  if (!m) return false;
  return m[1].toLowerCase() === 'asegurarte.grupoins.com' && !!m[2] && m[2].length > 1;
}

/** Asunto del correo: con placa si la hay (así el agente lo encuentra en Enviados). */
function fotosAsunto(p) {
  var o = p || {};
  var placa = String(o.placa || '').trim().toUpperCase();
  return 'Paso 1 · Fotografías para asegurar su vehículo' + (placa ? ' · ' + placa : '');
}

/** URL pública de la guía de las fotografías (PDF del sitio). */
function fotosGuiaUrl() {
  return (typeof CFG !== 'undefined' && CFG.FOTOS_GUIA_URL) ||
    'https://cotizador.appsegurosdigitales.com/documentos-ins/guia-fotografias-autos.pdf';
}

function buildFotosEmail(params) {
  var e = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var p = params || {};
  var nombre   = String(p.nombrePila || '').trim();
  var vehiculo = String(p.vehiculo || '').trim();
  var placa    = String(p.placa || '').trim();
  var nota     = String(p.notaAdicional || '').trim();
  // Un enlace que no sea del INS no entra al correo (el envío ya lo bloquea; esto es la segunda red).
  var link     = esEnlaceFotosIns(p.enlace) ? e(String(p.enlace).trim()) : '';
  var guia     = e(fotosGuiaUrl());

  var fontFam  = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
  var fontBody = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  var NAVY = '#0c2340', AZUL = '#0369a1', GRIS = '#64748b', LINEA = '#e2e8f0', BANDA = '#eef4f9';

  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';

  var rotulo = function (t) {
    return '<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:' + GRIS + ';letter-spacing:0.1em;text-transform:uppercase;">' + t + '</p>';
  };
  var paso = function (n, t) {
    return '<tr><td width="30" valign="top" style="padding:6px 0;">' +
      '<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:' + BANDA + ';color:' + AZUL + ';font-family:' + fontFam + ';font-weight:700;font-size:12px;">' + n + '</span></td>' +
      '<td style="padding:6px 0;font-size:13.5px;color:#334155;line-height:1.55;">' + t + '</td></tr>';
  };

  var notaHtml = nota ? (
    '<tr><td style="padding:16px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;">' +
        '<tr><td style="padding:12px 16px;">' + rotulo('Nota de su agente') +
          '<p style="margin:0;font-size:13px;color:#334155;line-height:1.55;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
        '</td></tr></table></td></tr>') : '';

  var tarjeta = (vehiculo || placa) ? _tarjetaVehiculo({
    vehiculo: vehiculo || 'Su vehículo', plate: placa, plateClass: p.plateClass,
    fontFam: fontFam, rotulo: 'Veh&iacute;culo por asegurar'
  }) : '';

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Paso 1 &middot; Fotograf&iacute;as de su veh&iacute;culo</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  '<tr><td bgcolor="' + NAVY + '" style="background:' + NAVY + ';color:#ffffff;padding:28px 32px;text-align:center;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="46" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;height:46px;">' +
    '<h1 style="margin:0;font-family:' + fontFam + ';font-size:22px;font-weight:700;letter-spacing:-.01em;">Paso 1 &middot; Fotograf&iacute;as de su veh&iacute;culo</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.75;">Seguros del INS &middot; P&oacute;liza de Autom&oacute;viles</p>' +
  '</td></tr>' +
  _fileteSDI() +

  '<tr><td style="padding:28px 32px 12px;">' +
    '<p style="margin:0;font-size:11px;color:' + GRIS + ';font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Hola</p>' +
    '<p style="margin:4px 0 0;font-family:' + fontFam + ';font-size:24px;font-weight:700;color:' + NAVY + ';letter-spacing:-0.01em;">' + e(nombre) + ',</p>' +
  '</td></tr>' +

  tarjeta +

  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0;font-size:14px;line-height:1.65;color:#334155;">Para iniciar con el proceso de aseguramiento de su veh&iacute;culo, es necesario realizar una <b style="color:' + NAVY + ';">inspecci&oacute;n fotogr&aacute;fica</b> de su autom&oacute;vil.</p>' +
  '</td></tr>' +

  '<tr><td style="padding:22px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + BANDA + '" style="background:' + BANDA + ';border-radius:16px;">' +
      '<tr><td style="padding:24px 22px;text-align:center;">' +
        '<p style="margin:0 0 6px;font-family:' + fontFam + ';font-size:16px;font-weight:700;color:' + NAVY + ';">Plataforma segura del INS para las fotograf&iacute;as</p>' +
        '<p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.55;">&Aacute;brala desde su <b style="color:#334155;">tel&eacute;fono celular</b>, con el veh&iacute;culo a la vista.</p>' +
        '<a href="' + link + '" style="display:inline-block;background:' + AZUL + ';color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 26px;font-family:' + fontFam + ';font-weight:700;font-size:14px;">Tomar las fotograf&iacute;as &rarr;</a>' +
        '<p style="margin:14px 0 0;font-size:11.5px;color:' + GRIS + ';line-height:1.5;">Si el bot&oacute;n no abre, copie este enlace en el navegador del celular:<br>' +
          '<a href="' + link + '" style="color:' + AZUL + ';word-break:break-all;">' + link + '</a></p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  '<tr><td style="padding:24px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + LINEA + ';"><tr><td style="padding:14px 0 0;">' +
      rotulo('Por favor, siga estos sencillos pasos') +
      '<table cellpadding="0" cellspacing="0" border="0">' +
        paso(1, 'Active la localizaci&oacute;n en su celular (Ajustes generales / privacidad y seguridad / activar localizaci&oacute;n).') +
        paso(2, 'Abra el enlace de arriba desde su tel&eacute;fono celular.') +
        paso(3, 'Ser&aacute; redirigido a una plataforma segura donde podr&aacute; tomar y enviar las fotograf&iacute;as en tiempo real.') +
        paso(4, 'Aseg&uacute;rese de encontrarse en un lugar con buena iluminaci&oacute;n y de que las im&aacute;genes sean claras y completas.') +
      '</table>' +
      '<p style="margin:12px 0 0;"><a href="' + guia + '" style="display:inline-block;color:' + AZUL + ';text-decoration:none;border:1.5px solid ' + AZUL + ';border-radius:999px;padding:8px 16px;font-family:' + fontFam + ';font-weight:700;font-size:13px;">Ver la gu&iacute;a de las fotograf&iacute;as que se van a necesitar</a></p>' +
    '</td></tr></table>' +
  '</td></tr>' +

  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0;font-size:13.5px;line-height:1.6;color:#334155;">Una vez completado este paso, nuestro equipo verificar&aacute; las fotograf&iacute;as y le notificar&aacute; cuando la inspecci&oacute;n haya sido aprobada.</p>' +
    '<p style="margin:10px 0 0;font-size:13.5px;line-height:1.6;color:#334155;">Si tiene alguna duda durante el proceso, puede responder a este correo o contactarnos por WhatsApp.</p>' +
  '</td></tr>' +

  notaHtml +

  '<tr><td style="padding:26px 32px 26px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + LINEA + ';"><tr><td style="padding-top:18px;">' +
      '<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">Saludos cordiales,</p>' +
      '<p style="margin:12px 0 0;font-family:' + fontFam + ';font-weight:700;color:' + NAVY + ';font-size:15px;">' + e(agente) + '</p>' +
      '<p style="margin:3px 0 0;font-size:11.5px;color:' + GRIS + ';line-height:1.6;">' + (_lineasAsesor(correoAg).map(e).join('<br>') || 'Agente de Seguros Exclusivo &middot; Instituto Nacional de Seguros') + '<br>' +
        'Licencia SUGESE ' + e(lic) + ' &middot; Tel: ' + e(tel) + '<br>' +
        '<a href="mailto:' + e(correoAg) + '" style="color:' + AZUL + ';text-decoration:none;">' + e(correoAg) + '</a>' + (web ? (' &middot; ' + e(web)) : '') +
      '</p>' +
    '</td></tr></table>' +
  '</td></tr>' +

  _pieSDI({ logo: CFG.LOGO_SDI_URL, correo: correoAg, web: web, tel: tel, agente: agente, licencia: lic }) +

'</table></td></tr></table></body></html>';
}

/** El mensaje de WhatsApp (de usted, como el correo). Con el enlace del INS tal cual: ya es corto. */
function buildFotosWaTexto(p) {
  var o = p || {};
  var nombre = String(o.nombrePila || '').trim();
  var veh    = String(o.vehiculo || '').trim();
  var placa  = String(o.placa || '').trim().toUpperCase();
  var agente = String((typeof CFG !== 'undefined' && CFG.FROM_NAME) || '').trim().split(/\s+/).slice(0, 2).join(' ');
  var correoAg = (typeof CFG !== 'undefined' && CFG.FROM_EMAIL) || '';
  var rol = (typeof _asesor === 'function' && _asesor(correoAg)) ? 'su asesor de seguros del INS' : 'su agente del INS';
  var que = veh ? 'su ' + veh + (placa ? ' (' + placa + ')' : '') : (placa ? 'su vehículo placa ' + placa : 'su vehículo');
  return 'Hola' + (nombre ? ' ' + nombre : '') + ', ' + (agente ? 'soy ' + agente + ', ' : 'le escribe ') + rol + '. ' +
    'Para iniciar el aseguramiento de ' + que + ' necesitamos las fotografías del vehículo. ' +
    'Active la localización del celular y abra este enlace desde el teléfono:\n' + String(o.enlace || '').trim() + '\n\n' +
    'Le envié también las instrucciones a su correo.';
}

function buildFotosWaUrl(p) {
  var o = p || {};
  var tel = String(o.telCliente == null ? '' : o.telCliente).replace(/\D/g, '');
  if (tel.length === 8) tel = '506' + tel;
  return 'https://web.whatsapp.com/send/?' + (tel ? 'phone=' + tel + '&' : '') + 'text=' + encodeURIComponent(buildFotosWaTexto(o));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esEnlaceFotosIns: esEnlaceFotosIns,
    fotosAsunto: fotosAsunto,
    fotosGuiaUrl: fotosGuiaUrl,
    buildFotosEmail: buildFotosEmail,
    buildFotosWaTexto: buildFotosWaTexto,
    buildFotosWaUrl: buildFotosWaUrl
  };
}
