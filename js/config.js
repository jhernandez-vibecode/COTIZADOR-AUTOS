/**
 * Cotizador SDI · Configuración global
 *
 * Todas las constantes públicas de la app. No contiene secretos:
 * el Client ID de OAuth es información pública por diseño de Google.
 */
const CFG = {
  // Identidad del remitente
  CLIENT_ID:   '255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com',
  FROM_NAME:   'Juan Carlos Hernandez Vargas',
  FROM_EMAIL:  'jhernandez@segurosdelins.com',

  // URLs usadas en el correo al cliente (custom domain via Portal SDI)
  GUIDE_URL:   'https://cotizador.appsegurosdigitales.com/explicacion/',
  AGENDA_URL:  'https://forms.gle/tqSaZBDcZfNgNktC7',
  // Pagina de los planes de asistencia (cobertura ASI del INS, SVA V32).
  // OJO: NO es ASSIST_URL — ese es el Centro de Asistencia Digital de la
  // poliza activa, que es otra app y otro repo. Confundirlas manda al cliente
  // a la app equivocada.
  PLANES_URL:  'https://cotizador.appsegurosdigitales.com/asistencias/',
  // Formulario propio de cita (19 set 2026). CITA_MODO lo pisa el perfil del
  // agente: 'propio' = el boton de agendar abre AGENDA_URL (lo de siempre);
  // 'sdi' = abre /cita/ y las solicitudes le llegan al correo de su perfil.
  CITA_URL:    'https://cotizador.appsegurosdigitales.com/cita/',
  CITA_MODO:   'propio',
  // Planes de asistencia del INS (13 oct 2026). Preferencia del agente en ⚙:
  // decide si el interruptor "Incluir los planes de asistencia" del paso 3
  // arranca prendido (true, lo de siempre) o apagado en cada cotizacion.
  ASI_OFRECER: true,
  // Guía de las fotografías (6 nov 2026): PDF de JC subido al sitio para que
  // todo agente la mande sin configurar nada. Va como enlace en el correo
  // "Paso 1 · Fotografías" (js/fotos-email.js).
  FOTOS_GUIA_URL: 'https://cotizador.appsegurosdigitales.com/documentos-ins/guia-fotografias-autos.pdf',
  LOGO_URL:    'https://cotizador.appsegurosdigitales.com/img/ins-logo.png',
  // Logotipo SDI del pie del correo. Va como imagen y no recreado con tablas
  // porque su tipografia esta vectorizada en el kit de marca, y en correo las
  // fuentes web no cargan: cualquier version hecha con texto caeria a Arial.
  LOGO_SDI_URL: 'https://cotizador.appsegurosdigitales.com/img/sdi-logo-email-ins.png',
  WEBSITE:     'www.segurosdelins.com',

  // Pie del correo
  PHONE:       '8822-1348',
  WHATSAPP:    '8822-1348',  // WhatsApp del agente, sin código país (se normaliza al usar)
  LICENSE:     '08-1318',
  // Asesores (firma "Asesor de Seguros" + oficina): la lista vive en js/email-marca.js (SDI_ASESORES).

  // Envío de pólizas activas (sub-página polizas-activas/) — personalizables por agente desde ⚙
  // ASSIST_URL: Centro de Asistencia Digital (app de asistencia autos). El correo le añade
  //   automáticamente la ficha del agente por parámetros (?n,tel,wa,em,lic,web) para que el
  //   cliente vea al agente correcto. Basta con dejar la URL base; el ?a=<id> es opcional.
  // XSELL_*: links "Comprar" del cross-sell al final del correo. Si quedan vacíos, el botón cae al sitio web del agente.
  ASSIST_URL:            'https://appasistenciaseguroautos.netlify.app/',
  XSELL_VIAJE_URL:       'https://seguros-viajero.appsegurosdigitales.com/',
  XSELL_ESTUDIANTIL_URL: '',

  // Gmail API
  GMAIL_SCOPE:    'https://www.googleapis.com/auth/gmail.send',
  GMAIL_SEND_URL: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',

  // Respaldo del control (historial + estados 📊 + perfil) en Google Drive.
  // Scope 'drive.appdata': una carpeta PRIVADA y OCULTA por-app y por-cuenta.
  // Multi-agente por diseño: cada agente respalda en SU propio Drive; nadie más
  // lo ve. Es un token SEPARADO del de Gmail (drive-sync.js) para no arriesgar
  // el envío de correos si el agente no autoriza Drive.
  DRIVE_SCOPE:       'https://www.googleapis.com/auth/drive.appdata',
  DRIVE_FILES_URL:   'https://www.googleapis.com/drive/v3/files',
  DRIVE_UPLOAD_URL:  'https://www.googleapis.com/upload/drive/v3/files',
  DRIVE_BACKUP_NAME: 'cotizador-sdi-control.json',

  // Worker de PDF.js
  PDFJS_WORKER: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',

  // Aviso "Qué hay de nuevo" de la consola (el mismo patrón de la consola de
  // Viajero, 28 ago 2026): al abrir la app después de una actualización aparece
  // UNA tarjeta con los cambios; "Entendido" la marca vista (localStorage
  // cotizador_sdi_novedades_v1 = version) y no vuelve a salir hasta la próxima.
  // En cada release que el agente deba notar: subir `version` (la fecha del
  // deploy), reescribir `items` en lenguaje de usuario (voseo, sin tecnicismos)
  // y anotar lo mismo en el registro de cambios del pie de index.html.
  // Solo la consola (index.html) la muestra; las sub-páginas no.
  NOVEDADES: {
    version: '2026-11-06',
    fecha: '6 nov 2026',
    items: [
      '<b>Nuevo: «Fotos para asegurar».</b> En Cotizaciones, cada cotización sin póliza tiene el botón <b>📷 Fotos</b>: le manda al cliente el correo «Paso 1 · Fotografías» con el enlace del INS para tomar las fotos del vehículo. El nombre, el correo, la placa y el vehículo ya salen de la cotización: solo pegás el enlace del INS de ese cliente.',
      '<b>Si el cliente no está en la lista</b>, arriba de Cotizaciones está <b>«+ Fotos a un cliente que no está en la lista»</b>: el mismo cuadro, vacío, para escribir sus datos.',
      'Después de enviar podés avisarle por WhatsApp con el mismo enlace, y la fila queda marcada «📷 Fotos enviadas» con la fecha. Solo se acepta un enlace de la plataforma del INS (asegurarte.grupoins.com).',
      '<b>Va solo con el enlace, sin código QR</b>: la guía, el formulario de cita y su correo de confirmación ahora le dicen al cliente que le llega un enlace al correo.'
    ]
  }
};
