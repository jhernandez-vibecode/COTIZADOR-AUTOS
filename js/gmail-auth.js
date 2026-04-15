/**
 * Cotizador SDI · Autenticacion y envio por Gmail API
 *
 * Maneja el flujo OAuth de Google Identity Services (GIS) en modo
 * "Token Model" (sin redirect, popup directo en el browser) y el
 * envio de mensajes via Gmail API.
 *
 * Flujo tipico:
 *   1. initTokenClient()  - se llama una vez al cargar la app
 *   2. getToken()         - se llama justo antes de enviar el correo,
 *                            abre el popup de Google si no hay token
 *   3. sendEmail(raw)     - hace POST a Gmail API con el MIME ya construido
 *
 * Nota sobre seguridad:
 *   - El token dura 1 hora. No se persiste (vive solo en S.accessToken).
 *   - El scope es solo gmail.send (no leemos correos, solo enviamos).
 *   - El dominio Netlify debe estar en "Authorized JavaScript origins"
 *     del Client ID en Google Cloud Console.
 *
 * API publica:
 *   - initTokenClient()  - inicializa la instancia GIS (idempotente)
 *   - getToken()         - Promise<string> con el access token
 *   - clearToken()       - limpia el token cacheado (forzara nuevo popup)
 *   - sendEmail(raw)     - Promise con la respuesta de Gmail API
 */

/**
 * Inicializa el cliente de Google Identity Services (Token Model).
 * Es idempotente: si ya existe S.tokenClient, lo retorna sin recrearlo.
 * @returns {object} la instancia tokenClient de GIS
 * @throws Error si la libreria GIS no esta cargada
 */
function initTokenClient() {
  if (S.tokenClient) return S.tokenClient;

  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    throw new Error('Google Identity Services no esta cargado. Verifica el script accounts.google.com/gsi/client.');
  }

  S.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.CLIENT_ID,
    scope:     CFG.GMAIL_SCOPE,
    callback:  function () {} // se sobreescribe en getToken() para resolver la promesa
  });

  return S.tokenClient;
}

/**
 * Obtiene un access token valido para Gmail.
 * Si ya hay uno cacheado en S.accessToken, lo devuelve sin abrir popup.
 * Si no, abre el popup de autorizacion de Google.
 * @returns {Promise<string>} el access token
 */
function getToken() {
  if (S.accessToken) {
    return Promise.resolve(S.accessToken);
  }

  initTokenClient();

  return new Promise(function (resolve, reject) {
    // Sobrescribimos el callback dinamicamente para esta solicitud
    S.tokenClient.callback = function (response) {
      if (response.error) {
        reject(new Error('OAuth error: ' + response.error + (response.error_description ? ' - ' + response.error_description : '')));
        return;
      }
      S.accessToken = response.access_token;
      resolve(response.access_token);
    };

    try {
      // prompt: '' permite re-uso silencioso si el usuario ya autorizo
      // (si nunca autorizo, igual abrira el popup de consentimiento)
      S.tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Limpia el token cacheado. La proxima llamada a getToken() abrira popup.
 * Util si el token expiro (1h) o si queremos forzar re-autenticacion.
 */
function clearToken() {
  S.accessToken = null;
}

/**
 * Envia un mensaje MIME ya construido (raw, base64url) via Gmail API.
 * Requiere haber obtenido un token con getToken() previamente.
 * Si el token expiro, limpia el cache y lanza error claro para reintentar.
 * @param {string} raw - mensaje MIME en base64url (de buildMIME en mime-builder.js)
 * @returns {Promise<object>} respuesta JSON de Gmail API (incluye el messageId)
 * @throws Error con el codigo HTTP y el body si Gmail rechaza el envio
 */
async function sendEmail(raw) {
  if (!S.accessToken) {
    throw new Error('No hay access token. Llama a getToken() antes de sendEmail().');
  }

  const response = await fetch(CFG.GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + S.accessToken,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ raw: raw })
  });

  if (!response.ok) {
    const errText = await response.text();

    // Token expirado: limpiar y pedir reintento
    if (response.status === 401) {
      clearToken();
      throw new Error('El token de Gmail expiro (1h). Vuelve a autorizar y reintenta.');
    }

    throw new Error('Gmail API error ' + response.status + ': ' + errText);
  }

  return await response.json();
}
