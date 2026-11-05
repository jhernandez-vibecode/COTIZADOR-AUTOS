// =====================================================================
// Los dos correos de la solicitud de COTIZACION (5 nov 2026)
// ---------------------------------------------------------------------
// Puro. Transcribe el mockup aprobado por JC el 5 nov 2026
// (docs/superpowers/specs/2026-11-05-cotizacion-formulario-propio-mockup.html,
// pestana 3). La confirmacion al cliente la FIRMA EL AGENTE QUE LE TOCO.
// Pie de los dos: "Gestionado por SDI" y debajo "Seguros Digitales INS"
// (literal de JC, 4 nov). Reglas del proyecto: sin border-left, sin emojis,
// logos PNG con URL absoluta, montos con 'de-DE', todo valor escapado,
// WhatsApp por web.whatsapp.com/send/ (nunca wa.me).
// El correo al CLIENTE no repite la cedula.
// =====================================================================
import { TIPOS, vehiculoCorto } from "./cotizar-validacion.mjs";
import { CARGO_DEFECTO } from "./cotizar-reparto.mjs";

const LOGO_INS = "https://cotizador.appsegurosdigitales.com/img/ins-logo.png";
const LOGO_SDI = "https://cotizador.appsegurosdigitales.com/img/sdi-logo-email-ins.png";
export const URL_COTIZADOR = "https://cotizador.appsegurosdigitales.com/";
const F = "Arial,Helvetica,sans-serif";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const colones = (n) => (Number(n) > 0 ? "₡" + Number(n).toLocaleString("de-DE") : "");
export const waIntl = (v) => { const n = String(v || "").replace(/\D/g, ""); return n.length === 8 ? "506" + n : n; };
export const pila = (nombre) => String(nombre || "").trim().split(/\s+/)[0] || "";
const dosNombres = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).join(" ");

const FILETE = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="60%" height="4" bgcolor="#0369A1"></td><td width="25%" bgcolor="#0D9488"></td><td width="10%" bgcolor="#EA580C"></td><td width="5%" bgcolor="#C9A227"></td></tr></table>';
const marco = (adentro) => '<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">' + adentro + "</table></td></tr></table></body></html>";
const ENCABEZADO = "<tr><td>" + FILETE + "</td></tr>" +
  '<tr><td bgcolor="#0C2340" align="center" style="padding:20px 24px;"><img src="' + LOGO_INS + '" alt="INS" height="26" style="height:26px;width:auto;border:0;"></td></tr>';
const PIE = '<tr><td bgcolor="#0C2340" align="center" style="padding:18px;font-family:' + F + ';font-size:11.5px;line-height:1.5;color:#94a3b8;">' +
  '<img src="' + LOGO_SDI + '" alt="SDI Seguros Digitales INS" height="34" style="height:34px;width:auto;border:0;display:block;margin:0 auto 8px;">' +
  '<b style="color:#ffffff;">Gestionado por SDI</b><br>Seguros Digitales INS</td></tr>';
const fila = (k, v) => '<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #EDEFF2;color:#5A6570;width:42%;vertical-align:top;font-family:' + F + ';font-size:13.5px;">' + esc(k) +
  '</td><td style="padding:6px 0;border-bottom:1px solid #EDEFF2;font-weight:bold;vertical-align:top;font-family:' + F + ';font-size:13.5px;color:#1B1F23;">' + esc(v).replace(/\n/g, "<br>") + "</td></tr>";
const caja = (titulo, filas) => '<div style="border:1px solid #DADCE0;border-radius:10px;padding:10px 14px;margin:0 0 14px;">' +
  '<div style="font-family:' + F + ';font-size:11px;letter-spacing:.06em;color:#6B7681;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">' + esc(titulo) + "</div>" +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + filas + "</table></div>";
const p = (html, extra) => '<p style="margin:0 0 14px;font-family:' + F + ';font-size:14px;line-height:1.55;color:#1B1F23;' + (extra || "") + '">' + html + "</p>";
const boton = (href, texto, color) => '<a href="' + esc(href) + '" style="display:inline-block;background:' + color + ';color:#ffffff;text-decoration:none;font-family:' + F + ';font-weight:bold;border-radius:999px;padding:11px 20px;font-size:14px;margin:0 6px 6px 0;">' + esc(texto) + "</a>";
const linkWa = (num, texto) => "https://web.whatsapp.com/send/?phone=" + waIntl(num) + "&text=" + encodeURIComponent(texto);

