/**
 * Test de los planes de asistencia (cobertura ASI del INS, SVA V32) —
 * 17 set 2026.
 *
 * Lo que vigila:
 *   1. Que los seis planes y sus primas sean los del dossier del INS, y que
 *      el conteo de servicios de cada uno calce (un servicio que se pierde
 *      en silencio es una promesa de menos; uno de mas, una promesa que la
 *      poliza no respalda).
 *   2. Que la tarjeta del correo de cotizacion NO salga antes del 28 de
 *      setiembre de 2026 y que, cuando sale, diga lo mismo que el modulo.
 *   3. El correo a clientes con poliza: la prima vigente CON IVA (D1),
 *      sin hacer la cuenta (JC), trato
 *      de vos (D3), y el enlace al configurador con `pv` y `fp` (D5).
 *   4. Que el configurador lea los MISMOS datos (misma fuente).
 *   5. El enlace corto /p: lista blanca y contrato con la Function.
 *
 * Run: node tests/test-asistencias.js
 */
var fs = require('fs'), path = require('path');
var A = require('../js/planes-asistencia.js');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('  FALLA ' + nombre); }
}

console.log('=== Datos de los seis planes ===');
ok('son exactamente 6 planes', A.PLANES_ASI.length === 6);
var esperado = {
  mascota:   { nom: 'Mascota',              prima: 7200,  serv: 11 },
  funerario: { nom: 'Asistencia Funeraria', prima: 10800, serv: 0  },
  bienestar: { nom: 'Salud Bienestar',      prima: 18000, serv: 16 },
  premium:   { nom: 'Salud Premium',        prima: 42000, serv: 30 },
  autos:     { nom: 'Autos Plus',           prima: 42000, serv: 7  },
  vip:       { nom: 'VIP',                  prima: 42000, serv: 21 }
};
Object.keys(esperado).forEach(function (id) {
  var p = A.planAsi(id), e = esperado[id];
  ok(id + ': existe', !!p);
  if (!p) return;
  ok(id + ': nombre', p.nom === e.nom);
  ok(id + ': prima ' + e.prima, p.prima === e.prima);
  ok(id + ': ' + e.serv + ' servicios', (p.serv ? p.serv.length : 0) === e.serv);
});
ok('el funerario trae 8 servicios incluidos', A.planAsi('funerario').incluye.length === 8);
ok('el funerario declara su monto maximo', A.planAsi('funerario').monto === '₡500.000');
var huecos = 0;
A.PLANES_ASI.forEach(function (p) { (p.serv || []).forEach(function (s) { if (!s[0] || !s[2]) huecos++; }); });
ok('ningun servicio quedo sin nombre o sin limite', huecos === 0);
ok('asiDesde = 7.200', A.asiDesde() === 7200);
ok('asiConIva(7200) = 8.136', A.asiConIva(7200) === 8136);
ok('asiColones separa miles con punto', A.asiColones(487300) === '₡487.300');

console.log('=== Porton por fecha (28 set 2026) ===');
ok('el 3 de setiembre 2026 NO esta disponible',  A.asiDisponible(new Date('2026-09-03T12:00:00-06:00')) === false);
ok('el 27 de setiembre 2026 NO esta disponible', A.asiDisponible(new Date('2026-09-27T23:00:00-06:00')) === false);
ok('el 28 de setiembre 2026 SI esta disponible', A.asiDisponible(new Date('2026-09-28T00:30:00-06:00')) === true);
ok('el 15 de octubre 2026 SI esta disponible',   A.asiDisponible(new Date('2026-10-15T12:00:00-06:00')) === true);
ok('sin argumento no revienta', typeof A.asiDisponible() === 'boolean');

// ---- montar el entorno del navegador ----
Object.keys(A).forEach(function (k) { global[k] = A[k]; });
global.CFG = {
  FROM_NAME: 'Agente Prueba', FROM_EMAIL: 'agente@ejemplo.test', LICENSE: '00-0000', WEBSITE: 'www.ejemplo.test',
  AGENDA_URL: 'https://ejemplo.test/agenda', WHATSAPP: '8888-0000', PHONE: '8888-0000',
  GUIDE_URL: 'https://ejemplo.test/explicacion/', PLANES_URL: 'https://ejemplo.test/asistencias/',
  LOGO_URL: 'https://ejemplo.test/img/ins-logo.png', LOGO_SDI_URL: 'https://ejemplo.test/img/sdi.png'
};
var M = require('../js/email-marca.js');
Object.keys(M).forEach(function (k) { global[k] = M[k]; });
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'email-template.js'), 'utf8'));
global._buildPlanesUrl = _buildPlanesUrl;
var E = require('../js/asistencias-email.js');

