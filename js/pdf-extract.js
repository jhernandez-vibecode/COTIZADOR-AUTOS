/**
 * Cotizador SDI · Extraccion de datos del PDF INS
 *
 * Lee un PDF de cotizacion oficial del INS (formato ASINS-170-XXXXX) y
 * devuelve un objeto estructurado con los campos del cliente, vehiculo,
 * precios, deducibles y las coordenadas de las filas a eliminar (Mensual
 * y Deduccion Mensual) para que pdf-modify.js las cubra con rectangulos.
 *
 * Estrategia:
 *   1. PDF.js extrae items con coordenadas (x, y) en sistema bottom-up.
 *   2. Agrupamos items por coordenada Y similar (tolerancia +-2px) para
 *      reconstruir las "filas" visuales del PDF.
 *   3. Aplicamos regex sobre el texto concatenado de cada fila para
 *      capturar campos individuales.
 *
 * Validaciones obligatorias:
 *   - PDF debe tener al menos 2 paginas (la cotizacion INS estandar las tiene).
 *   - Debe encontrarse el numero de cotizacion, la placa y el precio anual.
 *
 * API publica:
 *   - extractData(arrayBuffer) -> Promise<DataObj>
 *
 * Forma del objeto retornado:
 *   {
 *     quoteNum, cotizDate, clientName, plate, year, vehicleType,
 *     valor, sustRepos, formaAseg,
 *     prices: { mensual, trimestral, semestral, anual, deduccion },
 *     deductibles: ["Cobertura C: ...", "Cobertura D,F Y H: ..."],
 *     rowsToRemove: [{ y: number, label: string }, ...],
 *     pageWidth: number,
 *     pageHeight: number
 *   }
 */

/**
 * Extrae todos los datos relevantes del PDF de cotizacion INS.
 * @param {ArrayBuffer} arrayBuffer - bytes del PDF
 * @returns {Promise<object>} objeto con campos extraidos
 * @throws Error si el PDF no es valido o le faltan campos criticos
 */
async function extractData(arrayBuffer) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js no esta cargado. Verifica la conexion a la CDN.');
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pdf.numPages < 2) {
    throw new Error(
      'El PDF tiene ' + pdf.numPages + ' pagina(s). Una cotizacion INS valida ' +
      'tiene 2 paginas (datos + precios).'
    );
  }

  // ===== PAGINA 1: datos del cliente y vehiculo =====
  const p1 = await pdf.getPage(1);
  const rows1 = _groupByY(await _pageItems(p1), 2);

  const data = {
    quoteNum:    _findField(rows1, /(ASINS-\d+-\d+)/i),
    cotizDate:   _findField(rows1, /Fecha de cotizaci[oó]n:\s*(.+?)(?:\s|$)/i),
    clientName:  _findField(rows1, /Nombre completo:\s*(.+)/i),
    plate:       _findField(rows1, /N[uú]mero de placa:\s*([A-Z0-9-]+)/i),
    year:        _findField(rows1, /A[ñn]o veh[ií]culo:\s*(\d+)/i),
    vehicleType: _findField(rows1, /Tipo de veh[ií]culo:\s*(.+)/i),
    valor:       _findField(rows1, /Valor Asegurado:\s*([\d,]+\.?\d*)/i),
    sustRepos:   _findField(rows1, /Sustituci[oó]n de repuestos:\s*(.+)/i),
    formaAseg:   _findField(rows1, /Forma de Aseguramiento:\s*(.+)/i),
    prices:       {},
    deductibles:  [],
    rowsToRemove: []
  };

  // ===== PAGINA 2: precios y deducibles =====
  const p2 = await pdf.getPage(2);
  const rows2 = _groupByY(await _pageItems(p2), 2);

  // Dimensiones de la pagina 2 (necesarias para pdf-modify)
  data.pageWidth  = p2.view[2];
  data.pageHeight = p2.view[3];

  // Deducibles: filas que empiezan con "Cobertura " (cubre "Cobertura C:" y "Cobertura D,F Y H:")
  for (const row of rows2) {
    const rowText = row.items.map(i => i.t.trim()).join(' ').replace(/\s+/g, ' ').trim();
    if (/^Cobertura\s/i.test(rowText)) {
      data.deductibles.push(rowText);
    }
  }

  // Precios: la tabla "FORMA DE PAGO" del INS cambio (jul 2026) de UNA sola
  // columna a una MATRIZ de hasta 5 columnas, una por tipo de repuesto
  // (Vehiculo en garantia / Original / Extension / Extension Plus / Alternativo).
  // Elegimos la columna que corresponde al repuesto de la pagina 1 ("Sustitucion
  // de repuestos"). _parsePaymentMatrix es backward-compatible con el formato
  // viejo de 1 sola columna (elige la unica). Ver tests/test-payment-matrix.js.
  const matrix = _parsePaymentMatrix(rows2, data.sustRepos);
  if (matrix) {
    data.prices       = matrix.prices;
    data.rowsToRemove = matrix.rowsToRemove;
    data.priceMatrix  = matrix.grid;   // { centers, labels, values } — re-seleccionable si el agente corrige el repuesto
    data.reposColumn  = {              // que columna quedo elegida (para mostrarla al agente)
      index:     matrix.selectedIndex,
      label:     matrix.selectedLabel,
      confident: matrix.confident,
      count:     matrix.grid.centers.length
    };
  }

  // Monto del deducible de D,F y H — personaliza la seccion 3 del explicador.
  // Si el formato del PDF cambia y no se puede extraer, queda null y el
  // explicador muestra su monto por defecto (comportamiento previo).
  data.dedDFH = _parseDeducibleDFH(data.deductibles);

  // ===== Validacion final =====
  if (!data.quoteNum) {
    throw new Error('No se encontro el numero de cotizacion (formato ASINS-XXX-XXXXX).');
  }
  if (!data.plate) {
    throw new Error('No se encontro la placa del vehiculo en el PDF.');
  }
  if (!data.prices.anual) {
    throw new Error('No se pudo extraer el precio Anual de la pagina 2 del PDF.');
  }

  return data;
}

