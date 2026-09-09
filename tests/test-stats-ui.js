/**
 * Test del render del 📊 (js/stats-ui.js).
 *
 * Este archivo existe porque el módulo se separó de app.js el 9 set 2026: antes
 * el render vivía dentro de un archivo de 1400 líneas con seis responsabilidades
 * y no había forma de probarlo sin montar la app entera.
 *
 * Lo que vigila:
 *   1. 🔴 Que el botón de WhatsApp NO salga en una cotización ya cerrada: su
 *      mensaje es de seguimiento ("¿tuvo chance de revisarla?") y se le estaría
 *      preguntando eso a alguien que ya tiene la póliza emitida.
 *   2. Que los filtros y la búsqueda hagan lo que dicen.
 *   3. Que nada de lo que escribe el agente se cuele como HTML.
 *
 * Run: node tests/test-stats-ui.js
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'eq') + `: esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'esperaba verdadero'); }
function noContiene(html, txt, msg) {
  if (html.indexOf(txt) !== -1) throw new Error((msg || 'no debería contener') + ': ' + txt);
}

const DIA = 86400000;
const haceDias = n => new Date(Date.now() - n * DIA).toISOString();

// ---- Montar history.js + stats-ui.js en un contexto sin navegador ----
const store = {};
const g = {
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  console: console,
  CFG: { FROM_NAME: 'Agente de Prueba' },
  showToast: function () {}
};
const ctx = vm.createContext(g);
for (const f of ['js/history.js', 'js/stats-ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const M = g;

/** Fija los filtros activos del modulo (son vars del contexto, no export). */
function setEstado(mes, filtro, busq) {
  vm.runInContext(`_statsMonth = ${JSON.stringify(mes)}; _statsFilter = ${JSON.stringify(filtro)}; _statsSearch = ${JSON.stringify(busq)};`, ctx);
}

const CERRADA = { id: 'c1', date: haceDias(10), plate: 'BXY123', clientFull: 'RAMIREZ SOTO ANA',
                  vehicle: 'Toyota Hilux 2021', valor: '22,500,000.00', polizaAt: haceDias(2),
                  poliza: '0101AUT7788', client: 'Ana' };
const ABIERTA = { id: 'a1', date: haceDias(6), plate: 'CXV002', clientFull: 'MORA CHACON DIEGO',
                  vehicle: 'Hyundai Tucson 2019', valor: '11,800,000.00', client: 'Diego' };
const DIRECTA = { id: 'd1', date: haceDias(1), plate: 'NEW777', clientFull: 'LLEGO DIRECTO SIN COTIZAR',
                  vehicle: 'Mazda 3 2022', polizaAt: haceDias(1), origen: 'poliza', client: 'Direc' };

// ===== 1. El botón de WhatsApp =====
console.log('\n-- el 💬 y a quién se le escribe --');

test('🔴 una cotización YA CERRADA no ofrece el WhatsApp de seguimiento', () => {
  const html = M._statsListHtml([CERRADA]);
  ok(html.indexOf('✓ Póliza emitida') !== -1, 'no es la fila esperada');
  noContiene(html, 'web.whatsapp.com',
    'le ofrece mandarle "¿tuvo chance de revisarla?" a un cliente que ya compró');
});

test('una cotización sin póliza sí lo ofrece', () => {
  const html = M._statsListHtml([ABIERTA]);
  ok(html.indexOf('web.whatsapp.com') !== -1, 'se perdió el seguimiento de las abiertas');
});

test('el 🗑 sigue en las dos', () => {
  ok(M._statsListHtml([CERRADA]).indexOf('data-del="c1"') !== -1);
  ok(M._statsListHtml([ABIERTA]).indexOf('data-del="a1"') !== -1);
});

// ===== 2. Lo que muestra la fila =====
console.log('\n-- la fila --');

test('la fila cerrada muestra el número de póliza', () => {
  ok(M._statsListHtml([CERRADA]).indexOf('0101AUT7788') !== -1,
     'el número de póliza se guardaba y no se mostraba en ninguna parte');
});

test('🔴 un cliente que llegó directo se marca como tal', () => {
  const html = M._statsListHtml([DIRECTA]);
  ok(html.indexOf('sin cotización previa') !== -1,
     'su fecha se lee como si hubiera cotizado ese día');
});

test('una cotización normal NO dice "sin cotización previa"', () => {
  noContiene(M._statsListHtml([ABIERTA]), 'sin cotización previa');
});

