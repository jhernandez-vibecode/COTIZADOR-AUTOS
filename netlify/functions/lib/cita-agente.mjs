// =====================================================================
// La firma del agente en la cita sale del SERVIDOR (5 nov 2026)
// ---------------------------------------------------------------------
// Antes, /cita/enviar firmaba la confirmacion al cliente con el nombre, la
// licencia, el telefono y el cargo que mandaba el NAVEGADOR (vienen en el
// enlace de la guia). Con solo saber el correo de un agente autorizado,
// cualquiera podia mandar a cualquier direccion un correo desde nuestro
// dominio con otro nombre de remitente y otro telefono: suplantacion del INS.
//
// Ahora esos cuatro datos se leen de la FICHA del agente (la que guarda su
// ⚙ en el store "cotizar", la misma del formulario de cotizacion) y el cargo
// del reparto o de la lista de asesores. Lo que mande el navegador para
// n / l / tel / wa / cg se descarta. Sin ficha → no se envia (fail-closed):
// la pagina le ofrece al cliente el WhatsApp del agente.
// =====================================================================

/** Asesores que venden con la licencia de otro agente. Igual a CFG.ASESORES de js/config.js (lo vigila tests/test-cita-agente.mjs). */
export const ASESORES = { "tramites@segurosdelins.com": "Asesor de Seguros · Oficina de Fernando Hernández, agente" };

/**
 * Lee del store "cotizar" la ficha y el cargo del agente.
 * @returns {Promise<{n:string,l:string,tel:string,wa:string,cg:string}|null>} null si no tiene ficha
 */
export async function firmaDelAgente(store, ae) {
  const email = String(ae || "").trim().toLowerCase();
  if (!email) return null;
  const ficha = await store.get("ficha:" + email, { type: "json" });
  if (!ficha || !ficha.nombre) return null;
  const reparto = await store.get("reparto", { type: "json" });
  const enReparto = reparto && Array.isArray(reparto.agentes) ? reparto.agentes.find((a) => a && a.email === email) : null;
  const cg = String((enReparto && enReparto.cargo) || ASESORES[email] || "").trim();
  return {
    n: String(ficha.nombre), l: String(ficha.licencia || ""),
    tel: String(ficha.telefono || ficha.whatsapp || ""), wa: String(ficha.whatsapp || ""), cg,
  };
}

/** Los datos validados con la firma del servidor encima (lo del navegador no sobrevive). */
// La licencia: la de la ficha; si la ficha no la trae, la del enlace SOLO si tiene forma de licencia (00-0000).
export const conFirma = (d, f) => ({ ...d, n: f.n, l: f.l || (/^\d{2}-\d{4}$/.test(String(d.l || "")) ? d.l : ""), tel: f.tel, wa: f.wa, cg: f.cg });

/** Texto libre que el correo al CLIENTE repite (pila, placa): solo letras, numeros, espacio y guion. Sin puntos ni barras no cabe un enlace. */
export const textoSeguro = (s, max) => String(s == null ? "" : s).replace(/[^\p{L}\p{N} \-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
