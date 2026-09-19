// =====================================================================
// Limite de envios de /cita/enviar  ·  freno contra abuso
// ---------------------------------------------------------------------
// El store se INYECTA (Netlify Blobs en produccion, un Map en el test).
// Se guarda SOLO una huella irreversible y un contador o una hora:
// ningun dato del cliente toca el almacenamiento.
// =====================================================================
import { createHash } from "node:crypto";

export const huella = (txt) => createHash("sha256").update(String(txt)).digest("base64url").slice(0, 22);
export const cubeta = (now) => new Date(now).toISOString().slice(0, 13);

/** true si todavia cabe una mas en esta clave; la cuenta al pasar. */
export async function permitir(store, clave, max) {
  const n = Number(await store.get(clave)) || 0;
  if (n >= max) return false;
  await store.set(clave, String(n + 1));
  return true;
}

/** true si la misma solicitud entro hace menos de 60 s (doble clic, reintento). */
export async function esDuplicado(store, h, now) {
  const clave = "dup:" + h, t = new Date(now).getTime();
  const previo = Number(await store.get(clave)) || 0;
  if (previo && t - previo < 60000) return true;
  await store.set(clave, String(t));
  return false;
}
