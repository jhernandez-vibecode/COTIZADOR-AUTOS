/**
 * Los agentes en el servidor (lib/agentes.mjs) y la firma de los correos (5 nov 2026).
 * - La firma de la cita y de la cotizacion sale de la FICHA del agente, nunca del navegador.
 * - El cargo de asesor vive en UNA sola lista: SDI_ASESORES de js/email-marca.js.
 * - Lo que el cliente escribio y le vuelve en el correo va sin enlaces.
 * Datos INVENTADOS. Run: node tests/test-agentes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firmaDe, leerFichas, puedeTenerFicha, tieneCita, leerFicha } from '../netlify/functions/lib/agentes.mjs';
import { textoCliente, rolFirma } from '../netlify/functions/lib/correo-base.mjs';
import { origenPermitido, ORIGENES, direccionDe } from '../netlify/functions/lib/http.mjs';
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

const AE = 'agente@ejemplo.test', JOSE = 'tramites@segurosdelins.com';
const st = tienda();
await st.setJSON('ficha:' + AE, { nombre: 'Agente Prueba Uno', licencia: '00-0001', whatsapp: '8888-1111', telefono: '8888-2222' });

console.log('-- la firma sale de la ficha --');
const f1 = firmaDe('Agente@Ejemplo.test', await leerFicha(st, 'AGENTE@ejemplo.test'));
ok('agente: nombre, licencia y telefonos de su ficha, sin cargo', f1 && f1.email === AE && f1.nombre === 'Agente Prueba Uno' && f1.licencia === '00-0001' && f1.telefono === '8888-2222' && f1.cargo === '' && f1.oficina === '');
const fj = firmaDe(JOSE, { nombre: 'Asesor Prueba', licencia: '00-0002' });
ok('asesor: cargo y oficina de SDI_ASESORES (email-marca.js)', fj.cargo === 'Asesor de Seguros' && fj.oficina === 'Oficina de Fernando Hernández, agente');
ok('sin ficha → null (no se firma)', firmaDe(AE, null) === null && firmaDe(AE, { licencia: 'x' }) === null);
const todas = await leerFichas(st, [AE, 'AGENTE@ejemplo.test', 'nadie@ejemplo.test']);
ok('leerFichas: una por correo, sin repetir', Object.keys(todas).length === 2 && todas[AE].nombre === 'Agente Prueba Uno' && todas['nadie@ejemplo.test'] === null);

console.log('-- una sola lista de asesores, un solo formato --');
const fuentes = ['js/config.js', 'js/email-template.js', 'js/poliza-email.js', 'js/renovacion-email.js', 'netlify/functions/lib/agentes.mjs', 'netlify/functions/lib/cotizar-reparto.mjs', 'netlify/functions/lib/cotizar-handler.mjs'];
ok('el correo de Jose solo esta en email-marca.js', fuentes.every((f) => !leer(f).includes(JOSE)) && leer('js/email-marca.js').includes(JOSE));
ok('nadie parte el cargo por " · " fuera de la guia (enlace)', ['js/email-marca.js', 'js/email-template.js', 'netlify/functions/lib/cita-correos.mjs', 'netlify/functions/lib/cotizar-correos.mjs'].every((f) => !/indexOf\(['"] · ['"]\)/.test(leer(f))));
ok('rolFirma: asesor en dos renglones, agente en uno', JSON.stringify(rolFirma(fj)) === JSON.stringify(['Asesor de Seguros', 'Oficina de Fernando Hernández, agente · Licencia SUGESE 00-0002']) && JSON.stringify(rolFirma(f1, ' - ')) === JSON.stringify(['Agente exclusivo del INS - Licencia SUGESE 00-0001']));

console.log('-- la cita no acepta firma del navegador --');
const base = { nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test', direccion: 'Heredia', placa: 'BDF482',
  formaPago: 'Anual', fecha: '2030-01-07', franja: '8:00 am a 10:00 am', consent: true, ae: AE, c: 'Mariela' };
const v = validarCita({ ...base, n: 'Banco Falso Atencion', l: '99-9999', tel: 'pague en estafa.test', cg: 'Departamento de Cobros' }, { agentes: new Set([AE]), now: new Date('2030-01-01T15:00:00Z') });
ok('validarCita descarta n, l, tel, wa y cg', v.ok && ['n', 'l', 'tel', 'wa', 'cg'].every((k) => !(k in v.datos)));
const cc = correoCliente({ ...v.datos, as: [] }, f1);
ok('el correo al cliente lleva la firma real', cc.html.includes('Agente Prueba Uno') && cc.html.includes('00-0001') && cc.html.includes('8888-2222'));
ok('y nada de lo inventado', !/Banco Falso|99-9999|estafa|Departamento de Cobros/.test(cc.html + cc.texto));
const fuente = leer('netlify/functions/cita.mjs');
ok('cita.mjs firma con la ficha ANTES de armar los correos', fuente.indexOf('firmaDe(d.ae') > 0 && fuente.indexOf('firmaDe(d.ae') < fuente.indexOf('correoCliente(d, ag)'));
ok('cita.mjs sin ficha responde 503', /if \(!ag\) \{[\s\S]{0,140}json\(503/.test(fuente));

console.log('-- texto libre acotado en la confirmacion al cliente --');
ok('textoCliente quita puntos, barras y dos puntos', textoCliente('https://estafa.test/x', 40) === 'httpsestafatestx');
ok('textoCliente con decimales deja "2.5" y quita el resto', textoCliente('RAV4 2.5 en estafa.test', 80, { decimales: true }) === 'RAV4 2.5 en estafatest');
const cp = correoCliente({ ...v.datos, as: [], placa: 'BDF482 pague en estafa.test/x', c: 'Ana.estafa.test' }, f1);
ok('cita: placa y pila sin enlaces', !/estafa\.test/.test(cp.html + cp.texto + cp.asunto));
const cq = correoCotizacion({ tipo: 'nuevo', nombre: 'Ana www.estafa.test', marcaModelo: 'Toyota RAV4 2.5 pague en estafa.test/x', valor: 1000, combustible: 'Gasolina', tipoVeh: 'Rural', uso: 'Personal', interes: 'x', correo: 'a@ejemplo.test' }, { ...f1, whatsapp: '' });
ok('cotizacion: marca y nombre sin enlaces, el 2.5 se queda', !/estafa\.test|www\./.test(cq.html + cq.texto) && cq.html.includes('Toyota RAV4 2.5'));

console.log('-- quien puede guardar ficha --');
const reparto = { agentes: [{ email: 'dos@ejemplo.test', peso: 1 }] };
const env = { CITA_AGENTES: AE };
ok('admin, los del reparto y los de cita; nadie mas',
  puedeTenerFicha('admin@ejemplo.test', { admin: 'admin@ejemplo.test', reparto, env }) &&
  puedeTenerFicha('DOS@ejemplo.test', { admin: 'x@y.z', reparto, env }) &&
  puedeTenerFicha(AE, { admin: 'x@y.z', reparto, env }) &&
  !puedeTenerFicha('otro@ejemplo.test', { admin: 'x@y.z', reparto, env }));
ok('tieneCita lee CITA_AGENTES', tieneCita('Agente@Ejemplo.test', env) && !tieneCita('otro@ejemplo.test', env));

const s2 = tienda();
const resp = (j) => ({ ok: true, json: async () => j });
const fetchFn = async (url) => {
  if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) return resp({ azp: CLIENT_ID_DEFECTO, email: AE, email_verified: true, expires_in: 3000 });
  throw new Error('url inesperada ' + url);
};
const h = crearHandler({ getStore: () => s2, fetchFn, env: { CITA_API_KEY: 'k', CITA_FROM: 'C <c@ejemplo.test>', COTIZAR_ADMIN: 'admin@ejemplo.test', CITA_AGENTES: AE } });
const post = async (cuerpo) => {
  const r = await h(new Request('https://x.test/cotizar/agente', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }), { ip: '1.1.1.1' });
  return { st: r.status, j: await r.json() };
};
const c1 = await post({ accion: 'consulta', email: AE });
ok('consulta: avisa que tiene la cita activa', c1.st === 200 && c1.j.cita === true && c1.j.enReparto === false);
const c2 = await post({ accion: 'ficha', token: 'x'.repeat(30), ficha: { nombre: 'Agente Prueba Uno', licencia: '00-0001', whatsapp: '8888-1111', telefono: '' } });
ok('ficha: se guarda aunque no este en el reparto', c2.st === 200 && !!s2.m.get('ficha:' + AE));
ok('el ⚙ manda la ficha tambien a los de cita', leer('js/cotizar-agente.js').includes('x.j.enReparto || x.j.admin || x.j.cita'));
ok('el panel del reparto ya no edita el cargo', !leer('js/cotizar-agente.js').includes('cotz-cargo'));

console.log('-- http comun --');
ok('origen: los nuestros, localhost y sin Origin; ajenos no', origenPermitido(ORIGENES[0], ORIGENES) && origenPermitido('http://localhost:8888', ORIGENES) && origenPermitido('', ORIGENES) && !origenPermitido('https://malo.test', ORIGENES));
ok('direccionDe', direccionDe('Citas <citas@ejemplo.test>') === 'citas@ejemplo.test' && direccionDe('a@b.c') === 'a@b.c');

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
