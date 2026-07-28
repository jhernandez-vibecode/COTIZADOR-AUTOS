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
// Tope de material para el paso 2. Bajado de 55k a 32k (~8k tokens) el 28 jul:
// con 55k, una pregunta amplia ("cilindradas y tarifas de motocicletas", que
// toca las secciones grandes de la Guia) se pasaba de los 26 s de Netlify y el
// gateway cortaba con un 504. Ocho mil tokens alcanzan de sobra para responder
// con cita: el limite real es cuantas secciones DISTINTAS entran, no su largo.
const MAX_MATERIAL     = 32000;
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

// ───────────────────────────────────────────────────── busqueda literal

const VACIAS = new Set(("de la el los las un una unos unas y o u en con por para " +
  "que cual cuales como cuando donde cuanto cuantos cuanta cuantas es son esta estan " +
  "del al se su sus lo le me te nos si no mas pero tiene tienen hay sobre entre " +
  "cubre cubren aplica aplican puede pueden debe deben ser estar tener").split(" "));

function normaliza(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Rastrilla el TEXTO de las 428 secciones buscando los terminos de la pregunta.
 *
 * El indice que ve el paso 1 son titulo, resumen y palabras clave — nunca el
 * texto. Si la pregunta usa una palabra que quedo enterrada en el cuerpo de una
 * seccion grande ("diplomatico" dentro de "2.9 Otras clasificaciones de
 * riesgo"), el indice no la delata y la seccion es invisible. Esto la rescata:
 * si la palabra esta en el documento, la seccion entra como candidata sin
 * importar como se llame.
 */
export function buscarLiteral(pregunta, c, tope) {
  // Se busca por RAIZ, no por palabra completa. El agente escribe como habla y
  // el documento usa otra forma de la misma palabra: "cilindradas" vs
  // "cilindraje", "tarifas" vs "tarifaria", "requisitos" vs "requisito". Con
  // igualdad exacta esa consulta devolvia CERO candidatos y el buscador
  // semantico se quedaba sin red. Seis caracteres alcanzan para la raiz y
  // siguen siendo especificos; el limite de palabra evita que "moto" matchee
  // "motor".
  const terminos = [...new Set(
    normaliza(pregunta).split(/[^a-z0-9ñ]+/)
      .filter((t) => t.length >= 4 && !VACIAS.has(t))
      .map((t) => (t.length > 6 ? t.slice(0, 6) : t))
  )];
  if (!terminos.length) return [];

  // Las letras de cobertura ("cobertura E", "la D") son de una sola letra y el
  // filtro por largo se las come, justo cuando son lo mas especifico de la
  // pregunta. Se buscan aparte contra el rotulo de la seccion.
  const letras = [...new Set(
    [...pregunta.matchAll(/\bcoberturas?\s*["“'‘]?\s*([a-zA-Z]{1,3})\b/g)].map((m) => m[1].toLowerCase())
  )].filter((l) => !["de", "del", "la", "el", "en", "es", "que"].includes(l));

  const puntuadas = [];
  for (const s of c.secciones) {
    const texto = normaliza(s.texto);
    const rotulo = normaliza(s.ruta + " " + s.resumen + " " + s.palabras_clave.join(" "));
    let puntos = 0, distintos = 0;
    for (const t of terminos) {
      // La raiz tiene que empezar una palabra: "cilindr" vale para
      // "cilindraje" pero "arifa" no debe colarse dentro de otra palabra.
      const re = new RegExp("(^|[^a-z0-9ñ])" + t, "g");
      const enTexto = re.test(texto);
      re.lastIndex = 0;
      const enRotulo = re.test(rotulo);
      if (enTexto || enRotulo) distintos++;
      if (enRotulo) puntos += 6;          // el titulo pesa mas que el cuerpo
      if (enTexto) puntos += Math.min(3, (texto.match(new RegExp("(^|[^a-z0-9ñ])" + t, "g")) || []).length);
    }
    // Con dos o mas terminos hay que acertar al menos dos. Si no, una palabra
    // comun sola arrastra medio corpus: "capital" (de Francia) matchea la
    // clausula de cancelacion y le mete ruido al paso 2 sin aportar nada.
    // Cobertura por letra: 'cobertura "e"' en el rotulo es una senal fortisima
    for (const L of letras) {
      if (new RegExp(`cobertura\\s*["“'‘]?\\s*${L}\\b`).test(rotulo)) {
        puntos += 30;
        distintos += 2;
      }
    }

    const minimo = terminos.length >= 2 ? 2 : 1;
    if (distintos >= minimo) puntuadas.push({ id: s.id, puntos, distintos });
  }
  puntuadas.sort((a, b) => b.distintos - a.distintos || b.puntos - a.puntos);
  return puntuadas.slice(0, tope || 10).map((x) => x.id);
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

  // El token tiene que haber sido emitido A ESTA app. Sin este chequeo sirve
  // cualquier access_token con scope email del mismo correo emitido a OTRA app
  // (OAuth Playground, un "Sign in with Google" de un sitio de terceros): el
  // clasico token-substitution. tokeninfo ya trae aud/azp en la respuesta.
  // El client id es informacion PUBLICA (vive en js/config.js del front), asi
  // que este valor por defecto no viola la regla de no hardcodear secretos.
  const esperado =
    process.env.CONSULTOR_CLIENT_ID ||
    "255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com";
  if (info.aud !== esperado && info.azp !== esperado) {
    return { ok: false, motivo: "El token no fue emitido por esta aplicacion. Entra por la pagina del consultor." };
  }

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

/**
 * Tope diario por agente (hora de Costa Rica, UTC-6 sin horario de verano).
 *
 * No es el control de acceso — ese es la whitelist verificada contra Google.
 * Esto es el cinturon contra un bucle accidental o un agente entusiasmado
 * quemando la clave de JC. Solo cuenta el paso 2, que es donde esta el gasto.
 *
 * Si Blobs falla NO se bloquea al agente: perder la cuenta es menos grave que
 * dejarlo sin trabajar por un problema de infraestructura.
 */
function diaCR() {
  return new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

async function verTope(correo) {
  const limite = Number(process.env.CONSULTOR_TOPE_DIARIO || 0);
  if (!limite || limite < 1) return { permitido: true, limite: 0, usadas: 0 };

  const clave = `${diaCR()}|${correo}`;
  try {
    // Import perezoso a proposito: @netlify/blobs solo existe en el build de
    // Netlify. Arriba del todo dejaria el modulo sin cargar en local y los
    // tests (que importan buscarLiteral de aca) no correrian. Ademas, si la
    // dependencia fallara, cae solo el contador y no la funcion entera.
    const { getStore } = await import("@netlify/blobs");
    const s = getStore({ name: "consultor-uso", consistency: "strong" });
    const usadas = Number((await s.get(clave)) || 0);
    if (usadas >= limite) {
      return {
        permitido: false, limite, usadas,
        motivo: `Llegaste al tope de ${limite} consultas por hoy. Se reinicia mañana.`,
      };
    }
    // Se INCREMENTA YA, antes de la llamada al modelo. Antes se leia aca y se
    // escribia 15 segundos despues: en una rafaga todas leian el mismo valor y
    // el tope no frenaba nada. Y una consulta que falla igual costo dinero, asi
    // que tambien tiene que contar.
    await s.set(clave, String(usadas + 1));
    return { permitido: true, limite, usadas: usadas + 1 };
  } catch (e) {
    console.error("[consultor] no se pudo contar el uso", e);
    return { permitido: true, limite, usadas: 0 };   // fail-open a proposito
  }
}

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

  // Candidatos por coincidencia textual: rescatan lo que el indice no delata.
  const literales = buscarLiteral(pregunta, c, 10);
  const pista = literales.length
    ? "\n\nEstas secciones contienen literalmente palabras de la pregunta en su " +
      "TEXTO (que vos no ves en el indice). Miralas con atencion:\n" +
      literales.map((id) => `${id} | ${c._porId.get(id).ruta}`).join("\n")
    : "";

  const resp = await anthropic(clave, {
    model: MODELO_BUSCAR,
    max_tokens: 1000,
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Pregunta: ${pregunta}${pista}` }],
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
  // Union: lo que eligio el modelo primero, mas los mejores aciertos literales
  // que haya descartado. Un termino que esta textualmente en el documento no se
  // puede perder por criterio del buscador — es el caso "vehiculo diplomatico",
  // que vive dentro de una seccion titulada "Otras clasificaciones de riesgo".
  const elegidos = (out.ids || []).filter((id) => c._porId.has(id));
  const rescate = literales.filter((id) => !elegidos.includes(id)).slice(0, 3);
  const ids = [...new Set([...elegidos, ...rescate])].slice(0, MAX_SECCIONES);

  return { ids, razon: out.razon || "", literales, uso: resp.usage };
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
    "   producto, no sus Condiciones Particulares.\n" +
    "8. Sé conciso. La respuesta va en pocas oraciones directas; no repitas dentro de la\n" +
    "   respuesta el texto que ya va en las citas. El agente tiene prisa.\n\n" +
    "SECCIONES:\n\n" + material;

  // Seguro contra el error de mandar la pregunta sin el material: si el texto
  // de las secciones no viaja, el modelo contesta cualquier cosa con total
  // aplomo y desde afuera parece que "no encontro nada". Preferible reventar.
  if (!material || !sistema.includes(secciones[0].id)) {
    throw new Error("Bug interno: las secciones no llegaron al prompt.");
  }

  const resp = await anthropic(clave, {
    model: MODELO_RESPONDER,
    // max_tokens y effort estan elegidos por LATENCIA, no por plata: la
    // funcion de Netlify tiene un limite de ejecucion corto y cada token
    // generado es tiempo. La tarea es extractiva (encontrar y copiar del
    // material, no razonar en abierto) y la verificacion literal por codigo
    // atrapa las citas malas, asi que effort bajo no compromete el control de
    // calidad. Si la sonda ?demora= confirma techo de 26 s, se puede subir.
    max_tokens: 3000,
    // Sin esto el modelo recibe la pregunta sola, sin una linea de los
    // documentos, y contesta "no se adjunto ningun documento".
    system: [{ type: "text", text: sistema }],
    output_config: {
      effort: "low",
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

  // Truncado por max_tokens: el JSON llega cortado y JSON.parse revienta con
  // "Unterminated string". Mejor un mensaje que diga que hacer.
  if (resp.stop_reason === "max_tokens") {
    const e = new Error(
      "La pregunta pide demasiado de una sola vez y la respuesta no cupo. " +
      "Hacela mas acotada: una cobertura o un tema por consulta."
    );
    e.publico = true;
    e.estado = 422;
    throw e;
  }

  let datos;
  try {
    datos = JSON.parse(textoDe(resp));
  } catch {
    const e = new Error("El modelo devolvio una respuesta malformada. Volve a intentar.");
    e.publico = true;
    e.estado = 502;
    throw e;
  }
  return { datos, uso: resp.usage };
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
    const literal = normalizar(cita.texto_literal);
    // Una cita vacia o de dos palabras pasa includes() contra cualquier texto
    // ("".includes("") es SIEMPRE true). Menos de 15 caracteres no identifica
    // nada: se rechaza como no verificable, no se da por buena.
    const muyCorta = literal.length < 15;
    const ok = !muyCorta && normalizar(s.texto).includes(literal);
    return {
      ...cita,
      verificada: ok,
      motivo: ok
        ? null
        : muyCorta
          ? "La cita es demasiado corta para verificarse contra el documento."
          : "El texto citado no aparece literalmente en el documento.",
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
    // Nota: el techo de ejecucion de este sitio se midio el 28 jul 2026 con
    // una sonda temporal (ya retirada): 26 segundos por invocacion. Por eso
    // la consulta va partida en dos llamadas y el paso 2 esta afinado para
    // velocidad. Si algun dia el plan de Netlify cambia, re-medir.
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
    const accion = body.accion || "completa";

    // La consulta va en DOS llamadas separadas (buscar y despues responder)
    // porque las funciones de Netlify tienen un limite de ejecucion corto: las
    // dos etapas juntas en una sola invocacion se pasaban del limite y el
    // gateway cortaba con una pagina HTML ("Unexpected token '<'" en el front).
    // Separadas, cada una corre con su propio presupuesto de tiempo.
    // "completa" (sin accion) queda para pruebas por curl.
    if (accion === "buscar") {
      const t0 = Date.now();
      const paso1 = await buscarSecciones(clave, pregunta, c);
      const ms = Date.now() - t0;
      if (ms > 15000) console.warn("[consultor] paso1 lento:", ms, "ms —", pregunta);
      return json(200, {
        ms,
        ids: paso1.ids,
        razon: paso1.razon,
        secciones: paso1.ids.map((id) => {
          const s = c._porId.get(id);
          return { id: s.id, ruta: s.ruta, pagina_desde: s.pagina_desde };
        }),
        uso: { buscar: paso1.uso },
      });
    }

    let ids;
    if (accion === "responder") {
      // Los ids vienen del paso "buscar" previo. Se revalidan contra el corpus:
      // un id inventado no rompe nada — no existe y se descarta.
      ids = Array.isArray(body.ids)
        ? [...new Set(body.ids.filter((x) => typeof x === "string" && c._porId.has(x)))].slice(0, MAX_SECCIONES)
        : [];
      if (!ids.length) return json(400, { error: "Faltan las secciones a leer (ids)." });
    } else {
      ids = (await buscarSecciones(clave, pregunta, c)).ids;
    }

    if (ids.length === 0) {
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

    // Tope de material: las secciones van ordenadas por relevancia y se leen
    // hasta agotar el presupuesto. Protege la latencia cuando el buscador trae
    // varias de las secciones grandes que dejamos sin partir.
    const todas = ids.map((id) => c._porId.get(id));
    const secciones = [];
    let acumulado = 0;
    for (const s of todas) {
      if (secciones.length && acumulado + s.texto.length > MAX_MATERIAL) break;
      secciones.push(s);
      acumulado += s.texto.length;
    }
    const recortadas = todas.length - secciones.length;

    // El tope se consulta justo antes del paso 2 — el unico que gasta de
    // verdad. Buscar es centavos y no vale la pena bloquearlo.
    const t = await verTope(auth.correo);
    if (!t.permitido) return json(429, { error: t.motivo });

    const t0 = Date.now();
    const paso2 = await responder(clave, pregunta, secciones, c);
    const ms = Date.now() - t0;
    // Si esto se acerca al techo de Netlify (26 s), el siguiente que pregunte
    // algo parecido se come un 504. Queda en el log para poder bajar el tope.
    if (ms > 15000) {
      console.warn("[consultor] paso2 lento:", ms, "ms —", secciones.length,
        "secciones,", acumulado, "chars —", pregunta);
    }
    if (recortadas > 0) {
      paso2.datos.alertas = paso2.datos.alertas || [];
      paso2.datos.alertas.push(
        "Por límite de tamaño se leyeron " + secciones.length + " de " + todas.length +
        " secciones encontradas; si la respuesta se siente incompleta, preguntá algo más específico."
      );
    }
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
      // Y sin NINGUNA cita tampoco: "0 de 0 verificadas" no es una garantia,
      // es una respuesta que no paso por ninguna verificacion.
      apto_para_enviar: citas.length > 0 && sinVerificar === 0 && paso2.datos.encontrado,
      citas_sin_verificar: sinVerificar,
      secciones_consultadas: secciones.map((s) => ({
        id: s.id,
        ruta: s.ruta,
        documento: c._docs.get(s.documento).titulo,
        version: s.version,
        pagina_desde: s.pagina_desde,
        pagina_hasta: s.pagina_hasta,
      })),
      ms,
      material_chars: acumulado,
      uso: { responder: paso2.uso },
    });
  } catch (e) {
    // El detalle completo va al log de la funcion, NO al cliente: los mensajes
    // crudos filtran rutas absolutas del deploy y cuerpos de error de terceros.
    console.error("[consultor]", e);
    if (e && e.publico) return json(e.estado || 502, { error: e.message });
    return json(502, { error: "No se pudo completar la consulta. Volve a intentar." });
  }
}

export const config = { path: "/api/consultar" };
