/** Tests de los dos correos de la cita. Datos INVENTADOS. node tests/test-cita-correos.mjs */
import { correoCliente, correoAgente, fechaLarga, fechaCorta, nombrePila } from '../netlify/functions/lib/cita-correos.mjs';

let pass = 0, fail = 0;
function ok(n, c) { if (c) pass++; else { fail++; console.error('FAIL ' + n); } }

const d = {
  nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test',
  direccion: 'Heredia, Belen.\nCasa porton gris', ocupacion: 'Contadora', ingreso: 'De ₡1.000.000 a ₡2.000.000',
  placa: 'BDF482', formaPago: 'Semestral', fecha: '2026-09-22', franja: '03:00 pm a 05:00 pm',
  n: 'Agente Prueba Uno', l: '00-0000', tel: '8888-1111', wa: '8888-1111', ae: 'agente@ejemplo.test',
  c: 'Mariela', v: 'TOYOTA RAV4', y: '2021', pa: '570891', ps: '308283', pt: '158423', as: ['mascota', 'premium']
};

ok('fechaLarga', fechaLarga('2026-09-22') === 'martes 22 de setiembre de 2026');
ok('fechaCorta', fechaCorta('2026-09-22') === 'mar 22 sep');
ok('nombrePila usa c', nombrePila(d) === 'Mariela');
ok('nombrePila sin c usa la primera palabra', nombrePila({ c: '', nombre: 'Ana Mora' }) === 'Ana');

const cl = correoCliente(d);
ok('cliente: asunto con placa', cl.asunto === 'Recibimos tu solicitud de cita · BDF482');
ok('cliente: saluda por el nombre de pila', cl.html.indexOf('>Mariela<') !== -1);
ok('cliente: dice Solicitud recibida', cl.html.indexOf('Solicitud recibida') !== -1);
ok('cliente: NO dice cita agendada/confirmada', !/cita (agendada|confirmada)/i.test(cl.html));
ok('cliente: fecha larga y franja', cl.html.indexOf('martes 22 de setiembre de 2026') !== -1 && cl.html.indexOf('03:00 pm a 05:00 pm') !== -1);
ok('cliente: avisa la reprogramacion', /reprogramar/.test(cl.html));
ok('cliente: nombra las asistencias', cl.html.indexOf('Mascota') !== -1 && cl.html.indexOf('Salud Premium') !== -1);
ok('cliente: firma con el agente del POST', cl.html.indexOf('Agente Prueba Uno') !== -1 && cl.html.indexOf('00-0000') !== -1);
ok('cliente: NO lleva la ficha del dueño', cl.html.indexOf('08-1318') === -1 && !/Juan Carlos/.test(cl.html));
ok('cliente: NO repite domicilio ni ingreso', cl.html.indexOf('porton gris') === -1 && cl.html.indexOf('1.000.000') === -1);
ok('cliente: trato de vos', /Preparate/.test(cl.html) && !/\busted\b/i.test(cl.html));
ok('cliente: sin border-left', cl.html.indexOf('border-left') === -1);
ok('cliente: logos alojados con URL absoluta', /src="https:\/\/cotizador\.appsegurosdigitales\.com\/img\/ins-logo\.png"/.test(cl.html));
ok('cliente: trae texto plano', typeof cl.texto === 'string' && cl.texto.indexOf('BDF482') !== -1 && cl.texto.indexOf('<') === -1);
ok('cliente sin asistencias: no sale el renglon', correoCliente(Object.assign({}, d, { as: [] })).html.indexOf('Asistencias opcionales') === -1);

const ag = correoAgente(d, { clienteAvisado: true });
ok('agente: asunto ordenable', ag.asunto === 'Cita solicitada · BDF482 · mar 22 sep · 3-5 pm · Mariela Quesada Rojas');
ok('agente: trae las 10 respuestas', ['Mariela Quesada Rojas', 'mariela@ejemplo.test', '8888-0000', 'Casa porton gris', 'Contadora', 'De ₡1.000.000 a ₡2.000.000', 'BDF482', 'Semestral', '22/09/2026', '03:00 pm a 05:00 pm'].every((t) => ag.html.indexOf(t) !== -1));
ok('agente: primas con punto de miles', ag.html.indexOf('₡570.891') !== -1 && ag.html.indexOf('₡308.283') !== -1);
ok('agente: WhatsApp al cliente por web.whatsapp', ag.html.indexOf('https://web.whatsapp.com/send/?phone=50688880000') !== -1 && ag.html.indexOf('wa.me') === -1);
ok('agente: bloque para copiar', ag.html.indexOf('Para copiar y pegar') !== -1);
ok('agente: sin nota de fallo cuando el cliente fue avisado', ag.html.indexOf('No se pudo enviar la confirmaci') === -1);
ok('agente: con nota cuando NO fue avisado', correoAgente(d, { clienteAvisado: false }).html.indexOf('No se pudo enviar la confirmaci') !== -1);

const xss = Object.assign({}, d, { nombre: '<img src=x onerror=alert(1)>', direccion: '<svg onload=alert(1)>', c: '<b>x</b>' });
ok('escapa en el correo del agente', correoAgente(xss, { clienteAvisado: true }).html.indexOf('<img src=x') === -1 && correoAgente(xss, { clienteAvisado: true }).html.indexOf('<svg') === -1);
ok('escapa en el correo del cliente', correoCliente(xss).html.indexOf('<b>x</b>') === -1);

const cero = Object.assign({}, d, { placa: 'Cero kilómetros' });
ok('0 km: el asunto del agente dice 0 KM', correoAgente(cero, { clienteAvisado: true }).asunto.indexOf('· 0 KM ·') !== -1);

console.log(pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
