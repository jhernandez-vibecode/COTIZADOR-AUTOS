/**
 * Consultor de Autos · backend
 *
 * Responde preguntas sobre los 6 documentos del INS con citas verificadas.
 * Corre en Netlify Functions; es el unico lugar donde vive la clave de Anthropic
 * y el unico que puede leer el corpus (que contiene el texto de la Guia de
 * Suscripcion, material interno del INS).
 *
 * Flujo:
 *   1. ENCONTRAR  (Haiku 4.5) — pregunta + indice completo de las 279 paginas
 *                                -> ids de las secciones relevantes
 *   2. RESPONDER  (Opus 5)    — pregunta + texto integro de esas secciones
 *                                -> respuesta con citas textuales
 *   3. VERIFICAR  (codigo)    — cada cita se busca caracter por caracter en el
 *                                corpus; la que no aparece se marca
 *
 * Sin dependencias npm: este repo es estatico y sin build por diseno, asi que
 * se habla con la API por fetch (global en el runtime de Node de Netlify) en
 * lugar de instalar el SDK.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────── configuracion

const MODELO_BUSCAR    = "claude-haiku-4-5";
const MODELO_RESPONDER = "claude-opus-5";
const MAX_SECCIONES    = 12;      // tope de secciones que viajan al paso 2
const MAX_PREGUNTA     = 600;     // caracteres
const API              = "https://api.anthropic.com/v1/messages";
const VERSION_API      = "2023-06-01";

/**
 * La clave la creo JC en Netlify. Se aceptan las dos variantes del nombre
 * (guiones y guiones bajos) porque Netlify le rechazo el nombre estandar y
 * quedo con guiones; asi funciona con cualquiera de las dos sin tener que
 * recordar cual se uso.
 */
function claveAnthropic() {
  const e = process.env;
  return (
    e.CONSULTOR_COTIZADOR_AUTOS_AKEY ||
    e["CONSULTOR-COTIZADOR-AUTOS-AKEY"] ||
    e.ANTHROPIC_API_KEY ||
    null
  );
}

function correosAutorizados() {
  return (process.env.CONSULTOR_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────── corpus

let _corpus = null;

/**
 * Netlify copia los included_files conservando su ruta desde la raiz del repo,
 * que no siempre es la misma que la del archivo de la funcion ya empaquetado.
 * Se prueban las ubicaciones posibles en vez de asumir una: si esto falla, la
 * funcion se despliega "bien" y recien revienta en la primera consulta.
 */
async function corpus() {
  if (_corpus) return _corpus;

  const candidatos = [
    new URL("./data/corpus.json", import.meta.url),
    join(process.cwd(), "netlify", "functions", "data", "corpus.json"),
    join(process.cwd(), "data", "corpus.json"),
    join(process.cwd(), "corpus.json"),
  ];

  let crudo = null;
  const intentos = [];
  for (const ruta of candidatos) {
    try {
      crudo = await readFile(ruta, "utf-8");
      break;
    } catch (e) {
      intentos.push(`${ruta} (${e.code || "error"})`);
    }
  }
  if (crudo === null) {
    throw new Error("No se encontro corpus.json. Rutas probadas: " + intentos.join(" | "));
  }

  _corpus = JSON.parse(crudo);
  _corpus._porId = new Map(_corpus.secciones.map((s) => [s.id, s]));
  _corpus._docs = new Map(_corpus.documentos.map((d) => [d.id, d]));
  return _corpus;
}

/** Indice liviano para el paso 1: sin el texto completo. */
function indice(c) {
  return c.secciones
    .map((s) => `${s.id} | ${s.categoria} | ${s.ruta} | ${s.resumen} | ${s.palabras_clave.join(", ")}`)
    .join("\n");
}

// ──────────────────────────────────────────────────────────────────── auth

/**
 * Valida el token de Google CONTRA GOOGLE, del lado del servidor.
 * Una lista de correos en el navegador se salta abriendo las herramientas de
 * desarrollo; por eso esto no puede vivir en el front.
 */
async function verificarGoogle(token) {
  if (!token) return { ok: false, motivo: "Falta el token de Google." };
  let r;
  try {
    r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
  } catch {
    return { ok: false, motivo: "No se pudo validar la sesion con Google." };
  }
  if (!r.ok) return { ok: false, motivo: "La sesion de Google expiro. Volve a entrar." };

  const info = await r.json();
  const correo = (info.email || "").toLowerCase();
  if (!correo) return { ok: false, motivo: "El token de Google no trae correo." };
  if (info.email_verified === "false") return { ok: false, motivo: "El correo de Google no esta verificado." };

  const permitidos = correosAutorizados();
  if (permitidos.length === 0) {
    // Fail-closed: sin lista configurada NO se atiende a nadie. Lo contrario
    // dejaria el consultor abierto si la variable se borra por accidente.
    return { ok: false, motivo: "El consultor no tiene agentes autorizados configurados." };
  }
  if (!permitidos.includes(correo)) {
    return { ok: false, motivo: `${correo} no esta autorizado a usar el consultor.` };
  }
  return { ok: true, correo };
}

// ─────────────────────────────────────────────────────────── llamadas al modelo

async function anthropic(clave, cuerpo) {
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": clave,
      "anthropic-version": VERSION_API,
    },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new Error(`Anthropic ${r.status}: ${detalle.slice(0, 300)}`);
  }
  return r.json();
}

