// =====================================================================
// Vigia del formulario de cotizacion: alarma por SILENCIO (JC, 8 nov 2026)
// ---------------------------------------------------------------------
// Corre cada hora (netlify/functions/cotizar-vigia.mjs). En dia habil, de 8:00 am
// a 5:00 pm hora de Costa Rica, mira cuando entro la ultima solicitud (clave
// `ultima` del store "cotizar", la escribe lib/cotizar-handler.mjs). Si en la
// jornada de hoy pasaron SILENCIO_HORAS sin ninguna, le escribe a JC
// (COTIZAR_ADMIN): el enlace, la pagina o los anuncios pueden estar fallando.
//
// La noche y el fin de semana NO cuentan: el silencio se mide desde lo que pase
// ultimo entre la ultima solicitud y las 8:00 am de hoy.
// Una sola alerta por silencio: se guarda en `alerta-silencio` la `ultima` que
// ya se aviso; hasta que entre otra solicitud no vuelve a escribir.
// =====================================================================
import { esHabil, HORARIO } from "./horario.mjs";
import { abrirStore } from "./agentes.mjs";
import { direccionDe, enviarCorreo } from "./http.mjs";
import { normCorreo } from "./cotizar-reparto.mjs";

export const SILENCIO_HORAS = 3;
const H = 3600e3;
const PAGINA = "https://cotizador.appsegurosdigitales.com/cotizar/";

/** "8 nov 2026, 10:15 am" de un instante, en hora de Costa Rica. */
const horaCR = (t) => new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
}).format(t).replace(/\s*a\.\s*m\./, " am").replace(/\s*p\.\s*m\./, " pm").replace(/\./g, "").replace(/\s+/g, " ");

/**
 * @param {{getStore:Function, fetchFn?:Function, env?:object, ahora?:()=>Date}} deps
 * @returns {() => Promise<object>}  lo que decidio (para el log y el test)
 */
export function crearVigia(deps) {
  const fetchFn = deps.fetchFn || fetch;
  const env = deps.env || process.env;
  const ahora = deps.ahora || (() => new Date());

  return async function vigia() {
    const now = ahora();
    const cr = new Date(now.getTime() - 6 * H);   // getters UTC = hora de Costa Rica
    const hora = cr.getUTCHours();
    if (!esHabil(cr) || hora < HORARIO.abre || hora > HORARIO.cierra) return { revisa: false };

    const apiKey = env.CITA_API_KEY, from = env.CITA_FROM, admin = normCorreo(env.COTIZAR_ADMIN);
    if (!apiKey || !from || !admin) { console.error("[vigia] faltan variables de entorno"); return { revisa: false, error: "env" }; }
    const store = abrirStore(deps.getStore);

    const ultima = await store.get("ultima");
    if (!ultima) { await store.set("ultima", now.toISOString()); return { revisa: true, alerta: false, motivo: "primera vez" }; }
    // Inicio de la jornada de hoy: 8:00 am CR = 14:00 UTC.
    const inicio = Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate(), HORARIO.abre) + 6 * H;
    const desde = Math.max(Date.parse(ultima), inicio);
    const horas = (now.getTime() - desde) / H;
    if (horas < SILENCIO_HORAS) return { revisa: true, alerta: false, horas };
    if ((await store.get("alerta-silencio")) === ultima) return { revisa: true, alerta: false, yaAvisada: true, horas };

    const ult = horaCR(new Date(ultima));
    const texto = "No ha entrado ninguna solicitud por el formulario de cotización desde el " + ult + ".\n\n" +
      "Puede que el enlace, la página o los anuncios estén fallando. Revisá:\n" +
      "1. Que la página abra: " + PAGINA + "\n" +
      "2. Que los anuncios y los botones del sitio lleven a esa página.\n" +
      "3. Si todo abre bien, mandá una solicitud de prueba y fijate si te llega.\n\n" +
      "Si fue solo un rato tranquilo, no tenés que hacer nada: no te vuelvo a escribir hasta que entre una solicitud nueva y se vuelva a quedar en silencio.";
    const html = '<div style="font:15px/1.5 Arial,sans-serif;color:#202124;max-width:560px">' +
      '<div style="background:#FEF7E0;border:1px solid #F9AB00;border-radius:8px;padding:12px 16px;font-weight:600;margin-bottom:14px">⚠ No han entrado solicitudes desde el ' + ult + "</div>" +
      "<p>Puede que el enlace, la página o los anuncios estén fallando. Revisá:</p><ol>" +
      '<li>Que la página abra: <a href="' + PAGINA + '">' + PAGINA + "</a></li>" +
      "<li>Que los anuncios y los botones del sitio lleven a esa página.</li>" +
      "<li>Si todo abre bien, mandá una solicitud de prueba y fijate si te llega.</li></ol>" +
      '<p style="color:#5F6368">Si fue solo un rato tranquilo, no tenés que hacer nada: no te vuelvo a escribir hasta que entre una solicitud nueva y se vuelva a quedar en silencio.</p></div>';
    try {
      await enviarCorreo(fetchFn, apiKey, {
        from: "Alertas · SDI <cotizaciones@" + direccionDe(from).split("@")[1] + ">", to: [admin],
        subject: "⚠ Sin solicitudes de cotización desde el " + ult, html, text: texto,
      });
    } catch (e) { console.error("[vigia] la alerta no salio", e && e.message); return { revisa: true, alerta: false, error: "correo", horas }; }
    await store.set("alerta-silencio", ultima);
    return { revisa: true, alerta: true, horas };
  };
}
