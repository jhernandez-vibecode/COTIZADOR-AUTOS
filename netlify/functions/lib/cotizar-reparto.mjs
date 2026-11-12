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
// Al cambiar la lista o los pesos la vuelta SIGUE donde iba (JC, 12 nov 2026: posTrasCambio).
// Un agente sin ficha (no ha guardado su ⚙) se salta: nadie recibe una
// confirmacion firmada por nadie.
// =====================================================================
import { createHash } from "node:crypto";

export const PESO_MAX = 9;
/**
 * JC, 8 nov 2026: "como yo soy el agente principal, cualquier solicitud de
 * cotizacion con un valor superior a 15.000.000, esas todas sin excepcion me
 * deben llegar a mi". JC, mismo dia: "igual o mayor a 15.000.000" (15.000.000 justos
 * tambien van al admin).
 * No mueve la vuelta: la siguiente le sigue tocando a quien le tocaba.
 */
export const TOPE_PRINCIPAL = 15000000;
/**
 * JC, 10 nov 2026: el monto del "directo a vos" lo decide el desde el panel, y lo puede
 * APAGAR en epocas de bonanza para que las de valor alto tambien se repartan.
 * Vive en reparto.directo = {on, monto}. TOPE_PRINCIPAL es el valor por defecto (repartos
 * guardados antes de este cambio no traen `directo` y siguen como siempre: encendido a 15M).
 * Millones enteros entre DIRECTO_MIN y DIRECTO_MAX (siempre arriba de TOPE_MANUAL).
 * Cambiarlo NO reinicia la vuelta: firmaReparto solo mira la lista y los pesos.
 */
export const DIRECTO_MIN = 5000000;
export const DIRECTO_MAX = 100000000;
/**
 * JC, 8 nov 2026: "de 4.000.000 para arriba entran en el reparto, menos las asigno
 * manualmente". Menos de este valor no se le asigna a nadie: solo se anota en la
 * hoja (el cliente ve la misma pantalla) y la vuelta no se mueve.
 */
export const TOPE_MANUAL = 4000000;
export const MAX_AGENTES = 10;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normCorreo = (s) => String(s || "").trim().toLowerCase();

/** Reparto inicial: apagado y solo el admin. */
export function repartoInicial(admin) {
  return { on: false, agentes: [{ email: normCorreo(admin), peso: 1 }], directo: { on: true, monto: TOPE_PRINCIPAL } };
}

/** El "directo al admin" de un reparto, con el valor por defecto si no lo trae (repartos viejos). */
export function directoDe(reparto) {
  const d = reparto && reparto.directo;
  if (!d || typeof d !== "object") return { on: true, monto: TOPE_PRINCIPAL };
  const m = Number(d.monto);
  const montoOk = Number.isInteger(m) && m >= DIRECTO_MIN && m <= DIRECTO_MAX && m % 1000000 === 0;
  return { on: d.on !== false, monto: montoOk ? m : TOPE_PRINCIPAL };
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
  let directo = { on: true, monto: TOPE_PRINCIPAL };
  if (entrada.directo !== undefined) {
    const d = entrada.directo;
    if (!d || typeof d !== "object") return { ok: false, error: "Directo inválido." };
    const m = Number(d.monto);
    if (!Number.isInteger(m) || m % 1000000 !== 0 || m < DIRECTO_MIN || m > DIRECTO_MAX) {
      return { ok: false, error: "El monto del directo va de ₡" + DIRECTO_MIN / 1e6 + " a ₡" + DIRECTO_MAX / 1e6 + " millones, en millones enteros." };
    }
    directo = { on: d.on !== false, monto: m };
  }
  return { ok: true, reparto: { on: entrada.on === true, agentes, directo } };
}

/** La vuelta expandida: [jc, jc, jc, jose, cristian]. */
export function vuelta(reparto) {
  const v = [];
  for (const a of (reparto && reparto.agentes) || []) for (let k = 0; k < a.peso; k++) v.push(a.email);
  return v;
}

