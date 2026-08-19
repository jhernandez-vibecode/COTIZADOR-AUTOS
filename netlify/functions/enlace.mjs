// =====================================================================
// Enlaces cortos  ·  /g y /g/:id  (guia de la cotizacion)
//                ·  /a y /a/:id  (guia de emergencias de la poliza)
// ---------------------------------------------------------------------
// POR QUE EXISTE (28 jul 2026): el link de la guia lleva hasta 13
// parametros (agente, cliente, vehiculo, placa, valor, tres precios...)
// y ronda los 230 caracteres. WhatsApp lo colapsa con "Leer mas" y lo
// parte a la mitad; el cliente termina abriendo un link roto o el
// explicador sin sus datos. Ahora el enlace es:
//
//     https://guia.appsegurosdigitales.com/g/K7M4PQ2XRB   (~49 chars)
//
// 19 ago 2026 - el host dejo de ser el del navegador del agente y pasa a
// ser fijo (SHORTLINK_HOST en js/shortlink.js): al cliente le llegaba
// "cotizador-...netlify.app" en el aviso de que hacer ante un accidente.
// guia.appsegurosdigitales.com es un ALIAS de este mismo sitio, asi que los
// ids viejos siguen resolviendo desde cualquiera de los hosts.
//
// 7 ago 2026 — el mismo problema en /polizas-activas/: el aviso de
// "su poliza esta lista" manda el Centro de Asistencia con la ficha del
// agente pegada (?n,tel,wa,em,lic,web), unos 180 caracteres. Ahora tiene
// su propia ruta /a/:id, del mismo largo.
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
// (32^10 = 1,1 x 10^15): no se adivina ni se enumera.
//
// ESTO NO PUEDE SER UN REDIRECTOR ABIERTO. Para /g el destino se arma
// del lado del servidor sobre /explicacion/ de este mismo sitio. Para /a
// el destino es otro sitio (la app de asistencia), asi que el host va
// contra una LISTA BLANCA cerrada: un host que no este en DESTINOS_A se
// rechaza con 400 y el front se queda con el link largo. Nunca se
// redirige a un host que venga del cliente sin estar en esa lista.
// =====================================================================

import { getStore } from "@netlify/blobs";
import { randomBytes, createHash } from "node:crypto";
// Las listas blancas y los validadores viven en lib/ para poder testearlos con
// Node pelado (este archivo no se puede importar sin @netlify/blobs instalado).
import { esNuestro, baseAsistencia, CLAVES, CLAVES_A } from "./lib/validacion.mjs";

export const config = { path: ["/g", "/g/:id", "/a", "/a/:id"] };

// Sin 0/O/1/I: un id leido en voz alta o tecleado no se presta a confusion.
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LARGO_ID = 10;
const RE_ID = /^[A-Z2-9]{10}$/;
const DESTINO = "/explicacion/";

const store = () => getStore({ name: "enlaces-guia", consistency: "strong" });

function nuevoId() {
  // 256 / 32 = 8 exacto: el modulo no sesga hacia ninguna letra.
  let id = "";
  for (const b of randomBytes(LARGO_ID)) id += ALFABETO[b % ALFABETO.length];
  return id;
}

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const redirige = (destino) =>
  new Response(null, {
    status: 302,
    headers: { location: destino, "cache-control": "no-store" },
  });

