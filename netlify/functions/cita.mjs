// =====================================================================
// POST /cita/enviar  ·  solicitud de cita de aseguramiento (19 set 2026)
// ---------------------------------------------------------------------
// Reemplaza al Google Form para los agentes en modo "Formulario SDI".
// SOLO orquesta: validar → limitar → firmar → armar → enviar. La logica vive en lib/.
//
// PRIVACIDAD: no se persiste ninguna respuesta y NO se escriben en los logs.
// En Blobs quedan solo huellas y contadores (lib/cita-limite.mjs).
//
// FIRMA (5 nov 2026): el nombre, la licencia, el telefono y el cargo del agente
// salen de su ficha en el servidor (lib/agentes.mjs), nunca del navegador: con
// solo el correo de un agente se podia mandar desde nuestro dominio un correo con
// otro remitente y otro telefono. Agente sin ficha → 503 (no se envia).
//
// FAIL-CLOSED: sin CITA_API_KEY / CITA_FROM / CITA_AGENTES responde 503 y el
// front le ofrece al cliente el WhatsApp del agente. Nada de valores por
// defecto en el codigo.
//
// Orden de envio: primero la confirmacion al cliente y despues el aviso al
// AGENTE (el que no se puede perder; lleva si el cliente quedo avisado). Si el
// del agente falla → 502. Si solo falla el del cliente → 200 con clienteAvisado:false.
// =====================================================================
import { getStore } from "@netlify/blobs";
import { validarCita, agentesAutorizados } from "./lib/cita-validacion.mjs";
import { correoCliente, correoAgente } from "./lib/cita-correos.mjs";
import { huella, cubeta, permitir, esDuplicado } from "./lib/cita-limite.mjs";
import { abrirStore, leerFicha, firmaDe } from "./lib/agentes.mjs";
import { ORIGENES, json, origenPermitido, ipDe, visible, direccionDe, enviarCorreo } from "./lib/http.mjs";

export const config = { path: "/cita/enviar" };

const PERMITIDOS = [...ORIGENES, "https://guia.appsegurosdigitales.com"];
const MAX_IP = 6, MAX_DESTINO = 3;

export default async function handler(req, context) {
  if (req.method !== "POST") return json(405, { error: "Usá POST." });
  if (!origenPermitido(req.headers.get("origin"), PERMITIDOS)) return json(403, { error: "Origen no autorizado." });

  const apiKey = process.env.CITA_API_KEY, from = process.env.CITA_FROM;
  const agentes = agentesAutorizados(process.env.CITA_AGENTES);
  if (!apiKey || !from || !agentes.size) {
    console.error("[cita] faltan variables de entorno");
    return json(503, { error: "El formulario no está disponible." });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Cuerpo inválido." }); }

  const ahora = new Date();
  const ip = ipDe(req, context);
  let store;
  try { store = getStore({ name: "cita-limite", consistency: "strong" }); } catch { store = null; }

  // Consulta del ⚙: ¿este agente puede activar el formulario? No envia nada.
  if (body && body.verificar === true) {
    if (store && !(await permitir(store, "v:" + huella(ip) + ":" + cubeta(ahora), 20))) return json(429, { error: "Demasiadas consultas." });
    return json(200, { autorizado: agentes.has(String(body.ae || "").trim().toLowerCase()) });
  }

  const v = validarCita(body, { agentes, now: ahora });
  if (v.trampa) return json(200, { ok: true, clienteAvisado: true });   // robot: se finge exito
  if (!v.ok) {
    // Rastro MINIMO del rechazo (19 set 2026: a un agente le fallaba y no habia como saber por que).
    // Solo el campo y el estado. Del cuerpo se anota UNICAMENTE el correo del AGENTE cuando ese es el
    // motivo (no esta en CITA_AGENTES): es dato del agente, no del cliente. Nada mas del cuerpo se loguea.
    const agenteRechazado = v.campo === "ae" ? String((body && body.ae) || "").slice(0, 80).replace(/[\r\n]/g, "") : "";
    console.warn("[cita] rechazada", v.estado || 400, v.campo, agenteRechazado);
    return json(v.estado || 400, { error: v.error, campo: v.campo });
  }
  const d = v.datos;

  let ag = null;
  try { ag = firmaDe(d.ae, await leerFicha(abrirStore(getStore), d.ae)); }
  catch (e) { console.error("[cita] fichas no disponibles", e && e.message); }
  if (!ag) {
    console.warn("[cita] agente sin ficha", d.ae);
    return json(503, { error: "El formulario no está disponible." });
  }

  if (store) {
    try {
      if (await esDuplicado(store, huella([d.correo, d.placa, d.fecha, d.franja].join("|")), ahora)) return json(200, { ok: true, clienteAvisado: true, repetida: true });
      const c = cubeta(ahora);
      if (!(await permitir(store, "ip:" + huella(ip) + ":" + c, MAX_IP)) || !(await permitir(store, "to:" + huella(d.correo) + ":" + c, MAX_DESTINO))) {
        return json(429, { error: "Demasiadas solicitudes. Probá de nuevo más tarde." });
      }
    } catch (e) {
      console.error("[cita] limite no disponible", e && e.message);   // el limite caido no bloquea una cita real
    }
  }

  const dir = direccionDe(from);
  const cl = correoCliente(d, ag);
  let clienteAvisado = true;
  try {
    await enviarCorreo(fetch, apiKey, { from: visible(ag.nombre) + " · Seguros del INS <" + dir + ">", to: [d.correo], reply_to: ag.email, subject: cl.asunto, html: cl.html, text: cl.texto });
  } catch (e) { clienteAvisado = false; console.error("[cita] no salio el del cliente", e && e.message); }

  const am = correoAgente(d, ag, { clienteAvisado });
  try {
    await enviarCorreo(fetch, apiKey, { from: "Citas · SDI Seguros Digitales INS <" + dir + ">", to: [ag.email], reply_to: d.correo, subject: am.asunto, html: am.html, text: am.texto });
  } catch (e) {
    console.error("[cita] no salio el del agente", e && e.message);
    return json(502, { error: "No pudimos enviar tu solicitud." });
  }
  return json(200, { ok: true, clienteAvisado });
}
