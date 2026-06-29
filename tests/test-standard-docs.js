/**
 * Tests de js/standard-docs.js — el manifiesto debe apuntar a PDFs que existen
 * y los nombres de adjunto deben ser ASCII (headers MIME limpios).
 * Correr: node tests/test-standard-docs.js
 */
var fs = require('fs');
var path = require('path');
var STD = require('../js/standard-docs.js').STD_DOCS;

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

var repo = path.join(__dirname, '..');

function checkList(label, list) {
  ok(label + '-existe-lista', Array.isArray(list) && list.length > 0);
  (list || []).forEach(function (d) {
    ok(label + ' path-absoluto ' + d.path, /^\/documentos-ins\/[^\s]+\.pdf$/.test(d.path));
    var file = path.join(repo, d.path.replace(/^\//, ''));
    ok(label + ' archivo-existe ' + d.path, fs.existsSync(file));
    ok(label + ' nombre-ascii "' + d.name + '"', /^[\x20-\x7E]+\.pdf$/.test(d.name));
  });
}

checkList('cotizacion', STD.cotizacion);
checkList('poliza', STD.poliza);

// La cotización debe llevar el Deber de Información
ok('cotizacion-tiene-deber', STD.cotizacion.some(function (d) { return /deber/i.test(d.path); }));
// La póliza debe llevar las 5 condiciones estándar
ok('poliza-tiene-5', STD.poliza.length === 5);

console.log('\nstandard-docs: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
