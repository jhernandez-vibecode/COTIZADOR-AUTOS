/**
 * Test del buscador por placa / cliente (history.js): historyEntryPlate y
 * historyMatchesSearch. Búsqueda tolerante a tildes, mayúsculas y separadores.
 *
 * Run: node tests/test-history-search.js
 */

const path = require('path');
const fs = require('fs');

// history.js usa localStorage y console; polyfill mínimo para Node.
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
global.console = console;

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'history.js'), 'utf8');
eval(src);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'eq') + `: esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`);
}

// ---------- historyEntryPlate ----------

test('historyEntryPlate: usa e.plate cuando existe', () => {
  eq(historyEntryPlate({ plate: 'BCS123' }), 'BCS123');
});

test('historyEntryPlate: recorta espacios', () => {
  eq(historyEntryPlate({ plate: '  BJK456 ' }), 'BJK456');
});

test('historyEntryPlate: legacy sin plate → recupera del param p del guideUrl', () => {
  eq(historyEntryPlate({ guideUrl: 'https://x.test/explicacion/?c=Juan&p=CL999&va=10000000' }), 'CL999');
});

test('historyEntryPlate: param p URL-encoded se decodifica', () => {
  eq(historyEntryPlate({ guideUrl: 'https://x.test/?p=ABC%2D12' }), 'ABC-12');
});

test('historyEntryPlate: sin plate ni guideUrl → cadena vacía', () => {
  eq(historyEntryPlate({}), '');
  eq(historyEntryPlate(null), '');
});

// ---------- historyMatchesSearch ----------

test('historyMatchesSearch: query vacía → siempre coincide (no filtra)', () => {
  eq(historyMatchesSearch({ plate: 'BCS123' }, ''), true);
  eq(historyMatchesSearch({ plate: 'BCS123' }, '   '), true);
});

test('historyMatchesSearch: coincide por placa, ignora mayúsculas', () => {
  eq(historyMatchesSearch({ plate: 'BCS123' }, 'bcs'), true);
  eq(historyMatchesSearch({ plate: 'BCS123' }, 'BCS123'), true);
});

test('historyMatchesSearch: coincide por placa ignorando guiones (BCS-123 ≈ bcs123)', () => {
  eq(historyMatchesSearch({ plate: 'BCS-123' }, 'bcs123'), true);
  eq(historyMatchesSearch({ plate: 'BCS123' }, 'bcs-123'), true);
});

test('historyMatchesSearch: coincidencia parcial de placa', () => {
  eq(historyMatchesSearch({ plate: 'BCS123' }, '123'), true);
});

test('historyMatchesSearch: coincide por nombre del cliente, ignora tildes', () => {
  eq(historyMatchesSearch({ plate: 'X', client: 'Juan Hernández' }, 'hernandez'), true);
  eq(historyMatchesSearch({ plate: 'X', client: 'María Rodríguez' }, 'maria'), true);
});

test('historyMatchesSearch: coincide por vehículo', () => {
  eq(historyMatchesSearch({ plate: 'X', vehicle: 'Toyota Yaris 2020' }, 'yaris'), true);
});

test('historyMatchesSearch: no coincide → false', () => {
  eq(historyMatchesSearch({ plate: 'BCS123', client: 'Juan', vehicle: 'Toyota' }, 'zzz'), false);
});

test('historyMatchesSearch: legacy sin plate, encuentra por p del guideUrl', () => {
  eq(historyMatchesSearch({ guideUrl: 'https://x.test/?p=CL999' }, 'cl999'), true);
});

test('historyMatchesSearch: entrada null con query no vacía → false', () => {
  eq(historyMatchesSearch(null, 'algo'), false);
});

// ---------- Resumen ----------
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
