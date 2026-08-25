/**
 * Tests de js/poliza-email.js — correo "Póliza Activa".
 * Verifica contenido esencial + personalización por agente (CFG).
 * Correr: node tests/test-poliza-email.js
 */
global.CFG = {
  FROM_NAME: 'Juan Carlos Hernandez Vargas',
  FROM_EMAIL: 'jhernandez@segurosdelins.com',
  LICENSE: '08-1318',
  PHONE: '8822-1348',
  WHATSAPP: '8822-1348',
  WEBSITE: 'www.segurosdelins.com',
  LOGO_URL: 'https://cotizador.appsegurosdigitales.com/img/ins-logo.png',
  ASSIST_URL: 'https://appasistenciaseguroautos.netlify.app/?a=jc',
  XSELL_VIAJE_URL: 'https://seguros-viajero.appsegurosdigitales.com/',
  XSELL_ESTUDIANTIL_URL: ''   // vacío a propósito → debe caer al sitio del agente
};

// Los bloques de marca del pie viven en email-marca.js, compartido por los
// tres correos. En el navegador lo carga el <script> de la página; acá hay
// que ponerlo en el global antes de requerir el módulo que lo usa.
var _marca = require('../js/email-marca.js');
Object.keys(_marca).forEach(function (k) { global[k] = _marca[k]; });

var _pe = require('../js/poliza-email.js');
var buildPolizaActivaEmail = _pe.buildPolizaActivaEmail;
var buildPolizaWaUrl       = _pe.buildPolizaWaUrl;

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

var html = buildPolizaActivaEmail({
  nombrePila: 'Marco Andrés',
  cliente: 'Hernández Brenes Marco Andrés',
  poliza: '0101AUT221211200',
  vehiculo: 'NISSAN FRONTIER 2023',
  placa: 'CL-612977',
  notaAdicional: ''
});

ok('saludo',            /Hola Marco Andrés,/.test(html));
ok('poliza',            html.indexOf('0101AUT221211200') !== -1);
ok('vehiculo',          html.indexOf('NISSAN FRONTIER 2023') !== -1);
ok('placa',             html.indexOf('CL-612977') !== -1);
ok('activa',            /ya se encuentra activa/i.test(html));
ok('asistencia-base',   html.indexOf('https://appasistenciaseguroautos.netlify.app/?a=jc') !== -1);
ok('asistencia-agente', html.indexOf('n=Juan%20Carlos%20Hernandez%20Vargas') !== -1
                        && html.indexOf('tel=8822-1348') !== -1
                        && html.indexOf('wa=50688221348') !== -1
                        && html.indexOf('em=jhernandez%40segurosdelins.com') !== -1
                        && html.indexOf('lic=08-1318') !== -1);
ok('pwa-tip',           /Añadir a pantalla de inicio/i.test(html));
ok('emergencia-8000',   html.indexOf('800-800-8000') !== -1);
ok('emergencia-911',    html.indexOf('911') !== -1);
ok('emergencia-8001',   html.indexOf('800-800-8001') !== -1);
ok('terceros',          /acuerdos con terceros/i.test(html));
ok('xsell-viaje',       /Seguros de Viaje/.test(html) && html.indexOf('https://seguros-viajero.appsegurosdigitales.com/') !== -1);
ok('xsell-estudiantil', /Seguro Estudiantil/.test(html));
ok('NO-pollitos',       !/pollito/i.test(html));
ok('xsell-vacio-fallback', html.indexOf('https://www.segurosdelins.com') !== -1); // estudiantil vacío → sitio agente
ok('firma-licencia',    html.indexOf('08-1318') !== -1);
ok('firma-tel',         html.indexOf('8822-1348') !== -1);
ok('firma-correo',      html.indexOf('jhernandez@segurosdelins.com') !== -1);
ok('footer-sdi',        /Seguros Digitales SDI/.test(html));
ok('doctype',           /^<!DOCTYPE html>/.test(html));

// XSS: un dato malicioso debe quedar escapado
var evil = buildPolizaActivaEmail({ nombrePila: '<img src=x onerror=alert(1)>', poliza: 'X', vehiculo: 'V', placa: 'P' });
ok('xss-escapado', evil.indexOf('<img src=x onerror') === -1 && evil.indexOf('&lt;img') !== -1);