/** Huella de la lista y los pesos: si cambia, la vuelta se reacomoda con posTrasCambio. */
export function firmaReparto(reparto) {
  const base = ((reparto && reparto.agentes) || []).map((a) => a.email + ":" + a.peso).join("|");
  return createHash("sha256").update(base).digest("base64url").slice(0, 16);
}

/**
 * JC, 12 nov 2026: "que no reinicie cuando guardo el reparto". El turno guarda a quien le
 * toco la ultima (`ultimo`) y cuantas de su tanda lleva (`k`). Si la lista o los pesos
 * cambiaron, la vuelta nueva sigue desde ahi: si todavia le quedan de su tanda, le toca a
 * el; si ya completo (o le bajaron el numero), al siguiente de la lista. Solo si ese agente
 * ya no esta en la vuelta (lo quitaron o quedo en 0) arranca desde el primero.
 * La MISMA cuenta la hace el panel (js/cotizar-agente.js, _cotzPosTrasCambio) para la vista previa.
 * @param {string[]} v  la vuelta nueva expandida
 * @param {{ultimo?:string, k?:number}|null} turno
 */
export function posTrasCambio(v, turno) {
  const u = turno && normCorreo(turno.ultimo);
  const ini = u ? v.indexOf(u) : -1;
  if (ini < 0) return 0;
  const peso = v.lastIndexOf(u) - ini + 1;
  const k = Number.isInteger(turno.k) && turno.k > 0 ? turno.k : peso;
  return k < peso ? ini + k : (ini + peso) % v.length;
}

/**
 * A quien le toco la ultima solicitud, sacado del turno guardado. Los turnos guardados
 * antes del 12 nov 2026 no traen `ultimo`: se deduce de la posicion si la firma calza.
 */
export function ultimoDe(reparto, turno) {
  if (!turno) return null;
  if (turno.ultimo) return { ultimo: normCorreo(turno.ultimo), k: turno.k };
  const v = vuelta(reparto);
  if (!v.length || turno.firma !== firmaReparto(reparto) || !Number.isInteger(turno.pos)) return null;
  const p = (turno.pos - 1 + v.length) % v.length;
  return { ultimo: v[p], k: p - v.indexOf(v[p]) + 1 };
}

/**
 * A quien le toca la proxima solicitud.
 * @param {object} p
 * @param {object} p.reparto  {on, agentes}
 * @param {object|null} p.turno  {pos, firma} guardado
 * @param {(email:string)=>boolean} p.tieneFicha
 * @param {string} p.admin
 * @param {number} [p.valor]  valor del vehiculo en colones; igual o mayor al monto del directo (si esta encendido) → al admin
 * @returns {{email:string, n:number, de:number, repartido:boolean, directo?:boolean, sinAsignar?:boolean, turno:{pos:number, firma:string}|null}}
 *   turno = lo que hay que guardar (null si no se mueve la vuelta).
 */
export function elegir({ reparto, turno, tieneFicha, admin, valor }) {
  const adm = normCorreo(admin);
  const v = reparto && reparto.on ? vuelta(reparto) : [];
  const dir = directoDe(reparto);
  if (dir.on && Number(valor) >= dir.monto) return { email: adm, n: 0, de: v.length, repartido: false, directo: true, turno: null };
  if (Number(valor) < TOPE_MANUAL) return { email: "", n: 0, de: v.length, repartido: false, sinAsignar: true, turno: null };
  if (!v.length) return { email: adm, n: 0, de: 0, repartido: false, turno: null };
  const firma = firmaReparto(reparto);
  const pos = turno && turno.firma === firma && Number.isInteger(turno.pos) && turno.pos >= 0 ? turno.pos % v.length : posTrasCambio(v, turno);
  for (let i = 0; i < v.length; i++) {
    const p = (pos + i) % v.length;
    if (tieneFicha(v[p])) return { email: v[p], n: p + 1, de: v.length, repartido: true, turno: { pos: (p + 1) % v.length, firma, ultimo: v[p], k: p - v.indexOf(v[p]) + 1 } };
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
