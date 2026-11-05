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
import { HORARIO, siguienteHabil } from "./horario.mjs";
import { F, LOGO_INS, LOGO_SDI, esc, colones, waIntl, fila, FILETE, marco, textoCliente, rolFirma } from "./correo-base.mjs";

export const pila = (nombre) => String(nombre || "").trim().split(/\s+/)[0] || "";
const dosNombres = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).join(" ");

const ENCABEZADO = "<tr><td>" + FILETE + "</td></tr>" +
  '<tr><td bgcolor="#0C2340" align="center" style="padding:20px 24px;"><img src="' + LOGO_INS + '" alt="INS" height="26" style="height:26px;width:auto;border:0;"></td></tr>';
const PIE = '<tr><td bgcolor="#0C2340" align="center" style="padding:18px;font-family:' + F + ';font-size:11.5px;line-height:1.5;color:#94a3b8;">' +
  '<img src="' + LOGO_SDI + '" alt="SDI Seguros Digitales INS" height="34" style="height:34px;width:auto;border:0;display:block;margin:0 auto 8px;">' +
  '<b style="color:#ffffff;">Gestionado por SDI</b><br>Seguros Digitales INS</td></tr>';
const caja = (titulo, filas) => '<div style="border:1px solid #DADCE0;border-radius:10px;padding:10px 14px;margin:0 0 14px;">' +
  '<div style="font-family:' + F + ';font-size:11px;letter-spacing:.06em;color:#6B7681;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">' + esc(titulo) + "</div>" +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + filas + "</table></div>";
const p = (html, extra) => '<p style="margin:0 0 14px;font-family:' + F + ';font-size:14px;line-height:1.55;color:#1B1F23;' + (extra || "") + '">' + html + "</p>";
const boton = (href, texto, color) => '<a href="' + esc(href) + '" style="display:inline-block;background:' + color + ';color:#ffffff;text-decoration:none;font-family:' + F + ';font-weight:bold;border-radius:999px;padding:11px 20px;font-size:14px;margin:0 6px 6px 0;">' + esc(texto) + "</a>";
const linkWa = (num, texto) => "https://web.whatsapp.com/send/?phone=" + waIntl(num) + "&text=" + encodeURIComponent(texto);

/** Renglones bajo el nombre en la firma, en texto (la pagina /cotizar/ los muestra con pre-line). */
export const lineaCargo = (ag) => rolFirma(ag).join("\n");

/** Al CLIENTE solo le vuelve acotado lo que escribio quien lleno el formulario (5 nov 2026): no cabe un enlace. */
const paraCliente = (d) => ({ ...d, placa: textoCliente(d.placa, 12), marcaModelo: textoCliente(d.marcaModelo, 80, { decimales: true }) });

/** Recuadro del aviso fuera de horario (borde completo, sin border-left). */
const avisoHorario = (cuando) => '<div style="background:#EAF3FB;border:1px solid #BFD9EE;border-radius:10px;padding:12px 14px;margin:0 0 14px;font-family:' + F + ';font-size:14px;line-height:1.5;color:#0C2340;">' +
  "<b>Nos escribiste fuera de horario.</b><br>Atendemos de " + HORARIO.texto + ". Te enviamos la cotización <b>" + esc(cuando) + "</b>.</div>";

/**
 * Confirmacion al cliente, firmada por el agente que le toco. Version basica (opcion 2 del
 * mockup que eligio JC el 5 nov 2026: docs/superpowers/specs/2026-11-05-confirmacion-cliente-basica-mockup.html):
 * saludo, una linea con el vehiculo, cuando le llega la cotizacion, WhatsApp y firma.
 * Fuera de horario (lib/horario.mjs) agrega el recuadro con el siguiente dia habil.
 * @param {object} d  datos validados
 * @param {object} agente  la firma del agente (lib/agentes.mjs: firmaDe)
 * @param {Date} [ahora]  cuando entro la solicitud
 */
export function correoCliente(datos, agente, ahora = new Date()) {
  const d = paraCliente(datos);
  const nom = textoCliente(pila(d.nombre), 30);
  const wa = agente.whatsapp ? linkWa(agente.whatsapp, "Hola " + dosNombres(agente.nombre) + ", soy " + nom + ". Te escribo por la cotización de mi vehículo.") : "";
  const h = siguienteHabil(ahora);
  const veh = d.tipo === "usado" ? "tu vehículo placa " : "tu vehículo nuevo ";
  const vehDato = d.tipo === "usado" ? d.placa : d.marcaModelo;
  const html = marco(
    ENCABEZADO +
    '<tr><td style="padding:22px 24px;">' +
    '<div style="font-family:' + F + ';font-size:21px;font-weight:bold;color:#1B1F23;margin:0 0 12px;">¡Hola, ' + esc(nom) + "! Recibimos tu solicitud</div>" +
    p("Estoy preparando la cotización del seguro para " + veh + "<b>" + esc(vehDato) + "</b>.") +
    (h.enHorario ? p("Te la envío a este correo hoy mismo.") : avisoHorario(h.cuando)) +
    (wa ? '<p style="margin:0 0 14px;">' + boton(wa, "Escribirme por WhatsApp", "#037D61") + "</p>" : "") +
    '<div style="border-top:1px solid #EDEFF2;padding-top:12px;font-family:' + F + ';font-size:13px;line-height:1.55;color:#1B1F23;"><b style="font-size:14px;">' + esc(agente.nombre) + "</b><br>" +
    rolFirma(agente).map(esc).join("<br>") + "<br>" + [agente.whatsapp ? "WhatsApp " + esc(agente.whatsapp) : "", esc(agente.email)].filter(Boolean).join(" &middot; ") + "</div>" +
    "</td></tr>" + PIE
  );
  const texto = [
    "¡Hola, " + nom + "! Recibimos tu solicitud.", "",
    "Estoy preparando la cotización del seguro para " + veh + vehDato + ".",
    h.enHorario ? "Te la envío a este correo hoy mismo." : "Nos escribiste fuera de horario. Atendemos de " + HORARIO.texto + ". Te enviamos la cotización " + h.cuando + ".", "",
    "Si tenés alguna duda, respondé este correo" + (agente.whatsapp ? " o escribime por WhatsApp al " + agente.whatsapp : "") + ".", "",
    agente.nombre, ...rolFirma(agente), "",
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
    // Sin botón "Abrir el cotizador" (JC, 5 nov 2026: "quitemos el botón abrir cotizador").
    (waIntl(d.telefono).length >= 11 ? '<p style="margin:0 0 10px;">' + boton(linkWa(d.telefono, textoWa), "WhatsApp a " + pila(d.nombre), "#037D61") + "</p>" : "") +
    p("Solicitud del " + esc(info.fecha) + "." + (info.registrada ? " Quedó anotada en la hoja de registro." : ""), "font-size:12px;color:#6B7681;") +
    "</td></tr>" + PIE
  );
  const texto = ["NUEVA SOLICITUD DE COTIZACIÓN", "",
    ...cliente.map(([k, v]) => k + ": " + v), "", ...veh.map(([k, v]) => k + ": " + v), "",
    "Solicitud del " + info.fecha + "."].join("\n");
  // 📝 al inicio (JC, 5 nov 2026): en la bandeja se distingue de la cita (📅) sin leer el asunto.
  return { asunto: "📝 Cotización solicitada · " + vehiculoCorto(d) + " · " + d.nombre, html, texto };
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