console.log('=== La tarjeta del correo de cotizacion ===');
var htmlAsi = M._bloqueAsistencias({ url: 'https://ejemplo.test/asistencias/?n=Agente', fontFam: "'Space Grotesk',Arial,sans-serif" });
ok('devuelve HTML', typeof htmlAsi === 'string' && htmlAsi.length > 200);
A.PLANES_ASI.forEach(function (p) {
  ok('nombra a ' + p.nom, htmlAsi.indexOf(p.nom) !== -1);
  ok('trae la prima de ' + p.nom, htmlAsi.indexOf(A.asiColones(p.prima)) !== -1);
});
ok('lleva el enlace a la pagina', htmlAsi.indexOf('https://ejemplo.test/asistencias/?n=Agente') !== -1);
ok('avisa que el precio no lleva IVA', /sin IVA/i.test(htmlAsi));
ok('dice que es opcional', /opcional/i.test(htmlAsi));
ok('boton "ver que trae y en cuanto queda"', /en cu&aacute;nto queda mi seguro/.test(htmlAsi));
ok('sin <svg>', htmlAsi.indexOf('<svg') === -1);
ok('sin <img>', htmlAsi.indexOf('<img') === -1);
ok('sin barra de color a la izquierda', htmlAsi.indexOf('border-left') === -1);
ok('sin url vacia el bloque no sale', M._bloqueAsistencias({ url: '' }) === '');

console.log('=== El correo de cotizacion enchufa la tarjeta (segun la fecha) ===');
var base = { nombre: 'Ana', vehiculo: 'Toyota Yaris', plate: 'BBB111',
             prices: { anual: '570.891,00', semestral: '308.283,00', trimestral: '158.423,00' } };
