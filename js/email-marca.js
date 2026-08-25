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

/* Paleta SDI PURA para los chips de cobertura, en la jerarquia del filete:
   azul lo que mas pesa, dorado la firma. El fondo es el color tal cual del
   manual; lo que cambia es la letra, porque no todos admiten la misma:
     azul + blanca 5,93:1    teal + oscura 4,95:1
     naranja + oscura 5,21:1  dorado + oscura 7,67:1
   (con letra blanca el dorado cae a 2,42:1 — ilegible). Medido, no a ojo. */
const SDI_TINTA = '#1a1204';
const SDI_TONOS = {
  azul:   { fondo: '#0369A1', texto: '#ffffff',  barra: '#0369A1' },
  teal:   { fondo: '#0D9488', texto: SDI_TINTA,  barra: '#0D9488' },
  narnja: { fondo: '#EA580C', texto: SDI_TINTA,  barra: '#EA580C' },
  dorado: { fondo: '#C9A227', texto: SDI_TINTA,  barra: '#C9A227' }
};

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
    // 120 px sobre un correo de 600: el pie firma, no compite con el contenido.
    '          <img src="' + _escMarca(logo) + '" alt="Seguros Digitales SDI" width="120" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:120px;height:auto;" />\n' +
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


/* =====================================================================
 * LISTA DE COBERTURAS DEL CORREO (25 ago 2026)
 * Se arma con lo que el parser saco del PDF y NADA MAS: el juego de
 * coberturas cambia de una cotizacion a otra (hay cotizaciones sin D ni
 * H, otras con K). Una lista fija le prometeria al cliente coberturas
 * que no contrato, firmadas con la licencia SUGESE del agente.
 * ===================================================================== */

/**
 * Como se le presenta cada cobertura al cliente. El codigo y el monto salen
 * del PDF; esto es solo el nombre en lenguaje llano y en que grupo va.
 * Los nombres oficiales estan verificados contra las Condiciones Generales
 * (docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md).
 */
var SDI_COBERTURAS = {
  A:   { nombre: 'Lesiones a personas',          grupo: 1, tono: 'azul',
         que: 'Si causás un accidente con lesiones o muerte de terceros.' },
  B:   { nombre: 'Servicios médicos familiares', grupo: 1, tono: 'azul',
         que: 'Atención tuya y de tu familia dentro del vehículo.' },
  C:   { nombre: 'Daños a propiedad ajena',      grupo: 1, tono: 'azul',
         que: 'Otro vehículo, un muro, un poste, una casa.' },
  D:   { nombre: 'Colisión y vuelco',            grupo: 2, tono: 'teal',
         que: 'Tu propio vehículo cuando chocás o volcás, vidrios incluidos.' },
  F:   { nombre: 'Robo y hurto',                 grupo: 2, tono: 'teal',
         que: 'Robo total o parcial, tentativa y uso indebido del vehículo.' },
  H:   { nombre: 'Riesgos adicionales',          grupo: 2, tono: 'teal',
         que: 'Inundación, terremoto, vandalismo, incendio, caída de objetos.' },
  G:   { nombre: 'Asistencia 24/7 en carretera', grupo: 3, tono: 'narnja', incluida: true,
         que: 'Grúa, cerrajero, paso de corriente, combustible y cambio de llanta.' },
  M:   { nombre: 'Asistencia extendida',         grupo: 3, tono: 'narnja', incluida: true,
         que: 'Cobertura ampliada de la asistencia en carretera.' },
  K:   { nombre: 'Transporte alternativo',       grupo: 3, tono: 'narnja',
         que: 'Mientras tu vehículo está en el taller.' },
  E:   { nombre: 'Gastos legales',               grupo: 3, tono: 'narnja',
         que: 'Reintegro de gastos legales por un evento cubierto.' },
  N:   { nombre: 'Exención del deducible',       grupo: 3, tono: 'dorado', incluida: true,
         que: 'No pagás el deducible en la cobertura que la lleva.' },
  IDD: { nombre: 'Respaldo del deducible',       grupo: 3, tono: 'dorado',
         que: 'El INS te reintegra el deducible en hasta 2 eventos al año.' }
};
var SDI_GRUPOS = {
  1: 'Si el daño se lo causás a alguien más',
  2: 'Si el daño es a tu vehículo',
  3: 'Servicios que ya vienen incluidos'
};
/** Pares que se muestran en una sola fila SI vienen los dos. */
var SDI_PARES = [['G', 'M'], ['N', 'IDD']];

