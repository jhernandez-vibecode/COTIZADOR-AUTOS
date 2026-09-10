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
    version: '2026-09-10',
    fecha: '10 sep 2026',
    items: [
      '<b>El cotizador estrena la imagen de Seguros Digitales SDI</b>: fondo claro, letra nueva, el logotipo a color arriba con tu nombre y licencia, botones redondos azules y tarjetas blancas.',
      '<b>La guía que recibe tu cliente también cambió de imagen</b>: el logo del INS arriba en azul, las coberturas con su color suave y el pago anual siempre resaltado. Los enlaces que ya enviaste se siguen viendo bien.',
      '<b>Póliza activa, Renovación confirmada, Cancelación anticipada y Marcas con recargo</b> también tienen la imagen nueva.',
      '<b>Todo funciona igual</b>: los mismos pasos, los mismos botones y los mismos correos. Solo se ve distinto.'
    ]
  }
};
