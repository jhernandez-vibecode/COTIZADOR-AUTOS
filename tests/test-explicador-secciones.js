/**
 * Test del explicador: los pasos 3 (deducible) y 4 (repuestos) solo le
 * aplican a la cotizacion que trae cobertura al PROPIO vehiculo (D, F o H),
 * y el paso 2 (asistencia) solo si trae Multiasistencia (G o M).
 *
 * Lo que vigila:
 *   1. La logica pura del bloque [GUIA-CB-PURO] de explicacion/index.html
 *      (se extrae por los marcadores y se evalua en Node, sin navegador).
 *   2. Que sin el parametro `cb` NO se toque nada: los enlaces ya enviados
 *      tienen que seguir viendo la guia de 5 pasos de siempre.
 *   3. Que el correo y la guia sigan diciendo LO MISMO: lo que buildEmail
 *      pone en el enlace (`cb`) alimenta directo la decision de la guia.
 *
 * Los datos son INVENTADOS con la estructura de un PDF real.
 *
 * Run: node tests/test-explicador-secciones.js
 */

var fs = require('fs'), path = require('path');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}

var html = fs.readFileSync(path.join(__dirname, '..', 'explicacion', 'index.html'), 'utf8');

// ===== extraer y evaluar el bloque puro =====
console.log('-- el bloque puro se extrae y evalua --');
var ini = html.indexOf('function _parseCbMapa');
var fin = html.indexOf('// ===== [/GUIA-CB-PURO]');
ok('el bloque [GUIA-CB-PURO] existe y esta delimitado', ini !== -1 && fin !== -1 && fin > ini);
eval(html.slice(ini, fin));
ok('las dos funciones quedaron definidas',
   typeof _parseCbMapa === 'function' && typeof _seccionesQueAplican === 'function');

// ===== _parseCbMapa =====
console.log('\n-- el parser del parametro cb --');
var m = _parseCbMapa('A-300000000.B-15000000.C.G.M');
ok('parsea codigos y montos', m && m.A === 300000000 && m.B === 15000000);
ok('cobertura sin monto queda en null', m && ('C' in m) && m.C === null);
ok('sin parametro devuelve null (no tocar la guia)',
   _parseCbMapa(null) === null && _parseCbMapa('') === null && _parseCbMapa(undefined) === null);
ok('un parametro ilegible devuelve null, no un mapa vacio',
   _parseCbMapa('123.-.--') === null && _parseCbMapa('...') === null);
ok('minusculas se normalizan', _parseCbMapa('d-5.idd').D === 5);
ok('IDD viaja como codigo de varias letras', 'IDD' in _parseCbMapa('A.IDD'));

// ===== _seccionesQueAplican =====
console.log('\n-- que pasos le aplican a la cotizacion --');
ok('sin dato: null, y la guia no se toca', _seccionesQueAplican(null) === null);

var completo = _seccionesQueAplican(_parseCbMapa('A-1.B-2.C.D-18000000.F.H-18000000.G.M.N.IDD'));
ok('paquete completo: los cuatro pasos aplican',
   completo.asistencia && completo.deducible && completo.deducibleDif && completo.repuestos);

// El caso de JC: cotizacion SIN colision, SIN robo y SIN riesgos adicionales
var sinPropio = _seccionesQueAplican(_parseCbMapa('A-300000000.B-15000000.C.G.M.N'));
ok('sin D, F ni H: ni deducible ni repuestos',
   !sinPropio.deducible && !sinPropio.deducibleDif && !sinPropio.repuestos);
ok('...pero con G y M la asistencia si', sinPropio.asistencia);

// El caso de JC (27 ago): solo A y C — la asistencia no se contrato
var soloAC = _seccionesQueAplican(_parseCbMapa('A-300000000.C-100000000'));
ok('solo A y C: la asistencia NO aplica', !soloAC.asistencia);
ok('con G sola alcanza para asistencia', _seccionesQueAplican(_parseCbMapa('A-1.C.G')).asistencia);
ok('con M sola tambien (es la extendida)', _seccionesQueAplican(_parseCbMapa('A-1.C.M')).asistencia);

ok('con solo D alcanza para repuestos', _seccionesQueAplican(_parseCbMapa('D-5.IDD')).repuestos);
ok('con solo F alcanza para repuestos', _seccionesQueAplican(_parseCbMapa('F.IDD')).repuestos);
ok('con solo H alcanza para repuestos', _seccionesQueAplican(_parseCbMapa('H-5.IDD')).repuestos);

// El paso estandar del deducible PROMETE el reintegro de la IDD
var sinIdd = _seccionesQueAplican(_parseCbMapa('A-1.C.D-18000000.F.H'));
ok('con D/F/H pero sin IDD: el paso estandar no promete el reintegro', !sinIdd.deducible);
ok('...pero la variante asiatico/alta gama si aplica (describe el esquema)', sinIdd.deducibleDif);
ok('...y repuestos tambien', sinIdd.repuestos);

