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
  LOGO_URL:    'https://cotizador.appsegurosdigitales.com/img/ins-logo.png',
  // Logotipo SDI del pie del correo. Va como imagen y no recreado con tablas
  // porque su tipografia esta vectorizada en el kit de marca, y en correo las
  // fuentes web no cargan: cualquier version hecha con texto caeria a Arial.
  LOGO_SDI_URL: 'https://cotizador.appsegurosdigitales.com/img/sdi-logo-email.png',
  WEBSITE:     'www.segurosdelins.com',

  // Pie del correo
  PHONE:       '8822-1348',
  WHATSAPP:    '8822-1348',  // WhatsApp del agente, sin código país (se normaliza al usar)
  LICENSE:     '08-1318',

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
    version: '2026-09-18',
    fecha: '18 sep 2026',
    items: [
      '<b>La pantalla de "Agendar mi cita" de la guía ya no parece una cita confirmada.</b> Decía "¡Muy bien!" con confeti; ahora dice "Falta un paso", aclara que la cita todavía no está agendada y el botón se llama "Abrir el formulario y agendar". El enlace a tu formulario es el mismo.',
      '<b>Nuevo acceso "Asistencias a cliente" en el menú, bajo Enviar.</b> Para los clientes que ya tienen póliza: escribís su nombre, correo, la prima anual que paga hoy y su forma de pago, y le sale un correo con los seis planes de asistencia que el INS estrena el 28 de setiembre, más un botón a una página donde prende los que quiera y ve en cuánto quedaría su seguro. Después podés avisarle por WhatsApp. No se guarda en Cotizaciones.',
      '<b>Desde el 28 de setiembre, el correo de cotización lleva una tarjeta con los seis planes</b> después de las formas de pago, con el mismo botón, <b>y la guía del cliente suma una sección "Sumale asistencias a tu póliza"</b> entre las formas de pago y el día de la cita. En el paso 3 aparece una casilla para apagarlos en una cotización concreta. Antes del 28 el correo y la guía salen igual que hoy.',
      '<b>El correo de Renovación confirmada también cambió de imagen</b>: tarjeta del vehículo con la placa dibujada y el número de póliza, sello "Pago aplicado", el monto grande con el período y el comprobante, los pasos ante un evento con los teléfonos a la derecha, y las mismas tarjetas de Viaje y Estudiantil con icono. Con varios recibos, la tabla y el total van en blanco y negro.',
      '<b>El correo de Póliza activa cambió de imagen</b>: después del saludo va la tarjeta del vehículo con la placa dibujada (roja si es carga liviana) y el número de póliza; luego el sello "Póliza activa", los documentos adjuntos y debajo el Centro de Asistencia Digital.',
      '<b>Botones redondos azules, sin cajas con barra de color</b>, teléfonos de emergencia grandes y un icono sencillo en Seguro de Viaje y Seguro Estudiantil.',
      '<b>Los textos y los enlaces son los mismos</b>; solo cambia cómo se ve. El de Viaje dice ahora "fuera del país".'
    ]
  }
};
