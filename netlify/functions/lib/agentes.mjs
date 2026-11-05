// =====================================================================
// Los AGENTES en el servidor: fichas, reparto y firma (5 nov 2026)
// ---------------------------------------------------------------------
// Dueno UNICO del store "cotizar" de Netlify Blobs y de sus claves. Lo usan los
// dos formularios publicos:
//   /cotizar/enviar  · reparte la solicitud y la firma el agente que le toco
//   /cita/enviar     · firma la confirmacion de la cita
// Ninguno de los dos confia en lo que manda el navegador sobre el agente: el
// nombre, la licencia y los telefonos salen de la FICHA que el agente guarda
// desde su ⚙ (POST /cotizar/agente, accion "ficha"), y el cargo de asesor de la
// lista SDI_ASESORES de js/email-marca.js (la misma de los correos de la consola).
//
// Claves del store:  reparto · turno · ficha:<correo> · lim:* y dup:* (limites)
// =====================================================================
import marca from "../../../js/email-marca.js";
import { repartoInicial, normCorreo } from "./cotizar-reparto.mjs";
import { agentesAutorizados } from "./cita-validacion.mjs";

const ASESORES = marca.SDI_ASESORES || {};

/** El store de los agentes (consistencia fuerte: el turno y el reparto no pueden leerse viejos). */
export const abrirStore = (getStore) => getStore({ name: "cotizar", consistency: "strong" });

export const leerReparto = async (store, admin) => (await store.get("reparto", { type: "json" })) || repartoInicial(admin);
export const guardarReparto = (store, reparto, ahora) => store.setJSON("reparto", { ...reparto, actualizado: ahora.toISOString() });
export const leerTurno = (store) => store.get("turno", { type: "json" });
export const guardarTurno = (store, turno) => store.setJSON("turno", turno);

export const leerFicha = (store, email) => store.get("ficha:" + normCorreo(email), { type: "json" });
export const guardarFicha = (store, email, ficha, ahora) => store.setJSON("ficha:" + normCorreo(email), { ...ficha, actualizado: ahora.toISOString() });
/** {correo: ficha|null} de varios agentes, pedidas todas a la vez. */
export async function leerFichas(store, emails) {
  const unicos = [...new Set(emails.map(normCorreo))];
  return Object.fromEntries(await Promise.all(unicos.map(async (e) => [e, await leerFicha(store, e)])));
}

/** ¿Este correo puede guardar ficha? El admin, los del reparto y los que tienen el formulario de cita. */
export function puedeTenerFicha(email, { admin, reparto, env }) {
  const e = normCorreo(email);
  return !!e && (e === normCorreo(admin) || reparto.agentes.some((a) => a.email === e) || tieneCita(e, env));
}
/** ¿Tiene el formulario de cita activo? (variable CITA_AGENTES de Netlify) */
export const tieneCita = (email, env) => agentesAutorizados(env.CITA_AGENTES).has(normCorreo(email));

/**
 * La firma del agente para los correos: su ficha y, si es asesor, su cargo y su oficina.
 * @returns {{email,nombre,licencia,telefono,whatsapp,cargo,oficina}|null}  null sin ficha
 */
export function firmaDe(email, ficha) {
  if (!ficha || !ficha.nombre) return null;
  const e = normCorreo(email), asesor = ASESORES[e] || {};
  return {
    email: e, nombre: String(ficha.nombre), licencia: String(ficha.licencia || ""),
    telefono: String(ficha.telefono || ""), whatsapp: String(ficha.whatsapp || ""),
    cargo: String(asesor.cargo || ""), oficina: String(asesor.oficina || ""),
  };
}
