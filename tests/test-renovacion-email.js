/**
 * Tests de js/renovacion-email.js — correo "Renovación confirmada" + aviso WA.
 * Correr: node tests/test-renovacion-email.js
 *
 * Vigila lo que JC aprobó el 10 ago 2026: que el correo CONFIRME (no cobre),
 * que lleve la mini-guía de evento, el cross-sell y la ficha del agente que
 * corresponde, y que el aviso de WhatsApp salga con el enlace corto.
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

var _re = require('../js/renovacion-email.js');
var buildRenovacionEmail = _re.buildRenovacionEmail;
var buildRenovacionWaUrl = _re.buildRenovacionWaUrl;

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); } }

var base = {
  nombrePila: 'Carlos Andrés',
  cliente: 'Ramírez Soto Carlos Andrés',
  poliza: '0101AUT100000001',
  placa: 'BXY123',
  vehiculo: 'TOYOTA YARIS 2019',
  numComprobante: 'R202608108000001',
  montoTexto: '₡92.555',
  periodoDesde: '30/08/2026',
  periodoHasta: '30/11/2026',
  fechaPago: '10/08/2026',
  notaAdicional: ''
};
var html = buildRenovacionEmail(base);

// ---------- Contenido esencial ----------
ok('doctype',        /^<!DOCTYPE html>/.test(html));
ok('saludo',         /Hola Carlos Andrés,/.test(html));
ok('titulo',         /Su renovación está confirmada/.test(html));
ok('poliza',         html.indexOf('0101AUT100000001') !== -1);
ok('placa',          html.indexOf('BXY123') !== -1);
ok('vehiculo',       html.indexOf('TOYOTA YARIS 2019') !== -1);
ok('comprobante',    html.indexOf('R202608108000001') !== -1);
ok('monto',          html.indexOf('₡92.555') !== -1);
ok('badge-pagado',   html.indexOf('>PAGADO<') !== -1);
ok('pago-aplicado',  /fue aplicado correctamente/.test(html));
ok('periodo-pagado', /Período pagado/.test(html) && html.indexOf('30/08/2026') !== -1 && html.indexOf('30/11/2026') !== -1);
ok('fecha-pago',     /Fecha de pago/.test(html) && html.indexOf('10/08/2026') !== -1);
ok('logo-ins',       html.indexOf('img/ins-logo.png') !== -1);

// El ajuste que pidió JC: "Adjunto encontrará…" en su PROPIO párrafo, con aire,
// para que no se lea como un solo bloque de texto pegado a la confirmación.
ok('adjunto-parrafo-aparte', /<p style="margin:10px 0 0;">Adjunto encontrará el comprobante/.test(html));

// ---------- Es un correo de CONFIANZA, no de cobro ----------
ok('NO-pague-antes',   !/pague antes|antes del vencimiento|fecha l[ií]mite/i.test(html));
ok('NO-formas-pago',   !/SINPE|formas de pago|link de pago/i.test(html));
ok('NO-monto-pendiente', !/monto a pagar|saldo pendiente|debe pagar/i.test(html));
ok('NO-vigencia-anual', !/vigencia anual/i.test(html));   // el período puede ser trimestral
ok('agradece',         /Gracias por renovar su confianza/.test(html));

// ---------- Mini-guía de evento (información de servicio verificada) ----------
ok('guia-titulo',    /&iquest;Qu&eacute; hacer si ocurre un evento\?/.test(html));
ok('guia-911',       html.indexOf('>911<') !== -1);
ok('guia-8000',      html.indexOf('800-800-8000') !== -1);
ok('guia-8001',      html.indexOf('800-800-8001') !== -1);
ok('guia-terceros',  /nunca haga acuerdos con terceros/.test(html));
ok('guia-inspector', /inspector/i.test(html));
// Las asistencias se listan SIN cantidades: el alcance depende de la antigüedad
// del vehículo y prometer un número sería una promesa sin respaldo.
ok('asistencias',    /gr&uacute;a, cerrajer&iacute;a, cambio de llanta, paso de corriente y env&iacute;o de combustible/.test(html));
ok('asistencias-sin-cantidades', !/\b\d+\s*(veces|servicios|eventos)\b/i.test(html));

// ---------- Guía de emergencias con la ficha del agente ----------
ok('asistencia-base',   html.indexOf('https://appasistenciaseguroautos.netlify.app/?a=jc') !== -1);
ok('asistencia-agente', html.indexOf('n=Juan%20Carlos%20Hernandez%20Vargas') !== -1
                        && html.indexOf('tel=8822-1348') !== -1
                        && html.indexOf('wa=50688221348') !== -1
                        && html.indexOf('em=jhernandez%40segurosdelins.com') !== -1
                        && html.indexOf('lic=08-1318') !== -1);
ok('pwa-tip',           /A&ntilde;adir a pantalla de inicio/.test(html));

// ---------- Cross-sell (JC 10 ago: va SIEMPRE) ----------
ok('xsell-viaje',       /Seguros de Viaje/.test(html) && html.indexOf('https://seguros-viajero.appsegurosdigitales.com/') !== -1);
ok('xsell-estudiantil', /Seguro Estudiantil/.test(html));
ok('xsell-vacio-fallback', html.indexOf('https://www.segurosdelins.com') !== -1);

// ---------- Firma y marca ----------
ok('firma-licencia', html.indexOf('08-1318') !== -1);
ok('firma-tel',      html.indexOf('8822-1348') !== -1);
ok('firma-correo',   html.indexOf('jhernandez@segurosdelins.com') !== -1);
ok('footer-sdi',     /Seguros Digitales SDI/.test(html));
// Logo SDI del pie: desde el 25 ago 2026 va como IMAGEN y no recreado con
// tablas. Su tipografía está vectorizada en el kit y en correo las fuentes web
// no cargan, así que una versión hecha con texto caería a Arial y no sería el
// logo. Antes este check buscaba los cuatro colores de las barras.
ok('logo-imagen-oficial', html.indexOf('sdi-logo-email.png') !== -1
                          && html.indexOf('alt="Seguros Digitales SDI"') !== -1);
ok('logo-no-recreado-con-tablas', html.indexOf('>SDI</td>') === -1);
ok('pie-nota-legal-completa', html.indexOf('Propiedad intelectual de') !== -1
                              && html.indexOf('Todos los derechos reservados') !== -1
                              && html.indexOf('Agente exclusivo INS') !== -1);
// Cara al cliente: INS arriba, SDI solo al pie.
ok('marca-ins-arriba', html.indexOf('Seguros del INS') < html.indexOf('Seguros Digitales SDI'));

// ---------- Nota del agente: registro "usted" (D6) ----------
var conNota = buildRenovacionEmail(Object.assign({}, base, { notaAdicional: 'Cualquier duda me escribe.' }));
ok('nota-titulo-usted', /Nota de su agente/.test(conNota));
ok('nota-NO-tuteo',     !/Nota de tu agente/.test(conNota));
ok('nota-texto',        conNota.indexOf('Cualquier duda me escribe.') !== -1);
ok('nota-ausente-sin-texto', !/Nota de su agente/.test(html));

// ---------- Datos faltantes: nada queda colgando ----------
var minimo = buildRenovacionEmail({ nombrePila: 'Ana' });
ok('min-sin-crash',     minimo.indexOf('Hola Ana,') !== -1);
ok('min-sin-poliza-no', !/póliza No\. <b/.test(minimo));
ok('min-sin-undefined', !/undefined|NaN|null/.test(minimo));
var sinVehiculo = buildRenovacionEmail(Object.assign({}, base, { vehiculo: '' }));
ok('sin-vehiculo-frase', /su vehículo placa <b style="color:#0c2340;">BXY123/.test(sinVehiculo));

// ---------- XSS ----------
var evil = buildRenovacionEmail({ nombrePila: '<img src=x onerror=alert(1)>', poliza: 'X', placa: 'P',
                                  notaAdicional: '<script>alert(2)</script>' });
ok('xss-saludo', evil.indexOf('<img src=x onerror') === -1 && evil.indexOf('&lt;img') !== -1);
ok('xss-nota',   evil.indexOf('<script>alert(2)') === -1);

// ---------- Multi-agente ----------
global.CFG.FROM_NAME  = 'Pedro Ramírez';
global.CFG.PHONE      = '7000-0000';
global.CFG.WHATSAPP   = '7000-0000';
global.CFG.FROM_EMAIL = 'pedro@correo.com';
global.CFG.LICENSE    = '09-9999';
global.CFG.WEBSITE    = '';   // sin web propia
global.CFG.ASSIST_URL = 'https://appasistenciaseguroautos.netlify.app/';
var html2 = buildRenovacionEmail(base);
ok('multiagente-nombre', html2.indexOf('n=Pedro%20Ram%C3%ADrez') !== -1);
ok('multiagente-tel',    html2.indexOf('tel=7000-0000') !== -1 && html2.indexOf('wa=50670000000') !== -1);
ok('multiagente-lic',    html2.indexOf('lic=09-9999') !== -1 && html2.indexOf('09-9999') !== -1);
ok('multiagente-sep',    html2.indexOf('/?n=Pedro') !== -1);   // primer parámetro con '?', no '&'
// La web y la licencia del owner NO pueden filtrarse al correo de otro agente.
ok('multiagente-sin-web-owner', html2.indexOf('segurosdelins.com') === -1);
ok('multiagente-sin-lic-owner', html2.indexOf('08-1318') === -1);

// ---------- VARIOS RECIBOS EN UN CORREO (JC, 10 ago 2026) ----------
// Un cliente con dos pólizas, o un plan familiar con cinco. Un solo correo con
// la lista y el total, en vez de cinco correos.
var tresRecibos = [
  { poliza: '0101AUT100000001', placa: 'BXY123', periodoDesde: '30/08/2026', periodoHasta: '30/11/2026', montoTexto: '₡92.555',  monto: 92555,  asegurado: 'Pérez Soto Ana Lucía' },
  { poliza: '0101AUT200000002', placa: 'ZWT456', periodoDesde: '30/08/2026', periodoHasta: '30/11/2026', montoTexto: '₡78.300',  monto: 78300,  asegurado: 'Pérez Soto Ana Lucía' },
  { poliza: '0101AUT300000003', placa: 'DEF789', periodoDesde: '30/08/2026', periodoHasta: '30/11/2026', montoTexto: '₡145.900', monto: 145900, asegurado: 'Pérez Soto Ana Lucía' }
];
var htmlMulti = buildRenovacionEmail({
  nombrePila: 'Ana Lucía', cliente: 'Pérez Soto Ana Lucía',
  recibos: tresRecibos, fechaPago: '10/08/2026'
});

ok('multi-plural-polizas',  /sus 3 pólizas de automóviles/.test(htmlMulti));
ok('multi-plural-vehiculos', /sus vehículos continúan protegidos/.test(htmlMulti));
ok('multi-plural-adjuntos', /Adjunto encontrará los comprobantes de pago oficiales del INS/.test(htmlMulti));
ok('multi-total-label',     /Total pagado/.test(htmlMulti));
ok('multi-total-sumado',    htmlMulti.indexOf('₡316.755') !== -1);   // 92.555 + 78.300 + 145.900
ok('multi-cuenta-recibos',  /3 recibos/.test(htmlMulti));
ok('multi-las-3-polizas',   htmlMulti.indexOf('0101AUT100000001') !== -1
                            && htmlMulti.indexOf('0101AUT200000002') !== -1
                            && htmlMulti.indexOf('0101AUT300000003') !== -1);
ok('multi-las-3-placas',    htmlMulti.indexOf('BXY123') !== -1 && htmlMulti.indexOf('ZWT456') !== -1 && htmlMulti.indexOf('DEF789') !== -1);
ok('multi-los-3-montos',    htmlMulti.indexOf('₡92.555') !== -1 && htmlMulti.indexOf('₡78.300') !== -1 && htmlMulti.indexOf('₡145.900') !== -1);
ok('multi-fecha-pago',      htmlMulti.indexOf('10/08/2026') !== -1);
// Mismo titular en todos: la columna "Asegurado" sobra y no se pinta.
ok('multi-sin-col-asegurado', htmlMulti.indexOf('>Asegurado<') === -1);
// Lo demás del correo NO cambia
ok('multi-guia-evento',   /&iquest;Qu&eacute; hacer si ocurre un evento\?/.test(htmlMulti));
ok('multi-cross-sell',    /Seguros de Viaje/.test(htmlMulti));
ok('multi-sin-cobro',     !/pague antes|fecha l[ií]mite/i.test(htmlMulti));
ok('multi-sin-undefined', !/undefined|NaN|null/.test(htmlMulti));

// Total explícito de la app: manda sobre la suma automática.
ok('multi-total-explicito', buildRenovacionEmail({ nombrePila: 'Ana', recibos: tresRecibos, totalTexto: '₡316.755' }).indexOf('₡316.755') !== -1);

// PLAN FAMILIAR (D3 de JC): los recibos vienen a nombre de distintas personas.
// El correo se dirige al DUEÑO DEL PLAN y la tabla dice de quién es cada póliza.
var familiar = buildRenovacionEmail({
  nombrePila: 'Carlos',           // dueño del plan, lo elige el agente
  cliente: 'Ramírez Soto Carlos Andrés',
  recibos: [
    { poliza: '0101AUT100000001', placa: 'BXY123', montoTexto: '₡92.555', monto: 92555, asegurado: 'Ramírez Soto Carlos Andrés' },
    { poliza: '0101AUT200000002', placa: 'ZWT456', montoTexto: '₡78.300', monto: 78300, asegurado: 'Mora Vega Lucía' }
  ]
});
ok('familiar-saludo-dueno',  /Hola Carlos,/.test(familiar));
ok('familiar-col-asegurado', familiar.indexOf('>Asegurado<') !== -1);
ok('familiar-ambos-nombres', familiar.indexOf('Ramírez Soto Carlos Andrés') !== -1 && familiar.indexOf('Mora Vega Lucía') !== -1);
ok('familiar-total',         familiar.indexOf('₡170.855') !== -1);

// UN recibo pasado como array: el correo queda idéntico al de campos sueltos.
var unoArray = buildRenovacionEmail({ nombrePila: 'Carlos Andrés', numComprobante: 'R202608108000001', fechaPago: '10/08/2026',
  recibos: [{ poliza: '0101AUT100000001', placa: 'BXY123', vehiculo: 'TOYOTA YARIS 2019',
              periodoDesde: '30/08/2026', periodoHasta: '30/11/2026', montoTexto: '₡92.555', monto: 92555 }] });
ok('uno-array-singular',   /su póliza No\./.test(unoArray) && !/sus 2|sus 1 pólizas/.test(unoArray));
ok('uno-array-monto-label', /Monto pagado/.test(unoArray) && !/Total pagado/.test(unoArray));
ok('uno-array-comprobante', unoArray.indexOf('R202608108000001') !== -1);
ok('uno-array-sin-tabla',   unoArray.indexOf('>Asegurado<') === -1);

// WhatsApp con varias pólizas: dice cuántas, no nombra una sola.
var waMulti = decodeURIComponent(buildRenovacionWaUrl({ nombrePila: 'Ana Lucía', recibos: tresRecibos }).split('text=')[1]);
ok('wa-multi-plural',     /Sus 3 pólizas continúan activas y sus vehículos protegidos/.test(waMulti));
ok('wa-multi-adjuntos',   /los comprobantes de pago oficiales del INS/.test(waMulti));
ok('wa-multi-sin-una',    waMulti.indexOf('Su póliza 0101AUT100000001') === -1);
ok('wa-multi-saludo',     waMulti.indexOf('¡Ana Lucía, su renovación está confirmada!') === 0);

// ---------- El fallback al sitio del agente también se escapa ----------
// CFG.WEBSITE entra a tres href (guía, Viaje, Estudiantil) cuando el agente no
// tiene esas URLs configuradas; el perfil solo le quita el protocolo, así que
// comillas y '=' llegan intactos hasta acá.
global.CFG.WEBSITE = 'malo.com" onmouseover="alert(1)';
global.CFG.XSELL_VIAJE_URL = '';
global.CFG.XSELL_ESTUDIANTIL_URL = '';
global.CFG.ASSIST_URL = 'no-es-una-url';   // fuerza el fallback también en la guía
var htmlEvilWeb = buildRenovacionEmail(base);
ok('fallback-escapado',  htmlEvilWeb.indexOf('onmouseover="alert(1)"') === -1);
ok('fallback-entidades', htmlEvilWeb.indexOf('malo.com&quot; onmouseover=&quot;alert(1)') !== -1);
// Restaurar TODO lo que tocó este bloque: si queda un CFG envenenado, los tests
// de abajo fallan por el vecino y no por su propio código.
global.CFG.XSELL_VIAJE_URL = 'https://seguros-viajero.appsegurosdigitales.com/';
global.CFG.ASSIST_URL      = 'https://appasistenciaseguroautos.netlify.app/';
global.CFG.WEBSITE         = 'www.segurosdelins.com';

// ---------- WhatsApp ----------
global.CFG.FROM_NAME  = 'Juan Carlos Hernandez Vargas';
global.CFG.PHONE      = '8822-1348';
global.CFG.WHATSAPP   = '8822-1348';
global.CFG.FROM_EMAIL = 'jhernandez@segurosdelins.com';
global.CFG.LICENSE    = '08-1318';
global.CFG.WEBSITE    = 'www.segurosdelins.com';

function msgDe(p) { return decodeURIComponent(buildRenovacionWaUrl(p).split('text=')[1]); }
var waBase = { nombrePila: 'Carlos', poliza: '0101AUT100000001', placa: 'BXY123', telCliente: '8888-8888' };
var waUrl  = buildRenovacionWaUrl(waBase);
var waMsg  = msgDe(waBase);

ok('wa-endpoint',  waUrl.indexOf('https://web.whatsapp.com/send/?') === 0);
ok('wa-NO-wame',   waUrl.indexOf('wa.me') === -1);
ok('wa-telefono',  waUrl.indexOf('phone=50688888888&') !== -1);
ok('wa-saludo',    waMsg.indexOf('¡Carlos, su renovación está confirmada!') === 0);
ok('wa-NO-genero', !/Estimad[oa]\b/.test(waMsg));
ok('wa-poliza',    waMsg.indexOf('Su póliza 0101AUT100000001 (placa BXY123) continúa activa') !== -1);
ok('wa-correo',    /comprobante de pago oficial del INS/.test(waMsg));
ok('wa-reportar',  /rep[óo]rtelo de inmediato/.test(waMsg));
ok('wa-gracias',   /Gracias por renovar su confianza/.test(waMsg));
ok('wa-NO-cobro',  !/pague|fecha l[ií]mite|debe/i.test(waMsg));
ok('wa-agente',    waMsg.indexOf('n=Juan%20Carlos%20Hernandez%20Vargas') !== -1 && waMsg.indexOf('lic=08-1318') !== -1);

// Sin teléfono: WhatsApp abre el selector de contactos, no un chat vacío.
ok('wa-sin-telefono', buildRenovacionWaUrl({ nombrePila: 'Ana', poliza: 'P1' }).indexOf('phone=') === -1);
// Sin póliza: la línea entera desaparece, no queda colgando.
ok('wa-sin-poliza', msgDe({ nombrePila: 'Ana' }).indexOf('continúa activa') === -1);
// Sin placa pero con póliza: no queda un paréntesis vacío.
ok('wa-sin-placa', msgDe({ nombrePila: 'Ana', poliza: 'P1' }).indexOf('()') === -1);
// Solo placa (PDF sin póliza legible): igual se identifica el vehículo.
ok('wa-solo-placa', msgDe({ nombrePila: 'Ana', placa: 'BXY123' }).indexOf('Su vehículo placa BXY123') !== -1);

// ---------- Enlace corto ----------
var CORTO = 'https://cotizador.appsegurosdigitales.com/a/K7M4PQ2XRB';
var msgCorto = msgDe(Object.assign({ urlGuia: CORTO }, waBase));
ok('corto-usa-alias', msgCorto.indexOf(CORTO) !== -1);
ok('corto-sin-larga', msgCorto.indexOf('appasistenciaseguroautos.netlify.app') === -1);
ok('corto-sin-ficha', msgCorto.indexOf('lic=08-1318') === -1);
ok('corto-acorta',    msgCorto.length < waMsg.length - 100);
ok('corto-mismo-saludo', msgCorto.indexOf('¡Carlos, su renovación está confirmada!') === 0);
// Fallback: si el acortador falla, sale el enlace largo — nunca sin enlace.
ok('corto-fallback-vacio', msgDe(Object.assign({ urlGuia: '' }, waBase)).indexOf('appasistenciaseguroautos.netlify.app') !== -1);
ok('corto-fallback-nulo',  msgDe(Object.assign({ urlGuia: null }, waBase)).indexOf('appasistenciaseguroautos.netlify.app') !== -1);

// El correo lleva la URL LARGA a propósito: armarlo no puede depender de la red.
ok('correo-usa-larga', html.indexOf('appasistenciaseguroautos.netlify.app') !== -1);

// ---------- SOLO WhatsApp: el mensaje no puede inventar un correo (19 ago 2026) ----------
// Opción A aprobada por JC: hay clientes que se avisan solo por WhatsApp. Si el
// texto siguiera diciendo "le acabo de enviar a su correo", el cliente esperaria
// un correo que no existe — y con él, su comprobante.
var CORREO_FRASE = 'Le acabo de enviar a su correo';
var soloWa  = msgDe(Object.assign({ sinCorreo: true }, waBase));
var conMail = msgDe(waBase);

ok('sinwa-no-miente',   soloWa.indexOf(CORREO_FRASE) === -1);
ok('sinwa-comparte',    soloWa.indexOf('Aquí mismo le comparto el comprobante de pago oficial del INS.') !== -1);
ok('sinwa-mismo-saludo', soloWa.indexOf('¡Carlos, su renovación está confirmada!') === 0);
ok('sinwa-guia',        soloWa.indexOf('appasistenciaseguroautos.netlify.app') !== -1 || soloWa.indexOf('/a/') !== -1);
ok('sinwa-cierre',      soloWa.indexOf('Gracias por renovar su confianza') !== -1);
// La poliza va ANTES del comprobante: sin envio, lo que confirma la renovacion
// es la póliza activa.
ok('sinwa-orden',       soloWa.indexOf('continúa activa') < soloWa.indexOf('Aquí mismo le comparto'));

// Lo aprobado el 10 ago no se toca: por default (con correo) el texto es el de siempre.
ok('conmail-intacto',   conMail.indexOf(CORREO_FRASE) !== -1);
ok('conmail-sin-aqui',  conMail.indexOf('Aquí mismo le comparto') === -1);

// Plural con varios recibos, en las dos redacciones.
var multiWa = msgDe({ nombrePila: 'Ana Lucía', recibos: tresRecibos, sinCorreo: true });
ok('sinwa-plural',      multiWa.indexOf('Aquí mismo le comparto los comprobantes de pago oficiales del INS.') !== -1);
ok('sinwa-plural-3',    multiWa.indexOf('Sus 3 pólizas continúan activas') !== -1);

// El texto y la URL salen de la misma fuente: dos copias derivarian.
ok('texto-igual-url',   _re.buildRenovacionWaTexto(waBase) === conMail);

console.log('   mensaje WhatsApp: ' + waMsg.length + ' chars con el link largo → ' + msgCorto.length + ' con el corto');
console.log('\nrenovacion-email: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