export default async function handler(req) {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  // "a" = guia de emergencias (poliza activa); "g" = guia de la cotizacion.
  const esAsistencia = (partes[0] || "").toLowerCase() === "a";

  // ---- GET /g/:id  o  /a/:id  → redirige al enlace largo --------------
  if (req.method === "GET") {
    const id = partes[1] || "";
    if (!RE_ID.test(id)) return new Response("Enlace no valido.", { status: 404 });

    // Los enlaces de asistencia viven bajo su propia clave: asi un id de /a
    // nunca se sirve por /g (mandaria al explicador con la ficha del agente
    // en vez de los datos del cliente) ni al reves.
    const clave = esAsistencia ? "a:" + id : id;

    let guardado = null;
    try {
      guardado = await store().get(clave);
    } catch (e) {
      console.error("[enlace] no se pudo leer el store", e);
      return new Response("No se pudo abrir el enlace. Intenta de nuevo.", { status: 503 });
    }
    if (!guardado) return new Response("Este enlace no existe o expiro.", { status: 404 });

    if (!esAsistencia) {
      // El destino se arma aca, del lado del servidor, sobre nuestro propio
      // sitio: lo guardado es SOLO el query string, nunca un host.
      return redirige(DESTINO + "?" + guardado);
    }

    // Asistencia: se guardo {b, q}. El host se revalida contra la lista
    // blanca AL SERVIR, no solo al crear — si manana se saca un dominio de
    // DESTINOS_A, los alias viejos hacia ese host dejan de redirigir solos.
    let reg;
    try {
      reg = JSON.parse(guardado);
    } catch {
      return new Response("Este enlace no existe o expiro.", { status: 404 });
    }
    const base = baseAsistencia(reg && reg.b);
    if (!base) return new Response("Este enlace ya no esta disponible.", { status: 404 });
    return redirige(base + "?" + reg.q);
  }

  // ---- POST /g  o  /a  → crea el id corto -----------------------------
  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo invalido." });
  }
  // JSON.parse("null") devuelve null y no lanza: sin este guard, body.q
  // reventaba con un 500 en vez de un 400 honesto.
  if (!body || typeof body !== "object") return json(400, { error: "Cuerpo invalido." });

  const qs = String(body.q || "").replace(/^[?&]+/, "");
  if (!esNuestro(qs, esAsistencia ? CLAVES_A : CLAVES)) {
    return json(400, { error: "Ese enlace no corresponde a una guia." });
  }

  let base = "";
  if (esAsistencia) {
    base = baseAsistencia(body.b);
    if (!base) return json(400, { error: "Ese destino no esta autorizado." });
  }

  try {
    const s = store();

    // Mismo enlace = mismo id: reenviar la misma cotizacion no ensucia el
    // store con un alias nuevo cada vez.
    //
    // TIENE QUE SER UN HASH DEL TEXTO COMPLETO, no un prefijo. Antes esto
    // truncaba el propio query string a 90 bytes, y como _buildGuideUrl pone
    // SIEMPRE primero los datos del agente (n, l, w, a = 116 bytes con el
    // perfil real), la ventana no llegaba nunca al nombre del cliente: todas
    // las cotizaciones del mismo agente compartian huella y la segunda recibia
    // el id de la primera. El cliente abria el enlace y veia la guia de OTRA
    // persona — nombre, placa, valor asegurado y primas ajenas.
    //
    // OJO en /a: ahi el query es SOLO la ficha del agente, sin un solo dato
    // del cliente, asi que todos los avisos de un mismo agente comparten id a
    // proposito — es un enlace generico suyo. Eso NO es el bug de arriba y no
    // hay que "arreglarlo" agregandole nada que lo haga unico por cliente.
    const huella = (esAsistencia ? "ha:" : "h:") +
      createHash("sha256").update(esAsistencia ? base + "?" + qs : qs).digest("base64url");
    const valor = esAsistencia ? JSON.stringify({ b: base, q: qs }) : qs;

    const previo = await s.get(huella);
    if (previo && RE_ID.test(previo)) {
      // Cinturon: el id reusado tiene que apuntar EXACTAMENTE a este enlace.
      // Si por lo que sea no coincide, se emite uno nuevo en vez de mandar al
      // cliente a la guia de otro.
      const g = await s.get(esAsistencia ? "a:" + previo : previo);
      if (g === valor) return json(200, { id: previo, reusado: true });
    }

    const id = nuevoId();
    await s.set(esAsistencia ? "a:" + id : id, valor);
    await s.set(huella, id);
    return json(200, { id, reusado: false });
  } catch (e) {
    console.error("[enlace] no se pudo guardar", e);
    // Que falle el acortador NUNCA debe impedir compartir: el front se
    // queda con el link largo, que funciona igual.
    return json(503, { error: "No se pudo acortar el enlace." });
  }
}
