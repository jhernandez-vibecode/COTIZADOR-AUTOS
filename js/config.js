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
  WEBSITE:     'www.segurosdelins.com',

  // Pie del correo
  PHONE:       '8822-1348',
  WHATSAPP:    '8822-1348',  // WhatsApp del agente, sin código país (se normaliza al usar)
  LICENSE:     '08-1318',

  // Envío de pólizas activas (sub-página polizas-activas/) — personalizables por agente desde ⚙
  // ASSIST_URL: Centro de Asistencia Digital (app de asistencia autos). Otros agentes le agregan su ?a=<id>.
  // XSELL_*: links "Comprar" del cross-sell al final del correo. Si quedan vacíos, el botón cae al sitio web del agente.
  ASSIST_URL:            'https://appasistenciaseguroautos.netlify.app/',
  XSELL_VIAJE_URL:       'https://seguros-viajero.appsegurosdigitales.com/',
  XSELL_ESTUDIANTIL_URL: '',

  // Gmail API
  GMAIL_SCOPE:    'https://www.googleapis.com/auth/gmail.send',
  GMAIL_SEND_URL: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',

  // Worker de PDF.js
  PDFJS_WORKER: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};
