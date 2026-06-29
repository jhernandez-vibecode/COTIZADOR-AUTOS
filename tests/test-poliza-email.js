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
ok('asistencia-link',   html.indexOf('https://appasistenciaseguroautos.netlify.app/?a=jc') !== -1);
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

console.log('\npoliza-email: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
