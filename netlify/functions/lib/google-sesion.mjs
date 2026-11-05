// =====================================================================
// ¿Quien es? · valida la sesion de Google de un agente (5 nov 2026)
// ---------------------------------------------------------------------
// El ⚙ pide a Google un access token con scope "openid email" (GIS, el mismo
// Client ID del cotizador) y lo manda. Aca se le pregunta a Google de quien
// es: tokeninfo devuelve el correo SOLO si el token es valido y vigente. Se
// exige que el token sea de NUESTRO Client ID (azp/aud) y el correo verificado.
// El fetch se inyecta para el test.
// =====================================================================
export const CLIENT_ID_DEFECTO = "255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com";
const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?access_token=";

/** @returns {Promise<string|null>} el correo (minusculas) o null */
export async function correoDeSesion(token, { clientId = CLIENT_ID_DEFECTO, fetchFn = fetch } = {}) {
  const t = String(token || "");
  if (!/^[\w.\-~+/]{20,4096}$/.test(t)) return null;
  let r;
  try { r = await fetchFn(TOKENINFO + encodeURIComponent(t)); } catch { return null; }
  if (!r || !r.ok) return null;
  let j;
  try { j = await r.json(); } catch { return null; }
  if (!j || (j.azp !== clientId && j.aud !== clientId)) return null;
  if (!(j.email_verified === true || j.email_verified === "true")) return null;
  if (!(Number(j.expires_in) > 0)) return null;
  return String(j.email || "").trim().toLowerCase() || null;
}
