/**
 * Cotizador SDI · Autenticacion y envio por Microsoft Outlook (Graph API)
 *
 * Usa MSAL.js 2.x (msal-browser) via CDN para autenticar con cuentas
 * Microsoft (Outlook, Microsoft 365) y obtener un token para Graph API.
 *
 * Flujo:
 *   1. initMSAL()        - crea la instancia PublicClientApplication (idempotente)
 *   2. getOutlookToken() - intenta silencioso; si falla, abre popup de Microsoft
 *   3. clearOutlookToken() - limpia el token cacheado (fuerza nuevo popup)
 *
 * Nota: a diferencia de Gmail, Microsoft Graph sendMail no necesita
 * construir un mensaje MIME — se envia como JSON directamente.
 * El envio ocurre en outlook-sender.js.
 *
 * API publica:
 *   - initMSAL()          - inicializa MSAL (idempotente)
 *   - getOutlookToken()   - Promise<string> con el access token
 *   - clearOutlookToken() - limpia el token cacheado
 */

/**
 * Inicializa la instancia MSAL. Es idempotente.
 * @returns {object} instancia PublicClientApplication de MSAL
 * @throws Error si la libreria MSAL no esta cargada
 */
function initMSAL() {
  if (S.msalInstance) return S.msalInstance;

  if (!window.msal || !msal.PublicClientApplication) {
    throw new Error('MSAL no esta cargado. Verifica el script msal-browser.min.js.');
  }

  const msalConfig = {
    auth: {
      clientId:    CFG.MSAL_CLIENT_ID,
      authority:   'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    }
  };

  S.msalInstance = new msal.PublicClientApplication(msalConfig);
  return S.msalInstance;
}

/**
 * Obtiene un access token valido para Microsoft Graph (Mail.Send).
 * Si ya hay uno cacheado en S.outlookToken, lo devuelve sin popup.
 * Si hay una cuenta en sesion, intenta renovacion silenciosa.
 * Si falla o no hay sesion, abre el popup de Microsoft.
 * @returns {Promise<string>} el access token
 */
async function getOutlookToken() {
  if (S.outlookToken) return S.outlookToken;

  const instance = initMSAL();
  const request  = { scopes: [CFG.OUTLOOK_SCOPE] };

  // Intentar silencioso con cuenta existente en sessionStorage
  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const response = await instance.acquireTokenSilent({
        ...request,
        account: accounts[0]
      });
      S.outlookToken = response.accessToken;
      return S.outlookToken;
    } catch (e) {
      // Token expirado o requiere interaccion — caer al popup
      console.warn('[outlook-auth] silencioso fallo, abriendo popup:', e.message);
    }
  }

  // Popup de Microsoft (login + consentimiento de Mail.Send)
  const response = await instance.acquireTokenPopup(request);
  S.outlookToken = response.accessToken;
  return S.outlookToken;
}

/**
 * Limpia el token cacheado. La proxima llamada a getOutlookToken() abrira popup.
 */
function clearOutlookToken() {
  S.outlookToken = null;
}
