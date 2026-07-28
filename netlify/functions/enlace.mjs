// =====================================================================
// Enlace corto de la guia explicada  ·  /g  y  /g/:id
// ---------------------------------------------------------------------
// POR QUE EXISTE (28 jul 2026): el link de la guia lleva hasta 13
// parametros (agente, cliente, vehiculo, placa, valor, tres precios...)
// y ronda los 230 caracteres. WhatsApp lo colapsa con "Leer mas" y lo
// parte a la mitad; el cliente termina abriendo un link roto o el
// explicador sin sus datos. Ahora el enlace es:
//
//     https://cotizador.appsegurosdigitales.com/g/K7M4PQ2XRB   (~54 chars)
//
// La URL larga sigue existiendo y sigue funcionando: esto es un alias
// que redirige a ella. Los links ya enviados NO se rompen.
//
// El CORREO y el HISTORIAL mantienen a proposito el link largo: el boton
// del correo lo esconde igual, y history.js parsea `va` y `p` del
// guideUrl para reconstruir el valor y la placa de entradas viejas
// (historyEntryValue / historyEntryPlate). Acortar ahi romperia el 📊.
// Se acorta SOLO donde el cliente ve la URL cruda: WhatsApp y Copiar.
//
// Modelo de seguridad: identico al del link largo — quien tiene el
// enlace ve la guia. El id son 10 caracteres de un alfabeto de 32
// (32^10 = 1,1 x 10^15): no se adivina ni se enumera. El destino SIEMPRE
// se arma del lado del servidor sobre /explicacion/ de este mismo sitio,
// asi que esto no puede convertirse en un redirector abierto.
// =====================================================================

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

export const config = { path: ["/g", "/g/:id"] };

// Sin 0/O/1/I: un id leido en voz alta o tecleado no se presta a confusion.
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LARGO_ID = 10;
const RE_ID = /^[A-Z2-9]{10}$/;
const DESTINO = "/explicacion/";
const MAX_QS = 2000;

// Lista blanca de parametros del explicador (ver _buildGuideUrl en
// js/email-template.js). Cualquier clave fuera de aca hace que el enlace
// se rechace: sin esto el endpoint seria un almacen abierto para cualquiera.
const CLAVES = new Set([
  "n", "l", "w", "a",                       // agente
  "c", "v", "p", "y", "vt", "og", "ag",     // cliente y vehiculo
  "va", "sr", "dd", "pa", "ps", "pt",       // valor, repuestos, precios
]);

const store = () => getStore({ name: "enlaces-guia", consistency: "strong" });

function nuevoId() {
  // 256 / 32 = 8 exacto: el modulo no sesga hacia ninguna letra.
  let id = "";
  for (const b of randomBytes(LARGO_ID)) id += ALFABETO[b % ALFABETO.length];
  return id;
}

/** Solo se guarda algo que de verdad parece un link de guia nuestro. */
function esNuestro(qs) {
  if (typeof qs !== "string") return false;
  if (qs.length < 3 || qs.length > MAX_QS) return false;
  let params;
  try {
    params = new URLSearchParams(qs);
  } catch {
    return false;
  }
  const claves = [...params.keys()];
  if (!claves.length) return false;
  return claves.every((k) => CLAVES.has(k));
}

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async function handler(req) {
  const url = new URL(req.url);

  // ---- GET /g/:id  → redirige a la guia larga -----------------------
  if (req.method === "GET") {
    const id = url.pathname.split("/").filter(Boolean)[1] || "";
    if (!RE_ID.test(id)) return new Response("Enlace no valido.", { status: 404 });

    let qs = null;
    try {
      qs = await store().get(id);
    } catch (e) {
      console.error("[enlace] no se pudo leer el store", e);
      return new Response("No se pudo abrir el enlace. Intenta de nuevo.", { status: 503 });
    }
    if (!qs) return new Response("Este enlace no existe o expiro.", { status: 404 });

    // El destino se arma aca, del lado del servidor, sobre nuestro propio
    // sitio: lo guardado es SOLO el query string, nunca un host.
    return new Response(null, {
      status: 302,
      headers: { location: DESTINO + "?" + qs, "cache-control": "no-store" },
    });
  }

  // ---- POST /g  → crea el id corto ----------------------------------
  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo invalido." });
  }

  const qs = String(body.q || "").replace(/^[?&]+/, "");
  if (!esNuestro(qs)) return json(400, { error: "Ese enlace no corresponde a una guia." });

  try {
    const s = store();
    // Mismo query string = mismo id: reenviar la misma cotizacion no
    // ensucia el store con un alias nuevo cada vez.
    const huella = "h:" + Buffer.from(qs).toString("base64url").slice(0, 120);
    const previo = await s.get(huella);
    if (previo && RE_ID.test(previo)) return json(200, { id: previo, reusado: true });

    const id = nuevoId();
    await s.set(id, qs);
    await s.set(huella, id);
    return json(200, { id, reusado: false });
  } catch (e) {
    console.error("[enlace] no se pudo guardar", e);
    // Que falle el acortador NUNCA debe impedir compartir: el front se
    // queda con el link largo, que funciona igual.
    return json(503, { error: "No se pudo acortar el enlace." });
  }
}
