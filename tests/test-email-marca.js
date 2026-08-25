/**
 * Test de los bloques de marca de los correos (js/email-marca.js).
 *
 * Lo que vigila, en orden de importancia:
 *   1. Que un cero kilómetros NUNCA imprima el relleno que teclea el agente
 *      como si fuera la placa del cliente.
 *   2. Que la placa tome el color que le toca (carga liviana en rojo).
 *   3. Que el pie lleve el logotipo oficial y la nota legal completa.
 *   4. Que no vuelvan los sellos de plantilla automática: barras de color a
 *      la izquierda, degradados, emojis.
 *
 * Run: node tests/test-email-marca.js
 */

var M = require('../js/email-marca.js');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}

var FF = "'Space Grotesk',Helvetica,Arial,sans-serif";

// ===== 1. La placa =====
console.log('\n-- la placa --');
ok('particular: se separan letras y números',
   M._analizarPlaca('BXY123').texto.indexOf('BXY') === 0 && M._analizarPlaca('BXY123').texto.indexOf('123') > 0);
ok('particular: va en navy', M._analizarPlaca('BXY123').color === M.SDI_NAVY);
ok('carga liviana: va en rojo', M._analizarPlaca('CL284159').color === M.SDI_ROJO_CL);
ok('carga liviana: con espacio o guion da igual',
   M._analizarPlaca('CL 284159').color === M.SDI_ROJO_CL && M._analizarPlaca('cl-284159').color === M.SDI_ROJO_CL);
ok('moto: se muestra tal cual y en navy',
   M._analizarPlaca('MOT4521').texto === 'MOT4521' && M._analizarPlaca('MOT4521').color === M.SDI_NAVY);
ok('placa vieja de 6 números: tal cual, sin pintarla de rojo',
   M._analizarPlaca('123456').texto === '123456' && M._analizarPlaca('123456').color === M.SDI_NAVY);
ok('una placa con < > no se cuela como HTML', M._analizarPlaca('<b>x</b>').texto.indexOf('<b>') === -1);

// ===== 2. El relleno del cero kilómetros =====
console.log('\n-- el cero kilómetros --');
ok('000111 es relleno', M._placaEsRelleno('000111') === true);
ok('000000 es relleno', M._placaEsRelleno('000000') === true);
ok('vacío cuenta como relleno', M._placaEsRelleno('') === true && M._placaEsRelleno(null) === true);
ok('una placa de verdad NO es relleno', M._placaEsRelleno('BXY123') === false);
ok('una CL de verdad NO es relleno', M._placaEsRelleno('CL284159') === false);
ok('una placa vieja de 6 dígitos distintos NO es relleno', M._placaEsRelleno('123456') === false);

var tarjeta0 = M._tarjetaVehiculo({ vehiculo: 'Hyundai Tucson', plate: '000111', valor: '18.500.000', fontFam: FF });
ok('la tarjeta de 0 km NO imprime el relleno', tarjeta0.indexOf('000111') === -1);
ok('la tarjeta de 0 km dice 0 KM', tarjeta0.indexOf('0&#8202;KM') !== -1);
ok('la tarjeta de 0 km explica cuándo se asigna la placa', tarjeta0.indexOf('se asigna al inscribirlo') !== -1);

var tarjeta = M._tarjetaVehiculo({ vehiculo: 'Toyota Yaris', plate: 'BXY123', valor: '10.000.000', fontFam: FF });
ok('la tarjeta normal sí muestra la placa', tarjeta.indexOf('BXY') !== -1);
ok('la tarjeta dice "Cotización para vehículo"', tarjeta.indexOf('Cotizaci&oacute;n para veh&iacute;culo') !== -1);
ok('la tarjeta no lleva emoji de carro', tarjeta.indexOf('&#128663;') === -1);

// ===== 3. El filete =====
console.log('\n-- el filete --');
var filete = M._fileteSDI();
ok('lleva los cuatro colores del manual',
   M.SDI_COLORES.every(function (c) { return filete.indexOf('bgcolor="' + c + '"') !== -1; }));
ok('en la proporción 60/25/10/5',
   ['60%', '25%', '10%', '5%'].every(function (p) { return filete.indexOf('width="' + p + '"') !== -1; }));
ok('no usa degradado (Outlook no los dibuja)', filete.indexOf('linear-gradient') === -1);

