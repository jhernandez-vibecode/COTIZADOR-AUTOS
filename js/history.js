/**
 * Cotizador SDI · Historial de cotizaciones enviadas
 *
 * Guarda en localStorage los metadatos de cada cotizacion enviada
 * (cliente, placa, correo, URL del explicador) para que el agente pueda
 * dar seguimiento — la cotizacion del INS vence a los 15 dias.
 *
 * NO guarda el PDF (excederia la cuota de localStorage). Reenviar una
 * cotizacion requiere volver a subir el PDF original.
 *
 * API publica:
 *   - loadHistory()          -> Array<entry>
 *   - saveHistoryEntry(e)    -> void   (unshift + cap 100)
 *   - clearHistory()         -> void
 *   - buildWaShareUrl(entry) -> string URL de WhatsApp con la guia
 *
 * Forma de entry:
 *   { date: ISO string, client, email, plate, vehicle, quote, guideUrl }
 */

const HISTORY_KEY = 'cotizador_sdi_history_v1';
const HISTORY_MAX = 100;

/**
 * Lee el historial guardado. Devuelve [] ante cualquier problema.
 * @returns {Array<object>}
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[history] error leyendo localStorage:', e);
    return [];
  }
}

/**
 * Agrega una entrada al inicio del historial (mas reciente primero).
 * Nunca lanza — si localStorage falla, el envio del correo no se ve afectado.
 * @param {object} entry
 */
function saveHistoryEntry(entry) {
  try {
    const arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('[history] no se pudo guardar la entrada:', e);
  }
}

/**
 * Borra todo el historial.
 */
function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn('[history] error borrando localStorage:', e);
  }
}

/**
 * URL para compartir la guia explicada por WhatsApp.
 * SIEMPRE web.whatsapp.com/send/ — wa.me corrompe los emojis del mensaje.
 * Sin telefono: WhatsApp abre el selector de chat del agente.
 * @param {object} entry - entrada del historial
 * @returns {string}
 */
function buildWaShareUrl(entry) {
  const msg = 'Hola ' + (entry.client || '') + '! 👋 Te acabo de enviar por correo la cotización de tu '
    + (entry.vehicle || 'vehículo')
    + (entry.plate ? ' (placa ' + entry.plate + ')' : '')
    + '. Aquí tenés la guía explicada paso a paso: ' + entry.guideUrl;
  return 'https://web.whatsapp.com/send/?text=' + encodeURIComponent(msg);
}
