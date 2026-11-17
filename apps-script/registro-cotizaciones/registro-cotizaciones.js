// =====================================================================
// Registro de cotizaciones · Apps Script en la cuenta de Google de JC (5 nov 2026)
// ---------------------------------------------------------------------
// Anota en una hoja de Google, una fila por solicitud, lo que llega por el
// formulario propio de cotización (cotizador.appsegurosdigitales.com/cotizar/),
// con la columna del agente al que le tocó. Lo llama la Function
// netlify/functions/lib/cotizar-handler.mjs (filaRegistro de cotizar-correos.mjs):
// si cambian las columnas allá, cambian acá.
//
// Seguridad: solo acepta filas que traen la CLAVE que se genera al instalar
// (la misma va en la variable COTIZAR_REGISTRO_CLAVE de Netlify). La hoja
// queda en el Drive de quien instala; nadie más la ve.
//
// Instalación (una vez):
//   1. script.google.com → Proyecto nuevo → pegar este archivo y appsscript.json.
//   2. Ejecutar instalar() y aceptar los permisos. En el registro de ejecución
//      salen el enlace de la hoja y la CLAVE.
//   3. Implementar → Nueva implementación → Aplicación web
//      (Ejecutar como: yo · Quién tiene acceso: cualquier persona) → copiar la URL.
//   4. En Netlify: COTIZAR_REGISTRO_URL = esa URL · COTIZAR_REGISTRO_CLAVE = la clave.
// Prueba: probar() anota una fila con datos inventados.
//
// Ordenar la hoja (8 nov 2026, pedido de JC): ordenar() deja la hoja con un
// color por persona (fila completa), filtros en los encabezados, la columna
// Mes llena también en las filas viejas y una pestaña «Resumen» que cuenta
// las solicitudes por persona y por mes. Se puede volver a correr cuando se
// quiera: rehace lo suyo y no toca los datos.
// =====================================================================

var RG = {
  HOJA: 'Cotizaciones',
  COLUMNAS: [
    ['fecha', 'Fecha'], ['agente', 'Agente asignado'], ['turno', 'Turno'], ['correoAgente', 'Correo del agente'],
    ['nombre', 'Nombre del propietario'], ['cedula', 'Número de Cédula'], ['telefono', 'Teléfono'], ['correo', 'Correo'],
    ['tipo', 'Su vehículo es'], ['vehiculo', 'Placa / Marca y modelo'], ['valor', 'Valor'], ['uso', 'Uso del Vehículo'],
    ['interes', 'Interés Asegurable'], ['inscribe', 'A nombre de quién se inscribe'], ['cedulaInscribe', 'Cédula de quien inscribe'],
    ['combustible', 'Tipo de Combustible'], ['tipoVehiculo', 'Tipo de Vehículo'], ['info', 'Información Adicional'],
    ['clienteAvisado', 'Confirmación al cliente'], ['mes', 'Mes']
  ],
  RESUMEN: 'Resumen',   // la vieja; pestanasPorMes() la borra (la reemplaza Estadísticas)
  ESTAD: 'Estadísticas',
  // Un color por persona (JC, 8 nov 2026). En «Cotizaciones» se reconoce por el correo del agente;
  // en «Resumen», por cómo empieza el nombre de su ficha (por eso «Christian», con h).
  // Para alguien nuevo: agregar una línea y volver a correr ordenar().
  PERSONAS: [
    { correo: 'jhernandez@segurosdelins.com', nombre: 'Juan Carlos', fuerte: '#1A73E8', suave: '#E8F0FE' },
    { correo: 'chernandez@seguros-ins.com', nombre: 'Christian', fuerte: '#E8710A', suave: '#FEEFE3' },
    { correo: 'tramites@segurosdelins.com', nombre: 'José', fuerte: '#188038', suave: '#E6F4EA' },
    { correo: 'fhernandez@segurosdelins.com', nombre: 'Melanie', fuerte: '#9334E6', suave: '#F3E8FD' },
    // Su correo anterior (hasta el 11 nov 2026): se queda para que sus filas viejas conserven el color.
    { correo: 'melanie.hernandez@seguros-del-ins.com', nombre: 'Melanie', fuerte: '#9334E6', suave: '#F3E8FD' }
  ],
  SIN_ASIGNAR: { nombre: 'Sin asignar', fuerte: '#5F6368', suave: '#F1F3F4' }
};

