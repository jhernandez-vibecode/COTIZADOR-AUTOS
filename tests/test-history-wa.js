/**
 * Test de buildWaShareUrl (history.js) — link de WhatsApp con/sin teléfono.
 *
 * Run: node tests/test-history-wa.js
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
function assertContains(h, n) { if (!h.includes(n)) throw new Error(`esperaba contener "${n}" en "${h}"`); }
function assertNotContains(h, n) { if (h.includes(n)) throw new Error(`NO debería contener "${n}"`); }

const entry = {
  client: 'Silvia', vehicle: 'Sedan 2019', plate: 'BRK454',
  guideUrl: 'https://cotizador.appsegurosdigitales.com/explicacion/?c=Silvia'
};

test('siempre usa web.whatsapp.com/send/ (no wa.me)', () => {
  const url = buildWaShareUrl(entry);
  assertContains(url, 'https://web.whatsapp.com/send/?');
  assertNotContains(url, 'wa.me');
});

test('sin telefono: solo text=, sin phone=', () => {
  const url = buildWaShareUrl(entry);
  assertContains(url, 'text=');
  assertNotContains(url, 'phone=');
});

test('con telefono de 8 digitos: antepone 506', () => {
  const url = buildWaShareUrl(entry, '8822-1348');
  assertContains(url, 'phone=50688221348&');
});

test('telefono que ya trae 506 no se duplica', () => {
  const url = buildWaShareUrl(entry, '50688221348');
  assertContains(url, 'phone=50688221348&');
  assertNotContains(url, 'phone=50650688221348');
});

test('phoneOverride pisa entry.waCliente', () => {
  const url = buildWaShareUrl({ ...entry, waCliente: '70000000' }, '8888-8888');
  assertContains(url, 'phone=50688888888&');
  assertNotContains(url, '70000000');
});

test('entry.waCliente se usa si no hay override', () => {
  const url = buildWaShareUrl({ ...entry, waCliente: '8888-8888' });
  assertContains(url, 'phone=50688888888&');
});

test('mensaje incluye cliente, vehiculo, placa y link (encodeado)', () => {
  const url = buildWaShareUrl(entry, '88221348');
  assertContains(url, encodeURIComponent('Hola Silvia'));
  assertContains(url, encodeURIComponent('Sedan 2019'));
  assertContains(url, encodeURIComponent('BRK454'));
  assertContains(url, encodeURIComponent(entry.guideUrl));
});

test('saludo nuevo: "te escribe [agente], agente de seguros del INS"', () => {
  const url = buildWaShareUrl({ ...entry, agentName: 'Juan Carlos Hernández' }, '88221348');
  assertContains(url, encodeURIComponent('Hola Silvia, te escribe Juan Carlos Hernández, agente de seguros del INS.'));
  assertContains(url, encodeURIComponent('Te acabo de enviar por correo la cotización'));
});

test('link va embebido en la frase (texto antes y despues)', () => {
  const dec = decodeURIComponent(buildWaShareUrl(entry, '88221348'));
  const i = dec.indexOf(entry.guideUrl);
  if (i <= 0) throw new Error('el link debe tener texto antes');
  const tail = dec.slice(i + entry.guideUrl.length);
  if (!tail.includes('quedo a la orden')) throw new Error('el link debe tener texto después');
});

test('sin agentName ni CFG: cae a "tu agente de seguros del INS"', () => {
  const url = buildWaShareUrl(entry, '88221348');
  assertContains(url, encodeURIComponent('te escribe tu agente de seguros del INS.'));
});

test('setLatestHistoryWa guarda waCliente en la entrada mas reciente', () => {
  localStorage._d = {};
  saveHistoryEntry({ client: 'A', guideUrl: 'x' });
  setLatestHistoryWa('8822-1348');
  const arr = loadHistory();
  if (arr[0].waCliente !== '8822-1348') throw new Error('no guardó waCliente');
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
