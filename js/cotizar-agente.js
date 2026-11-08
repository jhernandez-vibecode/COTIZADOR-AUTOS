/**
 * Cotizador SDI · Formulario propio de cotización: lo del ⚙ (5 nov 2026)
 *
 * Dos cosas, las dos contra la Function /cotizar/agente:
 *   1. FICHA: al guardar el ⚙, si el agente está en el reparto, se manda una
 *      copia de su nombre, licencia, WhatsApp y teléfono al servidor, firmada
 *      con su cuenta de Google. Con eso firma el aviso de cada solicitud (al cliente ya
 *      no le sale correo desde el 6 nov 2026: todo queda en la pantalla final).
 *   2. REPARTO (solo el administrador, JC): el panel para encenderlo o
 *      apagarlo y poner cuántas solicitudes seguidas le tocan a cada agente
 *      por vuelta (3-1-1, 5-1-1, 2-2-2…). Mockup aprobado el 5 nov 2026.
 *
 * La sesión de Google se pide con un token SEPARADO (scope "openid email"):
 * el servidor le pregunta a Google de quién es. Nada de esto vive en
 * localStorage: el reparto y las fichas están en el servidor.
 */

var COTZ_API = '/cotizar/agente';
var COTZ_URL_PUBLICA = 'https://cotizador.appsegurosdigitales.com/cotizar/';
var COTZ_COLORES = ['#0369A1', '#0D9488', '#EA580C', '#7C3AED', '#C9A227', '#BE185D', '#0E7490', '#4D7C0F', '#9A3412', '#475569'];
var _cotz = { token: null, tokenClient: null, vista: null, editado: null, sucio: false };

function _cotzPost(cuerpo) {
  return fetch(COTZ_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { st: r.status, j: j }; }); });
}

/** Token de Google con scope "openid email". La primera vez abre el popup. */
function _cotzToken(forzar) {
  if (_cotz.token && !forzar) return Promise.resolve(_cotz.token);
  if (!window.google || !google.accounts || !google.accounts.oauth2) return Promise.reject(new Error('Google todavía no cargó. Probá de nuevo.'));
  if (!_cotz.tokenClient) {
    _cotz.tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CFG.CLIENT_ID, scope: 'openid email', callback: function () {} });
  }
  return new Promise(function (resolve, reject) {
    _cotz.tokenClient.callback = function (resp) {
      if (resp.error) { reject(new Error('Google: ' + resp.error)); return; }
      _cotz.token = resp.access_token;
      setTimeout(function () { _cotz.token = null; }, 50 * 60 * 1000);
      resolve(resp.access_token);
    };
    _cotz.tokenClient.error_callback = function () { reject(new Error('Se cerró la ventana de Google.')); };
    try { _cotz.tokenClient.requestAccessToken({ prompt: '' }); } catch (e) { reject(e); }
  });
}

/** Llamada con sesión: si el token venció (401) pide uno nuevo una vez. */
function _cotzConSesion(cuerpo) {
  return _cotzToken().then(function (t) {
    return _cotzPost(Object.assign({}, cuerpo, { token: t })).then(function (x) {
      if (x.st !== 401) return x;
      return _cotzToken(true).then(function (t2) { return _cotzPost(Object.assign({}, cuerpo, { token: t2 })); });
    });
  });
}

// ---------------------------------------------------------------------
// 1. Ficha del agente
// ---------------------------------------------------------------------

/** Lo llama handleProfileSave (app.js) después de guardar el perfil. */
function cotzTrasGuardarPerfil(profile) {
  if (!profile || !profile.email) return;
  _cotzPost({ accion: 'consulta', email: profile.email }).then(function (x) {
    // Tambien los que tienen el formulario de cita: esa confirmacion la firma esta misma ficha.
    if (!(x.st === 200 && (x.j.enReparto || x.j.admin || x.j.cita))) return;
    return _cotzConSesion({ accion: 'ficha', ficha: { nombre: profile.name, licencia: profile.license, whatsapp: profile.whatsapp, telefono: profile.phone } })
      .then(function (r) {
        if (r.st === 200 && r.j.email !== String(profile.email).trim().toLowerCase()) {
          showToast('Tu ficha del formulario de cotización se guardó con la cuenta de Google ' + r.j.email + ', no con ' + profile.email + '.', 'error');
        } else if (r.st === 200) {
          showToast('Tus datos de los formularios de cotización y de cita quedaron al día.', 'success');
          if (_cotz.vista) cotzAbrirReparto();
        } else {
          showToast('Formulario de cotización: ' + (r.j.error || 'no se pudo guardar tu ficha.'), 'error');
        }
      });
  }).catch(function (e) {
    if (e && /cerró|Google/.test(e.message)) showToast('Formulario de cotización: ' + e.message + ' Tu ficha no se actualizó.', 'error');
  });
}

