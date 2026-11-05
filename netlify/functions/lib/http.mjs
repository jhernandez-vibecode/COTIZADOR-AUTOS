// =====================================================================
// Lo comun de las Functions de los formularios publicos (5 nov 2026)
// ---------------------------------------------------------------------
// /cita/enviar y /cotizar/* responden JSON, solo aceptan llamadas de nuestras
// paginas y mandan correo por Resend. Antes cada una tenia su copia.
// =====================================================================

/** Dominios de nuestras paginas. Cada Function puede sumar los suyos. */
export const ORIGENES = ["https://cotizador.appsegurosdigitales.com", "https://cotizador-segurosdigitalesins-sdi.netlify.app"];

export const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

/**
 * ¿Se acepta este Origin? Sin Origin (llamada de servidor) si: no hay cookies que robar
 * y los limites cuentan por IP. localhost para probar en la PC.
 */
export function origenPermitido(origen, permitidos) {
  if (!origen) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen) || permitidos.includes(origen);
}

/** La IP del que llama (Netlify la da en context.ip). */
export const ipDe = (req, context) => (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "sin-ip";

/** Nombre visible del remitente: sin comillas, angulares ni controles. */
export const visible = (s) => String(s).replace(/["<>\r\n\u0000]/g, "").trim();

/** "Citas <citas@dominio>" → "citas@dominio". */
export const direccionDe = (from) => { const m = /<([^>]+)>/.exec(from); return m ? m[1] : from; };

/** Manda un correo por Resend. Lanza si Resend no lo acepta. */
export async function enviarCorreo(fetchFn, apiKey, msg) {
  const r = await fetchFn("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" }, body: JSON.stringify(msg),
  });
  if (!r.ok) throw new Error("envio " + r.status);
}
