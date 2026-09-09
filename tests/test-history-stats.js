/**
 * Test de la capa de estadísticas (history.js).
 *
 * Reescrito el 9 set 2026, cuando JC pidió simplificar el 📊: *"vamos a llevar
 * solo el conteo de las cotizadas y las concretadas se cuentan con el envío de
 * póliza activa, sino vamos a hacer una lista infinita de personas que ni
 * siquiera llegan a ser cliente"*.
 *
 * Lo que vigila:
 *   1. Que una cotización se cierre SOLA al enviarle la póliza activa, cruzando
 *      por placa — y que si el cliente nunca cotizó por la app igual cuente.
 *   2. Que la purga a los 90 días NUNCA se lleve una que llegó a póliza.
 *   3. Que lo purgado deje su conteo en el resumen, para que la conversión de
 *      los meses viejos no se desdibuje.
 *   4. Que un borrado NO vuelva desde el respaldo de Drive (lápidas).
 *
 * Ya no existen los estados que el agente marcaba a mano ni el seguimiento a
 * 3 días: historyEstado, setHistoryEstado, setHistoryConfirmed, historyCitaHoy,
 * historyNeedsFollowUp, historyFollowUpState, setHistoryFollowUp, dismissFollowUp.
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
function ok(v, msg) { if (!v) throw new Error(msg || 'esperaba verdadero'); }
function reset() {
  localStorage._d = {};
}
/** Fecha ISO de hace N días. */
function haceDias(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}
function sembrar(list) {
  reset();
  localStorage.setItem('cotizador_sdi_history_v1', JSON.stringify(list));
}

const DIA = 86400000;
const STATS_HIGH_THRESHOLD = 10000000;

// ============ computeHistoryStats ============
test('computeHistoryStats: lista vacía → rate null', () => {
  const s = computeHistoryStats([]);
  eq(s.total, 0); eq(s.conPoliza, 0); eq(s.rate, null);
});

test('computeHistoryStats: conversión = con póliza / cotizadas', () => {
  const s = computeHistoryStats([
    { id: '1', polizaAt: haceDias(1) },
    { id: '2' },
    { id: '3', polizaAt: haceDias(2) },
    { id: '4' }
  ]);
  eq(s.total, 4); eq(s.conPoliza, 2); eq(s.rate, 50);
});

test('computeHistoryStats: ninguna con póliza → 0%, no null', () => {
  eq(computeHistoryStats([{ id: '1' }, { id: '2' }]).rate, 0);
});

test('computeHistoryStats no rompe con entradas null', () => {
  const s = computeHistoryStats([null, { id: '1', polizaAt: 'x' }, undefined]);
  eq(s.total, 3); eq(s.conPoliza, 1);
});

test('computeHistoryStats: las lápidas NO se cuentan como cotizaciones', () => {
  const s = computeHistoryStats([
    { id: '1', polizaAt: 'x' },
    { id: '2', purged: true },
    { id: '3', purged: true }
  ]);
  eq(s.total, 1, 'una lápida no es una cotización');
  eq(s.conPoliza, 1);
});

test('computeHistoryStats: le suma el conteo de lo ya purgado', () => {
  // 2 vivas (1 con póliza) + 8 purgadas del pasado (3 con póliza) = 10 y 4.
  const s = computeHistoryStats(
    [{ id: '1', polizaAt: 'x' }, { id: '2' }],
    { cot: 8, pol: 3 }
  );
  eq(s.total, 10); eq(s.conPoliza, 4); eq(s.rate, 40);
});

// ============ historyEntryValue ============
test('historyEntryValue: campo valor formato PDF "10,000,000.00" → 10000000', () => {
  eq(historyEntryValue({ valor: '10,000,000.00' }), 10000000);
});
test('historyEntryValue: campo valor numérico directo', () => {
  eq(historyEntryValue({ valor: 12500000 }), 12500000);
});
test('historyEntryValue: entrada vieja sin valor → se recupera de va= del guideUrl', () => {
  eq(historyEntryValue({ guideUrl: 'https://x.test/explicacion/?c=Ana&va=18000000&p=BXY123' }), 18000000);
});
test('historyEntryValue: el campo valor tiene prioridad sobre el del link', () => {
  eq(historyEntryValue({ valor: '9,000,000.00', guideUrl: 'https://x.test/?va=18000000' }), 9000000);
});
test('historyEntryValue: sin valor ni va → 0', () => {
  eq(historyEntryValue({ guideUrl: 'https://x.test/?c=Ana' }), 0);
});
test('umbral alto valor: 9,9M no califica, 10M sí', () => {
  ok(historyEntryValue({ valor: 9900000 }) < STATS_HIGH_THRESHOLD);
  ok(historyEntryValue({ valor: 10000000 }) >= STATS_HIGH_THRESHOLD);
});