var MESES_ = 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(' ');

/** "2026-11 · noviembre" a partir de la Fecha de la fila (fecha de Sheets o texto "8 nov 2026, 3:35 pm"). */
function mesDe_(fecha) {
  var anio, m;
  if (fecha instanceof Date) {
    anio = Number(Utilities.formatDate(fecha, 'America/Costa_Rica', 'yyyy'));
    m = Number(Utilities.formatDate(fecha, 'America/Costa_Rica', 'M')) - 1;
  } else {
    var t = String(fecha || '').toLowerCase().match(/(\d{1,2})\s+([a-zñ]{3})[a-zñ]*\.?\s+(\d{4})/);
    if (!t) return '';
    m = 'ene feb mar abr may jun jul ago sep oct nov dic'.split(' ').indexOf(t[2] === 'set' ? 'sep' : t[2]);
    if (m < 0) return '';
    anio = Number(t[3]);
  }
  return anio + '-' + (m < 9 ? '0' : '') + (m + 1) + ' · ' + MESES_[m];
}

function letra_(n) { var s = ''; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; } return s; }
function col_(clave) { for (var i = 0; i < RG.COLUMNAS.length; i++) if (RG.COLUMNAS[i][0] === clave) return i + 1; throw new Error('Sin columna ' + clave); }

function ordenar() {
  var libro = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID'));
  var hoja = libro.getSheetByName(RG.HOJA);
  var n = RG.COLUMNAS.length, cAg = col_('agente'), cCorreo = col_('correoAgente'), cMes = col_('mes'), cFecha = col_('fecha');

  // 1. Encabezados (la columna Mes es nueva) y espacio para muchas filas.
  hoja.getRange(1, 1, 1, n).setValues([RG.COLUMNAS.map(function (c) { return c[1]; })])
    .setFontWeight('bold').setBackground('#F1F3F4');
  hoja.setFrozenRows(1);
  if (hoja.getMaxRows() < 3000) hoja.insertRowsAfter(hoja.getMaxRows(), 3000 - hoja.getMaxRows());
  if (hoja.getMaxColumns() < n) hoja.insertColumnsAfter(hoja.getMaxColumns(), n - hoja.getMaxColumns());

  // 2. Mes de las filas viejas (las nuevas ya lo traen de la Function).
  var ult = hoja.getLastRow();
  if (ult > 1) {
    var fechas = hoja.getRange(2, cFecha, ult - 1, 1).getValues();
    var meses = hoja.getRange(2, cMes, ult - 1, 1).getValues();
    for (var i = 0; i < meses.length; i++) if (!meses[i][0]) meses[i][0] = mesDe_(fechas[i][0]);
    hoja.getRange(2, cMes, ult - 1, 1).setValues(meses);
  }

  // 3. Colores: la celda del agente fuerte y el resto de la fila suave.
  coloresPorPersona_(hoja);

  // 4. Filtros en los encabezados (persona, mes, turno…), sobre todas las filas.
  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange(1, 1, hoja.getMaxRows(), n).createFilter();

  // 5. Una pestaña por mes + Estadísticas (17 nov 2026; reemplazan a la vieja «Resumen»).
  pestanasPorMes();
  Logger.log('Listo: colores, filtros, columna Mes, pestañas por mes y ' + RG.ESTAD + '. ' + libro.getUrl());
}

