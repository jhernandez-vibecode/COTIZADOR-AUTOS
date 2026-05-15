// Test del builder de URL para /detalle/?...
// Run: node tests/test-coverage-url.js

const fs = require('fs');
const vm = require('vm');

// Cargar el modulo en sandbox
const code = fs.readFileSync(__dirname + '/../js/coverage-url.js', 'utf-8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const { buildDetalleUrl } = sandbox;

let pass = 0, fail = 0;
function assertEq(name, got, want) {
  const ok = got === want;
  console.log(ok ? `  OK  ${name}` : `  FAIL  ${name}\n     got:  ${got}\n     want: ${want}`);
  ok ? pass++ : fail++;
}

console.log('\n[buildDetalleUrl]');

// Test 1: URL basica con datos minimos, deducible combinado N en C + Fijo 400K
const u1 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent:  { name: 'Juan', license: '08-1318', website: 'segurosdelins.com', whatsapp: '8822-1348', email: 'j@x.com' },
  client: { name: 'Maria', email: 'm@y.com' },
  vehicle: { description: 'Yaris Sedan', plate: 'BRK454', year: 2019, valor: 10000000, electric: false },
  policy: { from: '2026-01-14', to: '2027-01-14', paymentForm: 't', lastPremium: 158423 },
  coverages: ['A','B','C','D','F','G','H','IDD','M','N'],
  customAmounts: {},
  iddAmount: 400000,
  repPlan: null,
  deductibles: ['nec', 'f400'],
});

assertEq('URL contains nombre cliente', u1.includes('c=Maria'), true);
assertEq('URL contains placa', u1.includes('p=BRK454'), true);
assertEq('URL contains cobs alfabetico con G/M separados', u1.includes('cobs=A_B_C_D_F_G_H_IDD_M_N'), true);
assertEq('URL deducibles combinados (nec + f400)', u1.includes('ded=nec_f400'), true);
assertEq('URL contains idd', u1.includes('idd=400000'), true);
assertEq('URL no incluye vt si NO electrico', !u1.includes('vt=e'), true);
assertEq('URL no incluye rep si null', !u1.includes('rep='), true);

// Test 2: con electrico, REP, custom amounts en A (persona y evento), deducible solo Fijo 300K
const u2 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent:  { name: 'Juan', license: '08-1318', website: '', whatsapp: '8822-1348', email: 'j@x.com' },
  client: { name: 'Pepe', email: 'p@y.com' },
  vehicle: { description: 'Tesla', plate: 'EV001', year: 2023, valor: 25000000, electric: true },
  policy: { from: '2026-03-01', to: '2027-03-01', paymentForm: 'a', lastPremium: 600000 },
  coverages: ['A','C','D','F','B','H','REP'],
  customAmounts: { aP: 200000000, aE: 500000000, B: 25000000 },
  iddAmount: null,
  repPlan: 'P',
  deductibles: ['f300'],
});

assertEq('URL incluye vt=e si electrico', u2.includes('vt=e'), true);
assertEq('URL incluye rep=P', u2.includes('rep=P'), true);
assertEq('URL incluye aP (A por persona)', u2.includes('aP=200000000'), true);
assertEq('URL incluye aE (A por evento)', u2.includes('aE=500000000'), true);
assertEq('URL incluye b15 (monto custom de B)', u2.includes('b15=25000000'), true);
assertEq('URL no incluye c100 si NO se edito', !u2.includes('c100='), true);
assertEq('URL deducible f300', u2.includes('ded=f300'), true);

// Test 3: WhatsApp normalization
const u3 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent: { name: 'X', license: '', website: '', whatsapp: '+506 8822-1348', email: '' },
  client: { name: 'Y', email: '' },
  vehicle: { description: '', plate: '', year: 0, valor: 0, electric: false },
  policy: { from: '', to: '', paymentForm: '', lastPremium: 0 },
  coverages: [],
  customAmounts: {}, iddAmount: null, repPlan: null, deductibles: [],
});
assertEq('WhatsApp se normaliza a solo digitos con 506', u3.includes('wa=50688221348'), true);

// Test 4: WhatsApp sin codigo pais se le agrega 506
const u4 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent: { name: 'X', license: '', website: '', whatsapp: '88221348', email: '' },
  client: { name: 'Y', email: '' },
  vehicle: { description: '', plate: '', year: 0, valor: 0, electric: false },
  policy: { from: '', to: '', paymentForm: '', lastPremium: 0 },
  coverages: [], customAmounts: {}, iddAmount: null, repPlan: null, deductibles: [],
});
assertEq('WhatsApp sin 506 se le agrega', u4.includes('wa=50688221348'), true);

// Test 5: deducible vacio no genera ded= en URL
const u5 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent: { name: 'X', license: '', website: '', whatsapp: '', email: '' },
  client: { name: 'Y', email: '' },
  vehicle: { description: '', plate: '', year: 0, valor: 0, electric: false },
  policy: { from: '', to: '', paymentForm: '', lastPremium: 0 },
  coverages: ['A'], customAmounts: {}, iddAmount: null, repPlan: null, deductibles: [],
});
assertEq('Deducible vacio no agrega ded= a URL', !u5.includes('ded='), true);

// Test 6: 3 deducibles combinados
const u6 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent: { name: 'X', license: '', website: '', whatsapp: '', email: '' },
  client: { name: 'Y', email: '' },
  vehicle: { description: '', plate: '', year: 0, valor: 0, electric: false },
  policy: { from: '', to: '', paymentForm: '', lastPremium: 0 },
  coverages: ['A'], customAmounts: {}, iddAmount: null, repPlan: null,
  deductibles: ['nec', 'f400', 'o150'],
});
assertEq('3 deducibles joined con _', u6.includes('ded=nec_f400_o150'), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