// ============ Agrupación por mes ============
test('groupHistoryByMonth: agrupa y ordena del más reciente al más viejo', () => {
  reset();
  const g = groupHistoryByMonth([
    { id: '1', date: '2026-07-10T10:00:00Z' },
    { id: '2', date: '2026-09-02T10:00:00Z' },
    { id: '3', date: '2026-07-22T10:00:00Z', polizaAt: 'x' }
  ]);
  eq(g.length, 2);
  eq(g[0].key, '2026-09');
  eq(g[1].key, '2026-07');
  eq(g[1].stats.total, 2);
  eq(g[1].stats.conPoliza, 1);
});

test('groupHistoryByMonth: entradas sin fecha caen en "sin-fecha"', () => {
  reset();
  const g = groupHistoryByMonth([{ id: '1' }]);
  eq(g[0].key, 'sin-fecha');
});

test('groupHistoryByMonth: un mes ya purgado del todo IGUAL aparece', () => {
  reset();
  localStorage.setItem('cotizador_sdi_resumen_v1', JSON.stringify({ '2026-05': { cot: 12, pol: 4 } }));
  const g = groupHistoryByMonth([{ id: '1', date: '2026-09-02T10:00:00Z' }]);
  const mayo = g.find(m => m.key === '2026-05');
  ok(mayo, 'el mes purgado desapareció de las barras');
  eq(mayo.stats.total, 12);
  eq(mayo.stats.conPoliza, 4);
});

// ============ Póliza emitida ============
test('historyTienePoliza: solo con polizaAt', () => {
  eq(historyTienePoliza({ polizaAt: '2026-09-09T10:00:00Z' }), true);
  eq(historyTienePoliza({}), false);
  eq(historyTienePoliza(null), false);
});

test('marcarPolizaEmitida cruza por placa y cierra ESA cotización', () => {
  sembrar([
    { id: 'a', date: haceDias(5), plate: 'BXY123', client: 'Ana' },
    { id: 'b', date: haceDias(6), plate: 'CXV002', client: 'Beto' }
  ]);
  const r = marcarPolizaEmitida({ plate: 'BXY123', poliza: '0101AUT123' });
  eq(r.marcada, true); eq(r.creada, false);
  const list = loadHistory();
  ok(historyTienePoliza(list.find(e => e.id === 'a')), 'no cerró la cotización de la placa');
  eq(historyTienePoliza(list.find(e => e.id === 'b')), false, 'cerró una que no era');
  eq(list.find(e => e.id === 'a').poliza, '0101AUT123');
});

test('marcarPolizaEmitida tolera guiones y minúsculas en la placa', () => {
  sembrar([{ id: 'a', date: haceDias(3), plate: 'BCS-123' }]);
  const r = marcarPolizaEmitida({ plate: 'bcs123' });
  eq(r.creada, false, 'no reconoció la misma placa escrita distinto');
  ok(historyTienePoliza(loadHistory()[0]));
});

test('marcarPolizaEmitida es idempotente: reenviar no cuenta dos veces', () => {
  sembrar([{ id: 'a', date: haceDias(3), plate: 'BXY123' }]);
  marcarPolizaEmitida({ plate: 'BXY123' });
  const primera = loadHistory()[0].polizaAt;
  marcarPolizaEmitida({ plate: 'BXY123' });
  const list = loadHistory();
  eq(list.length, 1, 'duplicó el registro');
  eq(list[0].polizaAt, primera, 'movió la fecha del cierre');
  eq(computeHistoryStats(list).conPoliza, 1);
});

test('marcarPolizaEmitida crea entrada si el cliente nunca cotizó por la app', () => {
  sembrar([{ id: 'a', date: haceDias(3), plate: 'BXY123' }]);
  const r = marcarPolizaEmitida({ plate: 'ZZZ999', clientFull: 'MORA CHACON DIEGO', email: 'd@x.test' });
  eq(r.creada, true);
  const list = loadHistory();
  eq(list.length, 2);
  eq(list[0].origen, 'poliza');
  ok(historyTienePoliza(list[0]));
  eq(computeHistoryStats(list).conPoliza, 1);
});

test('marcarPolizaEmitida sin placa: no cierra a ciegas la primera que encuentre', () => {
  sembrar([{ id: 'a', date: haceDias(3), plate: 'BXY123' }]);
  const r = marcarPolizaEmitida({ plate: '' });
  eq(r.creada, true, 'sin placa debe crear, nunca adivinar');
  eq(historyTienePoliza(loadHistory().find(e => e.id === 'a')), false);
});