test('la estrella de alto valor sale solo sobre el umbral', () => {
  ok(M._statsListHtml([CERRADA]).indexOf('⭐') !== -1, '22,5M debería llevar estrella');
  const bajo = Object.assign({}, ABIERTA, { valor: '4,000,000.00' });
  noContiene(M._statsListHtml([bajo]), '⭐');
});

test('la fila abierta muestra los días transcurridos', () => {
  ok(/Sin p&oacute;liza|Sin póliza/.test(M._statsListHtml([ABIERTA])));
  ok(M._statsListHtml([ABIERTA]).indexOf('6 d') !== -1);
});

test('lista vacía da un mensaje, no una tabla rota', () => {
  ok(M._statsListHtml([]).indexOf('history-empty') !== -1);
});

// ===== 3. XSS =====
console.log('\n-- nada se cuela como HTML --');

test('🔴 el nombre del cliente se escapa', () => {
  const malo = Object.assign({}, ABIERTA, { clientFull: '<img src=x onerror=alert(1)>' });
  const html = M._statsListHtml([malo]);
  noContiene(html, '<img src=x', 'inyección por el nombre');
  ok(html.indexOf('&lt;img') !== -1, 'no se escapó');
});

test('el vehículo y la placa también se escapan', () => {
  const malo = Object.assign({}, ABIERTA, { vehicle: '<b>x</b>', plate: '<script>y</script>' });
  const html = M._statsListHtml([malo]);
  noContiene(html, '<b>x</b>');
  noContiene(html, '<script>y');
});

test('el número de póliza se escapa', () => {
  const malo = Object.assign({}, CERRADA, { poliza: '"><b>z</b>' });
  noContiene(M._statsListHtml([malo]), '<b>z</b>');
});

// ===== 4. Filtros y búsqueda =====
console.log('\n-- filtros --');
const TODAS = [CERRADA, ABIERTA, DIRECTA];

test('sin filtro salen todas', () => {
  setEstado(null, 'all', '');
  eq(M._applyStatsFilters(TODAS).length, 3);
});

test('el chip "con póliza" deja solo las cerradas', () => {
  setEstado(null, 'poliza', '');
  const r = M._applyStatsFilters(TODAS);
  eq(r.length, 2);
  ok(r.every(e => e.polizaAt), 'coló una sin póliza');
});

test('el chip de alto valor usa el umbral de ₡10M', () => {
  setEstado(null, 'high', '');
  const r = M._applyStatsFilters(TODAS);
  eq(r.length, 2, '22,5M y 11,8M superan el umbral; el directo no trae valor');
});

test('la búsqueda encuentra por apellido', () => {
  setEstado(null, 'all', 'chacon');
  const r = M._applyStatsFilters(TODAS);
  eq(r.length, 1);
  eq(r[0].id, 'a1');
});

test('la búsqueda encuentra por placa con guion', () => {
  setEstado(null, 'all', 'bxy-123');
  eq(M._applyStatsFilters(TODAS).length, 1);
});

test('filtro y búsqueda se combinan (AND)', () => {
  setEstado(null, 'poliza', 'chacon');   // Diego no tiene póliza
  eq(M._applyStatsFilters(TODAS).length, 0);
  setEstado(null, 'all', '');
});

// ===== 5. KPIs y meses =====
console.log('\n-- KPIs y barras --');

test('los KPIs muestran cotizadas y con póliza', () => {
  const html = M._statsKpisHtml({ total: 7, conPoliza: 4, rate: 57.1 });
  ok(html.indexOf('>7<') !== -1);
  ok(html.indexOf('>4<') !== -1);
  ok(html.indexOf('Cotizadas') !== -1 && html.indexOf('Con p&oacute;liza emitida') !== -1 ||
     html.indexOf('Con póliza emitida') !== -1);
});

test('sin meses se avisa, no se pinta una barra vacía', () => {
  ok(M._statsMonthsHtml([]).indexOf('history-empty') !== -1);
});

test('cada mes lleva su barra de pólizas encima de la de cotizadas', () => {
  const html = M._statsMonthsHtml([
    { key: '2026-09', label: 'sept 2026', entries: [], stats: { total: 4, conPoliza: 1, rate: 25 } }
  ]);
  ok(html.indexOf('stats-month-bar pol') !== -1, 'falta la barra de pólizas');
  ok(html.indexOf('1 con p') !== -1);
});

test('_fmtMillones abrevia en millones con coma decimal', () => {
  eq(M._fmtMillones(22500000), '₡22,5M');
  eq(M._fmtMillones(0), '');
});

console.log(`\nstats-ui: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
