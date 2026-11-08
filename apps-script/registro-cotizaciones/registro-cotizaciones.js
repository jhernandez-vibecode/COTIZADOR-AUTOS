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
  RESUMEN: 'Resumen',
  // Un color por persona (JC, 8 nov 2026). Se reconoce por el correo del agente.
  // Para alguien nuevo: agregar una línea y volver a correr ordenar().
  PERSONAS: [
    { correo: 'jhernandez@segurosdelins.com', nombre: 'Juan Carlos', fuerte: '#1A73E8', suave: '#E8F0FE' },
    { correo: 'chernandez@seguros-ins.com', nombre: 'Cristian', fuerte: '#E8710A', suave: '#FEEFE3' },
    { correo: 'tramites@segurosdelins.com', nombre: 'José', fuerte: '#188038', suave: '#E6F4EA' },
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
  var filas = hoja.getMaxRows() - 1;
  var celdaAg = hoja.getRange(2, cAg, filas, 1), fila = hoja.getRange(2, 1, filas, n);
  var D = '$' + letra_(cCorreo) + '2', B = '$' + letra_(cAg) + '2';
  var reglas = [], suaves = [];
  RG.PERSONAS.forEach(function (p) {
    var f = '=LOWER(TRIM(' + D + '))="' + p.correo + '"';
    reglas.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f)
      .setBackground(p.fuerte).setFontColor('#FFFFFF').setBold(true).setRanges([celdaAg]).build());
    suaves.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f)
      .setBackground(p.suave).setRanges([fila]).build());
  });
  var fs = '=' + B + '="' + RG.SIN_ASIGNAR.nombre + '"';
  reglas.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(fs)
    .setBackground(RG.SIN_ASIGNAR.fuerte).setFontColor('#FFFFFF').setBold(true).setRanges([celdaAg]).build());
  suaves.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(fs)
    .setBackground(RG.SIN_ASIGNAR.suave).setRanges([fila]).build());
  hoja.setConditionalFormatRules(reglas.concat(suaves));   // las fuertes primero: ganan en la celda del agente

  // 4. Filtros en los encabezados (persona, mes, turno…), sobre todas las filas.
  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange(1, 1, hoja.getMaxRows(), n).createFilter();

  // 5. Pestaña Resumen: solicitudes por persona y por mes (tabla dinámica, se actualiza sola).
  var res = libro.getSheetByName(RG.RESUMEN) || libro.insertSheet(RG.RESUMEN);
  res.clear();
  res.getPivotTables().forEach(function (t) { t.remove(); });
  res.getRange('A1').setValue('Solicitudes por persona y por mes').setFontWeight('bold').setFontSize(13);
  res.getRange('A2').setValue('Se actualiza sola con cada solicitud nueva. Para ver el detalle, filtrá en la pestaña «' + RG.HOJA + '».').setFontColor('#5F6368');
  var origen = hoja.getRange(1, 1, hoja.getMaxRows(), n);
  var tabla = res.getRange('A4').createPivotTable(origen);
  tabla.addRowGroup(cAg);
  tabla.addColumnGroup(cMes).sortDescending();
  tabla.addPivotValue(cFecha, SpreadsheetApp.PivotTableSummarizeFunction.COUNTA).setDisplayName('Solicitudes');
  tabla.addFilter(cMes, SpreadsheetApp.newFilterCriteria().whenCellNotEmpty().build());
  var colRes = res.getRange('A5:A60');
  res.setConditionalFormatRules(RG.PERSONAS.concat([RG.SIN_ASIGNAR]).map(function (p) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith(p.nombre)
      .setBackground(p.fuerte).setFontColor('#FFFFFF').setBold(true).setRanges([colRes]).build();
  }));
  res.setColumnWidth(1, 260);
  Logger.log('Listo: colores, filtros, columna Mes y pestaña ' + RG.RESUMEN + '. ' + libro.getUrl());
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
