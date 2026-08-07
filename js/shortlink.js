/**
 * Cotizador SDI · Enlaces cortos para WhatsApp
 *
 * WhatsApp colapsa los mensajes largos con "Leer mas" y parte la URL a la
 * mitad: el cliente abre un link roto. Los dos enlaces que le mandamos crudos
 * son largos por naturaleza, asi que se cambian por un alias de ~54 caracteres
 * que sirve la Netlify Function netlify/functions/enlace.mjs:
 *
 *   'g' → guia de la cotizacion   /explicacion/?n=…&c=…&va=…  (hasta 13 params)
 *   'a' → guia de emergencias     app de asistencia + ficha del agente (~180)
 *
 * Se usa SOLO donde el cliente ve la URL cruda (WhatsApp y Copiar). El correo
 * y el historial guardan el link LARGO a proposito: el boton del correo lo
 * esconde igual, y historyEntryValue/historyEntryPlate parsean `va` y `p` del
 * guideUrl para reconstruir entradas viejas del 📊.
 *
 * Si el acortador falla devuelve el link largo: acortar nunca debe impedir que
 * el agente comparta. El largo funciona igual, solo se ve feo.
 */

/** Tope de espera: la pestaña de WhatsApp ya esta abierta esperando esto. */
var SHORTLINK_TIMEOUT_MS = 6000;
var SHORTLINK_RE_ID = /^[A-Z2-9]{10}$/;

/**
 * Cambia un link largo por su alias corto.
 *
 * @param {string} urlLarga - URL completa, con sus parametros
 * @param {string} [tipo]   - 'g' guia de la cotizacion (default) · 'a' asistencia
 * @returns {Promise<string>} el alias corto, o la URL larga si no se pudo
 */
async function acortarEnlace(urlLarga, tipo) {
  var larga = String(urlLarga || '');
  var i = larga.indexOf('?');
  if (i === -1) return larga;                       // sin parametros no hay nada que acortar

  var ruta = tipo === 'a' ? '/a' : '/g';
  var cuerpo = { q: larga.slice(i + 1) };
  // La guia de emergencias vive en OTRO sitio (la app de asistencia), asi que
  // hay que decirle a la Function a donde apunta. Ella lo valida contra su
  // lista blanca de hosts y rechaza cualquier otro: sin eso, el acortador se
  // volveria un redirector abierto.
  if (tipo === 'a') cuerpo.b = larga.slice(0, i);

  try {
    var r = await fetch(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout ? AbortSignal.timeout(SHORTLINK_TIMEOUT_MS) : undefined
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    if (!data || !SHORTLINK_RE_ID.test(data.id || '')) throw new Error('id invalido');
    return location.origin + ruta + '/' + data.id;
  } catch (e) {
    console.warn('[cotizador] no se pudo acortar el enlace; se comparte el largo', e);
    return larga;
  }
}

// Export para tests Node (sin romper el browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { acortarEnlace: acortarEnlace };
}