// ============ Purga a los 90 días ============
test('purgarHistorial borra las SIN póliza de más de 90 días', () => {
  sembrar([
    { id: 'vieja', date: haceDias(120), plate: 'AAA111', client: 'Vieja' },
    { id: 'nueva', date: haceDias(10),  plate: 'BBB222', client: 'Nueva' }
  ]);
  const r = purgarHistorial();
  eq(r.purgadas, 1);
  const vivas = loadHistoryVivas();
  eq(vivas.length, 1);
  eq(vivas[0].id, 'nueva');
});

test('🔴 purgarHistorial NUNCA se lleva una que llegó a póliza', () => {
  sembrar([
    { id: 'cliente', date: haceDias(400), plate: 'AAA111', client: 'Cliente', polizaAt: haceDias(390) },
    { id: 'nadie',   date: haceDias(400), plate: 'BBB222', client: 'Nadie' }
  ]);
  const r = purgarHistorial();
  eq(r.purgadas, 1, 'purgó de más');
  const vivas = loadHistoryVivas();
  eq(vivas.length, 1);
  eq(vivas[0].id, 'cliente', 'se llevó al cliente real');
});

test('purgarHistorial respeta el límite exacto: 89 días se queda, 91 se va', () => {
  sembrar([
    { id: 'd89', date: haceDias(89), plate: 'AAA111' },
    { id: 'd91', date: haceDias(91), plate: 'BBB222' }
  ]);
  purgarHistorial();
  const vivas = loadHistoryVivas().map(e => e.id);
  ok(vivas.indexOf('d89') !== -1, 'se llevó una de 89 días');
  ok(vivas.indexOf('d91') === -1, 'dejó una de 91 días');
});

test('🔴 la lápida no conserva NINGÚN dato del cliente', () => {
  sembrar([{
    id: 'x', date: haceDias(200), plate: 'BXY123', client: 'Ana',
    clientFull: 'RAMIREZ SOTO ANA', email: 'ana@x.test', vehicle: 'Toyota',
    guideUrl: 'https://x.test/?c=Ana', valor: '10,000,000.00'
  }]);
  purgarHistorial();
  const lapida = loadHistory()[0];
  ok(esTombstone(lapida), 'no quedó lápida');
  const json = JSON.stringify(lapida);
  ['BXY123', 'Ana', 'RAMIREZ', 'ana@x.test', 'Toyota', 'guideUrl'].forEach(function (dato) {
    ok(json.indexOf(dato) === -1, 'la lápida todavía tiene: ' + dato);
  });
  eq(lapida.id, 'x', 'la lápida necesita el id para que el borrado se propague');
});

test('purgarHistorial deja el conteo del mes en el resumen', () => {
  const d = new Date(Date.now() - 200 * DIA);
  const clave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  sembrar([
    { id: '1', date: d.toISOString(), plate: 'AAA111' },
    { id: '2', date: d.toISOString(), plate: 'BBB222' }
  ]);
  purgarHistorial();
  eq(loadResumen()[clave].cot, 2);
});

test('purgar dos veces no cuenta doble ni revive nada', () => {
  sembrar([{ id: '1', date: haceDias(200), plate: 'AAA111' }]);
  purgarHistorial();
  const resumen1 = JSON.stringify(loadResumen());
  const r2 = purgarHistorial();
  eq(r2.purgadas, 0, 'volvió a purgar una lápida');
  eq(JSON.stringify(loadResumen()), resumen1, 'contó dos veces el mismo mes');
});

test('la conversión histórica se mantiene después de purgar', () => {
  // 4 cotizaciones viejas, 1 llegó a póliza = 25%.
  sembrar([
    { id: '1', date: haceDias(200), plate: 'A1', polizaAt: haceDias(190) },
    { id: '2', date: haceDias(200), plate: 'A2' },
    { id: '3', date: haceDias(200), plate: 'A3' },
    { id: '4', date: haceDias(200), plate: 'A4' }
  ]);
  const antes = computeHistoryStats(loadHistoryVivas());
  eq(antes.rate, 25);

  purgarHistorial();
  const res = loadResumen();
  const global = { cot: 0, pol: 0 };
  Object.keys(res).forEach(k => { global.cot += res[k].cot; global.pol += res[k].pol; });
  const despues = computeHistoryStats(loadHistoryVivas(), global);
  eq(despues.total, 4, 'se perdieron cotizaciones del histórico');
  eq(despues.conPoliza, 1);
  eq(despues.rate, 25, 'la conversión se distorsionó al purgar');
});

// ============ Lápidas y respaldo ============
test('loadHistoryVivas esconde las lápidas; loadHistory las conserva', () => {
  sembrar([{ id: '1', date: haceDias(1), plate: 'A1' }, { id: '2', date: haceDias(2), purged: true }]);
  eq(loadHistory().length, 2, 'el respaldo necesita las lápidas');
  eq(loadHistoryVivas().length, 1);
});