// =====================================================================
// HELPERS INTERNOS (prefijo _ para indicar uso privado del modulo)
// =====================================================================

/**
 * Extrae los items de texto de una pagina con sus coordenadas.
 * @param {object} page - pagina PDF.js
 * @returns {Promise<Array<{t:string,x:number,y:number}>>}
 */
async function _pageItems(page) {
  const tc = await page.getTextContent();
  return tc.items.map(i => ({
    t: i.str,
    x: i.transform[4],
    y: i.transform[5],
    w: i.width          // ancho del run — necesario para ubicar la columna de precio
  }));
}

/**
 * Agrupa items por coordenada Y similar para reconstruir las "filas" del PDF.
 * Items con Y dentro de la tolerancia se consideran de la misma fila visual.
 * @param {Array} items - items con {t, x, y}
 * @param {number} tol - tolerancia en pixeles para agrupar (default 2)
 * @returns {Array<{y:number, items:Array}>} filas ordenadas top->bottom, items dentro de fila ordenados left->right
 */
function _groupByY(items, tol) {
  tol = tol || 2;
  const sorted = items.slice().sort((a, b) => b.y - a.y); // PDF.js: Y mayor = mas arriba
  const rows = [];
  for (const it of sorted) {
    let row = rows.find(r => Math.abs(r.y - it.y) <= tol);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

/**
 * Extrae el monto (colones, entero) del deducible de las coberturas D, F y H
 * a partir de las filas de deducibles del PDF (ej: "Cobertura D,F Y H: 400,000.00").
 * Devuelve null si no se encuentra la fila o el monto no es plausible —
 * el llamador debe tratar null como "usar el default".
 * @param {string[]} deductibles - filas crudas que empiezan con "Cobertura "
 * @returns {?number} monto en colones o null
 */
function _parseDeducibleDFH(deductibles) {
  const row = (deductibles || []).find(function (t) {
    return /^Cobertura\s+D\b/i.test(String(t));
  });
  if (!row) return null;
  const m = String(row).match(/([\d]{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{5,})/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, '').replace(/\.\d+$/, ''), 10);
  // Rango plausible de un deducible de autos INS: ₡50.000 – ₡5.000.000
  if (isNaN(n) || n < 50000 || n > 5000000) return null;
  return n;
}

/**
 * Busca la primera fila cuyo texto concatenado matchea el regex,
 * y devuelve el grupo capturado (o el match completo si no hay grupo).
 * @param {Array} rows - filas devueltas por _groupByY
 * @param {RegExp} regex - patron con grupo capturador (m[1])
 * @returns {string} texto capturado o '' si no se encuentra
 */
function _findField(rows, regex) {
  for (const row of rows) {
    const text = row.items.map(i => i.t).join(' ').replace(/\s+/g, ' ').trim();
    const m = text.match(regex);
    if (m) return (m[1] || m[0]).trim();
  }
  return '';
}

// =====================================================================
// FORMA DE PAGO — matriz de precios por tipo de repuesto (jul 2026)
// =====================================================================
// El INS cambio la tabla de UNA columna a hasta 5 columnas, una por tipo de
// repuesto. Estas funciones detectan las columnas por su posicion X, leen el
// encabezado de cada una, y eligen la que corresponde al repuesto de la
// pagina 1. Son PURAS (sin DOM ni PDF.js) → testeables con node.

// Formato de un monto del INS: "36,085.00", "402,726.00", "1,234,567.00".
var _MATRIX_NUM_RX = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;

// Filas de la tabla FORMA DE PAGO y su clave en data.prices.
var _PRICE_ROWS = [
  { key: 'mensual',    rx: /^mensual$/ },
  { key: 'trimestral', rx: /^trimestral$/ },
  { key: 'semestral',  rx: /^semestral$/ },
  { key: 'anual',      rx: /^anual$/ },
  { key: 'deduccion',  rx: /^deduccion mensual$/ }
];

// Palabras vacias que no aportan al match de repuesto.
var _REPOS_STOP = { de: 1, y: 1, o: 1, la: 1, el: 1, del: 1, en: 1, con: 1 };

/**
 * Normaliza texto: minusculas, sin acentos, espacios colapsados.
 * Quita los combining marks (U+0300..U+036F) por codigo numerico en vez de un
 * rango de regex con caracteres literales, que un editor podria corromper.
 */
function _normTxt(s) {
  var out = String(s == null ? '' : s).toLowerCase().normalize('NFD');
  var res = '';
  for (var i = 0; i < out.length; i++) {
    var c = out.charCodeAt(i);
    if (c < 0x300 || c > 0x36f) res += out[i];
  }
  return res.replace(/\s+/g, ' ').trim();
}

/** Centro horizontal de un item de texto (x izquierdo + mitad del ancho). */
function _itemCenter(it) {
  return it.x + (Number(it.w) || 0) / 2;
}

/**
 * Agrupa coordenadas X en columnas: valores separados por mas de `gap` puntos
 * inician una columna nueva. Devuelve el centro (promedio) de cada columna,
 * ordenado de izquierda a derecha.
 */
function _clusterCenters(values, gap) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var cols = [], cur = [];
  for (var i = 0; i < sorted.length; i++) {
    if (!cur.length || sorted[i] - cur[cur.length - 1] <= gap) cur.push(sorted[i]);
    else { cols.push(cur); cur = [sorted[i]]; }
  }
  if (cur.length) cols.push(cur);
  return cols.map(function (c) {
    return c.reduce(function (a, b) { return a + b; }, 0) / c.length;
  });
}

/** Indice de la columna cuyo centro esta mas cerca de x, con la distancia. */
function _nearestColumn(centers, x) {
  var best = 0, bd = Infinity;
  for (var i = 0; i < centers.length; i++) {
    var d = Math.abs(centers[i] - x);
    if (d < bd) { bd = d; best = i; }
  }
  return { index: best, dist: bd };
}

/** Tokens significativos de un texto de repuesto (sin acentos ni stopwords). */
function _reposTokens(s) {
  return _normTxt(s).split(/[^a-z0-9]+/).filter(function (t) {
    return t && !_REPOS_STOP[t];
  });
}

/**
 * Match por solape de tokens entre el repuesto elegido y cada etiqueta de
 * columna. Devuelve {index, score}. score = tokens compartidos + Jaccard, asi
 * el conteo de coincidencias domina y el Jaccard rompe empates (ej: para
 * "extension garantia" prefiere la columna sin "plus").
 */
function _labelMatch(labels, sustRepos) {
  var st = _reposTokens(sustRepos);
  var best = { index: 0, score: 0 };
  if (!st.length) return best;
  for (var i = 0; i < labels.length; i++) {
    var lt = _reposTokens(labels[i]);
    if (!lt.length) continue;
    var lset = {}; lt.forEach(function (t) { lset[t] = 1; });
    var inter = 0; st.forEach(function (t) { if (lset[t]) inter++; });
    var union = {}; st.concat(lt).forEach(function (t) { union[t] = 1; });
    var jacc = inter / Object.keys(union).length;
    var score = inter + jacc;
    if (score > best.score) best = { index: i, score: score };
  }
  return best;
}

/**
 * Fallback por el ORDEN FIJO de la plantilla INS de 5 columnas:
 * [Vehiculo en garantia, Original, Extension garantia, Extension garantia Plus,
 *  Alternativo/Generico/Usados]. Devuelve -1 si no aplica.
 */
function _reposFixedIndex(sustRepos, nCols) {
  if (nCols !== 5) return -1;
  var n = _normTxt(sustRepos);
  if (/garantia plus/.test(n) || /\bplus\b/.test(n)) return 3;
  if (/extension/.test(n) && /garantia/.test(n))     return 2;
  if (/alternativ|generic|usad/.test(n))             return 4;
  if (/original/.test(n))                            return 1;
  if (/vehiculo|garantia/.test(n))                   return 0;
  return -1;
}

/**
 * Elige el indice de columna de precios para el repuesto elegido:
 *   1) Match por etiquetas del encabezado (robusto a que el INS reordene).
 *   2) Fallback al orden fijo de 5 columnas si el encabezado no matcheo.
 *   3) 0 (primera columna) como ultimo recurso.
 * Publica (la usa app.js para re-seleccionar si el agente corrige el repuesto).
 * @param {object} grid - { centers, labels, values }
 * @param {string} sustRepos
 * @returns {number} indice de columna
 */
function selectPriceColumn(grid, sustRepos) {
  var centers = (grid && grid.centers) || [];
  if (centers.length <= 1) return 0;
  var byLabel = _labelMatch(grid.labels || [], sustRepos);
  if (byLabel.score >= 1) return byLabel.index;
  var fx = _reposFixedIndex(sustRepos, centers.length);
  if (fx >= 0) return fx;
  return byLabel.index || 0;
}

/** true si pudimos identificar la columna con confianza (o solo hay una). */
function priceColumnConfident(grid, sustRepos) {
  var centers = (grid && grid.centers) || [];
  if (centers.length <= 1) return true;
  return _labelMatch(grid.labels || [], sustRepos).score >= 1
      || _reposFixedIndex(sustRepos, centers.length) >= 0;
}

/** Precios de una columna dada del grid → { mensual, trimestral, ... }. */
function pricesForColumn(grid, index) {
  var out = {};
  var vals = (grid && grid.values) || {};
  for (var k in vals) {
    if (Object.prototype.hasOwnProperty.call(vals, k)) {
      out[k] = vals[k][index] || '';
    }
  }
  return out;
}

/**
 * Parsea la tabla FORMA DE PAGO (matriz de precios por tipo de repuesto) de la
 * pagina 2 y devuelve la columna que corresponde al repuesto elegido.
 * Compatible con el formato viejo de 1 sola columna.
 *
 * @param {Array} rows - filas de _groupByY de la pagina 2 (items con {t,x,y,w})
 * @param {string} sustRepos - "Sustitucion de repuestos" de la pagina 1
 * @returns {?object} { prices, rowsToRemove, grid:{centers,labels,values},
 *                      selectedIndex, selectedLabel, confident } o null
 */
function _parsePaymentMatrix(rows, sustRepos) {
  // 1) Filas de precio: etiqueta a la izquierda + >=1 monto.
  var priceRows = [];
  for (var r = 0; r < rows.length; r++) {
    var nums = [], labelItems = [];
    var items = rows[r].items;
    for (var j = 0; j < items.length; j++) {
      var t = (items[j].t || '').trim();
      if (!t) continue;
      if (_MATRIX_NUM_RX.test(t)) nums.push({ t: t, center: _itemCenter(items[j]) });
      else labelItems.push(items[j]);
    }
    if (!nums.length) continue;
    var labelText = _normTxt(labelItems.map(function (i) { return i.t; }).join(' '));
    var pk = null;
    for (var p = 0; p < _PRICE_ROWS.length; p++) {
      if (_PRICE_ROWS[p].rx.test(labelText)) { pk = _PRICE_ROWS[p].key; break; }
    }
    if (!pk) continue;
    priceRows.push({ key: pk, y: rows[r].y, nums: nums });
  }
  if (!priceRows.length) return null;

  // 2) Centros de columna a partir de TODOS los montos de las filas de precio.
  var allCenters = [];
  priceRows.forEach(function (pr) { pr.nums.forEach(function (n) { allCenters.push(n.center); }); });
  var centers = _clusterCenters(allCenters, 40);

  // 3) Etiquetas de columna: texto de encabezado (no numerico) justo por
  //    encima de las filas de precio y alineado a un centro de columna. El
  //    filtro por X descarta "FORMA DE PAGO" y las etiquetas de fila (a la
  //    izquierda), y la banda vertical descarta "Observaciones"/deducibles.
  var yTopPrice = priceRows.reduce(function (mx, pr) { return Math.max(mx, pr.y); }, -Infinity);
  var HEADER_BAND = 50;   // puntos por encima de la fila de precio mas alta
  var X_TOL = 46;         // ~mitad del ancho de columna
  var headerBuckets = centers.map(function () { return []; });
  for (var rr = 0; rr < rows.length; rr++) {
    var ry = rows[rr].y;
    if (!(ry > yTopPrice && ry <= yTopPrice + HEADER_BAND)) continue;
    var its = rows[rr].items;
    for (var k = 0; k < its.length; k++) {
      var tx = (its[k].t || '').trim();
      if (!tx || _MATRIX_NUM_RX.test(tx)) continue;
      var near = _nearestColumn(centers, _itemCenter(its[k]));
      if (near.dist <= X_TOL) headerBuckets[near.index].push({ y: ry, x: its[k].x, t: tx });
    }
  }
  var labels = headerBuckets.map(function (b) {
    b.sort(function (a, z) { return (z.y - a.y) || (a.x - z.x); }); // arriba primero, luego izq
    return _normTxt(b.map(function (i) { return i.t; }).join(' '));
  });

  // 4) Valores por columna (alineados a `centers`).
  var values = {};
  priceRows.forEach(function (pr) {
    var arr = []; for (var i = 0; i < centers.length; i++) arr.push('');
    pr.nums.forEach(function (n) { arr[_nearestColumn(centers, n.center).index] = n.t; });
    values[pr.key] = arr;
  });

  var grid = { centers: centers, labels: labels, values: values };

  // 5) Seleccion de la columna del repuesto elegido.
  var sel = selectPriceColumn(grid, sustRepos);

  // 6) rowsToRemove: mensual + deduccion (fila completa; pdf-modify tapa a lo ancho).
  var rowsToRemove = [];
  priceRows.forEach(function (pr) {
    if (pr.key === 'mensual' || pr.key === 'deduccion') rowsToRemove.push({ y: pr.y, label: pr.key });
  });

  return {
    prices:        pricesForColumn(grid, sel),
    rowsToRemove:  rowsToRemove,
    grid:          grid,
    selectedIndex: sel,
    selectedLabel: labels[sel] || '',
    confident:     priceColumnConfident(grid, sustRepos)
  };
}

// Export para tests node (guardado: en el browser no existe module).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _parsePaymentMatrix: _parsePaymentMatrix,
    selectPriceColumn: selectPriceColumn,
    pricesForColumn: pricesForColumn,
    priceColumnConfident: priceColumnConfident,
    _groupByY: _groupByY,
    _labelMatch: _labelMatch,
    _reposFixedIndex: _reposFixedIndex,
    _clusterCenters: _clusterCenters,
    _normTxt: _normTxt
  };
}
