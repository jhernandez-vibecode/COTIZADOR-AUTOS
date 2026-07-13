/**
 * Test de _parsePaymentMatrix (pdf-extract.js) — parseo de la tabla
 * "FORMA DE PAGO" del INS que cambio (jul 2026) de UNA columna a una MATRIZ
 * de 5 columnas por tipo de repuesto. Verifica que se elige la columna
 * correcta segun "Sustitucion de repuestos" y que los montos son los reales.
 *
 * El fixture ITEMS son los items REALES de la pagina 2 del PDF
 * COTIZACION-001111 (form _017_170_118450, repuesto "Extension de garantia
 * Plus"), convertidos al sistema de coordenadas de PDF.js (x izquierdo,
 * y baseline bottom-up, w ancho del run).
 *
 * Run: node tests/test-payment-matrix.js
 */

const path = require('path');
const {
  _parsePaymentMatrix, selectPriceColumn, pricesForColumn,
  priceColumnConfident, _groupByY, _labelMatch, _reposFixedIndex
} = require(path.join(__dirname, '..', 'js', 'pdf-extract.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg ? msg + ': ' : '') + `expected "${expected}", got "${actual}"`);
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// --- Fixture real: pagina 2 de COTIZACION-001111 en coords PDF.js ---
var ITEMS = [{"t": "N", "x": 122.2, "y": 744.2, "w": 6.2}, {"t": "Exención deducible ", "x": 267.8, "y": 744.2, "w": 76.0}, {"t": "Coberturas ", "x": 283.5, "y": 732.2, "w": 44.6}, {"t": " C ", "x": 304.6, "y": 720.3, "w": 11.1}, {"t": "14,213.00", "x": 471.7, "y": 744.2, "w": 38.4}, {"t": "IDD", "x": 117.8, "y": 699.2, "w": 14.4}, {"t": "Indemnización del deducible ", "x": 251.6, "y": 699.2, "w": 108.5}, {"t": "Monto cubierto: 400,000.00", "x": 254.0, "y": 687.3, "w": 103.4}, {"t": "29,423.00", "x": 471.7, "y": 699.2, "w": 38.4}, {"t": "CÓDIGO", "x": 103.5, "y": 764.1, "w": 35.3}, {"t": "DESCRIPCIÓN", "x": 275.1, "y": 764.1, "w": 61.3}, {"t": "PRIMA", "x": 477.1, "y": 764.1, "w": 28.3}, {"t": "Detalle de Deduciles", "x": 264.0, "y": 636.3, "w": 84.1}, {"t": "DESCRIPCIÓN", "x": 275.4, "y": 621.7, "w": 61.3}, {"t": "Cobertura C: Deducible Ordinario del 20% - ¢150,000 o $250", "x": 190.1, "y": 602.3, "w": 231.7}, {"t": "Cobertura D,F Y H: Deducible fijo - ¢400,000 o $670", "x": 207.5, "y": 581.2, "w": 197.0}, {"t": "Observaciones: ", "x": 28.5, "y": 547.1, "w": 61.4}, {"t": "FORMA DE PAGO", "x": 38.0, "y": 515.5, "w": 73.7}, {"t": "VEHÍCULO EN", "x": 136.8, "y": 521.5, "w": 60.2}, {"t": "GARANTÍA", "x": 144.4, "y": 509.6, "w": 45.6}, {"t": "ORIGINAL", "x": 238.6, "y": 515.5, "w": 41.9}, {"t": "EXTENSIÓN", "x": 326.6, "y": 521.5, "w": 51.0}, {"t": "GARANTÍA", "x": 329.6, "y": 509.6, "w": 45.6}, {"t": "EXTENSIÓN", "x": 419.2, "y": 521.5, "w": 51.0}, {"t": "GARANTÍA PLUS", "x": 409.1, "y": 509.6, "w": 71.1}, {"t": "ALTERNATIVO /", "x": 504.2, "y": 527.5, "w": 66.4}, {"t": "GENÉRICO /", "x": 511.8, "y": 515.5, "w": 51.3}, {"t": "USADOS", "x": 518.5, "y": 503.6, "w": 37.5}, {"t": "Mensual", "x": 58.8, "y": 484.3, "w": 31.7}, {"t": "36,085.00", "x": 147.6, "y": 484.3, "w": 38.4}, {"t": "35,005.00", "x": 240.2, "y": 484.3, "w": 38.4}, {"t": "36,085.00", "x": 332.8, "y": 484.3, "w": 38.4}, {"t": "37,909.00", "x": 425.4, "y": 484.3, "w": 38.4}, {"t": "36,085.00", "x": 518.0, "y": 484.3, "w": 38.4}, {"t": "Trimestral", "x": 55.8, "y": 463.1, "w": 37.7}, {"t": "106,384.00", "x": 145.2, "y": 463.1, "w": 43.3}, {"t": "103,197.00", "x": 237.8, "y": 463.1, "w": 43.3}, {"t": "106,384.00", "x": 330.4, "y": 463.1, "w": 43.3}, {"t": "111,757.00", "x": 423.0, "y": 463.1, "w": 43.3}, {"t": "106,384.00", "x": 515.5, "y": 463.1, "w": 43.3}, {"t": "Semestral", "x": 55.3, "y": 442.0, "w": 38.7}, {"t": "207,017.00", "x": 145.2, "y": 442.0, "w": 43.3}, {"t": "200,816.00", "x": 237.8, "y": 442.0, "w": 43.3}, {"t": "207,017.00", "x": 330.4, "y": 442.0, "w": 43.3}, {"t": "217,473.00", "x": 423.0, "y": 442.4, "w": 43.5}, {"t": "207,017.00", "x": 515.5, "y": 442.0, "w": 43.3}, {"t": "Anual", "x": 64.0, "y": 420.9, "w": 21.4}, {"t": "383,365.00", "x": 145.2, "y": 420.9, "w": 43.3}, {"t": "371,880.00", "x": 237.8, "y": 420.9, "w": 43.3}, {"t": "383,365.00", "x": 330.4, "y": 420.9, "w": 43.3}, {"t": "402,726.00", "x": 423.0, "y": 420.9, "w": 43.3}, {"t": "383,365.00", "x": 515.5, "y": 420.9, "w": 43.3}, {"t": "Deducción Mensual", "x": 37.4, "y": 399.8, "w": 74.5}, {"t": "34,489.00", "x": 147.6, "y": 399.8, "w": 38.4}, {"t": "33,456.00", "x": 240.2, "y": 399.8, "w": 38.4}, {"t": "34,489.00", "x": 332.8, "y": 399.8, "w": 38.4}, {"t": "36,231.00", "x": 425.4, "y": 399.8, "w": 38.4}, {"t": "34,489.00", "x": 518.0, "y": 399.8, "w": 38.4}, {"t": "Este documento solo constituye una cotización de seguro.", "x": 28.7, "y": 371.1, "w": 556.2}];

function matrixFor(sustRepos) {
  const rows = _groupByY(ITEMS.slice(), 2);
  return _parsePaymentMatrix(rows, sustRepos);
}

// ---- Caso principal: el repuesto real del PDF ----
test('Extension de garantia Plus -> columna 3 con TODOS sus montos', () => {
  const m = matrixFor('Extensión de garantía Plus');
  assert(m, 'la matriz no debe ser null');
  assertEq(m.selectedIndex, 3, 'indice');
  assertEq(m.prices.mensual,    '37,909.00',  'mensual');
  assertEq(m.prices.trimestral, '111,757.00', 'trimestral');
  assertEq(m.prices.semestral,  '217,473.00', 'semestral');
  assertEq(m.prices.anual,      '402,726.00', 'anual');
  assertEq(m.prices.deduccion,  '36,231.00',  'deduccion');
  assertEq(m.confident, true, 'confident');
  assert(/plus/.test(m.selectedLabel), 'la etiqueta elegida debe contener "plus": ' + m.selectedLabel);
});

test('NO agarra la primera columna (bug del parser viejo)', () => {
  const m = matrixFor('Extensión de garantía Plus');
  assert(m.prices.anual !== '383,365.00', 'no debe ser el Anual de "Vehiculo en garantia" (col 0)');
});

// ---- Las otras 4 columnas ----
test('Extension de garantia (sin Plus) -> columna 2', () => {
  const m = matrixFor('Extensión de garantía');
  assertEq(m.selectedIndex, 2, 'indice');
  assertEq(m.prices.anual, '383,365.00', 'anual');
});

test('Repuesto original -> columna 1', () => {
  const m = matrixFor('Repuesto original');
  assertEq(m.selectedIndex, 1, 'indice');
  assertEq(m.prices.anual, '371,880.00', 'anual');
});

test('Vehiculo en garantia -> columna 0', () => {
  const m = matrixFor('Vehículo en garantía');
  assertEq(m.selectedIndex, 0, 'indice');
  assertEq(m.prices.anual, '383,365.00', 'anual');
});

test('Alternativo / Generico / Usados -> columna 4', () => {
  const m = matrixFor('Alternativo / Genérico / Usados');
  assertEq(m.selectedIndex, 4, 'indice');
  assertEq(m.prices.anual, '383,365.00', 'anual');
});

// ---- Estructura del grid ----
test('grid con 5 columnas y etiquetas legibles', () => {
  const m = matrixFor('Extensión de garantía Plus');
  assertEq(m.grid.centers.length, 5, 'centros');
  assertEq(m.grid.labels[0], 'vehiculo en garantia');
  assertEq(m.grid.labels[1], 'original');
  assertEq(m.grid.labels[2], 'extension garantia');
  assertEq(m.grid.labels[3], 'extension garantia plus');
  assertEq(m.grid.labels[4], 'alternativo / generico / usados');
});

test('rowsToRemove = Mensual + Deduccion Mensual con su Y real', () => {
  const m = matrixFor('Extensión de garantía Plus');
  assertEq(m.rowsToRemove.length, 2, 'cantidad');
  const ys = m.rowsToRemove.map(r => r.y).sort((a, b) => a - b);
  assertEq(ys[0], 399.8, 'y deduccion');
  assertEq(ys[1], 484.3, 'y mensual');
});

// ---- Re-seleccion (usada por app.js si el agente corrige el repuesto) ----
test('selectPriceColumn + pricesForColumn reproducen la seleccion', () => {
  const m = matrixFor('Extensión de garantía Plus');
  const idx = selectPriceColumn(m.grid, 'Repuesto original'); // el agente lo cambia
  assertEq(idx, 1, 'nuevo indice');
  assertEq(pricesForColumn(m.grid, idx).anual, '371,880.00', 'anual re-seleccionado');
});

// ---- Robustez ----
test('sustRepos vacio no explota (cae a columna 0)', () => {
  const m = matrixFor('');
  assert(m, 'no null');
  assertEq(m.selectedIndex, 0);
  assert(typeof m.prices.anual === 'string' && m.prices.anual.length > 0);
});

test('confident=false cuando el repuesto no matchea ninguna columna', () => {
  const m = matrixFor('lo que sea zzz');
  // sin match por etiqueta ni por orden fijo -> no confiable, pero no crashea
  assertEq(m.confident, false);
  assert(m.prices.anual, 'igual devuelve algo de la columna 0');
});

// ---- Backward-compat: formato viejo de 1 sola columna ----
test('formato viejo (1 columna) sigue funcionando', () => {
  // Simula el PDF anterior: etiqueta + un unico monto por fila.
  const old = [
    { t: 'Mensual',           x: 60, y: 480, w: 30 }, { t: '53,738.00', x: 300, y: 480, w: 40 },
    { t: 'Trimestral',        x: 60, y: 460, w: 40 }, { t: '158,527.00', x: 300, y: 460, w: 44 },
    { t: 'Semestral',         x: 60, y: 440, w: 40 }, { t: '308,522.00', x: 300, y: 440, w: 44 },
    { t: 'Anual',             x: 60, y: 420, w: 24 }, { t: '571,337.00', x: 300, y: 420, w: 44 },
    { t: 'Deducción Mensual', x: 40, y: 400, w: 70 }, { t: '51,384.00', x: 300, y: 400, w: 40 }
  ];
  const m = _parsePaymentMatrix(_groupByY(old, 2), 'Extensión de garantía Plus');
  assert(m, 'no null');
  assertEq(m.grid.centers.length, 1, 'una sola columna');
  assertEq(m.selectedIndex, 0);
  assertEq(m.prices.anual, '571,337.00', 'anual');
  assertEq(m.prices.mensual, '53,738.00', 'mensual');
  assertEq(m.confident, true, 'con 1 columna no hay ambiguedad');
  assertEq(m.rowsToRemove.length, 2, 'sigue ocultando mensual + deduccion');
});

// ---- Helpers de mapeo (unidad) ----
test('_labelMatch prefiere la columna exacta', () => {
  const labels = ['vehiculo en garantia', 'original', 'extension garantia', 'extension garantia plus', 'alternativo generico usados'];
  assertEq(_labelMatch(labels, 'Extensión de garantía').index, 2);
  assertEq(_labelMatch(labels, 'Extensión de garantía Plus').index, 3);
});

test('_reposFixedIndex mapea el orden fijo de 5 columnas', () => {
  assertEq(_reposFixedIndex('Extensión de garantía Plus', 5), 3);
  assertEq(_reposFixedIndex('Extensión de garantía', 5), 2);
  assertEq(_reposFixedIndex('Repuesto original', 5), 1);
  assertEq(_reposFixedIndex('Alternativo', 5), 4);
  assertEq(_reposFixedIndex('cualquier cosa', 3), -1); // solo aplica a 5 columnas
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