// Multi-agente: la guía de emergencia debe llevar los datos del agente ACTUAL,
// no los del owner por default (así el cliente contacta a quien le envió la póliza).
global.CFG.FROM_NAME  = 'Pedro Ramírez';
global.CFG.PHONE      = '7000-0000';
global.CFG.WHATSAPP   = '7000-0000';
global.CFG.FROM_EMAIL = 'pedro@correo.com';
global.CFG.LICENSE    = '09-9999';
global.CFG.WEBSITE    = '';   // sin web propia
global.CFG.ASSIST_URL = 'https://appasistenciaseguroautos.netlify.app/';   // base sin ?a=
var html2 = buildPolizaActivaEmail({ nombrePila: 'Ana', poliza: 'P', vehiculo: 'V', placa: 'PL' });
ok('multiagente-nombre', html2.indexOf('n=Pedro%20Ram%C3%ADrez') !== -1);
ok('multiagente-tel',    html2.indexOf('tel=7000-0000') !== -1 && html2.indexOf('wa=50670000000') !== -1);
ok('multiagente-correo', html2.indexOf('em=pedro%40correo.com') !== -1);
ok('multiagente-lic',    html2.indexOf('lic=09-9999') !== -1);
ok('multiagente-sep',    html2.indexOf('/?n=Pedro') !== -1);   // primer parámetro con '?', no '&'
// La web del owner (segurosdelins.com) NO debe filtrarse al correo de un agente
// sin web propia — ni en la firma ni como fallback de los botones cross-sell.
ok('multiagente-sin-web-owner', html2.indexOf('segurosdelins.com') === -1);

// Firma del owner (html = config JC): SU web sí debe salir en la firma.
ok('firma-web-owner', html.indexOf(' &middot; www.segurosdelins.com') !== -1);

// Agente CON su propia web → la firma muestra SU sitio, nunca el del owner.
global.CFG.WEBSITE = 'www.pedroseguros.com';
var html3 = buildPolizaActivaEmail({ nombrePila: 'Ana', poliza: 'P', vehiculo: 'V', placa: 'PL' });
ok('agente-web-propia',   html3.indexOf('www.pedroseguros.com') !== -1);
ok('agente-web-no-owner', html3.indexOf('segurosdelins.com') === -1);

// ---------- WhatsApp de la vista 4 (aviso de póliza activa) ----------
// CFG quedó con el agente Pedro (sin web propia) de los tests de arriba;
// lo devolvemos al owner para leer el mensaje "normal".
global.CFG.FROM_NAME  = 'Juan Carlos Hernandez Vargas';
global.CFG.PHONE      = '8822-1348';
global.CFG.WHATSAPP   = '8822-1348';
global.CFG.FROM_EMAIL = 'jhernandez@segurosdelins.com';
global.CFG.LICENSE    = '08-1318';
global.CFG.WEBSITE    = 'www.segurosdelins.com';
global.CFG.ASSIST_URL = 'https://appasistenciaseguroautos.netlify.app/';

var waUrl = buildPolizaWaUrl({
  nombrePila: 'Natanael',
  poliza: '0101AUT221211200',
  vehiculo: 'NISSAN FRONTIER 2023',
  placa: 'CL-612977',
  telCliente: '8888-8888'
});
var waMsg = decodeURIComponent(waUrl.split('text=')[1]);

ok('wa-endpoint',    waUrl.indexOf('https://web.whatsapp.com/send/?') === 0);
ok('wa-NO-wame',     waUrl.indexOf('wa.me') === -1);
ok('wa-telefono',    waUrl.indexOf('phone=50688888888&') !== -1);
ok('wa-saludo',      waMsg.indexOf('¡Natanael, su póliza de automóvil está lista!') === 0);
ok('wa-NO-genero',   !/Estimad[oa]\b/.test(waMsg));          // del PDF no sale el género
ok('wa-poliza',      waMsg.indexOf('Su número de póliza es 0101AUT221211200') !== -1);
ok('wa-vehiculo',    waMsg.indexOf('(NISSAN FRONTIER 2023, placa CL-612977)') !== -1);
ok('wa-correo',      /documentos del seguro a su correo/.test(waMsg));
ok('wa-reportar',    /debe reportarlo de inmediato/.test(waMsg));
ok('wa-app',         waMsg.indexOf('https://appasistenciaseguroautos.netlify.app/') !== -1);
ok('wa-cierre',      /conduzca con total tranquilidad/.test(waMsg));
ok('wa-agente',      waMsg.indexOf('n=Juan%20Carlos%20Hernandez%20Vargas') !== -1
                     && waMsg.indexOf('lic=08-1318') !== -1);

