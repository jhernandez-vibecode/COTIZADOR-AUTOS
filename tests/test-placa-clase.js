/**
 * Test de la CLASE DE PLACA que declara el INS (campo "Clase Placa" del PDF).
 *
 * El bug que cierra (9 set 2026, reportado por JC con la cotizacion
 * ASINS-170-142661): la chapa de carga liviana nunca salio roja. El detector
 * exigia que la placa viniera como "CL306735", pero el INS escribe el numero
 * PELADO en "Numero de placa" y pone la clase en un campo aparte:
 *
 *     Clase Placa: CL-CARGA LIVIANA
 *     Numero de placa: 306735
 *
 * Medido sobre 370 cotizaciones reales: el campo viene en el 100% de ellas y
 * toma tres valores — PART-PARTICULAR (282), SIN - PLACA TEMPORAL (48) y
 * CL-CARGA LIVIANA (40). Las 40 de carga liviana salian en navy.
 *
 * Por que NO se puede adivinar por el formato: entre esas 370 hay tres
 * particulares con placa numerica pura (654615, 845340, 742786), identicas en
 * forma a una carga liviana. Inferir por el formato les pintaria la chapa roja
 * a clientes particulares.
 *
 * Run: node tests/test-placa-clase.js
 */

var M = require('../js/email-marca.js');
var P = require('../js/pdf-extract.js');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}

// Los tres valores LITERALES del INS, tal como salen del PDF.
var CL   = 'CL-CARGA LIVIANA';
var PART = 'PART-PARTICULAR';
var TEMP = 'SIN - PLACA TEMPORAL';

// ===== 1. Leer la clase =====
console.log('\n-- se reconocen los tres valores del INS --');
ok('CL-CARGA LIVIANA es carga liviana', M._claseEsCL(CL) === true);
ok('PART-PARTICULAR NO es carga liviana', M._claseEsCL(PART) === false);
ok('SIN - PLACA TEMPORAL NO es carga liviana', M._claseEsCL(TEMP) === false);
ok('SIN - PLACA TEMPORAL es placa temporal', M._claseEsTemporal(TEMP) === true);
ok('PART-PARTICULAR NO es placa temporal', M._claseEsTemporal(PART) === false);
ok('CL-CARGA LIVIANA NO es placa temporal', M._claseEsTemporal(CL) === false);
ok('sin clase no se asume nada',
   M._claseEsCL('') === false && M._claseEsCL(null) === false &&
   M._claseEsTemporal('') === false && M._claseEsTemporal(undefined) === false);

// ===== 2. El bug de JC =====
console.log('\n-- el caso reportado: ASINS-170-142661 --');
var jc = M._analizarPlaca('306735', CL);
ok('la carga liviana va en ROJO', jc.color === M.SDI_ROJO_CL);
ok('la chapa antepone el CL que el INS omite', jc.texto.indexOf('CL') === 0);
ok('y conserva el numero completo', jc.texto.indexOf('306735') > 0);

// Sin el arreglo esto es lo que pasaba: el mismo numero, en navy.
ok('sin la clase, la misma placa cae en navy (comportamiento viejo)',
   M._analizarPlaca('306735').color === M.SDI_NAVY);

// ===== 3. Lo que NO debe cambiar =====
console.log('\n-- ninguna particular se pinta de rojo --');
['654615', '845340', '742786'].forEach(function (p) {
  var i = M._analizarPlaca(p, PART);
  ok('particular numerica ' + p + ': navy y sin prefijo inventado',
     i.color === M.SDI_NAVY && i.texto === p);
});
ok('particular con formato de letras sigue igual',
   M._analizarPlaca('BXY123', PART).color === M.SDI_NAVY);
ok('una CL escrita a mano por el agente sigue funcionando',
   M._analizarPlaca('CL284159').color === M.SDI_ROJO_CL &&
   M._analizarPlaca('CL284159', CL).color === M.SDI_ROJO_CL);
ok('una CL con formato raro va roja igual, sin inventarle prefijo',
   M._analizarPlaca('6VD702', CL).color === M.SDI_ROJO_CL &&
   M._analizarPlaca('6VD702', CL).texto === '6VD702');

// ===== 4. El cero kilometros =====
// El agente teclea un relleno para poder cotizar. La heuristica solo cazaba
// los que "parecen" relleno; con la clase, los caza todos. Estos tres son
// reales y la heuristica NO los detectaba: el cliente veia como su matricula
// un numero que el agente habia inventado.
console.log('\n-- cero kilometros: manda la clase, no la forma --');
['702145', '6VD702', '690309'].forEach(function (p) {
  ok('0 km con relleno ' + p + ': la clase lo declara sin placa',
     M._placaEsRelleno(p, TEMP) === true);
  ok('0 km con relleno ' + p + ': la heuristica sola NO lo veia',
     M._placaEsRelleno(p) === false);
});
ok('el relleno clasico sigue detectado con o sin clase',
   M._placaEsRelleno('000111') === true && M._placaEsRelleno('000111', TEMP) === true);
ok('una carga liviana NO es relleno', M._placaEsRelleno('306735', CL) === false);
ok('una particular NO es relleno', M._placaEsRelleno('654615', PART) === false);

