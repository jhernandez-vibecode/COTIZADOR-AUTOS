// =====================================================================
// Validacion de la solicitud de cita  ·  la usa netlify/functions/cita.mjs
// ---------------------------------------------------------------------
// Pura y sin @netlify/blobs: tests/test-cita-validacion.mjs corre con Node
// pelado. Las opciones cerradas son las del Google Form de origen (18 set
// 2026), palabra por palabra: si cambian aca, cambian en cita/index.html.
// =====================================================================

// Unica fuente de los planes de asistencia (CommonJS con guard de module).
import planesMod from "../../../js/planes-asistencia.js";
const IDS_PLANES = new Set((planesMod.PLANES_ASI || []).map((p) => p.id));

export const FORMAS = ["Anual", "Semestral", "Trimestral"];
export const FRANJAS = ["8:00 am a 10:00 am", "10:00 am a 12:00 md", "01:00 pm a 03:00 pm", "03:00 pm a 05:00 pm"];
export const INGRESOS = [
  "Menos de ₡500.000", "De ₡500.000 a ₡1.000.000", "De ₡1.000.000 a ₡2.000.000",
  "De ₡2.000.000 a ₡4.000.000", "Más de ₡4.000.000",
];

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Retorno, salto y NUL revientan cabeceras. El ESPACIO NO va aca: todo nombre
// real trae espacios (misma trampa que lib/validacion.mjs). NUL escapado a proposito.
const RE_CONTROL = /[\r\n\u0000]/;

/** Hoy en Costa Rica como AAAA-MM-DD (en-CA da ese formato). */
export function hoyCR(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(now);
}

/** Fecha de calendario real o null. */
function partesFecha(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return t;
}

export function esDiaHabil(f) {
  const t = partesFecha(f);
  if (!t) return false;
  const dow = t.getUTCDay();
  return dow >= 1 && dow <= 5;
}

export function agentesAutorizados(env) {
  return new Set(String(env || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

const malo = (campo, error, estado = 400) => ({ ok: false, estado, campo, error });

/**
 * @param {object} body  el JSON del POST
 * @param {{agentes:Set<string>, now?:Date}} ctx
 * @returns {{ok:true, datos:object} | {ok:false, estado:number, campo:string, error:string} | {ok:false, trampa:true}}
 */
export function validarCita(body, ctx) {
  if (!body || typeof body !== "object") return malo("cuerpo", "Cuerpo inválido.");
  const agentes = (ctx && ctx.agentes) || new Set();
  const now = (ctx && ctx.now) || new Date();

  // Campo trampa: un humano no lo ve. Lleno = robot → se finge exito y no se envia.
  if (String(body.sitio || "").trim() !== "") return { ok: false, trampa: true };

  const linea = (k, max) => {
    const s = String(body[k] == null ? "" : body[k]).trim();
    if (RE_CONTROL.test(s)) return { err: true };
    if (s.length > max) return { err: true };
    return { s };
  };
  const d = {};

  // Una linea, con tope. [campo, tope, obligatorio]
  const LINEAS = [
    ["nombre", 120, true], ["telefono", 80, true], ["correo", 80, true], ["ocupacion", 80, false],
    ["placa", 80, true], ["n", 120, true], ["l", 80, true], ["tel", 80, false], ["wa", 80, false],
    ["ae", 80, true], ["c", 80, false], ["v", 80, false], ["y", 8, false],
    ["pa", 16, false], ["ps", 16, false], ["pt", 16, false],
  ];
  for (const [k, max, oblig] of LINEAS) {
    const r = linea(k, max);
    if (r.err) return malo(k, "Revisá el campo " + k + ".");
    if (oblig && !r.s) return malo(k, "Falta el campo " + k + ".");
    d[k] = r.s;
  }

  // La direccion es un parrafo: admite saltos de linea, no NUL.
  const dir = String(body.direccion == null ? "" : body.direccion).trim();
  if (!dir) return malo("direccion", "Falta la dirección.");
  if (dir.length > 400 || /\u0000/.test(dir)) return malo("direccion", "Revisá la dirección.");
  d.direccion = dir;

  if (d.telefono.replace(/\D/g, "").length < 8) return malo("telefono", "El teléfono debe tener al menos 8 dígitos.");
  if (!RE_CORREO.test(d.correo)) return malo("correo", "Revisá el correo electrónico.");

  const opcion = (k, lista, oblig) => {
    const s = String(body[k] == null ? "" : body[k]).trim();
    if (!s) return oblig ? null : "";
    return lista.includes(s) ? s : null;
  };
  d.formaPago = opcion("formaPago", FORMAS, true);
  if (d.formaPago === null) return malo("formaPago", "Elegí la forma de pago.");
  d.franja = opcion("franja", FRANJAS, true);
  if (d.franja === null) return malo("franja", "Elegí el rango de horas.");
  d.ingreso = opcion("ingreso", INGRESOS, false);
  if (d.ingreso === null) return malo("ingreso", "Elegí un rango de ingreso de la lista.");

  const f = String(body.fecha || "");
  if (!partesFecha(f)) return malo("fecha", "Revisá la fecha.");
  if (f < hoyCR(now)) return malo("fecha", "La fecha ya pasó.");
  if (!esDiaHabil(f)) return malo("fecha", "Atendemos de lunes a viernes.");
  d.fecha = f;

  if (body.consent !== true) return malo("consent", "Falta autorizar el uso de los datos.");

  d.ae = d.ae.toLowerCase();
  if (!RE_CORREO.test(d.ae) || !agentes.has(d.ae)) return malo("ae", "Este agente no tiene activo el formulario.", 403);

  // Asistencias: se descarta el id desconocido, no toda la solicitud.
  d.as = [...new Set(String(body.as || "").split(".").map((s) => s.trim()).filter((s) => IDS_PLANES.has(s)))];

  return { ok: true, datos: d };
}