/**
 * Lineas del cargo. "Agente exclusivo del INS · Licencia SUGESE 08-1318" en una linea.
 * Si el cargo trae " · " (JC, 5 nov 2026, Jose), lo primero va arriba solo y el resto
 * abajo con la licencia: "Asesor de Seguros" / "Oficina de Fernando Hernández, agente · Licencia SUGESE 08-1319".
 */
export function lineaCargo(agente) {
  const cargo = String(agente.cargo || "").trim() || CARGO_DEFECTO;
  const i = cargo.indexOf(" · ");
  const lic = agente.licencia ? " · Licencia SUGESE " + agente.licencia : "";
  return i > 0 ? cargo.slice(0, i) + "\n" + cargo.slice(i + 3) + lic : cargo + lic;
}

/** Filas del vehiculo, comunes a los dos correos. */
function filasVehiculo(d, conTodo) {
  const r = [["Vehículo", d.tipo === "usado" ? "Usado · placa " + d.placa : "Nuevo cero kilómetros · " + d.marcaModelo],
    [d.tipo === "usado" ? "Valor de mercado" : "Valor de factura", colones(d.valor)]];
  if (d.tipo === "nuevo") r.push(["Combustible", d.combustible], ["Tipo de vehículo", d.tipoVeh]);
  r.push(["Uso", d.uso], ["Interés asegurable", d.interes]);
  if (conTodo && d.tipo === "nuevo") r.splice(1, 0, ["A nombre de quién se inscribe", d.inscribe], ["Cédula de quien inscribe", d.cedula2]);
  return r;
}

/**
 * Confirmacion al cliente, firmada por el agente que le toco.
 * @param {object} d  datos validados
 * @param {object} agente  {email, nombre, licencia, whatsapp, telefono, cargo}
 */
export function correoCliente(d, agente) {
  const nom = pila(d.nombre);
  const wa = agente.whatsapp ? linkWa(agente.whatsapp, "Hola " + dosNombres(agente.nombre) + ", soy " + nom + ". Te escribo por la cotización de mi vehículo.") : "";
  const veh = filasVehiculo(d, false);
  const html = marco(
    ENCABEZADO +
    '<tr><td style="padding:22px 24px;">' +
    '<div style="font-family:' + F + ';font-size:21px;font-weight:bold;color:#1B1F23;margin:0 0 12px;">¡Hola, ' + esc(nom) + "! Recibimos tu solicitud</div>" +
    p("Gracias por cotizar con nosotros. Soy <b>" + esc(agente.nombre) + "</b> y voy a preparar tu cotización del seguro para tu vehículo.") +
    caja("Lo que nos enviaste", veh.map(([k, v]) => fila(k, v)).join("")) +
    '<div style="font-family:' + F + ';font-size:11px;letter-spacing:.06em;color:#6B7681;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Qué sigue</div>' +
    '<ol style="margin:0 0 14px;padding-left:20px;font-family:' + F + ';font-size:14px;line-height:1.55;color:#1B1F23;"><li>Te envío la cotización a este correo, en horario hábil.</li><li>Si te gusta, agendamos la cita para asegurarlo.</li></ol>' +
    p(wa ? "Si tenés alguna duda, respondé este correo o escribime por WhatsApp." : "Si tenés alguna duda, respondé este correo.") +
    (wa ? '<p style="margin:0 0 14px;">' + boton(wa, "Escribirme por WhatsApp", "#037D61") + "</p>" : "") +
    '<div style="border-top:1px solid #EDEFF2;padding-top:12px;font-family:' + F + ';font-size:13px;line-height:1.55;color:#1B1F23;"><b style="font-size:14px;">' + esc(agente.nombre) + "</b><br>" +
    esc(lineaCargo(agente)).replace(/\n/g, "<br>") + "<br>" + [agente.whatsapp ? "WhatsApp " + esc(agente.whatsapp) : "", esc(agente.email)].filter(Boolean).join(" &middot; ") + "</div>" +
    "</td></tr>" + PIE
  );
  const texto = [
    "Hola " + nom + ",", "",
    "Recibimos tu solicitud de cotización. Soy " + agente.nombre + " y voy a preparar tu cotización del seguro para tu vehículo.", "",
    ...veh.map(([k, v]) => k + ": " + v), "",
    "Qué sigue:", "1. Te envío la cotización a este correo, en horario hábil.", "2. Si te gusta, agendamos la cita para asegurarlo.", "",
    "Si tenés alguna duda, respondé este correo" + (agente.whatsapp ? " o escribime por WhatsApp al " + agente.whatsapp : "") + ".", "",
    agente.nombre, lineaCargo(agente), "",
    "Gestionado por SDI", "Seguros Digitales INS",
  ].join("\n");
  return { asunto: "Recibimos tu solicitud de cotización · " + (d.tipo === "usado" ? d.placa : "0 KM"), html, texto };
}

