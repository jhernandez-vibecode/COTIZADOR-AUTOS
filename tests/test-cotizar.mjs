/**
 * Formulario propio de cotizacion con reparto entre agentes (JC, 5 nov 2026).
 * Reparto por turnos y editable · validacion · correos · la Function entera con
 * almacenamiento y fetch falsos. Datos INVENTADOS. Run: node tests/test-cotizar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarReparto, elegir, vuelta, proximos, repartoInicial, TOPE_PRINCIPAL, TOPE_MANUAL } from '../netlify/functions/lib/cotizar-reparto.mjs';
import { validarCotizacion, validarFicha, INTERESES_COT } from '../netlify/functions/lib/cotizar-validacion.mjs';
import { correoAgente, filaRegistro, presentacion } from '../netlify/functions/lib/cotizar-correos.mjs';
import { correoDeSesion, CLIENT_ID_DEFECTO } from '../netlify/functions/lib/google-sesion.mjs';
import { crearHandler, mesCR } from '../netlify/functions/lib/cotizar-handler.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }

const ADM = 'agente.uno@ejemplo.test', DOS = 'agente.dos@ejemplo.test', TRES = 'agente.tres@ejemplo.test';
const R = (on, pesos) => normalizarReparto({ on, agentes: [{ email: ADM, peso: pesos[0] }, { email: DOS, peso: pesos[1] }, { email: TRES, peso: pesos[2] }] }, ADM).reparto;
const todos = () => true;
function corrida(reparto, n, tieneFicha = todos) {
  let turno = null; const out = [];
  for (let i = 0; i < n; i++) { const s = elegir({ reparto, turno, admin: ADM, tieneFicha }); out.push(s.email === ADM ? 'U' : s.email === DOS ? 'D' : 'T'); if (s.turno) turno = s.turno; }
  return out.join('');
}

console.log('-- reparto por turnos, editable --');
ok('3-1-1: U U U D T y vuelve', corrida(R(true, [3, 1, 1]), 10) === 'UUUDTUUUDT');
ok('5-1-1', corrida(R(true, [5, 1, 1]), 7) === 'UUUUUDT');

console.log('-- 15 millones o mas: siempre al admin (JC, 8 nov 2026) --');
ok('el tope es 15.000.000', TOPE_PRINCIPAL === 15000000);
{
  const r = R(true, [0, 1, 1]);
  const s1 = elegir({ reparto: r, turno: null, admin: ADM, tieneFicha: todos, valor: 15000000 });
  ok('15.000.000 justos → admin aunque tenga peso 0, marcado directo', s1.email === ADM && s1.directo === true && s1.turno === null);
  const s2 = elegir({ reparto: r, turno: null, admin: ADM, tieneFicha: todos, valor: 14999999 });
  ok('14.999.999 → van al reparto', s2.email === DOS && !s2.directo);
  const s3 = elegir({ reparto: R(false, [3, 1, 1]), turno: null, admin: ADM, tieneFicha: todos, valor: 40000000 });
  ok('con el reparto apagado tambien al admin', s3.email === ADM);
  const s4 = elegir({ reparto: r, turno: null, admin: ADM, tieneFicha: () => false, valor: 20000000 });
  ok('aunque nadie tenga ficha', s4.email === ADM && s4.directo);
}
ok('hoja: la columna del turno dice que fue directo', filaRegistroDirecto());

console.log('-- menos de 4 millones: sin asignar (JC, 8 nov 2026) --');
ok('el tope manual es 4.000.000', TOPE_MANUAL === 4000000);
{
  const r = R(true, [3, 1, 1]);
  const s1 = elegir({ reparto: r, turno: null, admin: ADM, tieneFicha: todos, valor: 3999999 });
  ok('3.999.999 → a nadie, sin mover la vuelta', s1.email === '' && s1.sinAsignar === true && s1.turno === null);
  const s2 = elegir({ reparto: r, turno: null, admin: ADM, tieneFicha: todos, valor: 4000000 });
  ok('4.000.000 justos → entran al reparto', s2.email === ADM && !s2.sinAsignar && s2.turno);
  ok('con el reparto apagado tampoco se asigna', elegir({ reparto: R(false, [3, 1, 1]), turno: null, admin: ADM, tieneFicha: todos, valor: 2000000 }).sinAsignar === true);
  ok('hoja: dice sin asignar', filaRegistro({ tipo: 'usado', placa: 'X', valor: 2000000 }, { agente: { nombre: 'Sin asignar', email: '' }, n: 0, de: 5, repartido: false, sinAsignar: true, fecha: 'x' }).turno === 'Menos de ₡4 millones · sin asignar');
}
ok('2-2-2', corrida(R(true, [2, 2, 2]), 6) === 'UUDDTT');
ok('3-2-1', corrida(R(true, [3, 2, 1]), 12) === 'UUUDDTUUUDDT');
ok('peso 0 = fuera de la vuelta', corrida(R(true, [1, 1, 0]), 4) === 'UDUD');
ok('apagado: todo al admin', corrida(R(false, [3, 1, 1]), 5) === 'UUUUU');
ok('todos en 0: todo al admin', corrida(R(true, [0, 0, 0]), 3) === 'UUU');
ok('sin ficha se salta su turno', corrida(R(true, [1, 1, 1]), 6, (e) => e !== DOS) === 'UTUTUT');
ok('nadie con ficha: al admin', corrida(R(true, [1, 1, 1]), 2, () => false) === 'UU');
{
  const r1 = R(true, [3, 1, 1]);
  const s1 = elegir({ reparto: r1, turno: null, admin: ADM, tieneFicha: todos });
  const s2 = elegir({ reparto: r1, turno: s1.turno, admin: ADM, tieneFicha: todos });
  ok('numera el turno: 2 de 5', s2.n === 2 && s2.de === 5 && s2.repartido);
  const r2 = R(true, [2, 2, 2]);
  const s3 = elegir({ reparto: r2, turno: s2.turno, admin: ADM, tieneFicha: todos });
  ok('al cambiar los pesos la vuelta arranca de nuevo', s3.n === 1 && s3.email === ADM);
  ok('vista previa de los proximos', proximos(r1, s1.turno, 5).join(',') === [ADM, ADM, DOS, TRES, ADM].join(','));
  ok('vista previa: salta a quien no tiene ficha', proximos(r1, s1.turno, 5, (e) => e !== TRES, ADM).join(',') === [ADM, ADM, DOS, ADM, ADM].join(','));
}
ok('normalizar: el admin entra aunque no venga (peso 0)', (() => { const n = normalizarReparto({ on: true, agentes: [{ email: DOS, peso: 2 }] }, ADM); return n.ok && n.reparto.agentes[0].email === ADM && n.reparto.agentes[0].peso === 0; })());
ok('normalizar: peso 10 no', !normalizarReparto({ on: true, agentes: [{ email: ADM, peso: 10 }] }, ADM).ok);
ok('normalizar: correo repetido no', !normalizarReparto({ on: true, agentes: [{ email: ADM, peso: 1 }, { email: 'AGENTE.UNO@ejemplo.test', peso: 1 }] }, ADM).ok);
ok('normalizar: el reparto ya no guarda cargo (vive en SDI_ASESORES)', (() => { const n = normalizarReparto({ on: true, agentes: [{ email: ADM, peso: 1, cargo: 'x' }] }, ADM); return n.ok && !('cargo' in n.reparto.agentes[0]); })());
ok('reparto inicial: apagado y solo el admin', (() => { const r = repartoInicial(ADM); return !r.on && r.agentes.length === 1 && vuelta(r).length === 1; })());

console.log('-- validacion (preguntas del Google Form) --');
const U = { correo: 'Mariela@Ejemplo.test', nombre: 'Mariela Quesada Rojas', cedula: '1 0000 0000', telefono: '8888-0000', interes: INTERESES_COT[0], uso: 'Personal', tipo: 'usado', placa: 'bdf482', valor: '₡ 9.500.000', info: '' };
const N = { ...U, tipo: 'nuevo', placa: '', inscribe: 'Mariela Quesada Rojas', cedula2: '1 0000 0000', marcaModelo: 'Toyota RAV4 2027', valor: '24900000', combustible: 'Híbrido', tipoVeh: 'Rural' };
const vu = validarCotizacion(U), vn = validarCotizacion(N);
ok('usado valido; placa en mayusculas; valor numerico', vu.ok && vu.datos.placa === 'BDF482' && vu.datos.valor === 9500000 && vu.datos.correo === 'mariela@ejemplo.test');
ok('nuevo valido', vn.ok && vn.datos.marcaModelo === 'Toyota RAV4 2027' && vn.datos.combustible === 'Híbrido');
ok('usado sin placa → campo placa', validarCotizacion({ ...U, placa: '' }).campo === 'placa');
ok('nuevo sin combustible → campo combustible', validarCotizacion({ ...N, combustible: 'Otro' }).campo === 'combustible');
ok('interes que no es del formulario → no', validarCotizacion({ ...U, interes: 'Propietario' }).campo === 'interes');
ok('telefono corto → no', validarCotizacion({ ...U, telefono: '8888' }).campo === 'telefono');
ok('salto de linea en el nombre → no', validarCotizacion({ ...U, nombre: 'Ana\nBcc: x' }).campo === 'nombre');
ok('campo trampa → se finge exito', validarCotizacion({ ...U, sitio: 'http://spam' }).trampa === true);
ok('ficha valida', validarFicha({ nombre: 'Agente Prueba Uno', licencia: '00-0000', whatsapp: '8888-1111', telefono: '' }).ok);
ok('ficha sin apellido → no', !validarFicha({ nombre: 'Agente', licencia: '00-0000' }).ok);
ok('ficha con WhatsApp corto → no', !validarFicha({ nombre: 'Agente Prueba', whatsapp: '123' }).ok);

console.log('-- correos --');
const AG = { email: DOS, nombre: 'Agente Prueba Dos', licencia: '00-0002', whatsapp: '8888-2222', telefono: '', cargo: 'Asesor de Seguros', oficina: 'Oficina de Agente Prueba Uno, agente' };
ok('6 nov 2026: ya no existe el correo de confirmacion al cliente', !/export function correoCliente/.test(fs.readFileSync(path.join(raiz, 'netlify/functions/lib/cotizar-correos.mjs'), 'utf8')));
const ca = correoAgente(vu.datos, { agente: AG, n: 4, de: 5, repartido: true, fecha: '5 nov 2026, 8:14 am', registrada: true });
ok('agente: sin el chip del turno (JC, 5 nov)', !ca.html.includes('Te tocó por turno') && !ca.texto.includes('Te tocó por turno') && !ca.html.includes('#FBF3DC;color:#7C5A00;border-radius:999px'));
ok('agente: sin el boton Abrir el cotizador (JC, 5 nov)', !ca.html.includes('Abrir el cotizador') && ca.html.includes('WhatsApp a '));
ok('agente: trae la cedula y todas las respuestas', ca.html.includes('1 0000 0000') && ca.html.includes('(no indicó)') && ca.html.includes(INTERESES_COT[0]));
ok('agente: asunto con 📝 al inicio', ca.asunto === '📝 Cotización solicitada · BDF482 · Mariela Quesada Rojas');
ok('agente: nuevo trae marca, combustible y tipo', (() => { const h = correoAgente(vn.datos, { agente: AG, n: 0, de: 0, repartido: false, fecha: 'x' }).html; return h.includes('Toyota RAV4 2027') && h.includes('Híbrido') && h.includes('Rural'); })());
ok('agente: sin el aviso de confirmacion al cliente (ya no se envia)', !ca.html.includes('confirmación al cliente'));
{
  const AS = { email: 'asesora@ejemplo.test', nombre: 'Asesora Prueba Tres', licencia: '', telefono: '', whatsapp: '', cargo: 'Asesora de Seguros', oficina: 'Oficina de Agente Prueba, agente' };
  ok('presentacion: agente → "agente del INS"', presentacion({ cargo: '' }) === 'agente del INS');
  ok('presentacion: asesora con su oficina', presentacion(AS) === 'asesora de seguros de la oficina de Agente Prueba');
  const wa = decodeURIComponent((correoAgente(vu.datos, { agente: AS, n: 1, de: 5, repartido: true, fecha: 'x' }).html.match(/text=([^"&]+)/) || [, ''])[1]).replace(/\+/g, ' ');
  ok('WhatsApp del aviso: la asesora no dice "agente del INS"', wa.includes('soy Asesora Prueba, asesora de seguros de la oficina de Agente Prueba.') && !wa.includes('agente del INS'));
}
ok('Melanie es asesora de la oficina de Fernando (JC, 8 nov 2026)', JSON.stringify((await import('../js/email-marca.js')).default.SDI_ASESORES['melanie.hernandez@seguros-del-ins.com']) === JSON.stringify({ cargo: 'Asesora de Seguros', oficina: 'Oficina de Fernando Hernández, agente' }));
ok('hoja: la columna de la confirmacion dice "Solo en pantalla"', filaRegistro(vu.datos, { agente: AG, n: 1, de: 1, repartido: true, fecha: 'x' }).clienteAvisado === 'Solo en pantalla');
ok('hoja: fila con el agente y el turno', (() => { const f = filaRegistro(vu.datos, { agente: AG, n: 4, de: 5, repartido: true, fecha: 'x' }); return f.agente === 'Agente Prueba Dos' && f.turno === '4 de 5' && f.cedula === '1 0000 0000'; })());

function filaRegistroDirecto() {
  return filaRegistro({ tipo: 'usado', placa: 'X', valor: 20000000 }, { agente: { nombre: 'A', email: ADM }, n: 0, de: 5, repartido: false, directo: true, fecha: 'x' }).turno === '₡15 millones o más · directo';
}
console.log('-- sesion de Google --');
const resp = (j, okk = true) => Promise.resolve({ ok: okk, json: () => Promise.resolve(j), text: () => Promise.resolve('ok') });
const TK = 'ya29.' + 'x'.repeat(40);
ok('token valido de nuestro Client ID → correo', await correoDeSesion(TK, { fetchFn: () => resp({ azp: CLIENT_ID_DEFECTO, email: 'Agente.Uno@ejemplo.test', email_verified: 'true', expires_in: '3000' }) }) === ADM);
ok('token de otra app → null', await correoDeSesion(TK, { fetchFn: () => resp({ azp: 'otra.apps.googleusercontent.com', email: ADM, email_verified: 'true', expires_in: '3000' }) }) === null);
ok('correo sin verificar → null', await correoDeSesion(TK, { fetchFn: () => resp({ azp: CLIENT_ID_DEFECTO, email: ADM, email_verified: 'false', expires_in: '3000' }) }) === null);
ok('Google dice que no → null', await correoDeSesion(TK, { fetchFn: () => resp({}, false) }) === null);
ok('token basura → null sin preguntar', await correoDeSesion('a b', { fetchFn: () => { throw new Error('no debia'); } }) === null);

console.log('-- la Function entera --');
function tienda() {
  const m = new Map();
  return { m, get: async (k, o) => { const v = m.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, set: async (k, v) => { m.set(k, String(v)); }, setJSON: async (k, v) => { m.set(k, JSON.stringify(v)); } };
}
const store = tienda();
const enviados = [], hoja = [];
const TOKENS = { tkUno: ADM, tkDos: DOS, tkTres: TRES };
const fetchFn = async (url, o) => {
  if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    const t = decodeURIComponent(String(url).split('=')[1]); const e = TOKENS[t.slice(0, 5)];
    return resp(e ? { azp: CLIENT_ID_DEFECTO, email: e, email_verified: true, expires_in: 3000 } : {}, !!e);
  }
  if (url === 'https://api.resend.com/emails') { enviados.push(JSON.parse(o.body)); return { ok: true }; }
  if (url === 'https://registro.ejemplo.test/exec') { hoja.push(JSON.parse(o.body)); return { ok: true, text: async () => 'ok' }; }
  throw new Error('url inesperada ' + url);
};
const env = { CITA_API_KEY: 'k', CITA_FROM: 'Citas <citas@ejemplo.test>', COTIZAR_ADMIN: ADM, COTIZAR_REGISTRO_URL: 'https://registro.ejemplo.test/exec', COTIZAR_REGISTRO_CLAVE: 'c' };
let reloj = Date.parse('2030-01-07T15:00:00Z');
const h = crearHandler({ getStore: () => store, fetchFn, env, ahora: () => new Date(reloj += 70000) });
const llamar = async (ruta, cuerpo, ip = '1.1.1.1') => { const r = await h(new Request('https://x.test' + ruta, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://cotizador.appsegurosdigitales.com' }, body: JSON.stringify(cuerpo) }), { ip }); return { st: r.status, j: await r.json() }; };
const tk = (n) => n + 'x'.repeat(30);

ok('sin COTIZAR_ADMIN → 503', (await (async () => { const r = await crearHandler({ getStore: () => store, fetchFn, env: { ...env, COTIZAR_ADMIN: '' } })(new Request('https://x.test/cotizar/enviar', { method: 'POST', body: '{}' }), {}); return r.status; })()) === 503);
ok('origen ajeno → 403', (await (async () => { const r = await h(new Request('https://x.test/cotizar/enviar', { method: 'POST', headers: { origin: 'https://malo.test' }, body: '{}' }), {}); return r.status; })()) === 403);
ok('consulta: el admin', (await llamar('/cotizar/agente', { accion: 'consulta', email: ADM })).j.admin === true);
ok('consulta: otro no esta en el reparto', (await llamar('/cotizar/agente', { accion: 'consulta', email: DOS })).j.enReparto === false);
ok('ver sin sesion → 401', (await llamar('/cotizar/agente', { accion: 'ver', token: 'malo' })).st === 401);
ok('ver con sesion de otro → 403', (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkDos') })).st === 403);
ok('ficha de alguien fuera del reparto → 403', (await llamar('/cotizar/agente', { accion: 'ficha', token: tk('tkDos'), ficha: { nombre: 'Agente Prueba Dos', licencia: '00-0002' } })).st === 403);
const g = await llamar('/cotizar/agente', { accion: 'guardar', token: tk('tkUno'), reparto: { on: true, agentes: [{ email: ADM, peso: 3 }, { email: DOS, peso: 1, cargo: 'Asesor de Seguros' }, { email: TRES, peso: 1 }] } });
ok('el admin guarda 3-1-1', g.st === 200 && g.j.reparto.on && g.j.reparto.agentes.map((a) => a.peso).join('') === '311');
ok('el panel dice quien no tiene ficha', g.j.fichas[DOS] === null);
for (const [t, n, l, w] of [['tkUno', 'Agente Prueba Uno', '00-0001', '8888-1111'], ['tkDos', 'Agente Prueba Dos', '00-0002', '8888-2222']]) {
  const f = await llamar('/cotizar/agente', { accion: 'ficha', token: tk(t), ficha: { nombre: n, licencia: l, whatsapp: w, telefono: '' } });
  ok('ficha guardada: ' + n, f.st === 200);
}
ok('ver: fichas y proximos', (await (async () => { const v = (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkUno') })).j; return v.fichas[DOS].nombre === 'Agente Prueba Dos' && v.proximos.length === 10; })()));

const quienes = [];
for (let i = 0; i < 5; i++) {
  enviados.length = 0;
  const r = await llamar('/cotizar/enviar', { ...U, correo: 'cliente' + i + '@ejemplo.test', placa: 'ABC10' + i }, '2.2.2.' + i);
  quienes.push(r.j.agente && r.j.agente.nombre.split(' ').pop());
  if (i === 3) {
    ok('sale UN solo correo, al agente (al cliente ya no)', enviados.length === 1 && enviados[0].to[0] === DOS && !enviados.some((x) => x.to[0] === 'cliente3@ejemplo.test'));
    ok('el del agente responde al cliente y dice que quedo en la hoja', enviados[0].reply_to === 'cliente3@ejemplo.test' && enviados[0].html.includes('Quedó anotada en la hoja de registro'));
    ok('lunes 9:00 am: la respuesta dice en horario', r.j.enHorario === true && r.j.cuando === 'hoy');
  }
}
ok('3-1-1 con Tres sin ficha: Uno Uno Uno Dos Uno (Tres se salta)', quienes.join(',') === 'Uno,Uno,Uno,Dos,Uno');
ok('la hoja recibio una fila por solicitud, con la clave', hoja.length === 5 && hoja.every((x) => x.clave === 'c') && hoja[3].fila.agente === 'Agente Prueba Dos');
ok('nada del cliente queda en el almacenamiento', [...store.m.values()].every((v) => !v.includes('cliente') && !v.includes('1 0000 0000')));
ok('doble clic: la misma solicitud no sale dos veces', (await (async () => { reloj -= 70000; enviados.length = 0; const r = await llamar('/cotizar/enviar', { ...U, correo: 'cliente4@ejemplo.test', placa: 'ABC104' }, '3.3.3.3'); return r.j.repetida === true && enviados.length === 0; })()));
{
  const antes = (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkUno') })).j.proximos;
  enviados.length = 0;
  const g1 = await llamar('/cotizar/enviar', { ...U, correo: 'grande@ejemplo.test', placa: 'GRD001', valor: '₡ 18.000.000' }, '4.4.4.4');
  ok('Function: una de ₡18 millones le llega al admin', g1.st === 200 && enviados.length === 1 && enviados[0].to[0] === ADM);
  const despues = (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkUno') })).j.proximos;
  ok('Function: la grande no movio la vuelta', antes.join() === despues.join());
  ok('Function: la hoja la anota como directa', hoja[hoja.length - 1].fila.turno.startsWith('₡15 millones o más'));
  hoja.pop();
}
{
  const antes = (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkUno') })).j.proximos;
  enviados.length = 0; const nh = hoja.length;
  const c1 = await llamar('/cotizar/enviar', { ...U, correo: 'chica@ejemplo.test', placa: 'CHI001', valor: '₡ 2.500.000' }, '5.5.5.5');
  ok('Function: menos de ₡4 millones → no sale ningun correo, el cliente ve lo mismo', c1.st === 200 && c1.j.ok && enviados.length === 0 && typeof c1.j.enHorario === 'boolean');
  ok('Function: queda en la hoja como sin asignar', hoja.length === nh + 1 && hoja[nh].fila.turno === 'Menos de ₡4 millones · sin asignar' && hoja[nh].fila.agente === 'Sin asignar' && hoja[nh].fila.correoAgente === '');
  ok('Function: la fila de la hoja lleva el Mes de la solicitud', /^\d{4}-\d{2} · [a-z]+$/.test(hoja[nh].fila.mes));
  const despues = (await llamar('/cotizar/agente', { accion: 'ver', token: tk('tkUno') })).j.proximos;
  ok('Function: la chica no movio la vuelta', antes.join() === despues.join());
  hoja.pop();
}
ok('Function: si la hoja no la anota, la de menos de ₡4 millones no le llega a nadie (JC)', await (async () => {
  const env2 = { ...env }; delete env2.COTIZAR_REGISTRO_URL;
  const st2 = tienda(); for (const [k, v] of store.m) if (k.startsWith('ficha:')) st2.m.set(k, v);
  const env3 = []; const h4 = crearHandler({ getStore: () => st2, env: env2, ahora: () => new Date('2030-01-07T15:00:00Z'), fetchFn: async (u, o) => { if (u === 'https://api.resend.com/emails') { env3.push(JSON.parse(o.body)); return { ok: true }; } return fetchFn(u, o); } });
  const r = await h4(new Request('https://x.test/cotizar/enviar', { method: 'POST', headers: { origin: 'https://cotizador.appsegurosdigitales.com' }, body: JSON.stringify({ ...U, correo: 'chica2@ejemplo.test', valor: '1500000' }) }), { ip: '6.6.6.6' });
  return r.status === 200 && env3.length === 0;
})());
ok('ficha de otro: solo el admin → 403', (await llamar('/cotizar/agente', { accion: 'ficha', para: TRES, token: tk('tkDos'), ficha: { nombre: 'Agente Prueba Tres' } })).st === 403);
ok('ficha de otro: fuera del reparto → 400', (await llamar('/cotizar/agente', { accion: 'ficha', para: 'nadie@ejemplo.test', token: tk('tkUno'), ficha: { nombre: 'Nadie Nadie' } })).st === 400);
{
  const f3 = await llamar('/cotizar/agente', { accion: 'ficha', para: TRES, token: tk('tkUno'), ficha: { nombre: 'Agente Prueba Tres', licencia: '', whatsapp: '8888-3333', telefono: '' } });
  ok('el admin le pone la ficha a Tres (no usa el cotizador)', f3.st === 200 && f3.j.fichas[TRES].nombre === 'Agente Prueba Tres' && f3.j.fichas[TRES].porAdmin === true);
  ok('Tres ya entra en los proximos', f3.j.proximos.includes(TRES));
  ok('la ficha del admin sigue siendo suya', store.m.get('ficha:' + ADM).includes('Agente Prueba Uno'));
}
ok('fuera de horario (viernes 7:40 pm): la respuesta trae el lunes', (await (async () => {
  const h3 = crearHandler({ getStore: () => tienda(), env, fetchFn, ahora: () => new Date('2026-11-07T01:40:00Z') });
  const s3 = await h3(new Request('https://x.test/cotizar/enviar', { method: 'POST', headers: { origin: 'https://cotizador.appsegurosdigitales.com' }, body: JSON.stringify({ ...U, correo: 'fuera@ejemplo.test' }) }), { ip: '8.8.8.8' });
  const j = await s3.json(); return j.enHorario === false && j.cuando === 'el lunes 9 de noviembre';
})()));
ok('si falla el correo del agente → 502', (await (async () => {
  const h2 = crearHandler({ getStore: () => tienda(), env, ahora: () => new Date(), fetchFn: async (u, o) => { if (u === 'https://api.resend.com/emails' && JSON.parse(o.body).to[0] === ADM) return { ok: false, status: 500 }; return fetchFn(u, o); } });
  const s2 = await h2(new Request('https://x.test/cotizar/enviar', { method: 'POST', body: JSON.stringify(U) }), { ip: '9.9.9.9' });
  return s2.status;
})()) === 502);

console.log('-- alarmas (8 nov 2026) --');
{
  // Hoja configurada que responde error + Resend que anota todo.
  const armar = (opts = {}) => {
    const st = tienda(), mails = [];
    const hx = crearHandler({ getStore: () => st, env, ahora: () => new Date('2030-01-07T16:00:00Z'), fetchFn: async (u, o) => {
      if (u === 'https://api.resend.com/emails') { const m = JSON.parse(o.body); if (opts.agenteFalla && !m.subject.startsWith('⚠')) return { ok: false, status: 500 }; mails.push(m); return { ok: true }; }
      if (u === 'https://registro.ejemplo.test/exec') return { ok: true, text: async () => 'error' };
      return fetchFn(u, o);
    } });
    const pedir = (cuerpo) => hx(new Request('https://x.test/cotizar/enviar', { method: 'POST', headers: { origin: 'https://cotizador.appsegurosdigitales.com' }, body: JSON.stringify(cuerpo) }), { ip: '7.7.7.7' });
    return { st, mails, pedir };
  };
  const esAlerta = (m) => m.to[0] === ADM && m.subject.startsWith('⚠ Alerta') && m.html.includes(U.nombre) && m.html.includes(U.telefono);
  {
    const a = armar(); const r = await a.pedir({ ...U, correo: 'a1@ejemplo.test' });
    ok('falla la hoja: el aviso sale igual y a JC le llega la alerta con los datos del cliente', r.status === 200 && a.mails.length === 2 && !a.mails[0].subject.startsWith('⚠') && esAlerta(a.mails[1]) && a.mails[1].html.includes('no anotó'));
    ok('silencio: la solicitud deja la hora en `ultima` (solo la hora)', a.st.m.get('ultima') === '2030-01-07T16:00:00.000Z');
  }
  {
    const a = armar(); const r = await a.pedir({ ...U, correo: 'a2@ejemplo.test', valor: '2000000' });
    ok('falla la hoja con una de menos de ₡4 millones: el cliente ve lo mismo y NO sale ninguna alerta (JC)', r.status === 200 && a.mails.length === 0);
  }
  {
    const a = armar({ agenteFalla: true }); const r = await a.pedir({ ...U, correo: 'a3@ejemplo.test' });
    ok('falla el aviso al agente: 502 al cliente y alerta a JC con los datos', r.status === 502 && a.mails.length === 1 && esAlerta(a.mails[0]) && a.mails[0].html.includes('No salió el aviso'));
  }
  {
    const st = tienda(); const env2 = { ...env };
    const ok2 = crearHandler({ getStore: () => st, env: env2, ahora: () => new Date('2030-01-07T16:00:00Z'), fetchFn });
    enviados.length = 0;
    await ok2(new Request('https://x.test/cotizar/enviar', { method: 'POST', headers: { origin: 'https://cotizador.appsegurosdigitales.com' }, body: JSON.stringify({ ...U, correo: 'a4@ejemplo.test' }) }), { ip: '7.7.7.8' });
    ok('todo bien: no sale ninguna alerta', enviados.length === 1 && !enviados[0].subject.startsWith('⚠')); hoja.pop();
  }
}
{
  const { crearVigia, SILENCIO_HORAS } = await import('../netlify/functions/lib/cotizar-vigia.mjs');
  const correr = async (iso, ultima, previa) => {
    const st = tienda(), mails = [];
    if (ultima) st.m.set('ultima', ultima); if (previa) st.m.set('alerta-silencio', previa);
    const r = await crearVigia({ getStore: () => st, env, ahora: () => new Date(iso), fetchFn: async (u, o) => { mails.push(JSON.parse(o.body)); return { ok: true }; } })();
    return { r, mails, st };
  };
  ok('vigia: silencio de 3 horas', SILENCIO_HORAS === 3);
  // Lunes 7 ene 2030. 11:30 am CR = 17:30 UTC.
  let v = await correr('2030-01-07T17:30:00Z', '2030-01-07T12:00:00Z');   // ultima 6:00 am CR → cuenta desde las 8:00 → 3,5 h
  ok('vigia: 3,5 h de jornada sin solicitudes → alerta a JC', v.r.alerta === true && v.mails.length === 1 && v.mails[0].to[0] === ADM && v.mails[0].subject === '⚠ Sin solicitudes de cotización desde el 7 ene 2030, 6:00 am' && v.st.m.get('alerta-silencio') === '2030-01-07T12:00:00Z');
  v = await correr('2030-01-07T17:30:00Z', '2030-01-07T12:00:00Z', '2030-01-07T12:00:00Z');
  ok('vigia: el mismo silencio no se avisa dos veces', v.r.alerta === false && v.r.yaAvisada && v.mails.length === 0);
  v = await correr('2030-01-07T17:30:00Z', '2030-01-07T15:00:00Z');
  ok('vigia: hubo una a las 9:00 → a las 11:30 no avisa', v.r.alerta === false && v.mails.length === 0);
  v = await correr('2030-01-07T15:00:00Z', '2030-01-04T22:00:00Z');   // lunes 9:00 am; la ultima el viernes
  ok('vigia: la noche y el fin de semana no cuentan (lunes 9:00, ultima el viernes → no avisa)', v.r.alerta === false && v.mails.length === 0);
  v = await correr('2030-01-05T18:00:00Z', '2030-01-03T12:00:00Z');   // sabado
  ok('vigia: sabado no revisa', v.r.revisa === false && v.mails.length === 0);
  v = await correr('2030-12-25T18:00:00Z', '2030-12-24T12:00:00Z');   // feriado
  ok('vigia: feriado no revisa', v.r.revisa === false);
  v = await correr('2030-01-07T23:00:00Z', '2030-01-07T19:30:00Z');   // 5:00 pm CR, ultima 1:30 pm → 3,5 h
  ok('vigia: la revision de las 5:00 pm tambien cuenta', v.r.alerta === true);
  v = await correr('2030-01-07T17:30:00Z', null);
  ok('vigia: sin dato todavia → lo arranca sin avisar', v.r.alerta === false && v.st.m.get('ultima') === '2030-01-07T17:30:00.000Z');
  const fv = fs.readFileSync(path.join(raiz, 'netlify/functions/cotizar-vigia.mjs'), 'utf8');
  ok('vigia: Netlify la corre cada hora', /schedule:\s*"@hourly"/.test(fv));
}

console.log('-- la pagina /cotizar/ --');
const pag = fs.readFileSync(path.join(raiz, 'cotizar/index.html'), 'utf8');
ok('trae las 3 opciones del interes, palabra por palabra', INTERESES_COT.every((t) => pag.includes(t)));
ok('pie: Gestionado por SDI / Seguros Digitales INS', pag.includes('Gestionado por SDI') && pag.includes('Seguros Digitales INS'));
ok('respaldo: el Google Form de siempre', pag.includes('https://forms.gle/c34JknQmwu5ZnmX48'));
ok('campo trampa', /name="sitio"/.test(pag));
ok('manda a /cotizar/enviar', pag.includes("'/cotizar/enviar'"));
ok('pantalla final (opcion B, JC 6 nov): mensaje y frase', pag.includes('Recibimos tu solicitud y la vamos a procesar a la mayor brevedad posible.') && pag.includes('Ya diste el primer paso: muy pronto vas a manejar con el respaldo del INS.'));
ok('pantalla final: sin "Te va a atender" ni promesa de confirmacion por correo', !pag.includes('Te va a atender') && !/confirmaci[oó]n a tu correo|Te enviamos una confirmación/.test(pag));
ok('pantalla final: recuadro rojo con el dia que le llega, escondido por defecto', /id="listoFuera" hidden/.test(pag) && pag.includes("'Te llega ' + j.cuando") && /j\.enHorario === false/.test(pag));
ok('pantalla final: el correo del cliente entra como texto, no como HTML', /b\.textContent = d\.correo/.test(pag) && !/innerHTML/.test(pag.slice(pag.indexOf('function listo'))));

console.log('-- la hoja de registro (Apps Script) --');
const gs = fs.readFileSync(path.join(raiz, 'apps-script/registro-cotizaciones/registro-cotizaciones.js'), 'utf8');
const colsHoja = [...gs.matchAll(/\['(\w+)', '/g)].map((m) => m[1]);
const clavesFila = Object.keys(filaRegistro(vn.datos, { agente: AG, n: 1, de: 1, repartido: true, fecha: 'x' }));
ok('las columnas del Apps Script son las de filaRegistro', colsHoja.length === clavesFila.length && clavesFila.every((k) => colsHoja.includes(k)));
ok('mes: hora de CR (11:30 pm del 30 nov = noviembre; 12:30 am del 1 dic = diciembre)', mesCR(new Date('2026-12-01T05:30:00Z')) === '2026-11 · noviembre' && mesCR(new Date('2026-12-01T06:30:00Z')) === '2026-12 · diciembre');
ok('la fila de la hoja trae el mes', filaRegistro(vn.datos, { agente: AG, n: 1, de: 1, repartido: true, fecha: 'x', mes: '2026-11 · noviembre' }).mes === '2026-11 · noviembre');
{
  const vm = await import('node:vm');
  const ctx = { Utilities: { formatDate: (d, tz, f) => (f === 'yyyy' ? String(d.getFullYear()) : String(d.getMonth() + 1)) } };
  vm.createContext(ctx); vm.runInContext(gs, ctx);
  ok('ordenar(): el Mes de las filas viejas sale del texto de la Fecha', ctx.mesDe_('8 nov 2026, 3:35 pm') === '2026-11 · noviembre' && ctx.mesDe_('1 set 2026, 9:00 am') === '2026-09 · septiembre' && ctx.mesDe_('PRUEBA') === '');
  ok('ordenar(): un color por persona (JC azul, Cristian naranja, José verde, Melanie púrpura)', ctx.RG.PERSONAS.map((p) => p.correo + '=' + p.fuerte).join() === 'jhernandez@segurosdelins.com=#1A73E8,chernandez@seguros-ins.com=#E8710A,tramites@segurosdelins.com=#188038,melanie.hernandez@seguros-del-ins.com=#9334E6');
}
ok('el Apps Script exige la clave y responde "ok"', /cuerpo\.clave !== clave/.test(gs) && /salida\('ok'\)/.test(gs));

console.log('-- el ⚙ --');
const cfgJs = fs.readFileSync(path.join(raiz, 'js/cotizar-agente.js'), 'utf8');
const appJs = fs.readFileSync(path.join(raiz, 'js/app.js'), 'utf8');
const idx = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
ok('guardar el ⚙ manda la ficha', /cotzTrasGuardarPerfil\(profile\)/.test(appJs));
ok('abrir el ⚙ pregunta si es el admin', /cotzAlAbrirPerfil\(\)/.test(appJs));
ok('la seccion del reparto arranca escondida', /id="cotzSec" hidden/.test(idx));
ok('el script se carga antes de app.js', idx.indexOf('js/cotizar-agente.js') > 0 && idx.indexOf('js/cotizar-agente.js') < idx.indexOf('js/app.js'));
ok('la sesion se pide con scope "openid email"', cfgJs.includes("scope: 'openid email'"));
ok('al abrir el ⚙ el reparto se vuelve a leer (no queda una vista vieja)', /function cotzAlAbrirPerfil[\s\S]{0,400}_cotz\.vista = null/.test(cfgJs));
ok('cerrar el ⚙ con el reparto sin guardar pregunta', /cotzHayCambiosSinGuardar\(\) &&/.test(appJs));

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
