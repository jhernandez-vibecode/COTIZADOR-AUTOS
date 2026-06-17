/**
 * Test de la capa de estadísticas (history.js): tasa de éxito, recuperación
 * del valor asegurado, agrupación por mes, confirmación y WhatsApp de seguimiento.
 *
 * Run: node tests/test-history-stats.js
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
function assertContains(h, n) { if (!h.includes(n)) throw new Error(`esperaba contener "${n}"`); }
function assertNotContains(h, n) { if (h.includes(n)) throw new Error(`NO debería contener "${n}"`); }

// ---------- computeHistoryStats ----------

test('computeHistoryStats: lista vacía → rate null (para mostrar "—")', () => {
  const s = computeHistoryStats([]);
  eq(s.total, 0, 'total'); eq(s.confirmed, 0, 'confirmed'); eq(s.rate, null, 'rate');
});

test('computeHistoryStats: 3 de 8 confirmadas → 37,5 %', () => {
  const arr = [];
  for (let i = 0; i < 8; i++) arr.push({ confirmed: i < 3 });
  const s = computeHistoryStats(arr);
  eq(s.total, 8, 'total'); eq(s.confirmed, 3, 'confirmed'); eq(s.rate, 37.5, 'rate');
});

test('computeHistoryStats: todas confirmadas → 100', () => {
  const s = computeHistoryStats([{ confirmed: true }, { confirmed: true }]);
  eq(s.rate, 100, 'rate');
});

test('computeHistoryStats: ninguna confirmada → 0 (no null)', () => {
  const s = computeHistoryStats([{ confirmed: false }, {}]);
  eq(s.rate, 0, 'rate');
});

test('computeHistoryStats no rompe con entradas null en el array', () => {
  const s = computeHistoryStats([null, { confirmed: true }, undefined]);
  eq(s.total, 3, 'total'); eq(s.confirmed, 1, 'confirmed');
});

// ---------- historyEntryValue ----------

test('historyEntryValue: campo valor formato PDF "10,000,000.00" → 10000000', () => {
  eq(historyEntryValue({ valor: '10,000,000.00' }), 10000000);
});

test('historyEntryValue: campo valor numérico directo', () => {
  eq(historyEntryValue({ valor: 14500000 }), 14500000);
});

test('historyEntryValue: entrada vieja sin valor → se recupera de va= del guideUrl', () => {
  const e = { guideUrl: 'https://x/explicacion/?c=Ana&va=22000000&sr=p' };
  eq(historyEntryValue(e), 22000000);
});

test('historyEntryValue: el campo valor tiene prioridad sobre el del link', () => {
  const e = { valor: '8,000,000.00', guideUrl: 'https://x/?va=22000000' };
  eq(historyEntryValue(e), 8000000);
});

test('historyEntryValue: sin valor ni va → 0', () => {
  eq(historyEntryValue({ guideUrl: 'https://x/?c=Ana' }), 0);
  eq(historyEntryValue({}), 0);
  eq(historyEntryValue(null), 0);
});

test('umbral alto valor: 9,9M no califica, 10M sí', () => {
  if (historyEntryValue({ valor: '9,900,000.00' }) >= 10000000) throw new Error('9,9M no debería calificar');
  if (historyEntryValue({ valor: '10,000,000.00' }) < 10000000) throw new Error('10M debería calificar');
});

// ---------- groupHistoryByMonth ----------

test('groupHistoryByMonth: agrupa por mes y ordena del más reciente al más viejo', () => {
  const arr = [
    { date: '2026-06-10T10:00:00Z', confirmed: true },
    { date: '2026-06-02T10:00:00Z', confirmed: false },
    { date: '2026-04-15T10:00:00Z', confirmed: true }
  ];
  const g = groupHistoryByMonth(arr);
  eq(g.length, 2, 'meses');
  eq(g[0].key, '2026-06', 'primer mes (más reciente)');
  eq(g[0].stats.total, 2, 'cotizaciones de junio');
  eq(g[0].stats.confirmed, 1, 'confirmadas de junio');
  eq(g[1].key, '2026-04', 'segundo mes');
});

test('groupHistoryByMonth: entradas sin fecha caen en grupo "sin-fecha"', () => {
  const g = groupHistoryByMonth([{ confirmed: true }, { date: '2026-06-01T10:00:00Z' }]);
  const sf = g.find(function (x) { return x.key === 'sin-fecha'; });
  if (!sf) throw new Error('debería existir grupo sin-fecha');
});

// ---------- ensureHistoryIds + setHistoryConfirmed ----------

test('ensureHistoryIds asigna id a entradas viejas y persiste', () => {
  localStorage._d = {};
  saveHistoryEntry({ client: 'A', date: '2026-06-01T10:00:00Z' });
  const arr = ensureHistoryIds();
  if (!arr[0].id) throw new Error('no asignó id');
  // persistió: una segunda carga ya trae el id
  if (loadHistory()[0].id !== arr[0].id) throw new Error('no persistió el id');
});

test('setHistoryConfirmed marca por id y persiste', () => {
  localStorage._d = {};
  saveHistoryEntry({ id: 'q1', client: 'B' });
  eq(setHistoryConfirmed('q1', true), true, 'devuelve true');
  eq(loadHistory()[0].confirmed, true, 'persistió confirmed');
  setHistoryConfirmed('q1', false);
  eq(loadHistory()[0].confirmed, false, 'se puede desmarcar');
});

test('setHistoryConfirmed con id inexistente → false', () => {
  localStorage._d = {};
  saveHistoryEntry({ id: 'q1', client: 'B' });
  eq(setHistoryConfirmed('NOPE', true), false);
});

test('deleteHistoryEntry elimina por id y persiste', () => {
  localStorage._d = {};
  saveHistoryEntry({ id: 'q2', client: 'B' });
  saveHistoryEntry({ id: 'q1', client: 'A' }); // unshift → [q1, q2]
  eq(deleteHistoryEntry('q1'), true);
  const arr = loadHistory();
  eq(arr.length, 1);
  eq(arr[0].id, 'q2');
});

test('deleteHistoryEntry con id inexistente → false, no toca el resto', () => {
  localStorage._d = {};
  saveHistoryEntry({ id: 'q1', client: 'A' });
  eq(deleteHistoryEntry('NOPE'), false);
  eq(loadHistory().length, 1);
});

test('newHistoryId genera ids distintos', () => {
  if (newHistoryId() === newHistoryId()) throw new Error('ids duplicados');
});

// ---------- historyDaysSince + historyNeedsFollowUp ----------

const NOW = new Date('2026-06-16T12:00:00Z').getTime();

test('historyDaysSince cuenta días transcurridos (floor)', () => {
  eq(historyDaysSince({ date: '2026-06-13T12:00:00Z' }, NOW), 3);
  eq(historyDaysSince({ date: '2026-06-16T12:00:00Z' }, NOW), 0);
  eq(historyDaysSince({ date: '2026-06-01T12:00:00Z' }, NOW), 15);
});
test('historyDaysSince sin fecha → null', () => {
  eq(historyDaysSince({}, NOW), null);
  eq(historyDaysSince(null, NOW), null);
});
test('historyNeedsFollowUp: 4d sin confirmar y vigente → true', () => {
  eq(historyNeedsFollowUp({ date: '2026-06-12T12:00:00Z', confirmed: false }, NOW), true);
});
test('historyNeedsFollowUp: 3d exactos → false (debe ser MÁS de 3)', () => {
  eq(historyNeedsFollowUp({ date: '2026-06-13T12:00:00Z', confirmed: false }, NOW), false);
});
test('historyNeedsFollowUp: confirmada → false aunque tenga +3d', () => {
  eq(historyNeedsFollowUp({ date: '2026-06-10T12:00:00Z', confirmed: true }, NOW), false);
});
test('historyNeedsFollowUp: vencida (≥15d) → false', () => {
  eq(historyNeedsFollowUp({ date: '2026-05-20T12:00:00Z', confirmed: false }, NOW), false);
});
test('historyNeedsFollowUp: 14d (aún vigente) sin confirmar → true', () => {
  eq(historyNeedsFollowUp({ date: '2026-06-02T12:00:00Z', confirmed: false }, NOW), true);
});

// ---------- buildWaFollowUpUrl ----------

const fu = { client: 'Silvia', vehicle: 'Sedan 2019', agentName: 'Juan Carlos' };

test('buildWaFollowUpUrl usa web.whatsapp.com/send/ (no wa.me)', () => {
  const url = buildWaFollowUpUrl(fu, '88221348');
  assertContains(url, 'https://web.whatsapp.com/send/?');
  assertNotContains(url, 'wa.me');
});

test('buildWaFollowUpUrl: mensaje de seguimiento (no de compartir guía)', () => {
  const url = buildWaFollowUpUrl(fu, '88221348');
  assertContains(url, encodeURIComponent('¿Tuvo chance de revisarla?'));
  assertContains(url, encodeURIComponent('Hola Silvia, le saluda Juan Carlos, su agente de seguros del INS.'));
});

test('buildWaFollowUpUrl antepone 506 al teléfono', () => {
  assertContains(buildWaFollowUpUrl(fu, '8822-1348'), 'phone=50688221348&');
});

test('buildWaFollowUpUrl sin teléfono: solo text=, sin phone=', () => {
  const url = buildWaFollowUpUrl(fu);
  assertContains(url, 'text=');
  assertNotContains(url, 'phone=');
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
