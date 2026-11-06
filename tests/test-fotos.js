/**
 * Tests de "Fotos para asegurar" (6 nov 2026): correo "Paso 1 · Fotografías",
 * su WhatsApp, el cuadro y el botón 📷 de Cotizaciones.
 *
 * Vigila sobre todo:
 *   1. Que solo entre un enlace de la plataforma del INS (asegurarte.grupoins.com):
 *      el correo va firmado con la licencia SUGESE del agente.
 *   2. Que el correo y los textos al cliente ya no hablen de código QR.
 *   3. Que la firma salga del perfil del agente (multi-agente), no de JC.
 *   4. Que la marca "Fotos enviadas" no cuente como póliza (no toca la conversión).
 *
 * Run: node tests/test-fotos.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

// Agente inventado: la firma tiene que salir de acá, no de los datos de JC.
global.CFG = {
  FROM_NAME: 'Laura Prueba Rojas', FROM_EMAIL: 'laura@ejemplo.test', LICENSE: '99-0001',
  PHONE: '7000-0000', WEBSITE: 'www.ejemplo.test',
  LOGO_URL: 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png',
  FOTOS_GUIA_URL: 'https://cotizador.appsegurosdigitales.com/documentos-ins/guia-fotografias-autos.pdf'
};
const marca = require('../js/email-marca.js');
Object.keys(marca).forEach((k) => { global[k] = marca[k]; });
const F = require('../js/fotos-email.js');

const LINK = 'https://asegurarte.grupoins.com/auto/K472PQ-Asesor';

// ---- 1. Enlace del INS ----
ok('enlace: el formato real del INS pasa', F.esEnlaceFotosIns(LINK));
ok('enlace: tolera espacios al pegar', F.esEnlaceFotosIns('  ' + LINK + ' '));
ok('enlace: http sin s no pasa', !F.esEnlaceFotosIns('http://asegurarte.grupoins.com/auto/K472PQ-Asesor'));
ok('enlace: otro sitio no pasa', !F.esEnlaceFotosIns('https://ejemplo.com/auto/K472PQ'));
ok('enlace: subdominio trampa no pasa', !F.esEnlaceFotosIns('https://asegurarte.grupoins.com.malo.com/auto/x'));
ok('enlace: usuario trampa no pasa', !F.esEnlaceFotosIns('https://asegurarte.grupoins.com@malo.com/auto/x'));
ok('enlace: solo el dominio no pasa', !F.esEnlaceFotosIns('https://asegurarte.grupoins.com/'));
ok('enlace: comillas o espacios internos no pasan', !F.esEnlaceFotosIns('https://asegurarte.grupoins.com/auto/a"b') && !F.esEnlaceFotosIns('https://asegurarte.grupoins.com/auto/a b'));
ok('enlace: vacío no pasa', !F.esEnlaceFotosIns('') && !F.esEnlaceFotosIns(null));

// ---- 2. Correo ----
const p = { nombrePila: 'Laura', vehiculo: 'TOYOTA COROLLA 2021', placa: 'BRT482', enlace: LINK, correo: 'c@ejemplo.test' };
const html = F.buildFotosEmail(p);
ok('correo: saluda por el nombre', html.indexOf('Laura,') !== -1);
ok('correo: el enlace va en el botón y escrito', html.split(LINK).length - 1 >= 3);
ok('correo: botón "Tomar las fotografías"', /Tomar las fotograf&iacute;as/.test(html));
ok('correo: paso 2 dice abrir el enlace', /Abra el enlace de arriba desde su tel&eacute;fono celular/.test(html));
ok('correo: sin código QR', !/QR/i.test(html) && !/escane/i.test(html));
ok('correo: textos de JC (inspección, localización, verificación)', /inspecci&oacute;n fotogr&aacute;fica/.test(html) && /Active la localizaci&oacute;n/.test(html) && /haya sido aprobada/.test(html));
ok('correo: enlace a la guía de fotos del sitio', html.indexOf(CFG.FOTOS_GUIA_URL) !== -1 && /gu&iacute;a de las fotograf&iacute;as/.test(html));
ok('correo: tarjeta con la placa dibujada', /Veh&iacute;culo por asegurar/.test(html) && html.indexOf('TOYOTA COROLLA 2021') !== -1);
ok('correo: filete y pie SDI', html.indexOf('#C9A227') !== -1 && /SDI Seguros Digitales INS/.test(html));
ok('correo: firma del perfil del agente, no la de JC', html.indexOf('Laura Prueba Rojas') !== -1 && html.indexOf('99-0001') !== -1 && html.indexOf('08-1318') === -1);
ok('correo: sin barra de color a la izquierda', !/border-left/.test(html));
const sinVeh = F.buildFotosEmail({ nombrePila: 'Ana', enlace: LINK });
ok('correo: sin vehículo ni placa no hay tarjeta', !/Veh&iacute;culo por asegurar/.test(sinVeh));
const malo = F.buildFotosEmail({ nombrePila: 'Ana', enlace: 'https://malo.com/x' });
ok('correo: un enlace ajeno no entra al correo', malo.indexOf('malo.com') === -1);
const xss = F.buildFotosEmail({ nombrePila: '<img src=x onerror=alert(1)>', notaAdicional: '<script>x</script>', enlace: LINK });
ok('correo: escapa nombre y nota', xss.indexOf('<img src=x') === -1 && xss.indexOf('<script>x') === -1 && xss.indexOf('&lt;script&gt;') !== -1);
const conNota = F.buildFotosEmail(Object.assign({}, p, { notaAdicional: 'Me avisa al terminar' }));
ok('correo: la nota va con su rótulo', /Nota de su agente/.test(conNota) && conNota.indexOf('Me avisa al terminar') !== -1);
ok('asunto: con placa', F.fotosAsunto(p) === 'Paso 1 · Fotografías para asegurar su vehículo · BRT482');
ok('asunto: sin placa', F.fotosAsunto({}) === 'Paso 1 · Fotografías para asegurar su vehículo');

// ---- 3. WhatsApp ----
const wa = F.buildFotosWaUrl(Object.assign({}, p, { telCliente: '8888-0000' }));
const waTxt = decodeURIComponent(wa.split('text=')[1]);
ok('WhatsApp: web.whatsapp con 506', wa.indexOf('https://web.whatsapp.com/send/?phone=50688880000&') === 0 && wa.indexOf('wa.me') === -1);
ok('WhatsApp: sin número abre el selector', F.buildFotosWaUrl(p).indexOf('https://web.whatsapp.com/send/?text=') === 0);
ok('WhatsApp: saluda y se presenta con dos palabras', waTxt.indexOf('Hola Laura, soy Laura Prueba, su agente del INS.') === 0);
ok('WhatsApp: lleva el enlace tal cual y el vehículo', waTxt.indexOf(LINK) !== -1 && waTxt.indexOf('TOYOTA COROLLA 2021 (BRT482)') !== -1);
ok('WhatsApp: de usted y sin QR', /Active la localización/.test(waTxt) && !/\bvos\b|abrís/.test(waTxt) && !/QR/.test(waTxt));

// ---- 4. Cuadro, registro y lista (history.js + stats-ui.js + fotos-ui.js en vm) ----
const store = {};
const g = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  console, CFG: global.CFG, showToast() {}, driveRestoreNow() {},
  acortarGuia: (u) => Promise.resolve(u), document: { getElementById: () => null }
};
Object.keys(marca).forEach((k) => { g[k] = marca[k]; });
const ctx = vm.createContext(g);
for (const f of ['js/history.js', 'js/stats-ui.js', 'js/fotos-ui.js']) vm.runInContext(R(f), ctx, { filename: f });

const d1 = g.fotosDatosDeCotizacion({ client: 'Laura', plate: 'brt482', vehicle: 'TOYOTA COROLLA 2021', email: 'c@ejemplo.test', waCliente: '88880000' });
ok('cuadro: llena los datos de la cotización', d1.nombrePila === 'Laura' && d1.placa === 'BRT482' && d1.correo === 'c@ejemplo.test' && d1.telCliente === '88880000');
ok('cuadro: el relleno del 0 km no es placa', g.fotosDatosDeCotizacion({ plate: '000111' }).placa === '');
ok('cuadro: placa legacy desde la guía', g.fotosDatosDeCotizacion({ guideUrl: 'https://x/explicacion/?c=A&p=BXY123' }).placa === 'BXY123');

const hoy = new Date().toISOString();
store.cotizador_sdi_history_v1 = JSON.stringify([
  { id: 'a1', date: hoy, client: 'Laura', clientFull: 'PRUEBA LAURA', plate: 'BRT482', email: 'c@ejemplo.test' },
  { id: 'a2', date: hoy, client: 'Diego', plate: 'CL214587', polizaAt: hoy },
  { id: 'a3', date: hoy, client: 'Nuevo', plate: '000111', guideUrl: 'https://x/explicacion/?c=Nuevo&k0=1' }
]);
ok('registro: sin id no marca nada', g.marcarFotosEnviadas('') === false && g.marcarFotosEnviadas('zzz') === false);
ok('registro: marca la cotización', g.marcarFotosEnviadas('a1') === true);
const tras = JSON.parse(store.cotizador_sdi_history_v1);
ok('registro: guarda fotosAt y updatedAt', !!tras[0].fotosAt && tras[0].updatedAt === tras[0].fotosAt);
ok('registro: fotos enviadas NO es póliza', g.historyTienePoliza(tras[0]) === false);

const lista = g._statsListHtml(tras);
const filas = lista.split('<div class="stat-row');
ok('lista: botón 📷 Fotos en la cotización sin póliza', /data-fotos="a1"/.test(filas[1]));
ok('lista: sin botón en la que ya tiene póliza', !/data-fotos/.test(filas[2]));
ok('lista: sin botón en un cero kilómetros', !/data-fotos/.test(filas[3]));
ok('lista: marca "Fotos enviadas" con fecha', /📷 Fotos enviadas &middot; /.test(filas[1]) && !/Fotos enviadas/.test(filas[2]));

// ---- 5. Página, carga y textos ----
const idx = R('index.html');
const pos = (s) => idx.indexOf(s);
ok('index: fotos-email después de email-marca', pos('js/email-marca.js') < pos('js/fotos-email.js') && pos('js/fotos-email.js') > 0);
ok('index: fotos-ui antes de app.js', pos('js/fotos-ui.js') > 0 && pos('js/fotos-ui.js') < pos('js/app.js'));
ok('index: el cuadro va después de Cotizaciones (queda encima)', pos('id="statsModal"') < pos('id="fotosModal"'));
ok('index: botón de cliente nuevo dentro de Cotizaciones', pos('id="btnFotosNuevo"') > pos('id="statsModal"') && pos('id="btnFotosNuevo"') < pos('id="fotosModal"'));
['fo-nom', 'fo-placa', 'fo-veh', 'fo-mail', 'fo-link', 'fo-wa', 'fo-nota', 'fo-prev', 'btnFotosSend', 'btnFotosWa', 'btnFotosVolver', 'fotosDone']
  .forEach((id) => ok('index: existe #' + id, idx.indexOf('id="' + id + '"') !== -1));
ok('app.js: arranca el cuadro con guard typeof', /typeof initFotosModal === 'function'\) initFotosModal\(\)/.test(R('js/app.js')));
ok('guía de fotos: el PDF está en el sitio', fs.existsSync(path.join(__dirname, '..', 'documentos-ins', 'guia-fotografias-autos.pdf')));
ok('guía de fotos: config apunta a ese archivo', /FOTOS_GUIA_URL:\s*'https:\/\/cotizador\.appsegurosdigitales\.com\/documentos-ins\/guia-fotografias-autos\.pdf'/.test(R('js/config.js')));
ok('textos: la guía ya no habla de código QR', !/Código QR/.test(R('explicacion/index.html')) && /Te enviaremos un <b>enlace a tu correo<\/b>/.test(R('explicacion/index.html')));
ok('textos: /cita/ ya no habla de código QR', !/código QR/i.test(R('cita/index.html')) && /Te llega un enlace al correo/.test(R('cita/index.html')));
ok('textos: correos de la cita sin código QR', !/código QR/i.test(R('netlify/functions/lib/cita-correos.mjs')));

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
