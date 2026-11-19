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
//                    cli:<huella> (a que agente se le asigno un vehiculo, 19 nov 2026)
// =====================================================================
import marca from "../../../js/email-marca.js";
import { repartoInicial, normCorreo } from "./cotizar-reparto.mjs";
import { agentesAutorizados } from "./cita-validacion.mjs";
import { huella } from "./cita-limite.mjs";

// ---------------------------------------------------------------------
// Solicitud REPETIDA → mismo agente (19 nov 2026). JC: un cliente mando la
// cotizacion dos veces y le llego una a Christian y otra a Melanie. Se recuerda
// por CLIENTE_DIAS a que agente se le asigno cada vehiculo: el usado por su
// placa; el cero km por la cedula de quien inscribe + marca y modelo.
// Solo se guarda una huella (sha256) y el correo del AGENTE: nada del cliente.
// ---------------------------------------------------------------------
export const CLIENTE_DIAS = 30;
const soloAlfa = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** La clave que identifica el vehiculo de la solicitud, o "" si no hay con que. */
export function claveCliente(d) {
  if (!d) return "";
  if (d.tipo === "usado") {
    const p = soloAlfa(d.placa);
    return p.length >= 4 ? "cli:" + huella("p|" + p) : "";
  }
  const ced = String(d.cedula2 || "").replace(/\D/g, ""), mm = soloAlfa(d.marcaModelo);
  return ced.length >= 9 && mm ? "cli:" + huella("n|" + ced + "|" + mm) : "";
}
/** {email, fecha} si ese vehiculo se le asigno a alguien en los ultimos CLIENTE_DIAS; si no, null. */
export async function clienteReciente(store, d, ahora) {
  const k = claveCliente(d);
  if (!k) return null;
  const r = await store.get(k, { type: "json" });
  if (!r || !r.email || !r.fecha) return null;
  return ahora.getTime() - Date.parse(r.fecha) <= CLIENTE_DIAS * 86400000 ? r : null;
}
export async function recordarCliente(store, d, email, ahora) {
  const k = claveCliente(d);
  if (k && email) await store.setJSON(k, { email: normCorreo(email), fecha: ahora.toISOString() });
}

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
