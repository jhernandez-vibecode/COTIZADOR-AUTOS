// =====================================================================
// Recordatorio de citas  ·  Apps Script en la cuenta de Google del agente
// ---------------------------------------------------------------------
// Cada mañana (6:00 am, Google le da un margen de 15 minutos para un lado o
// el otro) revisa el calendario principal, toma los eventos de HOY cuyo título
// empieza con "Cita solicitada" (el que pone el botón "Agregar a Calendario"
// de Gmail sobre el correo de /cita/) y le manda al mismo agente UN correo con
// todas. Sin citas, no manda nada.
//
// La hora de cada cita sale del EVENTO (si el agente la movió, manda el
// calendario). Los datos del cliente salen del correo "Cita solicitada"
// original: la parte de texto que arma correoAgente() en
// netlify/functions/lib/cita-correos.mjs. Si ese formato cambia,
// tests/test-recordatorio-citas.mjs falla.
//
// Multi-agente: nada escrito a mano del agente. El destinatario es el dueño de
// la cuenta donde se instala. Permisos (appsscript.json): calendario y correo
// de SOLO LECTURA, enviar correo a nombre del agente y correr a una hora fija.
//
// Instalación (una vez por agente): pegar este archivo y appsscript.json en un
// proyecto nuevo de script.google.com, ejecutar instalar() y aceptar permisos.
// Prueba: probar() manda el de la próxima fecha con citas, con "[Prueba]" en el
// asunto, a la propiedad del script CORREO_PRUEBA (o al dueño si no existe).
// =====================================================================

var RC = {
  PREFIJO: 'Cita solicitada',
  REMITENTE: 'citas@appsegurosdigitales.com',
  ZONA: 'America/Costa_Rica',
  HORA: 6,
  MINUTO: 0,
  NOMBRE_ENVIO: 'Recordatorio de citas · SDI',
};

var RC_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Misma abreviatura que fechaCorta() de cita-correos.mjs: sin tilde ("mie", "sab").
var RC_DIAS_CORTOS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
var RC_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
var RC_MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var RC_F = 'Arial,Helvetica,sans-serif';

// ---------------------------------------------------------------------
// Puras (se prueban en Node)
// ---------------------------------------------------------------------

function rcEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rcEsCita(titulo) {
  return String(titulo || '').trim().toLowerCase().indexOf(RC.PREFIJO.toLowerCase()) === 0;
}

// "2026-10-27" -> Date a medianoche UTC, solo para sacar día de la semana y mes.
function rcUtc(f) {
  var p = String(f).split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}
function rcFechaLarga(f) { var t = rcUtc(f); return RC_DIAS[t.getUTCDay()] + ' ' + t.getUTCDate() + ' de ' + RC_MESES[t.getUTCMonth()]; }
function rcFechaCorta(f) { var t = rcUtc(f); return RC_DIAS_CORTOS[t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + RC_MESES_CORTOS[t.getUTCMonth()]; }

// 10:00 -> "10:00 am" · 12:00 -> "12:00 md" · 13:30 -> "1:30 pm" (como las franjas del formulario).
function rcHora(h, m) {
  var mm = (m < 10 ? '0' : '') + m;
  if (h === 12 && m === 0) return '12:00 md';
  var suf = h < 12 ? 'am' : 'pm';
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + mm + ' ' + suf;
}

// "Cita solicitada · AAQ592 · mar 27 oct · 10-12 md · Ariel Sanabria Barahona"
function rcDatosDelTitulo(titulo) {
  var p = String(titulo || '').split('·').map(function (x) { return x.trim(); });
  return { placa: p[1] || '', fecha: p[2] || '', franja: p[3] || '', nombre: p.slice(4).join(' · ') };
}

// La parte de texto del correo al agente (correoAgente().texto):
//   CITA SOLICITADA / fecha · franja / (vacía) / nombre | teléfono | correo /
//   dirección / ocupación | ingreso | placa | forma de pago /
//   Cita: dd/mm/aaaa · franja | Asistencias: ... / Vehículo: ... / ...
function rcLeerSolicitud(texto) {
  var lineas = String(texto || '').replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); });
  var d = {};
  var i = -1;
  for (var k = 0; k < lineas.length; k++) {
    var c = lineas[k].split(' | ');
    if (c.length === 3 && c[2].indexOf('@') > 0) { i = k; d.nombre = c[0]; d.telefono = c[1]; d.correo = c[2]; break; }
  }
  if (i < 0) return null;
  d.direccion = lineas[i + 1] || '';
  var c2 = String(lineas[i + 2] || '').split(' | ');
  if (c2.length === 4) { d.placa = c2[2]; d.formaPago = c2[3]; }
  lineas.forEach(function (l) {
    var a = l.match(/\| Asistencias: (.+)$/);
    if (a) d.asistencias = a[1];
    if (l.indexOf('Vehículo: ') === 0) d.vehiculo = l.slice(10);
  });
  return d;
}

