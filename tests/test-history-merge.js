/**
 * Test de la fusión/reemplazo del historial (history.js) que usa la
 * sincronización con Google Drive: mergeHistories + replaceHistory.
 *
 * Run: node tests/test-history-merge.js
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

function entry(o) {
  return Object.assign({
    id: 'q1', date: '2026-07-01T10:00:00.000Z', client: 'Ana', email: 'ana@x.com',
    plate: 'BCS123', vehicle: 'Kia', estado: 'pendiente'
  }, o);
}

// ---------- mergeHistories ----------

test('local VACÍO + Drive lleno → devuelve lo de Drive (restaurar tras limpiar)', () => {
  const drive = [entry({ id: 'a' }), entry({ id: 'b' })];
  const m = mergeHistories([], drive);
  eq(m.length, 2, 'cantidad');
});

test('Drive vacío + local lleno → conserva lo local (no borra nada)', () => {
  const local = [entry({ id: 'a' }), entry({ id: 'b' })];
  const m = mergeHistories(local, []);
  eq(m.length, 2, 'cantidad');
});

test('dedup por id: la misma cotización en ambos lados no se duplica', () => {
  const m = mergeHistories([entry({ id: 'a' })], [entry({ id: 'a' })]);
  eq(m.length, 1, 'no debe duplicar');
});

test('conflicto por id: gana el updatedAt más nuevo (estado más avanzado)', () => {
  const viejo  = entry({ id: 'a', estado: 'pendiente',  updatedAt: '2026-07-01T10:00:00.000Z' });
  const nuevo  = entry({ id: 'a', estado: 'concretada', updatedAt: '2026-07-05T10:00:00.000Z' });
  eq(mergeHistories([viejo], [nuevo])[0].estado, 'concretada', 'drive más nuevo gana');
  eq(mergeHistories([nuevo], [viejo])[0].estado, 'concretada', 'local más nuevo gana (orden inverso)');
});

test('unión de conjuntos disjuntos', () => {
  const m = mergeHistories([entry({ id: 'a' })], [entry({ id: 'b' }), entry({ id: 'c' })]);
  eq(m.length, 3, 'a + b + c');
});

test('orden: cotización de envío más reciente primero', () => {
  const vieja = entry({ id: 'a', date: '2026-06-01T10:00:00.000Z' });
  const nueva = entry({ id: 'b', date: '2026-07-10T10:00:00.000Z' });
  const m = mergeHistories([vieja], [nueva]);
  eq(m[0].id, 'b', 'primero la más reciente');
  eq(m[1].id, 'a', 'después la vieja');
});

test('entradas legacy SIN id: no se duplican si son la misma (firma date+placa+email+cliente)', () => {
  const a = { date: '2026-07-01T10:00:00.000Z', plate: 'BCS123', email: 'ana@x.com', client: 'Ana' };
  const m = mergeHistories([a], [Object.assign({}, a)]);
  eq(m.length, 1, 'misma firma → una sola');
});

test('tope HISTORY_MAX (100) se respeta al fusionar', () => {
  const big = [];
  for (let i = 0; i < 120; i++) big.push(entry({ id: 'x' + i, date: '2026-07-01T10:00:00.000Z' }));
  eq(mergeHistories(big, []).length, 100, 'recorta a 100');
});

test('robustez: argumentos no-array no rompen', () => {
  eq(mergeHistories(null, undefined).length, 0, 'vacío');
});

// ---------- replaceHistory + loadHistory ----------

test('replaceHistory guarda y loadHistory lo lee de vuelta', () => {
  replaceHistory([entry({ id: 'a' }), entry({ id: 'b' })]);
  eq(loadHistory().length, 2, 'persistió');
});

test('replaceHistory recorta a HISTORY_MAX', () => {
  const big = [];
  for (let i = 0; i < 130; i++) big.push(entry({ id: 'y' + i }));
  replaceHistory(big);
  eq(loadHistory().length, 100, 'guardó máximo 100');
});

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
