// =====================================================================
// Piezas comunes de los correos que mandan las Functions (5 nov 2026)
// ---------------------------------------------------------------------
// Las usan lib/cita-correos.mjs y lib/cotizar-correos.mjs: antes cada uno
// tenia su copia. Reglas de los correos del proyecto: sin border-left, sin
// emojis, logos PNG con URL absoluta, montos con 'de-DE', todo valor escapado,
// WhatsApp por web.whatsapp.com/send/ (nunca wa.me).
// =====================================================================

export const F = "Arial,Helvetica,sans-serif";
export const LOGO_INS = "https://cotizador.appsegurosdigitales.com/img/ins-logo.png";
export const LOGO_SDI = "https://cotizador.appsegurosdigitales.com/img/sdi-logo-email-ins.png";
export const CARGO_DEFECTO = "Agente exclusivo del INS";

export const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** 9500000 o "₡ 9.500.000" → "₡9.500.000" ('' si no hay monto). */
export const colones = (v) => { const n = Number(String(v == null ? "" : v).replace(/\D/g, "")); return n > 0 ? "₡" + n.toLocaleString("de-DE") : ""; };
/** "8888-1111" → "50688881111" (los de 8 digitos son de Costa Rica). */
export const waIntl = (v) => { const n = String(v || "").replace(/\D/g, ""); return n.length === 8 ? "506" + n : n; };

/**
 * Texto que escribio quien lleno el formulario y que el correo le devuelve al CLIENTE
 * (pila, placa, marca y modelo): solo letras, numeros, espacio y guion. Sin puntos,
 * barras ni dos puntos no cabe un enlace. Con decimales, el punto se queda entre
 * digitos ("RAV4 2.5").
 */
export function textoCliente(s, max, { decimales = false } = {}) {
  let t = String(s == null ? "" : s).replace(decimales ? /[^\p{L}\p{N} .\-]/gu : /[^\p{L}\p{N} \-]/gu, "");
  if (decimales) t = t.replace(/\.(?!\d)|(?<!\d)\./g, "");
  return t.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/**
 * Renglones bajo el nombre del agente en la firma, con la licencia al final del ultimo:
 *   agente: ["Agente exclusivo del INS · Licencia SUGESE 08-1318"]
 *   asesor: ["Asesor de Seguros", "Oficina de X, agente · Licencia SUGESE 08-1319"]
 * @param {{cargo?:string, oficina?:string, licencia?:string}} ag  la firma de lib/agentes.mjs
 * @param {string} sep  lo que va antes de "Licencia" (" · " o " - ")
 */
export function rolFirma(ag, sep = " · ") {
  const r = ag.cargo ? [ag.cargo, ag.oficina].filter(Boolean) : [CARGO_DEFECTO];
  if (ag.licencia) r[r.length - 1] += sep + "Licencia SUGESE " + ag.licencia;
  return r;
}

export const FILETE = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="60%" height="4" bgcolor="#0369A1"></td><td width="25%" bgcolor="#0D9488"></td><td width="10%" bgcolor="#EA580C"></td><td width="5%" bgcolor="#C9A227"></td></tr></table>';
export const marco = (adentro) => '<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">' + adentro + "</table></td></tr></table></body></html>";
/** Renglon "dato: valor" de las tablas de los correos. */
export const fila = (k, v) => '<tr><td style="padding:7px 10px 7px 0;border-bottom:1px solid #EDEFF2;color:#5A6570;width:42%;vertical-align:top;font-family:' + F + ';font-size:13.5px;">' + esc(k) +
  '</td><td style="padding:7px 0;border-bottom:1px solid #EDEFF2;font-weight:bold;vertical-align:top;font-family:' + F + ';font-size:13.5px;color:#1B1F23;">' + esc(v).replace(/\n/g, "<br>") + "</td></tr>";
