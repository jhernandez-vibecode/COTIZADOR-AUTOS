// =====================================================================
// POST /cita/enviar  ·  solicitud de cita de aseguramiento (19 set 2026)
// ---------------------------------------------------------------------
// Reemplaza al Google Form para los agentes en modo "Formulario SDI".
// SOLO orquesta: validar → limitar → armar → enviar. La logica vive en lib/.
//
// PRIVACIDAD: no se persiste ninguna respuesta y NO se escriben en los logs.
// En Blobs quedan solo huellas y contadores (lib/cita-limite.mjs).
//
// FAIL-CLOSED: sin CITA_API_KEY / CITA_FROM / CITA_AGENTES responde 503 y el
// front le ofrece al cliente el WhatsApp del agente. Nada de valores por
// defecto en el codigo.
//
// Orden de envio: primero el del AGENTE (el que no se puede perder). Si falla
// → 502. Si sale y falla el del cliente → 200 con clienteAvisado:false.
// =====================================================================
import { getStore } from "@netlify/blobs";
import { validarCita, agentesAutorizados } from "./lib/cita-validacion.mjs";
import { correoCliente, correoAgente } from "./lib/cita-correos.mjs";
import { huella, cubeta, permitir, esDuplicado } from "./lib/cita-limite.mjs";

export const config = { path: "/cita/enviar" };

const ORIGENES = new Set([
  "https://cotizador.appsegurosdigitales.com",
  "https://cotizador-segurosdigitalesins-sdi.netlify.app",
  "https://guia.appsegurosdigitales.com",
]);
const MAX_IP = 6, MAX_DESTINO = 3;
const API = "https://api.resend.com/emails";

const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function enviar(apiKey, msg) {
  const r = await fetch(API, {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!r.ok) throw new Error("envio " + r.status);
}

// Nombre visible del remitente: sin comillas, angulares ni controles.
const visible = (s) => String(s).replace(/["<>\r\n\u0000]/g, "").trim();

export default async function handler(req, context) {
  if (req.method !== "POST") return json(405, { error: "Usá POST." });

  const origen = req.headers.get("origin") || "";
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen);
  if (origen && !local && !ORIGENES.has(origen)) return json(403, { error: "Origen no autorizado." });

  const apiKey = process.env.CITA_API_KEY, from = process.env.CITA_FROM;
  const agentes = agentesAutorizados(process.env.CITA_AGENTES);
  if (!apiKey || !from || !agentes.size) {
    console.error("[cita] faltan variables de entorno");
    return json(503, { error: "El formulario no está disponible." });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Cuerpo inválido." }); }

  const ahora = new Date();
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "sin-ip";
  let store;
  try { store = getStore({ name: "cita-limite", consistency: "strong" }); } catch { store = null; }

  // Consulta del ⚙: ¿este agente puede activar el formulario? No envia nada.
  if (body && body.verificar === true) {
    if (store && !(await permitir(store, "v:" + huella(ip) + ":" + cubeta(ahora), 20))) return json(429, { error: "Demasiadas consultas." });
    return json(200, { autorizado: agentes.has(String(body.ae || "").trim().toLowerCase()) });
  }

  const v = validarCita(body, { agentes, now: ahora });
  if (v.trampa) return json(200, { ok: true, clienteAvisado: true });   // robot: se finge exito
  if (!v.ok) return json(v.estado || 400, { error: v.error, campo: v.campo });
  const d = v.datos;

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

  const dir = /<([^>]+)>/.exec(from) ? /<([^>]+)>/.exec(from)[1] : from;
  const cl = correoCliente(d);
  let clienteAvisado = true;
  try {
    await enviar(apiKey, { from: visible(d.n) + " · Seguros del INS <" + dir + ">", to: [d.correo], reply_to: d.ae, subject: cl.asunto, html: cl.html, text: cl.texto });
  } catch (e) { clienteAvisado = false; console.error("[cita] no salio el del cliente", e && e.message); }

  const ag = correoAgente(d, { clienteAvisado });
  try {
    await enviar(apiKey, { from: "Citas · Seguros Digitales SDI <" + dir + ">", to: [d.ae], reply_to: d.correo, subject: ag.asunto, html: ag.html, text: ag.texto });
  } catch (e) {
    console.error("[cita] no salio el del agente", e && e.message);
    return json(502, { error: "No pudimos enviar tu solicitud." });
  }
  return json(200, { ok: true, clienteAvisado });
}
