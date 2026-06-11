/**
 * Test de _parseDeducibleDFH (pdf-extract.js) — extraccion del monto
 * del deducible D,F,H desde las filas crudas de deducibles del PDF.
 *
 * Run: node tests/test-deducible-dfh.js
 */

const path = require('path');
const fs = require('fs');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'pdf-extract.js'),
  'utf8'
);
eval(src);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}
function assertEq(actual, expected) {
  if (actual !== expected) throw new Error(`expected "${expected}", got "${actual}"`);
}

test('fila D,F Y H con formato 400,000.00', () => {
  assertEq(_parseDeducibleDFH([
    'Cobertura C: 150,000.00 colones',
    'Cobertura D,F Y H: 400,000.00 colones'
  ]), 400000);
});

test('fila con simbolo de colon antepuesto', () => {
  assertEq(_parseDeducibleDFH(['Cobertura D,F Y H: ₡300,000.00']), 300000);
});

test('monto sin separador de miles (digitos corridos)', () => {
  assertEq(_parseDeducibleDFH(['Cobertura D,F Y H: 500000']), 500000);
});

test('sin fila D → null', () => {
  assertEq(_parseDeducibleDFH(['Cobertura C: 150,000.00']), null);
});

test('lista vacia / null → null', () => {
  assertEq(_parseDeducibleDFH([]), null);
  assertEq(_parseDeducibleDFH(null), null);
});

test('monto fuera de rango plausible → null', () => {
  assertEq(_parseDeducibleDFH(['Cobertura D,F Y H: 10.00']), null);
  assertEq(_parseDeducibleDFH(['Cobertura D,F Y H: 99,000,000.00']), null);
});

test('no confunde la fila de Cobertura C con la de D', () => {
  assertEq(_parseDeducibleDFH([
    'Cobertura C: 750,000.00',
    'Cobertura D,F Y H: 400,000.00'
  ]), 400000);
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
