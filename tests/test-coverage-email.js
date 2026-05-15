// Test del builder del correo "Detalle de coberturas vigentes"
// Run: node tests/test-coverage-email.js

const fs = require('fs');
const vm = require('vm');

// Cargar config + email-template en sandbox
const cfgCode  = fs.readFileSync(__dirname + '/../js/config.js', 'utf-8');
const tmplCode = fs.readFileSync(__dirname + '/../js/email-template.js', 'utf-8');

// vm.runInContext no expone `const` top-level como propiedades del sandbox.
// Truco: convertir el `const CFG = {...}` en una asignacion explicita al sandbox
// concatenando una linea final que lo expone como propiedad.
const cfgWrapped  = cfgCode  + '\nthis.CFG = CFG;';
const tmplWrapped = tmplCode + '\nthis.buildCoverageEmail = buildCoverageEmail;';

const sandbox = { console, window: {}, document: { getElementById: () => null } };
vm.createContext(sandbox);
vm.runInContext(cfgWrapped, sandbox);
vm.runInContext(tmplWrapped, sandbox);
const { buildCoverageEmail, CFG } = sandbox;

let pass = 0, fail = 0;
function assertContains(name, hay, needle) {
  const ok = hay.indexOf(needle) !== -1;
  console.log(ok ? `  OK  ${name}` : `  FAIL  ${name}\n     no contiene: ${needle}`);
  ok ? pass++ : fail++;
}

console.log('\n[buildCoverageEmail]');

const html = buildCoverageEmail({
  clientName: 'Maria Rodriguez',
  vehicle: 'Toyota Yaris Sedan',
  plate: 'BRK454',
  detalleUrl: 'https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/?n=Juan&c=Maria',
});

assertContains('Saludo al cliente', html, 'Hola Maria Rodriguez');
assertContains('Vehiculo aparece', html, 'Toyota Yaris Sedan');
assertContains('Placa aparece', html, 'BRK454');
assertContains('Boton con URL', html, 'href="https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/?n=Juan&c=Maria"');
assertContains('Texto del boton', html, 'VER DETALLE DE MIS COBERTURAS');
assertContains('Leyenda condiciones generales', html, 'condiciones generales');
assertContains('Logo INS en header', html, 'ins-logo.png');
assertContains('Footer con nombre del agente (CFG.FROM_NAME)', html, CFG.FROM_NAME);

// Test escape HTML — clientName con caracteres especiales
const html2 = buildCoverageEmail({
  clientName: 'O\'Reilly & <script>',
  vehicle: 'Test',
  plate: 'XXX',
  detalleUrl: 'https://x.com/',
});
assertContains('Escape HTML del nombre cliente', html2, '&amp;');
assertContains('Escape HTML del < tag', html2, '&lt;script&gt;');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
