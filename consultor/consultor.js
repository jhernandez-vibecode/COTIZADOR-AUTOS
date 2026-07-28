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
  var ST = { token: null, cliente: null, ultima: null, vista: 'interna' };

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
      if (!ST.cliente) {
        ST.cliente = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: function () {},
          // Sin esto, un popup bloqueado o cerrado dejaba la Promise colgada
          // PARA SIEMPRE: spinner eterno y boton muerto hasta recargar. GIS
          // reporta esos casos unicamente por error_callback.
          error_callback: function (err) {
            var tipo = (err && err.type) || 'error';
            var msg = tipo === 'popup_closed'
              ? 'Cerraste la ventana de Google. Intentá de nuevo.'
              : 'El navegador bloqueó la ventana de Google (' + tipo + '). Hacé clic de nuevo.';
            if (ST.rechazar) { var rj = ST.rechazar; ST.rechazar = null; rj(new Error(msg)); }
          }
        });
      }
      ST.rechazar = reject;
      ST.cliente.callback = function (r) {
        ST.rechazar = null;
        if (r.error) { reject(new Error(r.error_description || r.error)); return; }
        ST.token = r.access_token;
        resolve(r.access_token);
      };
      try {
        // prompt vacio = reuso silencioso si ya autorizo antes
        ST.cliente.requestAccessToken({ prompt: '' });
      } catch (e) { ST.rechazar = null; reject(e); }
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
      // HTML en vez de JSON: o el gateway corto por tiempo (5xx) o la funcion
      // no existe en este sitio (404). Son problemas distintos — no hay que
      // mandar a reintentar lo que nunca va a funcionar.
      throw new Error(r.status === 404 || r.status === 405
        ? 'La función del consultor no está publicada en este sitio (HTTP ' + r.status + '). Reintentar no sirve: falta desplegarla.'
        : 'El servidor cortó la consulta a medias (HTTP ' + r.status + '), casi seguro por el límite de tiempo. Volvé a intentar.');
    }
    return { status: r.status, body: await r.json() };
  }

  /** Reintenta UNA vez con token nuevo si el actual venció (dura 1 hora). */
  async function conToken(payload) {
    if (!ST.token) await pedirToken();
    payload.token = ST.token;
    var res = await llamar(payload);
    if (res.status === 403) {
      ST.token = null;
      await pedirToken();
      payload.token = ST.token;
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

      ST.ultima = { pregunta: pregunta, data: r2.body };
      ST.vista = 'interna';
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
    var nCitas = (d.citas || []).length;
    var badge;
    if (sin > 0) {
      badge = '<span class="badge b-warn">' + sin + (sin === 1 ? ' cita sin verificar' : ' citas sin verificar') + '</span>';
    } else if (!nCitas) {
      // "0 de 0 verificadas" en verde seria mentirle al agente: una respuesta
      // sin citas no paso por NINGUNA verificacion.
      badge = '<span class="badge b-warn">Sin citas verificables</span>';
    } else {
      badge = '<span class="badge b-ok">' + nCitas + ' de ' + nCitas + ' citas verificadas</span>';
    }

    var texto = ST.vista === 'cliente' && d.resumen_cliente ? d.resumen_cliente : d.respuesta;

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
      '<button id="vInt" class="' + (ST.vista === 'interna' ? 'on' : '') + '">Para mí</button>' +
      '<button id="vCli" class="' + (ST.vista === 'cliente' ? 'on' : '') + '"' +
        (d.resumen_cliente ? '' : ' disabled') + '>Para el cliente</button>' +
      '</div><div class="sp">' +
      '<button class="btn-s" id="btnCopy">Copiar</button>' +
      '<button class="btn-s btn-mail" id="btnMail"' + (d.apto_para_enviar ? '' : ' disabled') + '>Correo</button>' +
      '<button class="btn-s btn-wa" id="btnWa"' + (d.apto_para_enviar ? '' : ' disabled') + '>WhatsApp</button>' +
      '</div>' +
      (d.apto_para_enviar ? '' :
        '<div class="lock">⚠ Envío bloqueado: ' + motivoBloqueo(d, sin) + '</div>') +
      '</div></div>';

    $('out').innerHTML = html;

    $('vInt').onclick = function () { ST.vista = 'interna'; pintar(pregunta, d); };
    if (d.resumen_cliente) $('vCli').onclick = function () { ST.vista = 'cliente'; pintar(pregunta, d); };
    $('btnCopy').onclick = copiar;
    if (d.apto_para_enviar) {
      $('btnWa').onclick = mandarWhatsApp;
      $('btnMail').onclick = abrirMail;
    }
  }

  /**
   * El bloqueo tiene tres causas distintas y el mensaje debe decir LA REAL:
   * decir "hay 0 citas que no pasaron" junto a un badge verde era contradecirse.
   */
  function motivoBloqueo(d, sin) {
    if (sin > 0) {
      return sin === 1
        ? 'hay 1 cita que no pasó la verificación contra el documento.'
        : 'hay ' + sin + ' citas que no pasaron la verificación contra el documento.';
    }
    if (!d.citas || !d.citas.length) return 'la respuesta no trae citas verificables.';
    return 'el consultor no encontró una respuesta completa en los documentos.';
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
    var d = ST.ultima.data;
    var base = ST.vista === 'cliente' && d.resumen_cliente ? d.resumen_cliente : d.respuesta;
    var t = base;
    if (ST.vista === 'interna' && d.citas && d.citas.length) {
      t += '\n\nFuentes:';
      d.citas.forEach(function (c) {
        // pagina_desde falta cuando la seccion citada no existio en el corpus
        // (cita rechazada): sin el guard el texto pegado decia "pág. undefined"
        var pg = c.pagina_desde ? ', pág. ' + c.pagina_desde : '';
        t += '\n· ' + (c.documento || 'documento no identificado') + (c.version ? ' ' + c.version : '') +
             pg + (c.ruta ? ' — ' + c.ruta : '');
      });
    }
    if (ST.vista === 'cliente') {
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

  // ─────────────────────────────────────────────────────────── correo

  /**
   * Cuerpo HTML del correo. Texto y color, SIN imagenes: Gmail bloquea SVG y
   * base64, y un correo que llega con los cuadros rotos se ve peor que uno
   * sin adornos.
   */
  function correoHtml() {
    var d = ST.ultima.data;
    // La vista se CONGELA al abrir el modal. Si se leyera ST.vista aca, cambiar
    // de pestana con el modal abierto mandaria la version interna —con citas de
    // clausulas— a un cliente.
    var paraCliente = ST.vistaMail === 'cliente';
    var cuerpo = paraCliente && d.resumen_cliente ? d.resumen_cliente : d.respuesta;
    var nombre = (typeof CFG !== 'undefined' && CFG.FROM_NAME) || '';
    var lic = (typeof CFG !== 'undefined' && CFG.LICENSE) || '';
    var tel = (typeof CFG !== 'undefined' && CFG.PHONE) || '';
    var web = (typeof CFG !== 'undefined' && CFG.WEBSITE) || '';

    var citas = '';
    if (!paraCliente && d.citas && d.citas.length) {
      citas = '<p style="margin:22px 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;' +
        'letter-spacing:.05em;font-weight:700;">Respaldo documental</p>';
      d.citas.forEach(function (c) {
        citas += '<div style="border-left:3px solid #16a34a;background:#f8fafc;padding:10px 14px;margin:0 0 9px;">' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:5px;">' +
            '<b style="color:#0c2340;">' + esc(c.documento || '') + '</b>' +
            (c.version ? ' · ' + esc(c.version) : '') +
            (c.pagina_desde ? ' · pág. ' + esc(c.pagina_desde) : '') +
            (c.ruta ? '<br>' + esc(c.ruta) : '') +
          '</div>' +
          '<div style="font-size:13px;color:#334155;font-style:italic;">' + esc(c.texto_literal) + '</div>' +
        '</div>';
      });
    }

    var aviso = paraCliente
      ? '<p style="margin:20px 0 0;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;' +
        'font-size:12.5px;color:#78350f;">Esto refleja las Condiciones Generales del producto. ' +
        'Su póliza puede tener condiciones particulares distintas: con gusto se lo confirmo sobre su caso.</p>'
      : '';

    return '<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">' +
      '<tr><td align="center">' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;">' +
        '<tr><td style="background:#0c2340;padding:18px 24px;">' +
          '<div style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">Seguros del INS</div>' +
          '<div style="color:#cbd5e1;font-family:Arial,sans-serif;font-size:12.5px;margin-top:3px;">Consulta sobre las condiciones del seguro de automóviles</div>' +
        '</td></tr>' +
        '<tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a;font-size:14.5px;line-height:1.65;">' +
          '<p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Consulta</p>' +
          '<p style="margin:0 0 18px;font-weight:600;">' + esc(ST.ultima.pregunta) + '</p>' +
          parrafosMail(cuerpo) +
          citas +
          aviso +
        '</td></tr>' +
        '<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 24px;' +
          'font-family:Arial,sans-serif;font-size:12.5px;color:#475569;line-height:1.6;">' +
          '<b style="color:#0c2340;">' + esc(nombre) + '</b><br>' +
          'Agente de Seguros del INS' + (lic ? ' · Licencia SUGESE ' + esc(lic) : '') + '<br>' +
          (tel ? 'Tel / WhatsApp: ' + esc(tel) + '<br>' : '') +
          (web ? esc(web) : '') +
          '<p style="margin:12px 0 0;font-size:10.5px;color:#94a3b8;">&copy; 2026 Propiedad Intelectual de ' +
            esc(nombre) + '. Documento generado a partir de las condiciones oficiales del INS.</p>' +
        '</td></tr>' +
      '</table></td></tr></table></body></html>';
  }

  function parrafosMail(t) {
    return String(t || '').split(/\n{2,}/).map(function (p) {
      return '<p style="margin:0 0 13px;">' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function abrirMail() {
    // Se congela la version en este momento: lo que diga la nota es lo que sale.
    ST.vistaMail = ST.vista;
    var paraCliente = ST.vistaMail === 'cliente';
    $('mailSubject').value = (paraCliente
      ? 'Sobre su consulta del seguro de automóviles'
      : 'Consulta: ' + ST.ultima.pregunta).slice(0, 120);
    $('mailNota').textContent = paraCliente
      ? 'Se enviará la versión PARA EL CLIENTE: lenguaje llano, sin citas de cláusulas y con la nota de condiciones particulares.'
      : 'Se enviará la versión INTERNA: respuesta completa con las citas, documento, versión y página. No es para un cliente.';
    $('mailBg').hidden = false;
    $('mailTo').value = '';
    $('mailTo').focus();
    document.addEventListener('keydown', atraparFoco, true);
  }

  function cerrarMail() {
    $('mailBg').hidden = true;
    document.removeEventListener('keydown', atraparFoco, true);
    var b = $('btnMail'); if (b) b.focus();
  }

  /** El Tab no debe salirse del modal mientras esta abierto. */
  function atraparFoco(ev) {
    if (ev.key !== 'Tab' || $('mailBg').hidden) return;
    var f = [$('mailTo'), $('mailSubject'), $('mailCancel'), $('mailSend')].filter(function (x) { return x && !x.disabled; });
    if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    ev.preventDefault();
    f[(i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }

  async function enviarMail() {
    if (ST.enviando) return;                     // doble clic: no mandar dos veces
    var para = $('mailTo').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) { $('mailTo').focus(); toast('Revisá el correo'); return; }

    var btn = $('mailSend');
    ST.enviando = true;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      // Token de Gmail: SEPARADO del de identidad del consultor. Si el agente
      // no autoriza Gmail, el consultor sigue funcionando igual.
      await getToken();
      var from = ((typeof CFG !== 'undefined' && CFG.FROM_NAME) || '') +
                 ' <' + ((typeof CFG !== 'undefined' && CFG.FROM_EMAIL) || '') + '>';
      var raw = buildMIMESimple({
        to: para, from: from, subject: $('mailSubject').value.trim(), html: correoHtml()
      });
      await sendEmail(raw);
      cerrarMail();
      toast('Correo enviado a ' + para);
    } catch (e) {
      // Si el modal ya se cerro, el mensaje en mailNota no lo ve nadie y el
      // agente se queda creyendo que el correo salio. El toast si se ve.
      var msg = 'No se pudo enviar: ' + (e.message || e);
      $('mailNota').textContent = msg;
      if ($('mailBg').hidden) toast(msg, 6000);
    } finally {
      ST.enviando = false;
      btn.disabled = false;
      btn.textContent = 'Autorizar Gmail y Enviar';
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
    // Pisar CFG con el perfil ⚙ de ESTE navegador. Sin esto el correo sale
    // firmado con el nombre y la licencia SUGESE de JC aunque lo mande otro
    // agente — poner la licencia ajena en un correo a un cliente no es un
    // detalle cosmetico.
    try {
      var perfil = typeof loadProfile === 'function' ? loadProfile() : null;
      if (perfil && typeof applyProfile === 'function') applyProfile(perfil);
    } catch (e) { console.warn('[consultor] no se pudo aplicar el perfil', e); }

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

    // Modal de correo. "Salir" y no "Cancelar": no es una acción destructiva.
    // No se cierra mientras se está enviando: perder el modal en ese momento
    // esconde el error y el agente cree que el correo salió.
    $('mailCancel').onclick = function () { if (!ST.enviando) cerrarMail(); };
    $('mailSend').onclick = enviarMail;
    $('mailBg').addEventListener('click', function (ev) {
      if (ev.target === $('mailBg') && !ST.enviando) cerrarMail();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('mailBg').hidden && !ST.enviando) cerrarMail();
    });
  });
})();