// =====================================================================
// Una pestaña por mes y Estadísticas (17 nov 2026, pedido de JC, mockup
// docs/superpowers/specs/2026-11-17-registro-por-mes-mockup.html)
// ---------------------------------------------------------------------
// «Cotizaciones» sigue siendo el ARCHIVO: ahí escribe doPost, como siempre.
// Cada pestaña de mes es una VISTA (FILTER sobre el archivo, por la columna
// Mes): no guarda datos, así que nada se duplica ni se puede desordenar.
// «Estadísticas» cuenta por agente con fórmulas, según el mes que se elija.
// pestanasPorMes() corre sola cada día a las 12 de la noche (instalarPestanas):
// el día 1 aparece la pestaña del mes nuevo. Se puede correr a mano cuando se quiera.
// =====================================================================

/** "2026-11 · noviembre" → "Noviembre 2026" (nombre de la pestaña). */
function nombrePestana_(clave) {
  var t = String(clave).match(/^(\d{4})-(\d{2})/);
  if (!t) return '';
  var mes = MESES_[Number(t[2]) - 1];
  return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + t[1];
}

/** Meses que hay en el archivo (más el actual), del más nuevo al más viejo. */
function mesesDe_(valores, hoy) {
  var vistos = {};
  valores.forEach(function (v) { var s = String(v || ''); if (/^\d{4}-\d{2} · /.test(s)) vistos[s] = true; });
  var actual = mesDe_(hoy);
  if (actual) vistos[actual] = true;
  return Object.keys(vistos).sort().reverse();
}

/** Referencia a una columna entera del archivo: 'Cotizaciones'!D:D */
function refCol_(clave) { var l = letra_(col_(clave)); return "'" + RG.HOJA + "'!" + l + ':' + l; }

/** Fórmula de la pestaña de un mes: las filas del archivo cuyo Mes es esa clave. */
function formulaMes_(clave) {
  var ultima = letra_(RG.COLUMNAS.length), m = letra_(col_('mes'));
  return '=IFERROR(FILTER(\'' + RG.HOJA + '\'!A2:' + ultima + ', \'' + RG.HOJA + '\'!' + m + '2:' + m + '="' + clave + '"), "Todavía no hay solicitudes en este mes.")';
}

/** Personas de la lista de colores agrupadas por nombre (Melanie tiene dos correos). */
function personasAgrupadas_() {
  var orden = [], por = {};
  RG.PERSONAS.forEach(function (p) {
    if (!por[p.nombre]) { por[p.nombre] = { nombre: p.nombre, fuerte: p.fuerte, correos: [] }; orden.push(por[p.nombre]); }
    por[p.nombre].correos.push(p.correo);
  });
  return orden;
}

var CRIT_MES_ = 'IF($B$3="Todos los meses","?*",$B$3)';

/** Suma de COUNTIFS (o SUMIFS) de una persona: uno por cada correo suyo. extra = criterios adicionales. */
function cuentaPersona_(correos, extra, sumaDe) {
  return correos.map(function (c) {
    return (sumaDe ? 'SUMIFS(' + refCol_(sumaDe) + ',' : 'COUNTIFS(') +
      refCol_('correoAgente') + ',"' + c + '",' + refCol_('mes') + ',' + CRIT_MES_ + (extra || '') + ')';
  }).join('+');
}

