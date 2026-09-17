/* ======================================================================
   Planes de asistencia del INS — cobertura "ASI" Servicios de
   Multiasistencia, incorporada en la version 32 del Seguro Voluntario de
   Automoviles (circular 0395-2026, registro SUGESE G01-01-A01-012,
   aprobada 26/08/2026, implementacion 28/09/2026).

   Este archivo es la UNICA fuente de los seis planes. Lo cargan los correos
   (js/email-marca.js, js/asistencias-email.js) y la pagina del cliente
   (/asistencias/). Si alguna vez se duplican los datos, el correo y la
   pagina empiezan a decir cosas distintas y las dos van firmadas con la
   licencia SUGESE del agente.

   Los datos se transcribieron del mockup aprobado el 4 set 2026
   (docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html), que se
   verifico contra el dossier del INS leyendo cada pagina COMO IMAGEN: el
   emparejamiento servicio<->limite por coordenadas se equivoca en las filas
   apretadas de Salud Premium. Conteos correctos: Mascota 11 · Funeraria 8
   incluidos · Salud Bienestar 16 · Salud Premium 30 · Autos Plus 7 · VIP 21.

   Los limites se transcriben TAL CUAL del dossier: "Sin limite" es literal
   del documento y no se traduce a "ilimitado". El detalle completo de cada
   servicio vive en las Condiciones Operativas de Multiasistencia.

   Sin DOM y sin CFG a proposito: se puede requerir desde Node.
   ====================================================================== */

/* Fecha desde la que el INS emite con la V32. Antes de esto los planes no
   existen en la solicitud de seguro: ofrecerlos en una COTIZACION seria
   prometer algo que el cliente no puede contratar todavia. Hora de Costa
   Rica (UTC-6). El aviso a clientes con poliza vigente NO usa este porton:
   ese correo anuncia la fecha. */
var ASI_DESDE = new Date('2026-09-28T00:00:00-06:00');

/* IVA que el INS NO incluye en las primas publicadas (Ley 9635). */
var ASI_IVA = 0.13;

