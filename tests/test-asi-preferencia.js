/**
 * Preferencia del agente "Planes de asistencia del INS: ofrecerlos / no" (13 oct 2026).
 * Decide cómo arranca el interruptor del paso 3 en cada cotización.
 * Datos INVENTADOS. Run: node tests/test-asi-preferencia.js
 */
var fs = require('fs'), path = require('path'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }
var leer = function (p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); };

console.log('-- config --');
var CFG0 = vm.runInNewContext(leer('js/config.js') + '\n;CFG');
ok('por defecto se ofrecen (lo de siempre)', CFG0.ASI_OFRECER === true);

console.log('-- perfil: guardar, leer y aplicar --');
function contexto() {
  var store = {};
  var ctx = vm.createContext({
    console: console,
    CFG: { ASI_OFRECER: true, CITA_MODO: 'propio' },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    }
  });
  vm.runInContext(leer('js/agent-profile.js'), ctx);
  return ctx;
}
var base = "{ name: 'Agente Prueba Uno', email: 'agente@ejemplo.test', license: '00-0000' }";

var c1 = contexto();
vm.runInContext('saveProfile(Object.assign(' + base + ', { asiOfrecer: false }))', c1);
ok('guarda "no ofrecerlos"', vm.runInContext('loadProfile().asiOfrecer', c1) === false);
vm.runInContext('applyProfile(loadProfile())', c1);
ok('aplicado: CFG.ASI_OFRECER queda en false', c1.CFG.ASI_OFRECER === false);
vm.runInContext('saveProfile(Object.assign(' + base + ', { asiOfrecer: true })); applyProfile(loadProfile())', c1);
ok('y se puede volver a "ofrecerlos"', c1.CFG.ASI_OFRECER === true);

var c2 = contexto();
vm.runInContext('applyProfile(' + base + ')', c2);
ok('perfil viejo sin el campo: sigue ofreciéndolos', c2.CFG.ASI_OFRECER === true);
vm.runInContext('saveProfile(' + base + ')', c2);
ok('guardar sin el campo lo deja en "ofrecerlos" (no lo apaga por omisión)', vm.runInContext('loadProfile().asiOfrecer', c2) === true);

console.log('-- el interruptor del paso 3 --');
var app = leer('js/app.js');
var i = app.indexOf('function _aplicarAsiPorDefecto'), j = app.indexOf('function resetAll');
ok('existe _aplicarAsiPorDefecto', i !== -1 && j > i);
var caja = { checked: true };
var ctxA = vm.createContext({ CFG: { ASI_OFRECER: false }, document: { getElementById: function (id) { return id === 'm-asistencias' ? caja : null; } } });
vm.runInContext(app.slice(i, j), ctxA);
vm.runInContext('_aplicarAsiPorDefecto()', ctxA);
ok('con "no ofrecerlos" arranca apagado', caja.checked === false);
ctxA.CFG.ASI_OFRECER = true;
vm.runInContext('_aplicarAsiPorDefecto()', ctxA);
ok('con "ofrecerlos" arranca prendido', caja.checked === true);
ctxA.document.getElementById = function () { return null; };
ok('sin la casilla en la página no revienta', (function () { try { vm.runInContext('_aplicarAsiPorDefecto()', ctxA); return true; } catch (e) { return false; } })());

console.log('-- enganches --');
var rs = app.slice(app.indexOf('function resetAll'), app.indexOf('function resetAll') + 2500);
ok('cada cotización nueva vuelve a la preferencia (resetAll)', rs.indexOf('_aplicarAsiPorDefecto();') !== -1);
ok('al arrancar, después de aplicar el perfil', /applyProfile\(savedProfile\);[\s\S]{0,200}_aplicarAsiPorDefecto\(\);/.test(app));
ok('al guardar el perfil, después de aplicarlo', /applyProfile\(profile\);[\s\S]{0,200}_aplicarAsiPorDefecto\(\);/.test(app));
ok('el guardado lee la opción del ⚙', app.indexOf("asiOfrecer: !(document.getElementById('p-asi-no') || {}).checked,") !== -1);
ok('el ⚙ se llena con la preferencia actual', app.indexOf("pAsiNo.checked = CFG.ASI_OFRECER === false;") !== -1);
ok('mover el interruptor repinta la vista previa', /getElementById\('m-asistencias'\);\s*if \(mAsi\) mAsi\.addEventListener\('change', schedulePreview\);/.test(app));

var idx = leer('index.html');
ok('el ⚙ tiene las dos opciones', idx.indexOf('id="p-asi-si"') !== -1 && idx.indexOf('id="p-asi-no"') !== -1);
ok('aclara que no cambia "Asistencias a cliente"', idx.indexOf('No cambia el envío “Asistencias a cliente” del menú.') !== -1);
ok('la casilla del paso 3 sigue existiendo y prendida en el HTML', idx.indexOf('<input type="checkbox" id="m-asistencias" checked />') !== -1);

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
