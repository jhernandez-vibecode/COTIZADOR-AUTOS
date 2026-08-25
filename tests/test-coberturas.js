/**
 * Test del detalle de coberturas: lo que se lee del PDF y como se pinta.
 *
 * Lo que vigila:
 *   1. Que el bloque se lea COMPLETO aunque cruce de la pagina 1 a la 2
 *      (la N y la IDD quedan del otro lado).
 *   2. Que se devuelva SOLO lo que trae el PDF. El juego cambia entre
 *      cotizaciones: si el correo mostrara una lista fija, a un cliente sin
 *      D ni H le prometeria colision y vuelco que no contrato.
 *   3. Que el titulo del bloque siguiente no se cuele en la ultima cobertura.
 *      Ojo: el formulario del INS lo trae con una errata, "Detalle de
 *      Deduciles", sin la b.
 *
 * Los datos son INVENTADOS con la estructura de un PDF real.
 *
 * Run: node tests/test-coberturas.js
 */

var P = require('../js/pdf-extract.js');
var M = require('../js/email-marca.js');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}

/** Convierte lineas de texto en filas con la forma que da _groupByY. */
function filas(lineas) {
  return lineas.map(function (t, i) {
    return { y: -i * 12, items: [{ x: 100, y: -i * 12, t: t, w: t.length * 5 }] };
  });
}

// ===== Estructura real de una cotizacion del INS =====
var P1 = filas([
  'INFORME DE ESTIMACION',
  'Nombre completo: PERSONA DE PRUEBA',
  'DETALLE DE COBERTURAS',
  'CÓDIGO DESCRIPCIÓN PRIMA',
  'A Responsabilidad Civil Extracontractual por 41,159.00',
  'Lesión y/o Muerte de Personas',
  'Monto por persona: 200,000,000.00',
  'Monto por accidente: 300,000,000.00',
  'B Servicios Médicos Familiares Básica 1,555.00',
  'Monto cubierto: 15,000,000.00',
  'C Responsabilidad Civil Extracontractual por 47,384.00',
  'Daños a la Propiedad de Terceros',
  'Monto asegurado: 100,000,000.00',
  'D Colisión y/o vuelco 201,236.00',
  'Monto asegurado: 10,000,000.00',
  'F Robo y/o Hurto 9,471.00',
  '¿Cuenta con dispositivo de seguridad?: No',
  'G Multiasistencia Automóvil 0.00',
  'H Riesgos Adicionales 3,856.00',
  'Monto asegurado: 10,000,000.00',
  'M Multiasistencia extendida 12,601.00'
]);
// El bloque CONTINUA en la pagina 2
var P2 = filas([
  'CÓDIGO DESCRIPCIÓN PRIMA',
  'N Exención deducible 14,213.00',
  'Coberturas',
  'C',
  'IDD Indemnización del deducible 29,423.00',
  'Monto cubierto: 400,000.00',
  'Detalle de Deduciles',
  'DESCRIPCIÓN',
  'Cobertura C: Deducible Ordinario del 20% - ¢150,000 o $250',
  'Cobertura D,F Y H: Deducible fijo - ¢400,000 o $670',
  'FORMA DE PAGO',
  'Trimestral 158,423.00'
]);

var cob = P._parseCoberturas(P1, P2);

console.log('\n-- se lee el bloque entero --');
ok('encuentra las diez coberturas', cob.length === 10);
ok('en el orden del PDF', cob.map(function (c) { return c.cod; }).join('-') === 'A-B-C-D-F-G-H-M-N-IDD');
ok('la N y la IDD, que estan en la pagina 2, no se pierden',
   cob.some(function (c) { return c.cod === 'N'; }) && cob.some(function (c) { return c.cod === 'IDD'; }));

console.log('\n-- no se cuela lo que no es --');
var idd = cob.filter(function (c) { return c.cod === 'IDD'; })[0];
ok('el titulo con errata "Detalle de Deduciles" no entra en la IDD',
   idd.desc.indexOf('Deduciles') === -1 && idd.desc.indexOf('Detalle') === -1);
ok('no se cuela la tabla de pagos',
   !cob.some(function (c) { return /FORMA DE PAGO|Trimestral/i.test(c.desc); }));
ok('no se cuelan los deducibles como cobertura',
   !cob.some(function (c) { return /Deducible Ordinario/i.test(c.desc); }));
ok('la pregunta del dispositivo no se toma por un monto',
   cob.filter(function (c) { return c.cod === 'F'; })[0].montos.length === 0);

console.log('\n-- los datos de cada cobertura --');
var A = cob[0];
ok('A: junta la descripcion cortada en dos lineas', A.desc.indexOf('Lesión') !== -1);
ok('A: guarda los dos montos', A.montos.length === 2);
ok('A: el monto por accidente', A.montos[1].valor === '300,000,000.00');
ok('A: la prima', A.prima === '41,159.00');
ok('D: monto asegurado del vehiculo',
   cob.filter(function (c) { return c.cod === 'D'; })[0].montos[0].valor === '10,000,000.00');

console.log('\n-- un PDF sin el bloque no revienta --');
ok('sin DETALLE DE COBERTURAS devuelve vacio',
   P._parseCoberturas(filas(['Nombre: X', 'FORMA DE PAGO']), filas([])).length === 0);
