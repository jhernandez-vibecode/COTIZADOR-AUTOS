/**
 * Tests de netlify/functions/lib/cita-validacion.mjs — qué solicitud de cita
 * se acepta. Datos INVENTADOS. Correr: node tests/test-cita-validacion.mjs
 */
import { validarCita, hoyCR, esDiaHabil, agentesAutorizados, FORMAS, FRANJAS, INGRESOS }
  from '../netlify/functions/lib/cita-validacion.mjs';

let pass = 0, fail = 0;
function ok(n, c) { if (c) pass++; else { fail++; console.error('FAIL ' + n); } }

// Viernes 18 set 2026, 10:00 en Costa Rica (16:00 UTC)
const AHORA = new Date('2026-09-18T16:00:00Z');
const agentes = agentesAutorizados(' Agente@Ejemplo.test , otro@ejemplo.test ');
const base = () => ({
  nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test',
  direccion: 'Heredia, Belen, La Ribera.\n200 m norte de la escuela', ocupacion: 'Contadora',
  ingreso: INGRESOS[2], placa: 'BDF482', formaPago: 'Semestral', fecha: '2026-09-22',
  franja: FRANJAS[3], consent: true, sitio: '',
  n: 'Agente Prueba Uno', l: '00-0000', tel: '8888-1111', wa: '8888-1111', ae: 'agente@ejemplo.test',
  c: 'Mariela', v: 'TOYOTA RAV4', y: '2021', pa: '570891', ps: '308283', pt: '158423', as: 'mascota.premium'
});
const v = (cambios) => validarCita(Object.assign(base(), cambios || {}), { agentes, now: AHORA });

ok('hoyCR usa la zona de Costa Rica', hoyCR(new Date('2026-09-19T03:00:00Z')) === '2026-09-18');
ok('martes es habil', esDiaHabil('2026-09-22'));
ok('sabado NO es habil', !esDiaHabil('2026-09-19'));
ok('domingo NO es habil', !esDiaHabil('2026-09-20'));
ok('la lista de agentes ignora mayusculas y espacios', agentes.has('agente@ejemplo.test') && agentes.size === 2);

const bueno = v();
ok('acepta la solicitud completa', bueno.ok === true);
ok('normaliza el correo del agente', bueno.datos.ae === 'agente@ejemplo.test');
ok('as queda como lista de ids validos', JSON.stringify(bueno.datos.as) === '["mascota","premium"]');
ok('acepta nombres con espacios', v({ nombre: 'DELGADO ARGUELLO SILVIA MARIEL' }).ok);
ok('la direccion SI admite salto de linea', bueno.datos.direccion.indexOf('\n') !== -1);
ok('opcionales vacios pasan', v({ ocupacion: '', ingreso: '' }).ok);
ok('hoy mismo (viernes) pasa', v({ fecha: '2026-09-18' }).ok);

ok('falta nombre', v({ nombre: '  ' }).campo === 'nombre');
ok('telefono con menos de 8 digitos', v({ telefono: '8888' }).campo === 'telefono');
ok('correo invalido', v({ correo: 'mariela@' }).campo === 'correo');
ok('falta direccion', v({ direccion: '' }).campo === 'direccion');
ok('falta placa', v({ placa: '' }).campo === 'placa');
ok('forma de pago fuera de lista', v({ formaPago: 'Mensual' }).campo === 'formaPago');
ok('franja fuera de lista', v({ franja: '6:00 pm' }).campo === 'franja');
ok('ingreso fuera de lista', v({ ingreso: '₡1' }).campo === 'ingreso');
ok('fecha pasada', v({ fecha: '2026-09-17' }).campo === 'fecha');
ok('fecha en sabado', v({ fecha: '2026-09-19' }).campo === 'fecha');
ok('fecha imposible', v({ fecha: '2026-02-31' }).campo === 'fecha');
ok('fecha mal formada', v({ fecha: '22/09/2026' }).campo === 'fecha');
ok('sin consentimiento', v({ consent: false }).campo === 'consent');
ok('consent "true" como texto no vale', v({ consent: 'true' }).campo === 'consent');
ok('CRLF en el nombre (inyeccion de cabecera)', v({ nombre: 'Ana\r\nBcc: x@y.z' }).campo === 'nombre');
ok('NUL en la placa', v({ placa: 'BDF\u0000482' }).campo === 'placa');
ok('nombre gigante', v({ nombre: 'x'.repeat(121) }).campo === 'nombre');
ok('direccion gigante', v({ direccion: 'x'.repeat(401) }).campo === 'direccion');

const fuera = v({ ae: 'intruso@ejemplo.test' });
ok('agente fuera de la lista → 403', fuera.ok === false && fuera.estado === 403);
ok('sin agentes configurados → 403', validarCita(base(), { agentes: new Set(), now: AHORA }).estado === 403);
ok('campo trampa lleno → trampa', v({ sitio: 'http://spam' }).trampa === true);
ok('as con id desconocido se descarta solo ese', JSON.stringify(v({ as: 'mascota.inventado' }).datos.as) === '["mascota"]');
ok('as repetido no se duplica', JSON.stringify(v({ as: 'vip.vip' }).datos.as) === '["vip"]');
ok('cuerpo null no revienta', validarCita(null, { agentes, now: AHORA }).ok === false);
ok('las tres formas son las del formulario', FORMAS.join('|') === 'Anual|Semestral|Trimestral');
ok('las cuatro franjas son las del formulario', FRANJAS.join('|') === '8:00 am a 10:00 am|10:00 am a 12:00 md|01:00 pm a 03:00 pm|03:00 pm a 05:00 pm');

console.log(pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
