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
 * Email-friendly: tablas anidadas + estilos inline. Imágenes solo hosteadas en
 * el sitio (logo INS, logo SDI del pie, iconos del cross-sell): Gmail bloquea
 * SVG y base64. Rediseño en línea clara SDI el 13 sep 2026, calcado del correo
 * de Póliza activa (poliza-email.js): orden nuevo, sin barras a la izquierda,
 * píldoras, tarjeta del vehículo compartida con la cotización.
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
  // Cifras en colones: monoespaciada. El ₡ de Space Grotesk se monta sobre el
  // dígito siguiente en tamaños grandes.
  var fontNum  = "'JetBrains Mono',Consolas,'Courier New',monospace";

  // Paleta (literal, como en poliza-email.js: no se usan las SDI_* de
  // email-marca.js para no depender del orden de <script> ni romper el eval de
  // los tests).
  var NAVY = '#0c2340', AZUL = '#0369a1', VERDE = '#047857', GRIS = '#64748b';
  var LINEA = '#e2e8f0', BANDA = '#eef4f9';

  // Datos del agente (perfil → CFG)
  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  // website: valor CRUDO del perfil, SIN fallback al sitio del owner. Un agente
  // sin web propia no arrastra la de JC a su correo.
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';
  // Iconos del cross-sell: PNG alojados en el sitio, igual que el logo del INS
  // (Gmail bloquea SVG y base64; una imagen hosteada con URL absoluta sí pasa).
  // Si el cliente bloquea imágenes, queda el círculo pálido y el texto completo.
  var icoBase  = String(logoUrl).replace(/\/[^\/]*$/, '/');
  var icoViaje = icoBase + 'ico-viaje.png';
  var icoEst   = icoBase + 'ico-estudiantil.png';

  // Escapado UNA vez: entra crudo a tres href (assistUrl / viajeUrl / estUrl) y
  // el resto del archivo ya pasa todo por e() o _safe().
  var siteFallback = web ? e('https://' + web) : '';
  // El botón de la guía lleva la URL LARGA a propósito: armar el correo no debe
  // depender de una llamada de red al acortador. El corto es cosa del WhatsApp,
  // donde el cliente ve la dirección cruda.
  var assistUrl = e(_renovAsistenciaUrl()) || siteFallback || '#';
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  // ---- Piezas repetidas (línea clara: sin barras de color a la izquierda) ----
  var rotulo = function (t) {
    return '<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:' + GRIS + ';letter-spacing:0.1em;text-transform:uppercase;">' + t + '</p>';
  };
  // Bloque con rótulo sobre una regla de 1 px.
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
  // Dato del pago: rótulo a la izquierda, valor en tinta a la derecha.
  var dato = function (rot, val, ultimo) {
    var borde = ultimo ? '' : 'border-bottom:1px solid ' + LINEA + ';';
    return '<tr><td style="padding:6px 0;' + borde + 'font-size:13px;color:#475569;">' + rot + '</td>' +
      '<td align="right" style="padding:6px 0;' + borde + 'font-family:' + fontFam + ';font-size:14px;font-weight:700;color:' + NAVY + ';white-space:nowrap;">' + val + '</td></tr>';
  };
  // Paso de la mini-guía de evento: qué hacer a la izquierda, el teléfono grande
  // y en tinta a la derecha (tabla de dos columnas, como los contactos de la
  // póliza activa).
  var paso = function (titulo, texto, num, ultimo) {
    var borde = ultimo ? '' : 'border-bottom:1px solid ' + LINEA + ';';
    return '<tr><td valign="top" style="padding:10px 12px 10px 0;' + borde + '">' +
        '<p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:' + NAVY + ';">' + titulo + '</p>' +
        '<p style="margin:0;font-size:12.5px;color:#475569;line-height:1.55;">' + texto + '</p>' +
      '</td>' +
      '<td align="right" valign="top" style="padding:10px 0;' + borde + 'font-family:' + fontFam + ';font-size:16px;font-weight:700;color:' + NAVY + ';white-space:nowrap;">' + num + '</td></tr>';
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

  // Confirmación en singular o en plural según cuántos recibos entren. Con uno,
  // el vehículo y la placa ya van en la tarjeta: el párrafo no los repite.
  var polizaFrase = varios
    ? ' de <b style="color:' + NAVY + ';">sus ' + recibos.length + ' p&oacute;lizas de autom&oacute;viles</b>'
    : ' de su p&oacute;liza';
  var vehFrase   = varios ? 'sus veh&iacute;culos contin&uacute;an protegidos' : 'su veh&iacute;culo contin&uacute;a protegido';
  var adjFrase   = varios
    ? 'Adjunto encontrar&aacute; los comprobantes de pago oficiales del INS.'
    : 'Adjunto encontrar&aacute; el comprobante de pago oficial del INS.';

  // Tarjeta del vehículo asegurado (módulo compartido) con el N.º de póliza
  // debajo. La placa se dibuja como matrícula: roja si es CL. Con VARIOS
  // recibos hay varios vehículos: la tarjeta se reemplaza por la tabla de abajo.
  var tarjetaHtml = '';
  if (!varios && (vehiculo || placa || poliza)) {
    var polizaLinea = poliza
      ? '<p style="margin:6px 0 0;font-size:12.5px;color:' + GRIS + ';">P&oacute;liza N.&ordm; <b style="color:' + NAVY + ';letter-spacing:0.02em;">' + e(poliza) + '</b></p>'
      : '';
    tarjetaHtml = _tarjetaVehiculo({
      vehiculo: vehiculo || 'Su vehículo', plate: placa, plateClass: uno.plateClass,
      fontFam: fontFam, rotulo: 'Veh&iacute;culo asegurado', extra: polizaLinea
    });
  }

  // Detalle del pago. Con UN recibo: monto grande + datos en dos columnas.
  // Con VARIOS: una fila por póliza y el total, para que el cliente vea qué se
  // pagó de cada una y no solo un total suelto.
  var pagoHtml = '';
  if (varios) {
    var th = function (t, der) {
      return '<th align="' + (der ? 'right' : 'left') + '" style="font-size:10px;letter-spacing:.08em;color:' + GRIS + ';text-transform:uppercase;font-weight:700;padding:6px 4px;border-bottom:1px solid ' + LINEA + ';">' + t + '</th>';
    };
    var td = function (t, der, mono) {
      return '<td align="' + (der ? 'right' : 'left') + '" style="font-family:' + (mono ? fontNum : fontBody) + ';font-size:12px;color:' + (der ? NAVY : '#334155') + ';' + (der ? 'font-weight:700;' : '') + 'padding:8px 4px;border-bottom:1px solid ' + LINEA + ';white-space:nowrap;">' + t + '</td>';
    };
    var filas = '';
    for (var r = 0; r < recibos.length; r++) {
      var x = recibos[r];
      var per = (x.periodoDesde && x.periodoHasta)
        ? (e(x.periodoDesde) + ' &rarr; ' + e(x.periodoHasta)) : '&mdash;';
      filas += '<tr>' +
        td(e(x.poliza) || '&mdash;', false, true) +
        (mostrarAsegurado ? td(e(x.asegurado) || '&mdash;', false, false) : '') +
        td(e(x.placa) || '&mdash;', false, true) +
        td(per, false, false) +
        td(e(x.montoTexto) || '&mdash;', true, true) +
      '</tr>';
    }
    pagoHtml = seccion('Recibos pagados',
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' +
        '<tr>' + th('P&oacute;liza') + (mostrarAsegurado ? th('Asegurado') : '') + th('Placa') + th('Per&iacute;odo pagado') + th('Monto', true) + '</tr>' +
        filas +
        (totalTxt ?
          '<tr><td colspan="' + (mostrarAsegurado ? 4 : 3) + '" style="padding:12px 4px 0;font-size:11px;color:' + GRIS + ';">Incluye IVA &middot; ' + recibos.length + ' recibos' + (fPago ? ' &middot; Fecha de pago ' + e(fPago) : '') + '</td>' +
          '<td align="right" style="padding:12px 4px 0;white-space:nowrap;">' +
            rotulo('Total pagado') +
            '<span style="font-family:' + fontNum + ';font-size:26px;font-weight:700;color:' + NAVY + ';letter-spacing:-.02em;">' + e(totalTxt) + '</span>' +
          '</td></tr>' : '') +
      '</table>', 24);
  } else if (montoTxt || desde || fPago) {
    var datos = '';
    if (desde && hasta) datos += dato('Per&iacute;odo pagado', e(desde) + ' &rarr; ' + e(hasta), !fPago && !comprob);
    if (fPago)          datos += dato('Fecha de pago', e(fPago), !comprob);
    if (comprob)        datos += dato('Comprobante N.&ordm;', e(comprob), true);
    pagoHtml = seccion('Detalle del pago',
      (montoTxt ?
        '<p style="margin:0;font-size:11px;color:' + GRIS + ';">Monto pagado</p>' +
        '<p style="margin:2px 0 10px;font-family:' + fontNum + ';font-size:30px;font-weight:700;color:' + NAVY + ';letter-spacing:-.02em;line-height:1.1;">' + e(montoTxt) + ' <span style="font-family:' + fontBody + ';font-size:11px;font-weight:400;color:' + GRIS + ';letter-spacing:0;">Incluye IVA</span></p>' : '') +
      (datos ? '<table width="100%" cellpadding="0" cellspacing="0" border="0">' + datos + '</table>' : ''), 24);
  }

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
'<title>Su renovación está confirmada &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + fontBody + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1. HEADER navy + filete de marca SDI (igual al correo de cotización)
  '<tr><td bgcolor="' + NAVY + '" style="background:' + NAVY + ';color:#ffffff;padding:28px 32px;text-align:center;">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="46" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;height:46px;">' +
    '<h1 style="margin:0;font-family:' + fontFam + ';font-size:22px;font-weight:700;letter-spacing:-.01em;">Su renovaci&oacute;n est&aacute; confirmada</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.75;">Seguros del INS &middot; P&oacute;liza de Autom&oacute;viles</p>' +
  '</td></tr>' +
  _fileteSDI() +

  // 2. SALUDO
  '<tr><td style="padding:28px 32px 12px;">' +
    '<p style="margin:0;font-size:11px;color:' + GRIS + ';font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Hola</p>' +
    '<p style="margin:4px 0 0;font-family:' + fontFam + ';font-size:24px;font-weight:700;color:' + NAVY + ';letter-spacing:-0.01em;">' + e(saludo) + ',</p>' +
  '</td></tr>' +

  // 3. TARJETA DEL VEHÍCULO ASEGURADO (un recibo: placa + N.º de póliza)
  tarjetaHtml +

  // 4. CONFIRMACIÓN (sello verde pálido + párrafo). El "Adjunto encontrará…" va
  //    en párrafo aparte con aire: JC pidió que no se leyera como un solo bloque.
  '<tr><td style="padding:22px 32px 0;">' +
    '<p style="margin:0 0 10px;"><span style="display:inline-block;background:#ecfdf5;color:' + VERDE + ';font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;">&#9679;&nbsp; Pago aplicado</span></p>' +
    '<p style="margin:0;font-size:14px;line-height:1.65;color:#334155;">Es un gusto saludarle. Le confirmo que el pago de la renovaci&oacute;n' + polizaFrase + ' <b style="color:' + NAVY + ';">fue aplicado correctamente</b> y ' + vehFrase + ', sin interrupciones.</p>' +
    '<p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#334155;">' + adjFrase + '</p>' +
  '</td></tr>' +

  // 5. DETALLE DEL PAGO (un recibo) o RECIBOS PAGADOS (varios)
  pagoHtml +

  // 6. QUÉ HACER SI OCURRE UN EVENTO — el corazón del correo. Información de
  //    servicio, no venta. Solo teléfonos verificados del INS.
  seccion('&iquest;Qu&eacute; hacer si ocurre un evento?',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
      paso('Primero, las personas', 'Si hay personas lesionadas, llame de inmediato.', '911', false) +
      paso('Reporte el accidente de una vez', 'Llame a Colisiones del INS para que le env&iacute;en un inspector.', '800-800-8000', false) +
      paso('&iquest;Aver&iacute;a en carretera?', 'Asistencia 24/7: gr&uacute;a, cerrajer&iacute;a, cambio de llanta, paso de corriente y env&iacute;o de combustible. El alcance de su plan, seg&uacute;n la antig&uuml;edad de su veh&iacute;culo, est&aacute; en su gu&iacute;a.', '800-800-8001', true) +
    '</table>', 24) +

  // 7. IMPORTANTE (única advertencia: regla dorada ARRIBA, no barra a la izquierda)
  '<tr><td style="padding:22px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border-top:3px solid #C9A227;border-radius:0 0 10px 10px;">' +
      '<tr><td style="padding:12px 16px 13px;font-size:12.5px;color:#713f12;line-height:1.55;"><b style="color:#422006;">Importante:</b> nunca haga acuerdos con terceros sin la autorizaci&oacute;n previa del INS &mdash; eso protege la validez de su cobertura.</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 8. CENTRO DE ASISTENCIA DIGITAL (banda pálida, píldora azul) con la ficha del agente
  '<tr><td style="padding:24px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + BANDA + '" style="background:' + BANDA + ';border-radius:16px;">' +
      '<tr><td style="padding:24px 22px;text-align:center;">' +
        '<p style="margin:0 0 6px;font-family:' + fontFam + ';font-size:16px;font-weight:700;color:' + NAVY + ';">Centro de Asistencia Digital</p>' +
        '<p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.55;">Todo esto, paso a paso y a un clic. Guarde su gu&iacute;a de emergencias: en el momento del evento le dice qu&eacute; hacer y le conecta con el contacto correcto al instante.</p>' +
        pildora(assistUrl, 'Abrir mi gu&iacute;a de emergencias &rarr;') +
        '<p style="margin:14px 0 0;font-size:11.5px;color:' + GRIS + ';line-height:1.5;">&Aacute;brala en el celular y elija <b style="color:#334155;">&laquo;A&ntilde;adir a pantalla de inicio&raquo;</b> para tenerla siempre a mano, como una app. Sin descargas.</p>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr>' +

  // 9. NOTA DEL AGENTE (solo si la escribe)
  notaHtml +

  // 10. CROSS-SELL con iconos (JC, 10 ago 2026: va SIEMPRE — este correo es a
  //     veces el único contacto del año con el cliente). Personalizable por agente.
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
      '<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">Gracias por renovar su confianza. Quedo a su disposici&oacute;n para cualquier consulta. Atentamente,</p>' +
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
    buildRenovacionWaTexto: buildRenovacionWaTexto,
    buildRenovacionEmail: buildRenovacionEmail,
    buildRenovacionWaUrl: buildRenovacionWaUrl
  };
}
