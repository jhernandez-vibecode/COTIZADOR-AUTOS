/**
 * Tests de la guía para aceptar la póliza (19 nov 2026): la página /aceptar/,
 * el enlace con la ficha del agente, el mensaje de WhatsApp y el enlace corto /k.
 *
 * Vigila sobre todo:
 *   1. Que la ficha salga del perfil del agente (multi-agente) y que José y
 *      Melanie salgan con su cargo de asesor, no como agentes.
 *   2. Que a un cero kilómetros no se le diga «ya tenemos las fotos».
 *   3. Que la página pinte TODO con textContent: los parámetros vienen del enlace.
 *   4. Que el acortador acepte el enlace real y nada más.
 *
 * Run: node tests/test-aceptar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { esNuestro, CLAVES_K, CLAVES } from '../netlify/functions/lib/validacion.mjs';

const require = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('FAIL ' + name); } }

// Agente inventado: nada de los datos de JC.
global.CFG = {
  FROM_NAME: 'Laura Prueba Rojas', FROM_EMAIL: 'laura@ejemplo.test', LICENSE: '99-0001',
  PHONE: '7000-0000', WHATSAPP: '7000-1111', WEBSITE: 'https://www.ejemplo.test/',
  ACEPTAR_URL: 'https://cotizador.appsegurosdigitales.com/aceptar/'
};
const marca = require('../js/email-marca.js');
Object.keys(marca).forEach((k) => { global[k] = marca[k]; });
const A = require('../js/aceptar-wa.js');

// ---- 1. El enlace a la guía ----
const u = new URL(A.aceptarGuiaUrl({ nombrePila: 'Silvia' }));
const q = u.searchParams;
ok('url: va a /aceptar/', u.origin + u.pathname === 'https://cotizador.appsegurosdigitales.com/aceptar/');
ok('url: nombre del perfil', q.get('n') === 'Laura Prueba Rojas');
ok('url: licencia del perfil', q.get('l') === '99-0001');
ok('url: WhatsApp del perfil en formato 506', q.get('wa') === '50670001111');
ok('url: correo del perfil', q.get('em') === 'laura@ejemplo.test');
ok('url: web sin https ni barra final', q.get('w') === 'www.ejemplo.test');
ok('url: saludo del cliente', q.get('c') === 'Silvia');
ok('url: un agente no lleva cargo', !q.has('cg'));
ok('url: sin cero km no lleva k0', !q.has('k0'));
ok('url: cero km lleva k0=1', new URL(A.aceptarGuiaUrl({ nombrePila: 'X', ceroKm: true })).searchParams.get('k0') === '1');
ok('url: todas las claves están en la lista blanca del acortador', [...q.keys()].every((k) => CLAVES_K.has(k)));
ok('url: el acortador acepta el enlace real', esNuestro(u.search.slice(1), CLAVES_K));
const uk = new URL(A.aceptarGuiaUrl({ nombrePila: 'X', ceroKm: true }));
ok('url: el acortador acepta el de cero km', esNuestro(uk.search.slice(1), CLAVES_K));
{
  const w = CFG.WHATSAPP; CFG.WHATSAPP = '';
  ok('url: sin el WhatsApp cae al teléfono', new URL(A.aceptarGuiaUrl({})).searchParams.get('wa') === '50670000000');
  CFG.WHATSAPP = w;
}

// Asesores: José y Melanie (SDI_ASESORES)
const conCorreo = (correo, fn) => { const c = CFG.FROM_EMAIL; CFG.FROM_EMAIL = correo; try { return fn(); } finally { CFG.FROM_EMAIL = c; } };
ok('url: José lleva su cargo de asesor',
  conCorreo('tramites@segurosdelins.com', () => new URL(A.aceptarGuiaUrl({})).searchParams.get('cg')) === 'Asesor de Seguros · Oficina de Fernando Hernández, agente');
ok('url: Melanie lleva «Asesora»',
  conCorreo('fhernandez@segurosdelins.com', () => new URL(A.aceptarGuiaUrl({})).searchParams.get('cg')).startsWith('Asesora de Seguros'));

// ---- 2. El mensaje de WhatsApp ----
const URLC = 'https://guia.appsegurosdigitales.com/k/ABCDEFGHJK';
const t = A.buildAceptarWaTexto({ nombrePila: 'Silvia', vehiculo: 'Toyota RAV4', placa: 'brk454', urlGuia: URLC });
ok('wa: saluda por el nombre', t.startsWith('Hola Silvia, '));
ok('wa: firma con dos palabras del nombre del perfil', t.includes('soy Laura Prueba, su agente del INS.'));
ok('wa: ya tenemos las fotos, con vehículo y placa en mayúscula', t.includes('Ya tenemos las fotos de su Toyota RAV4 (BRK454).'));
ok('wa: el asunto exacto del correo del INS', t.includes('«Aceptación de proceso para emisión AutoVoluntario – INS»'));
ok('wa: lleva el enlace', t.includes('\n' + URLC + '\n'));
ok('wa: cierra pidiendo que escriba', t.endsWith('Cualquier duda me escribe por aquí.'));
const t0 = A.buildAceptarWaTexto({ nombrePila: 'Ana', vehiculo: 'Kia Seltos', ceroKm: true, urlGuia: URLC });
ok('wa: 🔴 a un cero km NO le habla de fotos', !/foto/i.test(t0));
ok('wa: cero km dice qué se asegura', t0.includes('El siguiente paso para asegurar su Kia Seltos es aceptar la póliza'));
ok('wa: sin enlace no deja la línea colgando', !A.buildAceptarWaTexto({ nombrePila: 'Ana' }).includes('Aquí le dejo'));
ok('wa: José se presenta como asesor',
  conCorreo('tramites@segurosdelins.com', () => A.buildAceptarWaTexto({ nombrePila: 'X' })).includes('su asesor de seguros del INS'));
ok('wa: Melanie se presenta como asesora',
  conCorreo('fhernandez@segurosdelins.com', () => A.buildAceptarWaTexto({ nombrePila: 'X' })).includes('su asesora de seguros del INS'));
const w = A.buildAceptarWaUrl({ nombrePila: 'Silvia', telCliente: '8888-1234', urlGuia: URLC });
ok('wa: web.whatsapp.com, nunca wa.me', w.startsWith('https://web.whatsapp.com/send/?') && !w.includes('wa.me'));
ok('wa: teléfono del cliente con 506', w.includes('phone=50688881234&'));
ok('wa: sin teléfono abre el selector', !A.buildAceptarWaUrl({ nombrePila: 'X' }).includes('phone='));
ok('wa: el texto viaja codificado', decodeURIComponent(w.split('text=')[1]) === A.buildAceptarWaTexto({ nombrePila: 'Silvia', urlGuia: URLC }));

// ---- 3. Datos de una fila de Cotizaciones ----
global.historyEntryPlate = (e) => e.plate || '';
const d = A.aceptarDatosDeCotizacion({ client: 'Silvia', plate: 'brk454', vehicle: 'Toyota RAV4', waCliente: '88881234',
  guideUrl: 'https://x.test/explicacion/?n=a&p=BRK454' });
ok('fila: toma nombre, placa, vehículo y WhatsApp', d.nombrePila === 'Silvia' && d.placa === 'BRK454' && d.vehiculo === 'Toyota RAV4' && d.telCliente === '88881234');
ok('fila: sin k0 no es cero km', d.ceroKm === false);
const d0 = A.aceptarDatosDeCotizacion({ client: 'Ana', plate: '000111', guideUrl: 'https://x.test/explicacion/?n=a&k0=1' });
ok('fila: el relleno 000111 no pasa como placa', d0.placa === '');
ok('fila: k0=1 marca el cero km', d0.ceroKm === true);

// ---- 4. El acortador ----
ok('k: rechaza una clave que no es de la guía', !esNuestro('n=a&va=100', CLAVES_K));
ok('k: rechaza javascript:', !esNuestro('n=javascript:alert(1)', CLAVES_K));
ok('k: no se mezcla con la lista de /g', !CLAVES.has('em'));
const enl = R('netlify/functions/enlace.mjs');
ok('k: la Function atiende /k y /k/:id', enl.includes('"/k", "/k/:id"'));
ok('k: destino /aceptar/ de este mismo sitio', enl.includes('const DESTINO_K = "/aceptar/";'));
ok('k: clave propia en el store', enl.includes('esAceptar ? "k:" + id'));
ok('k: huella propia', enl.includes('esAceptar ? "hk:"'));
ok('k: shortlink.js manda el tipo k a /k', R('js/shortlink.js').includes("tipo === 'k' ? '/k'"));

// ---- 5. La página /aceptar/ ----
const html = R('aceptar/index.html');
const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
ok('página: el script no usa innerHTML', !/innerHTML|insertAdjacentHTML|document\.write/.test(js));
ok('página: logo del INS arriba', html.indexOf('img/ins-logo-azul.png') < html.indexOf('Acepte su póliza en <b>'));
ok('página: logo SDI al pie', html.indexOf('img/sdi-logo-principal.svg') > html.indexOf('id="agente"'));
ok('página: vista previa para WhatsApp', html.includes('og:image') && html.includes('img/og-aceptar.png'));
ok('página: no se indexa', html.includes('name="robots" content="noindex"'));
ok('página: el chat del agente es web.whatsapp.com', js.includes('https://web.whatsapp.com/send/?phone=506') && !js.includes('wa.me'));
ok('página: no trae datos de JC escritos', !html.includes('8822') && !html.includes('08-1318') && !html.includes('jhernandez'));
for (const f of ['img/ins-logo-azul.png', 'img/sdi-logo-principal.svg', 'img/og-aceptar.png', 'img/favicon.svg']) {
  ok('página: existe ' + f, fs.existsSync(path.join(RAIZ, f)));
}

// La página corre con un DOM mínimo: lo que escribe sale de los parámetros.
function correrPagina(qs) {
  const els = {};
  const nodo = (id) => (els[id] = els[id] || {
    id, textContent: '', hidden: id === 'saludo', href: '#',
    append(...xs) { xs.forEach((x) => { this.textContent += (typeof x === 'string' ? x : x.textContent); }); }
  });
  const ctx = vm.createContext({
    location: { search: qs }, URLSearchParams, String, Math,
    document: { getElementById: nodo, createElement: () => ({ textContent: '' }) }
  });
  vm.runInContext(js, ctx);
  return els;
}
const p1 = correrPagina('?n=Jos%C3%A9%20Prueba&l=08-0000&wa=50670002222&em=a%40b.test&cg=Asesor%20de%20Seguros%20%C2%B7%20Oficina%20X&c=%3Cimg%20src%3Dx%3E');
ok('página: nombre del agente', p1.agNom.textContent === 'José Prueba');
ok('página: cargo del asesor', p1.agCargo.textContent === 'Asesor de Seguros · Oficina X');
ok('página: licencia', p1.agLic.textContent === 'Licencia SUGESE 08-0000');
ok('página: WhatsApp mostrado con guion', p1.waTxt.textContent === '7000-2222');
ok('página: botón al chat del agente', p1.waBtn.href === 'https://web.whatsapp.com/send/?phone=50670002222');
ok('página: el saludo se ve y va como texto', p1.saludo.hidden === false && p1.cli.textContent === '<img src=x>');
const p2 = correrPagina('?n=Ana&wa=123');
ok('página: un agente sin cargo dice «Agente de Seguros del INS»', p2.agCargo.textContent === 'Agente de Seguros del INS');
ok('página: WhatsApp inválido esconde el botón', p2.duda.hidden === true);
// Sin c el script ni toca el saludo: queda con el hidden del HTML.
ok('página: sin saludo no muestra «Hola»', !p2.saludo && /<p class="saludo" id="saludo" hidden>/.test(html));
const p3 = correrPagina('');
ok('página: sin ficha esconde el pie del agente', p3.agente.hidden === true);
const p4 = correrPagina('?n=A&k0=1');
ok('página: cero km cambia el paso 2', /cero kilómetros no hacen falta/.test(p4.p2txt.textContent) && !/ya las enviamos/.test(p4.p2txt.textContent));

// ---- 6. La consola ----
const idx = R('index.html');
for (const id of ['btnAceptarNuevo', 'aceptarModal', 'ac-nom', 'ac-placa', 'ac-veh', 'ac-wa', 'ac-0km', 'ac-msg', 'btnAceptarCopiar', 'btnAceptarWa', 'btnAceptarClose', 'aceptarDesde']) {
  ok('consola: existe #' + id, idx.includes('id="' + id + '"'));
}
const orden = ['js/shortlink.js', 'js/email-marca.js', 'js/aceptar-wa.js', 'js/aceptar-ui.js', 'js/app.js'].map((f) => idx.indexOf('<script src="' + f + '"'));
ok('consola: orden de carga', orden.every((x, i) => x > 0 && (i === 0 || x > orden[i - 1])));
ok('consola: app.js engancha con guard', R('js/app.js').includes("if (typeof initAceptarModal === 'function') initAceptarModal();"));
ok('consola: el cuadro no toca el registro', !/saveHistory|marcar|replaceHistory/.test(R('js/aceptar-ui.js')));
ok('consola: acorta con el tipo k', R('js/aceptar-ui.js').includes("acortarEnlace(larga, 'k')"));
ok('consola: reserva la pestaña antes del await',
  /window\.open\('', '_blank'\);\s*var url = buildAceptarWaUrl\(Object\.assign\(\{\}, p, \{ urlGuia: await/.test(R('js/aceptar-ui.js')));
ok('config: ACEPTAR_URL', R('js/config.js').includes("ACEPTAR_URL: 'https://cotizador.appsegurosdigitales.com/aceptar/'"));

console.log(`aceptar: ${pass} OK, ${fail} FAIL`);
if (fail) process.exit(1);
