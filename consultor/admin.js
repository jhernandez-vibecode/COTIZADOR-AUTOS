/**
 * Administracion del corpus del Consultor.
 *
 * Muestra el inventario de lo publicado y compara un PDF nuevo del INS contra
 * el corpus vigente, pagina por pagina. NO publica ni re-secciona: el
 * seccionador es Python (pymupdf4llm para las tablas) y Netlify corre
 * JavaScript. Esta pantalla sirve para DECIDIR si vale la pena regenerar.
 *
 * El texto del PDF se extrae aca con pdf.js — la misma libreria que el
 * cotizador ya usa para leer las cotizaciones — y se manda ya extraido, para
 * que la funcion no necesite libreria de PDF.
 */
(function () {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
  var ST = { token: null, cliente: null, rechazar: null, datos: null };
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pedirToken() {
    return new Promise(function (resolve, reject) {
      if (!window.google || !google.accounts || !google.accounts.oauth2) {
        reject(new Error('Google todavía no cargó. Recargá la página.')); return;
      }
      var clientId = (typeof CFG !== 'undefined' && CFG.CLIENT_ID) || '';
      if (!clientId) { reject(new Error('No se cargó js/config.js.')); return; }
      if (!ST.cliente) {
        ST.cliente = google.accounts.oauth2.initTokenClient({
          client_id: clientId, scope: SCOPE, callback: function () {},
          // Sin error_callback, un popup bloqueado deja la Promise colgada.
          error_callback: function (err) {
            var t = (err && err.type) || 'error';
            if (ST.rechazar) {
              var rj = ST.rechazar; ST.rechazar = null;
              rj(new Error(t === 'popup_closed'
                ? 'Cerraste la ventana de Google.'
                : 'El navegador bloqueó la ventana de Google (' + t + ').'));
            }
          }
        });
      }
      ST.rechazar = reject;
      ST.cliente.callback = function (r) {
        ST.rechazar = null;
        if (r.error) { reject(new Error(r.error_description || r.error)); return; }
        ST.token = r.access_token; resolve(r.access_token);
      };
      try { ST.cliente.requestAccessToken({ prompt: '' }); }
      catch (e) { ST.rechazar = null; reject(e); }
    });
  }

  async function cargarInventario() {
    var r = await fetch('/api/corpus?token=' + encodeURIComponent(ST.token));
    if ((r.headers.get('content-type') || '').indexOf('json') === -1) {
      throw new Error('La función de administración no está publicada (HTTP ' + r.status + ').');
    }
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    ST.datos = d;

    $('notaReproceso').innerHTML =
      '<b>El corpus no se regenera desde acá.</b> ' + esc(d.reproceso.motivo) +
      ' Cuando el diff muestre cambios: reemplazá el PDF en el repo, corré el procesador y hacé push. ' +
      'Netlify publica el corpus nuevo solo.<pre>' + esc(d.reproceso.comando) + '</pre>';

    var filas = d.documentos.map(function (x) {
      return '<tr>' +
        '<td><b>' + esc(x.titulo) + '</b>' +
          (x.publico ? '' : ' <span class="tag priv">interno</span>') +
          '<div style="color:var(--mute);font-size:12px;margin-top:2px">' +
            esc(x.id) + ' · ' + esc(x.version || 's/v') +
            (x.vigencia_desde ? ' · desde ' + esc(x.vigencia_desde) : '') +
          '</div></td>' +
        '<td class="num">' + x.paginas + '</td>' +
        '<td class="num">' + x.secciones + '</td>' +
        '<td class="num">' + x.con_tabla + '</td>' +
        '<td class="num">' + x.mediana_chars.toLocaleString('de-DE') + '</td>' +
        '<td class="num">' + (x.grandes ? '<span class="tag">' + x.grandes + '</span>' : '—') + '</td>' +
      '</tr>';
    }).join('');

    $('tabla').innerHTML =
      '<table><thead><tr><th>Documento</th><th class="num">Págs</th><th class="num">Secciones</th>' +
      '<th class="num">Con tabla</th><th class="num">Mediana</th><th class="num">Grandes</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table>' +
      '<div style="padding:12px 18px;color:var(--mute);font-size:13px;border-top:1px solid var(--line)">' +
        'Corpus <b>' + esc(d.version_corpus) + '</b> · ' + d.total_secciones + ' secciones en total</div>';

    $('doc').innerHTML = d.documentos.map(function (x) {
      return '<option value="' + esc(x.id) + '">' + esc(x.titulo) + '</option>';
    }).join('');
  }

  /** Texto por página con pdf.js, la misma librería que usa el cotizador. */
  async function textoPorPagina(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      (typeof CFG !== 'undefined' && CFG.PDFJS_WORKER) ||
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var buf = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    var out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var tc = await page.getTextContent();
      out.push(tc.items.map(function (it) { return it.str; }).join(' '));
    }
    return out;
  }

  async function comparar() {
    var file = $('pdf').files[0];
    if (!file) return;
    var btn = $('btnDiff');
    btn.disabled = true; btn.textContent = 'Leyendo el PDF…';
    $('diff').innerHTML = '';
    try {
      var paginas = await textoPorPagina(file);
      btn.textContent = 'Comparando…';
      var r = await fetch('/api/corpus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: ST.token, documento: $('doc').value, paginas: paginas })
      });
      if ((r.headers.get('content-type') || '').indexOf('json') === -1) {
        throw new Error('El servidor cortó la comparación (HTTP ' + r.status + ').');
      }
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
      pintarDiff(d);
    } catch (e) {
      $('diff').innerHTML = '<div class="nota">' + esc(e.message || e) + '</div>';
    } finally {
      btn.disabled = false; btn.textContent = 'Comparar';
    }
  }

  function pintarDiff(d) {
    var sinCambios = !d.cambios.length;
    var html = '<div class="nota' + (sinCambios ? ' ok' : '') + '">' + esc(d.resumen) + '</div>';

    if (!sinCambios) {
      html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute);' +
              'font-weight:700;margin:0 0 8px">Páginas que cambiaron</div>';
      html += d.cambios.slice(0, 40).map(function (ch) {
        var s = '<div class="chg ' + esc(ch.tipo) + '"><b>Página ' + ch.pagina + '</b> · ' + esc(ch.tipo);
        if (ch.entran && ch.entran.length) s += '<div class="w"><b>entra:</b> ' + esc(ch.entran.join(', ')) + '</div>';
        if (ch.salen && ch.salen.length)  s += '<div class="w"><b>sale:</b> ' + esc(ch.salen.join(', ')) + '</div>';
        return s + '</div>';
      }).join('');
      if (d.cambios.length > 40) {
        html += '<div style="color:var(--mute);font-size:13px">…y ' + (d.cambios.length - 40) + ' páginas más.</div>';
      }

      if (d.secciones_afectadas.length) {
        html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute);' +
                'font-weight:700;margin:18px 0 8px">Secciones que hay que revisar (' + d.secciones_afectadas.length + ')</div>';
        html += '<table><tbody>' + d.secciones_afectadas.slice(0, 60).map(function (s) {
          return '<tr><td class="num" style="color:var(--mute)">p' + s.pagina_desde + '</td><td>' + esc(s.ruta) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
    }
    $('diff').innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('btnEntrar').onclick = async function () {
      $('gateMsg').textContent = '';
      try {
        await pedirToken();
        await cargarInventario();
        $('gate').hidden = true;
        $('app').hidden = false;
      } catch (e) {
        $('gateMsg').textContent = 'No se pudo entrar: ' + (e.message || e);
      }
    };
    $('pdf').onchange = function () { $('btnDiff').disabled = !this.files.length; };
    $('btnDiff').onclick = comparar;
  });
})();
