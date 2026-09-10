/**
 * Cotizador SDI · Aviso "Qué hay de nuevo"
 *
 * Transcripción del patrón de la consola de Viajero (28 ago 2026): al abrir la
 * consola tras una actualización, UNA tarjeta cuenta qué cambió (los textos
 * viven en CFG.NOVEDADES, una sola fuente). "Entendido" guarda la versión vista
 * en localStorage y no vuelve a aparecer hasta la próxima. Si el localStorage
 * se pierde (limpiadores), el aviso reaparece: inofensivo.
 *
 * Solo depende de CFG. Lleva su propio escape, como stats-ui.js y
 * email-marca.js, para no depender del orden de carga.
 */

const LS_NOVEDADES = 'cotizador_sdi_novedades_v1';

function _escNov(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Pinta la tarjeta en #novedades si hay una versión que el agente no vio. */
function mostrarNovedades() {
  const box = document.getElementById('novedades');
  const N = (typeof CFG !== 'undefined') ? CFG.NOVEDADES : null;
  if (!box || !N || !N.version || !(N.items || []).length) return;
  let visto = null; try { visto = localStorage.getItem(LS_NOVEDADES); } catch (e) {}
  if (visto === N.version) return;

  // Los items son HTML de confianza (salen de config.js, no del usuario).
  box.innerHTML =
    '<div class="nov-head">' +
      '<p class="nov-rotulo">Qué hay de nuevo · ' + _escNov(N.fecha || '') + '</p>' +
      '<button type="button" class="btn btn-secondary nov-ok" id="btnNovedadesOk">Entendido</button>' +
    '</div>' +
    '<ul class="nov-lista">' + N.items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  box.hidden = false;
  document.getElementById('btnNovedadesOk').addEventListener('click', novedadesVisto);
}

/** "Entendido": marca la versión como vista y quita la tarjeta. */
function novedadesVisto() {
  marcarNovedadesVistas();
  const box = document.getElementById('novedades');
  if (box) { box.hidden = true; box.innerHTML = ''; }
}

/**
 * Marca la versión actual como vista sin mostrar nada. Para el agente que entra
 * por primera vez: no conoció la versión anterior, así que el aviso no le dice nada.
 */
function marcarNovedadesVistas() {
  try { localStorage.setItem(LS_NOVEDADES, ((typeof CFG !== 'undefined' && CFG.NOVEDADES) || {}).version || ''); } catch (e) {}
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mostrarNovedades, novedadesVisto, marcarNovedadesVistas, LS_NOVEDADES };
}