// Sin teléfono: WhatsApp abre el selector de contactos, no un chat vacío.
var waSinTel = buildPolizaWaUrl({ nombrePila: 'Ana', poliza: 'P1' });
ok('wa-sin-telefono', waSinTel.indexOf('phone=') === -1 && waSinTel.indexOf('text=') !== -1);

// Sin número de póliza (PDF raro): la línea entera desaparece, no queda colgando.
var waSinPoliza = buildPolizaWaUrl({ nombrePila: 'Ana' });
ok('wa-sin-poliza', decodeURIComponent(waSinPoliza.split('text=')[1]).indexOf('número de póliza') === -1);

// Multi-agente: el link lleva la ficha del agente que envía, no la del owner.
global.CFG.FROM_NAME  = 'Pedro Ramírez';
global.CFG.PHONE      = '7000-0000';
global.CFG.WHATSAPP   = '7000-0000';
global.CFG.FROM_EMAIL = 'pedro@correo.com';
global.CFG.LICENSE    = '09-9999';
global.CFG.WEBSITE    = '';
var waPedro = decodeURIComponent(buildPolizaWaUrl({ nombrePila: 'Ana', poliza: 'P1' }).split('text=')[1]);
ok('wa-multiagente',  waPedro.indexOf('n=Pedro%20Ram%C3%ADrez') !== -1 && waPedro.indexOf('wa=50670000000') !== -1);
ok('wa-sin-web-owner', waPedro.indexOf('segurosdelins.com') === -1);

// ---------- Enlace corto de la guía de emergencias (7 ago 2026) ----------
// La URL de asistencia con la ficha del agente ronda los 180 caracteres y
// empujaba el mensaje al "Leer más" de WhatsApp. Con el alias /a/XXXXXXXXXX
// el mensaje entra completo.
global.CFG.FROM_NAME  = 'Juan Carlos Hernandez Vargas';
global.CFG.PHONE      = '8822-1348';
global.CFG.WHATSAPP   = '8822-1348';
global.CFG.FROM_EMAIL = 'jhernandez@segurosdelins.com';
global.CFG.LICENSE    = '08-1318';
global.CFG.WEBSITE    = 'www.segurosdelins.com';
global.CFG.ASSIST_URL = 'https://appasistenciaseguroautos.netlify.app/';

var CORTO = 'https://cotizador.appsegurosdigitales.com/a/K7M4PQ2XRB';
var baseWa = { nombrePila: 'Natanael', poliza: '0101AUT221211200', vehiculo: 'NISSAN FRONTIER 2023', placa: 'CL-612977' };
function msgDe(p) { return decodeURIComponent(buildPolizaWaUrl(p).split('text=')[1]); }

var msgLargo = msgDe(baseWa);
var msgCorto = msgDe(Object.assign({ urlGuia: CORTO }, baseWa));

ok('corto-usa-alias',     msgCorto.indexOf(CORTO) !== -1);
ok('corto-sin-larga',     msgCorto.indexOf('appasistenciaseguroautos.netlify.app') === -1);
ok('corto-sin-ficha',     msgCorto.indexOf('lic=08-1318') === -1);   // la ficha viaja del lado del servidor
ok('corto-acorta-mensaje', msgCorto.length < msgLargo.length - 100);
// El resto del mensaje NO cambia: mismo saludo, misma línea de póliza, mismo cierre.
ok('corto-mismo-saludo',  msgCorto.indexOf('¡Natanael, su póliza de automóvil está lista!') === 0);
ok('corto-misma-poliza',  msgCorto.indexOf('Su número de póliza es 0101AUT221211200') !== -1);
ok('corto-mismo-cierre',  /conduzca con total tranquilidad/.test(msgCorto));

// Fallback: si el acortador falla devuelve '' o la URL larga → el mensaje
// tiene que salir igual con el enlace largo, nunca sin enlace.
ok('corto-fallback-vacio', msgDe(Object.assign({ urlGuia: '' }, baseWa)).indexOf('appasistenciaseguroautos.netlify.app') !== -1);
ok('corto-fallback-nulo',  msgDe(Object.assign({ urlGuia: null }, baseWa)).indexOf('appasistenciaseguroautos.netlify.app') !== -1);

console.log('   mensaje WhatsApp: ' + msgLargo.length + ' chars con el link largo → ' + msgCorto.length + ' con el corto');

console.log('\npoliza-email: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
