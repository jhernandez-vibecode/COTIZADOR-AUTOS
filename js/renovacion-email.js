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
 * VARIOS RECIBOS EN UN SOLO CORREO (JC, 10 ago 2026). Un cliente puede tener
 * dos pólizas, y un plan familiar llega a cinco o más. En vez de mandar cinco
 * correos, se manda uno con la lista de recibos y el total pagado. En el plan
 * familiar los recibos vienen a nombre de personas distintas (esposo, esposa,
 * hijos): el correo se dirige al DUEÑO DEL PLAN, que elige el agente, y la
 * tabla muestra a quién corresponde cada póliza.
 *
 * API:
 *   buildRenovacionEmail({ nombrePila, cliente, recibos:[{poliza, placa,
 *                          vehiculo, periodoDesde, periodoHasta, montoTexto,
 *                          monto, asegurado}], numComprobante, fechaPago,
 *                          totalTexto, notaAdicional }) -> HTML
 *   buildRenovacionWaUrl({ nombrePila, poliza, placa, recibos, telCliente,
 *                          urlGuia }) -> URL
 *
 * Con UN recibo se puede llamar con los campos sueltos (poliza, placa,
 * montoTexto…) y el correo queda idéntico al de siempre.
 */

/**
 * Normaliza la entrada a una lista de recibos. Acepta el formato de un solo
 * recibo (campos sueltos) para no romper a quien ya llama así.
 * @returns {Array<object>}
 */
function _renovRecibos(p) {
  if (p && Array.isArray(p.recibos) && p.recibos.length) return p.recibos;
  if (!p) return [];
  var suelto = {
    poliza: p.poliza, placa: p.placa, vehiculo: p.vehiculo,
    periodoDesde: p.periodoDesde, periodoHasta: p.periodoHasta,
    montoTexto: p.montoTexto, monto: p.monto, asegurado: p.cliente
  };
  return (suelto.poliza || suelto.placa || suelto.montoTexto) ? [suelto] : [];
}

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
 * Con `sinCorreo` el texto NO afirma que se mandó un correo: ese correo no
 * existe y el cliente lo esperaría con su comprobante adentro.
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
function buildRenovacionWaTexto(params) {
  var p = params || {};
  var saludo = String(p.nombrePila || '').trim();
  var lista  = _renovRecibos(p);
  var guia   = String(p.urlGuia || '').trim() || _renovAsistenciaUrl();
  var n      = lista.length;

  // Con VARIAS pólizas no se nombra una sola: se dice cuántas. Con una, el
  // mensaje queda igual que siempre. Sin número de póliza la frase entera
  // desaparece en vez de quedar colgando; sin placa se va solo el paréntesis.
  var ident = '';
  if (n > 1) {
    ident = 'Sus ' + n + ' pólizas continúan activas y sus vehículos protegidos, sin trámites pendientes.\n';
  } else if (n === 1) {
    var poliza = String(lista[0].poliza || '').trim();
    var placa  = String(lista[0].placa  || '').trim();
    if (poliza) {
      ident = 'Su póliza ' + poliza + (placa ? ' (placa ' + placa + ')' : '') +
              ' continúa activa y su vehículo protegido, sin trámites pendientes.\n';
    } else if (placa) {
      ident = 'Su vehículo placa ' + placa +
              ' continúa protegido, sin trámites pendientes.\n';
    }
  }

  // El plural del comprobante se arma una sola vez: lo usan las dos redacciones.
  var comprobantes = n > 1
    ? 'los comprobantes de pago oficiales del INS': 'el comprobante de pago oficial del INS';

  // SIN CORREO el mensaje NO puede decir "le acabo de enviar a su correo": ese
  // correo no existe y el cliente lo esperaría con su comprobante adentro. El
  // orden se invierte a propósito — primero la póliza, después el comprobante —
  // porque lo que confirma la renovación pasa a ser la póliza activa y no el
  // envío. WhatsApp no deja adjuntar archivos desde un enlace, así que el PDF lo
  // arrastra el agente al chat y la pantalla se lo deja descargado para eso.
  var cuerpo = p.sinCorreo
    ? ident + 'Aquí mismo le comparto ' + comprobantes + '.\n': 'Le acabo de enviar a su correo ' + comprobantes + '.\n' + ident;

  var msg =
    '¡' + (saludo ? saludo + ', su' : 'Su') + ' renovación está confirmada! ✅🚗\n\n' +
    cuerpo + '\n' +
    'Recuerde: ante un accidente o avería, repórtelo de inmediato. En esta guía tiene los pasos a seguir y los números de asistencia 24/7 a un clic:\n\n' +
    (guia ? '👉 ' + guia + '\n\n' : '') +
    'Gracias por renovar su confianza. Estoy para servirle. 🛡️';

  return msg;
}

