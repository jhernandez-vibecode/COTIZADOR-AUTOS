// =====================================================================
// Validacion de los enlaces cortos  ·  la usa netlify/functions/enlace.mjs
// ---------------------------------------------------------------------
// Vive aparte de la Function por una razon practica: aca NO se importa
// @netlify/blobs, asi que tests/test-enlace-validacion.mjs corre con Node
// pelado, sin npm install (que es como se corren todos los tests del repo).
//
// Netlify no trata esto como una Function: dentro de una subcarpeta solo
// se registra el archivo que se llama igual que la carpeta (lib.mjs) o
// index.mjs. Este se empaqueta como codigo compartido, que es lo que es.
// =====================================================================

export const MAX_QS = 2000;

// Lista blanca de parametros del explicador (ver _buildGuideUrl en
// js/email-template.js). Cualquier clave fuera de aca hace que el enlace
// se rechace: sin esto el endpoint seria un almacen abierto para cualquiera.
export const CLAVES = new Set([
  "n", "l", "w", "a",                       // agente
  "c", "v", "p", "y", "vt", "og", "ag",     // cliente y vehiculo
  "va", "sr", "dd", "pa", "ps", "pt",       // valor, repuestos, precios
]);

// Parametros de la guia de emergencias (ver polizaAsistenciaUrl en
// js/poliza-email.js): la ficha del agente + el `a=<id>` del roster viejo.
export const CLAVES_A = new Set(["a", "n", "tel", "wa", "em", "lic", "web"]);

// Hosts a los que /a tiene permitido redirigir. La app de asistencia vive
// en su propio repo (APP-ASISTENCIA-SEGURO-AUTOS). Si algun dia estrena
// dominio propio, se agrega aca — hasta entonces ese enlace no se acorta
// y se comparte largo, que funciona igual.
export const DESTINOS_A = new Set(["https://appasistenciaseguroautos.netlify.app"]);

/** Solo se guarda algo que de verdad parece un link nuestro. */
export function esNuestro(qs, claves) {
  if (typeof qs !== "string") return false;
  if (qs.length < 3 || qs.length > MAX_QS) return false;
  let params;
  try {
    params = new URLSearchParams(qs);
  } catch {
    return false;
  }
  const cs = [...params.keys()];
  if (!cs.length) return false;
  if (!cs.every((k) => claves.has(k))) return false;

  // Defensa en profundidad. Hoy el explicador ya esta blindado: escapa con
  // esc()/textContent, fuerza https:// en `w` y pasa `a` por safeHttpUrl. Pero
  // un alias corto disfraza lo que la URL larga mostraba a la vista, asi que
  // no queremos ser el vehiculo de un parametro peligroso si manana alguien
  // agrega uno al explicador sin escapar. Ningun valor legitimo empieza asi.
  for (const v of params.values()) {
    if (/^\s*(javascript|data|vbscript|file)\s*:/i.test(v)) return false;
    // Un CRLF pasaria la validacion y despues reventaria la cabecera Location
    // del 302 con un 500 permanente: el enlace quedaria guardado y roto.
    //
    // OJO: la clase lleva retorno, salto de linea y NUL - NO el espacio.
    // URLSearchParams DECODIFICA los valores, y todo nombre real trae espacios
    // ("Juan Carlos", "DELGADO ARGUELLO SILVIA MARIEL"): meter el espacio ahi
    // rechazaria practicamente todas las cotizaciones y el acortador caeria
    // siempre al link largo, en silencio.
    //
    // El NUL va ESCAPADO a proposito. Hasta el 7 ago 2026 este archivo tenia
    // el byte crudo, que en cualquier editor se ve identico a un espacio: al
    // reescribirlo se cuela un espacio de verdad sin que nadie lo note. Misma
    // regla que los acentos en email-template.js - nada de caracteres
    // invisibles en el fuente.
    if (/[\r\n\u0000]/.test(v)) return false;
  }
  return true;
}

/**
 * Normaliza la base de un enlace de asistencia contra la lista blanca.
 *
 * ESTO ES LO QUE IMPIDE QUE EL ACORTADOR SEA UN REDIRECTOR ABIERTO: /a
 * redirige a otro sitio (la app de asistencia), y el host llega del cliente.
 * Solo pasa si su origin esta EXACTO en DESTINOS_A — no por prefijo, que
 * dejaria entrar a appasistenciaseguroautos.netlify.app.malo.com.
 *
 * @returns {string} "origin + pathname" (el query y el hash viajan aparte
 *                   en `q`), o "" si el host no esta autorizado.
 */
export function baseAsistencia(b) {
  let u;
  try {
    u = new URL(String(b || ""));
  } catch {
    return "";
  }
  if (!DESTINOS_A.has(u.origin)) return "";
  return u.origin + u.pathname;
}