/** Las filas de la tabla de Estadísticas: [etiqueta, color, fórmulas…] empezando en la fila `desde`. */
function filasEstadisticas_(desde) {
  var C = refCol_('turno'), B = refCol_('agente');
  var tipos = [',' + C + ',"* de *"', ',' + C + ',"*por turno"', ',' + C + ',"*directo"', ',' + C + ',"Reparto apagado"'];
  var gente = personasAgrupadas_();
  var filaTot = desde + gente.length + 2;   // personas, Sin asignar, Otros, Total
  var filas = gente.map(function (p, i) {
    var r = desde + i;
    return [p.nombre, p.fuerte,
      '=' + cuentaPersona_(p.correos, ''),
      '=IFERROR(B' + r + '/$B$' + filaTot + ',0)']
      .concat(tipos.map(function (t) { return '=' + cuentaPersona_(p.correos, t); }))
      .concat(['=IFERROR((' + cuentaPersona_(p.correos, '', 'valor') + ')/B' + r + ',"—")']);
  });
  var rSin = desde + gente.length;
  var critSin = B + ',"' + RG.SIN_ASIGNAR.nombre + '",' + refCol_('mes') + ',' + CRIT_MES_;
  filas.push([RG.SIN_ASIGNAR.nombre + ' (menos de ₡4 millones)', RG.SIN_ASIGNAR.fuerte,
    '=COUNTIFS(' + critSin + ')', '=IFERROR(B' + rSin + '/$B$' + filaTot + ',0)', '—', '—', '—', '—',
    '=IFERROR(SUMIFS(' + refCol_('valor') + ',' + critSin + ')/B' + rSin + ',"—")']);
  var rOtr = rSin + 1;
  filas.push(['Otros agentes', '#80868B',
    '=B' + filaTot + '-SUM(B' + desde + ':B' + rSin + ')', '=IFERROR(B' + rOtr + '/$B$' + filaTot + ',0)', '', '', '', '', '']);
  var critTot = refCol_('mes') + ',' + CRIT_MES_;
  filas.push(['Total', null, '=COUNTIFS(' + critTot + ')', '=IF(B' + filaTot + '>0,1,0)']
    .concat(["D", "E", "F", "G"].map(function (l) { return '=SUM(' + l + desde + ':' + l + rSin + ')'; }))
    .concat(['=IFERROR(SUMIFS(' + refCol_('valor') + ',' + critTot + ')/B' + filaTot + ',"—")']));
  return filas;
}

/** Arma (o rehace) la pestaña de un mes. Vista de solo lectura sobre el archivo. */
function pestanaMes_(libro, clave) {
  var nombre = nombrePestana_(clave), n = RG.COLUMNAS.length;
  var sh = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  sh.getFilter() && sh.getFilter().remove();
  sh.getRange(1, 1, 1, n).setValues([RG.COLUMNAS.map(function (c) { return c[1]; })])
    .setFontWeight('bold').setBackground('#F1F3F4');
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), n).clearContent();
  sh.getRange('A2').setFormula(formulaMes_(clave));
  sh.setFrozenRows(1);
  sh.getRange(2, col_('valor'), sh.getMaxRows() - 1, 1).setNumberFormat('#,##0');
  coloresPorPersona_(sh);
  sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  sh.hideColumns(col_('mes'));   // es la misma para todas las filas de la pestaña
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
  sh.protect().setDescription('Vista del mes: se escribe en «' + RG.HOJA + '»').setWarningOnly(true);
  return sh;
}

/** Colores por persona (fila suave, celda del agente fuerte), igual que en el archivo. */
function coloresPorPersona_(hoja) {
  var n = RG.COLUMNAS.length, cAg = col_('agente'), filas = hoja.getMaxRows() - 1;
  var celdaAg = hoja.getRange(2, cAg, filas, 1), fila = hoja.getRange(2, 1, filas, n);
  var D = '$' + letra_(col_('correoAgente')) + '2', B = '$' + letra_(cAg) + '2';
  var fuertes = [], suaves = [];
  var regla = function (f, p) {
    fuertes.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f)
      .setBackground(p.fuerte).setFontColor('#FFFFFF').setBold(true).setRanges([celdaAg]).build());
    suaves.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f)
      .setBackground(p.suave).setRanges([fila]).build());
  };
  RG.PERSONAS.forEach(function (p) { regla('=LOWER(TRIM(' + D + '))="' + p.correo + '"', p); });
  regla('=' + B + '="' + RG.SIN_ASIGNAR.nombre + '"', RG.SIN_ASIGNAR);
  hoja.setConditionalFormatRules(fuertes.concat(suaves));   // las fuertes primero: ganan en la celda del agente
}

