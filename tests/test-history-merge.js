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

// `const` declarado dentro de un eval directo NO se filtra a este scope (las
// `function` sí), así que el tope se lee del fuente. De paso, el test mira el
// valor REAL del archivo y no una copia que podría quedar desactualizada.
const HISTORY_MAX = Number((src.match(/const HISTORY_MAX = (\d+)/) || [])[1]);
if (!HISTORY_MAX) { console.error('✗ no se pudo leer HISTORY_MAX de history.js'); process.exit(1); }

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

test('tope HISTORY_MAX por defecto se respeta al fusionar', () => {
  const big = [];
  for (let i = 0; i < HISTORY_MAX + 20; i++) big.push(entry({ id: 'x' + i, date: '2026-07-01T10:00:00.000Z' }));
  eq(mergeHistories(big, []).length, HISTORY_MAX, 'recorta al tope del navegador');
});

// 🔴 EL TEST QUE FALTABA EN AGOSTO 2026. Sin él, nada impedía que el respaldo
// subiera a Drive la lista ya recortada del navegador: así se borró julio.
test('mergeHistories con Infinity NO recorta (es lo que va a Drive)', () => {
  const big = [];
  for (let i = 0; i < HISTORY_MAX + 350; i++) big.push(entry({ id: 'z' + i, date: '2026-07-01T10:00:00.000Z' }));
  eq(mergeHistories(big, [], Infinity).length, HISTORY_MAX + 350, 'conserva todo');
});

test('el respaldo conserva lo que el navegador ya soltó (caso julio 2026)', () => {
  // Drive tiene julio; el navegador ya lo perdió por el tope y solo tiene agosto.
  const julio  = [];
  const agosto = [];
  for (let i = 0; i < 40; i++)  julio.push(entry({ id: 'jul' + i, date: '2026-07-15T10:00:00.000Z' }));
  for (let i = 0; i < HISTORY_MAX; i++) agosto.push(entry({ id: 'ago' + i, date: '2026-08-15T10:00:00.000Z' }));

  const aDrive = mergeHistories(agosto, julio, Infinity);   // lo que sube driveBackup
  eq(aDrive.length, HISTORY_MAX + 40, 'Drive acumula agosto + julio');
  eq(aDrive.some(e => e.id === 'jul0'), true, 'julio sigue en el respaldo');

  // Y con el tope del navegador (lo viejo se ve en Drive, no acá) julio no se sube recortado.
  const aLocal = mergeHistories(agosto, julio);
  eq(aLocal.length, HISTORY_MAX, 'el navegador sí recorta');
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
  for (let i = 0; i < HISTORY_MAX + 30; i++) big.push(entry({ id: 'y' + i }));
  replaceHistory(big);
  eq(loadHistory().length, HISTORY_MAX, 'guardó máximo HISTORY_MAX');
});

test('replaceHistory con Infinity guarda todo (restauración desde Drive)', () => {
  const big = [];
  for (let i = 0; i < HISTORY_MAX + 30; i++) big.push(entry({ id: 'w' + i }));
  replaceHistory(big, Infinity);
  eq(loadHistory().length, HISTORY_MAX + 30, 'sin recorte');
});

test('el tope del navegador es holgado (>=2000): 100 fue lo que borró julio', () => {
  if (HISTORY_MAX < 2000) throw new Error('HISTORY_MAX bajó a ' + HISTORY_MAX);
  eq(true, true, 'tope holgado');
});

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
