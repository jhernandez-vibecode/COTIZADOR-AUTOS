/**
 * Cotizador SDI · Toasts de notificación
 *
 * Reemplaza los alert() nativos por notificaciones no bloqueantes con
 * estilo de marca. Sin dependencias — inyecta sus propios estilos.
 *
 * API publica:
 *   - showToast(msg, type) — type: 'info' (default) | 'success' | 'error'
 *
 * Cargar ANTES que cualquier modulo que lo use (es autonomo, puede ir
 * primero en el orden de scripts).
 */
(function () {
  const CSS = [
    '.sdi-toast-wrap { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
    '  z-index: 9999; display: flex; flex-direction: column; gap: 8px; align-items: center;',
    '  pointer-events: none; max-width: min(520px, calc(100vw - 32px)); }',
    '.sdi-toast { background: #0c2340; color: #fff; padding: 12px 18px; border-radius: 10px;',
    '  font-family: inherit; font-size: 13px; line-height: 1.45; box-shadow: 0 8px 24px rgba(12,35,64,.25);',
    '  border-left: 4px solid #0369a1; opacity: 0; transform: translateY(8px);',
    '  transition: opacity .25s ease-out, transform .25s ease-out; pointer-events: auto; }',
    '.sdi-toast.show { opacity: 1; transform: translateY(0); }',
    '.sdi-toast.success { border-left-color: #16a34a; }',
    '.sdi-toast.error   { border-left-color: #dc2626; }'
  ].join('\n');

  let wrap = null;

  function ensureWrap() {
    if (wrap && document.body.contains(wrap)) return wrap;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    wrap = document.createElement('div');
    wrap.className = 'sdi-toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
    return wrap;
  }

  /**
   * Muestra una notificación temporal.
   * @param {string} msg  - texto plano (no HTML)
   * @param {string} [type] - 'info' | 'success' | 'error'
   */
  window.showToast = function (msg, type) {
    const w = ensureWrap();
    // Maximo 3 toasts visibles — el mas viejo se va
    while (w.children.length >= 3) w.removeChild(w.firstChild);
    const t = document.createElement('div');
    t.className = 'sdi-toast' + (type === 'success' || type === 'error' ? ' ' + type : '');
    t.textContent = String(msg == null ? '' : msg);
    w.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    const ms = type === 'error' ? 6000 : 4000;
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, ms);
  };
})();