/** "1,234,567.00" -> "1.234.567". Se usa de-DE: es-CR separa los miles con espacio. */
function _montoCR(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isFinite(n) ? Math.round(n).toLocaleString('de-DE') : '';
}

/**
 * De que deducible habla cada cobertura, segun las lineas que trae el PDF
 * ("Cobertura C: Deducible Ordinario del 20% - ¢150,000 o $250").
 * @param {string[]} deducibles - lineas crudas del PDF
 * @returns {object} { C: 'deducible 20% · mín ₡150.000', D: '...', ... }
 */
function _deduciblePorCobertura(deducibles) {
  var mapa = {};
  (deducibles || []).forEach(function (linea) {
    var m = /^Coberturas?\s+([A-Z][A-Z,\s.Yy]*?)\s*:\s*(.+)$/.exec(String(linea).trim());
    if (!m) return;
    var letras = m[1].toUpperCase().replace(/\s*Y\s*/g, ',').split(/[,\s.]+/).filter(Boolean);
    var resto = m[2];
    var pct = /(\d+)\s*%/.exec(resto);
    var mon = /[¢₡]\s*([\d,.]+)/.exec(resto);
    var texto;
    if (pct && mon) texto = 'deducible ' + pct[1] + '% · mín ₡' + _montoCR(mon[1]);
    else if (mon)   texto = 'deducible ₡' + _montoCR(mon[1]);
    else            texto = 'con deducible';
    letras.forEach(function (L) { if (/^[A-Z]+$/.test(L)) mapa[L] = texto; });
  });
  return mapa;
}

/**
 * Convierte lo que saco el parser en las filas que se pintan en el correo.
 * @param {Array} coberturas - de data.coberturas
 * @param {string[]} deducibles - de data.deductibles
 * @returns {Array} filas listas para _bloqueCoberturas
 */
function _filasCoberturas(coberturas, deducibles) {
  var ded = _deduciblePorCobertura(deducibles);
  var porCod = {};
  (coberturas || []).forEach(function (c) { porCod[c.cod] = c; });

  // los pares se funden en una sola fila si vienen los dos
  var fundido = {};
  SDI_PARES.forEach(function (par) {
    if (porCod[par[0]] && porCod[par[1]]) fundido[par[1]] = par[0];
  });

  var filas = [];
  (coberturas || []).forEach(function (c) {
    if (fundido[c.cod]) return;                       // ya se muestra con su pareja
    var info = SDI_COBERTURAS[c.cod];
    var cod = c.cod;
    SDI_PARES.forEach(function (par) {
      if (par[0] !== c.cod || !porCod[par[1]]) return;
      cod = par[0] + ' · ' + par[1];
      // En una fila fusionada manda la ficha del que trae el monto. Sin esto,
      // N + IDD decia "Incluida" y se perdia lo que de verdad le importa al
      // cliente: cuanto le reintegra el INS del deducible.
      var pareja = porCod[par[1]];
      if ((!c.montos || !c.montos.length) && pareja.montos && pareja.montos.length) {
        c = pareja;
        info = SDI_COBERTURAS[par[1]] || info;
      }
    });

    // El monto es el que traiga el PDF. Si hay varios (A trae "por persona" y
    // "por accidente") se muestra el ultimo, que es el techo del evento.
    var monto = '', nota = '';
    if (c.montos && c.montos.length) {
      var elegido = c.montos[c.montos.length - 1];
      monto = '₡' + _montoCR(elegido.valor);
      var et = elegido.etiqueta.toLowerCase().replace(/^monto\s+/i, '');
      if (et !== 'asegurado' && et !== 'cubierto') nota = et;
    } else if (info && info.incluida) {
      monto = 'Incluida';
    }
    // el deducible pisa la nota: es lo que mas le importa al cliente
    if (ded[c.cod]) nota = ded[c.cod];
    else if (info && info.incluida && !nota) nota = 'sin costo por evento';
    else if (!nota && (c.cod === 'A' || c.cod === 'B')) nota = 'sin deducible';

    filas.push({
      cod: cod,
      // sin ficha propia se usa la descripcion del PDF, nunca un invento
      nombre: (info && info.nombre) || c.desc || ('Cobertura ' + c.cod),
      que: (info && info.que) || '',
      grupoN: (info && info.grupo) || 3,
      grupo: SDI_GRUPOS[(info && info.grupo) || 3],
      tono: (info && info.tono) || 'azul',
      monto: monto,
      nota: nota,
      incluida: !!(info && info.incluida)
    });
  });

  // por grupo, conservando el orden del PDF dentro de cada uno
  return filas.map(function (f, i) { f._i = i; return f; })
    .sort(function (a, b) { return (a.grupoN - b.grupoN) || (a._i - b._i); });
}