// ===== 4. El pie =====
console.log('\n-- el pie --');
var pie = M._pieSDI({
  logo: 'https://ejemplo.test/sdi.png', correo: 'agente@ejemplo.test', web: 'www.ejemplo.test',
  tel: '0000-0000', agente: 'Nombre Del Agente', licencia: '00-0000'
});
ok('lleva el logotipo como imagen', pie.indexOf('<img src="https://ejemplo.test/sdi.png"') !== -1);
ok('la imagen tiene alt, por si se bloquea', pie.indexOf('alt="Seguros Digitales SDI"') !== -1);
ok('nota legal: propiedad intelectual', pie.indexOf('Propiedad intelectual de Nombre Del Agente') !== -1);
ok('nota legal: derechos reservados', pie.indexOf('Todos los derechos reservados') !== -1);
ok('nota legal: agente exclusivo y licencia', pie.indexOf('Agente exclusivo INS') !== -1 && pie.indexOf('00-0000') !== -1);
// El gris viejo (#64748b) daba 3,32:1 sobre el navy y la licencia SUGESE es
// dato regulatorio: tiene que leerse. #94a3b8 da 6,16:1.
ok('la licencia no vuelve al gris ilegible', pie.indexOf('#64748b') === -1 && pie.indexOf('#94a3b8') !== -1);
ok('sin logotipo recreado con tablas', pie.indexOf('>SDI</td>') === -1);

var pieSinLogo = M._pieSDI({ correo: 'a@b.test', tel: '1', agente: 'X', licencia: 'Y' });
ok('sin URL de logo cae al respaldo, nunca a un src vacío',
   pieSinLogo.indexOf('src=""') === -1 && pieSinLogo.indexOf('sdi-logo-email.png') !== -1);
ok('el correo del agente se escapa', M._pieSDI({ correo: '"><b>x', tel: '1', agente: 'X', licencia: 'Y' }).indexOf('"><b>x') === -1);

// ===== 5. Las formas de pago =====
console.log('\n-- las formas de pago --');
var pagos = M._bloquePagos({ prices: { trimestral: '158.423,00', semestral: '308.283,00', anual: '570.891,00' }, fontFam: FF });
ok('orden trimestral, semestral, anual',
   pagos.indexOf('Trimestral') < pagos.indexOf('Semestral') && pagos.indexOf('Semestral') < pagos.indexOf('>Anual<'));
ok('el anual va en verde', pagos.indexOf('bgcolor="' + M.SDI_VERDE + '"') !== -1);
ok('el sello dice "10% Descuento"', pagos.indexOf('>10% Descuento</p>') !== -1);
ok('el sello es amarillo', pagos.indexOf('background:#fbbf24') !== -1);
ok('abajo se aclara que es por pronto pago', pagos.indexOf('descuento por pronto pago') !== -1);
ok('se fue el "recomendado" del anclaje viejo', pagos.indexOf('Recomendado') === -1);

// 158.423 × 4 = 633.692 − 570.891 = 62.801
ok('el ahorro sale de los precios, no inventado', M._ahorroAnual('158.423,00', '570.891,00') === '62.801');
ok('sin precios legibles no inventa un ahorro',
   M._ahorroAnual('', '') === '' && M._ahorroAnual('abc', 'def') === '' && M._ahorroAnual('0', '0') === '');
ok('si el anual no ahorra nada, no lo dice', M._ahorroAnual('100,00', '500,00') === '');
var sinAhorro = M._bloquePagos({ prices: { trimestral: '', semestral: '', anual: '' }, fontFam: FF });
ok('sin ahorro el bloque igual se arma', sinAhorro.indexOf('>Anual<') !== -1 && sinAhorro.indexOf(' menos</b>') === -1);

// ===== 6. Nada de sellos de plantilla automática =====
console.log('\n-- sin sellos de plantilla --');
var TODO = filete + tarjeta + tarjeta0 + pie + pagos + M._bloqueSobrio('Rótulo', 'Texto', false);
ok('ninguna barra de color a la izquierda, de ningún grosor', (TODO.match(/border-left:\d+px solid/g) || []).length === 0);
ok('ningún degradado', TODO.indexOf('linear-gradient') === -1);
ok('ningún emoji', (TODO.match(/&#1[0-9]{5};/g) || []).length === 0);
ok('nada de flex ni grid (no existen en correo)', TODO.indexOf('display:flex') === -1 && TODO.indexOf('display:grid') === -1);

console.log('\nemail-marca: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) process.exit(1);
