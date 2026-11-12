// =====================================================================
// Formulario propio de COTIZACION con reparto entre agentes (5 nov 2026) · LOGICA
// La Function (netlify/functions/cotizar.mjs) solo le inyecta Netlify Blobs:
// asi el test corre con Node pelado, sin node_modules.
// ---------------------------------------------------------------------
//   POST /cotizar/enviar  · la solicitud del cliente (pagina /cotizar/)
//   POST /cotizar/agente  · lo del ⚙ de los agentes, por `accion`:
//       consulta  {email}            → ¿esta en el reparto? ¿es el admin? (sin sesion)
//       ficha     {token, ficha}     → guarda nombre/licencia/WhatsApp del agente
//       ver       {token}            → el reparto (solo el admin)
//       guardar   {token, reparto}   → cambia el reparto (solo el admin)
//
// SOLO orquesta: la logica vive en lib/cotizar-*.mjs y lib/google-sesion.mjs.
//
// PRIVACIDAD: las respuestas del cliente NO se guardan en Netlify ni van a
// los logs. Viajan en el aviso al agente y en la fila de la hoja de registro de
// JC (Apps Script en su cuenta). En Blobs quedan: el reparto, el turno, las
// fichas de los agentes (sus propios datos) y huellas/contadores del limite.
//
// FAIL-CLOSED: sin CITA_API_KEY / CITA_FROM / COTIZAR_ADMIN responde 503 y la
// pagina le ofrece al cliente el Google Form de siempre.
// Variables opcionales: COTIZAR_REGISTRO_URL + COTIZAR_REGISTRO_CLAVE (sin
// ellas no se anota en la hoja, pero los correos salen igual).
//
// Orden: hoja → agente (6 nov 2026: al cliente ya no le sale correo). El del AGENTE es el que no se puede perder:
// si falla → 502 (el cliente ve el Google Form de respaldo).
//
// ALARMAS (JC, 8 nov 2026):
//   · Por falla: si la hoja no confirma o el correo al agente no sale, le llega a JC
//     (COTIZAR_ADMIN) un correo «⚠ Alerta» con la solicitud completa, para que no se pierda.
//   · Por silencio: cada solicitud valida anota la hora en Blobs (clave `ultima`, solo
//     la hora, ningun dato del cliente). La revisa cada hora lib/cotizar-vigia.mjs.
// =====================================================================
import { validarCotizacion, validarFicha, vehiculoCorto } from "./cotizar-validacion.mjs";
import { correoAgente, filaRegistro, lineaCargo } from "./cotizar-correos.mjs";
import { siguienteHabil } from "./horario.mjs";
import { normalizarReparto, elegir, proximos, normCorreo, directoDe, ultimoDe, TOPE_MANUAL, DIRECTO_MIN, DIRECTO_MAX } from "./cotizar-reparto.mjs";
import { correoDeSesion } from "./google-sesion.mjs";
import { huella, cubeta, permitir, esDuplicado } from "./cita-limite.mjs";
import {
  abrirStore, leerReparto, guardarReparto, leerTurno, guardarTurno,
  leerFichas, guardarFicha, puedeTenerFicha, tieneCita, firmaDe,
} from "./agentes.mjs";
import { ORIGENES, json, origenPermitido, ipDe, visible, direccionDe, enviarCorreo } from "./http.mjs";

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MAX_IP = 6, MAX_DESTINO = 3, MAX_CONSULTAS = 30;
/** Si al que le toca no tiene ficha (no deberia pasar: elegir() lo salta), firma la marca. */
const SIN_FICHA = { nombre: "Seguros Digitales INS", licencia: "" };

/** "5 nov 2026, 8:14 a. m." en hora de Costa Rica. */
export const fechaCR = (now) => new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
}).format(now).replace(/\./g, "").replace(/\s+/g, " ");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-11 · noviembre" en hora de Costa Rica: la columna Mes de la hoja (filtra y ordena bien). */
export const mesCR = (now) => {
  const cr = new Date(now.getTime() - 6 * 3600 * 1000);   // CR es UTC-6 todo el año (sin horario de verano)
  const m = cr.getUTCMonth();
  return cr.getUTCFullYear() + "-" + String(m + 1).padStart(2, "0") + " · " + MESES[m];
};