function rcWaIntl(v) { var n = String(v || '').replace(/\D/g, ''); return n.length === 8 ? '506' + n : n; }

// fechaISO "2026-10-27"; citas: [{hora, titulo, sol (rcLeerSolicitud o null), linkCorreo, linkCalendario}]
function rcArmarCorreo(fechaISO, citas, opc) {
  opc = opc || {};
  var n = citas.length;
  var cuenta = n + (n === 1 ? ' cita' : ' citas');
  var hoyCorto = rcFechaCorta(fechaISO);
  var fila = function (k, v) {
    return '<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #EDEFF2;color:#5A6570;width:30%;vertical-align:top;font-family:' + RC_F + ';font-size:13.5px;">' + rcEsc(k) +
      '</td><td style="padding:6px 0;border-bottom:1px solid #EDEFF2;font-weight:bold;vertical-align:top;font-family:' + RC_F + ';font-size:13.5px;color:#1B1F23;">' + v + '</td></tr>';
  };
  var boton = function (href, txt) {
    return '<a href="' + rcEsc(href) + '" style="display:inline-block;background:#0369A1;color:#ffffff;text-decoration:none;font-family:' + RC_F + ';font-weight:bold;border-radius:999px;padding:10px 18px;font-size:13px;margin:0 8px 8px 0;">' + rcEsc(txt) + '</a>';
  };
  var enlace = function (href, txt) {
    return '<a href="' + rcEsc(href) + '" style="display:inline-block;color:#0369A1;font-family:' + RC_F + ';font-weight:bold;font-size:13px;margin:0 14px 8px 0;">' + rcEsc(txt) + '</a>';
  };

  var bloques = citas.map(function (c, idx) {
    var t = rcDatosDelTitulo(c.titulo);
    var s = c.sol || {};
    var nombre = s.nombre || t.nombre || 'Cliente';
    var pidio = t.fecha && t.fecha !== hoyCorto
      ? 'Reprogramada · pidió ' + t.fecha + (t.franja ? ', ' + t.franja : '')
      : (t.franja ? 'Franja que pidió: ' + t.franja : '');
    var filas = '';
    var placa = s.placa || t.placa;
    if (placa) filas += fila('Placa', rcEsc(placa));
    if (s.vehiculo) filas += fila('Vehículo', rcEsc(s.vehiculo));
    if (s.telefono) filas += fila('Teléfono', '<a href="tel:' + rcEsc(s.telefono.replace(/[^\d+]/g, '')) + '" style="color:#1B1F23;">' + rcEsc(s.telefono) + '</a>');
    if (s.direccion) filas += fila('Dirección', rcEsc(s.direccion));
    if (s.formaPago) filas += fila('Forma de pago', rcEsc(s.formaPago));
    if (s.asistencias) filas += fila('Asistencias', rcEsc(s.asistencias));
    var wa = rcWaIntl(s.telefono);
    var acciones = (wa ? boton('https://web.whatsapp.com/send/?phone=' + wa, 'Escribirle por WhatsApp') : '') +
      (c.linkCorreo ? enlace(c.linkCorreo, 'Ver la solicitud') : '') +
      (c.linkCalendario ? enlace(c.linkCalendario, 'Abrir en Calendar') : '');
    return '<div style="border-top:1px solid #DADCE0;padding-top:16px;margin-top:' + (idx ? '22' : '18') + 'px;">' +
      '<div style="font-family:' + RC_F + ';font-size:11px;letter-spacing:.08em;color:#6B7681;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Cita ' + (idx + 1) + ' de ' + n + '</div>' +
      '<div style="font-family:' + RC_F + ';font-size:20px;font-weight:bold;color:#1B1F23;">' + rcEsc(c.hora) + ' &middot; ' + rcEsc(nombre) + '</div>' +
      (pidio ? '<div style="font-family:' + RC_F + ';font-size:12.5px;color:#5A6570;margin-top:3px;">' + rcEsc(pidio) + '</div>' : '') +
      (filas ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">' + filas + '</table>' : '') +
      (c.sol ? '' : '<div style="font-family:' + RC_F + ';font-size:12.5px;color:#7C5A00;background:#FBF3DC;padding:8px 10px;margin-top:10px;">No encontré el correo de esta solicitud: los datos son solo los del calendario.</div>') +
      (acciones ? '<div style="margin-top:12px;">' + acciones + '</div>' : '') +
      '</div>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;"><tr><td style="padding:22px 24px;">' +
    '<div style="margin-bottom:10px;"><span style="display:inline-block;background:#E9F5F0;color:#037D61;font-family:' + RC_F + ';font-weight:bold;font-size:12.5px;border-radius:999px;padding:5px 12px;">&#9679; Citas de hoy</span></div>' +
    '<div style="font-family:' + RC_F + ';font-size:22px;font-weight:bold;color:#1B1F23;">' + rcEsc(rcFechaLarga(fechaISO)) + ' &middot; ' + rcEsc(cuenta) + '</div>' +
    bloques +
    '<p style="margin:22px 0 0;font-family:' + RC_F + ';font-size:12px;line-height:1.5;color:#6B7681;">Este aviso sale solo cada mañana con los eventos de tu calendario que empiezan con «Cita solicitada». Si movés o borrás una cita en el calendario, el aviso se ajusta solo.</p>' +
    '</td></tr></table></td></tr></table></body></html>';

  var texto = ['CITAS DE HOY', rcFechaLarga(fechaISO) + ' · ' + cuenta, ''].concat(citas.map(function (c) {
    var t = rcDatosDelTitulo(c.titulo);
    var s = c.sol || {};
    return [c.hora + ' · ' + (s.nombre || t.nombre || 'Cliente') + ' · ' + (s.placa || t.placa || ''),
      s.telefono ? 'Teléfono: ' + s.telefono : null,
      s.direccion ? 'Dirección: ' + s.direccion : null,
      c.linkCorreo ? 'Solicitud: ' + c.linkCorreo : null].filter(function (x) { return x !== null; }).join('\n');
  })).join('\n\n');

  return { asunto: (opc.prueba ? '[Prueba] ' : '') + 'Citas de hoy · ' + hoyCorto + ' · ' + cuenta, html: html, texto: texto };
}

// ---------------------------------------------------------------------
// Apps Script (Calendar y Gmail son servicios avanzados, ver appsscript.json)
// ---------------------------------------------------------------------

function rcHoyISO() { return Utilities.formatDate(new Date(), RC.ZONA, 'yyyy-MM-dd'); }
function rcOffset() { return Utilities.formatDate(new Date(), RC.ZONA, 'XXX'); }

function rcEventos(desdeISO, hastaISO) {
  var res = Calendar.Events.list('primary', {
    timeMin: desdeISO + 'T00:00:00' + rcOffset(), timeMax: hastaISO + 'T23:59:59' + rcOffset(),
    singleEvents: true, orderBy: 'startTime', q: RC.PREFIJO, maxResults: 100,
  });
  return (res.items || []).filter(function (e) { return e.status !== 'cancelled' && rcEsCita(e.summary); });
}

function rcFechaDelEvento(e) {
  return e.start.date || Utilities.formatDate(new Date(e.start.dateTime), RC.ZONA, 'yyyy-MM-dd');
}

function rcHoraDelEvento(e) {
  if (!e.start.dateTime) return 'Todo el día';
  var hm = Utilities.formatDate(new Date(e.start.dateTime), RC.ZONA, 'H:mm').split(':').map(Number);
  return rcHora(hm[0], hm[1]);
}

// Gmail entrega body.data en texto base64url o ya decodificado como bytes, según el servicio.
function rcDecodificar(data) {
  if (typeof data === 'string') return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
  return Utilities.newBlob(data).getDataAsString('UTF-8');
}
function rcTextoPlano(parte) {
  if (!parte) return '';
  if (parte.mimeType === 'text/plain' && parte.body && parte.body.data) return rcDecodificar(parte.body.data);
  var hijas = parte.parts || [];
  for (var i = 0; i < hijas.length; i++) { var t = rcTextoPlano(hijas[i]); if (t) return t; }
  return '';
}

// El correo original de la cita: mismo asunto que el título del evento; si el
// agente le cambió el título, el más reciente con la misma placa y el mismo nombre.
function rcBuscarSolicitud(titulo) {
  var t = rcDatosDelTitulo(titulo);
  var q = 'from:' + RC.REMITENTE + ' subject:"' + RC.PREFIJO + '"' + (t.placa ? ' "' + t.placa + '"' : '');
  var lista = Gmail.Users.Messages.list('me', { q: q, maxResults: 10 }).messages || [];
  var parecido = null;
  for (var i = 0; i < lista.length; i++) {
    var m = Gmail.Users.Messages.get('me', lista[i].id, { format: 'full' });
    var asunto = ((m.payload.headers || []).filter(function (h) { return h.name.toLowerCase() === 'subject'; })[0] || {}).value || '';
    var hallado = { sol: rcLeerSolicitud(rcTextoPlano(m.payload)), threadId: m.threadId };
    if (asunto.trim() === String(titulo).trim()) return hallado;
    if (!parecido && t.nombre && asunto.indexOf(t.nombre) >= 0) parecido = hallado;
  }
  return parecido;
}

function rcCitas(eventos, correoDueno) {
  return eventos.map(function (e) {
    var hallado = null;
    try { hallado = rcBuscarSolicitud(e.summary); } catch (err) { Logger.log('No se pudo leer el correo de "' + e.summary + '": ' + err); }
    return {
      hora: rcHoraDelEvento(e), titulo: e.summary, sol: hallado && hallado.sol,
      linkCorreo: hallado ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(correoDueno) + '#all/' + hallado.threadId : '',
      linkCalendario: e.htmlLink || '',
    };
  });
}

function rcEnviar(fechaISO, eventos, opc) {
  var dueno = Gmail.Users.getProfile('me').emailAddress;
  var para = (opc && opc.para) || dueno;
  var c = rcArmarCorreo(fechaISO, rcCitas(eventos, dueno), opc);
  MailApp.sendEmail({ to: para, subject: c.asunto, htmlBody: c.html, body: c.texto, name: RC.NOMBRE_ENVIO });
  Logger.log('Enviado a ' + para + ': ' + c.asunto);
}

// Lo que corre cada mañana.
function enviarRecordatorio() {
  var hoy = rcHoyISO();
  var eventos = rcEventos(hoy, hoy);
  if (!eventos.length) { Logger.log('Sin citas hoy (' + hoy + '): no se envía nada.'); return; }
  rcEnviar(hoy, eventos);
}

// Una vez, al instalar. Se puede volver a correr: no duplica el horario.
function instalar() {
  desinstalar();
  ScriptApp.newTrigger('enviarRecordatorio').timeBased()
    .everyDays(1).atHour(RC.HORA).nearMinute(RC.MINUTO).inTimezone(RC.ZONA).create();
  Logger.log('Listo: el recordatorio sale todos los días cerca de las ' + rcHora(RC.HORA, RC.MINUTO) + '.');
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarRecordatorio') ScriptApp.deleteTrigger(t);
  });
}

// Manda ya el recordatorio de la próxima fecha con citas (próximos 30 días).
function probar() {
  var hoy = rcHoyISO();
  var hasta = Utilities.formatDate(new Date(Date.now() + 30 * 864e5), RC.ZONA, 'yyyy-MM-dd');
  var todos = rcEventos(hoy, hasta);
  if (!todos.length) { Logger.log('No hay citas en los próximos 30 días.'); return; }
  var fecha = rcFechaDelEvento(todos[0]);
  var delDia = todos.filter(function (e) { return rcFechaDelEvento(e) === fecha; });
  var prueba = PropertiesService.getScriptProperties().getProperty('CORREO_PRUEBA');
  rcEnviar(fecha, delDia, { prueba: true, para: prueba || '' });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RC: RC, rcEsCita: rcEsCita, rcFechaLarga: rcFechaLarga, rcFechaCorta: rcFechaCorta, rcHora: rcHora,
    rcDatosDelTitulo: rcDatosDelTitulo, rcLeerSolicitud: rcLeerSolicitud, rcWaIntl: rcWaIntl, rcArmarCorreo: rcArmarCorreo };
}