var _origDisp = global.asiDisponible;
global.asiDisponible = function () { return true; };
var conAsi = buildEmail(Object.assign({}, base, { incluirAsistencias: true }));
var sinAsi = buildEmail(Object.assign({}, base, { incluirAsistencias: false }));
global.asiDisponible = function () { return false; };
var antes  = buildEmail(Object.assign({}, base, { incluirAsistencias: true }));
global.asiDisponible = _origDisp;
var TITULO = 'Asistencias que le pod&eacute;s sumar';
ok('con la casilla prendida (y ya disponible), la tarjeta sale', conAsi.indexOf(TITULO) !== -1);
ok('con la casilla apagada, no sale', sinAsi.indexOf(TITULO) === -1);
ok('ANTES del 28 set no sale aunque la casilla este prendida', antes.indexOf(TITULO) === -1);
ok('la tarjeta va DESPUES de las formas de pago', conAsi.indexOf(TITULO) > conAsi.indexOf('Tus 3 opciones de pago'));
ok('el enlace lleva la ficha del agente', /asistencias\/\?[^"]*n=Agente(%20|\+)Prueba/.test(conAsi));
ok('el enlace lleva la licencia', conAsi.indexOf('l=00-0000') !== -1);
// En el HTML del correo el & va escapado como &amp;
ok('el enlace lleva la prima anual cotizada (pa=570891)', /&amp;pa=570891/.test(conAsi));
ok('el enlace NO lleva pv (eso es del cliente con poliza)', !/(&amp;|&)pv=/.test(conAsi));
A.PLANES_ASI.forEach(function (p) {
  ok('el correo trae ' + p.nom + ' con su prima del modulo', conAsi.indexOf(A.asiColones(p.prima)) !== -1 && conAsi.indexOf(p.nom) !== -1);
});

console.log('=== _buildPlanesUrl ===');
var u = _buildPlanesUrl({ clientName: 'Mariela', vehicle: 'Hyundai Tucson', primaVigente: '487.300', formaPago: 't' });
ok('pv normaliza "487.300" → 487300', /[?&]pv=487300/.test(u));
ok('fp viaja', /[?&]fp=t/.test(u));
ok('c viaja', /[?&]c=Mariela/.test(u));
ok('wa del agente viaja', /[?&]wa=8888-0000/.test(u));
ok('fp invalido no viaja', !/[?&]fp=/.test(_buildPlanesUrl({ formaPago: 'x' })));
ok('prima en formato US "570,891.00" → 570891', /[?&]pa=570891/.test(_buildPlanesUrl({ primaAnual: '570,891.00' })));
ok('prima basura no viaja', !/[?&]pv=/.test(_buildPlanesUrl({ primaVigente: 'abc' })));

console.log('=== asiParseMonto ===');
ok('"487.300" → 487300', E.asiParseMonto('487.300') === 487300);
ok('"487 300" → 487300', E.asiParseMonto('487 300') === 487300);
ok('"487,300.00" → 487300', E.asiParseMonto('487,300.00') === 487300);
ok('"₡487.300" → 487300', E.asiParseMonto('₡487.300') === 487300);
ok('487300 → 487300', E.asiParseMonto(487300) === 487300);
ok('"" → 0', E.asiParseMonto('') === 0);
ok('"abc" → 0', E.asiParseMonto('abc') === 0);

console.log('=== El correo a clientes con poliza ===');
var P = { nombrePila: 'Mariela', primaVigente: '487.300', formaPago: 't', vehiculo: 'Hyundai Tucson 2021', notaAdicional: 'Con Mascota quedan los <dos> perros.' };
var h = E.buildAsistenciasEmail(P);
ok('saluda por el nombre', h.indexOf('>Mariela,<') !== -1);
ok('D1: muestra la prima vigente', h.indexOf('₡487.300') !== -1);
ok('el correo NO hace la cuenta (JC: ese texto es innecesario)', h.indexOf('plan m&aacute;s econ&oacute;mico') === -1 && !/m&aacute;s por/.test(h));
ok('D3: trato de vos ("pod&eacute;s")', /pod&eacute;s/.test(h));
ok('D3: nada de usted', !/\busted\b/i.test(h));
ok('D1 corregida: la prima es la del recibo → "por trimestre, con IVA · pago trimestral"', /por trimestre, con IVA &middot; pago trimestral/.test(h));
ok('D5: el boton lleva pv=487300', /asistencias\/\?[^"]*pv=487300/.test(h));
ok('D5: el boton lleva fp=t', /asistencias\/\?[^"]*fp=t/.test(h));
ok('el boton dice "Ver que trae cada plan y en cuanto queda mi seguro"', /Ver qu&eacute; trae cada plan y en cu&aacute;nto queda mi seguro/.test(h));
ok('nombra el vehiculo', h.indexOf('Hyundai Tucson 2021') !== -1);
ok('la nota va escapada (XSS)', h.indexOf('&lt;dos&gt;') !== -1 && h.indexOf('<dos>') === -1);
ok('lleva el filete SDI', h.indexOf('#0D9488') !== -1 || h.indexOf('#0d9488') !== -1);
ok('lleva el pie SDI con la licencia', h.indexOf('Licencia SUGESE 00-0000') !== -1);
ok('sale con la ficha del agente del perfil, no la del dueno', h.indexOf('Agente Prueba') !== -1 && h.indexOf('08-1318') === -1);
ok('sin border-left', h.indexOf('border-left') === -1);
ok('sin emojis', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h));
A.PLANES_ASI.forEach(function (p) {
  ok('nombra a ' + p.nom + ' con su prima', h.indexOf(p.nom) !== -1 && h.indexOf(A.asiColones(p.prima)) !== -1);
});
var hSinPrima = E.buildAsistenciasEmail({ nombrePila: 'Ana', primaVigente: '' });
ok('sin prima no sale el bloque "Tu seguro hoy"', hSinPrima.indexOf('Tu seguro hoy') === -1);
ok('sin nota no sale el bloque de la nota', hSinPrima.indexOf('Nota de tu agente') === -1);

console.log('=== El WhatsApp ===');
var wa = E.buildAsistenciasWaUrl({ nombrePila: 'Mariela', primaVigente: 487300, urlPlanes: 'https://guia.appsegurosdigitales.com/p/ABCDEFGH23', telCliente: '8888 0000' });
ok('endpoint web.whatsapp.com/send/', wa.indexOf('https://web.whatsapp.com/send/?') === 0);
ok('NUNCA wa.me', wa.indexOf('wa.me') === -1);
ok('telefono con 506', /phone=50688880000/.test(wa));
var txt = decodeURIComponent(wa.split('text=')[1]);
ok('el texto lleva el enlace corto', txt.indexOf('https://guia.appsegurosdigitales.com/p/ABCDEFGH23') !== -1);
ok('el texto dice que se mando un correo', /Te acabo de enviar un correo/.test(txt));
ok('el texto lleva la prima al año (sin fp = anual)', txt.indexOf('₡487.300 al a\u00f1o') !== -1);
var txtS = E.buildAsistenciasWaTexto({ nombrePila: 'Ana', primaVigente: 215108, formaPago: 's', urlPlanes: 'x' });
ok('con fp=s el WhatsApp dice "por semestre"', txtS.indexOf('₡215.108 por semestre') !== -1);
ok('trato de vos', /pagás/.test(txt));
var waSin = E.buildAsistenciasWaTexto({ nombrePila: 'Ana', sinCorreo: true, urlPlanes: 'x' });
ok('sin correo NO afirma que se mando un correo', waSin.indexOf('correo') === -1);
ok('sin telefono abre el selector', E.buildAsistenciasWaUrl({ nombrePila: 'A', urlPlanes: 'x' }).indexOf('phone=') === -1);

console.log('=== La pagina lee la misma fuente ===');
var pagina = fs.readFileSync(path.join(__dirname, '..', 'asistencias', 'index.html'), 'utf8');
ok('carga js/planes-asistencia.js', pagina.indexOf('src="../js/planes-asistencia.js"') !== -1);
ok('usa PLANES_ASI y no una copia', pagina.indexOf('var PLANES = PLANES_ASI') !== -1 && pagina.indexOf('var PLANES_ASI = [') === -1);
ok('lee pv y pa', pagina.indexOf("Q.get('pv')") !== -1 && pagina.indexOf("Q.get('pa')") !== -1);
ok('la pagina aplica el recargo por fraccionamiento (asiCosto + ASI_RECARGO)', pagina.indexOf('asiCosto(p.prima, fp)') !== -1 && pagina.indexOf('ASI_RECARGO[fp]') !== -1);
ok('la pagina habla en la cuota de la forma de pago (UNIDAD por cuota)', pagina.indexOf("UNIDAD = fp === 'a' ? 'al año' : 'por ' + FP[fp][1]") !== -1 && pagina.indexOf('var tot = PRIMA + cuotaAsis') !== -1);
ok('la cotizada (pa) siempre es anual', pagina.indexOf("MODO === 'vigente' && FP[param('fp', 'a')]") !== -1);
ok('la pagina ya no dice "antes del recargo"', pagina.indexOf('antes del recargo') === -1);
ok('WhatsApp por web.whatsapp.com/send/', pagina.indexOf('https://web.whatsapp.com/send/?phone=') !== -1 && pagina.indexOf('wa.me') === -1);
ok('el INS arriba (cara del cliente)', pagina.indexOf('ins-logo-azul.png') !== -1);
ok('SDI al pie', pagina.indexOf('sdi-logo-compacto.svg') !== -1);
ok('noindex', pagina.indexOf('name="robots" content="noindex"') !== -1);
ok('sin emojis en el HTML', !/[\u{1F300}-\u{1FAFF}]/u.test(pagina));

console.log('=== La consola ===');
var index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var appjs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
var orden = ['js/planes-asistencia.js', 'js/email-marca.js', 'js/email-template.js', 'js/asistencias-email.js', 'js/asistencias-ui.js', 'js/app.js'];
var pos = orden.map(function (f) { return index.indexOf('<script src="' + f + '">'); });
ok('orden de carga: planes → marca → template → asistencias-email → asistencias-ui → app', pos.every(function (x, i) { return x !== -1 && (i === 0 || x > pos[i - 1]); }));
ok('la casilla del paso 3 existe y arranca oculta', /id="asiRow" hidden/.test(index));
ok('app.js pasa incluirAsistencias en los DOS llamados a buildEmail', (appjs.match(/incluirAsistencias:/g) || []).length === 2);
ok('app.js destapa la fila solo con asiDisponible()', /asiRow\.hidden = false/.test(appjs) && /asiDisponible\(\)/.test(appjs));
ok('el acceso del rail existe', /id="btnAsistencias"/.test(index));
ok('el modal existe con sus ids', ['asiModal', 'as-nom', 'as-mail', 'as-prima', 'as-fp', 'btnAsiSend', 'btnAsiWa', 'btnAsiOtro', 'asiDone'].every(function (id) { return index.indexOf('id="' + id + '"') !== -1; }));
ok('app.js engancha el modal con guard typeof', /typeof initAsistenciasModal === 'function'/.test(appjs));
var ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'asistencias-ui.js'), 'utf8');
ok('D4: el modal NO toca el historial', !/saveHistoryEntry|marcarPolizaEmitida|loadHistory/.test(ui));
ok('el modal acorta con tipo p', /acortarEnlace\([^)]*'p'\)/.test(ui));
ok('el modal reserva la pestaña ANTES del await', ui.indexOf("window.open('', '_blank')") < ui.indexOf("acortarEnlace(p.urlPlanes, 'p')"));

console.log('=== El enlace corto /p ===');
var sl = fs.readFileSync(path.join(__dirname, '..', 'js', 'shortlink.js'), 'utf8');
ok("shortlink.js conoce el tipo 'p' → /p", /tipo === 'p' \? '\/p'/.test(sl));
var fn = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'enlace.mjs'), 'utf8');
ok('la Function atiende /p y /p/:id', fn.indexOf('"/p", "/p/:id"') !== -1);
ok('la Function guarda /p bajo su propia clave', fn.indexOf('"p:" + id') !== -1);
ok('la Function redirige /p a /asistencias/', fn.indexOf('const DESTINO_P = "/asistencias/"') !== -1);

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