/**
 * Fabrica del handler: las dependencias se inyectan para el test.
 * @param {{getStore?:Function, fetchFn?:Function, env?:object, ahora?:()=>Date}} deps
 */
export function crearHandler(deps = {}) {
  const getStore = deps.getStore;
  const fetchFn = deps.fetchFn || fetch;
  const env = deps.env || process.env;
  const ahora = deps.ahora || (() => new Date());

  async function vistaAdmin(store, admin) {
    const reparto = await leerReparto(store, admin);
    const [turno, todas] = await Promise.all([leerTurno(store), leerFichas(store, reparto.agentes.map((a) => a.email))]);
    const fichas = {};
    for (const [e, f] of Object.entries(todas)) fichas[e] = f ? { nombre: f.nombre, licencia: f.licencia, whatsapp: f.whatsapp, porAdmin: !!f.porAdmin, actualizado: f.actualizado } : null;
    const directo = directoDe(reparto);
    return { reparto: { ...reparto, directo }, fichas, directo, tope: directo.monto, topeManual: TOPE_MANUAL, directoMin: DIRECTO_MIN, directoMax: DIRECTO_MAX, proximos: proximos(reparto, turno, 10, (e) => !!fichas[e], admin), ultimo: ultimoDe(reparto, turno), actualizado: reparto.actualizado || null };
  }

  // ------------------------------------------------------------ ⚙ agentes
  async function agente(body, store, admin, ip) {
    const accion = body && body.accion;
    if (accion === "consulta") {
      if (!(await permitir(store, "lim:c:" + huella(ip) + ":" + cubeta(ahora()), MAX_CONSULTAS))) return json(429, { error: "Demasiadas consultas." });
      const email = normCorreo(body.email);
      const reparto = await leerReparto(store, admin);
      // cita: tiene el formulario de cita activo. Su ficha firma tambien esas confirmaciones.
      return json(200, { enReparto: reparto.agentes.some((a) => a.email === email), admin: !!email && email === admin, cita: tieneCita(email, env) });
    }
    if (!["ficha", "ver", "guardar"].includes(accion)) return json(400, { error: "Acción desconocida." });
    if (!(await permitir(store, "lim:s:" + huella(ip) + ":" + cubeta(ahora()), MAX_CONSULTAS))) return json(429, { error: "Demasiadas consultas." });
    const email = await correoDeSesion(body.token, { clientId: env.COTIZAR_GOOGLE_CLIENT_ID || undefined, fetchFn });
    if (!email) return json(401, { error: "Tu sesión de Google no es válida. Volvé a entrar." });

    if (accion === "ficha" && body.para) {
      // 8 nov 2026: el admin le pone la ficha a un agente que NO usa el cotizador (Melanie
      // trabaja desde Gmail). Solo a alguien del reparto ya guardado. Si esa persona guarda
      // despues su propio ⚙, su ficha reemplaza a esta.
      if (email !== admin) return json(403, { error: "Solo el administrador pone la ficha de otro agente." });
      const para = normCorreo(body.para);
      const reparto = await leerReparto(store, admin);
      if (!reparto.agentes.some((a) => a.email === para)) return json(400, { error: "Primero guardá el reparto con ese correo." });
      const v = validarFicha(body.ficha);
      if (!v.ok) return json(400, { error: v.error });
      await guardarFicha(store, para, { ...v.ficha, porAdmin: true }, ahora());
      return json(200, await vistaAdmin(store, admin));
    }
    if (accion === "ficha") {
      if (!puedeTenerFicha(email, { admin, reparto: await leerReparto(store, admin), env })) return json(403, { error: "Tu correo no está en el reparto de cotizaciones." });
      const v = validarFicha(body.ficha);
      if (!v.ok) return json(400, { error: v.error });
      await guardarFicha(store, email, v.ficha, ahora());
      return json(200, { ok: true, email });
    }
    if (email !== admin) return json(403, { error: "Solo el administrador ve el reparto." });
    if (accion === "guardar") {
      // Un panel viejo (en cache) no manda `directo`: se conserva el guardado, no se vuelve a 15M.
      let entrada = body.reparto;
      if (entrada && typeof entrada === "object" && entrada.directo === undefined) entrada = { ...entrada, directo: directoDe(await leerReparto(store, admin)) };
      const n = normalizarReparto(entrada, admin);
      if (!n.ok) return json(400, { error: n.error });
      // 12 nov 2026: antes de cambiar la lista, el turno anota a quien le toco la ultima,
      // para que la vuelta nueva siga desde ahi (los turnos viejos no lo traian).
      try {
        const [viejo, t] = await Promise.all([leerReparto(store, admin), leerTurno(store)]);
        const u = ultimoDe(viejo, t);
        if (u && t && !t.ultimo) await guardarTurno(store, { ...t, ...u });
      } catch (e) { console.error("[cotizar] turno no anotado", e && e.message); }
      await guardarReparto(store, n.reparto, ahora());
    }
    return json(200, await vistaAdmin(store, admin));
  }

  /**
   * Alarma por falla: a JC le llega la solicitud completa con lo que fallo arriba.
   * 🔴 NUNCA dice a que agente le toco (JC, 8 nov 2026: privacidad interna). Solo que fallo.
   * Va firmada como si fuera para el (su WhatsApp abre con su nombre). Si tampoco sale, queda en el log.
   */
  async function alertar(apiKey, remite, admin, firmaAdmin, motivo, d, info) {
    const am = correoAgente(d, { ...info, agente: firmaAdmin });
    const banda = '<div style="background:#FCE8E6;border:1px solid #D93025;color:#A50E0E;border-radius:8px;padding:12px 16px;margin:0 0 12px;font:600 14px Arial,sans-serif;">⚠ ' + escHtml(motivo) + "</div>";
    try {
      await enviarCorreo(fetchFn, apiKey, {
        from: "Alertas · SDI <" + remite + ">", to: [admin], reply_to: d.correo,
        subject: "⚠ Alerta del formulario de cotización · " + vehiculoCorto(d), html: banda + am.html, text: "⚠ " + motivo + "\n\n" + am.texto,
      });
      return true;
    } catch (e) { console.error("[cotizar] la alerta tampoco salio", e && e.message); return false; }
  }

  // ------------------------------------------------------------ cliente
  async function solicitud(body, store, admin, ip, apiKey, from) {
    const v = validarCotizacion(body);
    if (v.trampa) return json(200, { ok: true });   // robot: se finge exito
    if (!v.ok) { console.warn("[cotizar] rechazada", v.campo); return json(v.estado || 400, { error: v.error, campo: v.campo }); }
    const d = v.datos;
    const now = ahora();

    try {
      if (await esDuplicado(store, huella([d.correo, vehiculoCorto(d)].join("|")), now)) return json(200, { ok: true, repetida: true });
      const c = cubeta(now);
      if (!(await permitir(store, "lim:ip:" + huella(ip) + ":" + c, MAX_IP)) || !(await permitir(store, "lim:to:" + huella(d.correo) + ":" + c, MAX_DESTINO))) {
        return json(429, { error: "Demasiadas solicitudes. Probá de nuevo más tarde." });
      }
    } catch (e) { console.error("[cotizar] limite no disponible", e && e.message); }
    // Alarma por silencio: la hora de la ultima solicitud (sin datos del cliente).
    try { await store.set("ultima", now.toISOString()); } catch (e) { console.error("[cotizar] ultima no guardada", e && e.message); }

    // ¿A quien le toca? Sin candado: si dos solicitudes caen en el mismo instante pueden
    // tocarle al mismo agente; la vuelta se acomoda sola en las siguientes (se acepta).
    const reparto = await leerReparto(store, admin);
    const [turno, fichas] = await Promise.all([leerTurno(store), leerFichas(store, [admin, ...reparto.agentes.map((a) => a.email)])]);
    const sel = elegir({ reparto, turno, admin, valor: d.valor, tieneFicha: (e) => !!fichas[e] });
    if (sel.turno) { try { await guardarTurno(store, sel.turno); } catch (e) { console.error("[cotizar] turno no guardado", e && e.message); } }
    // Menos de TOPE_MANUAL: no se le asigna a nadie, JC la asigna por otro medio desde la hoja.
    const ag = sel.sinAsignar ? { email: "", nombre: "Sin asignar", licencia: "", telefono: "", whatsapp: "", cargo: "", oficina: "" }
      : firmaDe(sel.email, fichas[sel.email]) || firmaDe(sel.email, SIN_FICHA);
    const info = { agente: ag, n: sel.n, de: sel.de, repartido: sel.repartido, directo: !!sel.directo, topeDirecto: directoDe(reparto).monto, sinAsignar: !!sel.sinAsignar, fecha: fechaCR(now), mes: mesCR(now), registrada: false };

    const remite = "cotizaciones@" + direccionDe(from).split("@")[1];
    // 6 nov 2026 (JC): ya no sale correo al cliente. La pantalla final le dice cuando le llega la cotizacion.

    if (env.COTIZAR_REGISTRO_URL && env.COTIZAR_REGISTRO_CLAVE) {
      try {
        const r = await fetchFn(env.COTIZAR_REGISTRO_URL, {
          method: "POST", headers: { "content-type": "application/json" }, redirect: "follow",
          body: JSON.stringify({ clave: env.COTIZAR_REGISTRO_CLAVE, fila: filaRegistro(d, info) }),
          signal: AbortSignal.timeout(6000),
        });
        const t = r.ok ? (await r.text()).trim() : "";
        info.registrada = t === "ok";
        if (!info.registrada) console.error("[cotizar] la hoja no confirmo", r.status);
      } catch (e) { console.error("[cotizar] hoja no disponible", e && e.message); }
    }

    const h = siguienteHabil(now);
    const firmaAdmin = firmaDe(admin, fichas[admin]) || firmaDe(admin, SIN_FICHA);
    const hojaFallo = !!(env.COTIZAR_REGISTRO_URL && env.COTIZAR_REGISTRO_CLAVE) && !info.registrada;
    if (info.sinAsignar) {
      // Si la hoja falla, no le llega nada a nadie, ni alerta (JC, 8 nov 2026: "esas las vemos
      // despues"; y de noche: "no me interesa la alerta de los menos de 4.000.000"). Solo el log.
      if (hojaFallo) console.error("[cotizar] sin asignar y la hoja no la anoto");
      return json(200, { ok: true, enHorario: h.enHorario, cuando: h.cuando, agente: null });
    }
    const am = correoAgente(d, info);
    try {
      await enviarCorreo(fetchFn, apiKey, { from: "Cotizaciones · SDI <" + remite + ">", to: [ag.email], reply_to: d.correo, subject: am.asunto, html: am.html, text: am.texto });
    } catch (e) {
      console.error("[cotizar] no salio el del agente", e && e.message);
      await alertar(apiKey, remite, admin, firmaAdmin, "Falló el envío de esta solicitud: no salió el aviso. El cliente vio un error y se le ofreció el formulario de respaldo; puede que la mande de nuevo. Acá van sus datos." + (hojaFallo ? " Tampoco quedó en la hoja de registro." : ""), d, info);
      return json(502, { error: "No pudimos enviar tu solicitud." });
    }
    if (hojaFallo) await alertar(apiKey, remite, admin, firmaAdmin, "Falló el registro: la hoja no anotó esta solicitud. Acá van los datos para que la anotés.", d, info);
    return json(200, { ok: true, enHorario: h.enHorario, cuando: h.cuando, agente: { nombre: ag.nombre, cargo: lineaCargo(ag) } });
  }

  return async function handler(req, context) {
    if (req.method !== "POST") return json(405, { error: "Usá POST." });
    if (!origenPermitido(req.headers.get("origin"), ORIGENES)) return json(403, { error: "Origen no autorizado." });

    const apiKey = env.CITA_API_KEY, from = env.CITA_FROM, admin = normCorreo(env.COTIZAR_ADMIN);
    if (!apiKey || !from || !admin) {
      console.error("[cotizar] faltan variables de entorno");
      return json(503, { error: "El formulario no está disponible." });
    }
    let body;
    try { body = await req.json(); } catch { return json(400, { error: "Cuerpo inválido." }); }
    let store;
    try { store = abrirStore(getStore); } catch (e) {
      console.error("[cotizar] sin almacenamiento", e && e.message);
      return json(503, { error: "El formulario no está disponible." });
    }
    const ip = ipDe(req, context);
    try {
      if (new URL(req.url).pathname.endsWith("/agente")) return await agente(body, store, admin, ip);
      return await solicitud(body, store, admin, ip, apiKey, from);
    } catch (e) {
      console.error("[cotizar] error", e && e.message);
      return json(500, { error: "Algo falló. Probá de nuevo." });
    }
  };
}