// ---------------------------------------------------------------------
// 2. Panel del reparto (solo el administrador)
// ---------------------------------------------------------------------

/** Lo llama openProfileModal (app.js): muestra la sección solo al admin. */
function cotzAlAbrirPerfil() {
  var sec = document.getElementById('cotzSec');
  if (!sec) return;
  // Siempre arranca cerrado: al abrirlo se lee del servidor. Antes quedaba pintada la vista
  // de la vez anterior y parecia que un cambio no se habia guardado (JC, 5 nov 2026).
  _cotz.vista = null; _cotz.editado = null; _cotz.sucio = false;
  var cuerpo = document.getElementById('cotzCuerpo');
  if (cuerpo) cuerpo.innerHTML = '<button class="btn btn-primary" type="button" id="btnCotzAbrir">Ver y cambiar el reparto</button>';
  _cotzPost({ accion: 'consulta', email: CFG.FROM_EMAIL }).then(function (x) {
    sec.hidden = !(x.st === 200 && x.j.admin);
  }).catch(function () { sec.hidden = true; });
}

function cotzAbrirReparto() {
  var cuerpo = document.getElementById('cotzCuerpo');
  cuerpo.innerHTML = '<p class="cotz-nota">Cargando el reparto…</p>';
  _cotzConSesion({ accion: 'ver' }).then(function (x) {
    if (x.st !== 200) { cuerpo.innerHTML = '<p class="cotz-nota cotz-mal">' + _cotzEsc(x.j.error || 'No se pudo cargar el reparto.') + '</p>'; return; }
    _cotzCargar(x.j);
  }).catch(function (e) {
    cuerpo.innerHTML = '<p class="cotz-nota cotz-mal">' + _cotzEsc(e.message) + '</p>';
  });
}

function _cotzCargar(vista) {
  _cotz.vista = vista;
  _cotz.editado = JSON.parse(JSON.stringify(vista.reparto));
  _cotz.sucio = false;
  _cotzPintar();
}

function _cotzEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _cotzNombre(email) {
  var f = _cotz.vista && _cotz.vista.fichas[email];
  return f && f.nombre ? f.nombre : email;
}
function _cotzIni(email) {
  var n = _cotzNombre(email);
  if (n === email) return email.charAt(0).toUpperCase();
  return n.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
}
function _cotzColor(email) {
  var i = _cotz.editado.agentes.findIndex(function (a) { return a.email === email; });
  return COTZ_COLORES[(i < 0 ? 0 : i) % COTZ_COLORES.length];
}

/** Agente sin ficha: si ya está guardado en el reparto, el admin le pone el nombre aquí (8 nov 2026). */
function _cotzSinFicha(email, i) {
  var guardado = _cotz.vista.reparto.agentes.some(function (a) { return a.email === email; });
  if (!guardado) return '<em>Guardá el reparto y después ponele el nombre, o que entre al cotizador y guarde su ⚙. Mientras tanto se salta su turno.</em>';
  return '<em>Se salta su turno hasta tener nombre. Si no usa el cotizador, ponéselo vos:</em>' +
    '<span class="cotz-ficha"><input type="text" data-fn="' + i + '" placeholder="Nombre y apellido" aria-label="Nombre de ' + _cotzEsc(email) + '">' +
    '<input type="tel" data-fw="' + i + '" placeholder="WhatsApp (opcional)" aria-label="WhatsApp de ' + _cotzEsc(email) + '">' +
    '<button type="button" class="btn btn-secondary" data-ff="' + i + '">Guardar nombre</button></span>';
}