var PLANES_ASI = [
  {
    id: 'mascota', nom: 'Mascota', prima: 7200, tono: 'verde', icono: 'pata',
    linea: 'Para el perro o el gato de la casa.',
    desc: 'Atención veterinaria de urgencia, cuido cotidiano y apoyo en la búsqueda de la mascota, para animales de compañía que conviven en el hogar.',
    nota: 'Aplica para animales de compañía que conviven permanentemente en el hogar, bajo el cuidado y responsabilidad de la persona asegurada, y que no están destinados a fines comerciales o productivos.',
    serv: [
      ['Consulta veterinaria de urgencia', '1', '₡25.000'],
      ['Traslado en emergencia', '3', '₡50.000'],
      ['Vacunación y desparasitación', '1', '₡20.000'],
      ['Grooming a domicilio o en centro', '1', '₡15.000'],
      ['Cremación de mascota', '3', '₡50.000'],
      ['Hotel para mascotas', '3', '₡10.000'],
      ['Impresión de material POP para la búsqueda', '3', '₡25.000'],
      ['Puja en redes sociales por pérdida', '3', '₡25.000'],
      ['Volanteo en la zona cercana al domicilio', '1', '₡25.000'],
      ['Alojamiento por hospitalización del titular', '3', '₡10.000'],
      ['Paseo de mascotas domésticas', '3', '₡10.000']
    ]
  },
  {
    id: 'funerario', nom: 'Asistencia Funeraria', prima: 10800, tono: 'pizarra', icono: 'corazon',
    linea: 'Cubre el servicio funerario del asegurado.',
    desc: 'Brinda acompañamiento y servicios funerarios esenciales por fallecimiento de la persona asegurada, ofreciendo apoyo y tranquilidad a la familia en momentos difíciles.',
    nota: 'El servicio lo solicita el cónyuge de la persona asegurada o personas mayores de edad que convivan con ella.',
    monto: '₡500.000', montoAlt: 'o $1.000 según la moneda del contrato',
    eventos: '1 por año póliza, dentro del territorio nacional',
    incluye: [
      'Tanatopraxia: preparación del cuerpo para la velación',
      'Féretro estándar',
      'Sala de velación hasta 24 horas',
      'Arreglo floral central y dos arreglos medianos',
      'Alquiler de sillas, altar y base para el féretro',
      'Traslado a la sala o domicilio, templo y cementerio',
      'Café, refrescos y alimentación',
      'Gastos de cremación o sepultura'
    ]
  },
  {
    id: 'bienestar', nom: 'Salud Bienestar', prima: 18000, tono: 'cyan', icono: 'pulso',
    linea: 'Orientación médica, ejercicio y apoyo en la casa.',
    desc: 'Plan de asistencia integral que brinda orientación médica, psicológica y nutricional, servicios de bienestar y actividad física, y apoyo para el hogar.',
    nota: 'Límite por evento en colones o su equivalente en dólares según la moneda del contrato. Las consultas virtuales tienen una duración máxima de una hora.',
    serv: [
      ['Orientación médica telefónica', '', 'Sin límite'],
      ['Consulta psicológica virtual', '2', '₡30.000'],
      ['Consulta nutricional virtual', '1', '₡15.000'],
      ['Clases funcionales en vivo', '4', '₡15.000'],
      ['Orientación farmacéutica', '', 'Sin límite'],
      ['Orientación nutricional telefónica', '', 'Sin límite'],
      ['Conexión con médicos, laboratorios, hospitales y clínicas', '', 'Sin límite'],
      ['Referencia de veterinarios', '', 'Sin límite'],
      ['Asesoría telefónica de viajes y turismo nacional', '', 'Sin límite'],
      ['Diseño de rutinas de ejercicio', '1', '₡25.000'],
      ['Fumigación del hogar', '1', '₡35.000'],
      ['Limpieza de tanque séptico', '1', '₡40.000'],
      ['Limpieza de canoas', '1', '₡61.000'],
      ['Jardinería (corte de césped)', '1', '₡20.000'],
      ['Instalación de lámparas', '1', '₡41.600'],
      ['Recarga de extintores (máx. 1)', '1', '₡10.000']
    ]
  },
  {
    id: 'premium', nom: 'Salud Premium', prima: 42000, tono: 'azul', icono: 'cruz',
    linea: 'Especialistas, exámenes, terapias y traslados.',
    desc: 'Brinda atención médica especializada, exámenes y diagnósticos, terapias y traslados médicos, complementados con servicios de bienestar y apoyo al hogar.',
    nota: 'Límite por evento en colones o su equivalente en dólares según la moneda del contrato. La orientación médica telefónica tiene una duración máxima de 15 minutos.',
    serv: [
      ['Visita médica a domicilio', '2', '₡40.000'],
      ['Consulta con especialista', '1', '₡45.000'],
      ['Orientación médica telefónica', '', 'Sin límite'],
      ['Consulta psicológica presencial', '2', '₡30.000'],
      ['Consulta nutricional presencial', '1', '₡25.000'],
      ['Consulta nutricional telefónica', '', 'Sin límite'],
      ['Consulta farmacéutica', '', 'Sin límite'],
      ['Consulta y limpieza dental simple', '1', '₡30.000'],
      ['Perfil lipídico', '1', '₡25.000'],
      ['Exámenes de laboratorio generales', '1', '₡45.000'],
      ['Rayos X o electrocardiograma', '1', '₡40.000'],
      ['Terapias respiratorias a domicilio', '2', '₡25.000'],
      ['Terapias físicas', '2', '₡25.000'],
      ['Terapias alternativas avaladas por la OMS', '2', '₡25.000'],
      ['Audiometría', '1', '₡15.000'],
      ['Oftalmología', '1', '₡50.000'],
      ['Traslado en taxi al hogar o centro de salud', '2', '₡26.000'],
      ['Traslado en ambulancia por accidente o enfermedad', '1', '₡103.500'],
      ['Conexión con médicos y clínicas', '', 'Sin límite'],
      ['Clases de yoga en vivo', '4', '₡15.000'],
      ['Traslado residencia–aeropuerto', '4', '₡26.000'],
      ['Fumigación del hogar', '1', '₡35.000'],
      ['Recarga de extintores', '1', '₡10.000'],
      ['Limpieza de tanque séptico', '1', '₡40.000'],
      ['Limpieza de canoas', '1', '₡61.000'],
      ['Instalación de lámparas', '1', '₡41.600'],
      ['Jardinería (corte de césped)', '1', '₡20.000'],
      ['Servicio doméstico', '1', '₡13.500'],
      ['Asesoría de viajes y turismo', '', 'Sin límite'],
      ['Referencia de veterinarios', '', 'Sin límite']
    ]
  },
  {
    id: 'autos', nom: 'Autos Plus', prima: 42000, tono: 'naranja', icono: 'carro',
    linea: 'Cuido estético del carro y traslados al aeropuerto.',
    desc: 'Servicios de cuido y mantenimiento estético del vehículo asegurado, con traslados al aeropuerto como beneficio adicional.',
    nota: 'El lavado y el tratamiento de tapicerías se solicitan con 24 horas de antelación. El servicio a domicilio aplica dentro de 20 km desde la ubicación del proveedor asignado.',
    serv: [
      ['Desabolladuras y rayones', '1', '₡78.000'],
      ['Cambio de aceite', '2', '₡53.900'],
      ['Pulido de pintura', '1', '₡35.000'],
      ['Tratamiento de tapicerías', '1', '₡35.000'],
      ['Traslado al aeropuerto', '4', '₡26.000'],
      ['Lavado de vehículo a domicilio', '1', '₡12.000'],
      ['Lavado de vehículo en local', '1', '₡10.000']
    ]
  },
  {
    id: 'vip', nom: 'VIP', prima: 42000, tono: 'oro', icono: 'corona',
    linea: 'Salud, hogar y negocio en un solo plan.',
    desc: 'Combina servicios exclusivos para la persona, el hogar y la empresa: bienestar, salud, apoyo legal, mantenimiento, traslados y beneficios especiales.',
    nota: 'Límite por evento en colones o su equivalente en dólares según la moneda del contrato.',
    serv: [
      ['Enfermería domiciliar por enfermedad', '1', '₡100.000'],
      ['Alquiler de equipo médico duradero', '1', '₡100.000'],
      ['Asistencias en eventos sociales', '1', '₡100.000'],
      ['Asistencia legal por robo en la sede de la empresa', '2', '₡122.000'],
      ['Coach de ventas', '1', '₡70.000'],
      ['Renta diaria hospitalaria', '1', '₡67.500'],
      ['Limpieza de canoas', '1', '₡61.000'],
      ['Exámenes médicos de laboratorio generales', '1', '₡50.000'],
      ['Pulido de focos', '1', '₡50.000'],
      ['Limpieza de tanque de agua', '1', '₡45.000'],
      ['Fisioterapia de descarga por deporte', '3', '₡43.120'],
      ['Inspección de riesgos de incendio en la empresa', '2', '₡41.600'],
      ['Instalación de lámparas', '2', '₡41.600'],
      ['Limpieza de tanque séptico', '1', '₡40.000'],
      ['Fumigación del hogar', '1', '₡35.000'],
      ['Coach financiero', '1', '₡30.000'],
      ['Traslado residencia–aeropuerto', '4', '₡26.000'],
      ['Jardinería', '1', '₡20.000'],
      ['Guardería diurna de niño o niña', '1', '₡12.000'],
      ['Recarga de extintores del hogar', '1', '₡10.000'],
      ['Lavado de vehículo', '1', '₡10.000']
    ]
  }
];

