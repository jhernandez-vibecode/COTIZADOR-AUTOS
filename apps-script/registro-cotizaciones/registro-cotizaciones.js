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
// =====================================================================

var RG = {
  HOJA: 'Cotizaciones',
  COLUMNAS: [
    ['fecha', 'Fecha'], ['agente', 'Agente asignado'], ['turno', 'Turno'], ['correoAgente', 'Correo del agente'],
    ['nombre', 'Nombre del propietario'], ['cedula', 'Número de Cédula'], ['telefono', 'Teléfono'], ['correo', 'Correo'],
    ['tipo', 'Su vehículo es'], ['vehiculo', 'Placa / Marca y modelo'], ['valor', 'Valor'], ['uso', 'Uso del Vehículo'],
    ['interes', 'Interés Asegurable'], ['inscribe', 'A nombre de quién se inscribe'], ['cedulaInscribe', 'Cédula de quien inscribe'],
    ['combustible', 'Tipo de Combustible'], ['tipoVehiculo', 'Tipo de Vehículo'], ['info', 'Información Adicional'],
    ['clienteAvisado', 'Confirmación al cliente']
  ]
};

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
