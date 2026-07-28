/**
 * Consultor de Autos · frontend
 *
 * Pide la identidad a Google, manda la pregunta a /api/consultar y dibuja la
 * respuesta con sus citas. La verificacion de cada cita la hace el servidor;
 * aca solo se muestra el resultado y se bloquea el envio si alguna no paso.
 *
 * El token es SEPARADO del de Gmail (scope userinfo.email, no gmail.send) para
 * no arriesgar el envio de correos del cotizador, igual que hace drive-sync.js
 * con el de Drive.
 */
(function () {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
  var S = { token: null, cliente: null, ultima: null, vista: 'interna' };

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, ms) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2600);
  }

  // ───────────────────────────────────────────────────────────── identidad

  function pedirToken() {
    return new Promise(function (resolve, reject) {
      if (!window.google || !google.accounts || !google.accounts.oauth2) {
        reject(new Error('Google todavía no cargó. Recargá la página.'));
        return;
      }
      // config.js declara "const CFG", y las const NO se cuelgan de window —
      // hay que referenciar CFG directo, como hace app.js. Con window.CFG
      // llegaba vacio y Google contestaba "Missing required parameter client_id".
      var clientId = (typeof CFG !== 'undefined' && CFG.CLIENT_ID) || '';
      if (!clientId) {
        reject(new Error('No se cargó la configuración (js/config.js). Recargá la página.'));
        return;
      }
      if (!S.cliente) {
        S.cliente = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: function () {}
        });
      }
      S.cliente.callback = function (r) {
        if (r.error) { reject(new Error(r.error_description || r.error)); return; }
        S.token = r.access_token;
        resolve(r.access_token);
      };
      try {
        // prompt vacio = reuso silencioso si ya autorizo antes
        S.cliente.requestAccessToken({ prompt: '' });
      } catch (e) { reject(e); }
    });
  }

  // ─────────────────────────────────────────────────────────────── consulta

  function tarjetaPasos(fase, n) {
    var buscar = fase === 'buscar';
    return '<div class="card"><div class="body">' +
      '<div class="think"><span class="dots"><span></span><span></span><span></span></span> ' +
      (buscar ? 'Buscando en el corpus…' : 'Leyendo las cláusulas completas…') + '</div>' +
      '<div class="step">' +
      (buscar
        ? '<div class="now">→ Encontrando las secciones que aplican</div>' +
          '<div class="next">· Leyendo las cláusulas completas</div>'
        : '<div class="done">✓ Encontró ' + n + (n === 1 ? ' sección relevante' : ' secciones relevantes') + '</div>' +
          '<div class="now">→ Leyendo las cláusulas y armando la respuesta</div>') +
      '<div class="next">· Verificando las citas contra el documento</div>' +
      '</div></div></div>';
  }

  /**
   * Fetch que no explota si el servidor devuelve HTML en vez de JSON — que es
   * lo que manda el gateway de Netlify cuando corta la funcion por limite de
   * tiempo (el famoso "Unexpected token '<'").
   */
  async function llamar(payload) {
    var r = await fetch('/api/consultar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if ((r.headers.get('content-type') || '').indexOf('json') === -1) {
      throw new Error('El servidor cortó la consulta a medias (HTTP ' + r.status +
        '), casi seguro por el límite de tiempo. Volvé a intentar.');
    }
    return { status: r.status, body: await r.json() };
  }

  /** Reintenta UNA vez con token nuevo si el actual venció (dura 1 hora). */
  async function conToken(payload) {
    if (!S.token) await pedirToken();
    payload.token = S.token;
    var res = await llamar(payload);
    if (res.status === 403) {
      S.token = null;
      await pedirToken();
      payload.token = S.token;
      res = await llamar(payload);
    }
    return res;
  }

  // La consulta va en DOS llamadas (buscar y despues responder) porque las
  // funciones de Netlify tienen un limite de tiempo corto y las dos etapas
  // juntas en una sola invocacion se pasaban del limite.
  async function consultar(pregunta) {
    var out = $('out');
    out.innerHTML = tarjetaPasos('buscar', 0);
    $('btnGo').disabled = true;

    try {
      var b = await conToken({ pregunta: pregunta, accion: 'buscar' });
      if (b.status !== 200) { pintarError(pregunta, b.body.error || ('Error ' + b.status)); return; }

      if (!b.body.ids || !b.body.ids.length) {
        pintar(pregunta, {
          encontrado: false,
          respuesta: 'No encontré nada sobre eso en los documentos cargados (Guía de Suscripción, ' +
            'Condiciones Generales, Multiasistencia, Perfeccionamiento, Pacto Amistoso y DAM).',
          citas: [], alertas: [], resumen_cliente: '', secciones_consultadas: []
        });
        return;
      }

      out.innerHTML = tarjetaPasos('leer', b.body.ids.length);

      var r2 = await conToken({ pregunta: pregunta, accion: 'responder', ids: b.body.ids });
      if (r2.status !== 200) { pintarError(pregunta, r2.body.error || ('Error ' + r2.status)); return; }

      S.ultima = { pregunta: pregunta, data: r2.body };
      S.vista = 'interna';
      pintar(pregunta, r2.body);
    } catch (e) {
      pintarError(pregunta, e.message || String(e));
    } finally {
      $('btnGo').disabled = false;
    }
  }

  function pintarError(pregunta, msg) {
    $('out').innerHTML =
      '<div class="card"><header><div class="q">' + esc(pregunta) + '</div>' +
      '<span class="badge b-err">No se pudo consultar</span></header>' +
      '<div class="body"><p>' + esc(msg) + '</p></div></div>';
  }

  // ──────────────────────────────────────────────────────────────── dibujo

  function pintar(pregunta, d) {
    if (!d.encontrado && (!d.citas || !d.citas.length)) {
      $('out').innerHTML =
        '<div class="card"><header><div class="q">' + esc(pregunta) + '</div>' +
        '<span class="badge b-no">Sin respuesta en el corpus</span></header>' +
        '<div class="body"><p>' + esc(d.respuesta) + '</p>' +
        '<p style="color:var(--mute);font-size:13px;margin-top:9px">' +
        'Preferible a inventar una respuesta que suene bien.</p></div></div>';
      return;
    }

    var sin = d.citas_sin_verificar || 0;
    var badge = sin > 0
      ? '<span class="badge b-warn">' + sin + (sin === 1 ? ' cita sin verificar' : ' citas sin verificar') + '</span>'
      : '<span class="badge b-ok">' + d.citas.length + ' de ' + d.citas.length + ' citas verificadas</span>';

    var texto = S.vista === 'cliente' && d.resumen_cliente ? d.resumen_cliente : d.respuesta;

    var html =
      '<div class="card"><header><div class="q">' + esc(pregunta) + '</div>' + badge + '</header>' +
      '<div class="body"><div id="cuerpo">' + parrafos(texto) + '</div>';

    if (d.alertas && d.alertas.length) {
      html += '<div class="alerts"><h4>Verificá antes de responderle al cliente</h4><ul>' +
        d.alertas.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
        '</ul></div>';
    }

    if (d.citas && d.citas.length) {
      html += '<div class="cites"><h3>Citas · ' + (d.citas.length - sin) +
        ' verificadas contra el documento' + (sin ? ', ' + sin + ' no' : '') + '</h3>' +
        d.citas.map(cita).join('') + '</div>';
    }

    if (d.secciones_consultadas && d.secciones_consultadas.length) {
      html += '<details class="src-list"><summary>El consultor leyó ' +
        d.secciones_consultadas.length + ' secciones para responder esto</summary><div class="in">' +
        d.secciones_consultadas.map(function (s) {
          return '<div class="it"><span class="pg">pág. ' + esc(s.pagina_desde) + '</span>' +
                 '<span>' + esc(s.ruta) + '</span></div>';
        }).join('') + '</div></details>';
    }

    html += '</div><div class="acts">' +
      '<div class="seg">' +
      '<button id="vInt" class="' + (S.vista === 'interna' ? 'on' : '') + '">Para mí</button>' +
      '<button id="vCli" class="' + (S.vista === 'cliente' ? 'on' : '') + '"' +
        (d.resumen_cliente ? '' : ' disabled') + '>Para el cliente</button>' +
      '</div><div class="sp">' +
      '<button class="btn-s" id="btnCopy">Copiar</button>' +
      '<button class="btn-s btn-wa" id="btnWa"' + (d.apto_para_enviar ? '' : ' disabled') + '>WhatsApp</button>' +
      '</div>' +
      (d.apto_para_enviar ? '' :
        '<div class="lock">⚠ Envío bloqueado: ' + (sin === 1 ? 'hay 1 cita que no pasó' : 'hay ' + sin + ' citas que no pasaron') +
        ' la verificación contra el documento.</div>') +
      '</div></div>';

    $('out').innerHTML = html;

    $('vInt').onclick = function () { S.vista = 'interna'; pintar(pregunta, d); };
    if (d.resumen_cliente) $('vCli').onclick = function () { S.vista = 'cliente'; pintar(pregunta, d); };
    $('btnCopy').onclick = copiar;
    if (d.apto_para_enviar) $('btnWa').onclick = mandarWhatsApp;
  }

  function parrafos(t) {
    return String(t || '').split(/\n{2,}/).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function cita(c) {
    var ubic = [];
    if (c.documento) ubic.push('<b>' + esc(c.documento) + '</b>');
    if (c.version) ubic.push('<span class="tag">' + esc(c.version) + '</span>');
    if (c.pagina_desde) {
      ubic.push('<span class="tag">pág. ' + esc(c.pagina_desde) +
        (c.pagina_hasta && c.pagina_hasta !== c.pagina_desde ? '-' + esc(c.pagina_hasta) : '') + '</span>');
    }
    if (c.ruta) ubic.push('<span>' + esc(c.ruta) + '</span>');
    // Solo los documentos publicos se abren directo; la Guia es interna del INS
    if (c.archivo) {
      ubic.push('<a class="pdf" target="_blank" rel="noopener" href="' +
        esc(c.archivo) + '#page=' + esc(c.pagina_desde) + '">Abrir PDF ↗</a>');
    }

    return '<div class="cite' + (c.verificada ? '' : ' bad') + '">' +
      '<div class="src">' + ubic.join('') + '</div>' +
      '<blockquote>' + esc(c.texto_literal) + '</blockquote>' +
      (c.verificada
        ? '<div class="vok">✓ Verificada — el texto existe literalmente en el documento</div>'
        : '<div class="vbad">✕ NO verificada — este texto no aparece así en el documento' +
          '<small>La respuesta puede estar apoyándose en algo que el documento no dice. ' +
          'Abrí el PDF y comprobalo antes de usar este dato.</small></div>') +
      '</div>';
  }

  // ──────────────────────────────────────────────────────────────── salida

  function textoPlano() {
    var d = S.ultima.data;
    var base = S.vista === 'cliente' && d.resumen_cliente ? d.resumen_cliente : d.respuesta;
    var t = base;
    if (S.vista === 'interna' && d.citas && d.citas.length) {
      t += '\n\nFuentes:';
      d.citas.forEach(function (c) {
        t += '\n· ' + (c.documento || '') + (c.version ? ' ' + c.version : '') +
             ', pág. ' + c.pagina_desde + (c.ruta ? ' — ' + c.ruta : '');
      });
    }
    if (S.vista === 'cliente') {
      t += '\n\nEsto refleja las Condiciones Generales del producto; su póliza puede tener ' +
           'condiciones particulares distintas.';
    }
    return t;
  }

  async function copiar() {
    var plano = textoPlano();
    try {
      // Con formato: al pegar en el correo llega como texto, no como codigo.
      var rico = $('cuerpo').innerHTML;
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([rico], { type: 'text/html' }),
        'text/plain': new Blob([plano], { type: 'text/plain' })
      })]);
      toast('Copiado');
    } catch (e) {
      try { await navigator.clipboard.writeText(plano); toast('Copiado como texto'); }
      catch (e2) { toast('No se pudo copiar'); }
    }
  }

  function mandarWhatsApp() {
    // SIEMPRE web.whatsapp.com/send/, nunca wa.me
    var t = textoPlano();
    if (t.length > 1400) t = t.slice(0, 1380).replace(/\s+\S*$/, '') + '…';
    window.open('https://web.whatsapp.com/send/?text=' + encodeURIComponent(t), '_blank', 'noopener');
  }

  // ─────────────────────────────────────────────────────────────── arranque

  var EJEMPLOS = [
    '¿Cuántos eventos de grúa cubre el plan básico?',
    '¿Qué cubre la cobertura E?',
    '¿Un pick-up del 2008 es asegurable con cobertura D?',
    'Devolución si cancelo a los 4 meses'
  ];

  document.addEventListener('DOMContentLoaded', function () {
    $('chips').innerHTML = EJEMPLOS.map(function (e) {
      return '<span class="chip">' + esc(e) + '</span>';
    }).join('');
    $('chips').onclick = function (ev) {
      if (!ev.target.classList.contains('chip')) return;
      $('q').value = ev.target.textContent;
      $('btnGo').click();
    };

    $('btnEntrar').onclick = async function () {
      $('gateMsg').textContent = '';
      try {
        await pedirToken();
        $('gate').hidden = true;
        $('app').hidden = false;
        $('q').focus();
      } catch (e) {
        $('gateMsg').textContent = 'No se pudo entrar: ' + (e.message || e);
      }
    };

    $('btnGo').onclick = function () {
      var q = $('q').value.trim();
      if (!q) { $('q').focus(); return; }
      consultar(q);
    };
    $('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('btnGo').click();
    });
  });
})();