/** La pestaña Estadísticas: tabla por agente del mes elegido + histórico mes a mes. */
function estadisticas_(libro, archivo, claves) {
  var est = libro.getSheetByName(RG.ESTAD) || libro.insertSheet(RG.ESTAD);
  var antes = String(est.getRange('B3').getValue() || '');
  var opciones = claves.concat(['Todos los meses']);
  est.getPivotTables().forEach(function (t) { t.remove(); });
  est.clear(); est.clearConditionalFormatRules(); est.getRange('B3').clearDataValidations();

  est.getRange('A1').setValue('Asignación de solicitudes por agente').setFontWeight('bold').setFontSize(13);
  est.getRange('A2').setValue('Se actualiza sola con cada solicitud nueva. Elegí el mes en la celda amarilla.').setFontColor('#5F6368');
  est.getRange('A3').setValue('Mes:').setFontWeight('bold');
  est.getRange('B3').setValue(opciones.indexOf(antes) >= 0 ? antes : claves[0])
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones, true).setAllowInvalid(false).build())
    .setBackground('#FFF2CC').setFontWeight('bold');

  var enc = ["Agente", "Solicitudes", "% del mes", "Por turno", "Valor alto · por turno", "Valor alto · directo", "Reparto apagado", "Valor asegurado promedio"];
  est.getRange(5, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setBackground('#F1F3F4');
  var filas = filasEstadisticas_(6);
  filas.forEach(function (f, i) {
    var r = 6 + i;
    est.getRange(r, 1).setValue(f[0]);
    est.getRange(r, 2, 1, enc.length - 1).setFormulas([f.slice(2).map(function (v) { return String(v).charAt(0) === '=' ? v : ''; })]);
    f.slice(2).forEach(function (v, j) { if (String(v).charAt(0) !== '=') est.getRange(r, 2 + j).setValue(v); });
    if (f[1]) est.getRange(r, 1).setBackground(f[1]).setFontColor('#FFFFFF').setFontWeight('bold');
  });
  var ult = 6 + filas.length - 1;
  est.getRange(ult, 1, 1, enc.length).setFontWeight('bold').setBackground('#F1F3F4');
  est.getRange(6, 3, filas.length, 1).setNumberFormat('0.0%');
  est.getRange(6, 8, filas.length, 1).setNumberFormat('₡#,##0');
  est.getRange(6, 2, filas.length, 6).setHorizontalAlignment('right');
  est.getRange(5, 1, filas.length + 1, enc.length).setBorder(true, true, true, true, true, true, '#E1E3E6', SpreadsheetApp.BorderStyle.SOLID);

  // Histórico: solicitudes por agente y por mes (la tabla dinámica que antes vivía en «Resumen»).
  var hIni = ult + 3;
  est.getRange(hIni, 1).setValue('Histórico por mes').setFontWeight('bold').setFontSize(13);
  var tabla = est.getRange(hIni + 2, 1).createPivotTable(archivo.getRange(1, 1, archivo.getMaxRows(), RG.COLUMNAS.length));
  tabla.addRowGroup(col_('agente'));
  tabla.addColumnGroup(col_('mes')).sortDescending();
  tabla.addPivotValue(col_('fecha'), SpreadsheetApp.PivotTableSummarizeFunction.COUNTA).setDisplayName('Solicitudes');
  tabla.addFilter(col_('mes'), SpreadsheetApp.newFilterCriteria().whenCellNotEmpty().build());
  var colHist = est.getRange(hIni + 3, 1, 60, 1);
  est.setConditionalFormatRules(RG.PERSONAS.concat([RG.SIN_ASIGNAR]).map(function (p) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith(p.nombre)
      .setBackground(p.fuerte).setFontColor('#FFFFFF').setBold(true).setRanges([colHist]).build();
  }));
  est.setColumnWidth(1, 300);
  est.setColumnWidths(2, 24, 160);
  est.setFrozenRows(3);
}

