// =====================================================================
// Reparto de las solicitudes de cotizacion entre agentes (5 nov 2026)
// ---------------------------------------------------------------------
// Puro: sin @netlify/blobs. Lo usa netlify/functions/cotizar.mjs y lo prueba
// tests/test-cotizar-reparto.mjs con Node pelado.
//
// Regla de JC: POR TURNOS, no al azar, y EDITABLE cuando el quiera. Cada
// agente lleva un peso (0-9) = cuantas solicitudes seguidas le tocan en cada
// vuelta. 3-1-1 → JC, JC, JC, Jose, Cristian, y vuelve a empezar.
// Peso 0 = fuera de la vuelta. Apagado (temporada baja) = todo al admin.
// Al cambiar la lista o los pesos la vuelta arranca de nuevo (firma distinta).
// Un agente sin ficha (no ha guardado su ⚙) se salta: nadie recibe una
// confirmacion firmada por nadie.
// =====================================================================
import { createHash } from "node:crypto";

export const PESO_MAX = 9;
export const MAX_AGENTES = 10;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normCorreo = (s) => String(s || "").trim().toLowerCase();

/** Reparto inicial: apagado y solo el admin. */
export function repartoInicial(admin) {
  return { on: false, agentes: [{ email: normCorreo(admin), peso: 1 }] };
}

/**
 * Limpia lo que manda el panel del ⚙. Devuelve {ok, reparto} o {ok:false, error}.
 * El admin siempre queda en la lista (si no viene, entra con peso 0).
 */
export function normalizarReparto(entrada, admin) {
  const adm = normCorreo(admin);
  if (!entrada || typeof entrada !== "object" || !Array.isArray(entrada.agentes)) return { ok: false, error: "Reparto inválido." };
  if (entrada.agentes.length > MAX_AGENTES) return { ok: false, error: "Máximo " + MAX_AGENTES + " agentes." };
  const vistos = new Set();
  const agentes = [];
  for (const a of entrada.agentes) {
    const email = normCorreo(a && a.email);
    if (!RE_CORREO.test(email) || email.length > 120) return { ok: false, error: "Correo inválido: " + String(a && a.email || "").slice(0, 60) };
    if (vistos.has(email)) return { ok: false, error: "Ese correo está dos veces: " + email };
    vistos.add(email);
    const peso = Number(a.peso);
    if (!Number.isInteger(peso) || peso < 0 || peso > PESO_MAX) return { ok: false, error: "El número de cada agente va de 0 a " + PESO_MAX + "." };
    agentes.push({ email, peso });
  }
  if (adm && !vistos.has(adm)) agentes.unshift({ email: adm, peso: 0 });
  return { ok: true, reparto: { on: entrada.on === true, agentes } };
}

/** La vuelta expandida: [jc, jc, jc, jose, cristian]. */
export function vuelta(reparto) {
  const v = [];
  for (const a of (reparto && reparto.agentes) || []) for (let k = 0; k < a.peso; k++) v.push(a.email);
  return v;
}

/** Huella de la lista y los pesos: si cambia, la vuelta arranca de nuevo. */
export function firmaReparto(reparto) {
  const base = ((reparto && reparto.agentes) || []).map((a) => a.email + ":" + a.peso).join("|");
  return createHash("sha256").update(base).digest("base64url").slice(0, 16);
}

/**
 * A quien le toca la proxima solicitud.
 * @param {object} p
 * @param {object} p.reparto  {on, agentes}
 * @param {object|null} p.turno  {pos, firma} guardado
 * @param {(email:string)=>boolean} p.tieneFicha
 * @param {string} p.admin
 * @returns {{email:string, n:number, de:number, repartido:boolean, turno:{pos:number, firma:string}|null}}
 *   turno = lo que hay que guardar (null si no se mueve la vuelta).
 */
export function elegir({ reparto, turno, tieneFicha, admin }) {
  const adm = normCorreo(admin);
  const v = reparto && reparto.on ? vuelta(reparto) : [];
  if (!v.length) return { email: adm, n: 0, de: 0, repartido: false, turno: null };
  const firma = firmaReparto(reparto);
  let pos = turno && turno.firma === firma && Number.isInteger(turno.pos) && turno.pos >= 0 ? turno.pos % v.length : 0;
  for (let i = 0; i < v.length; i++) {
    const p = (pos + i) % v.length;
    if (tieneFicha(v[p])) return { email: v[p], n: p + 1, de: v.length, repartido: true, turno: { pos: (p + 1) % v.length, firma } };
  }
  return { email: adm, n: 0, de: v.length, repartido: false, turno: null };
}

/** Las proximas `cuantas` asignaciones, para la vista previa del panel (salta a quien no tiene ficha). */
export function proximos(reparto, turno, cuantas = 10, tieneFicha = () => true, admin = "") {
  const v = reparto && reparto.on ? vuelta(reparto) : [];
  if (!v.length) return [];
  const out = [];
  let t = turno;
  for (let i = 0; i < cuantas; i++) {
    const s = elegir({ reparto, turno: t, tieneFicha, admin: admin || v[0] });
    out.push(s.email);
    if (s.turno) t = s.turno;
  }
  return out;
}