/** Cuenta en palabras, para la bajada ("Estas son las ocho coberturas..."). */
function _enPalabras(n) {
  var p = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
           'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince'];
  return p[n] || String(n);
}

/**
 * El bloque de coberturas del correo.
 * @param {object} o - {filas, notaDeducible, fontFam}
 * @returns {string} '' si no hay filas — el correo entonces no lo muestra
 */
function _bloqueCoberturas(o) {
  var filas = (o && o.filas) || [];
  if (!filas.length) return '';
  var ff = o.fontFam;

  var chip = function (cod, tono) {
    var t = SDI_TONOS[tono] || SDI_TONOS.azul;
    return '<span style="display:inline-block;min-width:22px;padding:3px 7px;background:' + t.fondo +
      ';border-radius:5px;font-family:' + ff + ';font-size:10.5px;font-weight:700;color:' + t.texto +
      ';text-align:center;line-height:1.25;white-space:nowrap;">' + _escMarca(cod) + '</span>';
  };
  var subtitulo = function (texto, tono) {
    var c = (SDI_TONOS[tono] || SDI_TONOS.azul).barra;
    return '<tr><td colspan="3" style="padding:17px 0 7px;">' +
      '<table cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="16" style="padding-right:7px;"><table cellpadding="0" cellspacing="0" border="0" width="16">' +
      '<tr><td bgcolor="' + c + '" style="background:' + c + ';height:3px;line-height:3px;font-size:0;border-radius:2px;">&nbsp;</td></tr>' +
      '</table></td><td><p style="margin:0;font-size:10px;font-weight:700;color:' + SDI_GRIS +
      ';text-transform:uppercase;letter-spacing:0.09em;">' + _escMarca(texto) + '</p></td></tr></table></td></tr>';
  };

  var cuerpo = '', grupoAnterior = null, primera = true;
  filas.forEach(function (f) {
    if (f.grupo !== grupoAnterior) { cuerpo += subtitulo(f.grupo, f.tono); grupoAnterior = f.grupo; primera = true; }
    var borde = primera ? '' : 'border-top:1px solid ' + SDI_LINEA + ';';
    primera = false;
    cuerpo += '<tr>' +
      '<td width="58" valign="top" style="padding:11px 0;' + borde + '">' + chip(f.cod, f.tono) + '</td>' +
      '<td valign="top" style="padding:11px 10px 11px 0;' + borde + '">' +
        '<p style="margin:0;font-size:13px;font-weight:700;color:' + SDI_NAVY + ';line-height:1.35;">' + _escMarca(f.nombre) + '</p>' +
        (f.que ? '<p style="margin:3px 0 0;font-size:11.5px;color:' + SDI_GRIS + ';line-height:1.45;">' + _escMarca(f.que) + '</p>' : '') +
      '</td>' +
      '<td align="right" valign="top" style="padding:11px 0;' + borde + 'white-space:nowrap;">' +
        (f.monto ? '<p style="margin:0;font-size:13px;font-weight:700;color:' + (f.incluida ? SDI_VERDE : SDI_NAVY) + ';line-height:1.35;">' + _escMarca(f.monto) + '</p>' : '') +
        (f.nota ? '<p style="margin:3px 0 0;font-size:10.5px;color:' + SDI_GRIS + ';line-height:1.4;">' + _escMarca(f.nota) + '</p>' : '') +
      '</td></tr>';
  });

  return '        <tr><td style="padding:26px 32px 0;">\n' +
    '          <h2 style="margin:0 0 6px;font-family:' + ff + ';font-size:14px;font-weight:700;color:#0c4a6e;' +
      'text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #0369a1;padding-bottom:8px;">Lo que cubre esta cotizaci&oacute;n</h2>\n' +
    '          <p style="margin:10px 0 2px;font-size:12px;color:' + SDI_GRIS + ';line-height:1.5;">Estas son las ' +
      _enPalabras(filas.length) + ' coberturas que trae tu cotizaci&oacute;n, con el monto de cada una.</p>\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' + cuerpo + '</table>\n' +
    (o.notaDeducible
      ? '          <p style="margin:14px 0 0;padding:10px 12px;background:#f8fafc;border:1px solid ' + SDI_LINEA +
        ';border-radius:6px;font-size:11px;color:' + SDI_GRIS + ';line-height:1.55;"><b style="color:' + SDI_NAVY +
        ';">Deducibles de esta cotizaci&oacute;n:</b> ' + _escMarca(o.notaDeducible) + '</p>\n'
      : '') +
    '        </td></tr>';
}


