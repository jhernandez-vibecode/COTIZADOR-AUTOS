/**
 * El interruptor "Formulario de cita": que viaja en el enlace de la guia y a donde
 * apunta el boton del correo. Lo mas importante: en modo 'propio' NADA cambia.
 * Datos INVENTADOS. Run: node tests/test-cita-url.js
 */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }
var leer = function (p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); };

var A = require('../js/planes-asistencia.js');
Object.keys(A).forEach(function (k) { global[k] = A[k]; });
global.asiDisponible = function () { return false; };
global.CFG = {
  FROM_NAME: 'Agente Prueba Uno', FROM_EMAIL: 'agente@ejemplo.test', LICENSE: '00-0000', WEBSITE: 'www.ejemplo.test',
  AGENDA_URL: 'https://ejemplo.test/agenda', WHATSAPP: '8888-1111', PHONE: '8888-2222',
  GUIDE_URL: 'https://ejemplo.test/explicacion/', PLANES_URL: 'https://ejemplo.test/asistencias/',
  CITA_URL: 'https://ejemplo.test/cita/', CITA_MODO: 'propio',
  LOGO_URL: 'https://ejemplo.test/img/ins-logo.png', LOGO_SDI_URL: 'https://ejemplo.test/img/sdi.png'
};
var M = require('../js/email-marca.js');
Object.keys(M).forEach(function (k) { global[k] = M[k]; });
eval(leer('js/email-template.js'));

var extras = { clientName: 'Mariela', vehicle: 'TOYOTA RAV4', plate: 'BDF482', year: 2021,
               prices: { anual: '570,891.00', semestral: '308,283.00', trimestral: '158,423.00' } };

console.log('-- modo propio: todo como hoy --');
var gp = _buildGuideUrl(extras);
ok('la guia NO lleva fc', !/[?&]fc=/.test(gp));
ok('la guia NO lleva ae ni tel', !/[?&]ae=/.test(gp) && !/[?&]tel=/.test(gp));
ok('la guia NO lleva wa (sin asistencias)', !/[?&]wa=/.test(gp));
ok('_buildCitaUrl devuelve vacio', _buildCitaUrl(extras) === '');
var mp = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', prices: extras.prices });
ok('el boton del correo va al enlace propio', mp.indexOf('href="https://ejemplo.test/agenda"') !== -1);

console.log('-- modo sdi --');
CFG.CITA_MODO = 'sdi';
var gs = _buildGuideUrl(extras);
ok('la guia lleva fc=1', /[?&]fc=1(&|$)/.test(gs));
ok('la guia lleva el correo del agente', gs.indexOf('ae=agente%40ejemplo.test') !== -1);
ok('la guia lleva el telefono', gs.indexOf('tel=8888-2222') !== -1);
ok('la guia lleva wa UNA sola vez', (gs.match(/[?&]wa=/g) || []).length === 1);
ok('la guia conserva a (respaldo)', gs.indexOf('a=https%3A%2F%2Fejemplo.test%2Fagenda') !== -1);
var cu = _buildCitaUrl(extras);
ok('cita: base y ficha del agente', cu.indexOf('https://ejemplo.test/cita/?') === 0 && cu.indexOf('n=Agente%20Prueba%20Uno') !== -1 && cu.indexOf('l=00-0000') !== -1 && cu.indexOf('ae=agente%40ejemplo.test') !== -1);
ok('cita: cliente, vehiculo, placa y primas', ['c=Mariela', 'v=TOYOTA%20RAV4', 'p=BDF482', 'y=2021', 'pa=570891', 'ps=308283', 'pt=158423'].every(function (t) { return cu.indexOf(t) !== -1; }));
var ms = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', year: 2021, prices: extras.prices });
ok('el boton del correo va a /cita/', /href="https:\/\/ejemplo\.test\/cita\/\?[^"]*ae=agente%40ejemplo\.test/.test(ms));
ok('sin correo del perfil, sdi se comporta como propio', (function () { var e = CFG.FROM_EMAIL; CFG.FROM_EMAIL = ''; var r = _buildCitaUrl(extras) === '' && !/[?&]fc=/.test(_buildGuideUrl(extras)); CFG.FROM_EMAIL = e; return r; })());
CFG.CITA_MODO = 'propio';