test('🔴 una cotización purgada NO vuelve al fusionar con el respaldo', () => {
  const lapida  = { id: 'x', date: haceDias(200), purged: true, updatedAt: new Date().toISOString() };
  const enDrive = { id: 'x', date: haceDias(200), plate: 'BXY123', client: 'Ana', updatedAt: haceDias(200) };
  const fus = mergeHistories([lapida], [enDrive], Infinity);
  eq(fus.length, 1);
  ok(esTombstone(fus[0]), 'el respaldo resucitó una cotización borrada');
  ok(JSON.stringify(fus[0]).indexOf('BXY123') === -1, 'volvieron los datos del cliente');
});

test('mergeResumenes se queda con el MAYOR de cada mes, no con la suma', () => {
  const a = { '2026-07': { cot: 40, pol: 9 }, '2026-08': { cot: 10, pol: 2 } };
  const b = { '2026-07': { cot: 48, pol: 10 } };
  const m = mergeResumenes(a, b);
  eq(m['2026-07'].cot, 48, 'sumar contaría doble el mismo mes desde dos equipos');
  eq(m['2026-07'].pol, 10);
  eq(m['2026-08'].cot, 10);
});

test('mergeResumenes tolera vacíos', () => {
  eq(JSON.stringify(mergeResumenes(null, undefined)), '{}');
  eq(mergeResumenes({ '2026-07': { cot: 3, pol: 1 } }, {})['2026-07'].cot, 3);
});

// ============ Utilidades que siguen ============
test('ensureHistoryIds asigna id a entradas viejas y persiste', () => {
  sembrar([{ date: haceDias(1), plate: 'A1' }, { date: haceDias(2), plate: 'A2' }]);
  const l = ensureHistoryIds();
  ok(l[0].id && l[1].id && l[0].id !== l[1].id);
  ok(JSON.parse(localStorage.getItem('cotizador_sdi_history_v1'))[0].id, 'no persistió');
});

test('deleteHistoryEntry elimina por id y persiste', () => {
  sembrar([{ id: 'a', date: haceDias(1) }, { id: 'b', date: haceDias(2) }]);
  eq(deleteHistoryEntry('a'), true);
  eq(loadHistory().length, 1);
  eq(loadHistory()[0].id, 'b');
});

test('deleteHistoryEntry con id inexistente o falsy → false', () => {
  sembrar([{ id: 'a', date: haceDias(1) }]);
  eq(deleteHistoryEntry('zzz'), false);
  eq(deleteHistoryEntry(''), false);
  eq(deleteHistoryEntry(undefined), false);
  eq(loadHistory().length, 1);
});

test('newHistoryId genera ids distintos', () => {
  ok(newHistoryId() !== newHistoryId());
});

test('historyDaysSince cuenta días transcurridos (floor)', () => {
  eq(historyDaysSince({ date: haceDias(4) }), 4);
  eq(historyDaysSince({ date: new Date().toISOString() }), 0);
});

test('historyDaysSince sin fecha → null', () => {
  eq(historyDaysSince({}), null);
});

// ============ WhatsApp ============
test('buildWaFollowUpUrl usa web.whatsapp.com/send/ (no wa.me)', () => {
  const u = buildWaFollowUpUrl({ client: 'Ana', waCliente: '88221348' });
  ok(u.indexOf('web.whatsapp.com/send/') !== -1);
  ok(u.indexOf('wa.me') === -1);
});

test('buildWaFollowUpUrl antepone 506 al teléfono', () => {
  ok(buildWaFollowUpUrl({ client: 'Ana', waCliente: '88221348' }).indexOf('phone=50688221348') !== -1);
});

test('buildWaFollowUpUrl sin teléfono: solo text=, sin phone=', () => {
  const u = buildWaFollowUpUrl({ client: 'Ana' });
  ok(u.indexOf('text=') !== -1);
  ok(u.indexOf('phone=') === -1);
});

// ============ Lo retirado no puede seguir existiendo ============
test('🔴 ya no existen los estados que se marcaban a mano', () => {
  ['historyEstado', 'setHistoryEstado', 'setHistoryConfirmed', 'historyCitaHoy',
   'historyNeedsFollowUp', 'historyFollowUpState', 'setHistoryFollowUp',
   'dismissFollowUp'].forEach(function (fn) {
    eq(typeof eval('typeof ' + fn + " !== 'undefined'"), 'boolean');
    ok(eval("typeof " + fn) === 'undefined', 'sigue existiendo: ' + fn);
  });
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
