/**
 * Cotizador SDI · Extracción de datos del PDF de póliza activa
 *
 * Lee las "Condiciones Particulares" del Seguro Voluntario de Automóviles del INS
 * (form _017_170_) y extrae los campos que necesita el correo de "Póliza Activa":
 * número de póliza, titular (tomador), vehículo, placa, correo del cliente.
 *
 * Funciones puras + testeables (igual patrón que js/pdf-extract.js y la consola
 * de Viajero). El texto se normaliza a una sola línea antes de aplicar regex,
 * porque PDF.js entrega los fragmentos sueltos y el layout del INS parte campos
 * en varias filas (ej. "Año fabricación: 2 016", "Monto Asegurado: 7 350 000").
 *
 * API pública (window.PolizaParse):
 *   - extractAll(rawText)   -> { poliza, cliente, nombrePila, vehiculo, marca,
 *                                modelo, anio, placa, correo, formaPago,
 *                                vigenciaDesde, vigenciaHasta }
 *   - classifyFile(name)    -> 'condiciones'|'tarjeta'|'comprobante'|'generales'|
 *                              'pacto'|'multiasistencia'|'beneficios'|'otro'
 *   - readPdfText(file)     -> Promise<string>  (usa pdfjsLib global)
 *   - normalize / titleCase / sugerirNombrePila (helpers expuestos para tests)
 */
