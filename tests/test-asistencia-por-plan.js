/**
 * Test de la seccion 2 de la guia (asistencia en carretera): la tabla de
 * limites cambia con el PLAN del vehiculo y con G / G+M.
 *
 * Cada cifra de aca se leyo COMO IMAGEN de documentos-ins/co-multiasistencia-170.pdf
 * (INS, 3 feb 2026), tablas de PARTICULARES Y CARGA LIVIANA - USO PERSONAL:
 *   G: Limitado p.12 - Basico p.12 - Plus p.13
 *   M: Limitado Extendido p.21 - Plus Extendido p.21
 *   M Basico Extendido: el PDF vigente NO lo trae -> la guia no inventa la cifra.
 * Pag. 10: G y M no se suman; con M rige SOLO el Plan Extendido.
 *
 * Lo que vigila: que la guia no vuelva a mostrar una sola tabla para todos
 * (antes: 6x$175 a un carro 2024 y a uno 2015, con o sin M).
 *
 * Run: node tests/test-asistencia-por-plan.js
 */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}
var html = fs.readFileSync(path.join(__dirname, '..', 'explicacion', 'index.html'), 'utf8');

console.log('-- el bloque puro se extrae y evalua --');
var ini = html.indexOf('var ASIST_ORDEN');
var fin = html.indexOf('// ===== [/GUIA-ASIST-PURO]');
ok('el bloque [GUIA-ASIST-PURO] existe y esta delimitado', ini !== -1 && fin > ini);
eval(html.slice(ini, fin));
ok('las funciones quedaron definidas', typeof _planAsistencia === 'function' && typeof _limitesAsistencia === 'function');

function fila(plan, conM) { var r = _limitesAsistencia(plan, conM); return ASIST_ORDEN.map(function (k) { return r.filas[k]; }).join(' | '); }

console.log('\n-- el plan sale de la antiguedad (p.12-13; tope de 20 anos, p.7) --');
ok('0 anos -> plus', _planAsistencia(0) === 'plus');
ok('6 anos -> plus', _planAsistencia(6) === 'plus');
ok('7 anos -> basico', _planAsistencia(7) === 'basico');
ok('15 anos -> basico', _planAsistencia(15) === 'basico');
ok('16 anos -> limitado', _planAsistencia(16) === 'limitado');
ok('20 anos -> limitado', _planAsistencia(20) === 'limitado');
ok('21 anos -> sin plan (el INS no suscribe)', _planAsistencia(21) === null);
ok('edad ilegible -> sin plan', _planAsistencia(NaN) === null && _planAsistencia(-1) === null);

console.log('\n-- cobertura G, cifra por cifra --');
ok('Plus G (p.13)', fila('plus', false) === '5× · $200 | 5× · $200 | 4× · $150 | 4× · costo | 5× · $125 | 3× · $125 | 3× · $125');
ok('Basico G (p.12)', fila('basico', false) === '4× · $175 | 5× · $175 | 3× · $125 | 3× · costo | 3× · $100 | 2× · $100 | 2× · $100');
ok('Limitado G (p.12)', fila('limitado', false) === '3× · $175 | 5× · $175 | 2× · $125 | 2× · costo | 2× · $100 | 2× · $100 | 1× · $100');

console.log('\n-- cobertura M: manda el Plan Extendido, no la suma (p.10) --');
ok('Plus Extendido (p.21)', fila('plus', true) === '7× · $200 | 7× · $200 | 6× · $150 | 6× · costo | 6× · $125 | 4× · $125 | 4× · $125');
ok('Limitado Extendido (p.21)', fila('limitado', true) === '4× · $175 | 6× · $175 | 3× · $125 | 3× · costo | 3× · $100 | 3× · $100 | 2× · $100');
ok('Plus con M se marca extendido', _limitesAsistencia('plus', true).extendido === true);

console.log('\n-- Basico con M: el PDF vigente no trae la tabla -> piso de G + aviso, SIN cifra inventada --');
var bm = _limitesAsistencia('basico', true);
ok('muestra las cifras de G', fila('basico', true) === fila('basico', false));
ok('no se declara extendido', bm.extendido === false);
ok('avisa que hay M sin tabla', bm.extendidoSinTabla === true);

console.log('\n-- enlaces viejos (sin cb): G como piso, nunca promete de mas --');
ok('conM null -> G', fila('plus', null) === fila('plus', false) && _limitesAsistencia('plus', null).extendidoSinTabla === false);
['plus', 'limitado'].forEach(function (p) {
  var g = ASIST_LIMITES[p].G, m = ASIST_LIMITES[p].M;
  ok(p + ': cada fila de G es <= la de M (G es el piso)', g.every(function (f, i) { return f[0] <= m[i][0] && f[1] === m[i][1]; }));
});
ok('plan desconocido -> null', _limitesAsistencia('otro', true) === null);

console.log('\n-- la pagina --');
ok('tres pestanas con data-plan', ['plus', 'basico', 'limitado'].every(function (p) { return html.indexOf('data-plan="' + p + '"') !== -1; }));
ok('siete filas con data-svc', ASIST_ORDEN.every(function (k) { return html.indexOf('data-svc="' + k + '"') !== -1; }));
ok('la tabla vieja unica (6× · $175) ya no esta escrita en el HTML', html.indexOf('6× · $175') === -1);
ok('el HTML estatico arranca con Basico G (el piso)', html.indexOf('data-svc="averia">4× · $175<') !== -1);
ok('la nota dice ano calendario y cita la fuente', html.indexOf('por año calendario') !== -1 && html.indexOf('Condiciones Operativas de Multiasistencia del INS') !== -1);
ok('el subtitulo solo nombra la M si la cotizacion la trae', html.indexOf("conM ? 'Coberturas G y M' : 'Cobertura G'") !== -1);
ok('"Tu plan" sigue marcando la pestana del vehiculo', html.indexOf("' · Tu plan'") !== -1);

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