function textoDe(resp) {
  return (resp.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** PASO 1 — que secciones sirven para esta pregunta. */
async function buscarSecciones(clave, pregunta, c) {
  const sistema =
    "Sos el buscador de un consultor de seguros de automoviles del INS de Costa Rica.\n" +
    "Recibis el indice COMPLETO de los documentos y una pregunta.\n" +
    "Devolves los ids de las secciones que hagan falta para responderla bien.\n\n" +
    "Reglas:\n" +
    `- Como maximo ${MAX_SECCIONES} ids, ordenados de mas a menos relevante.\n` +
    "- Incluí las secciones de EXCLUSIONES y LIMITES que apliquen al tema, no solo la cobertura.\n" +
    "- El mismo tema puede llamarse distinto: grua / remolque / traslado del vehiculo son lo mismo.\n" +
    "- Si el tema aparece en varios documentos, traé los de todos: la comparacion importa.\n" +
    "- Si no hay nada relevante, devolvé la lista vacia.\n\n" +
    "INDICE:\n" + indice(c);

  const resp = await anthropic(clave, {
    model: MODELO_BUSCAR,
    max_tokens: 1000,
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Pregunta: ${pregunta}` }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            ids: { type: "array", items: { type: "string" } },
            razon: { type: "string" },
          },
          required: ["ids", "razon"],
          additionalProperties: false,
        },
      },
    },
  });

  let out;
  try {
    out = JSON.parse(textoDe(resp));
  } catch {
    out = { ids: [], razon: "" };
  }
  const ids = (out.ids || []).filter((id) => c._porId.has(id)).slice(0, MAX_SECCIONES);
  return { ids, razon: out.razon || "", uso: resp.usage };
}

/** PASO 2 — responder citando solo esas secciones. */
async function responder(clave, pregunta, secciones, c) {
  const material = secciones
    .map((s) => {
      const d = c._docs.get(s.documento);
      return (
        `<seccion id="${s.id}">\n` +
        `documento: ${d.titulo}\n` +
        `version: ${s.version}\n` +
        `paginas: ${s.pagina_desde}${s.pagina_hasta !== s.pagina_desde ? "-" + s.pagina_hasta : ""}\n` +
        `ubicacion: ${s.ruta}\n\n` +
        `${s.texto}\n</seccion>`
      );
    })
    .join("\n\n");

  const sistema =
    "Sos un analista experto en el Seguro Voluntario de Automoviles del INS de Costa Rica.\n" +
    "Le respondes a un agente de seguros con licencia, en espanol de Costa Rica.\n\n" +
    "REGLAS INVIOLABLES:\n" +
    "1. Respondé UNICAMENTE con lo que dicen las secciones que te paso. No completes con\n" +
    "   conocimiento general de seguros ni con lo que suele hacer el mercado.\n" +
    "2. Si la respuesta no esta en el material, decilo: 'No encontre esto en los documentos'.\n" +
    "   Esa es una respuesta correcta, no una falla.\n" +
    "3. Cada afirmacion va con su cita. El campo 'texto_literal' de cada cita tiene que ser una\n" +
    "   copia EXACTA, caracter por caracter, de un fragmento del texto de esa seccion. No lo\n" +
    "   parafrasees, no lo arregles, no le cambies la puntuacion. Se verifica por codigo.\n" +
    "4. Si dos documentos dicen cosas distintas sobre el mismo tema, mostralo explicitamente\n" +
    "   en vez de elegir uno.\n" +
    "5. Distingui siempre entre cobertura, exclusion, requisito, limite, procedimiento,\n" +
    "   definicion y beneficio de asistencia.\n" +
    "6. Si el material tiene una tabla (viene en formato Markdown), leela bien: los limites por\n" +
    "   plan estan ahi y confundir columnas cambia la respuesta.\n" +
    "7. No afirmes nada sobre la poliza concreta de un cliente: vos ves el reglamento del\n" +
    "   producto, no sus Condiciones Particulares.\n\n" +
    "SECCIONES:\n\n" + material;

  // Seguro contra el error de mandar la pregunta sin el material: si el texto
  // de las secciones no viaja, el modelo contesta cualquier cosa con total
  // aplomo y desde afuera parece que "no encontro nada". Preferible reventar.
  if (!material || !sistema.includes(secciones[0].id)) {
    throw new Error("Bug interno: las secciones no llegaron al prompt.");
  }

  const resp = await anthropic(clave, {
    model: MODELO_RESPONDER,
    max_tokens: 8000,
    // Sin esto el modelo recibe la pregunta sola, sin una linea de los
    // documentos, y contesta "no se adjunto ningun documento".
    system: [{ type: "text", text: sistema }],
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            respuesta: { type: "string", description: "Respuesta clara para el agente, en prosa." },
            encontrado: { type: "boolean", description: "false si el material no alcanza para responder." },
            citas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  seccion_id: { type: "string" },
                  texto_literal: { type: "string", description: "Copia exacta del documento." },
                  que_respalda: { type: "string" },
                },
                required: ["seccion_id", "texto_literal", "que_respalda"],
                additionalProperties: false,
              },
            },
            alertas: {
              type: "array",
              items: { type: "string" },
              description: "Contradicciones, vacios o cosas que el agente deberia verificar.",
            },
            resumen_cliente: {
              type: "string",
              description:
                "La misma respuesta en lenguaje llano para un cliente, sin jerga de clausulas. Vacio si encontrado es false.",
            },
          },
          required: ["respuesta", "encontrado", "citas", "alertas", "resumen_cliente"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: pregunta }],
  });

  return { datos: JSON.parse(textoDe(resp)), uso: resp.usage };
}

// ────────────────────────────────────────────────────────────── verificacion

/** Normaliza para comparar: espacios, comillas y guiones que el PDF escribe distinto. */
function normalizar(s) {
  return (s || "")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * PASO 3 — cada cita tiene que existir LITERALMENTE en su seccion.
 * Esto no promete que el modelo no invente: comprueba que no invento.
 */
function verificarCitas(citas, c) {
  return (citas || []).map((cita) => {
    const s = c._porId.get(cita.seccion_id);
    if (!s) {
      return { ...cita, verificada: false, motivo: "La seccion citada no existe en el corpus." };
    }
    const d = c._docs.get(s.documento);
    const ok = normalizar(s.texto).includes(normalizar(cita.texto_literal));
    return {
      ...cita,
      verificada: ok,
      motivo: ok ? null : "El texto citado no aparece literalmente en el documento.",
      documento: d.titulo,
      documento_id: s.documento,
      version: s.version,
      pagina_desde: s.pagina_desde,
      pagina_hasta: s.pagina_hasta,
      ruta: s.ruta,
      archivo: d.publico ? d.archivo : null, // la Guia no se sirve directo: es interna
    };
  });
}

// ────────────────────────────────────────────────────────────────── handler

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async function handler(req) {
  /**
   * Chequeo de salud. Responde si la clave, la lista de agentes y el corpus
   * estan donde deben — nunca los valores, solo si estan y cuantos son. Sirve
   * para saber QUE falla sin tener que adivinar leyendo logs.
   */
  if (req.method === "GET") {
    const estado = {
      clave_configurada: Boolean(claveAnthropic()),
      agentes_autorizados: correosAutorizados().length,
      corpus: null,
      error: null,
    };
    try {
      const c = await corpus();
      estado.corpus = {
        version: c.version_corpus,
        documentos: c.documentos.length,
        secciones: c.secciones.length,
        con_tabla: c.secciones.filter((s) => s.tiene_tabla).length,
      };
    } catch (e) {
      estado.error = String(e.message || e);
    }
    estado.listo =
      estado.clave_configurada && estado.agentes_autorizados > 0 && Boolean(estado.corpus);
    return json(estado.listo ? 200 : 503, estado);
  }

  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  const clave = claveAnthropic();
  if (!clave) {
    // Fail-closed a proposito: sin clave no se responde y no hay valor por defecto.
    return json(500, { error: "El consultor no tiene configurada la clave de Anthropic." });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo invalido." });
  }

  const auth = await verificarGoogle(body.token);
  if (!auth.ok) return json(403, { error: auth.motivo });

  const pregunta = (body.pregunta || "").trim();
  if (!pregunta) return json(400, { error: "Escribi una pregunta." });
  if (pregunta.length > MAX_PREGUNTA) {
    return json(400, { error: `La pregunta no puede pasar de ${MAX_PREGUNTA} caracteres.` });
  }

  try {
    const c = await corpus();

    const paso1 = await buscarSecciones(clave, pregunta, c);
    if (paso1.ids.length === 0) {
      return json(200, {
        encontrado: false,
        respuesta:
          "No encontre nada sobre eso en los documentos cargados (Guia de Suscripcion, " +
          "Condiciones Generales, Multiasistencia, Perfeccionamiento, Pacto Amistoso y DAM).",
        citas: [],
        alertas: [],
        resumen_cliente: "",
        secciones_consultadas: [],
      });
    }

    const secciones = paso1.ids.map((id) => c._porId.get(id));
    const paso2 = await responder(clave, pregunta, secciones, c);
    const citas = verificarCitas(paso2.datos.citas, c);
    const sinVerificar = citas.filter((x) => !x.verificada).length;

    return json(200, {
      encontrado: paso2.datos.encontrado,
      respuesta: paso2.datos.respuesta,
      citas,
      alertas: paso2.datos.alertas || [],
      resumen_cliente: paso2.datos.resumen_cliente || "",
      // Con una sola cita sin verificar el envio queda bloqueado en el front:
      // no sale para afuera nada que no haya pasado el chequeo contra la fuente.
      apto_para_enviar: sinVerificar === 0 && paso2.datos.encontrado,
      citas_sin_verificar: sinVerificar,
      secciones_consultadas: secciones.map((s) => ({
        id: s.id,
        ruta: s.ruta,
        documento: c._docs.get(s.documento).titulo,
        version: s.version,
        pagina_desde: s.pagina_desde,
        pagina_hasta: s.pagina_hasta,
      })),
      uso: {
        buscar: paso1.uso,
        responder: paso2.uso,
      },
    });
  } catch (e) {
    console.error("[consultor]", e);
    return json(502, { error: "No se pudo completar la consulta.", detalle: String(e.message || e) });
  }
}

export const config = { path: "/api/consultar" };
