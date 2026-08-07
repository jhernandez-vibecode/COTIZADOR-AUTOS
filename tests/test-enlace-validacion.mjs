/**
 * Tests de netlify/functions/lib/validacion.mjs — que se acepta acortar y a
 * donde se permite redirigir. Es la parte delicada: el acortador guarda un
 * destino y despues manda gente ahi, asi que no puede volverse un redirector
 * abierto ni un almacen publico.
 *
 * Correr: node tests/test-enlace-validacion.mjs
 */
import { esNuestro, baseAsistencia, CLAVES, CLAVES_A } from '../netlify/functions/lib/validacion.mjs';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

// ---------- Guia de la cotizacion (/g) ----------
ok('g-acepta', esNuestro('n=Juan&c=Silvia&p=BRK454&va=10000000&pa=570891', CLAVES));
ok('g-rechaza-clave-ajena', !esNuestro('n=Juan&evil=1', CLAVES));
ok('g-rechaza-vacio', !esNuestro('', CLAVES));
ok('g-rechaza-javascript', !esNuestro('n=javascript:alert(1)', CLAVES));
ok('g-rechaza-data', !esNuestro('w=data:text/html,<script>', CLAVES));
// Un CRLF reventaria la cabecera Location del 302 y dejaria el enlace roto para
// siempre (ya guardado, imposible de reparar sin tocar el store).
ok('g-rechaza-crlf-crudo',      !esNuestro('n=Juan\r\nX', CLAVES));
ok('g-rechaza-crlf-encodeado',  !esNuestro('n=Juan%0d%0aLocation:%20http://malo', CLAVES));
ok('g-rechaza-nul',             !esNuestro('n=Juan%00Carlos', CLAVES));
ok('g-rechaza-gigante', !esNuestro('n=' + 'x'.repeat(2100), CLAVES));

// EL ESPACIO NO SE RECHAZA, y esto es lo que blinda el bug del 7 ago 2026:
// URLSearchParams DECODIFICA, asi que 'n=Juan%20Carlos' llega como "Juan
// Carlos". Si alguien mete el espacio en la clase de caracteres, el acortador
// rechaza toda cotizacion real (ningun agente ni cliente se llama con una sola
// palabra) y cae al link largo en silencio — que es justo lo que veniamos a
// arreglar. El nombre del agente va SIEMPRE en el query.
ok('g-acepta-espacios', esNuestro('n=Juan%20Carlos%20Hernandez%20Vargas&c=DELGADO%20ARGUELLO%20SILVIA%20MARIEL', CLAVES));
ok('a-acepta-espacios', esNuestro('n=Juan%20Carlos%20Hernandez%20Vargas&lic=08-1318', CLAVES_A));

// ---------- Guia de emergencias (/a) ----------
ok('a-acepta', esNuestro('n=Juan%20Carlos&tel=8822-1348&wa=50688221348&em=jc%40x.com&lic=08-1318&web=www.x.com', CLAVES_A));
ok('a-acepta-roster', esNuestro('a=jc&n=Juan', CLAVES_A));   // el ?a=<id> viejo sigue valiendo
// Las dos listas son distintas a proposito: los precios del explicador no
// tienen nada que hacer en la guia de emergencias, ni al reves.
ok('a-rechaza-params-explicador', !esNuestro('pa=570891&va=10000000', CLAVES_A));
ok('g-rechaza-params-asistencia', !esNuestro('tel=8822-1348&lic=08-1318', CLAVES));

// ---------- Lista blanca de destinos: lo que impide el redirector abierto ----------
ok('base-acepta-asistencia',
   baseAsistencia('https://appasistenciaseguroautos.netlify.app/') === 'https://appasistenciaseguroautos.netlify.app/');
ok('base-rechaza-host-ajeno',  baseAsistencia('https://sitio-malo.com/') === '');
ok('base-rechaza-subdominio',  baseAsistencia('https://appasistenciaseguroautos.netlify.app.malo.com/') === '');
ok('base-rechaza-http',        baseAsistencia('http://appasistenciaseguroautos.netlify.app/') === '');
ok('base-rechaza-javascript',  baseAsistencia('javascript:alert(1)') === '');
ok('base-rechaza-vacio',       baseAsistencia('') === '' && baseAsistencia(null) === '');
ok('base-rechaza-basura',      baseAsistencia('no-es-una-url') === '');
// El query y el hash viajan aparte en `q`: la base guardada no los arrastra.
ok('base-limpia-query',
   baseAsistencia('https://appasistenciaseguroautos.netlify.app/?a=jc#x') === 'https://appasistenciaseguroautos.netlify.app/');

console.log('\nenlace-validacion: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
