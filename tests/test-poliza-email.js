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

var buildPolizaActivaEmail = require('../js/poliza-email.js').buildPolizaActivaEmail;

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

console.log('\npoliza-email: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
