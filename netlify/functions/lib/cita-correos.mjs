// =====================================================================
// Los dos correos de la cita  ·  los usa netlify/functions/cita.mjs
// ---------------------------------------------------------------------
// Puro. Transcribe el mockup aprobado por JC el 18 set 2026 (pestanas 4 y 5).
// Reglas de los correos del proyecto: sin border-left, sin emojis, logos PNG
// alojados con URL absoluta, montos con 'de-DE', todo valor escapado.
// El correo al CLIENTE solo repite nombre, placa, fecha, franja, forma de
// pago y asistencias: nunca domicilio ni ingreso.
// =====================================================================

import planesMod from "../../../js/planes-asistencia.js";
const PLANES = planesMod.PLANES_ASI || [];

const LOGO_INS = "https://cotizador.appsegurosdigitales.com/img/ins-logo.png";
const LOGO_SDI = "https://cotizador.appsegurosdigitales.com/img/sdi-logo-email.png";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
// Abreviatura de correo (3 letras): NO es un slice de MESES porque "setiembre"
// cortado da "set" y la convencion de correo usa "sep".
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const FRANJA_CORTA = {
  "8:00 am a 10:00 am": "8-10 am", "10:00 am a 12:00 md": "10-12 md",
  "01:00 pm a 03:00 pm": "1-3 pm", "03:00 pm a 05:00 pm": "3-5 pm",
};
const F = "Arial,Helvetica,sans-serif";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const utc = (f) => { const [y, m, d] = f.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const fechaLarga = (f) => { const t = utc(f); return DIAS[t.getUTCDay()] + " " + t.getUTCDate() + " de " + MESES[t.getUTCMonth()] + " de " + t.getUTCFullYear(); };
export const fechaCorta = (f) => { const t = utc(f); return DIAS[t.getUTCDay()].slice(0, 3).normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " " + t.getUTCDate() + " " + MESES_CORTOS[t.getUTCMonth()]; };
const fechaCR = (f) => f.split("-").reverse().join("/");
export const nombrePila = (d) => (String(d.c || "").trim() || String(d.nombre || "").trim()).split(/\s+/)[0] || "";
const colones = (v) => { const n = Number(String(v || "").replace(/\D/g, "")); return n > 0 ? "₡" + n.toLocaleString("de-DE") : ""; };
const nombresAsi = (ids) => (ids || []).map((id) => (PLANES.find((p) => p.id === id) || {}).nom).filter(Boolean);
const waIntl = (v) => { const n = String(v || "").replace(/\D/g, ""); return n.length === 8 ? "506" + n : n; };
const esCeroKm = (p) => /cero|0 ?km|nuev/i.test(String(p || "")) || !/\d/.test(String(p || ""));
const fila = (k, v) => '<tr><td style="padding:7px 10px 7px 0;border-bottom:1px solid #EDEFF2;color:#5A6570;width:42%;vertical-align:top;font-family:' + F + ';font-size:13.5px;">' + esc(k) +
  '</td><td style="padding:7px 0;border-bottom:1px solid #EDEFF2;font-weight:bold;vertical-align:top;font-family:' + F + ';font-size:13.5px;color:#1B1F23;">' + esc(v).replace(/\n/g, "<br>") + "</td></tr>";
const rotulo = (t) => '<div style="font-family:' + F + ';font-size:11px;letter-spacing:.08em;color:#6B7681;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #DADCE0;padding-bottom:5px;margin:18px 0 8px;">' + esc(t) + "</div>";
const p = (html) => '<p style="margin:0 0 14px;font-family:' + F + ';font-size:14px;line-height:1.55;color:#1B1F23;">' + html + "</p>";
const sello = (t) => '<span style="display:inline-block;background:#E9F5F0;color:#037D61;font-family:' + F + ';font-weight:bold;font-size:12.5px;border-radius:999px;padding:5px 12px;">&#9679; ' + esc(t) + "</span>";
const FILETE = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="60%" height="4" bgcolor="#0369A1"></td><td width="25%" bgcolor="#0D9488"></td><td width="10%" bgcolor="#EA580C"></td><td width="5%" bgcolor="#C9A227"></td></tr></table>';
const marco = (adentro) => '<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">' + adentro + "</table></td></tr></table></body></html>";

export function correoCliente(d) {
  const pila = nombrePila(d);
  const asi = nombresAsi(d.as);
  const placaTxt = esCeroKm(d.placa) ? "tu vehículo cero kilómetros" : "el vehículo con placa <b>" + esc(d.placa) + "</b>";
  const contacto = d.tel ? " o escribime al " + esc(d.tel) : "";
  const html = marco(
    '<tr><td bgcolor="#0C2340" align="center" style="padding:22px 24px;"><img src="' + LOGO_INS + '" alt="INS" height="26" style="height:26px;width:auto;border:0;">' +
    '<div style="color:#ffffff;font-family:' + F + ';font-size:20px;font-weight:bold;margin-top:10px;">Solicitud recibida</div>' +
    '<div style="color:#94a3b8;font-family:' + F + ';font-size:12.5px;">Seguros del INS &middot; Póliza de Automóviles</div></td></tr>' +
    "<tr><td>" + FILETE + "</td></tr>" +
    '<tr><td style="padding:22px 24px;">' +
    '<div style="font-family:' + F + ';font-size:11px;letter-spacing:.08em;color:#6B7681;font-weight:bold;">HOLA</div>' +
    '<div style="font-family:' + F + ';font-size:22px;font-weight:bold;color:#1B1F23;margin-bottom:14px;">' + esc(pila) + "</div>" +
    '<div style="margin-bottom:14px;">' + sello("Solicitud recibida") + "</div>" +
    p("Gracias por tu confianza. Recibimos tu solicitud de aseguramiento e inspección virtual para " + placaTxt + ".") +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">' +
    fila("Fecha solicitada", fechaLarga(d.fecha)) + fila("Horario", d.franja) + fila("Forma de pago", d.formaPago) +
    (asi.length ? fila("Asistencias opcionales", asi.join(" · ")) : "") + "</table>" +
    p("<b>Estamos revisando tu solicitud.</b> En breve te confirmo el espacio y te envío las instrucciones finales. Si ese horario no está disponible, nos ponemos en contacto con vos para reprogramar al espacio más cercano.") +
    rotulo("¿Qué pasará el día de tu cita?") +
    p("<b>1. Preparate.</b> A la hora agendada, tené tu vehículo a mano, limpio y en un lugar iluminado.<br><b>2. Subí tus fotos.</b> Te envío un código QR a tu correo; lo escaneás con el celular y cargás las fotos ahí mismo.<br><b>3. Aceptación.</b> Una vez revisado, te envío la póliza y la aceptás desde el celular con un token de seguridad, sin papeles.<br><b>4. Pago y listo.</b> Realizás el pago y tu vehículo queda asegurado al instante.") +
    '<p style="margin:0 0 14px;font-family:' + F + ';font-size:13px;color:#5A6570;">Podés pagar con tarjeta (enlace de pago), transferencia a cuentas del INS, SINPE Móvil o en insenlinea.grupoins.com.</p>' +
    p("Cualquier duda, respondé este correo" + contacto + ".<br><b>" + esc(d.n) + '</b><br><span style="font-size:12.5px;color:#5A6570;">Agente exclusivo del INS &middot; Licencia SUGESE ' + esc(d.l) + "</span>") +
    "</td></tr>" +
    '<tr><td bgcolor="#0C2340" align="center" style="padding:18px;font-family:' + F + ';font-size:11.5px;color:#94a3b8;"><img src="' + LOGO_SDI + '" alt="Seguros Digitales SDI" height="34" style="height:34px;width:auto;border:0;display:block;margin:0 auto 8px;">Plataforma tecnológica Seguros Digitales SDI</td></tr>'
  );
  const texto = [
    "Hola " + pila + ",", "",
    "Recibimos tu solicitud de aseguramiento e inspección virtual" + (esCeroKm(d.placa) ? "." : " para el vehículo con placa " + d.placa + "."),
    "Fecha solicitada: " + fechaLarga(d.fecha), "Horario: " + d.franja, "Forma de pago: " + d.formaPago,
    asi.length ? "Asistencias opcionales: " + asi.join(", ") : null, "",
    "Estamos revisando tu solicitud. En breve te confirmo el espacio. Si ese horario no está disponible, nos ponemos en contacto con vos para reprogramar al espacio más cercano.", "",
    d.n, "Agente exclusivo del INS - Licencia SUGESE " + d.l,
  ].filter((x) => x !== null).join("\n");
  return { asunto: "Recibimos tu solicitud de cita · " + (esCeroKm(d.placa) ? "0 KM" : d.placa), html, texto };
}

export function correoAgente(d, opc) {
  const avisado = !opc || opc.clienteAvisado !== false;
  const asi = nombresAsi(d.as);
  const primas = [["Anual", d.pa], ["Semestral", d.ps], ["Trimestral", d.pt]].map(([k, v]) => colones(v) ? k + " " + colones(v) : "").filter(Boolean).join(" · ");
  const veh = [d.v, d.y].filter(Boolean).join(" ");
  const placaAsunto = esCeroKm(d.placa) ? "0 KM" : d.placa;
  const wa = waIntl(d.telefono);
  // El mensaje que el agente le manda al cliente desde el botón (JC, 19 set 2026). WhatsApp lo abre
  // EDITABLE: si el espacio no se puede, el agente lo corrige antes de enviar. Dos palabras del nombre
  // del agente y no una: "Juan Carlos", no "Juan".
  const agenteCorto = String(d.n).trim().split(/\s+/).slice(0, 2).join(" ");
  const textoWa = "Hola " + nombrePila(d) + ", soy " + agenteCorto + ", tu agente del INS. Recibí tu solicitud de aseguramiento para el " +
    fechaLarga(d.fecha) + ", de " + d.franja + ", y te confirmo el espacio.\n\n" +
    "Ese día, a primera hora, te enviamos a tu correo un código QR para iniciar el aseguramiento: lo escaneás con el celular y subís las fotos del vehículo ahí mismo.\n\n" +
    "Cualquier duda, escribime por aquí.";
  const copiar = [
    [d.nombre, d.telefono, d.correo].join(" | "), d.direccion.replace(/\s*\n\s*/g, " "),
    [d.ocupacion || "—", d.ingreso || "—", d.placa, d.formaPago].join(" | "),
    "Cita: " + fechaCR(d.fecha) + " · " + d.franja + (asi.length ? " | Asistencias: " + asi.join(", ") : ""),
  ].join("\n");
  const html = marco(
    '<tr><td style="padding:22px 24px;">' +
    '<div style="margin-bottom:10px;">' + sello("Cita solicitada") + "</div>" +
    '<div style="font-family:' + F + ';font-size:22px;font-weight:bold;color:#1B1F23;">' + esc(fechaCorta(d.fecha)) + " &middot; " + esc(d.franja) + "</div>" +
    (avisado ? "" : '<div style="margin-top:12px;background:#FBF3DC;color:#7C5A00;border-top:3px solid #C9A227;padding:10px 12px;font-family:' + F + ';font-size:13px;">No se pudo enviar la confirmación al cliente. Avisale vos que recibiste su solicitud.</div>') +
    rotulo("Respuestas del cliente") +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    fila("Nombre Completo", d.nombre) + fila("Correo", d.correo) + fila("Número de Teléfono", d.telefono) +
    fila("Dirección Domicilio", d.direccion) + fila("Ocupación u Oficio", d.ocupacion || "—") +
    fila("Ingreso Mensual Promedio", d.ingreso || "—") + fila("Número de Placa", d.placa) +
    fila("Forma de pago", d.formaPago) + fila("Fecha", fechaCR(d.fecha)) + fila("Rango de horas", d.franja) + "</table>" +
    rotulo("De la cotización") +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    (veh ? fila("Vehículo", veh) : "") + (primas ? fila("Primas cotizadas", primas) : "") +
    fila("Asistencias opcionales", asi.length ? asi.join(" · ") : "Ninguna") + "</table>" +
    (wa ? '<p style="margin:18px 0 0;"><a href="https://web.whatsapp.com/send/?phone=' + wa + "&amp;text=" + encodeURIComponent(textoWa) + '" style="display:inline-block;background:#0369A1;color:#ffffff;text-decoration:none;font-family:' + F + ';font-weight:bold;border-radius:999px;padding:11px 20px;font-size:13.5px;">Escribirle por WhatsApp</a></p>' : "") +
    rotulo("Para copiar y pegar") +
    '<div style="background:#F8F9FA;border:1px dashed #8A939C;padding:12px;font-family:Consolas,Courier,monospace;font-size:12.5px;line-height:1.6;color:#1B1F23;white-space:pre-wrap;">' + esc(copiar) + "</div>" +
    "</td></tr>"
  );
  return {
    asunto: ["Cita solicitada", placaAsunto, fechaCorta(d.fecha), FRANJA_CORTA[d.franja] || d.franja, d.nombre].join(" · "),
    html,
    texto: "CITA SOLICITADA\n" + fechaLarga(d.fecha) + " · " + d.franja + "\n\n" + copiar + (veh ? "\nVehículo: " + veh : "") + (primas ? "\nPrimas: " + primas : "") + (avisado ? "" : "\n\nNo se pudo enviar la confirmación al cliente."),
  };
}