/** Crea las pestañas que falten, rehace Estadísticas y ordena: Estadísticas, meses (nuevo primero), archivo. */
function pestanasPorMes() {
  var libro = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID'));
  var archivo = libro.getSheetByName(RG.HOJA);
  var ult = archivo.getLastRow();
  var valores = ult > 1 ? archivo.getRange(2, col_('mes'), ult - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  var claves = mesesDe_(valores, new Date());
  claves.forEach(function (k) { if (!libro.getSheetByName(nombrePestana_(k))) pestanaMes_(libro, k); });
  estadisticas_(libro, archivo, claves);
  var vieja = libro.getSheetByName(RG.RESUMEN);   // la reemplaza Estadísticas (solo tenía la tabla dinámica)
  if (vieja) libro.deleteSheet(vieja);
  var orden = [RG.ESTAD].concat(claves.map(nombrePestana_)).concat([RG.HOJA]);
  orden.forEach(function (nombre, i) {
    var sh = libro.getSheetByName(nombre);
    if (sh) { libro.setActiveSheet(sh); libro.moveActiveSheet(i + 1); }
  });
  libro.setActiveSheet(libro.getSheetByName(RG.ESTAD));
}

/** Rehace TODAS las pestañas de mes (si se cambian columnas o colores). */
function rehacerPestanas() {
  var libro = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID'));
  var archivo = libro.getSheetByName(RG.HOJA), ult = archivo.getLastRow();
  var valores = ult > 1 ? archivo.getRange(2, col_('mes'), ult - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  mesesDe_(valores, new Date()).forEach(function (k) { pestanaMes_(libro, k); });
  pestanasPorMes();
}

/** Una vez: el activador diario (12 de la noche, hora CR) y la primera corrida. */
function instalarPestanas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pestanasPorMes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pestanasPorMes').timeBased().everyDays(1).atHour(0).nearMinute(5).create();
  pestanasPorMes();
  Logger.log('Activador diario instalado y pestañas al día.');
}

function instalar() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('HOJA_ID');
  var libro = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Registro · Formulario de cotización SDI');
  props.setProperty('HOJA_ID', libro.getId());
  var hoja = libro.getSheetByName(RG.HOJA) || libro.getSheets()[0].setName(RG.HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(RG.COLUMNAS.map(function (c) { return c[1]; }));
    hoja.getRange(1, 1, 1, RG.COLUMNAS.length).setFontWeight('bold').setBackground('#F1F3F4');
    hoja.getRange(1, 2, 1, 1).setBackground('#FFF2CC');
    hoja.setFrozenRows(1);
  }
  var clave = props.getProperty('CLAVE');
  if (!clave) { clave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('CLAVE', clave); }
  Logger.log('Hoja: ' + libro.getUrl());
  Logger.log('CLAVE (va en COTIZAR_REGISTRO_CLAVE de Netlify): ' + clave);
}

function anotar_(fila) {
  var libro = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID'));
  var hoja = libro.getSheetByName(RG.HOJA);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    hoja.appendRow(RG.COLUMNAS.map(function (c) {
      var v = fila[c[0]] == null ? '' : fila[c[0]];
      // Un texto que empieza con = + - @ se anotaría como fórmula: se le pone un apóstrofo.
      return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
    }));
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  var salida = function (t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); };
  try {
    var cuerpo = JSON.parse(e.postData.contents);
    var clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
    if (!clave || cuerpo.clave !== clave) return salida('clave');
    anotar_(cuerpo.fila || {});
    return salida('ok');
  } catch (err) {
    console.error(err);
    return salida('error');
  }
}

function probar() {
  anotar_({ fecha: 'PRUEBA', agente: 'Agente de prueba', turno: '1 de 5', nombre: 'Cliente Inventado', cedula: '0 0000 0000',
    telefono: '8888-0000', correo: 'prueba@ejemplo.test', tipo: 'Usado', vehiculo: 'ABC123', valor: 1000000, uso: 'Personal',
    interes: 'Soy el actual propietario Registral', clienteAvisado: 'Sí' });
  Logger.log('Fila de prueba anotada. Borrala de la hoja cuando la veas.');
}
