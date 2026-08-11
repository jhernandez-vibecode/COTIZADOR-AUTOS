/**
 * Tests de js/renovacion-extract.js — Comprobante de Pago del INS (renovación).
 * Correr: node tests/test-renovacion-extract.js
 *
 * Las fixtures reproducen la ESTRUCTURA exacta del formulario INS-F-1011060 tal
 * como lo entrega PDF.js (items de texto unidos por espacio), verificada el
 * 10 ago 2026 contra 2 comprobantes reales. Los nombres, cédulas, números de
 * póliza y placas son INVENTADOS a propósito: los comprobantes reales traen
 * datos de clientes y no entran al repo.
 */
var R = require('../js/renovacion-extract.js');

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }
function eq(name, a, b) { if (a === b) { pass++; } else { fail++; console.error('FAIL ' + name + ' → esperaba ' + JSON.stringify(b) + ', vino ' + JSON.stringify(a)); } }

var CAB = 'INSTITUTO NACIONAL DE SEGUROS San José, Calle 9 y Avenida 7 | Frente al parque España ' +
          'Teléfonos: 2287-6000 800-TELEINS | Cédula Jurídica: 4-000001902-22 ';
var PIE = ' Para efectos tributarios se estará remitiendo la factura electrónica. ' +
          'INS-F-1011060 100.000 10/12 CD-011124 G5/rsr';
var COLS = 'DETALLE Número de Póliza Línea Vigencia Monto (incluye IVA) Fecha Limite Desde Hasta de Pago (Colones o Dólares) ';

/** Arma un comprobante sintético con la estructura del formulario real. */
function comprobante(o) {
  o = o || {};
  var estado = o.estado === undefined ? 'Estado: Pagado ' : (o.estado ? 'Estado: ' + o.estado + ' ' : '');
  return CAB +
    'Comprobante de Pago Nº ' + (o.num || 'R202608108000001') + ' ' +
    'Nombre del asegurado: ' + (o.nombre || 'RAMIREZ SOTO CARLOS ANDRES') + ' ' +
    'Tipo identificación: Cédula Física Nacional ' + estado +
    'Número de identificación 100000000 Moneda: ' + (o.moneda || 'Colones') + ' ' +
    'Nombre del pagador: Número de identificación del pagador: ' +
    'Fecha de aviso 10/08/2026 Fecha de Pago: ' + (o.fpago || '10/08/2026') + ' ' + COLS +
    (o.poliza || '0101AUT100000001') + ' Seguros Automotores - ' +
    (o.desde || '30/08/2026') + ' ' + (o.hasta || '30/11/2026') + ' ' + (o.limite || '11/09/2026') + ' ' +
    (o.simbolo || '₡') + (o.monto || '92,555.00') + ' ' +
    '(' + (o.placa || '00000BXY123') + ') Renovación Rel. Pago W03 12000001 ' +
    '110113 - Oficina Central - HERNANDEZ VARGAS JUAN CARLOS ' +
    'TOTAL A PAGAR: ' + (o.simbolo || '₡') + (o.montoTotal || o.monto || '92,555.00') + PIE;
}

// ---------- Muestra A: trimestre en colones (estructura del comprobante real) ----------
var a = R.extractAll(comprobante());
eq('A.numComprobante', a.numComprobante, 'R202608108000001');
eq('A.cliente',        a.cliente,        'Ramirez Soto Carlos Andres');
eq('A.nombrePila',     a.nombrePila,     'Carlos Andres');   // tokens tras los 2 apellidos
eq('A.estado',         a.estado,         'Pagado');
eq('A.poliza',         a.poliza,         '0101AUT100000001');
eq('A.placa',          a.placa,          'BXY123');          // relleno "00000" descartado
eq('A.placaIncierta',  a.placaIncierta,  false);
eq('A.periodoDesde',   a.periodoDesde,   '30/08/2026');
eq('A.periodoHasta',   a.periodoHasta,   '30/11/2026');      // NO la fecha límite
eq('A.fechaPago',      a.fechaPago,      '10/08/2026');
eq('A.monto',          a.monto,          92555);
eq('A.montoTexto',     a.montoTexto,     '₡92.555');         // es-CR con puntos, no espacios
eq('A.moneda',         a.moneda,         'CRC');
ok('A.esComprobante',  a.esComprobante === true);
ok('A.pagado',         R.estaPagado(a.estado) === true);
eq('A.polizas',        a.polizasEncontradas, 1);

