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
    montoTexto: p.montoTexto, monto: p.monto, moneda: p.moneda, asegurado: p.cliente
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

  // ── PLANTILLA "RECIBO DE PAGO" DE SASINS (1 sep 2026, dictada por JC:
  //    "esta era la plantilla aprobada, solo agregale el filo de colores").
  //    Transcripción LITERAL de js/recibo-pago.js _correoReciboHtml + el
  //    envoltorio de js/gmail.js envolverCorreoHtml (variante headerLogo) de
  //    SASINS. Acá solo cambia la fontanería: el agente sale de CFG
  //    (multi-agente), los datos del comprobante que leyó la app, y las URLs
  //    de la guía y del cross-sell. El pie es el mismo _pieSDI que SASINS
  //    transcribió de este módulo el 31 ago. Los bloques cara-al-cliente NO se
  //    redactan de nuevo — se copian de la plantilla aprobada. ──

  var p = params || {};
  var saludo   = (p.nombrePila || p.cliente || '').trim();
  var recibos  = _renovRecibos(p);
  var varios   = recibos.length > 1;
  var esPlan   = varios;   // en SASINS, varios recibos = plan familiar (madre + hijas)
  var uno      = recibos[0] || {};
  var poliza   = (uno.poliza   || '').trim();
  var placa    = (uno.placa    || '').trim();
  var vehiculo = (uno.vehiculo || '').trim();
  var desde    = (uno.periodoDesde  || '').trim();
  var hasta    = (uno.periodoHasta  || '').trim();
  // Con varios recibos el período se muestra solo si es el MISMO en todos:
  // el del primero no puede presentarse como el de todo el plan.
  if (varios) {
    for (var pr = 1; pr < recibos.length; pr++) {
      if ((recibos[pr].periodoDesde || '').trim() !== desde || (recibos[pr].periodoHasta || '').trim() !== hasta) { desde = ''; hasta = ''; break; }
    }
  }
  var fPago    = (p.fechaPago     || '').trim();
  var nota     = (p.notaAdicional || '').trim();
  // Nombres de los PDF adjuntos (la app los conoce); SASINS los lista en la
  // línea "Adjunto:". Sin nombres, el texto genérico de la plantilla.
  var adjuntos = (Array.isArray(p.adjuntos) ? p.adjuntos : []).map(function (n) { return String(n == null ? '' : n).trim(); }).filter(Boolean);

  // Símbolo de moneda por recibo (como _sym de SASINS): la moneda que leyó la
  // app ('USD'/'CRC'); sin ella, el símbolo del texto del monto; si no, ₡.
  // Un comprobante en dólares NUNCA sale en colones (hallazgo de revisión).
  var _rpSym = function (moneda, texto) {
    if (moneda === 'USD') return '$';
    if (moneda === 'CRC') return '\u20A1';
    return /^\s*\$/.test(String(texto == null ? '' : texto)) ? '$' : '\u20A1';
  };
  // Monto como lo pinta SASINS (utils.fmt: es-CR, 2 decimales → "₡ 92 555,00").
  // Si la app no trae el número, se usa el texto tal cual venga.
  var _rpMonto = function (num, texto, moneda) {
    return (typeof num === 'number' && isFinite(num))
      ? _rpSym(moneda, texto) + ' ' + num.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(texto == null ? '' : texto).trim();
  };
  // Fecha como la pinta SASINS (utils.fmtDate: "07 sept 26") a partir del
  // dd/mm/aaaa que trae el comprobante. Si no es una fecha, se deja tal cual.
  var _rpFecha = function (s) {
    var t = String(s == null ? '' : s).trim();
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (!m) return t;
    try {
      return new Date(+m[3], +m[2] - 1, +m[1]).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch (err) { return t; }
  };

  // Total: la suma de los montos numéricos (formato SASINS). Si alguno no es
  // legible, el total ya formateado que manda la app; si tampoco, vacío.
  var montoTx;
  if (varios) {
    var suma = 0, sumable = true;
    var sym0 = _rpSym(uno.moneda, uno.montoTexto);
    for (var q = 0; q < recibos.length; q++) {
      var v = recibos[q].monto;
      if (typeof v !== 'number' || !isFinite(v)) { sumable = false; break; }
      // Monedas mezcladas no se suman: el total lo pone la app o queda vacío.
      if (_rpSym(recibos[q].moneda, recibos[q].montoTexto) !== sym0) { sumable = false; break; }
      suma += v;
    }
    montoTx = sumable ? _rpMonto(suma, '', uno.moneda || (sym0 === '$' ? 'USD' : 'CRC')) : (p.totalTexto || '').trim();
  } else {
    montoTx = _rpMonto(uno.monto, uno.montoTexto, uno.moneda);
  }

  // Datos del agente (perfil → CFG)
  var agente   = CFG.FROM_NAME  || 'Juan Carlos Hernandez Vargas';
  var lic      = CFG.LICENSE    || '08-1318';
  var tel      = CFG.PHONE      || '8822-1348';
  var correoAg = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  // website: valor CRUDO del perfil, SIN fallback al sitio del owner. Un agente
  // sin web propia no arrastra la de JC a su correo.
  var web      = String(CFG.WEBSITE == null ? '' : CFG.WEBSITE).replace(/^https?:\/\//i, '').trim();
  var logoUrl  = CFG.LOGO_URL   || 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png';

  // Escapado UNA vez: entra crudo a tres href (assistUrl / viajeUrl / estUrl).
  var siteFallback = web ? e('https://' + web) : '';
  // El botón de la guía lleva la URL LARGA a propósito: armar el correo no debe
  // depender de una llamada de red al acortador. El corto es cosa del WhatsApp.
  var assistUrl = e(_renovAsistenciaUrl()) || siteFallback || '#';
  var viajeUrl  = _safe(CFG.XSELL_VIAJE_URL) || siteFallback;
  var estUrl    = _safe(CFG.XSELL_ESTUDIANTIL_URL) || siteFallback;

  var fontBody = "'Inter','Helvetica Neue',Arial,sans-serif";

  var kv = function (k, val) {
    return '<tr><td style="padding:5px 0;color:#6c757d;font-size:12px">' + k + '</td>' +
      '<td style="padding:5px 0;text-align:right;font-size:12.5px;color:#1a1a1a;font-weight:600">' + val + '</td></tr>';
  };
  var mono = function (s) { return '<span style="font-family:Consolas,monospace">' + e(s) + '</span>'; };

  // Plan familiar: la tabla de desglose es la MISMA de los avisos de Cobros de
  // SASINS (plantillas.js buildHijasDesgloseHtml, transcrita), pedido JC 1 sep
  // 2026: "si es plan familiar debe ir la tabla igual que en cobros con el
  // detalle". Cambia solo la fontanería: los datos salen de recibos[] y el
  // vehículo (marca y modelo) va en una línea bajo la placa, con el mismo
  // estilo de la sublínea que esa tabla ya usa. Sin la frase de "al cancelar
  // este recibo" (esto es un pago aplicado, no un cobro) y sin emoji
  // (decisión JC 31 ago para el Recibo de pago).
  var desglose = '';
  if (esPlan) {
    var fmt2 = function (n) {
      return Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    var montoCelda = function (h) {
      return (typeof h.monto === 'number' && isFinite(h.monto))
        ? _rpSym(h.moneda, h.montoTexto) + '&nbsp;' + fmt2(h.monto)
        : e(String(h.montoTexto == null ? '' : h.montoTexto).trim() || '\u2014');
    };
    var filas = '';
    for (var i = 0; i < recibos.length; i++) {
      var h = recibos[i];
      var vehLinea = h.vehiculo
        ? '<div style="font-size:10px;color:#5f6b68;margin-top:2px;font-family:' + fontBody + ';">' + e(h.vehiculo) + '</div>'
        : '';
      filas += '\n' +
        '    <tr>\n' +
        '      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:\'Courier New\',monospace;font-size:11px;">' + e(h.poliza || '') + '</td>\n' +
        '      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">' + e(h.asegurado || '\u2014') + '</td>\n' +
        '      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:\'Courier New\',monospace;font-size:11px;">' + e(h.placa || '\u2014') + vehLinea + '</td>\n' +
        '      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:\'Courier New\',monospace;font-size:11px;">' + montoCelda(h) + '</td>\n' +
        '    </tr>';
    }
    var totalCelda = montoTx ? e(montoTx).replace(/^(\S+) /, '$1&nbsp;') : '\u2014';
    desglose = '\n' +
      '<div style="background:#f0f4ff;border:1px solid #c7d7f7;border-radius:8px;padding:14px 16px;margin:14px 0;">\n' +
      '  <div style="font-size:14px;font-weight:700;color:#1a3a5c;margin-bottom:10px;">\n' +
      '    Plan familiar &mdash; desglose de p&oacute;lizas\n' +
      '  </div>\n' +
      '  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;">\n' +
      '    <thead>\n' +
      '      <tr style="background:#1a3a5c;color:#fff;font-size:11px;text-align:left;">\n' +
      '        <th style="padding:7px 8px;">P&oacute;liza hija</th>\n' +
      '        <th style="padding:7px 8px;">Asegurado</th>\n' +
      '        <th style="padding:7px 8px;">Placa</th>\n' +
      '        <th style="padding:7px 8px;text-align:right;">Monto</th>\n' +
      '      </tr>\n' +
      '    </thead>\n' +
      '    <tbody>' + filas + '\n' +
      '      <tr style="background:#e6f2e6;font-weight:800;">\n' +
      '        <td colspan="3" style="padding:8px;font-size:12px;color:#1a3a5c;">\n' +
      '          TOTAL DEL PLAN (' + recibos.length + ' p&oacute;liza' + (recibos.length !== 1 ? 's' : '') + '):\n' +
      '        </td>\n' +
      '        <td style="padding:8px;text-align:right;font-family:\'Courier New\',monospace;color:#1a3a5c;font-size:13px;">\n' +
      '          ' + totalCelda + '\n' +
      '        </td>\n' +
      '      </tr>\n' +
      '    </tbody>\n' +
      '  </table>\n' +
      '</div>';
  }

  // Bloques "¿Qué hacer si ocurre un evento?" y "guía de emergencias".
  var pasoEvt = function (n, titulo, txt) {
    return '<tr><td width="26" valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;font-family:Consolas,monospace;font-size:11px;color:#c9a227;font-weight:600;">' + n + '</td>' +
      '<td valign="top" style="padding:10px 0;border-top:1px solid #edf1f6;">' +
      '<p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:#0c2340;">' + titulo + '</p>' +
      '<p style="margin:0;font-size:12.5px;color:#475569;line-height:1.55;">' + txt + '</p>' +
      '</td></tr>';
  };

  var cuerpo =
    '<p style="margin:0 0 12px">Estimado(a) <b>' + e(saludo) + '</b>:</p>\n' +
    '<p style="margin:0 0 14px">Le confirmo que su pago fue aplicado correctamente. Adjunto encontrar&aacute; el <b>comprobante oficial del INS</b>' + (esPlan ? ' con los recibos de su plan familiar' : '') + '.</p>\n' +
    '<div style="background:#e3f6ec;border:1px solid #b9e6cd;border-radius:10px;padding:14px 16px;margin:0 0 14px">\n' +
    '  <div style="font-size:16px;font-weight:800;color:#0d7a43">Pago aplicado' + (montoTx ? ' &mdash; ' + e(montoTx) : '') + '</div>\n' +
    '  <div style="font-size:12px;color:#0d7a43;margin-top:3px">' + (esPlan ? 'Plan familiar &middot; las ' + recibos.length + ' p&oacute;lizas quedaron al d&iacute;a.' : 'Su p&oacute;liza de autom&oacute;vil qued&oacute; al d&iacute;a.') + '</div>\n' +
    '</div>\n' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:10px;padding:0;margin:0 0 4px"><tr><td style="padding:12px 16px">\n' +
    '<table width="100%" cellpadding="0" cellspacing="0">\n' +
    (!esPlan && poliza ? kv('P&oacute;liza', mono(poliza)) + '\n' : '') +
    (!esPlan && vehiculo ? kv('Veh&iacute;culo', e(vehiculo)) + '\n' : '') +
    (desde && hasta ? kv('Per&iacute;odo pagado', e(_rpFecha(desde)) + ' &rarr; ' + e(_rpFecha(hasta))) + '\n' : '') +
    (fPago ? kv('Fecha de pago', e(_rpFecha(fPago))) + '\n' : '') +
    (!esPlan && placa ? kv('Placa', mono(placa)) + '\n' : '') +
    '</table></td></tr></table>\n' +
    desglose + '\n' +
    '<p style="margin:16px 0 12px;font-size:15px;font-weight:700;color:#0c2340;">&iquest;Qu&eacute; hacer si ocurre un evento?</p>\n' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
    pasoEvt('01', 'Primero, las personas', 'Si hay personas lesionadas, llame de inmediato al <b style="color:#0c2340;">911</b>.') + '\n' +
    pasoEvt('02', 'Reporte el accidente de una vez', 'Llame a Colisiones del INS al <b style="color:#0c2340;">800-800-8000</b> para que le env&iacute;en un inspector. Y muy importante: <b style="color:#0c2340;">nunca haga acuerdos con terceros</b> sin la autorizaci&oacute;n previa del INS &mdash; eso protege la validez de su cobertura.') + '\n' +
    pasoEvt('03', '&iquest;Aver&iacute;a en carretera?', 'Su asistencia 24/7 est&aacute; al <b style="color:#0c2340;">800-800-8001</b>: gr&uacute;a, cerrajer&iacute;a, cambio de llanta, paso de corriente y env&iacute;o de combustible. El alcance de su plan, seg&uacute;n la antig&uuml;edad de su veh&iacute;culo, est&aacute; en su gu&iacute;a.') + '\n' +
    '</table>\n' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;margin:16px 0">\n' +
    '  <tr><td style="padding:18px;text-align:center;">\n' +
    '    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0c4a6e;">Todo esto, paso a paso y a un clic</p>\n' +
    '    <p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.55;">Guarde su gu&iacute;a de emergencias: en el momento del evento le dice qu&eacute; hacer y le conecta con el contacto correcto al instante.</p>\n' +
    '    <a href="' + assistUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;font-weight:700;font-size:14px;">Abrir mi gu&iacute;a de emergencias &rarr;</a>\n' +
    '    <p style="margin:10px 0 0;font-size:11px;color:#64748b;line-height:1.5;">&Aacute;brala en el celular y elija <b>"A&ntilde;adir a pantalla de inicio"</b> para tenerla siempre a mano, como una App. Sin descargas.</p>\n' +
    '  </td></tr>\n' +
    '</table>\n' +
    '<h2 style="margin:16px 0 12px;font-size:13px;font-weight:700;color:#0c2340;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e0e7ef;padding-bottom:8px">Otros seguros que le pueden interesar</h2>\n' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 0 6px"><tr>\n' +
    '<td width="50%" valign="top" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px">\n' +
    '  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0c2340">Seguros de Viaje</p>\n' +
    '  <p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5">Proteja su pr&oacute;xima aventura dentro y fuera del pa&iacute;s.</p>\n' +
    (viajeUrl ? '  <a href="' + viajeUrl + '" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:13px">Comprar &rarr;</a>\n' : '') +
    '</td>\n' +
    '<td width="50%" valign="top" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px">\n' +
    '  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0c2340">Seguro Estudiantil</p>\n' +
    '  <p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.5">Asegure el futuro de sus hijos durante todo el a&ntilde;o lectivo.</p>\n' +
    (estUrl ? '  <a href="' + estUrl + '" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:13px">Comprar &rarr;</a>\n' : '') +
    '</td>\n' +
    '</tr></table>\n' +
    (nota ? '<div style="background:#f8f9fa;border-radius:10px;padding:12px 16px;margin:0 0 14px;font-size:12.5px;color:#1e293b;line-height:1.6"><span style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6c757d;text-transform:uppercase">Nota de su agente</span><br>' + e(nota).replace(/\n/g, '<br>') + '</div>\n' : '') +
    '<p style="margin:0 0 12px">Gracias por renovar su confianza. Cualquier duda, con gusto le atiendo.</p>\n' +
    '<p style="margin:0;font-size:12.5px"><b>' + e(agente) + '</b> &middot; Agente de Seguros del INS<br>\n' +
    '<span style="color:#6c757d">Licencia SUGESE ' + e(lic) + ' &middot; ' + e(tel) + '</span></p>\n' +
    '<p style="margin:12px 0 0;font-size:11px;color:#6c757d">Adjunto: ' + (adjuntos.length ? adjuntos.map(e).join(' &middot; ') : 'comprobante oficial del INS (PDF)') + '</p>';

  return '' +
'<!DOCTYPE html>' +
'<html lang="es"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Su renovación está confirmada &middot; Seguros del INS</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]-->' +
'</head>' +
// Envoltorio de SASINS (envolverCorreoHtml): fondo #f0f2f5, tarjeta de 580.
'<body style="margin:0;padding:0;background:#f0f2f5;font-family:' + fontBody + '">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0"><tr><td align="center">' +
'<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">' +

  // 1. HEADER (INS arriba: es la cara al cliente) — IGUAL al del correo
  //    "Recibo de pago" de SASINS: logo INS 36px, "Recibo de pago" 20px y
  //    "Renovación confirmada" 12px sobre #1a3a5c.
  '<tr><td bgcolor="#1a3a5c" style="background:#1a3a5c;padding:24px 32px 20px;text-align:center">' +
    '<img src="' + e(logoUrl) + '" alt="INS" height="36" style="height:36px;display:inline-block;margin-bottom:10px">' +
    '<div style="font-size:20px;font-weight:700;color:#fff">Recibo de pago</div>' +
    '<div style="font-size:12px;color:#a0c4e8;margin-top:2px">Renovaci&oacute;n confirmada</div>' +
  '</td></tr>' +
  // 1b. FILETE DE MARCA SDI bajo el header (pedido JC 1 sep 2026; bloque
  //     compartido de js/email-marca.js).
  _fileteSDI() +

  // 2. CUERPO — la celda única de SASINS (14px, línea 1.8) con la plantilla.
  '<tr><td style="padding:30px 32px">' +
    '<div style="font-size:14px;color:#1a1a1a;line-height:1.8">' + cuerpo + '</div>' +
  '</td></tr>' +

  // 3. PIE con la marca SDI (modulo compartido js/email-marca.js) — el mismo
  //    que SASINS transcribió para su Recibo de pago.
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
