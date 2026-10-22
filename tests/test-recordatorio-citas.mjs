/** Tests del recordatorio de citas (Apps Script). Datos INVENTADOS. node tests/test-recordatorio-citas.mjs */
import { createRequire } from 'node:module';
import { correoAgente, fechaCorta } from '../netlify/functions/lib/cita-correos.mjs';
const require = createRequire(import.meta.url);
const R = require('../apps-script/recordatorio-citas/recordatorio-citas.js');

let pass = 0, fail = 0;
function ok(n, c) { if (c) pass++; else { fail++; console.error('FAIL ' + n); } }

const d = {
  nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test',
  direccion: 'Heredia, Belen.\nCasa porton gris', ocupacion: 'Contadora', ingreso: 'De ₡1.000.000 a ₡2.000.000',
  placa: 'BDF482', formaPago: 'Semestral', fecha: '2026-09-22', franja: '03:00 pm a 05:00 pm',
  n: 'Agente Prueba Uno', l: '00-0000', tel: '8888-1111', wa: '8888-1111', ae: 'agente@ejemplo.test',
  c: 'Mariela', v: 'TOYOTA RAV4', y: '2021', pa: '570891', ps: '308283', pt: '158423', as: ['mascota', 'premium'],
};

// El circuito real: el asunto y el texto que arma correoAgente() son lo que lee el recordatorio.
// Si cambia el formato del correo al agente, esto falla.
const ag = correoAgente(d, { clienteAvisado: true });
const t = R.rcDatosDelTitulo(ag.asunto);
ok('titulo: es cita', R.rcEsCita(ag.asunto) && R.rcEsCita('  cita solicitada · X') && !R.rcEsCita('Revisión Google Ads'));
ok('titulo: placa', t.placa === 'BDF482');
ok('titulo: fecha corta', t.fecha === 'mar 22 sep');
ok('titulo: franja', t.franja === '3-5 pm');
ok('titulo: nombre', t.nombre === 'Mariela Quesada Rojas');

const s = R.rcLeerSolicitud(ag.texto);
ok('solicitud: nombre', s && s.nombre === 'Mariela Quesada Rojas');
ok('solicitud: telefono', s && s.telefono === '8888-0000');
ok('solicitud: correo', s && s.correo === 'mariela@ejemplo.test');
ok('solicitud: direccion en una linea', s && s.direccion === 'Heredia, Belen. Casa porton gris');
ok('solicitud: placa', s && s.placa === 'BDF482');
ok('solicitud: forma de pago', s && s.formaPago === 'Semestral');
ok('solicitud: vehiculo', s && s.vehiculo === 'TOYOTA RAV4 2021');
ok('solicitud: asistencias', s && s.asistencias === 'Mascota, Salud Premium');
ok('solicitud: tolera CRLF', R.rcLeerSolicitud(ag.texto.replace(/\n/g, '\r\n')).telefono === '8888-0000');
ok('solicitud: sin asistencias no inventa', R.rcLeerSolicitud(correoAgente(Object.assign({}, d, { as: [] }), {}).texto).asistencias === undefined);
ok('solicitud: texto ajeno da null', R.rcLeerSolicitud('Hola\nnada que ver') === null);

// Fechas y horas
ok('fecha corta igual a la del correo (mie)', R.rcFechaCorta('2026-10-21') === fechaCorta('2026-10-21') && R.rcFechaCorta('2026-10-21') === 'mie 21 oct');
ok('fecha corta igual a la del correo (sab)', R.rcFechaCorta('2026-10-24') === fechaCorta('2026-10-24'));
ok('fecha larga', R.rcFechaLarga('2026-10-27') === 'martes 27 de octubre');
ok('hora am', R.rcHora(8, 0) === '8:00 am' && R.rcHora(10, 30) === '10:30 am');
ok('hora mediodia', R.rcHora(12, 0) === '12:00 md' && R.rcHora(12, 30) === '12:30 pm');
ok('hora pm', R.rcHora(13, 0) === '1:00 pm' && R.rcHora(15, 5) === '3:05 pm');
ok('hora medianoche', R.rcHora(0, 0) === '12:00 am');
ok('whatsapp intl', R.rcWaIntl('8888-0000') === '50688880000' && R.rcWaIntl('+506 8888 0000') === '50688880000');

// El correo del recordatorio
const hoy = '2026-09-22';
const citas = [
  { hora: '3:00 pm', titulo: ag.asunto, sol: s, linkCorreo: 'https://mail.google.com/mail/?authuser=a%40b.test#all/abc', linkCalendario: 'https://www.google.com/calendar/event?eid=x' },
  { hora: '9:00 am', titulo: 'Cita solicitada · CL306735 · lun 21 sep · 10-12 md · Pedro <b>Mora</b>', sol: null, linkCorreo: '', linkCalendario: '' },
];
const c = R.rcArmarCorreo(hoy, citas);
ok('correo: asunto', c.asunto === 'Citas de hoy · mar 22 sep · 2 citas');
ok('correo: asunto con una sola', R.rcArmarCorreo(hoy, citas.slice(0, 1)).asunto === 'Citas de hoy · mar 22 sep · 1 cita');
ok('correo: prueba marca el asunto', R.rcArmarCorreo(hoy, citas, { prueba: true }).asunto.indexOf('[Prueba] ') === 0);
ok('correo: titulo con fecha larga', c.html.indexOf('martes 22 de setiembre &middot; 2 citas') !== -1);
ok('correo: hora y nombre', c.html.indexOf('3:00 pm &middot; Mariela Quesada Rojas') !== -1);
ok('correo: telefono con tel:', c.html.indexOf('href="tel:8888-0000"') === -1 && c.html.indexOf('href="tel:88880000"') !== -1);
ok('correo: whatsapp por web.whatsapp.com, nunca wa.me', c.html.indexOf('https://web.whatsapp.com/send/?phone=50688880000') !== -1 && c.html.indexOf('wa.me') === -1);
ok('correo: franja pedida el mismo dia', c.html.indexOf('Franja que pidió: 3-5 pm') !== -1);
ok('correo: reprogramada si el titulo trae otra fecha', c.html.indexOf('Reprogramada · pidió lun 21 sep, 10-12 md') !== -1);
ok('correo: sin solicitud avisa', c.html.indexOf('No encontré el correo de esta solicitud') !== -1);
ok('correo: escapa el nombre del titulo', c.html.indexOf('<b>Mora</b>') === -1 && c.html.indexOf('&lt;b&gt;Mora') !== -1);
ok('correo: enlaces a la solicitud y a Calendar', c.html.indexOf('Ver la solicitud') !== -1 && c.html.indexOf('Abrir en Calendar') !== -1);
ok('correo: escapa el & del enlace', c.html.indexOf('authuser=a%40b.test#all/abc') !== -1);
ok('correo: sin border-left', c.html.indexOf('border-left') === -1);
ok('correo: nunca domicilio en el asunto', c.asunto.indexOf('Heredia') === -1);
ok('correo: texto plano con telefono', c.texto.indexOf('Teléfono: 8888-0000') !== -1 && c.texto.indexOf('CITAS DE HOY') === 0);

console.log((fail ? 'FALLAS ' : 'OK ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
