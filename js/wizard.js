/**
 * Cotizador SDI · Piezas compartidas por los tres asistentes de la consola
 *
 * Las tres pantallas de envío —cotización (index.html), póliza activa y
 * renovación confirmada— son el mismo asistente de 4 pasos con distinto
 * contenido. Hasta el 9 set 2026 compartían código por copia:
 *
 *   - `setStep()` estaba BYTE A BYTE IDÉNTICO en poliza-app.js y
 *     renovacion-app.js.
 *   - El regex del correo estaba **cinco veces** (app.js ×3, poliza, renovación).
 *   - El reintento de token vencido estaba duplicado literal en dos… y
 *     **faltaba en el cotizador**: si el token se vencía a mitad del envío de una
 *     cotización, el envío moría y había que volver a subir el PDF. En póliza y
 *     renovación se reintentaba solo. Esa inconsistencia se cierra acá.
 *
 * Sale de la revisión de calidad del 9 set 2026. Mismo criterio que
 * `email-marca.js` con los tres correos: una sola copia de lo que ya era común.
 *
 * Orden de carga: después de `gmail-auth.js` (usa getToken/sendEmail/clearToken
 * en tiempo de ejecución) y antes del `*-app.js` de cada pantalla.
 */

/**
 * ¿Es una dirección de correo con forma válida?
 *
 * Deliberadamente laxo: `algo@algo.algo`. No valida que exista ni sigue el RFC —
 * eso lo resuelve el rebote de Gmail. Solo ataja el dedazo antes de que el
 * agente crea que el correo salió.
 *
 * @param {string} v
 * @returns {boolean}
 */
function esEmailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v == null ? '' : v).trim());
}

/**
 * Separa un campo "Para" que puede traer varios correos por coma y devuelve los
 * que NO son válidos. Vacío = todos bien.
 *
 * Lo usa /renovaciones/, donde un plan familiar se le manda a esposo y esposa.
 *
 * @param {string} v
 * @returns {string[]} los correos mal escritos, tal como los tecleó el agente
 */
function correosInvalidos(v) {
  return String(v == null ? '' : v)
    .split(',')
    .map(function (c) { return c.trim(); })
    .filter(function (c) { return c && !esEmailValido(c); });
}

/**
 * Envía por Gmail reintentando UNA vez si el token se venció a mitad.
 *
 * El caso real: el agente deja la pantalla abierta un rato largo, el token de
 * Google caduca, y al darle Enviar el primer intento devuelve 401. Sin esto, el
 * correo se pierde y hay que rehacer el flujo entero — en el cotizador eso
 * significa volver a subir el PDF.
 *
 * Un solo reintento a propósito: si el segundo también falla, el problema no es
 * el token y hay que mostrarle el error al agente.
 *
 * @param {string} raw - mensaje MIME en base64url
 * @returns {Promise<void>}
 */
async function enviarConReintento(raw) {
  await getToken();
  try {
    await sendEmail(raw);
  } catch (err) {
    if (!/\b401\b|expir|token/i.test(err.message || '')) throw err;
    clearToken();
    await getToken();
    await sendEmail(raw);
  }
}

/**
 * Pinta el paso `n` del asistente: muestra su vista, marca el indicador de
 * pasos (activo / hechos) y sube la pantalla.
 *
 * Espera el marcado de las tres pantallas: `.view` con id `viewN`, y
 * `#stepNav .step` con `data-step`.
 *
 * NO toca el estado del módulo que la llama — cada pantalla guarda su propio
 * `state.step`, así que el llamador hace `state.step = n` y luego llama acá.
 *
 * @param {number} n
 */
function wizardSetStep(n) {
  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) {
    views[i].classList.toggle('active', views[i].id === ('view' + n));
  }
  var steps = document.querySelectorAll('#stepNav .step');
  for (var j = 0; j < steps.length; j++) {
    var s = parseInt(steps[j].getAttribute('data-step'), 10);
    steps[j].classList.toggle('active', s === n);
    steps[j].classList.toggle('done', s < n);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Export para tests en Node. En el navegador no existe `module`.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esEmailValido: esEmailValido,
    correosInvalidos: correosInvalidos,
    enviarConReintento: enviarConReintento,
    wizardSetStep: wizardSetStep
  };
}
