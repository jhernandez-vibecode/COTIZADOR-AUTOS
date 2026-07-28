// =====================================================================
// Administracion del corpus del Consultor  ·  /api/corpus
// ---------------------------------------------------------------------
// Devuelve el inventario del corpus vigente (documentos, secciones,
// categorias, tamanos) y, si el agente sube un PDF, dice QUE CAMBIO
// respecto de lo publicado, pagina por pagina.
//
// LO QUE ESTA FUNCION *NO* HACE: re-seccionar. El seccionador es Python
// (procesador/seccionador.py) porque las tablas de limites de asistencia
// solo salen bien con pymupdf4llm, que no existe en JavaScript. Netlify
// corre JavaScript. Prometer aca un reprocesado seria mentir.
//
// El flujo real de actualizacion es:
//   1. El agente sube el PDF nuevo aca -> ve el diff contra lo publicado
//      y decide si vale la pena regenerar.
//   2. Si cambio algo: reemplazar el PDF en el repo, correr
//      `python procesador/seccionador.py` + `revision.py`, revisar el
//      HTML y hacer push. Netlify publica el corpus nuevo solo.
//
// Misma whitelist y misma validacion de token que /api/consultar: esto
// expone el inventario del corpus, que incluye titulos de la Guia
// (material interno del INS).
// =====================================================================

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function correosAutorizados() {
  return (process.env.CONSULTOR_EMAILS || "")
    .split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

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
  if (!correo) return { ok: false, motivo: "El token no trae correo." };
  if (info.email_verified === "false") return { ok: false, motivo: "El correo no esta verificado." };

  const esperado = process.env.CONSULTOR_CLIENT_ID ||
    "255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com";
  if (info.aud !== esperado && info.azp !== esperado) {
    return { ok: false, motivo: "El token no fue emitido por esta aplicacion." };
  }
  const permitidos = correosAutorizados();
  if (!permitidos.length) return { ok: false, motivo: "No hay agentes autorizados configurados." };
  if (!permitidos.includes(correo)) return { ok: false, motivo: `${correo} no esta autorizado.` };
  return { ok: true, correo };
}

let _corpus = null;
async function corpus() {
  if (_corpus) return _corpus;
  const candidatos = [
    new URL("./data/corpus.json", import.meta.url),
    join(process.cwd(), "netlify", "functions", "data", "corpus.json"),
    join(process.cwd(), "data", "corpus.json"),
  ];
  for (const ruta of candidatos) {
    try {
      _corpus = JSON.parse(await readFile(ruta, "utf-8"));
      return _corpus;
    } catch { /* siguiente */ }
  }
  throw new Error("No se encontro corpus.json");
}

/** Texto por pagina de lo publicado, para comparar contra el PDF nuevo. */
function paginasPublicadas(c, docId) {
  const paginas = new Map();
  for (const s of c.secciones) {
    if (s.documento !== docId) continue;
    for (let p = s.pagina_desde; p <= s.pagina_hasta; p++) {
      paginas.set(p, (paginas.get(p) || "") + " " + s.texto);
    }
  }
  return paginas;
}

const norm = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default async function handler(req) {
  const auth = await verificarGoogle(
    req.method === "GET"
      ? new URL(req.url).searchParams.get("token")
      : (await req.clone().json().catch(() => ({}))).token
  );
  if (!auth.ok) return json(403, { error: auth.motivo });

  const c = await corpus();

  // ---- GET: inventario de lo publicado --------------------------------
  if (req.method === "GET") {
    return json(200, {
      version_corpus: c.version_corpus,
      documentos: c.documentos.map((d) => {
        const secs = c.secciones.filter((s) => s.documento === d.id);
        const tam = secs.map((s) => s.texto.length).sort((a, b) => a - b);
        const cats = {};
        for (const s of secs) cats[s.categoria] = (cats[s.categoria] || 0) + 1;
        return {
          id: d.id, titulo: d.titulo, version: d.version,
          vigencia_desde: d.vigencia_desde || null, estado: d.estado,
          publico: Boolean(d.publico), archivo: d.archivo,
          secciones: secs.length,
          con_tabla: secs.filter((s) => s.tiene_tabla).length,
          paginas: secs.length ? Math.max(...secs.map((s) => s.pagina_hasta)) : 0,
          mediana_chars: tam.length ? tam[Math.floor(tam.length / 2)] : 0,
          grandes: tam.filter((t) => t > 8000).length,
          categorias: cats,
        };
      }),
      total_secciones: c.secciones.length,
      // El agente no puede regenerar desde aca: se le dice la verdad.
      reproceso: {
        automatico: false,
        motivo: "El seccionador es Python (pymupdf4llm para las tablas) y Netlify corre JavaScript.",
        comando: "python procesador/seccionador.py && python procesador/revision.py",
      },
    });
  }

  // ---- POST: diff de un PDF nuevo contra lo publicado -----------------
  if (req.method !== "POST") return json(405, { error: "Usa GET o POST." });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Cuerpo invalido." }); }

  const docId = String(body.documento || "");
  const doc = c.documentos.find((d) => d.id === docId);
  if (!doc) return json(400, { error: "Documento desconocido: " + docId });

  // El front manda el texto por pagina ya extraido con pdf.js, que el
  // cotizador ya usa. Asi esta funcion no necesita libreria de PDF.
  const nuevas = Array.isArray(body.paginas) ? body.paginas : null;
  if (!nuevas || !nuevas.length) return json(400, { error: "Falta el texto del PDF nuevo." });

  const viejas = paginasPublicadas(c, docId);
  const cambios = [];
  const total = Math.max(nuevas.length, viejas.size);

  for (let p = 1; p <= total; p++) {
    const nueva = norm(nuevas[p - 1] || "");
    const vieja = norm(viejas.get(p) || "");
    if (!nueva && !vieja) continue;
    if (!vieja) { cambios.push({ pagina: p, tipo: "nueva" }); continue; }
    if (!nueva) { cambios.push({ pagina: p, tipo: "eliminada" }); continue; }
    if (nueva === vieja) continue;

    // Palabras que entran y salen: mas util que "cambio la pagina 47".
    const A = new Set(vieja.split(" ")), B = new Set(nueva.split(" "));
    const salen = [...A].filter((w) => !B.has(w) && w.length > 3).slice(0, 12);
    const entran = [...B].filter((w) => !A.has(w) && w.length > 3).slice(0, 12);
    if (!salen.length && !entran.length) continue;   // solo reordenamiento
    cambios.push({ pagina: p, tipo: "modificada", salen, entran });
  }

  const secciones = c.secciones.filter((s) => s.documento === docId);
  const afectadas = secciones.filter((s) =>
    cambios.some((ch) => ch.pagina >= s.pagina_desde && ch.pagina <= s.pagina_hasta)
  );

  return json(200, {
    documento: { id: doc.id, titulo: doc.titulo, version: doc.version },
    paginas_publicadas: viejas.size,
    paginas_nuevas: nuevas.length,
    cambios,
    secciones_afectadas: afectadas.map((s) => ({
      id: s.id, ruta: s.ruta, pagina_desde: s.pagina_desde, pagina_hasta: s.pagina_hasta,
    })),
    resumen: cambios.length === 0
      ? "El PDF es idéntico al publicado. No hay nada que regenerar."
      : `Cambiaron ${cambios.length} de ${Math.max(viejas.size, nuevas.length)} páginas, ` +
        `que tocan ${afectadas.length} de ${secciones.length} secciones. ` +
        `Para publicarlo: reemplazá el PDF en el repo y corré el procesador.`,
  });
}

export const config = { path: "/api/corpus" };
