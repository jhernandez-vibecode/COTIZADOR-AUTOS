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

  // Etiquetas de precios y su clave en data.prices
  // Las filas Mensual y Deduccion Mensual se agregan a rowsToRemove para borrarlas
  const priceLabels = {
    mensual:    /^Mensual$/i,
    trimestral: /^Trimestral$/i,
    semestral:  /^Semestral$/i,
    anual:      /^Anual$/i,
    deduccion:  /^Deducci[oó]n Mensual$/i
  };

  for (const row of rows2) {
    // 1. Precios: buscar etiqueta + valor numerico (formato 53,738.00) en la misma fila
    for (const [key, rx] of Object.entries(priceLabels)) {
      const labelItem = row.items.find(i => rx.test(i.t.trim()));
      if (!labelItem) continue;

      const numItem = row.items.find(i => /^[\d,]+\.\d{2}$/.test(i.t.trim()));
      if (!numItem) continue;

      data.prices[key] = numItem.t.trim();
      if (key === 'mensual' || key === 'deduccion') {
        data.rowsToRemove.push({ y: row.y, label: labelItem.t.trim() });
      }
      break;
    }

    // 2. Deducibles: filas que empiezan con "Cobertura " (cubre "Cobertura C:" y "Cobertura D,F Y H:")
    const rowText = row.items.map(i => i.t.trim()).join(' ').replace(/\s+/g, ' ').trim();
    if (/^Cobertura\s/i.test(rowText)) {
      data.deductibles.push(rowText);
    }
  }

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
    y: i.transform[5]
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