// ===== 5. La tarjeta completa =====
console.log('\n-- la tarjeta del vehiculo --');
var FF = "'Space Grotesk',Helvetica,Arial,sans-serif";
var tCL = M._tarjetaVehiculo({ vehiculo: 'MITSUBISHI L200 2017', plate: '306735', plateClass: CL, valor: '14,000,000.00', fontFam: FF });
ok('la tarjeta de carga liviana lleva el rojo', tCL.indexOf(M.SDI_ROJO_CL) !== -1);
ok('la tarjeta de carga liviana NO usa el navy en la chapa', tCL.indexOf('border:2px solid ' + M.SDI_NAVY) === -1);
ok('la tarjeta de carga liviana muestra la placa', tCL.indexOf('306735') !== -1);
ok('sigue diciendo COSTA RICA', tCL.indexOf('COSTA RICA') !== -1);

var tPart = M._tarjetaVehiculo({ vehiculo: 'HONDA CIVIC', plate: '654615', plateClass: PART, valor: '9,000,000.00', fontFam: FF });
ok('la particular numerica NO lleva rojo', tPart.indexOf(M.SDI_ROJO_CL) === -1);

var t0 = M._tarjetaVehiculo({ vehiculo: 'TOYOTA RAV4', plate: '702145', plateClass: TEMP, valor: '20,000,000.00', fontFam: FF });
ok('el 0 km declarado por clase muestra 0 KM', t0.indexOf('KM') !== -1);
ok('y NUNCA imprime el relleno que tecleo el agente', t0.indexOf('702145') === -1);

// ===== 6. El parser lee el campo del PDF =====
console.log('\n-- el campo sale del PDF --');
// Filas con la forma que da _groupByY, con el texto literal del formulario.
function filas(lineas) {
  return lineas.map(function (t, i) {
    return { y: -i * 12, items: [{ x: 100, y: -i * 12, t: t, w: t.length * 5 }] };
  });
}
var RX = /Clase Placa:\s*(.+?)(?:\s+(?:N[uú]mero|Tipo|A[ñn]o)\b|$)/i;
function leerClase(lineas) {
  var f = filas(lineas);
  for (var i = 0; i < f.length; i++) {
    var t = f[i].items.map(function (x) { return x.t; }).join(' ').replace(/\s+/g, ' ').trim();
    var m = t.match(RX);
    if (m) return m[1].trim();
  }
  return '';
}
ok('lee CL-CARGA LIVIANA', leerClase(['Información del Vehículo', 'Clase Placa: CL-CARGA LIVIANA', 'Número de placa: 306735']) === CL);
ok('lee PART-PARTICULAR', leerClase(['Clase Placa: PART-PARTICULAR']) === PART);
ok('lee SIN - PLACA TEMPORAL', leerClase(['Clase Placa: SIN - PLACA TEMPORAL']) === TEMP);
ok('si los dos campos caen en la misma fila, corta antes del siguiente',
   leerClase(['Clase Placa: CL-CARGA LIVIANA Número de placa: 306735']) === CL);
ok('sin el campo devuelve vacio, no revienta', leerClase(['Nombre completo: X']) === '');
ok('el modulo declara plateClass entre sus campos',
   String(P.extractPDFData || '').indexOf('plateClass') !== -1 ||
   require('fs').readFileSync(__dirname + '/../js/pdf-extract.js', 'utf8').indexOf('plateClass:') !== -1);

// ===== 7. El circuito completo: PDF -> correo -> enlace de la guia =====
console.log('\n-- de punta a punta --');
global.CFG = {
  GUIDE_URL: 'https://ejemplo.test/explicacion/', FROM_NAME: 'Agente', LICENSE: '00-0000',
  WEBSITE: 'www.ejemplo.test', AGENDA_URL: 'https://ejemplo.test/cita', LOGO_URL: 'x',
  LOGO_SDI_URL: 'x', FROM_EMAIL: 'a@b.test', PHONE: '0000-0000'
};
var _fs = require('fs'), _path = require('path');
Object.keys(M).forEach(function (k) { global[k] = M[k]; });
eval(_fs.readFileSync(_path.join(__dirname, '..', 'js', 'email-template.js'), 'utf8'));

var BASE = { nombre: 'Natalia', vehiculo: 'MITSUBISHI L200 2017', valor: '14,000,000.00', prices: {}, sustRepos: '' };

var correoCL = buildEmail(Object.assign({ plate: '306735', plateClass: CL }, BASE));
ok('el correo de carga liviana lleva la chapa roja', correoCL.indexOf(M.SDI_ROJO_CL) !== -1);

var correoPart = buildEmail(Object.assign({ plate: '654615', plateClass: PART }, BASE));
ok('el correo de una particular numerica NO lleva rojo', correoPart.indexOf(M.SDI_ROJO_CL) === -1);

// El enlace de la guia: al cliente sin placa no se le manda un relleno.
function placaDelEnlace(html) {
  var m = /[?&]p=([^&"']*)/.exec(html);
  return m ? decodeURIComponent(m[1]) : null;
}
var correo0 = buildEmail(Object.assign({ plate: '702145', plateClass: TEMP }, BASE));
ok('la guia de un 0 km no recibe el relleno', !placaDelEnlace(correo0));
ok('el correo de un 0 km tampoco lo imprime', correo0.indexOf('702145') === -1);
ok('la guia de una carga liviana si recibe su placa', placaDelEnlace(correoCL) === '306735');

// Correos armados sin el dato (los ya enviados) no cambian de comportamiento.
var viejo = buildEmail(Object.assign({ plate: 'BXY123' }, BASE));
ok('sin plateClass el correo sigue armandose igual',
   viejo.indexOf(M.SDI_ROJO_CL) === -1 && placaDelEnlace(viejo) === 'BXY123');

console.log('\nplaca-clase: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) process.exit(1);