// ---------- Muestra B: semestre, placa con relleno de LETRAS ----------
// El campo es de ancho fijo y el relleno no siempre son ceros: en las muestras
// reales apareció "(PQR00ZWT456)". La placa es el sufijo AAA999.
var b = R.extractAll(comprobante({
  num: 'R202608108000002', nombre: 'MORA VEGA LUCIA', poliza: '0101AUT200000002',
  placa: 'PQR00ZWT456', desde: '27/08/2026', hasta: '27/02/2027', limite: '10/09/2026',
  monto: '229,700.00'
}));
eq('B.placa',        b.placa,        'ZWT456');
eq('B.nombrePila',   b.nombrePila,   'Lucia');
eq('B.periodoHasta', b.periodoHasta, '27/02/2027');
eq('B.monto',        b.monto,        229700);
eq('B.montoTexto',   b.montoTexto,   '₡229.700');

// ---------- Guard D7: estado distinto de "Pagado" ----------
var pend = R.extractAll(comprobante({ estado: 'Pendiente' }));
eq('pendiente.estado', pend.estado, 'Pendiente');
ok('pendiente-NO-pagado', R.estaPagado(pend.estado) === false);

var sinEstado = R.extractAll(comprobante({ estado: '' }));
eq('sin-estado', sinEstado.estado, '');
ok('sin-estado-NO-pagado', R.estaPagado(sinEstado.estado) === false);
ok('sin-estado-igual-lee-poliza', sinEstado.poliza === '0101AUT100000001');  // el parser no se cae

ok('pagado-tolera-mayusculas', R.estaPagado('PAGADO') === true);
ok('pagado-tolera-espacios',   R.estaPagado('  Pagado ') === true);
ok('pagado-NO-anulado',        R.estaPagado('Anulado') === false);
ok('pagado-NO-vacio',          R.estaPagado('') === false);
ok('pagado-NO-null',           R.estaPagado(null) === false);

// ---------- Placa en formato no reconocido: se entrega cruda y marcada ----------
// Placas numéricas viejas, CL, motos… El parser NO inventa un recorte: deja el
// valor crudo y avisa para que el agente lo corrija a mano.
var raro = R.extractAll(comprobante({ placa: '0000CL612977' }));
eq('placa-rara-cruda',    raro.placa, '0000CL612977');
ok('placa-rara-marcada',  raro.placaIncierta === true);

// ---------- Dólares ----------
var usd = R.extractAll(comprobante({ moneda: 'Dólares', simbolo: '$', monto: '1,250.00' }));
eq('usd.moneda',     usd.moneda, 'USD');
eq('usd.monto',      usd.monto, 1250);
eq('usd.montoTexto', usd.montoTexto, '$1.250');

// ---------- Comprobante con 2 pólizas: todo sale de la MISMA línea ----------
// El "TOTAL A PAGAR" es la SUMA de las dos lineas; usarlo aqui pondria en el
// correo un monto que no corresponde a la poliza que se le nombra al cliente.
var dosLineas = CAB +
  'Comprobante de Pago Nº R202608108000003 Nombre del asegurado: MORA VEGA LUCIA ' +
  'Tipo identificación: Cédula Física Nacional Estado: Pagado ' +
  'Número de identificación 100000000 Moneda: Colones ' +
  'Fecha de aviso 10/08/2026 Fecha de Pago: 10/08/2026 ' + COLS +
  '0101AUT100000001 Seguros Automotores - 30/08/2026 30/11/2026 11/09/2026 ₡92,555.00 (00000BXY123) Renovación ' +
  '0101AUT300000003 Seguros Automotores - 01/09/2026 01/12/2026 12/09/2026 ₡50,000.00 (00000DEF456) Renovación ' +
  'TOTAL A PAGAR: ₡142,555.00' + PIE;