console.log('-- perfil --');
var perfil = leer('js/agent-profile.js');
ok('saveProfile guarda citaModo', /citaModo:\s*\(p\.citaModo === 'sdi'\) \? 'sdi' : 'propio'/.test(perfil));
ok('applyProfile con guard !== undefined', perfil.indexOf("if (p.citaModo !== undefined) CFG.CITA_MODO = (p.citaModo === 'sdi') ? 'sdi' : 'propio';") !== -1);
ok('config trae CITA_URL y el modo por defecto propio', /CITA_URL:\s*'https:\/\/cotizador\.appsegurosdigitales\.com\/cita\/'/.test(leer('js/config.js')) && /CITA_MODO:\s*'propio'/.test(leer('js/config.js')));
var idx = leer('index.html');
ok('el ⚙ tiene las dos opciones', idx.indexOf('id="p-cita-propio"') !== -1 && idx.indexOf('id="p-cita-sdi"') !== -1);

console.log('-- la guia --');
var guia = leer('explicacion/index.html');
var gi = guia.indexOf('function _modoCitaSdi'), gf = guia.indexOf('// ===== [/GUIA-CITA-PURO]');
ok('el bloque [GUIA-CITA-PURO] existe', gi !== -1 && gf > gi);
eval(guia.slice(gi, gf));
var dg = { n: 'Agente Prueba Uno', l: '00-0000', w: 'www.ejemplo.test', wa: '8888-1111', tel: '8888-2222', ae: 'agente@ejemplo.test',
           fc: true, c: 'Mariela', v: 'TOYOTA RAV4', p: 'BDF482', y: 2021, pa: '570891', ps: '308283', pt: '158423' };
ok('con fc y ae es modo sdi', _modoCitaSdi(dg) === true);
ok('sin fc NO (enlaces ya enviados)', _modoCitaSdi(Object.assign({}, dg, { fc: false })) === false);
ok('con ae invalido NO', _modoCitaSdi(Object.assign({}, dg, { ae: 'javascript:alert(1)' })) === false);
var ug = _urlCita(dg, 'mascota.premium');
ok('arma la ruta relativa a /cita/', ug.indexOf('../cita/?') === 0);
ok('pasa agente, cliente, primas y asistencias', ['ae=agente%40ejemplo.test', 'c=Mariela', 'p=BDF482', 'y=2021', 'ps=308283', 'as=mascota.premium'].every(function (t) { return ug.indexOf(t) !== -1; }));
ok('el sitio web NO viaja a /cita/ (la guia lo rellena con un valor por defecto)', ug.indexOf('w=') === -1 && !/[?&]w=/.test(cu));
ok('as con basura no viaja', _urlCita(dg, '<script>').indexOf('as=') === -1);
ok('la guia lee fc, ae y tel', guia.indexOf("fc: _params.get('fc') === '1'") !== -1 && guia.indexOf("ae: _params.get('ae') || ''") !== -1 && guia.indexOf("tel: _params.get('tel') || ''") !== -1);
ok('el boton navega a /cita/ solo en modo sdi', guia.indexOf('if (_modoCitaSdi(data))') !== -1);

console.log('-- la pagina /cita/ --');
var pg = fs.existsSync(path.join(__dirname, '..', 'cita', 'index.html')) ? leer('cita/index.html') : '';
ok('existe', pg.length > 0);
['Nombre Completo', 'Número de Teléfono', 'Dirección Domicilio (Provincia- canton- distrito y señas)', 'Ocupación u Oficio',
 'Ingreso Mensual Promedio', 'Número de Placa o Indique si es Cero Kilómetros', 'Forma de pago que desea contratar',
 'Por favor, indique la fecha en la que desea programar el aseguramiento de su vehículo',
 'Tome en cuenta que nuestro horario comercial es de lunes a viernes de 8:00 am a 5:00 pm',
 'Por favor, seleccione el rango de horas que prefiere para coordinar el aseguramiento.',
 'Es necesario que a esa hora tenga disponible su vehículo para las fotografías que vamos a necesitar y verificar el estado de conservación.'
].forEach(function (t) { ok('pregunta literal: ' + t.slice(0, 38), pg.indexOf(t) !== -1); });
['Anual', 'Semestral', 'Trimestral', '8:00 am a 10:00 am', '10:00 am a 12:00 md', '01:00 pm a 03:00 pm', '03:00 pm a 05:00 pm',
 'Menos de ₡500.000', 'De ₡500.000 a ₡1.000.000', 'De ₡1.000.000 a ₡2.000.000', 'De ₡2.000.000 a ₡4.000.000', 'Más de ₡4.000.000'
].forEach(function (t) { ok('opcion literal: ' + t, pg.indexOf('value="' + t + '"') !== -1); });
ok('misma fuente de planes', pg.indexOf('src="../js/planes-asistencia.js"') !== -1);
ok('consentimiento: no para publicidad', /No se usan para publicidad/.test(pg));
ok('WhatsApp por web.whatsapp, nunca wa.me', pg.indexOf('https://web.whatsapp.com/send/') !== -1 && pg.indexOf('wa.me') === -1);
ok('[hidden] le gana al display', pg.indexOf('[hidden]{display:none!important}') !== -1);
ok('campo trampa presente y sin type=hidden', /id="f-sitio"/.test(pg) && !/id="f-sitio"[^>]*type="hidden"/.test(pg));
ok('envia a /cita/enviar', pg.indexOf("fetch('/cita/enviar'") !== -1);
ok('nada del agente escrito a mano', pg.indexOf('08-1318') === -1 && !/Juan Carlos/.test(pg) && pg.indexOf('8822') === -1);
ok('sin genero', !/protegid[ao]\b|asegurad[ao] al instante/.test(pg.replace(/queda asegurado/g, '')));
ok('la fecha dice setiembre como los correos, no el septiembre del navegador', pg.indexOf("'setiembre'") !== -1 && pg.indexOf('toLocaleDateString') === -1);

