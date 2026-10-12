/** Tests de los dos correos de la cita. Datos INVENTADOS. node tests/test-cita-correos.mjs */
import fs from 'node:fs';
import { correoCliente, correoAgente, fechaLarga, fechaCorta, nombrePila, totalConAsistencias } from '../netlify/functions/lib/cita-correos.mjs';
import { INTERESES } from '../netlify/functions/lib/cita-validacion.mjs';

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
// 12 oct 2026: marca "SDI Seguros Digitales INS" (logo con la leyenda nueva, archivo nuevo al lado del viejo).
ok('cliente: pie SDI con el logo y el nombre nuevos', /src="https:\/\/cotizador\.appsegurosdigitales\.com\/img\/sdi-logo-email-ins\.png"/.test(cl.html) && cl.html.indexOf('Plataforma tecnológica SDI Seguros Digitales INS') !== -1);
ok('cliente: trae texto plano', typeof cl.texto === 'string' && cl.texto.indexOf('BDF482') !== -1 && cl.texto.indexOf('<') === -1);
ok('cliente sin asistencias: no sale el renglon', correoCliente(Object.assign({}, d, { as: [] })).html.indexOf('Asistencias opcionales') === -1);

const ag = correoAgente(d, { clienteAvisado: true });
ok('agente: asunto ordenable', ag.asunto === 'Cita solicitada · BDF482 · mar 22 sep · 3-5 pm · Mariela Quesada Rojas');
ok('agente: trae las 10 respuestas', ['Mariela Quesada Rojas', 'mariela@ejemplo.test', '8888-0000', 'Casa porton gris', 'Contadora', 'De ₡1.000.000 a ₡2.000.000', 'BDF482', 'Semestral', '22/09/2026', '03:00 pm a 05:00 pm'].every((t) => ag.html.indexOf(t) !== -1));
ok('agente: primas con punto de miles', ag.html.indexOf('₡570.891') !== -1 && ag.html.indexOf('₡308.283') !== -1);
ok('agente: WhatsApp al cliente por web.whatsapp', ag.html.indexOf('https://web.whatsapp.com/send/?phone=50688880000') !== -1 && ag.html.indexOf('wa.me') === -1);
// 19 set 2026 (JC): el mensaje de WhatsApp que el agente le manda al cliente avisa del codigo QR.
const waTxt = decodeURIComponent((/web\.whatsapp\.com\/send\/\?phone=\d+&amp;text=([^"]+)"/.exec(ag.html) || [])[1] || '');
ok('WhatsApp al cliente: saluda por el nombre de pila y se presenta el agente', waTxt.indexOf('Hola Mariela, soy Agente Prueba') === 0);
ok('WhatsApp al cliente: trae la fecha y la franja', waTxt.indexOf('martes 22 de setiembre de 2026') !== -1 && waTxt.indexOf('03:00 pm a 05:00 pm') !== -1);
ok('WhatsApp al cliente: avisa del codigo QR a primera hora del dia agendado', /a primera hora/.test(waTxt) && /código QR/.test(waTxt) && /iniciar el aseguramiento/.test(waTxt));
ok('WhatsApp al cliente: trato de vos, sin usted', !/\busted\b/i.test(waTxt) && /escaneás/.test(waTxt));
// 19 set 2026 (JC): el vehiculo ya trae el ano ("Rural 2024") y salia "Rural 2024 2024".
const conAno = correoAgente(Object.assign({}, d, { v: 'Rural 2024', y: '2024' }), { clienteAvisado: true });
ok('agente: no repite el ano si el vehiculo ya lo trae', conAno.html.indexOf('Rural 2024 2024') === -1 && conAno.html.indexOf('Rural 2024') !== -1 && conAno.texto.indexOf('2024 2024') === -1);
ok('agente: si el vehiculo NO trae el ano, se agrega', ag.html.indexOf('TOYOTA RAV4 2021') !== -1);
ok('agente: bloque para copiar', ag.html.indexOf('Para copiar y pegar') !== -1);
ok('agente: sin nota de fallo cuando el cliente fue avisado', ag.html.indexOf('No se pudo enviar la confirmaci') === -1);
ok('agente: con nota cuando NO fue avisado', correoAgente(d, { clienteAvisado: false }).html.indexOf('No se pudo enviar la confirmaci') !== -1);

const xss = Object.assign({}, d, { nombre: '<img src=x onerror=alert(1)>', direccion: '<svg onload=alert(1)>', c: '<b>x</b>' });
ok('escapa en el correo del agente', correoAgente(xss, { clienteAvisado: true }).html.indexOf('<img src=x') === -1 && correoAgente(xss, { clienteAvisado: true }).html.indexOf('<svg') === -1);
ok('escapa en el correo del cliente', correoCliente(xss).html.indexOf('<b>x</b>') === -1);

const cero = Object.assign({}, d, { placa: 'Cero kilómetros' });
ok('0 km: el asunto del agente dice 0 KM', correoAgente(cero, { clienteAvisado: true }).asunto.indexOf('· 0 KM ·') !== -1);

// 28 set 2026: total de la forma elegida con las asistencias. Semestral 308.283 + Mascota
// (7.200 ÷ 2 × 1,08 × 1,13 = 4.393) + Salud Premium (42.000 ÷ 2 × 1,08 × 1,13 = 25.628) = 338.304.
ok('total semestral con asistencias (recargo 8 % + IVA)', totalConAsistencias(d) === '₡338.304 por semestre (cotización ₡308.283 + asistencias ₡30.021)');
ok('total trimestral (recargo 11 % + IVA)', totalConAsistencias({ ...d, formaPago: 'Trimestral' }).indexOf('₡173.851 por trimestre') === 0);
ok('total anual (solo IVA)', totalConAsistencias({ ...d, formaPago: 'Anual' }).indexOf('₡626.487 al año') === 0);
ok('sin asistencias no hay total', totalConAsistencias({ ...d, as: [] }) === '');
ok('sin la prima de esa forma no hay total', totalConAsistencias({ ...d, ps: '' }) === '');
ok('agente: el correo trae el total con asistencias', ag.html.indexOf('Total con asistencias') !== -1 && ag.html.indexOf('₡338.304') !== -1);

// 12 oct 2026 (JC): monto asegurado e interes asegurable en el correo del agente.
const conDatos = correoAgente({ ...d, va: '15000000', ia: 'propietario' }, { clienteAvisado: true });
ok('agente: monto asegurado con punto de miles', conDatos.html.indexOf('Monto asegurado') !== -1 && conDatos.html.indexOf('₡15.000.000') !== -1);
ok('agente: interes asegurable con el texto del cotizador', conDatos.html.indexOf('Interés asegurable') !== -1 && conDatos.html.indexOf('Propietario Registral') !== -1);
ok('agente: los dos van en "De la cotización", despues del vehiculo y antes de las primas', (() => {
  const h = conDatos.html, i = h.indexOf('De la cotización');
  return i !== -1 && i < h.indexOf('TOYOTA RAV4') && h.indexOf('TOYOTA RAV4') < h.indexOf('Monto asegurado') &&
    h.indexOf('Monto asegurado') < h.indexOf('Interés asegurable') && h.indexOf('Interés asegurable') < h.indexOf('Primas cotizadas');
})());
ok('agente: texto plano trae los dos', conDatos.texto.indexOf('Monto asegurado: ₡15.000.000') !== -1 && conDatos.texto.indexOf('Interés asegurable: Propietario Registral') !== -1);
ok('agente: sin interes avisa que no se indico', ag.html.indexOf('No se indicó al cotizar') !== -1 && ag.texto.indexOf('Interés asegurable: No se indicó al cotizar') !== -1);
ok('agente: sin monto no sale el renglon', ag.html.indexOf('Monto asegurado') === -1);
ok('agente: cero km se lee completo', correoAgente({ ...d, ia: 'cero-km' }, { clienteAvisado: true }).html.indexOf('Vehículo Cero Kilómetros (en proceso de compra)') !== -1);
ok('cliente: NO lleva monto ni interes (es dato para el agente)', (() => { const c = correoCliente({ ...d, va: '15000000', ia: 'propietario' }); return c.html.indexOf('15.000.000') === -1 && c.html.indexOf('Propietario Registral') === -1 && c.texto.indexOf('Propietario') === -1; })());
// La lista del servidor tiene que decir lo mismo que el desplegable del cotizador.
{
  const src = fs.readFileSync(new URL('../js/email-template.js', import.meta.url), 'utf8');
  // El cierre se busca tolerando CRLF: git lo pone en la copia de trabajo de Windows.
  const i = src.indexOf('function _interestText'), fin = /\r?\n\}\r?\n/.exec(src.slice(i)), j = i + fin.index + fin[0].length;
  const interestText = new Function(src.slice(i, j) + '\nreturn _interestText;')();
  ok('INTERESES = _interestText del correo de cotizacion', Object.keys(INTERESES).length === 4 && Object.keys(INTERESES).every((k) => interestText(k) === INTERESES[k]));
  const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok('INTERESES = opciones del desplegable f-interes', Object.keys(INTERESES).every((k) => idx.indexOf('<option value="' + k + '">') !== -1));
}

console.log(pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
