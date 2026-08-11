/**
 * Cotizador SDI · Extracción del Comprobante de Pago del INS (renovación)
 *
 * Lee el "Comprobante de Pago" del INS (formulario INS-F-1011060, A4 595x842,
 * una página) que el agente descarga cuando el cliente YA PAGÓ la renovación de
 * su póliza de automóviles, y extrae lo que necesita el correo de confirmación:
 * n.º de comprobante, asegurado, n.º de póliza, placa, período pagado, fecha de
 * pago y monto.
 *
 * Verificado el 10 ago 2026 contra 2 comprobantes reales del INS. El PDF es
 * 100% texto (sin tablas-imagen), así que alcanza con PDF.js y regex sobre el
 * texto normalizado — mismo patrón que poliza-extract.js.
 *
 * DOS COSAS QUE NO SON OBVIAS EN ESTE FORMULARIO:
 *
 *  1. La PLACA viene dentro de un paréntesis, en un campo de ancho fijo con
 *     relleno a la izquierda que NO siempre son ceros: en las muestras reales
 *     aparecieron "(00000BXY123)" y "(PQR00ZWT456)" — 11 caracteres las dos,
 *     con la placa real al final (BXY123 / ZWT456). Se reconoce el patrón
 *     AAA999 final; cualquier otro formato (placas numéricas viejas, CL, motos)
 *     se devuelve CRUDO con placaIncierta=true para que el agente lo corrija.
 *     No se inventa una placa que el PDF no dice con claridad.
 *
 *  2. El período que trae el comprobante es el PERÍODO PAGADO, no el año-póliza:
 *     las muestras reales traían un trimestre (30/08→30/11) y un semestre
 *     (27/08→27/02). Por eso el correo nunca dice "vigencia anual".
 *
 * GUARD DE ESTADO (decisión D7 de JC, 10 ago 2026): este módulo existe para
 * enviar recibos YA PAGADOS. `estaPagado()` es la barrera: si el comprobante no
 * dice "Estado: Pagado", la app no deja enviar la plantilla de confirmación —
 * afirmar un pago que no ocurrió compromete la licencia del agente.
 *
 * API pública (window.RenovacionParse):
 *   - extractAll(rawText) -> { numComprobante, cliente, nombrePila, estado,
 *                              poliza, placa, placaIncierta, periodoDesde,
 *                              periodoHasta, fechaPago, monto, montoTexto,
 *                              moneda, polizasEncontradas }
 *   - esComprobantePago(t) -> boolean   (¿es el formulario correcto?)
 *   - estaPagado(estado)   -> boolean   (guard D7)
 *   - parseMonto / fmtMonto / extractPlaca ... (expuestos para tests)
 *   - readPdfText(file)    -> Promise<string>  (delegado en PolizaParse)
 */
