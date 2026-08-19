/**
 * Tests de js/shortlink.js — enlaces cortos para WhatsApp.
 *
 * Cubre el contrato con netlify/functions/enlace.mjs (ruta y cuerpo por tipo)
 * y, sobre todo, la regla que no se puede romper: si el acortador falla, se
 * comparte el enlace LARGO. Nunca se deja al agente sin link que mandar.
 *
 * Correr: node tests/test-shortlink.js
 */
// A proposito el dominio "feo": el enlace corto ya NO sale de location.origin
// (19 ago 2026), asi que el host del cliente no depende de por donde entre el
// agente. Ver SHORTLINK_HOST en js/shortlink.js.
global.location = { origin: 'https://cotizador-segurosdigitalesins-sdi.netlify.app' };

var { acortarEnlace, SHORTLINK_HOST } = require('../js/shortlink.js');

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

// El fallback registra un console.warn a propósito; lo silenciamos para que la
// salida del test no parezca un error.
console.warn = function () {};

var llamadas = [];
/** Sustituye fetch: guarda la llamada y responde lo que le digamos. */
function mockFetch(responder) {
  llamadas = [];
  global.fetch = function (ruta, opts) {
    llamadas.push({ ruta: ruta, body: JSON.parse(opts.body) });
    return responder();
  };
}
var respuesta = (estado, cuerpo) => Promise.resolve({
  ok: estado >= 200 && estado < 300,
  status: estado,
  json: () => Promise.resolve(cuerpo)
});

var GUIA  = 'https://cotizador.appsegurosdigitales.com/explicacion/?n=Juan&c=Silvia&p=BRK454&va=10000000';
var ASIST = 'https://appasistenciaseguroautos.netlify.app/?n=Juan%20Carlos&tel=8822-1348&lic=08-1318';

(async function () {
  // ---- Guía de la cotización (tipo por defecto) ----
  mockFetch(() => respuesta(200, { id: 'K7M4PQ2XRB' }));
  var r1 = await acortarEnlace(GUIA);
  ok('g-ruta',      llamadas[0].ruta === '/g');
  ok('g-query',     llamadas[0].body.q === 'n=Juan&c=Silvia&p=BRK454&va=10000000');
  ok('g-sin-base',  llamadas[0].body.b === undefined);   // /g arma el destino solo
  ok('g-devuelve',  r1 === 'https://guia.appsegurosdigitales.com/g/K7M4PQ2XRB');
  // El que de verdad protege el bug: el host es fijo, no el de la barra de
  // direcciones del agente.
  ok('g-host-fijo', r1.indexOf(location.origin) === -1);
  ok('g-mas-corto', r1.length < GUIA.length);

  // ---- Guía de emergencias de la póliza ----
  mockFetch(() => respuesta(200, { id: 'ABCDEFGH23' }));
  var r2 = await acortarEnlace(ASIST, 'a');
  ok('a-ruta',      llamadas[0].ruta === '/a');
  ok('a-query',     llamadas[0].body.q === 'n=Juan%20Carlos&tel=8822-1348&lic=08-1318');
  // La app de asistencia vive en OTRO sitio: sin `b` la Function no sabría a
  // dónde redirigir (y con `b` libre sería un redirector abierto — lo valida
  // contra su lista blanca).
  ok('a-manda-base', llamadas[0].body.b === 'https://appasistenciaseguroautos.netlify.app/');
  ok('a-devuelve',   r2 === 'https://guia.appsegurosdigitales.com/a/ABCDEFGH23');
  ok('a-host-fijo',  r2.indexOf(location.origin) === -1);
  // Un host que no sea alias de este sitio deja los enlaces muertos y nada lo
  // avisa en tiempo de ejecucion: que al menos falle un test si alguien lo mueve.
  ok('a-host-esperado', SHORTLINK_HOST === 'https://guia.appsegurosdigitales.com');
  ok('a-sin-cotizador', SHORTLINK_HOST.indexOf('cotizador') === -1);
  ok('a-mas-corto',  r2.length < ASIST.length);

  // ---- Fallback: pase lo que pase, sale el enlace largo ----
  mockFetch(() => respuesta(503, { error: 'No se pudo acortar el enlace.' }));
  ok('falla-503',   (await acortarEnlace(ASIST, 'a')) === ASIST);

  mockFetch(() => respuesta(400, { error: 'Ese destino no esta autorizado.' }));
  ok('falla-400',   (await acortarEnlace(ASIST, 'a')) === ASIST);

  mockFetch(() => respuesta(200, { id: 'no-es-un-id' }));
  ok('falla-id',    (await acortarEnlace(ASIST, 'a')) === ASIST);

  mockFetch(() => respuesta(200, null));
  ok('falla-vacio', (await acortarEnlace(GUIA)) === GUIA);

  mockFetch(() => Promise.reject(new Error('red caida')));
  ok('falla-red',   (await acortarEnlace(GUIA)) === GUIA);

  // ---- Sin parámetros no hay nada que acortar: ni se llama a la red ----
  mockFetch(() => respuesta(200, { id: 'K7M4PQ2XRB' }));
  var pelada = 'https://appasistenciaseguroautos.netlify.app/';
  ok('sin-params',      (await acortarEnlace(pelada, 'a')) === pelada);
  ok('sin-params-red',  llamadas.length === 0);
  ok('vacio',           (await acortarEnlace('', 'a')) === '');

  console.log('\nshortlink: ' + pass + ' OK, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