/**
 * Aviso al agente que le toco.
 * @param {object} d  datos validados
 * @param {object} info  {agente, n, de, repartido, clienteAvisado, fecha (texto)}
 */
export function correoAgente(d, info) {
  const ag = info.agente;
  const textoWa = "Hola " + pila(d.nombre) + ", soy " + dosNombres(ag.nombre) + ", agente del INS. Recibí tu solicitud de cotización para tu vehículo " +
    (d.tipo === "usado" ? "placa " + d.placa : d.marcaModelo) + " y te la preparo en un momento.";
  const cliente = [["Nombre del propietario", d.nombre], ["Número de Cédula", d.cedula], ["Teléfono", d.telefono], ["Correo", d.correo]];
  const veh = [["Su vehículo es", TIPOS[d.tipo]]];
  if (d.tipo === "usado") veh.push(["Número de placa", d.placa], ["Valor de mercado", colones(d.valor)]);
  else veh.push(["A nombre de quién se inscribe", d.inscribe], ["Número de Cédula", d.cedula2], ["Marca y Modelo", d.marcaModelo], ["Valor de Factura", colones(d.valor)], ["Tipo de Combustible", d.combustible], ["Tipo de Vehículo", d.tipoVeh]);
  veh.push(["Uso del Vehículo", d.uso], ["Interés Asegurable", d.interes], ["Información Adicional", d.info || "(no indicó)"]);
  const html = marco(
    ENCABEZADO +
    '<tr><td style="padding:22px 24px;">' +
    // Sin chip del turno (JC, 5 nov 2026: "quitemos este chip"). El turno queda en la hoja de registro.
    '<div style="font-family:' + F + ';font-size:21px;font-weight:bold;color:#1B1F23;margin:0 0 14px;">Nueva solicitud de cotización</div>' +
    (info.clienteAvisado === false ? '<div style="margin:0 0 14px;background:#FBF3DC;color:#7C5A00;border-top:3px solid #C9A227;padding:10px 12px;font-family:' + F + ';font-size:13px;">No se pudo enviar la confirmación al cliente. Avisale vos que recibiste su solicitud.</div>' : "") +
    caja("Cliente", cliente.map(([k, v]) => fila(k, v)).join("")) +
    caja("Vehículo", veh.map(([k, v]) => fila(k, v)).join("")) +
    '<p style="margin:0 0 10px;">' + (waIntl(d.telefono).length >= 11 ? boton(linkWa(d.telefono, textoWa), "WhatsApp a " + pila(d.nombre), "#037D61") : "") + boton(URL_COTIZADOR, "Abrir el cotizador", "#0369A1") + "</p>" +
    p("Solicitud del " + esc(info.fecha) + "." + (info.registrada ? " Quedó anotada en la hoja de registro." : ""), "font-size:12px;color:#6B7681;") +
    "</td></tr>" + PIE
  );
  const texto = ["NUEVA SOLICITUD DE COTIZACIÓN", "",
    ...cliente.map(([k, v]) => k + ": " + v), "", ...veh.map(([k, v]) => k + ": " + v), "",
    "Solicitud del " + info.fecha + "."].join("\n");
  return { asunto: "Cotización solicitada · " + vehiculoCorto(d) + " · " + d.nombre, html, texto };
}

/** Fila para la hoja de registro de JC (mismo orden que los encabezados del Apps Script). */
export function filaRegistro(d, info) {
  return {
    fecha: info.fecha, agente: info.agente.nombre, correoAgente: info.agente.email,
    turno: info.repartido ? info.n + " de " + info.de : "Reparto apagado",
    nombre: d.nombre, cedula: d.cedula, telefono: d.telefono, correo: d.correo,
    tipo: TIPOS[d.tipo], vehiculo: d.tipo === "usado" ? d.placa : d.marcaModelo, valor: d.valor,
    uso: d.uso, interes: d.interes,
    inscribe: d.inscribe || "", cedulaInscribe: d.cedula2 || "", combustible: d.combustible || "", tipoVehiculo: d.tipoVeh || "",
    info: d.info || "", clienteAvisado: info.clienteAvisado === false ? "No" : "Sí",
  };
}
