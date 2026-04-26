/**
 * Test del builder de URL del explicador.
 * Pure function tests con Node — sigue el patrón de pdf-test/.
 *
 * Run: node tests/test-explicador-url.js
 */

const path = require('path');
const fs = require('fs');

// Carga email-template.js como texto, lo evalúa en este contexto
// para acceder a _buildGuideUrl. Definimos un CFG mínimo primero.
global.CFG = {
  GUIDE_URL: 'https://example.com/explicacion/',
  FROM_NAME: 'Juan Carlos Hernandez Vargas',
  LICENSE: '08-1318',
  WEBSITE: 'www.segurosdelins.com'
};

const src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'email-template.js'),
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
function assertContains(haystack, needle) {
  if (!haystack.includes(needle)) throw new Error(`expected to contain "${needle}", got "${haystack}"`);
}

// ===== Tests =====

test('agente solo (backward compat: 3 params)', () => {
  const url = _buildGuideUrl();
  assertContains(url, 'n=Juan%20Carlos%20Hernandez%20Vargas');
  assertContains(url, 'l=08-1318');
  assertContains(url, 'w=www.segurosdelins.com');
});

test('agente + cliente full (11 params)', () => {
  const url = _buildGuideUrl({
    clientName: 'Silvia Mariel',
    vehicle: 'Sedan 2019',
    plate: 'BRK454',
    year: '2019',
    vehicleType: 'g',
    valor: '10000000',
    sustReposCode: 'p',
    prices: { anual: '570891', semestral: '308283', trimestral: '158423' }
  });
  assertContains(url, 'c=Silvia%20Mariel');
  assertContains(url, 'v=Sedan%202019');
  assertContains(url, 'p=BRK454');
  assertContains(url, 'y=2019');
  assertContains(url, 'vt=g');
  assertContains(url, 'va=10000000');
  assertContains(url, 'sr=p');
  assertContains(url, 'pa=570891');
  assertContains(url, 'ps=308283');
  assertContains(url, 'pt=158423');
});

test('cliente con tildes encodea bien', () => {
  const url = _buildGuideUrl({ clientName: 'María José' });
  assertContains(url, 'c=Mar%C3%ADa%20Jos%C3%A9');
});

test('extras vacíos NO aparecen en el URL', () => {
  const url = _buildGuideUrl({ clientName: '', vehicle: null });
  if (url.includes('c=') && url.indexOf('c=') > url.indexOf('w=')) {
    throw new Error('clientName vacío no debería agregar c=');
  }
});

test('separador correcto si GUIDE_URL ya tiene ?', () => {
  global.CFG.GUIDE_URL = 'https://example.com/explicacion/?foo=bar';
  const url = _buildGuideUrl({ clientName: 'X' });
  assertContains(url, '?foo=bar&n=');
  assertContains(url, '&c=X');
  global.CFG.GUIDE_URL = 'https://example.com/explicacion/'; // restore
});

test('sustReposToCode mapea Plus correctamente', () => {
  assertEq(_sustReposToCode('Extension de garantia Plus'), 'p');
  assertEq(_sustReposToCode('extensión de Garantía PLUS'), 'p');
});
test('sustReposToCode mapea Garantía simple', () => {
  assertEq(_sustReposToCode('Extension de garantia'), 'g');
});
test('sustReposToCode mapea Repuesto Original sin extensión', () => {
  assertEq(_sustReposToCode('repuesto original'), '0');
});
test('sustReposToCode mapea Repuesto Alternativo', () => {
  assertEq(_sustReposToCode('repuesto alternativo'), 'n');
});
test('sustReposToCode default a "n" si vacío', () => {
  assertEq(_sustReposToCode(''), 'n');
  assertEq(_sustReposToCode(null), 'n');
});

test('valor y precios con formato CR ("10,000,000.00") se normalizan a "10000000"', () => {
  // Reproduce el formato real que devuelve pdf-extract.js
  const url = _buildGuideUrl({
    valor: '10,000,000.00',
    prices: { anual: '570,891.00', semestral: '308,283.00', trimestral: '158,423.00' }
  });
  assertContains(url, 'va=10000000');
  assertContains(url, 'pa=570891');
  assertContains(url, 'ps=308283');
  assertContains(url, 'pt=158423');
  // Verifica que NO queden las comas escapadas (%2C) ni el .00
  if (url.includes('%2C')) throw new Error('No deberian quedar comas escapadas en el URL');
  if (url.includes('.00')) throw new Error('No deberian quedar decimales .00');
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
