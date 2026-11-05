/**
 * Asesores que venden con la licencia de otro agente (JC, 5 nov 2026).
 * Jose (tramites@) es "Asesor de Seguros" de la oficina de Fernando Hernandez: su firma
 * no puede decir "Tu agente" ni "Agente exclusivo", y su pie no lleva "Propiedad intelectual".
 * Un agente normal queda igual que siempre. Datos INVENTADOS. Run: node tests/test-asesor.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CLAVES } from '../netlify/functions/lib/validacion.mjs';
import { validarCita } from '../netlify/functions/lib/cita-validacion.mjs';
import { correoCliente } from '../netlify/functions/lib/cita-correos.mjs';

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }

const CARGO = 'Asesor de Seguros · Oficina de Agente Titular, agente';
const ASESOR = 'asesor@ejemplo.test';
const A = require('../js/planes-asistencia.js');
Object.keys(A).forEach((k) => { globalThis[k] = A[k]; });
globalThis.asiDisponible = () => false;
globalThis.CFG = {
  FROM_NAME: 'Asesor Prueba Uno', FROM_EMAIL: ASESOR, LICENSE: '00-0009', WEBSITE: 'www.ejemplo.test',
  AGENDA_URL: 'https://ejemplo.test/agenda', WHATSAPP: '8888-1111', PHONE: '8888-2222',
  GUIDE_URL: 'https://ejemplo.test/explicacion/', PLANES_URL: 'https://ejemplo.test/asistencias/',
  CITA_URL: 'https://ejemplo.test/cita/', CITA_MODO: 'propio',
  LOGO_URL: 'https://ejemplo.test/img/ins-logo.png', LOGO_SDI_URL: 'https://ejemplo.test/img/sdi.png',
  ASESORES: { [ASESOR]: CARGO },
};
const M = require('../js/email-marca.js');
Object.keys(M).forEach((k) => { globalThis[k] = M[k]; });
(0, eval)(leer('js/email-template.js'));
const P = require('../js/poliza-email.js');

console.log('-- config --');
ok('config.js: Jose es asesor de la oficina de Fernando', /'tramites@segurosdelins\.com': 'Asesor de Seguros · Oficina de Fernando Hernández, agente'/.test(leer('js/config.js')));
ok('el cargo se busca sin importar mayusculas', _cargoAsesor('ASESOR@Ejemplo.test') === CARGO && _cargoAsesor('otro@ejemplo.test') === '');

console.log('-- correo de cotizacion --');
const precios = { anual: '570,891.00', semestral: '308,283.00', trimestral: '158,423.00' };
const mA = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', prices: precios });
ok('asesor: firma en dos lineas con su oficina', mA.includes('Asesor de Seguros<br>Oficina de Agente Titular, agente &middot; Lic. SUGESE 00-0009'));
ok('asesor: no dice "Tu agente"', !mA.includes('Tu agente'));
ok('asesor: pie sin "Propiedad intelectual"', !mA.includes('Propiedad intelectual'));
ok('asesor: pie con su oficina y no "Agente exclusivo INS"', mA.includes('Oficina de Agente Titular, agente &middot; Licencia SUGESE 00-0009') && !mA.includes('Agente exclusivo INS'));
ok('asesor: la guia lleva cg', /explicacion\/\?[^"]*cg=Asesor%20de%20Seguros/.test(mA));
CFG.FROM_EMAIL = 'agente@ejemplo.test';
const mN = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', prices: precios });
ok('agente: igual que siempre (Tu agente, Propiedad intelectual, Agente exclusivo)', mN.includes('Tu agente &middot; Lic. SUGESE 00-0009') && mN.includes('Propiedad intelectual de Asesor Prueba Uno') && mN.includes('Agente exclusivo INS'));
ok('agente: sin cg en los enlaces', !/[?&]cg=/.test(mN));
CFG.CITA_MODO = 'sdi'; CFG.FROM_EMAIL = ASESOR;
ok('asesor: /cita/ y el configurador reciben cg', /[?&]cg=/.test(_buildCitaUrl({ clientName: 'Mariela' })) && /[?&]cg=/.test(_buildPlanesUrl({ clientName: 'Mariela', primaAnual: '570,891.00' })));
ok('el acortador /g acepta cg', CLAVES.has('cg'));

console.log('-- correo de poliza activa --');
const pol = P.buildPolizaActivaEmail({ nombrePila: 'Ana', cliente: 'Ana Prueba', poliza: '0101AUT000000000', vehiculo: 'NISSAN', placa: 'ABC123', notaAdicional: '' });
ok('asesor: firma con su cargo y no "Agente de Seguros Exclusivo"', pol.includes('Asesor de Seguros<br>Oficina de Agente Titular, agente') && !pol.includes('Agente de Seguros Exclusivo'));
CFG.FROM_EMAIL = 'agente@ejemplo.test';
ok('agente: poliza igual que siempre', P.buildPolizaActivaEmail({ nombrePila: 'Ana', cliente: 'Ana Prueba', poliza: '0101AUT000000000', vehiculo: 'NISSAN', placa: 'ABC123', notaAdicional: '' }).includes('Agente de Seguros Exclusivo'));

console.log('-- guia, configurador y /cita/ --');
const guia = leer('explicacion/index.html');
ok('guia: lee cg y firma con el', /cg: \(_params\.get\('cg'\) \|\| ''\)/.test(guia) && guia.includes("cgP[0] ? `${data.n}, ${cgP[0].toLowerCase()}, te acompaña`"));
ok('guia: pasa cg a /cita/ y al configurador', guia.includes("add('cg', d.cg)") && guia.includes("add('cg', data.cg)"));
ok('configurador: cg en el pie y hacia /cita/', /param\('cg'\) \? param\('cg'\)/.test(leer('asistencias/index.html')) && leer('asistencias/index.html').includes("add('cg', param('cg'))"));
ok('/cita/: pie con el cargo', leer('cita/index.html').includes("(ag.cg || 'agente exclusivo del INS')"));
const base = { nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test', direccion: 'Heredia, Belen', placa: 'BDF482', formaPago: 'Anual', fecha: '2030-01-07', franja: '8:00 am a 10:00 am', consent: true, n: 'Asesor Prueba Uno', l: '00-0009', ae: 'agente@ejemplo.test', c: 'Mariela' };
const ctx = { agentes: new Set(['agente@ejemplo.test']), now: new Date('2030-01-01T15:00:00Z') };
const vc = validarCita({ ...base, cg: CARGO }, ctx);
ok('servidor de la cita: acepta cg', vc.ok && vc.datos.cg === CARGO);
ok('servidor de la cita: cg con < se descarta', validarCita({ ...base, cg: '<b>x' }, ctx).datos.cg === '');
const cc = correoCliente({ ...vc.datos, as: [] });
ok('confirmacion de la cita: firma de asesor', cc.html.includes('Asesor de Seguros<br>Oficina de Agente Titular, agente &middot; Licencia SUGESE 00-0009') && !cc.html.includes('Agente exclusivo del INS'));
ok('confirmacion de la cita: texto plano tambien', cc.texto.includes('Asesor de Seguros\nOficina de Agente Titular, agente - Licencia SUGESE 00-0009'));
const cn = correoCliente({ ...validarCita(base, ctx).datos, as: [] });
ok('confirmacion de la cita: agente igual que siempre', cn.html.includes('Agente exclusivo del INS &middot; Licencia SUGESE 00-0009') && cn.texto.includes('Agente exclusivo del INS - Licencia SUGESE 00-0009'));

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
