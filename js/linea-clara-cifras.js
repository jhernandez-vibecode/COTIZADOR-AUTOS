/* ==========================================================================
   linea-clara-cifras.js — Regla 9: las cifras suben desde cero UNA sola vez
   --------------------------------------------------------------------------
   Transcrito de ebi-polizas/assets/kpi-cinta.js (en producción desde el
   9 sep 2026). Único cambio: el selector es genérico — cualquier elemento
   con el atributo data-cifra — para servir a todas las apps SDI.

   No calcula NADA. La app sigue escribiendo el valor final en el mismo id de
   siempre; este archivo solo observa ese cambio y hace que la cifra suba
   desde cero una única vez, la primera vez que aparece.

   Por qué con MutationObserver y no llamando a una función: así no hay que
   tocar el JS de ninguna app. Si este archivo no carga, las cifras se ven
   igual, quietas.

   Uso: <span id="statPrima" data-cifra>…</span> + <script src="linea-clara-cifras.js" defer>
   Respeta `prefers-reduced-motion`. Se carga con defer.
   ========================================================================== */
(function () {
  'use strict';

  var DURACION = 900;
  var quieto = false;
  try {
    quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  // "₡3.646.202.751" → { prefijo:'₡', n:3646202751 } · "67" → { prefijo:'', n:67 }
  function leerCifra(texto) {
    var t = String(texto || '').trim();
    if (!t || t === '—') return null;
    var digitos = t.replace(/[^\d]/g, '');
    if (!digitos) return null;
    var i = t.search(/\d/);
    return { prefijo: t.slice(0, i), sufijo: '', n: parseInt(digitos, 10), original: t };
  }

  function agrupar(n) {
    try { return n.toLocaleString('de-DE'); } catch (e) { return String(n); }
  }

  function animar(el, dato) {
    var t0 = null;
    el.classList.add('is-entrando');
    // Forzar el primer frame antes de soltar la transición de opacidad.
    requestAnimationFrame(function paso(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / DURACION);
      var s = 1 - Math.pow(1 - p, 3);          // salida suave, sin sobrepaso
      el.style.opacity = String(Math.min(1, p * 2.2));
      el.style.transform = 'translateY(' + (6 * (1 - s)).toFixed(2) + 'px)';
      el.textContent = dato.prefijo + agrupar(Math.round(dato.n * s));
      if (p < 1) {
        requestAnimationFrame(paso);
      } else {
        el.textContent = dato.original;        // el valor exacto que escribió la app
        el.classList.remove('is-entrando');
        el.style.opacity = '';
        el.style.transform = '';
        el.style.willChange = '';
      }
    });
  }

  function vigilar(el) {
    if (el.dataset.animado === 'si') return;

    var intentar = function () {
      if (el.dataset.animado === 'si') return true;
      var dato = leerCifra(el.textContent);
      if (!dato) return false;
      el.dataset.animado = 'si';
      if (quieto) return true;                 // se queda con el valor final, quieto
      animar(el, dato);
      return true;
    };

    if (intentar()) return;

    var obs = new MutationObserver(function () {
      if (intentar()) obs.disconnect();
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });

    // Red de seguridad: si en 6 s nadie escribió nada, se deja de observar.
    setTimeout(function () { obs.disconnect(); }, 6000);
  }

  function iniciar() {
    var cifras = document.querySelectorAll('[data-cifra]');
    for (var i = 0; i < cifras.length; i++) vigilar(cifras[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