function _cotzPintar() {
  var r = _cotz.editado, v = _cotz.vista;
  var total = r.agentes.reduce(function (s, a) { return s + a.peso; }, 0);
  var h = '';
  h += '<label class="cotz-sw"><span><b>Repartir entre agentes</b><small>' + (r.on ? 'Encendido: las solicitudes se reparten por turnos.' : 'Apagado: todas te llegan a vos.') + '</small></span>' +
       '<span class="cotz-tog"><input type="checkbox" id="cotzOn"' + (r.on ? ' checked' : '') + '><i></i></span></label>';
  h += '<div class="cotz-ags' + (r.on ? '' : ' off') + '">';
  r.agentes.forEach(function (a, i) {
    var f = v.fichas[a.email];
    var esAdm = i === 0;
    h += '<div class="cotz-agr' + (a.peso ? '' : ' cero') + '">' +
      '<span class="cotz-dot" style="background:' + _cotzColor(a.email) + '">' + _cotzEsc(_cotzIni(a.email)) + '</span>' +
      '<span class="cotz-quien"><b>' + _cotzEsc(_cotzNombre(a.email)) + '</b><small>' + _cotzEsc(a.email) + '</small>' +
        (f ? (f.porAdmin ? '<small class="cotz-porad">Sin cotizador · le llegan los avisos a su Gmail</small>' : '') : _cotzSinFicha(a.email, i)) +
      '</span>' +
      '<span class="cotz-step"><button type="button" data-i="' + i + '" data-d="-1" aria-label="Menos"' + (a.peso <= 0 ? ' disabled' : '') + '>−</button><output>' + a.peso + '</output><button type="button" data-i="' + i + '" data-d="1" aria-label="Más"' + (a.peso >= 9 ? ' disabled' : '') + '>+</button></span>' +
      '<span class="cotz-pct">' + (total ? Math.round(a.peso * 100 / total) : 0) + ' %' +
        (esAdm ? '' : '<button type="button" class="cotz-quitar" data-i="' + i + '" aria-label="Quitar a ' + _cotzEsc(a.email) + '">Quitar</button>') + '</span>' +
    '</div>';
  });
  h += '</div>';
  h += '<p class="cotz-nota cotz-tope">Las solicitudes de más de <b>₡' + Number(v.tope || 15000000).toLocaleString('de-DE') + '</b> te llegan siempre a vos, esté como esté el reparto, y no cambian el turno.</p>';
  h += '<div class="cotz-agregar"><input type="email" id="cotzNuevo" placeholder="correo@del-agente.com" aria-label="Correo del agente nuevo"><button type="button" class="btn btn-secondary" id="cotzAgregar">Agregar agente</button></div>';
  if (r.agentes.length === 3) {
    h += '<div class="cotz-rapidos">Rápidos: ' + ['3,1,1', '5,1,1', '2,2,2', '3,2,1', '1,1,0'].map(function (p) {
      return '<button type="button" data-p="' + p + '">' + p.replace(/,/g, '-') + '</button>';
    }).join('') + '</div>';
  }
  // Vista previa: si no hay cambios sin guardar, la del servidor (con el turno real).
  var prox = [];
  if (r.on && total) {
    if (!_cotz.sucio) prox = v.proximos;
    else {
      // Sin guardar: la vuelta nueva desde el primero, saltando a quien no tiene ficha (como el servidor).
      var vu = []; r.agentes.forEach(function (a) { if (v.fichas[a.email]) for (var k = 0; k < a.peso; k++) vu.push(a.email); });
      for (var j = 0; j < 10; j++) prox.push(vu.length ? vu[j % vu.length] : r.agentes[0].email);
    }
  }
  h += '<div class="cotz-vista"><span class="cotz-t">Así se reparten las próximas</span>';
  h += '<div class="cotz-barra">' + (r.on && total ? r.agentes.filter(function (a) { return a.peso; }).map(function (a) { return '<span style="flex:' + a.peso + ';background:' + _cotzColor(a.email) + '"></span>'; }).join('') : '<span style="flex:1;background:' + _cotzColor(r.agentes[0].email) + '"></span>') + '</div>';
  h += '<div class="cotz-turnos">' + (prox.length ? prox : [r.agentes[0].email]).map(function (e, k) {
    return '<span class="cotz-turno' + (k === 0 ? ' ahora' : '') + '" style="background:' + _cotzColor(e) + '" title="' + _cotzEsc(_cotzNombre(e)) + '">' + _cotzEsc(_cotzIni(e)) + '<small>#' + (k + 1) + '</small></span>';
  }).join('') + '</div>';
  if (!r.on) h += '<p class="cotz-aviso">Repartir está apagado: todas las solicitudes te llegan a vos. Los números quedan guardados para cuando lo volvás a encender.</p>';
  else if (!total) h += '<p class="cotz-aviso cotz-mal">Todos están en 0. Así nadie recibiría: las solicitudes te llegan a vos.</p>';
  else if (_cotz.sucio) h += '<p class="cotz-aviso">Al guardar, la vuelta arranca de nuevo desde el primero de la lista.</p>';
  h += '</div>';
  h += '<div class="cotz-guardar"><small>' + (_cotz.sucio ? 'Hay cambios sin guardar.' : (v.actualizado ? 'Último cambio: ' + new Date(v.actualizado).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Todavía no lo has guardado.')) + '</small>' +
       '<button type="button" class="btn btn-primary" id="cotzGuardar"' + (_cotz.sucio ? '' : ' disabled') + '>Guardar el reparto</button></div>';
  h += '<p class="cotz-nota">Enlace del formulario para tus clientes: <a href="' + COTZ_URL_PUBLICA + '" target="_blank" rel="noopener">' + COTZ_URL_PUBLICA.replace('https://', '') + '</a></p>';

  var cuerpo = document.getElementById('cotzCuerpo');
  cuerpo.innerHTML = h;
  _cotzEnganchar(cuerpo);
}

function _cotzCambio() { _cotz.sucio = true; _cotzPintar(); }

/** Lo llama closeProfileModal (app.js): si hay cambios del reparto sin guardar, avisa. */
function cotzHayCambiosSinGuardar() { return !!(_cotz.vista && _cotz.sucio); }

function _cotzEnganchar(c) {
  var r = _cotz.editado;
  c.querySelector('#cotzOn').addEventListener('change', function () { r.on = this.checked; _cotzCambio(); });
  c.querySelectorAll('.cotz-step button').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = r.agentes[+b.dataset.i];
      a.peso = Math.max(0, Math.min(9, a.peso + Number(b.dataset.d)));
      _cotzCambio();
    });
  });
  c.querySelectorAll('.cotz-quitar').forEach(function (b) {
    b.addEventListener('click', function () { r.agentes.splice(+b.dataset.i, 1); _cotzCambio(); });
  });
  c.querySelectorAll('.cotz-rapidos button').forEach(function (b) {
    b.addEventListener('click', function () { b.dataset.p.split(',').forEach(function (x, i) { r.agentes[i].peso = +x; }); _cotzCambio(); });
  });
  c.querySelector('#cotzAgregar').addEventListener('click', function () {
    var e = c.querySelector('#cotzNuevo').value.trim().toLowerCase();
    if (!esEmailValido(e)) { showToast('Escribí el correo del agente.', 'error'); return; }
    if (r.agentes.some(function (a) { return a.email === e; })) { showToast('Ese agente ya está en la lista.', 'error'); return; }
    if (r.agentes.length >= 10) { showToast('Máximo 10 agentes.', 'error'); return; }
    r.agentes.push({ email: e, peso: 1 });
    _cotzCambio();
  });
  c.querySelectorAll('[data-ff]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (_cotz.sucio) { showToast('Primero guardá los cambios del reparto.', 'error'); return; }
      var i = b.dataset.ff, a = r.agentes[+i];
      var nombre = c.querySelector('[data-fn="' + i + '"]').value.trim();
      var wa = c.querySelector('[data-fw="' + i + '"]').value.trim();
      if (nombre.split(/\s+/).length < 2) { showToast('Escribí nombre y apellido.', 'error'); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      _cotzConSesion({ accion: 'ficha', para: a.email, ficha: { nombre: nombre, licencia: '', whatsapp: wa, telefono: '' } }).then(function (x) {
        if (x.st !== 200) { showToast(x.j.error || 'No se pudo guardar el nombre.', 'error'); b.disabled = false; b.textContent = 'Guardar nombre'; return; }
        _cotzCargar(x.j);
        showToast('Listo: ' + nombre + ' ya entra en el reparto.', 'success');
      }).catch(function (e) { showToast(e.message, 'error'); b.disabled = false; b.textContent = 'Guardar nombre'; });
    });
  });
  c.querySelector('#cotzGuardar').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'Guardando…';
    _cotzConSesion({ accion: 'guardar', reparto: r }).then(function (x) {
      if (x.st !== 200) { showToast(x.j.error || 'No se pudo guardar el reparto.', 'error'); b.disabled = false; b.textContent = 'Guardar el reparto'; return; }
      _cotzCargar(x.j);
      showToast('Reparto guardado.', 'success');
    }).catch(function (e) { showToast(e.message, 'error'); b.disabled = false; b.textContent = 'Guardar el reparto'; });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnCotzAbrir') cotzAbrirReparto();
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { cotzTrasGuardarPerfil: cotzTrasGuardarPerfil, cotzAlAbrirPerfil: cotzAlAbrirPerfil };