/**
 * La nota de deducibles, explicada.
 *
 * Antes se copiaba la linea del PDF tal cual. Ahora se explica lo que esa
 * linea significa PARA ESTE CLIENTE, que es lo que de verdad quiere saber:
 * cuando paga y cuando no.
 *
 * 🔴 La explicacion es CONDICIONAL. La parte de "se cubre al 100%" solo se
 * escribe si la cotizacion trae la cobertura que lo hace posible (N para la
 * exencion, IDD para el reintegro). Si no la trae, se queda solo el deducible
 * pelado: decirle a alguien que tiene una cobertura que no contrato seria
 * prometerle algo que la poliza no respalda.
 *
 * 🔴 El corte de ₡750.000 NO es un numero fijo: es el minimo dividido por el
 * porcentaje (150.000 / 0,20). Es el punto donde el 20% del dano supera al
 * minimo. Si el INS cambia los montos, se recalcula solo.
 *
 * Se quitan las referencias en dolares ("o $250"): el cliente paga en colones.
 *
 * @param {string[]} deducibles - lineas crudas del PDF
 * @param {Array} coberturas - las de _parseCoberturas, para saber si hay N/IDD
 * @returns {string} '' si no hay nada que explicar
 */
function _notaDeducibles(deducibles, coberturas) {
  var cods = {};
  (coberturas || []).forEach(function (c) { cods[c.cod] = c; });

  // ¿Sobre que cobertura aplica la exencion N? El PDF lo dice en su
  // descripcion ("Exencion deducible Coberturas C").
  var exentas = {};
  if (cods.N) {
    var m = /Coberturas?\s+([A-Z][A-Z,\s.Yy]*)$/.exec(cods.N.desc || '');
    var letras = m ? m[1] : 'C';
    letras.toUpperCase().replace(/\s*Y\s*/g, ',').split(/[,\s.]+/).forEach(function (L) {
      if (/^[A-Z]$/.test(L)) exentas[L] = true;
    });
  }
  // El monto que reintegra la IDD, si viene
  var montoIDD = '';
  if (cods.IDD && cods.IDD.montos && cods.IDD.montos.length) {
    montoIDD = _montoCR(cods.IDD.montos[cods.IDD.montos.length - 1].valor);
  }

  var partes = [];
  (deducibles || []).forEach(function (linea) {
    var t = String(linea).trim();
    var m = /^Coberturas?\s+([A-Z][A-Z,\s.Yy]*?)\s*:\s*(.+)$/.exec(t);
    if (!m) return;

    var letras = m[1].toUpperCase().replace(/\s*Y\s*/g, ',').split(/[,\s.]+/).filter(function (L) {
      return /^[A-Z]$/.test(L);
    });
    var resto = m[2].replace(/\s*o\s*\$[\d,.]+/gi, '').trim();   // fuera los dolares

    var pct = /(\d+)\s*%/.exec(resto);
    var mon = /[¢₡]\s*([\d,.]+)/.exec(resto);
    // el PDF trae el monto en formato US ("150,000"); se quitan separadores
    var minimo = mon ? parseFloat(String(mon[1]).replace(/[.,]/g, '')) : NaN;

    var etiqueta = 'Cobertura' + (letras.length > 1 ? 's' : '') + ' ' +
      (letras.length > 1 ? letras.slice(0, -1).join(', ') + ' y ' + letras[letras.length - 1] : letras[0]);

    // Se reescribe en vez de copiar el crudo del PDF: asi el simbolo y los
    // miles quedan iguales en toda la nota (el PDF usa "¢150,000" y el resto
    // del correo "₡150.000"). Los DATOS no se tocan: el tipo de deducible
    // ("Ordinario", "fijo") y los numeros son los del documento.
    var tipo = /Deducible\s+([A-Za-zÁ-úá-ú]+)/i.exec(resto);
    var tipoTxt = tipo ? tipo[1].toLowerCase() : '';
    var cuerpo;
    if (pct && isFinite(minimo)) {
      cuerpo = 'deducible ' + (tipoTxt ? tipoTxt + ' ' : '') + 'del ' + pct[1] +
               '%, m&iacute;nimo &#8353;' + minimo.toLocaleString('de-DE');
    } else if (isFinite(minimo)) {
      cuerpo = 'deducible ' + (tipoTxt ? tipoTxt + ' ' : '') + 'de &#8353;' + minimo.toLocaleString('de-DE');
    } else {
      cuerpo = resto;   // formato inesperado: se muestra tal cual, sin inventar
    }
    var texto = etiqueta + ': ' + cuerpo + '.';

    // ¿Alguna de estas coberturas esta exenta por la N?
    var hayExenta = letras.some(function (L) { return exentas[L]; });
    if (hayExenta && pct && isFinite(minimo) && minimo > 0) {
      var corte = Math.round(minimo / (parseFloat(pct[1]) / 100));
      texto += ' Como ten&eacute;s la cobertura N, los da&ntilde;os mayores a &#8353;' + corte.toLocaleString('de-DE') +
        ' se cubren al 100%; si el da&ntilde;o es menor, aplica el deducible de &#8353;' + minimo.toLocaleString('de-DE') + '.';
    }
    // ¿La IDD respalda estas coberturas? (la IDD aplica al deducible fijo)
    if (cods.IDD && !hayExenta) {
      texto += ' Como ten&eacute;s la cobertura IDD, se cubre al 100% en dos eventos al a&ntilde;o' +
        (montoIDD ? ', hasta &#8353;' + montoIDD : '') + '.';
    }
    partes.push(texto);
  });

  return partes.join(' ');
}

// Export para los tests con Node (sin romper el navegador).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _fileteSDI: _fileteSDI, _analizarPlaca: _analizarPlaca, _placaEsRelleno: _placaEsRelleno,
    _tarjetaVehiculo: _tarjetaVehiculo, _bloqueSobrio: _bloqueSobrio, _pieSDI: _pieSDI,
    _ahorroAnual: _ahorroAnual, _bloquePagos: _bloquePagos,
    _bloqueCoberturas: _bloqueCoberturas, _filasCoberturas: _filasCoberturas, _notaDeducibles: _notaDeducibles,
    _deduciblePorCobertura: _deduciblePorCobertura, _montoCR: _montoCR, _enPalabras: _enPalabras,
    SDI_TONOS: SDI_TONOS, SDI_COBERTURAS: SDI_COBERTURAS,
    SDI_NAVY: SDI_NAVY, SDI_VERDE: SDI_VERDE, SDI_ROJO_CL: SDI_ROJO_CL, SDI_COLORES: SDI_COLORES
  };
}