/**
 * El mismo mensaje, ya envuelto en la URL que abre el chat.
 *
 * SIEMPRE web.whatsapp.com/send/ -- wa.me corrompe los emojis.
 */
function buildRenovacionWaUrl(params) {
  var p = params || {};
  var phone = _renovWaIntl(p.telCliente);
  return 'https://web.whatsapp.com/send/?'+ (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(buildRenovacionWaTexto(p));
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
  var recibos  = _renovRecibos(p);
  var varios   = recibos.length > 1;
  var uno      = recibos[0] || {};
  var poliza   = (uno.poliza   || '').trim();
  var placa    = (uno.placa    || '').trim();
  var vehiculo = (uno.vehiculo || '').trim();
  var comprob  = (p.numComprobante || '').trim();
  var montoTxt = (uno.montoTexto || '').trim();
  var desde    = (uno.periodoDesde  || '').trim();
  var hasta    = (uno.periodoHasta  || '').trim();
  var fPago    = (p.fechaPago     || '').trim();
  var nota     = (p.notaAdicional || '').trim();

  // Total: lo manda la app ya formateado; si no viene, se suma acá.
  var totalTxt = (p.totalTexto || '').trim();
  if (varios && !totalTxt) {
    var suma = 0, sumable = true;
    for (var q = 0; q < recibos.length; q++) {
      var v = recibos[q].monto;
      if (typeof v !== 'number' || !isFinite(v)) { sumable = false; break; }
      suma += v;
    }
    if (sumable) {
      totalTxt = '₡' + suma.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
  }

  // En un plan familiar las pólizas vienen a nombre de distintas personas de la
  // familia. Si difieren, la tabla lleva columna "Asegurado" para que el dueño
  // del plan sepa cuál es de quién.
  var aseg = [];
  for (var w = 0; w < recibos.length; w++) {
    var a = String(recibos[w].asegurado || '').trim();
    if (a && aseg.indexOf(a) === -1) aseg.push(a);
  }
  var mostrarAsegurado = varios && aseg.length > 1;

  var fontFam  = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
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

  // Escapado UNA vez: entra crudo a tres href (assistUrl / viajeUrl / estUrl) y
  // el resto del archivo ya pasa todo por e() o _safe().
  var siteFallback = web ? e('https://' + web) : '';
  // El botón de la guía lleva la URL LARGA a propósito: armar el correo no debe
  // depender de una llamada de red al acortador. El corto es cosa del WhatsApp,
  // donde el cliente ve la dirección cruda.
  var assistUrl = e(_renovAsistenciaUrl()) || siteFallback || '#';
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  // Confirmación en singular o en plural según cuántos recibos entren.
  var vehFrase, polizaFrase;
  if (varios) {
    polizaFrase = ' de <b style="color:#0c2340;">sus ' + recibos.length + ' pólizas de automóviles</b>';
    vehFrase    = 'sus vehículos';
  } else {
    // "su vehículo TOYOTA YARIS 2019 placa BXY123" / "su vehículo placa BXY123"
    vehFrase = 'su vehículo' +
      (vehiculo ? ' <b style="color:#0c2340;">' + e(vehiculo) + '</b>' : '') +
      (placa ? ' placa <b style="color:#0c2340;">' + e(placa) + '</b>' : '');
    polizaFrase = poliza
      ? ' de su póliza No. <b style="color:#0c2340;">' + e(poliza) + '</b>': ' de su póliza de automóviles';
  }
  var vehPlural  = varios ? 'continúan protegidos' : 'continúa protegido';
  var adjFrase   = varios
    ? 'Adjunto encontrará los comprobantes de pago oficiales del INS.': 'Adjunto encontrará el comprobante de pago oficial del INS.';

  // Detalle de la tarjeta navy. Con UN recibo: los 4 datos en dos columnas.
  // Con VARIOS: una fila por póliza, para que el cliente vea qué se pagó de cada
  // una y no solo un total suelto.
  var datosHtml = '';
  if (varios) {
    datosHtml =
      '<tr><td colspan="2" style="padding-top:4px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' +
          '<tr>' +
            '<th align="left" style="font-family:' + fontNum + ';font-size:9px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;font-weight:600;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.16);">Póliza</th>' +
            (mostrarAsegurado ? '<th align="left" style="font-family:' + fontNum + ';font-size:9px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;font-weight:600;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.16);">Asegurado</th>' : '') +
            '<th align="left" style="font-family:' + fontNum + ';font-size:9px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;font-weight:600;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.16);">Placa</th>' +
            '<th align="left" style="font-family:' + fontNum + ';font-size:9px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;font-weight:600;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.16);">Período pagado</th>' +
            '<th align="right" style="font-family:' + fontNum + ';font-size:9px;letter-spacing:.1em;color:#7d93ad;text-transform:uppercase;font-weight:600;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.16);">Monto</th>' +
          '</tr>' +
          (function () {
            var filas = '';
            for (var r = 0; r < recibos.length; r++) {
              var x = recibos[r];
              var per = (x.periodoDesde && x.periodoHasta)
                ? (e(x.periodoDesde) + ' &rarr; ' + e(x.periodoHasta)) : '&mdash;';
              filas +=
                '<tr>' +
                  '<td style="font-family:' + fontNum + ';font-size:11.5px;color:#e8eef5;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.09);">' + (e(x.poliza) || '&mdash;') + '</td>' +
                  (mostrarAsegurado ? '<td style="font-size:11.5px;color:#cbd5e1;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.09);">' + (e(x.asegurado) || '&mdash;') + '</td>' : '') +
                  '<td style="font-family:' + fontNum + ';font-size:11.5px;color:#e8eef5;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.09);">' + (e(x.placa) || '&mdash;') + '</td>' +
                  '<td style="font-family:' + fontNum + ';font-size:11.5px;color:#e8eef5;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.09);">' + per + '</td>' +
                  '<td align="right" style="font-family:' + fontNum + ';font-size:11.5px;color:#ffffff;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.09);">' + (e(x.montoTexto) || '&mdash;') + '</td>' +
                '</tr>';
            }
            return filas;
          })() +
        '</table>' +
      '</td></tr>';
  } else {
    var datos = [];
    if (poliza) datos.push(['Póliza', poliza]);
    if (placa)  datos.push(['Placa', placa]);
    if (desde && hasta) datos.push(['Período pagado', desde + ' &rarr; ' + hasta]);
    if (fPago)  datos.push(['Fecha de pago', fPago]);

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
  }

  var notaHtml = nota ? (
    '<tr><td style="padding:6px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:4px solid #ea580c;border-radius:8px;">' +
        '<tr><td style="padding:12px 16px;">' +
          '<p style="margin:0 0 3px;font-size:11px;font-weight:bold;color:#9a3412;letter-spacing:.06em;text-transform:uppercase;">Nota de su agente</p>' +
          '<p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.55;">' + e(nota).replace(/\n/g, '<br>') + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>') : '';

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
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER (INS arriba: es la cara al cliente). Desde el 1 sep 2026 es
  //    IGUAL al del correo "Recibo de pago" de SASINS (pedido JC): logo INS
  //    36px, "Recibo de pago" 20px y "Renovación confirmada" 12px sobre
  //    #1a3a5c — transcripción literal de gmail.js envolverCorreoHtml
  //    (variante headerLogo). Solo cambió este bloque; el resto del correo
  //    queda como estaba.
  '<tr><td bgcolor="#1a3a5c" style="background:#1a3a5c;padding:24px 32px 20px;text-align:center">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="36" style="height:36px;display:inline-block;margin-bottom:10px">' +
    '<div style="font-size:20px;font-weight:700;color:#fff">Recibo de pago</div>' +
    '<div style="font-size:12px;color:#a0c4e8;margin-top:2px">Renovaci&oacute;n confirmada</div>' +
  '</td></tr>' +
  // 1b. FILETE DE MARCA SDI bajo el header (pedido JC 1 sep 2026; bloque
  //     compartido de js/email-marca.js, el mismo del correo de cotización).
  _fileteSDI() +

  // 2. SALUDO + confirmación del pago (verde). El "Adjunto encontrará…" va en
  //    párrafo aparte con aire: JC pidió que no se leyera como un solo bloque.
  '<tr><td style="padding:26px 32px 4px;">' +
    '<p style="margin:0 0 14px;font-family:' + fontFam + ';font-size:18px;font-weight:700;color:#0c2340;">Hola ' + e(saludo) + ',</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:10px;">' +
      '<tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;color:#065f46;">' +
        '<p style="margin:0;">Es un gusto saludarle. Le confirmo que el pago de la renovación' + polizaFrase + ' fue aplicado correctamente y ' + vehFrase + ' ' + vehPlural + ', sin interrupciones.</p>' +
        '<p style="margin:10px 0 0;">' + adjFrase + ' &#9989;</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 3. TARJETA DEL COMPROBANTE (navy, filete dorado SDI abajo)
  (montoTxt || totalTxt || datosHtml ?
  '<tr><td style="padding:18px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c2340;border-radius:12px;border-bottom:4px solid #c9a227;">' +
      '<tr><td style="padding:20px 22px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          '<td valign="top">' +
            (varios ?
              '<div style="font-family:' + fontNum + ';font-size:10px;letter-spacing:.16em;color:#8ba3bf;text-transform:uppercase;">Total pagado</div>' +
              (totalTxt ? '<div style="font-family:' + fontFam + ';font-size:34px;font-weight:700;color:#ffffff;letter-spacing:-.02em;padding:4px 0 2px;">' + e(totalTxt) + '</div>' : '') +
              '<div style="font-size:11px;color:#8ba3bf;">Incluye IVA &middot; ' + recibos.length + ' recibos' + (fPago ? ' &middot; Fecha de pago ' + e(fPago) : '') + '</div>': (montoTxt ?
              '<div style="font-family:' + fontNum + ';font-size:10px;letter-spacing:.16em;color:#8ba3bf;text-transform:uppercase;">Monto pagado</div>' +
              '<div style="font-family:' + fontFam + ';font-size:34px;font-weight:700;color:#ffffff;letter-spacing:-.02em;padding:4px 0 2px;">' + e(montoTxt) + '</div>' +
              '<div style="font-size:11px;color:#8ba3bf;">Incluye IVA' + (comprob ? ' &middot; Comprobante N&ordm; ' + e(comprob) : '') + '</div>': '')) +
          '</td>' +
          '<td valign="top" align="right" style="white-space:nowrap;">' +
            '<span style="display:inline-block;background:#0f766e;color:#d1fae5;font-family:' + fontNum + ';font-size:10px;letter-spacing:.14em;padding:5px 12px;border-radius:999px;">PAGADO</span>' +
          '</td>' +
        '</tr></table>' +
        (datosHtml ?
          '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,.14);margin-top:14px;">' + datosHtml + '</table>': '') +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' : '') +

  // 4. QUÉ HACER SI OCURRE UN EVENTO — el corazón del correo. Información de
  //    servicio, no venta. Solo teléfonos verificados del INS.
  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0 0 12px;font-family:' + fontFam + ';font-size:15px;font-weight:700;color:#0c2340;"> &iquest;Qu&eacute; hacer si ocurre un evento?</p>' +
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
        '<a href="' + assistUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;font-family:' + fontFam + ';font-weight:700;font-size:14px;"> Abrir mi gu&iacute;a de emergencias &rarr;</a>' +
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
        '<p style="margin:0 0 2px;font-size:22px;line-height:1;"></p>' +
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

  // 8. PIE con la marca SDI (modulo compartido js/email-marca.js)
  _pieSDI({
    logo: CFG.LOGO_SDI_URL, correo: correoAg, web: web,
    tel: tel, agente: agente, licencia: lic
  }) +


'</table></td></tr></table></body></html>';
}

// Export para tests Node (sin romper el browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildRenovacionWaTexto: buildRenovacionWaTexto,
    buildRenovacionEmail: buildRenovacionEmail,
    buildRenovacionWaUrl: buildRenovacionWaUrl
  };
}