var dos = R.extractAll(dosLineas);
eq('dos-polizas-cuenta',  dos.polizasEncontradas, 2);
eq('dos-polizas-poliza',  dos.poliza, '0101AUT100000001');   // la primera linea
eq('dos-polizas-placa',   dos.placa,  'BXY123');             // placa de ESA linea, no de la otra
eq('dos-polizas-monto',   dos.monto,  92555);                // NO el total 142.555
eq('dos-polizas-desde',   dos.periodoDesde, '30/08/2026');
eq('dos-polizas-hasta',   dos.periodoHasta, '30/11/2026');

// Con UNA sola poliza el monto sigue saliendo de "TOTAL A PAGAR" (el dato mas
// confiable del formulario).
eq('una-poliza-usa-total', R.extractAll(comprobante({ monto: '92,555.00', montoTotal: '92,555.00' })).monto, 92555);

// La placa NO se busca en todo el documento: si la linea elegida trae una placa
// en formato raro, se devuelve ESA marcada como incierta, sin saltar a la de la
// linea siguiente.
var placaRaraPrimera = CAB +
  'Comprobante de Pago Nº R202608108000004 Nombre del asegurado: MORA VEGA LUCIA ' +
  'Tipo identificación: Cédula Física Nacional Estado: Pagado Moneda: Colones ' +
  'Fecha de Pago: 10/08/2026 ' + COLS +
  '0101AUT100000001 Seguros Automotores - 30/08/2026 30/11/2026 11/09/2026 ₡92,555.00 (0000CL612977) Renovación ' +
  '0101AUT300000003 Seguros Automotores - 01/09/2026 01/12/2026 12/09/2026 ₡50,000.00 (00000DEF456) Renovación ' +
  'TOTAL A PAGAR: ₡142,555.00' + PIE;
var prp = R.extractAll(placaRaraPrimera);
eq('placa-no-salta-de-linea', prp.placa, '0000CL612977');
ok('placa-no-salta-marcada',  prp.placaIncierta === true);

// bloqueDetalle: recorta desde la poliza hasta la siguiente / TOTAL A PAGAR
var bloque = R.bloqueDetalle(dosLineas);
ok('bloque-empieza-en-poliza', bloque.indexOf('0101AUT100000001') === 0);
ok('bloque-no-trae-la-otra',   bloque.indexOf('0101AUT300000003') === -1);
ok('bloque-no-trae-total',     bloque.indexOf('TOTAL A PAGAR') === -1);

// ---------- No es un comprobante de pago ----------
var otro = R.extractAll('CONDICIONES PARTICULARES Seguro Voluntario de Automóviles Póliza: 0101AUT999999999');
ok('otro-doc-no-es-comprobante', otro.esComprobante === false);

// ---------- parseMonto: formatos ----------
eq('parse-us',        R.parseMonto('92,555.00'), 92555);
eq('parse-eu',        R.parseMonto('92.555,00'), 92555);
eq('parse-sin-dec',   R.parseMonto('1,250'),     1250);
eq('parse-simple',    R.parseMonto('570891'),    570891);
eq('parse-con-simbolo', R.parseMonto('₡92,555.00'), 92555);
eq('parse-decimales', R.parseMonto('1,234.56'),  1234.56);
ok('parse-vacio-NaN', isNaN(R.parseMonto('')));

// ---------- fmtMonto: separador de miles con PUNTO (es-CR usa espacio) ----------
eq('fmt-crc',        R.fmtMonto(92555, 'CRC'),    '₡92.555');
eq('fmt-usd',        R.fmtMonto(1250, 'USD'),     '$1.250');
eq('fmt-decimales',  R.fmtMonto(1234.56, 'CRC'),  '₡1.234,56');
eq('fmt-millon',     R.fmtMonto(1570891, 'CRC'),  '₡1.570.891');
ok('fmt-NaN-vacio',  R.fmtMonto(NaN, 'CRC') === '');
ok('fmt-sin-espacios', R.fmtMonto(92555, 'CRC').indexOf(' ') === -1);

console.log('\nrenovacion-extract: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