var RenovacionParse = (function () {

  // Helpers compartidos con el módulo de pólizas activas: normalize, titleCase,
  // sugerirNombrePila y readPdfText ya están probados en producción y hacen
  // exactamente lo mismo acá (el INS escribe los nombres igual en los dos
  // formularios). Reusarlos evita que la lógica del saludo derive en dos copias.
  var PP = (typeof PolizaParse !== 'undefined') ? PolizaParse
         : (typeof require !== 'undefined' ? require('./poliza-extract.js') : null);

  function normalize(t) { return PP.normalize(t); }
  function titleCase(s) { return PP.titleCase(s); }

  /** Quita acentos por rango de combinantes (nunca literales invisibles en el fuente). */
  function sinTildes(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * ¿El PDF es un Comprobante de Pago del INS? Sirve para avisar cuando el
   * agente arrastra otro documento por error. NO bloquea: si el formulario
   * cambia de nombre, el agente todavía puede completar los datos a mano.
   */
  function esComprobantePago(t) {
    var s = normalize(t);
    return /Comprobante de Pago/i.test(s) &&
           /INSTITUTO NACIONAL DE SEGUROS|INS-F-101/i.test(s);
  }

  /** Guard D7: solo "Pagado" habilita el envío de la confirmación. */
  function estaPagado(estado) {
    return /^pagado$/i.test(sinTildes(String(estado || '')).trim());
  }

  function extractNumComprobante(t) {
    var m = t.match(/Comprobante de Pago\s*N[º°o]?\s*:?\s*([A-Z0-9-]{6,})/i);
    return m ? m[1].toUpperCase() : '';
  }

  /** "Nombre del asegurado: RAMIREZ SOTO CARLOS ANDRES Tipo identificación: ..." */
  function extractAsegurado(t) {
    var m = t.match(/Nombre del asegurado:\s*(.+?)\s*Tipo\s+identificaci[oó]n/i);
    if (!m) m = t.match(/Nombre del asegurado:\s*(.+?)\s*(?:Tipo|N[uú]mero)\b/i);
    return m ? titleCase(normalize(m[1])) : '';
  }

  function extractEstado(t) {
    var m = t.match(/Estado:\s*([A-Za-zÀ-ſ]+)/i);
    return m ? titleCase(m[1]) : '';
  }

  /** N.º de póliza: 0101AUT100000001 / 0121AUT... (mismo formato que la póliza activa). */
  function extractPoliza(t) {
    var m = t.match(/\b(0[0-9]{3}[A-Z]{3}[0-9]{6,})\b/i);
    return m ? m[1].toUpperCase() : '';
  }

  /** Cuántas líneas de póliza trae el comprobante (puede cubrir más de una). */
  function contarPolizas(t) {
    var m = t.match(/\b0[0-9]{3}[A-Z]{3}[0-9]{6,}\b/gi);
    return m ? m.length : 0;
  }

  /**
   * Recorta la LÍNEA DE DETALLE de la primera póliza: desde su n.º de póliza
   * hasta el n.º de la póliza siguiente o hasta "TOTAL A PAGAR", lo que llegue
   * antes.
   *
   * Es la pieza que mantiene coherente todo lo que se le muestra al cliente. Un
   * comprobante puede cubrir VARIAS pólizas; si la placa se buscara en todo el
   * documento y el monto se tomara del "TOTAL A PAGAR" (que es la SUMA de todas
   * las líneas), el correo mezclaría la póliza de una línea con la placa de otra
   * y con el total de todas. Todo lo específico de la póliza sale de este bloque.
   */
  function bloqueDetalle(t) {
    var re = /\b0[0-9]{3}[A-Z]{3}[0-9]{6,}\b/gi, m, ini = -1, sig = -1;
    while ((m = re.exec(t)) !== null) {
      if (ini === -1) ini = m.index;
      else { sig = m.index; break; }
    }
    if (ini === -1) return '';
    var fin = sig !== -1 ? sig : t.length;
    var tot = t.search(/TOTAL A PAGAR/i);
    if (tot > ini && tot < fin) fin = tot;
    return t.slice(ini, fin);
  }

  /**
   * Placa: dentro del paréntesis de la línea de detalle, con relleno a la
   * izquierda. Devuelve { placa, incierta }.
   *
   * Se busca SOLO en el bloque de la póliza elegida: barrer el documento entero
   * traía la placa de otra línea cuando la primera no seguía el patrón AAA999.
   */
  function extractPlaca(t) {
    var ambito = bloqueDetalle(t) || t;
    var re = /\(([A-Z0-9]{5,})\)/g, m, cands = [];
    while ((m = re.exec(ambito)) !== null) cands.push(m[1]);

    for (var i = 0; i < cands.length; i++) {
      var fin = cands[i].match(/([A-Z]{3}[0-9]{3})$/);      // AAA999 al final: el caso normal
      if (fin) return { placa: fin[1], incierta: false };
    }
    // Formato distinto al de las muestras: se entrega crudo y marcado, para que
    // el agente lo vea y lo corrija. Inventar un recorte sería peor que no leerlo.
    if (cands.length) return { placa: cands[0], incierta: true };
    return { placa: '', incierta: false };
  }

  /**
   * Período PAGADO: las dos primeras fechas de la línea de detalle
   * ("... 30/08/2026 30/11/2026 11/09/2026 ..." → desde, hasta; la tercera es
   * la fecha límite de pago, que este correo no usa: el recibo ya está pagado).
   */
  function extractPeriodo(t) {
    var ambito = bloqueDetalle(t);
    if (!ambito) {
      var ancla = t.search(/DETALLE/i);
      ambito = ancla === -1 ? t : t.slice(ancla);
    }
    var fechas = ambito.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
    return { desde: fechas[0] || '', hasta: fechas[1] || '' };
  }

  function extractFechaPago(t) {
    var m = t.match(/Fecha de Pago:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return m ? m[1] : '';
  }

  function extractMoneda(t) {
    var m = t.match(/Moneda:\s*(Colones|D[oó]lares)/i);
    if (m) return /colones/i.test(m[1]) ? 'CRC' : 'USD';
    return /\$/.test(t) && !/₡/.test(t) ? 'USD' : 'CRC';
  }

  /**
   * Monto a número. El INS escribe "92,555.00" (coma de miles, punto decimal),
   * pero se acepta cualquiera de los dos órdenes: manda el ÚLTIMO separador,
   * y solo cuenta como decimal si le siguen 1 o 2 dígitos.
   */
  function parseMonto(s) {
    var t = String(s == null ? '' : s).replace(/[^\d.,]/g, '');
    if (!t) return NaN;
    var corte = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
    var cola = corte === -1 ? 0 : t.length - corte - 1;
    if (corte > -1 && cola > 0 && cola <= 2) {
      return parseFloat(t.slice(0, corte).replace(/[.,]/g, '') + '.' + t.slice(corte + 1));
    }
    return parseFloat(t.replace(/[.,]/g, ''));
  }

  /**
   * Monto formateado para Costa Rica. Se usa 'de-DE' a propósito: el locale
   * es-CR separa los miles con ESPACIO y el cliente lee "92 555" como si le
   * faltara algo. Sin decimales cuando el monto es entero (lo normal en el INS).
   */
  function fmtMonto(n, moneda) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    var dec = Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0;
    var simbolo = moneda === 'USD' ? '$' : '₡';
    return simbolo + n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  /**
   * Monto de LA PÓLIZA que se le va a nombrar al cliente.
   *
   * Con una sola póliza, "TOTAL A PAGAR" es esa misma línea y es el dato más
   * confiable. Con VARIAS, el total es la suma de todas: usarlo pondría en el
   * correo un monto que no corresponde a la póliza mencionada, así que se lee
   * el monto de dentro de la línea de detalle.
   */
  function extractMonto(t) {
    var varias = contarPolizas(t) > 1;
    if (varias) {
      var bloque = bloqueDetalle(t);
      var b = bloque && bloque.match(/[₡$]\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
      if (b) return parseMonto(b[1]);
    }
    var m = t.match(/TOTAL A PAGAR:?\s*[₡$]?\s*([\d.,]+)/i);
    if (!m) m = t.match(/[₡$]\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
    return m ? parseMonto(m[1]) : NaN;
  }

  function extractAll(raw) {
    var t = normalize(raw);
    var nombre = extractAsegurado(t);
    var per    = extractPeriodo(t);
    var pl     = extractPlaca(t);
    var moneda = extractMoneda(t);
    var monto  = extractMonto(t);

    return {
      numComprobante:    extractNumComprobante(t),
      cliente:           nombre,
      nombrePila:        nombre ? PP.sugerirNombrePila(nombre) : '',
      estado:            extractEstado(t),
      poliza:            extractPoliza(t),
      placa:             pl.placa,
      placaIncierta:     pl.incierta,
      periodoDesde:      per.desde,
      periodoHasta:      per.hasta,
      fechaPago:         extractFechaPago(t),
      monto:             monto,
      montoTexto:        isFinite(monto) ? fmtMonto(monto, moneda) : '',
      moneda:            moneda,
      polizasEncontradas: contarPolizas(t),
      esComprobante:     esComprobantePago(t)
    };
  }

  return {
    normalize: normalize,
    titleCase: titleCase,
    sinTildes: sinTildes,
    esComprobantePago: esComprobantePago,
    estaPagado: estaPagado,
    extractNumComprobante: extractNumComprobante,
    extractAsegurado: extractAsegurado,
    extractEstado: extractEstado,
    extractPoliza: extractPoliza,
    extractPlaca: extractPlaca,
    extractPeriodo: extractPeriodo,
    extractFechaPago: extractFechaPago,
    extractMoneda: extractMoneda,
    extractMonto: extractMonto,
    bloqueDetalle: bloqueDetalle,
    parseMonto: parseMonto,
    fmtMonto: fmtMonto,
    contarPolizas: contarPolizas,
    extractAll: extractAll,
    readPdfText: function (file) { return PP.readPdfText(file); }
  };
})();

// Global en el browser, módulo en Node (para tests).
if (typeof window !== 'undefined') { window.RenovacionParse = RenovacionParse; }
if (typeof module !== 'undefined' && module.exports) { module.exports = RenovacionParse; }