console.log('-- ajustes de JC del 19 set 2026 --');
var TERR = require('../js/cr-territorio.js').CR_TERRITORIO;
var nCant = TERR.reduce(function (t, x) { return t + x.c.length; }, 0);
var punt = TERR.filter(function (x) { return x.n === 'Puntarenas'; })[0];
ok('territorio: 7 provincias y 84 cantones', TERR.length === 7 && nCant === 84);
ok('territorio: Monteverde y Puerto Jiménez son CANTONES de Puntarenas', punt.c.some(function (c) { return c.n === 'Monteverde'; }) && punt.c.some(function (c) { return c.n === 'Puerto Jiménez'; }));
ok('territorio: ya no figuran como distritos de otro cantón', punt.c.filter(function (c) { return c.n === 'Central' || c.n === 'Golfito'; }).every(function (c) { return c.d.indexOf('Monte Verde') === -1 && c.d.indexOf('Puerto Jiménez') === -1; }));
ok('territorio: ningún cantón sin distritos ni nombres repetidos dentro de un cantón', TERR.every(function (x) { return x.c.every(function (c) { return c.d.length > 0 && new Set(c.d).size === c.d.length; }); }));
ok('la página carga la lista de territorio', pg.indexOf('src="../js/cr-territorio.js"') !== -1);
ok('tres selectores + señas', ['id="f-provincia"', 'id="f-canton"', 'id="f-distrito"', 'id="f-direccion"', 'Dirección por señas'].every(function (t) { return pg.indexOf(t) !== -1; }));
ok('el distrito ofrece "No aparece en la lista"', pg.indexOf("'No aparece en la lista'") !== -1);
ok('la dirección sigue viajando como un solo campo (la Function no cambió)', pg.indexOf('direccion: armarDireccion()') !== -1 && pg.indexOf('delete cuerpo.senas') !== -1);
ok('si la lista no carga, queda el párrafo de siempre', pg.indexOf("document.querySelector('.fila3').hidden = true") !== -1);
ok('nota de la Ley 8204 bajo el ingreso', /Ley 8204 y la pol[ií]tica «Conozca a su cliente»/.test(pg));
ok('precios dentro de las formas de pago', ['id="pr-a"', 'id="pr-s"', 'id="pr-t"'].every(function (t) { return pg.indexOf(t) !== -1; }));
ok('el anual va resaltado con estrella', /class="op rec"[^>]*>\s*<input[^>]*value="Anual"/.test(pg) && pg.indexOf('&#9733; Anual') !== -1);
ok('los valores que se envían siguen siendo los del formulario', ['value="Anual"', 'value="Semestral"', 'value="Trimestral"'].every(function (t) { return pg.indexOf(t) !== -1; }));
ok('guía: "Tu plan" ya no va fijo en la pestaña Básico', guia.indexOf('Plan Básico (7-15 años) · Tu plan') === -1 && guia.indexOf("if (t.getAttribute('data-plan') === miPlan) t.textContent += ' · Tu plan'") !== -1);
ok('guía: repuestos ya no repite "Tuyo"', guia.indexOf('match-tag">Tuyo<') === -1 && guia.indexOf('you-tag">Tu plan<') !== -1);
ok('no promete videollamada: la inspeccion es con fotos (JC, 19 set 2026)', !/video\s?llamada/i.test(pg));
ok('la pantalla de fallo muestra el motivo y el correo del agente (diagnostico por foto)', pg.indexOf('id="falloDet"') !== -1 && pg.indexOf("fallo(r, x.st, x.j && x.j.error)") !== -1);
ok('noindex', pg.indexOf('name="robots" content="noindex"') !== -1);

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