// ===== invariantes del fuente =====
console.log('\n-- invariantes del fuente --');
ok('el titulo de la seccion 1 es generico',
   html.indexOf('¿Qué incluye tu cobertura?') !== -1 && html.indexOf('Cobertura Total') === -1);
ok('aplicarSecciones corre con el cb del enlace',
   html.indexOf('aplicarSecciones(_parseCbMapa(data.cb))') !== -1);
ok('solo se renumera si algo se escondio', html.indexOf('if (oculto) renumerarGuia()') !== -1);
ok('las tres variantes del deducible se esconden juntas',
   html.indexOf("['s3', 's3a', 's3b'].forEach") !== -1);
ok('la asistencia (s2) se esconde cuando no aplica',
   html.indexOf('if (!q.asistencia)') !== -1 && html.indexOf("getElementById('s2')") !== -1);
ok('la navegacion toma los pasos visibles',
   html.indexOf('window._pasosGuia ||') !== -1 && html.indexOf('window._dotsGuia ||') !== -1);

// ===== el correo y la guia dicen LO MISMO =====
// Lo que buildEmail codifica en el enlace es exactamente lo que la guia
// decide con _seccionesQueAplican: se prueba el circuito completo.
console.log('\n-- el enlace del correo alimenta la decision de la guia --');

global.CFG = {
  GUIDE_URL: 'https://ejemplo.test/explicacion/', FROM_NAME: 'Agente', LICENSE: '00-0000',
  WEBSITE: 'www.ejemplo.test', AGENDA_URL: 'https://ejemplo.test/cita', LOGO_URL: 'x',
  LOGO_SDI_URL: 'x', FROM_EMAIL: 'a@b.test', PHONE: '0000-0000'
};
var M = require('../js/email-marca.js');
Object.keys(M).forEach(function (k) { global[k] = M[k]; });
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'email-template.js'), 'utf8'));

function cbDelCorreo(htmlCorreo) {
  var x = /[?&]cb=([^&"']+)/.exec(htmlCorreo);
  return x ? decodeURIComponent(x[1]) : null;
}

var COT = { nombre: 'Ana', vehiculo: 'X', plate: 'BXY123', valor: '18,000,000.00', prices: {}, sustRepos: '' };
var SIN_DFH = [
  { cod: 'A', desc: 'RC', montos: [{ etiqueta: 'Monto por accidente', valor: '300,000,000.00' }] },
  { cod: 'C', desc: 'RC D', montos: [{ etiqueta: 'Monto asegurado', valor: '100,000,000.00' }] },
  { cod: 'G', desc: 'Multi', montos: [] },
  { cod: 'N', desc: 'Exencion deducible', montos: [] }
];
var COMPLETO = SIN_DFH.concat([
  { cod: 'D', desc: 'Colision', montos: [{ etiqueta: 'Monto asegurado', valor: '18,000,000.00' }] },
  { cod: 'F', desc: 'Robo', montos: [] },
  { cod: 'IDD', desc: 'Reintegro', montos: [{ etiqueta: 'Monto', valor: '500,000.00' }] }
]);

var qSin = _seccionesQueAplican(_parseCbMapa(cbDelCorreo(buildEmail(Object.assign({ coberturas: SIN_DFH }, COT)))));
ok('correo sin D/F/H: la guia esconde deducible y repuestos',
   qSin !== null && !qSin.deducible && !qSin.repuestos);
ok('...pero trae G, asi que la asistencia queda', qSin.asistencia);

// Solo A y C: el correo no muestra asistencia y la guia tampoco
var SOLO_AC = [
  { cod: 'A', desc: 'RC', montos: [{ etiqueta: 'Monto por accidente', valor: '300,000,000.00' }] },
  { cod: 'C', desc: 'RC D', montos: [{ etiqueta: 'Monto asegurado', valor: '100,000,000.00' }] }
];
var qAC = _seccionesQueAplican(_parseCbMapa(cbDelCorreo(buildEmail(Object.assign({ coberturas: SOLO_AC }, COT)))));
ok('correo con solo A y C: la guia esconde tambien la asistencia',
   qAC !== null && !qAC.asistencia && !qAC.deducible && !qAC.repuestos);

var qCom = _seccionesQueAplican(_parseCbMapa(cbDelCorreo(buildEmail(Object.assign({ coberturas: COMPLETO }, COT)))));
ok('correo con D/F e IDD: la guia muestra los tres pasos',
   qCom !== null && qCom.deducible && qCom.deducibleDif && qCom.repuestos);

ok('correo sin coberturas: la guia no recibe cb y no toca nada',
   cbDelCorreo(buildEmail(COT)) === null);

console.log('\nexplicador-secciones: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) process.exit(1);
