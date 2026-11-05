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
// los logs. Viajan en los dos correos y en la fila de la hoja de registro de
// JC (Apps Script en su cuenta). En Blobs quedan: el reparto, el turno, las
// fichas de los agentes (sus propios datos) y huellas/contadores del limite.
//
// FAIL-CLOSED: sin CITA_API_KEY / CITA_FROM / COTIZAR_ADMIN responde 503 y la
// pagina le ofrece al cliente el Google Form de siempre.
// Variables opcionales: COTIZAR_REGISTRO_URL + COTIZAR_REGISTRO_CLAVE (sin
// ellas no se anota en la hoja, pero los correos salen igual).
//
// Orden: cliente → hoja → agente. El del AGENTE es el que no se puede perder:
// si falla → 502 (el cliente ve el Google Form de respaldo).
// =====================================================================
import { validarCotizacion, validarFicha, vehiculoCorto } from "./cotizar-validacion.mjs";
import { correoCliente, correoAgente, filaRegistro, lineaCargo } from "./cotizar-correos.mjs";
import { normalizarReparto, elegir, proximos, normCorreo } from "./cotizar-reparto.mjs";
import { correoDeSesion } from "./google-sesion.mjs";
import { huella, cubeta, permitir, esDuplicado } from "./cita-limite.mjs";
import {
  abrirStore, leerReparto, guardarReparto, leerTurno, guardarTurno,
  leerFichas, guardarFicha, puedeTenerFicha, tieneCita, firmaDe,
} from "./agentes.mjs";
import { ORIGENES, json, origenPermitido, ipDe, visible, direccionDe, enviarCorreo } from "./http.mjs";

const MAX_IP = 6, MAX_DESTINO = 3, MAX_CONSULTAS = 30;
/** Si al que le toca no tiene ficha (no deberia pasar: elegir() lo salta), firma la marca. */
const SIN_FICHA = { nombre: "Seguros Digitales INS", licencia: "" };

/** "5 nov 2026, 8:14 a. m." en hora de Costa Rica. */
export const fechaCR = (now) => new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
}).format(now).replace(/\./g, "").replace(/\s+/g, " ");

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
    for (const [e, f] of Object.entries(todas)) fichas[e] = f ? { nombre: f.nombre, licencia: f.licencia, whatsapp: f.whatsapp, actualizado: f.actualizado } : null;
    return { reparto, fichas, proximos: proximos(reparto, turno, 10, (e) => !!fichas[e], admin), actualizado: reparto.actualizado || null };
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

    if (accion === "ficha") {
      if (!puedeTenerFicha(email, { admin, reparto: await leerReparto(store, admin), env })) return json(403, { error: "Tu correo no está en el reparto de cotizaciones." });
      const v = validarFicha(body.ficha);
      if (!v.ok) return json(400, { error: v.error });
      await guardarFicha(store, email, v.ficha, ahora());
      return json(200, { ok: true, email });
    }
    if (email !== admin) return json(403, { error: "Solo el administrador ve el reparto." });
    if (accion === "guardar") {
      const n = normalizarReparto(body.reparto, admin);
      if (!n.ok) return json(400, { error: n.error });
      await guardarReparto(store, n.reparto, ahora());
    }
    return json(200, await vistaAdmin(store, admin));
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

    // ¿A quien le toca? Sin candado: si dos solicitudes caen en el mismo instante pueden
    // tocarle al mismo agente; la vuelta se acomoda sola en las siguientes (se acepta).
    const reparto = await leerReparto(store, admin);
    const [turno, fichas] = await Promise.all([leerTurno(store), leerFichas(store, [admin, ...reparto.agentes.map((a) => a.email)])]);
    const sel = elegir({ reparto, turno, admin, tieneFicha: (e) => !!fichas[e] });
    if (sel.turno) { try { await guardarTurno(store, sel.turno); } catch (e) { console.error("[cotizar] turno no guardado", e && e.message); } }
    const ag = firmaDe(sel.email, fichas[sel.email]) || firmaDe(sel.email, SIN_FICHA);
    const info = { agente: ag, n: sel.n, de: sel.de, repartido: sel.repartido, fecha: fechaCR(now), clienteAvisado: true, registrada: false };

    const remite = "cotizaciones@" + direccionDe(from).split("@")[1];
    const cl = correoCliente(d, ag);
    try {
      await enviarCorreo(fetchFn, apiKey, { from: visible(ag.nombre) + " · SDI <" + remite + ">", to: [d.correo], reply_to: ag.email, subject: cl.asunto, html: cl.html, text: cl.texto });
    } catch (e) { info.clienteAvisado = false; console.error("[cotizar] no salio el del cliente", e && e.message); }

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

    const am = correoAgente(d, info);
    try {
      await enviarCorreo(fetchFn, apiKey, { from: "Cotizaciones · SDI <" + remite + ">", to: [ag.email], reply_to: d.correo, subject: am.asunto, html: am.html, text: am.texto });
    } catch (e) {
      console.error("[cotizar] no salio el del agente", e && e.message);
      return json(502, { error: "No pudimos enviar tu solicitud." });
    }
    return json(200, { ok: true, clienteAvisado: info.clienteAvisado, agente: { nombre: ag.nombre, cargo: lineaCargo(ag) } });
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
