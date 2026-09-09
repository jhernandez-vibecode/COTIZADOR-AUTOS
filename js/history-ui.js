/**
 * Cotizador SDI · Historial de envíos (modal 🕘)
 *
 * Lista las cotizaciones enviadas desde este navegador, con el enlace de la
 * guía, copiar al portapapeles y compartir por WhatsApp. La capa de datos vive
 * en history.js; acá solo va el render y sus handlers.
 *
 * Se separó de app.js el 9 set 2026, en la revisión de calidad, junto con
 * datos-ui.js y después de stats-ui.js.
 *
 * ⚠️ Esta pantalla y el 📊 (stats-ui.js) muestran LA MISMA cotización con dos
 * modelos distintos: acá "Vigente · Nd / Vencida" (los 15 días que vale una
 * cotización del INS) y allá "Con póliza / Sin póliza". Quedó pendiente de
 * decidir con JC si las dos pantallas siguen teniendo sentido por separado.
 *
 * Orden de carga: después de history.js y shortlink.js, antes de app.js.
 */

/**
 * Escapa texto para insertarlo como HTML. Local a propósito: el mismo criterio
 * de stats-ui.js con `_esc` y de email-marca.js con `_escMarca`. Son cinco
 * líneas; a cambio, el módulo no depende de que app.js haya cargado antes y se
 * puede probar en Node sin montar la app entera.
 */
function _escHist(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openHistoryModal() {
  renderHistory();
  document.getElementById('historyModal').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('active');
}

/**
 * Pinta la lista del historial. La cotizacion INS vale 15 dias —
 * cada fila muestra cuantos dias le quedan.
 */
function renderHistory() {
  const list = document.getElementById('historyList');
  const entries = loadHistoryVivas();

  if (!entries.length) {
    list.innerHTML =
      '<div class="history-empty">Aún no has enviado cotizaciones desde este navegador.</div>' +
      '<div style="margin-top:14px;text-align:center;">' +
        '<p style="margin:0 0 8px;font-size:12px;color:var(--gray-500,#64748b);">' +
          '¿Ya usabas la app antes o limpiaste este navegador? Recuperá tu control desde tu Google Drive:</p>' +
        '<button class="btn btn-secondary" id="btnHistoryRestore" type="button">☁️ Restaurar de Drive</button>' +
      '</div>';
    var _hr = document.getElementById('btnHistoryRestore');
    if (_hr) _hr.addEventListener('click', driveRestoreNow);
    return;
  }

  list.innerHTML = entries.map(function (e, i) {
    const sent = new Date(e.date);
    const daysLeft = 15 - Math.floor((Date.now() - sent.getTime()) / 86400000);
    const badge = daysLeft > 0
      ? '<span class="history-badge ok">Vigente · ' + daysLeft + 'd</span>'
      : '<span class="history-badge off">Vencida</span>';
    const fecha = sent.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
    return '<div class="history-item">' +
      '<div class="history-main">' +
        '<div class="history-title">' + _escHist(historyClientName(e) || '(sin nombre)') +
          (e.plate ? ' · ' + _escHist(e.plate) : '') + ' ' + badge + '</div>' +
        '<div class="history-meta">' + fecha + ' · ' + _escHist(e.email || '') +
          (e.vehicle ? ' · ' + _escHist(e.vehicle) : '') + '</div>' +
      '</div>' +
      '<div class="history-actions">' +
        '<a class="history-btn" href="' + _escHist(e.guideUrl || '#') + '" target="_blank" rel="noopener" title="Abrir la guía explicada">🔗</a>' +
        '<button class="history-btn" data-copy="' + i + '" title="Copiar link de la guía">📄</button>' +
        '<a class="history-btn" data-wa="' + i + '" href="' + _escHist(buildWaShareUrl(e)) + '" target="_blank" rel="noopener" title="Compartir por WhatsApp">💬</a>' +
      '</div>' +
    '</div>';
  }).join('');

  // Compartir por WhatsApp desde el historial: mismo acortado que la vista 4.
  // El href queda con el link largo como respaldo por si el JS no corre.
  list.querySelectorAll('a[data-wa]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      const e = entries[parseInt(a.dataset.wa, 10)];
      if (!e || !e.guideUrl) return;
      ev.preventDefault();
      const win = window.open('', '_blank');   // reservar ANTES del await
      acortarGuia(e.guideUrl).then(function (corto) {
        const url = buildWaShareUrl(e, null, corto);
        if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
      });
    });
  });

  // Botones de copiar (delegado simple por data-copy)
  list.querySelectorAll('button[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const e = entries[parseInt(btn.dataset.copy, 10)];
      if (!e || !e.guideUrl) return;
      // Se copia el link CORTO: es el que el cliente ve crudo al pegarlo.
      acortarGuia(e.guideUrl).then(function (corto) {
        navigator.clipboard.writeText(corto).then(function () {
          showToast('Link de la guía copiado.', 'success');
        }, function () {
          // Tras el await el navegador puede negar el portapapeles.
          window.prompt('Copiá el link manualmente:', corto);
        });
      });
    });
  });
}

// Export para tests en Node. En el navegador no existe `module`.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHistory: renderHistory, _escHist: _escHist };
}
