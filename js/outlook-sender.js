/**
 * Cotizador SDI · Envio de correo por Microsoft Graph API
 *
 * Envia el correo HTML con PDF adjunto usando el endpoint
 * POST /me/sendMail de Microsoft Graph (no MIME, sino JSON puro).
 *
 * El token debe obtenerse previamente con getOutlookToken()
 * de outlook-auth.js.
 *
 * API publica:
 *   - sendOutlookEmail(params) - Promise; lanza Error si falla
 *
 * @param {object} params
 *   @param {string}     params.to       - correo del destinatario
 *   @param {string}     params.subject  - asunto
 *   @param {string}     params.html     - cuerpo HTML del correo
 *   @param {Uint8Array} params.pdfBytes - PDF ya modificado (limpio)
 *   @param {string}     params.filename - nombre del archivo adjunto
 */
async function sendOutlookEmail({ to, subject, html, pdfBytes, filename }) {
  if (!S.outlookToken) {
    throw new Error('No hay token de Outlook. Llama a getOutlookToken() antes de sendOutlookEmail().');
  }

  // Convertir Uint8Array -> base64 (Graph API espera base64 estandar, no base64url)
  let binary = '';
  const bytes = new Uint8Array(pdfBytes);
  const CHUNK = 8192; // procesar en bloques para evitar stack overflow en PDFs grandes
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  const pdfBase64 = btoa(binary);

  const body = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content:     html
      },
      toRecipients: [
        { emailAddress: { address: to } }
      ],
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name:          filename,
          contentType:   'application/pdf',
          contentBytes:  pdfBase64
        }
      ]
    },
    saveToSentItems: true
  };

  const response = await fetch(CFG.OUTLOOK_SEND_URL, {
    method:  'POST',
    headers: {
      'Authorization': 'Bearer ' + S.outlookToken,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();

    // Token expirado
    if (response.status === 401) {
      clearOutlookToken();
      throw new Error('El token de Outlook expiro. Vuelve a autorizar y reintenta.');
    }

    throw new Error('Microsoft Graph error ' + response.status + ': ' + errText);
  }

  // Graph sendMail devuelve 202 Accepted sin cuerpo (exito)
  return true;
}