var PolizaParse = (function () {

  // Colapsa espacios (incl. NBSP y el espacio fino que mete el INS) a un solo espacio.
  function normalize(t) {
    return (t || '')
      .replace(/[   ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Title Case respetando Unicode (acentos). "VEGA GAMBOA" -> "Vega Gamboa",
  // "RODRÍGUEZ SOLÍS" -> "Rodríguez Solís". NO usar \b: en JS es ASCII y parte
  // mal las palabras con tildes (deja "MarÍA"). Capitaliza la 1ª letra tras
  // inicio de cadena, espacio o guion.
  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s\-])(\p{L})/gu, function (m, sep, ch) {
      return sep + ch.toUpperCase();
    });
  }

  function cleanName(s) { return titleCase(normalize(s)); }

  // N° de póliza: 0101AUT218279500 / 0121AUT004597634 (4 dígitos + 3 letras + dígitos)
  function extractPoliza(t) {
    var m = t.match(/p[oó]liza:?\s*([0-9]{4}[A-Z]{3}[0-9]{6,})/i);
    if (m) return m[1].toUpperCase();
    m = t.match(/\b([0-9]{4}AUT[0-9]{6,})\b/i);
    return m ? m[1].toUpperCase() : '';
  }

  // Titular (tomador): primer "Nombre:" después de "DATOS TOMADOR".
  function extractTomador(t) {
    var m = t.match(/DATOS TOMADOR\s*Nombre:\s*(.+?)\s*N[°º]?\s*Identificaci[oó]n/i);
    if (m) return cleanName(m[1]);
    m = t.match(/Nombre:\s*(.+?)\s*N[°º]?\s*Identificaci[oó]n/i); // fallback: primer Nombre del doc
    return m ? cleanName(m[1]) : '';
  }

  function extractMarca(t)  { var m = t.match(/Marca:\s*([A-Za-z0-9\- ]+?)\s*Modelo:/i); return m ? normalize(m[1]).toUpperCase() : ''; }
  function extractModelo(t) { var m = t.match(/Modelo:\s*(.+?)\s*Placa:/i);              return m ? normalize(m[1]).toUpperCase() : ''; }
  function extractAnio(t)   { var m = t.match(/A[ñn]o(?:\s*de)?\s*fabricaci[oó]n:\s*([\d ]+?)\s*Tipo/i); return m ? normalize(m[1]).replace(/\s+/g, '') : ''; }
  function extractPlaca(t)  { var m = t.match(/Placa:\s*([A-Z0-9\-]+)/i);                return m ? m[1].toUpperCase() : ''; }

  function extractVehiculo(t) {
    return [extractMarca(t), extractModelo(t), extractAnio(t)].filter(Boolean).join(' ');
  }

  // Correo del cliente: toma el primero que NO sea del agente (segurosdelins.com).
  function extractCorreo(t) {
    var ms = t.match(/Correo electr[oó]nico:\s*([^\s,;]+@[^\s,;]+)/ig) || [];
    var mails = ms.map(function (raw) { return raw.replace(/.*:\s*/, '').trim(); }).filter(Boolean);
    var ext = mails.filter(function (e) { return !/segurosdelins\.com$/i.test(e); });
    return ext[0] || mails[0] || '';
  }

  function extractVigencia(t) {
    var m = t.match(/Desde:\s*(\d{2}\/\d{2}\/\d{4})\s*Hasta:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return m ? { desde: m[1], hasta: m[2] } : { desde: '', hasta: '' };
  }

  function extractFormaPago(t) {
    var m = t.match(/Forma de pago:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i);
    return m ? titleCase(m[1]) : '';
  }

  // Nombre de pila: el INS escribe "APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2]".
  // El nombre de pila son los tokens DESPUÉS de los dos apellidos.
  function sugerirNombrePila(nombre) {
    var toks = normalize(nombre).split(/\s+/).filter(Boolean);
    var pila = toks.length > 2 ? toks.slice(2).join(' ') : nombre;
    return titleCase(pila);
  }

  // Clasifica un PDF por su nombre de archivo (para mostrar badge y elegir de
  // cuál extraer los datos: las Condiciones Particulares son la fuente principal).
  function classifyFile(filename) {
    var f = (filename || '').toLowerCase();
    if (/tarjeta/.test(f)) return 'tarjeta';
    if (/comprobante|factura.*pago|pago/.test(f) && /comprobante|pago/.test(f)) return 'comprobante';
    if (/condiciones[_ ]*particulares|_017_170_|cond[_ ]*part/.test(f)) return 'condiciones';
    if (/condiciones[_ ]*generales/.test(f)) return 'generales';
    if (/pacto[_ ]*amistoso/.test(f)) return 'pacto';
    if (/multiasistencia/.test(f)) return 'multiasistencia';
    if (/beneficios.*asistencia|asistencia.*\d+\s*-\s*\d+/.test(f)) return 'beneficios';
    if (/[0-9]{4}aut[0-9]{6,}/.test(f)) return 'condiciones'; // PDF con n.º de póliza => probable cond. part.
    return 'otro';
  }

  function extractAll(raw) {
    var t = normalize(raw);
    var nombre = extractTomador(t);
    var vig = extractVigencia(t);
    return {
      poliza:        extractPoliza(t),
      cliente:       nombre,
      nombrePila:    sugerirNombrePila(nombre),
      marca:         extractMarca(t),
      modelo:        extractModelo(t),
      anio:          extractAnio(t),
      vehiculo:      extractVehiculo(t),
      placa:         extractPlaca(t),
      correo:        extractCorreo(t),
      formaPago:     extractFormaPago(t),
      vigenciaDesde: vig.desde,
      vigenciaHasta: vig.hasta
    };
  }

  // Lee el texto de un PDF usando el pdfjsLib global (mismo CDN/worker que la app).
  async function readPdfText(file) {
    var buf = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    var out = '';
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var tc = await page.getTextContent();
      out += ' ' + tc.items.map(function (it) { return it.str; }).join(' ');
    }
    return out;
  }

  return {
    normalize: normalize,
    titleCase: titleCase,
    sugerirNombrePila: sugerirNombrePila,
    extractPoliza: extractPoliza,
    extractTomador: extractTomador,
    extractVehiculo: extractVehiculo,
    extractPlaca: extractPlaca,
    extractCorreo: extractCorreo,
    classifyFile: classifyFile,
    extractAll: extractAll,
    readPdfText: readPdfText
  };
})();

// Disponible como global en el browser y como módulo en Node (para tests).
if (typeof window !== 'undefined') { window.PolizaParse = PolizaParse; }
if (typeof module !== 'undefined' && module.exports) { module.exports = PolizaParse; }
