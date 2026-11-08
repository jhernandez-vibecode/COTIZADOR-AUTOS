// =====================================================================
// Horario de oficina y siguiente dia habil, en hora de Costa Rica (5 nov 2026)
// ---------------------------------------------------------------------
// Lo usa la pantalla final de /cotizar/ (lib/cotizar-handler.mjs, 6 nov 2026; antes el correo al cliente):
// si la solicitud entra fuera de horario, el correo le dice que la cotizacion
// le llega el siguiente dia habil.
//   Horario: lunes a viernes, de 8:00 am a 5:00 pm (hora de Costa Rica, UTC-6, sin
//   cambio de horario).
//   Feriados: los de pago OBLIGATORIO del art. 148 del Codigo de Trabajo:
//   1 ene, Jueves y Viernes Santo, 11 abr, 1 may, 25 jul, 15 ago, 15 sep, 1 dic, 25 dic.
//   Los no obligatorios (2 ago, 31 ago, 12 oct) cuentan como dia habil.
// =====================================================================

export const HORARIO = { abre: 8, cierra: 17, texto: "lunes a viernes, de 8:00 am a 5:00 pm" };
const FIJOS = ["01-01", "04-11", "05-01", "07-25", "08-15", "09-15", "12-01", "12-25"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher), como Date en UTC. */
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
}
const dosDig = (n) => String(n).padStart(2, "0");
const clave = (t) => dosDig(t.getUTCMonth() + 1) + "-" + dosDig(t.getUTCDate());
const mismoDia = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

/** ¿Es feriado obligatorio? `t` es un Date cuyos getters UTC dan la fecha de Costa Rica. */
export function esFeriado(t) {
  if (FIJOS.includes(clave(t))) return true;
  const p = pascua(t.getUTCFullYear());
  const jueves = new Date(p.getTime() - 3 * 864e5), viernes = new Date(p.getTime() - 2 * 864e5);
  return mismoDia(t, jueves) || mismoDia(t, viernes);
}
export const esHabil = (t) => t.getUTCDay() >= 1 && t.getUTCDay() <= 5 && !esFeriado(t);

/**
 * ¿Entra en horario? Si no, ¿qué día le llega la cotización?
 * @param {Date} ahora
 * @returns {{enHorario:boolean, cuando:string}}  cuando: "hoy", "mañana viernes 6 de noviembre", "el lunes 9 de noviembre"
 */
export function siguienteHabil(ahora) {
  const cr = new Date(ahora.getTime() - 6 * 3600e3);   // getters UTC = hora de Costa Rica
  const hora = cr.getUTCHours();
  if (esHabil(cr) && hora >= HORARIO.abre && hora < HORARIO.cierra) return { enHorario: true, cuando: "hoy" };
  let t = new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()));
  const hoy = t;
  if (!(esHabil(t) && hora < HORARIO.abre)) {
    do { t = new Date(t.getTime() + 864e5); } while (!esHabil(t));
  }
  const fecha = DIAS[t.getUTCDay()] + " " + t.getUTCDate() + " de " + MESES[t.getUTCMonth()];
  const dif = Math.round((t - hoy) / 864e5);
  return { enHorario: false, cuando: dif === 0 ? "hoy " + fecha + ", a partir de las 8:00 am" : dif === 1 ? "mañana " + fecha : "el " + fecha };
}
