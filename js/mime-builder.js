/**
 * Cotizador SDI · Construccion del mensaje MIME multipart
 *
 * Construye el cuerpo "raw" que recibe Gmail API: un MIME multipart/mixed
 * con dos partes:
 *   1. text/html (UTF-8) - el cuerpo del correo (HTML del email-template)
 *   2. application/pdf  - el PDF de cotizacion ya limpiado
 * Y luego codifica TODO en base64url (alfabeto URL-safe sin padding).
 *
 * Detalles tecnicos importantes:
 *   - El boundary debe ser unico y NO aparecer en el contenido
 *     (lo construimos con timestamp + random para garantizar unicidad).
 *   - Subject con caracteres no-ASCII se codifica con RFC 2047 (=?UTF-8?B?...?=).
 *   - El HTML se manda como text/html con charset UTF-8, transferencia 7bit.
 *   - El PDF se envia en base64 con line-wrap a 76 chars (recomendado por RFC 2045).
 *   - El raw final usa CRLF como separador de lineas (estandar SMTP/MIME).
 *   - base64url: alfabeto Gmail-compatible (+/= -> -_ y sin padding).
 *
 * API publica:
 *   - buildMIME({to, from, subject, html, pdfBytes, filename}) -> string base64url
 */

/**
 * Construye el mensaje MIME completo en formato base64url para Gmail API.
 * @param {object} args
 * @param {string} args.to        - direccion del destinatario
 * @param {string} args.from      - "Nombre <correo@dominio>" del remitente
 * @param {string} args.subject   - asunto (puede tener acentos / no-ASCII)
 * @param {string} args.html      - cuerpo HTML del correo
 * @param {Uint8Array} args.pdfBytes - bytes del PDF a adjuntar
 * @param {string} args.filename  - nombre del archivo adjunto
 * @returns {string} mensaje MIME completo codificado en base64url
 */
function buildMIME(args) {
  const boundary = '__cotizador_sdi_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const subject64 = _encodeRFC2047(args.subject);
  const pdf64     = _wrapBase64(_uint8ToBase64(args.pdfBytes), 76);

  // CRLF es obligatorio en MIME/SMTP, no usar \n solo
  const CRLF = '\r\n';

  const message =
    'From: '         + args.from                       + CRLF +
    'To: '           + args.to                         + CRLF +
    'Subject: '      + subject64                       + CRLF +
    'MIME-Version: 1.0'                                + CRLF +
    'Content-Type: multipart/mixed; boundary="' + boundary + '"' + CRLF +
    CRLF +
    '--' + boundary + CRLF +
    'Content-Type: text/html; charset=UTF-8'           + CRLF +
    'Content-Transfer-Encoding: 7bit'                  + CRLF +
    CRLF +
    args.html                                          + CRLF +
    CRLF +
    '--' + boundary + CRLF +
    'Content-Type: application/pdf'                    + CRLF +
    'Content-Disposition: attachment; filename="' + args.filename + '"' + CRLF +
    'Content-Transfer-Encoding: base64'                + CRLF +
    CRLF +
    pdf64                                              + CRLF +
    '--' + boundary + '--'                             + CRLF;

  return _base64UrlEncode(message);
}

// =====================================================================
// HELPERS INTERNOS
// =====================================================================

/**
 * Convierte un Uint8Array a base64 estandar (no URL-safe).
 * Procesa en chunks de 32KB para evitar "Maximum call stack" con PDFs grandes.
 * @param {Uint8Array} bytes
 * @returns {string} base64 estandar
 */
function _uint8ToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Inserta saltos de linea cada N caracteres (RFC 2045 recomienda 76).
 * @param {string} b64
 * @param {number} lineLen
 * @returns {string}
 */
function _wrapBase64(b64, lineLen) {
  const re = new RegExp('.{1,' + lineLen + '}', 'g');
  return b64.match(re).join('\r\n');
}

/**
 * Codifica un string UTF-8 a base64url (alfabeto URL-safe, sin padding).
 * Es el formato que Gmail API espera en el campo "raw".
 * @param {string} str - puede tener caracteres no-ASCII
 * @returns {string} base64url
 */
function _base64UrlEncode(str) {
  // unescape(encodeURIComponent(...)) convierte UTF-8 a binary string
  // (truco clasico para que btoa() acepte caracteres no-ASCII).
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Codifica un Subject con RFC 2047 si tiene caracteres no-ASCII.
 * Si es ASCII puro, lo devuelve tal cual.
 * @param {string} subject
 * @returns {string}
 */
function _encodeRFC2047(subject) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const b64 = btoa(unescape(encodeURIComponent(subject)));
  return '=?UTF-8?B?' + b64 + '?=';
}