ok('con paginas vacias devuelve vacio', P._parseCoberturas([], []).length === 0);
ok('sin argumentos no lanza', P._parseCoberturas().length === 0);

// ===== Como se pinta =====
var DED = ['Cobertura C: Deducible Ordinario del 20% - ¢150,000 o $250',
           'Cobertura D,F Y H: Deducible fijo - ¢400,000 o $670'];

console.log('\n-- el deducible de cada cobertura --');
var mapa = M._deduciblePorCobertura(DED);
ok('C lleva el porcentaje y el minimo', mapa.C === 'deducible 20% · mín ₡150.000');
ok('D, F y H comparten el fijo',
   mapa.D === 'deducible ₡400.000' && mapa.F === mapa.D && mapa.H === mapa.D);
ok('A no tiene deducible', mapa.A === undefined);
ok('sin lineas no inventa nada', Object.keys(M._deduciblePorCobertura([])).length === 0);

console.log('\n-- las filas del correo --');
var f = M._filasCoberturas(cob, DED);
ok('G y M se muestran en una sola fila', f.some(function (x) { return x.cod === 'G · M'; }));
ok('N e IDD tambien', f.some(function (x) { return x.cod === 'N · IDD'; }));
ok('quedan ocho filas de las diez coberturas', f.length === 8);
ok('los nombres van en lenguaje llano',
   f.some(function (x) { return x.nombre === 'Lesiones a personas'; }) &&
   f.some(function (x) { return x.nombre === 'Colisión y vuelco'; }));
ok('el monto sale del PDF', f[0].monto === '₡300.000.000');
ok('el deducible aparece en su fila',
   f.some(function (x) { return x.nota === 'deducible 20% · mín ₡150.000'; }));
ok('primero el daño a terceros, despues el propio',
   f[0].grupo.indexOf('alguien más') !== -1 && f[f.length - 1].grupo.indexOf('incluidos') !== -1);

console.log('\n-- OTRO juego de coberturas: la plantilla no inventa --');
var reducida = cob.filter(function (c) { return ['A', 'C', 'G'].indexOf(c.cod) !== -1; });
var fr = M._filasCoberturas(reducida, [DED[0]]);
ok('solo tres filas', fr.length === 3);
ok('no aparece colision', !fr.some(function (x) { return x.nombre === 'Colisión y vuelco'; }));
ok('no aparece robo', !fr.some(function (x) { return x.nombre === 'Robo y hurto'; }));
ok('G sin su pareja M va sola', fr.some(function (x) { return x.cod === 'G'; }));

console.log('\n-- el bloque HTML --');
var html = M._bloqueCoberturas({ filas: f, notaDeducible: DED.join(' '), fontFam: 'Arial' });
ok('dice cuantas coberturas son', html.indexOf('Estas son las ocho coberturas') !== -1);
ok('lleva la nota de deducibles que se le pase', html.indexOf('Deducible fijo') !== -1);
ok('los chips llevan el color puro del manual',
   ['#0369A1', '#0D9488', '#EA580C', '#C9A227'].every(function (c) { return html.indexOf('background:' + c) !== -1; }));
ok('sin barra de color a la izquierda', (html.match(/border-left:\d+px solid/g) || []).length === 0);
ok('sin filas devuelve vacio, no un bloque hueco', M._bloqueCoberturas({ filas: [] }) === '');
ok('sin argumentos no lanza', M._bloqueCoberturas() === '');

// ===== La nota de deducibles, explicada (25 ago 2026) =====
console.log('\n-- la nota de deducibles --');
var conNIDD = M._notaDeducibles(DED, cob);
ok('reescribe el deducible con el simbolo y los miles del correo',
   conNIDD.indexOf('deducible ordinario del 20%') !== -1 && conNIDD.indexOf('&#8353;150.000') !== -1);
ok('quita la referencia en dolares', !/\$\d/.test(conNIDD));
ok('no deja el simbolo del PDF', conNIDD.indexOf('¢') === -1);
ok('explica lo que hace la N', conNIDD.indexOf('cobertura N') !== -1 && conNIDD.indexOf('se cubren al 100%') !== -1);
ok('explica lo que hace la IDD', conNIDD.indexOf('cobertura IDD') !== -1 && conNIDD.indexOf('dos eventos al a') !== -1);
// 150.000 / 0,20 = 750.000. NO es un numero fijo.
ok('calcula el corte a partir del minimo y el porcentaje', conNIDD.indexOf('750.000') !== -1);
ok('con otro minimo el corte cambia',
   M._notaDeducibles(['Cobertura C: Deducible Ordinario del 20% - ¢200,000 o $330'], cob).indexOf('1.000.000') !== -1);

// 🔴 Lo mas importante: sin la cobertura no se promete nada.
var sinNada = M._notaDeducibles(DED, [{ cod: 'A', desc: 'RC', montos: [] }]);
ok('SIN la N no dice que se cubre al 100%', sinNada.indexOf('100%') === -1);
ok('SIN la IDD no habla de dos eventos', sinNada.indexOf('dos eventos') === -1);
ok('SIN nada igual muestra el deducible', sinNada.indexOf('deducible ordinario del 20%') !== -1);
ok('sin lineas devuelve vacio', M._notaDeducibles([], cob) === '');
ok('sin argumentos no lanza', M._notaDeducibles() === '');

console.log('\ncoberturas (con la nota): ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) process.exit(1);
