/**
 * La firma de la cita sale del servidor, no del navegador (5 nov 2026).
 * Antes cualquiera podia mandar desde nuestro dominio una "Solicitud recibida" con otro
 * nombre de remitente y otro telefono. Datos INVENTADOS. Run: node tests/test-cita-agente.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firmaDelAgente, conFirma, textoSeguro, ASESORES } from '../netlify/functions/lib/cita-agente.mjs';
import { validarCita } from '../netlify/functions/lib/cita-validacion.mjs';
import { correoCliente } from '../netlify/functions/lib/cita-correos.mjs';
import { correoCliente as correoCotizacion } from '../netlify/functions/lib/cotizar-correos.mjs';
import { crearHandler } from '../netlify/functions/lib/cotizar-handler.mjs';
import { CLIENT_ID_DEFECTO } from '../netlify/functions/lib/google-sesion.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }
function tienda() {
  const m = new Map();
  return { m, get: async (k, o) => { const v = m.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); },
    set: async (k, v) => { m.set(k, String(v)); }, setJSON: async (k, v) => { m.set(k, JSON.stringify(v)); } };
}

const AE = 'agente@ejemplo.test', ASE = 'asesor@ejemplo.test';
const st = tienda();
await st.setJSON('ficha:' + AE, { nombre: 'Agente Prueba Uno', licencia: '00-0001', whatsapp: '8888-1111', telefono: '8888-2222' });
await st.setJSON('ficha:' + ASE, { nombre: 'Asesor Prueba Dos', licencia: '00-0002', whatsapp: '8888-3333', telefono: '' });
await st.setJSON('reparto', { activo: true, agentes: [{ email: ASE, peso: 1, cargo: 'Asesor de Seguros · Oficina de Titular, agente' }] });

console.log('-- firma desde la ficha --');
const f1 = await firmaDelAgente(st, 'Agente@Ejemplo.test');
ok('agente: nombre, licencia y telefono de su ficha', f1 && f1.n === 'Agente Prueba Uno' && f1.l === '00-0001' && f1.tel === '8888-2222' && f1.wa === '8888-1111' && f1.cg === '');
const f2 = await firmaDelAgente(st, ASE);
ok('asesor: cargo del reparto y, sin telefono, su WhatsApp', f2.cg === 'Asesor de Seguros · Oficina de Titular, agente' && f2.tel === '8888-3333');
ok('sin ficha → null (no se envia)', (await firmaDelAgente(st, 'nadie@ejemplo.test')) === null);
ok('ASESORES igual a CFG.ASESORES de config.js', Object.entries(ASESORES).every(([k, v]) => leer('js/config.js').includes("'" + k + "': '" + v + "'")));

console.log('-- lo del navegador no sobrevive --');
const base = { nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test', direccion: 'Heredia', placa: 'BDF482',
  formaPago: 'Anual', fecha: '2030-01-07', franja: '8:00 am a 10:00 am', consent: true, ae: AE, c: 'Mariela' };
const falso = { ...base, n: 'Banco Falso Atencion', l: '99-9999', tel: 'pague en estafa.test', cg: 'Departamento de Cobros' };
const v = validarCita(falso, { agentes: new Set([AE]), now: new Date('2030-01-01T15:00:00Z') });
const d = conFirma(v.datos, f1);
const cc = correoCliente({ ...d, as: [] });
ok('el correo al cliente lleva la firma real', cc.html.includes('Agente Prueba Uno') && cc.html.includes('00-0001') && cc.html.includes('8888-2222'));
ok('y nada de lo inventado', !/Banco Falso|99-9999|estafa|Departamento de Cobros/.test(cc.html + cc.texto));
const fuente = leer('netlify/functions/cita.mjs');
ok('cita.mjs firma con la ficha ANTES de armar los correos', fuente.indexOf('conFirma(v.datos, firma)') > 0 && fuente.indexOf('conFirma(v.datos, firma)') < fuente.indexOf('correoCliente(d)'));
ok('cita.mjs sin ficha responde 503', /if \(!firma\) \{[\s\S]{0,140}json\(503/.test(fuente));

ok('ficha sin licencia: la del enlace solo si tiene forma de licencia', conFirma({ l: '00-0003' }, { ...f1, l: '' }).l === '00-0003' && conFirma({ l: 'pague en x' }, { ...f1, l: '' }).l === '');

console.log('-- texto libre acotado en la confirmacion al cliente --');
ok('textoSeguro quita puntos, barras y dos puntos', textoSeguro('https://estafa.test/x', 40) === 'httpsestafatestx');
const cp = correoCliente({ ...d, as: [], placa: 'BDF482 pague en estafa.test/x', c: 'Ana.estafa.test' });
ok('cita: placa y pila sin enlaces', !/estafa\.test/.test(cp.html + cp.texto + cp.asunto));
const ag = { email: AE, nombre: 'Agente Prueba Uno', licencia: '00-0001', whatsapp: '', cargo: '' };
const cq = correoCotizacion({ tipo: 'nuevo', nombre: 'Ana www.estafa.test', marcaModelo: 'Toyota RAV4 2.5 pague en estafa.test/x', valor: 1000, combustible: 'Gasolina', tipoVeh: 'Rural', uso: 'Personal', interes: 'x', correo: 'a@ejemplo.test' }, ag);
ok('cotizacion: marca y nombre sin enlaces', !/estafa\.test|www\./.test(cq.html + cq.texto));
ok('cotizacion: el punto entre digitos se queda (2.5)', cq.html.includes('Toyota RAV4 2.5'));

console.log('-- el ⚙ de un agente de cita guarda su ficha --');
const s2 = tienda();
const resp = (j, okk = true) => ({ ok: okk, json: async () => j });
const env = { CITA_API_KEY: 'k', CITA_FROM: 'C <c@ejemplo.test>', COTIZAR_ADMIN: 'admin@ejemplo.test', CITA_AGENTES: AE };
const fetchFn = async (url) => {
  if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) return resp({ azp: CLIENT_ID_DEFECTO, email: AE, email_verified: true, expires_in: 3000 });
  throw new Error('url inesperada ' + url);
};
const h = crearHandler({ getStore: () => s2, fetchFn, env });
const post = async (cuerpo) => { const r = await h(new Request('https://x.test/cotizar/agente', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }), { ip: '1.1.1.1' }); return { st: r.status, j: await r.json() }; };
const c1 = await post({ accion: 'consulta', email: AE });
ok('consulta: avisa que tiene la cita activa', c1.st === 200 && c1.j.cita === true && c1.j.enReparto === false);
const c2 = await post({ accion: 'ficha', token: 'x'.repeat(30), ficha: { nombre: 'Agente Prueba Uno', licencia: '00-0001', whatsapp: '8888-1111', telefono: '' } });
ok('ficha: se guarda aunque no este en el reparto', c2.st === 200 && !!s2.m.get('ficha:' + AE));
ok('el ⚙ manda la ficha tambien a los de cita', leer('js/cotizar-agente.js').includes('x.j.enReparto || x.j.admin || x.j.cita'));

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
