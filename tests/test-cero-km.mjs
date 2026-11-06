/**
 * Cero kilometros (JC, 4 nov 2026): el unico requisito es una factura proforma con
 * los datos finales del vehiculo o una copia de la factura de compra. No hay fotos.
 * La marca `k0=1` viaja del correo a la guia, al configurador y a /cita/, y cambia
 * "el dia de tu cita" en las cuatro caras. Sin la marca, NADA cambia.
 * Datos INVENTADOS. Run: node tests/test-cero-km.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CLAVES } from '../netlify/functions/lib/validacion.mjs';
import { validarCita } from '../netlify/functions/lib/cita-validacion.mjs';
import { correoCliente, correoAgente } from '../netlify/functions/lib/cita-correos.mjs';

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }

const A = require('../js/planes-asistencia.js');
Object.keys(A).forEach((k) => { globalThis[k] = A[k]; });
globalThis.asiDisponible = () => false;
globalThis.CFG = {
  FROM_NAME: 'Agente Prueba Uno', FROM_EMAIL: 'agente@ejemplo.test', LICENSE: '00-0000', WEBSITE: 'www.ejemplo.test',
  AGENDA_URL: 'https://ejemplo.test/agenda', WHATSAPP: '8888-1111', PHONE: '8888-2222',
  GUIDE_URL: 'https://ejemplo.test/explicacion/', PLANES_URL: 'https://ejemplo.test/asistencias/',
  CITA_URL: 'https://ejemplo.test/cita/', CITA_MODO: 'propio',
  LOGO_URL: 'https://ejemplo.test/img/ins-logo.png', LOGO_SDI_URL: 'https://ejemplo.test/img/sdi.png'
};
const M = require('../js/email-marca.js');
Object.keys(M).forEach((k) => { globalThis[k] = M[k]; });
(0, eval)(leer('js/email-template.js'));

console.log('-- cuando es cero kilometros --');
ok('interes "cero-km" → si', _esCeroKm('cero-km', 'PART-PARTICULAR'));
ok('placa temporal del INS → si (aunque no marquen el interes)', _esCeroKm('', 'SIN - PLACA TEMPORAL'));
ok('particular sin marca → no', !_esCeroKm('propietario', 'PART-PARTICULAR'));
ok('sin datos → no', !_esCeroKm('', ''));

console.log('-- enlaces del correo --');
const precios = { anual: '570,891.00', semestral: '308,283.00', trimestral: '158,423.00' };
const ex = { clientName: 'Mariela', vehicle: 'TOYOTA RAV4', year: 2027, prices: precios };
ok('guia normal: SIN k0', !/[?&]k0=/.test(_buildGuideUrl(ex)));
ok('guia 0 km: k0=1 (modo propio tambien)', /[?&]k0=1(&|$)/.test(_buildGuideUrl({ ...ex, ceroKm: true })));
const m0 = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: '000111', plateClass: 'SIN - PLACA TEMPORAL', prices: precios });
ok('buildEmail con placa temporal: la guia lleva k0=1', /explicacion\/\?[^"]*k0=1/.test(m0));
const mI = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', interes: 'cero-km', prices: precios });
ok('buildEmail con interes cero-km: la guia lleva k0=1', /explicacion\/\?[^"]*k0=1/.test(mI));
const mN = buildEmail({ nombre: 'Mariela', vehiculo: 'TOYOTA RAV4', plate: 'BDF482', interes: 'propietario', prices: precios });
ok('buildEmail normal: nada de k0', !/k0=/.test(mN));
CFG.CITA_MODO = 'sdi';
ok('sdi: el boton del correo a /cita/ lleva k0', /[?&]k0=1/.test(_buildCitaUrl({ ...ex, ceroKm: true })));
ok('sdi: /cita/ normal sin k0', !/k0=/.test(_buildCitaUrl(ex)));
ok('sdi: el configurador pasa k0 hacia /cita/', /[?&]k0=1/.test(_buildPlanesUrl({ clientName: 'Mariela', primaAnual: '570,891.00', ceroKm: true })));
ok('el acortador /g acepta k0', CLAVES.has('k0'));
ok('app.js manda la misma marca al historial y al WhatsApp', /ceroKm:\s*_esCeroKm\(/.test(leer('js/app.js')));

console.log('-- guia --');
const guia = leer('explicacion/index.html');
ok('lee k0', /k0:\s*_params\.get\('k0'\) === '1'/.test(guia));
ok('aplicarCeroKm corre al personalizar', /aplicarSecciones\(_parseCbMapa\(data\.cb\)\);\s*aplicarCeroKm\(\);/.test(guia));
ok('aplicarCeroKm sale sin k0', /function aplicarCeroKm\(\) \{\s*if \(!data\.k0\) return;/.test(guia));
ok('pide la factura proforma o la copia de la factura', guia.indexOf('factura proforma con los datos finales del vehículo') !== -1 && guia.indexOf('copia de la factura de compra') !== -1);
ok('el paso 2 manda la factura al agente', guia.indexOf('enviale la factura a tu agente</b> por correo o WhatsApp') !== -1);
const puro = guia.slice(guia.indexOf('// ===== [GUIA-CITA-PURO]'), guia.indexOf('// ===== [/GUIA-CITA-PURO]'));
(0, eval)(puro);
ok('la guia pasa k0 a /cita/', /[?&]k0=1/.test(_urlCita({ n: 'A', ae: 'a@b.cr', k0: true }, '')));
ok('la guia sin k0 no lo inventa', !/k0/.test(_urlCita({ n: 'A', ae: 'a@b.cr', k0: false }, '')));
ok('la guia pasa k0 al configurador', /if \(data\.k0\) add\('k0', '1'\);/.test(guia));
ok('el configurador pasa k0 a /cita/', /param\('k0'\) === '1'\) add\('k0', '1'\)/.test(leer('asistencias/index.html')));

console.log('-- /cita/ --');
const cita = leer('cita/index.html');
ok('lee k0 y lo manda en el POST como booleano', /k0: g\('k0'\) === '1'/.test(cita));
ok('con k0 cambia la ayuda del horario (sin fotos)', cita.indexOf('no hacen falta fotos ni tenerlo a mano') !== -1);
ok('con k0 la pantalla final pide la factura', cita.indexOf('Pedí la factura a la agencia.') !== -1);

console.log('-- servidor y correos --');
const base = {
  nombre: 'Mariela Quesada Rojas', telefono: '8888-0000', correo: 'mariela@ejemplo.test', direccion: 'Heredia, Belen. Porton gris',
  placa: 'Cero kilómetros', formaPago: 'Anual', fecha: '2030-01-07', franja: '8:00 am a 10:00 am', consent: true,
  n: 'Agente Prueba Uno', l: '00-0000', ae: 'agente@ejemplo.test', c: 'Mariela'
};
const ag = new Set(['agente@ejemplo.test']);
const v1 = validarCita({ ...base, k0: true }, { agentes: ag, now: new Date('2030-01-01T15:00:00Z') });
const v2 = validarCita({ ...base, k0: 'si', placa: 'BDF482' }, { agentes: ag, now: new Date('2030-01-01T15:00:00Z') });
const v3 = validarCita({ ...base, ia: 'cero-km', placa: 'BDF482' }, { agentes: ag, now: new Date('2030-01-01T15:00:00Z') });
ok('validacion: k0 true pasa', v1.ok && v1.datos.k0 === true);
ok('validacion: k0 que no es true literal no cuenta', v2.ok && v2.datos.k0 === false);
ok('validacion: interes cero-km tambien cuenta', v3.ok && v3.datos.k0 === true);

// La firma del agente la pone el servidor desde su ficha (lib/agentes.mjs: firmaDe).
const AG = { email: 'agente@ejemplo.test', nombre: 'Agente Prueba Uno', licencia: '00-0000', telefono: '8888-1111', whatsapp: '8888-1111', cargo: '', oficina: '' };
const dN = { ...base, placa: 'BDF482', k0: false, as: [] };
const d0 = { ...base, placa: 'BDF482', k0: true, as: [] };
const cN = correoCliente(dN, AG), c0 = correoCliente(d0, AG);
ok('cliente normal: sigue con fotos e inspeccion', /Subí tus fotos/.test(cN.html) && /inspección virtual/.test(cN.html));
ok('cliente 0 km: sin fotos ni inspeccion virtual', !/Subí tus fotos/.test(c0.html) && !/inspección virtual/.test(c0.html));
ok('cliente 0 km: pide la factura a la agencia', /Pedí la factura a la agencia/.test(c0.html) && /copia de la factura de compra/.test(c0.html));
ok('cliente 0 km: texto plano tambien pide la factura', /factura proforma/.test(c0.texto) && !/inspección virtual/.test(c0.texto));
ok('cliente 0 km: el asunto no cambia de forma (placa)', c0.asunto === 'Recibimos tu solicitud de cita · BDF482');
const aN = correoAgente(dN, AG), a0 = correoAgente(d0, AG);
const waTxt = (h) => decodeURIComponent((h.match(/&amp;text=([^"]+)"/) || [])[1] || '');
ok('WhatsApp normal: enlace de las fotos (6 nov 2026: ya no QR)', /un enlace para iniciar el aseguramiento/.test(waTxt(aN.html)) && !/código QR/.test(waTxt(aN.html)));
ok('WhatsApp 0 km: pide la factura, sin QR', /factura proforma/.test(waTxt(a0.html)) && !/código QR/.test(waTxt(a0.html)));
ok('correo del agente: el texto plano no cambia (lo lee el recordatorio)', aN.texto === a0.texto);

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
