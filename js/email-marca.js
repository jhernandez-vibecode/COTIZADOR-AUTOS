/**
 * Cotizador SDI · Bloques de marca de los correos
 *
 * Lo que los TRES correos (cotizacion, poliza activa, renovacion) comparten
 * de identidad: el filete, la chapa de la placa, el pie con el logotipo y los
 * bloques sin caja de color. Vive aparte para que la marca no derive en tres
 * copias distintas.
 *
 * Reglas del medio:
 *   - Solo tablas y estilos en linea. Nada de flex, grid ni degradados:
 *     Outlook no los dibuja.
 *   - Sin barras de color a la izquierda: es el tic de plantilla automatica.
 *   - El logotipo va como imagen porque su tipografia esta vectorizada en el
 *     kit, y en correo las fuentes web no cargan (Gmail las ignora).
 *
 * Se carga ANTES de email-template.js / poliza-email.js / renovacion-email.js.
 */

/** Escape propio: este archivo no depende de ningun otro. */
function _escMarca(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =====================================================================
 * BLOQUES DE MARCA DEL CORREO (25 ago 2026)
 * Todo con tablas y estilos en linea. Sin degradados (Outlook no los
 * dibuja) y sin barras de color a la izquierda (es el tic de plantilla
 * automatica que pidio quitar JC).
 * ===================================================================== */

/** Colores de la paleta SDI, en la proporcion 60/25/10/5 del manual. */
const SDI_COLORES = ['#0369A1', '#0D9488', '#EA580C', '#C9A227'];
const SDI_NAVY = '#0c2340';
const SDI_VERDE = '#047857';   // 5,48:1 con letra blanca; el #10b981 daba 2,54:1
const SDI_ROJO_CL = '#b91c1c'; // placa de carga liviana: 6,47:1 en los dos sentidos
const SDI_GRIS = '#64748b';
const SDI_LINEA = '#e6edf5';

/**
 * Filete de marca bajo el encabezado: cuatro celdas de color, 60/25/10/5.
 * No es un degradado a proposito — Outlook no los soporta.
 * @returns {string} fila <tr> lista para insertar
 */
function _fileteSDI() {
  const p = [60, 25, 10, 5];
  return '<tr><td style="padding:0;font-size:0;line-height:0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;table-layout:fixed;">' +
    '<tr>' + SDI_COLORES.map(function (c, i) {
      return '<td bgcolor="' + c + '" width="' + p[i] + '%" height="4" style="background:' + c +
             ';width:' + p[i] + '%;height:4px;line-height:4px;font-size:0;">&nbsp;</td>';
    }).join('') + '</tr></table></td></tr>';
}

/**
 * Analiza la placa para dibujarla como la matricula que es.
 * En Costa Rica el color dice de que es el vehiculo: las particulares van
 * en oscuro y las de carga liviana en rojo. Los demas tipos (motos, taxis,
 * las viejas de seis numeros) se muestran tal cual y en oscuro: no se les
 * inventa un color que no se sabe si corresponde.
 * @param {string} placa
 * @returns {{texto:string,color:string}}
 */
function _analizarPlaca(placa) {
  const p = String(placa || '').trim().toUpperCase().replace(/[\s-]/g, '');
  const cl = /^(CL)(\d{3,7})$/.exec(p);
  if (cl) return { texto: cl[1] + '&#8202;&#8202;' + cl[2], color: SDI_ROJO_CL };
  const par = /^([A-Z]{3})(\d{3})$/.exec(p);
  if (par) return { texto: par[1] + '&#8202;&#8202;' + par[2], color: SDI_NAVY };
  return { texto: _escMarca(p), color: SDI_NAVY };
}

/**
 * Un vehiculo cero kilometros todavia no tiene placa: el INS lo identifica
 * con "SIN" y los ultimos seis del chasis, que al cotizar aun no se conocen.
 * El agente teclea un relleno (000111) para poder seguir, y ese relleno NO
 * puede terminar impreso como si fuera la matricula del cliente.
 * @param {string} placa
 * @returns {boolean}
 */
function _placaEsRelleno(placa) {
  const p = String(placa || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!p) return true;
  if (/^0+$/.test(p)) return true;
  if (/^\d+$/.test(p) && new Set(p.split('')).size <= 2) return true;
  return false;
}

/** La chapa dibujada con tablas. */
function _chapaHtml(texto, arriba, color, fontFam) {
  if (!texto) return '';
  const c = color || SDI_NAVY;
  return '<td align="right" valign="middle" style="padding:0 0 0 14px;">' +
    '<table cellpadding="0" cellspacing="0" border="0" style="border:2px solid ' + c + ';border-radius:5px;background:#ffffff;">' +
      (arriba ? '<tr><td bgcolor="' + c + '" style="background:' + c + ';padding:2px 10px;text-align:center;">' +
        '<span style="font-family:' + fontFam + ';font-size:6.5px;font-weight:700;color:#ffffff;letter-spacing:0.18em;">' + arriba + '</span></td></tr>' : '') +
      '<tr><td style="padding:5px 12px 6px;text-align:center;white-space:nowrap;">' +
        '<span style="font-family:' + fontFam + ';font-size:19px;font-weight:700;color:' + c + ';letter-spacing:0.06em;white-space:nowrap;">' + texto + '</span></td></tr>' +
    '</table></td>';
}

/**
 * Tarjeta del vehiculo: el dato del cliente con su placa al lado.
 * @param {object} o - {vehiculo, plate, valor, fontFam}
 * @returns {string}
 */
function _tarjetaVehiculo(o) {
  const nuevo = _placaEsRelleno(o.plate);
  const info = _analizarPlaca(o.plate);
  const chapa = nuevo
    ? _chapaHtml('0&#8202;KM', 'NUEVO', SDI_NAVY, o.fontFam)
    : _chapaHtml(info.texto, 'COSTA RICA', info.color, o.fontFam);
  const nota = nuevo
    ? '<p style="margin:6px 0 0;font-size:11.5px;color:' + SDI_GRIS + ';line-height:1.45;">Todav&iacute;a sin placa: se asigna al inscribirlo. Mientras tanto la p&oacute;liza lo identifica por el n&uacute;mero de chasis.</p>'
    : '';
  return '        <tr><td style="padding:4px 32px 0;">\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">' +
    '<tr><td valign="middle" style="padding:16px 0;">' +
      '<p style="margin:0;font-size:10px;color:' + SDI_GRIS + ';letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Cotizaci&oacute;n para veh&iacute;culo</p>' +
      '<p style="margin:5px 0 0;font-family:' + o.fontFam + ';font-size:19px;font-weight:700;color:' + SDI_NAVY + ';line-height:1.2;">' + _escMarca(o.vehiculo || 'Tu veh\u00edculo') + '</p>' +
      (o.valor ? '<p style="margin:4px 0 0;font-size:12.5px;color:' + SDI_GRIS + ';">Valor asegurado <b style="color:#0c4a6e;">&#8353;' + _escMarca(o.valor) + '</b></p>' : '') +
      nota +
    '</td>' + chapa + '</tr></table>\n        </td></tr>';
}

/**
 * Bloque de texto sin caja ni barra: rotulo en versalitas sobre una regla
 * de 1 px. Reemplaza a las cajas de color que llevaban barra a la izquierda.
 */
function _bloqueSobrio(rotulo, texto, grande) {
  return '        <tr><td style="padding:20px 32px 0;">\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2e8f0;">' +
    '<tr><td style="padding:13px 0 0;">' +
      '<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:' + SDI_GRIS + ';letter-spacing:0.1em;text-transform:uppercase;">' + rotulo + '</p>' +
      '<p style="margin:0;font-size:' + (grande ? '15px' : '13px') + ';color:' + (grande ? SDI_NAVY : '#334155') + ';line-height:1.55;' +
        (grande ? 'font-weight:600;' : '') + '">' + texto + '</p>' +
    '</td></tr></table>\n        </td></tr>';
}

/**
 * Diferencia real entre pagar cuatro trimestres y pagar de una vez.
 * Devuelve '' si los numeros no se pueden leer: mejor sin la linea que con
 * un dato inventado.
 * @param {string} trimestral - precio ya formateado del PDF
 * @param {string} anual
 * @returns {string} monto formateado con separador de miles, o ''
 */
function _ahorroAnual(trimestral, anual) {
  const num = function (v) {
    const t = String(v == null ? '' : v).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = parseFloat(t);
    return isFinite(n) ? n : NaN;
  };
  const t = num(trimestral), a = num(anual);
  if (!isFinite(t) || !isFinite(a) || t <= 0 || a <= 0) return '';
  const dif = Math.round(t * 4 - a);
  if (dif <= 0) return '';
  // 'de-DE' y no 'es-CR': es-CR separa los miles con un espacio.
  return dif.toLocaleString('de-DE');
}

/**
 * Formas de pago en el orden natural (trimestral, semestral, anual) con el
 * anual SIEMPRE en verde y el sello del descuento por pronto pago. El sello
 * dice solo "10% Descuento"; que es por pronto pago se explica abajo, junto
 * con lo que el cliente se ahorra en el ano.
 * @param {object} o - {prices, fontFam}
 * @returns {string}
 */
function _bloquePagos(o) {
  const p = o.prices || {};
  const ff = o.fontFam;
  const suave = function (rotulo, monto, pie) {
    return '<td width="32%" align="center" valign="middle" style="background:#ffffff;border:1px solid #e0e7ef;border-radius:10px;padding:14px 8px;">' +
      '<p style="margin:0;font-size:10px;color:' + SDI_GRIS + ';text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">' + rotulo + '</p>' +
      '<p style="margin:6px 0 2px;font-family:' + ff + ';font-size:17px;font-weight:800;color:#0c4a6e;">&#8353;' + _escMarca(monto || '—') + '</p>' +
      '<p style="margin:0;font-size:10px;color:' + SDI_GRIS + ';">' + pie + '</p></td>';
  };
  const anual =
    '<td width="36%" align="center" valign="middle" bgcolor="' + SDI_VERDE + '" style="background:' + SDI_VERDE + ';border:1px solid ' + SDI_VERDE + ';border-radius:10px;padding:14px 8px;color:#ffffff;">' +
      '<p style="margin:0 0 5px;background:#fbbf24;color:#422006;font-size:11px;font-weight:800;padding:4px 11px;border-radius:999px;display:inline-block;letter-spacing:0.01em;">10% Descuento</p>' +
      '<p style="margin:0;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Anual</p>' +
      '<p style="margin:6px 0 2px;font-family:' + ff + ';font-size:20px;font-weight:800;color:#ffffff;">&#8353;' + _escMarca(p.anual || '—') + '</p>' +
      '<p style="margin:0;font-size:10px;color:#ffffff;">1 solo pago</p></td>';

  const ahorro = _ahorroAnual(p.trimestral, p.anual);
  const nota = ahorro
    ? '          <p style="margin:12px 0 0;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;font-size:11.5px;color:#065f46;line-height:1.55;">' +
      '<b>Ese 10% es el descuento por pronto pago.</b> Pagando de una vez, en el a&ntilde;o pon&eacute;s <b>&#8353;' + ahorro +
      ' menos</b> que pagando trimestral: el descuento m&aacute;s lo que te ahorr&aacute;s del recargo por fraccionamiento.</p>\n'
    : '          <p style="margin:12px 0 0;font-size:11.5px;color:' + SDI_GRIS + ';line-height:1.55;">Ese 10% es el descuento por pronto pago.</p>\n';

  return '        <tr><td style="padding:26px 32px 0;">\n' +
    '          <h2 style="margin:0 0 6px;font-family:' + ff + ';font-size:14px;font-weight:700;color:#0c4a6e;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #0369a1;padding-bottom:8px;">Tus 3 opciones de pago</h2>\n' +
    '          <p style="margin:10px 0 14px;font-size:12px;color:' + SDI_GRIS + ';">Las tres cubren exactamente lo mismo. Cambia cu&aacute;ntas veces pag&aacute;s.</p>\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>' +
      suave('Trimestral', p.trimestral, 'cada 3 meses') +
      suave('Semestral', p.semestral, 'cada 6 meses') +
      anual +
    '</tr></table>\n' + nota +
    '        </td></tr>';
}

/**
 * Pie con el logotipo OFICIAL de SDI y la nota legal completa.
 * El logotipo va como imagen y no recreado con tablas: su tipografia esta
 * vectorizada en el kit, y en correo las fuentes web no cargan (Gmail las
 * ignora), asi que cualquier version hecha con texto caeria a Arial y no
 * seria el logo. El alt cubre el caso de imagenes bloqueadas.
 * Grises: #94a3b8 da 6,16:1 sobre el navy. El #64748b que se usaba para la
 * licencia daba 3,32:1, y la licencia SUGESE es dato regulatorio.
 */
/** Ultimo recurso si CFG no trae la URL: un src vacio dejaria un hueco roto. */
const SDI_LOGO_POR_DEFECTO = 'https://cotizador.appsegurosdigitales.com/img/sdi-logo-email.png';

function _pieSDI(o) {
  const linea = function (t, top) {
    return '<p style="margin:' + top + 'px 0 0;font-size:10.5px;color:#94a3b8;line-height:1.6;">' + t + '</p>';
  };
  const logo = o.logo || SDI_LOGO_POR_DEFECTO;
  return '        <tr><td bgcolor="' + SDI_NAVY + '" style="background:' + SDI_NAVY + ';color:#cbd5e1;padding:30px 32px 26px;text-align:center;">\n' +
    '          <img src="' + _escMarca(logo) + '" alt="Seguros Digitales SDI" width="168" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:168px;height:auto;" />\n' +
    '          <p style="margin:18px 0 0;font-size:12px;">' +
      '<a href="mailto:' + _escMarca(o.correo) + '" style="color:#7dd3fc;text-decoration:none;font-weight:600;">' + _escMarca(o.correo) + '</a>' +
      (o.web ? ' &middot; <a href="https://' + _escMarca(o.web) + '" style="color:#7dd3fc;text-decoration:none;font-weight:600;">' + _escMarca(o.web) + '</a>' : '') +
    '</p>\n' +
    '          <p style="margin:6px 0 0;font-size:12px;color:#cbd5e1;">Tel: ' + _escMarca(o.tel) + '</p>\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>' +
      '<td style="border-top:1px solid #1e3a5f;height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table>\n' +
    '          ' + linea('&copy; Propiedad intelectual de ' + _escMarca(o.agente), 14) + '\n' +
    '          ' + linea('Seguros Digitales SDI &mdash; Todos los derechos reservados', 3) + '\n' +
    '          ' + linea('Agente exclusivo INS &middot; Licencia SUGESE ' + _escMarca(o.licencia), 3) + '\n' +
    '        </td></tr>';
}

// Export para los tests con Node (sin romper el navegador).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _fileteSDI: _fileteSDI, _analizarPlaca: _analizarPlaca, _placaEsRelleno: _placaEsRelleno,
    _tarjetaVehiculo: _tarjetaVehiculo, _bloqueSobrio: _bloqueSobrio, _pieSDI: _pieSDI,
    _ahorroAnual: _ahorroAnual, _bloquePagos: _bloquePagos,
    SDI_NAVY: SDI_NAVY, SDI_VERDE: SDI_VERDE, SDI_ROJO_CL: SDI_ROJO_CL, SDI_COLORES: SDI_COLORES
  };
}
