// =====================================================================
// Validacion de la solicitud de COTIZACION y de la ficha del agente (5 nov 2026)
// ---------------------------------------------------------------------
// Pura, sin @netlify/blobs: tests/test-cotizar-validacion.mjs corre con Node.
// Las opciones cerradas son las del Google Form "Cotización Seguro
// Automóviles." (leido el 4 nov 2026), palabra por palabra: si cambian aca,
// cambian en cotizar/index.html.
// =====================================================================

export const INTERESES_COT = [
  "Soy el actual propietario Registral",
  "Lo acabo de comprar, está en proceso de traspaso",
  "Lo voy a comprar pero aún no he firmado el traspaso",
];
export const USOS = ["Personal", "Comercial"];
export const TIPOS = { usado: "Usado", nuevo: "Nuevo Cero Kilómetros" };
export const COMBUSTIBLES = ["Gasolina", "Diesel", "Eléctrico", "Híbrido"];
export const TIPOS_VEH = ["Sedan", "Rural", "Pick Up"];

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Retorno, salto y NUL revientan cabeceras; el espacio NO (los nombres lo traen).
const RE_CONTROL = /[\r\n\u0000]/;

const txt = (v) => String(v == null ? "" : v).trim().replace(/[ \t]+/g, " ");
const mal = (campo, error) => ({ ok: false, estado: 400, campo, error });

/** "₡ 9.500.000" → 9500000 (o 0 si no hay numero). */
export const monto = (v) => Number(String(v || "").replace(/\D/g, "").slice(0, 12)) || 0;

function linea(body, k, nombre, max, req = true) {
  const v = txt(body[k]);
  if (!v) return req ? { error: mal(k, "Falta: " + nombre + ".") } : { v: "" };
  if (v.length > max || RE_CONTROL.test(v)) return { error: mal(k, "Revisá: " + nombre + ".") };
  return { v };
}

/**
 * @returns {{ok:true, datos:object} | {ok:false, estado:number, campo:string, error:string} | {ok:false, trampa:true}}
 */
export function validarCotizacion(body) {
  if (!body || typeof body !== "object") return mal("", "Solicitud vacía.");
  // Campo trampa: un humano no lo ve. Lleno = robot → se finge exito y no se envia.
  if (txt(body.sitio) !== "") return { ok: false, trampa: true };

  const d = {};
  const correo = txt(body.correo).toLowerCase();
  if (!RE_CORREO.test(correo) || correo.length > 120) return mal("correo", "Revisá el correo electrónico.");
  d.correo = correo;
  for (const [k, n, max] of [["nombre", "el nombre del propietario", 120], ["cedula", "el número de cédula", 30], ["telefono", "el teléfono", 30]]) {
    const r = linea(body, k, n, max); if (r.error) return r.error; d[k] = r.v;
  }
  if (d.telefono.replace(/\D/g, "").length < 8) return mal("telefono", "Revisá el teléfono: tiene que tener 8 dígitos.");
  if (!INTERESES_COT.includes(body.interes)) return mal("interes", "Elegí el interés asegurable.");
  d.interes = body.interes;
  if (!USOS.includes(body.uso)) return mal("uso", "Elegí el uso del vehículo.");
  d.uso = body.uso;
  if (!Object.prototype.hasOwnProperty.call(TIPOS, body.tipo)) return mal("tipo", "Elegí si el vehículo es usado o nuevo.");
  d.tipo = body.tipo;

  if (d.tipo === "usado") {
    const r = linea(body, "placa", "el número de placa", 12); if (r.error) return r.error;
    d.placa = r.v.toUpperCase();
    d.valor = monto(body.valor);
    if (!d.valor) return mal("valor", "Falta: el valor de mercado del vehículo.");
  } else {
    for (const [k, n, max] of [["inscribe", "a nombre de quién se inscribe", 120], ["cedula2", "el número de cédula de quien inscribe", 30], ["marcaModelo", "la marca y el modelo", 80]]) {
      const r = linea(body, k, n, max); if (r.error) return r.error; d[k] = r.v;
    }
    d.valor = monto(body.valor);
    if (!d.valor) return mal("valor", "Falta: el valor de factura del vehículo nuevo.");
    if (!COMBUSTIBLES.includes(body.combustible)) return mal("combustible", "Elegí el tipo de combustible.");
    if (!TIPOS_VEH.includes(body.tipoVeh)) return mal("tipoVeh", "Elegí el tipo de vehículo.");
    d.combustible = body.combustible;
    d.tipoVeh = body.tipoVeh;
  }
  const info = String(body.info == null ? "" : body.info).trim();
  if (info.length > 600 || /\u0000/.test(info)) return mal("info", "La información adicional es muy larga.");
  d.info = info;
  return { ok: true, datos: d };
}

/** Lo que identifica la solicitud en asuntos y en la hoja: la placa o la marca y modelo. */
export const vehiculoCorto = (d) => (d.tipo === "usado" ? d.placa : "0 KM · " + d.marcaModelo);

/**
 * Ficha del agente: lo que pone en su ⚙ (nombre, licencia, WhatsApp, teléfono).
 * @returns {{ok:true, ficha:object} | {ok:false, error:string}}
 */
export function validarFicha(f) {
  if (!f || typeof f !== "object") return { ok: false, error: "Ficha vacía." };
  const nombre = txt(f.nombre), licencia = txt(f.licencia), whatsapp = txt(f.whatsapp), telefono = txt(f.telefono);
  if (nombre.split(" ").length < 2 || nombre.length > 90 || /[\r\n\u0000<>"]/.test(nombre)) return { ok: false, error: "Revisá tu nombre completo." };
  if (licencia.length > 20 || RE_CONTROL.test(licencia)) return { ok: false, error: "Revisá tu licencia." };
  for (const t of [whatsapp, telefono]) if (t.length > 25 || (t && t.replace(/\D/g, "").length < 8)) return { ok: false, error: "Revisá tu teléfono o WhatsApp." };
  return { ok: true, ficha: { nombre, licencia, whatsapp, telefono } };
}