/**
 * ¿Ya se pueden ofrecer en una cotizacion? Recibe una fecha para poder
 * testearlo; sin argumento usa la de hoy.
 * @param {Date} [hoy]
 * @returns {boolean}
 */
function asiDisponible(hoy) {
  var d = hoy instanceof Date ? hoy : new Date();
  return d.getTime() >= ASI_DESDE.getTime();
}

/** Devuelve un plan por id, o null. */
function planAsi(id) {
  for (var i = 0; i < PLANES_ASI.length; i++) {
    if (PLANES_ASI[i].id === id) return PLANES_ASI[i];
  }
  return null;
}

/** Prima mas barata, para el "desde ₡X" del correo y de la pagina. */
function asiDesde() {
  return PLANES_ASI.reduce(function (m, p) { return Math.min(m, p.prima); }, Infinity);
}

/**
 * Prima con el IVA sumado, redondeada al colon. Es lo que se le SUMA a la
 * prima vigente del cliente (que ya trae IVA) para que las dos cifras
 * esten en la misma base — decision D1 de JC, 17 set 2026.
 */
function asiConIva(prima) {
  return Math.round(Number(prima || 0) * (1 + ASI_IVA));
}

/**
 * Lee un monto tecleado o sacado del PDF y devuelve el entero en colones.
 * Acepta los tres formatos que circulan: "487.300" / "570.891,00" (europeo,
 * el del PDF del INS), "487,300.00" (US) y "487300". Basura → 0.
 */
function asiMonto(v) {
  var t = String(v == null ? '' : v).replace(/[₡\s]/g, '').trim();
  if (!t) return 0;
  var s;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) || /^\d+,\d{1,2}$/.test(t)) {
    s = t.split(',')[0].replace(/\./g, '');          // 570.891,00 → 570891
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t) || /^\d+\.\d{1,2}$/.test(t)) {
    s = t.split('.')[0].replace(/,/g, '');           // 570,891.00 → 570891
  } else {
    s = t.replace(/[^\d]/g, '');                     // 570891 y cualquier otra cosa
  }
  var n = parseInt(s, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/** ₡18.000 — separador de miles con punto ('de-DE'; es-CR usa espacio). */
function asiColones(n) {
  return '₡' + Math.round(Number(n || 0)).toLocaleString('de-DE');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLANES_ASI: PLANES_ASI, ASI_DESDE: ASI_DESDE, ASI_IVA: ASI_IVA,
    asiDisponible: asiDisponible, planAsi: planAsi,
    asiDesde: asiDesde, asiConIva: asiConIva, asiColones: asiColones, asiMonto: asiMonto
  };
}
