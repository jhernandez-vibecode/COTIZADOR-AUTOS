/**
 * Tests de js/poliza-extract.js — extracción de datos de la póliza de autos.
 * Texto de muestra tomado de unas Condiciones Particulares reales del INS
 * (0101AUT218279500). Correr: node tests/test-poliza-extract.js
 */
var PolizaParse = require('../js/poliza-extract.js');

var pass = 0, fail = 0;
function eq(name, got, exp) {
  if (got === exp) { pass++; }
  else { fail++; console.error('FAIL ' + name + '\n  esperado: ' + JSON.stringify(exp) + '\n  obtuve:   ' + JSON.stringify(got)); }
}

// --- Muestra (cómo PDF.js entrega el texto, fragmentos unidos por espacios) ---
var SAMPLE = [
  'INSTITUTO NACIONAL DE SEGUROS SEGURO VOLUNTARIO DE AUTOMÓVILES INDIVIDUAL CONDICIONES PARTICULARES',
  'CONSECUTIVO 18971411-43228985-2180 Lugar y fecha de emisión: Sucursal San José 09/10/2025',
  'N° de póliza: 0101AUT218279500 Vigencia: Desde: 07/04/2025 Hasta: 07/04/2026',
  'Intermediario: 1101130-HERNANDEZ VARGAS JUAN CARLOS Agente: Forma de pago: TRIMESTRAL Moneda: Colones',
  'Contrato: No Aplica Estado: VIGENTE',
  'DATOS TOMADOR Nombre: VEGA GAMBOA CINDY GABRIELA N° Identificación: 701890518',
  'Dirección del domicilio: EL ALTO Teléfonos: 89243390 Correo electrónico: cindy.vegagamboa@gmail.com',
  'DATOS DEL ASEGURADO Nombre: VEGA GAMBOA CINDY GABRIELA N° Identificación: 701890518',
  'Correo electrónico: cindy.vegagamboa@gmail.com',
  'DESCRIPCIÓN DEL BIEN ASEGURADO Marca: TOYOTA Modelo: YARIS Placa: PAR00SBC889 Año fabricación: 2 016',
  'Tipo de entidad: Normal Color: GRIS Serie: SUPERFULL Combustible: Gasolina Tipo de vehículo: Sedan/Coupe',
  'Monto Asegurado: 7 350 000 Forma de Aseguramiento: Valor Declarado (VD)'
].join(' ');

var d = PolizaParse.extractAll(SAMPLE);
eq('poliza',        d.poliza,        '0101AUT218279500');
eq('cliente',       d.cliente,       'Vega Gamboa Cindy Gabriela');
eq('nombrePila',    d.nombrePila,    'Cindy Gabriela');
eq('marca',         d.marca,         'TOYOTA');
eq('modelo',        d.modelo,        'YARIS');
eq('anio',          d.anio,          '2016');
eq('vehiculo',      d.vehiculo,      'TOYOTA YARIS 2016');
eq('placa',         d.placa,         'PAR00SBC889');
eq('correo',        d.correo,        'cindy.vegagamboa@gmail.com');
eq('formaPago',     d.formaPago,     'Trimestral');
eq('vigenciaDesde', d.vigenciaDesde, '07/04/2025');
eq('vigenciaHasta', d.vigenciaHasta, '07/04/2026');

// nombre de pila con dos apellidos + dos nombres. NO inventa acentos que no
// vengan en la fuente: "ANDRES" (sin tilde) -> "Andres" (el agente lo corrige).
eq('pila-marco',  PolizaParse.sugerirNombrePila('HERNANDEZ BRENES MARCO ANDRES'), 'Marco Andres');
eq('pila-acento', PolizaParse.sugerirNombrePila('RODRÍGUEZ SOLÍS MARÍA JOSÉ'), 'María José');

// Si el correo del tomador fuese el del agente, debe preferir el del cliente
var t2 = SAMPLE.replace('cindy.vegagamboa@gmail.com', 'jhernandez@segurosdelins.com')
               .replace('cindy.vegagamboa@gmail.com', 'cliente@correo.com');
eq('correo-prefiere-cliente', PolizaParse.extractAll(t2).correo, 'cliente@correo.com');

// classifyFile
eq('cf-condpart', PolizaParse.classifyFile('0101AUT218279500_017_170_Condiciones_Particulares_Seguro_Aut.pdf'), 'condiciones');
eq('cf-tarjeta',  PolizaParse.classifyFile('0101AUT221211200_Tarjeta_Seguro_Automoviles.pdf'), 'tarjeta');
eq('cf-comprob',  PolizaParse.classifyFile('1310202510474392_ComprobanteDePago.pdf'), 'comprobante');
eq('cf-generales',PolizaParse.classifyFile('CONDICIONES GENERALES SEGURO AUTOMÓVILES.pdf'), 'generales');
eq('cf-pacto',    PolizaParse.classifyFile('INFORMACIÓN SOBRE PACTO AMISTOSO.pdf'), 'pacto');
eq('cf-multi',    PolizaParse.classifyFile('CONDICIONES OPERATIVAS MULTIASISTENCIA DE AUTOMÓVILES.pdf'), 'multiasistencia');
eq('cf-benef',    PolizaParse.classifyFile('BENEFICIOS COBERTURA ASISTENCIA 0-6 AÑOS.pdf'), 'beneficios');

console.log('\npoliza-extract: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
