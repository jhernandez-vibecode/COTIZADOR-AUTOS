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
  LICENSE:     '08-1318',

  // Gmail API
  GMAIL_SCOPE:    'https://www.googleapis.com/auth/gmail.send',
  GMAIL_SEND_URL: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',

  // Microsoft Outlook (Graph API)
  MSAL_CLIENT_ID:   '70998ed5-2c92-4aba-b7e7-fb53b083f472',
  OUTLOOK_SCOPE:    'https://graph.microsoft.com/Mail.Send',
  OUTLOOK_SEND_URL: 'https://graph.microsoft.com/v1.0/me/sendMail',

  // Worker de PDF.js
  PDFJS_WORKER: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};
