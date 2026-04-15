/**
 * Cotizador SDI · Perfil del agente (multi-tenant via localStorage)
 *
 * Permite que distintos agentes usen la misma URL Netlify, cada uno
 * con sus propios datos personales (nombre, licencia SUGESE, correo,
 * telefono). Los datos se guardan en localStorage del navegador, asi
 * que cada agente solo configura una vez por dispositivo.
 *
 * Estrategia:
 *   - El config.js trae los valores por defecto (Juan Carlos como owner).
 *   - Si hay un perfil guardado en localStorage, applyProfile() sobrescribe
 *     CFG.FROM_NAME, CFG.FROM_EMAIL, CFG.PHONE y CFG.LICENSE.
 *   - El resto del codigo (email-template, mime-builder) sigue leyendo
 *     CFG.* sin saber si vienen del default o del perfil personal.
 *
 * IMPORTANTE: el correo (FROM_EMAIL) debe coincidir con la cuenta Gmail
 * con la que el agente se autentique. Si pone otro correo aqui pero
 * autoriza con otra cuenta, Gmail enviara desde la cuenta autenticada
 * (que es lo que importa para el destinatario).
 *
 * API publica:
 *   - loadProfile()    -> object|null   leer del localStorage
 *   - saveProfile(p)   -> void          guardar en localStorage
 *   - applyProfile(p)  -> void          sobrescribir CFG con el perfil
 *   - isFirstTime()    -> boolean       true si nunca se configuro
 *   - clearProfile()   -> void          borrar el perfil guardado
 */

const PROFILE_KEY = 'cotizador_sdi_agent_v1';

/**
 * Lee el perfil guardado en localStorage.
 * @returns {object|null} {name, email, phone, license, website} o null si no hay
 */
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.name || !p.email) return null; // perfil corrupto
    return p;
  } catch (e) {
    console.error('[profile] error leyendo localStorage:', e);
    return null;
  }
}

/**
 * Guarda el perfil en localStorage.
 * @param {object} p - {name, email, phone, license, website}
 *                     website es opcional (string vacio si el agente no tiene web)
 */
function saveProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      name:    (p.name    || '').trim(),
      email:   (p.email   || '').trim(),
      phone:   (p.phone   || '').trim(),
      license: (p.license || '').trim(),
      website: (p.website || '').trim()
    }));
  } catch (e) {
    console.error('[profile] error guardando localStorage:', e);
    throw new Error('No se pudo guardar el perfil. Verifica que el navegador permita localStorage.');
  }
}

/**
 * Aplica un perfil al CFG global, sobrescribiendo los datos del agente.
 * El resto del codigo (email-template, mime-builder) usa CFG.* directamente.
 * Si website viene vacio, se setea como cadena vacia para que el footer del
 * correo no muestre el bloque.
 * @param {object} p - {name, email, phone, license, website}
 */
function applyProfile(p) {
  if (!p) return;
  if (p.name)    CFG.FROM_NAME  = p.name;
  if (p.email)   CFG.FROM_EMAIL = p.email;
  if (p.phone)   CFG.PHONE      = p.phone;
  if (p.license) CFG.LICENSE    = p.license;
  // website es opcional, asignamos siempre (puede ser '' para ocultar)
  if (p.website !== undefined) CFG.WEBSITE = p.website;
}

/**
 * @returns {boolean} true si el agente nunca ha configurado su perfil
 */
function isFirstTime() {
  return loadProfile() === null;
}

/**
 * Borra el perfil guardado (vuelve al default del CFG).
 * Util si el agente quiere "des-configurar" el navegador.
 */
function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (e) {
    console.error('[profile] error borrando localStorage:', e);
  }
}
