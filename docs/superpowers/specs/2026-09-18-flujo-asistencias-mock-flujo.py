# Flujo "Quiero estas asistencias → volver a la guia" + textos que separan esto de la asistencia en carretera.
# Uso:  python mock-flujo.py mock   → escribe explicacion/_mockup.html y asistencias/_mockup.html
#       python mock-flujo.py real   → aplica lo mismo a los archivos reales (tras el OK de JC)
import sys
R = 'C:/Users/segur/COTIZADOR-AUTOS/'
MODO = sys.argv[1] if len(sys.argv) > 1 else 'mock'
def rd(p): return open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): open(R + p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b):
    assert a in s, a[:80]
    return s.replace(a, b, 1)

# =====================================================================
# 1. LA GUIA
# =====================================================================
g = rd('explicacion/index.html')

g = rep(g, "  asi: _params.get('asi') === '1',\n  wa: _params.get('wa') || ''\n};",
"""  asi: _params.get('asi') === '1',
  wa: _params.get('wa') || '',
  // as: lo que el cliente eligió en el configurador y trajo de vuelta ("mascota.premium").
  as: _params.get('as') || '',
  // fe / fpl: los identificadores de las preguntas del formulario de cita del
  // agente (asistencias y placa). Con `fe`, la elección viaja SOLA al formulario
  // y el configurador devuelve al cliente acá en vez de mandarlo a WhatsApp. Sin
  // `fe` (agente que no configuró su formulario) todo sigue como antes.
  fe: _params.get('fe') || '',
  fpl: _params.get('fpl') || ''
};""")

g = rep(g, '      <h2 class="section-title">Sumale asistencias a tu póliza</h2>\n      <p class="section-sub">Desde el 28 de setiembre podés agregar planes de asistencia para vos, tu casa, tu carro o tu mascota. <b>No cambian tus coberturas ni tu deducible</b>: se contratan aparte y se cobran junto con el seguro.</p>\n    </div>\n',
 '      <h2 class="section-title">Asistencias opcionales: mascota, salud, hogar y más</h2>\n      <p class="section-sub">Desde el 28 de setiembre podés sumarle a tu póliza servicios para vos, tu casa, tu salud o tu mascota. <b>No cambian tus coberturas ni tu deducible</b>: se contratan aparte y se cobran junto con el seguro.</p>\n    </div>\n\n    <!-- Para que nadie los confunda con la asistencia en carretera (coberturas G y M). El texto lo pone el JS según `cb`. -->\n    <div class="asi-aclara" id="asiAclara"></div>\n\n    <!-- Lo que el cliente eligió en el configurador (param `as`). Reemplaza a la rejilla. -->\n    <div class="asi-sel" id="asiSel" hidden></div>\n')

g = rep(g, '    <div class="asi-cta">\n      <a class="step-btn next" id="asiCta"', '    <div class="asi-cta" id="asiCtaWrap">\n      <a class="step-btn next" id="asiCta"')

g = rep(g, ".asi-note b{color:var(--lc-ink);font-weight:600}\n",
""".asi-note b{color:var(--lc-ink);font-weight:600}
.asi-aclara{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--lc-line);border-radius:16px;padding:12px 16px;font-size:13.5px;color:var(--lc-ink-2);line-height:1.55;margin:0 0 16px}
.asi-aclara::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:var(--lc-blue);margin-top:7px}
.asi-aclara b{color:var(--lc-ink);font-weight:600}
.asi-aclara:empty{display:none}
.asi-sel[hidden]{display:none!important}
.asi-sel .estado{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--lc-ok-bg);color:var(--lc-ok-tx);font-size:12.5px;font-weight:600;margin-bottom:12px}
.asi-sel .estado::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.asi-sel .asi-row{margin-bottom:10px}
.asi-tot{background:var(--t-verde-bg);border-radius:20px;padding:18px 20px;margin-top:6px}
.asi-tot .l{font-size:12.5px;font-weight:600;color:var(--t-verde-tx)}
.asi-tot .v{font-family:var(--font-display);font-size:34px;font-weight:500;letter-spacing:-.025em;color:var(--lc-ink);font-variant-numeric:tabular-nums lining-nums;line-height:1.15;margin-top:2px}
.asi-tot .d{font-size:13px;color:var(--lc-ink-2);margin-top:6px;line-height:1.5}
.asi-tot .d b{font-family:var(--font-mono);font-weight:500;color:var(--lc-ink)}
.asi-sel-acc{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}
.asi-sel-acc .step-btn{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.asi-sel-acc .step-btn{white-space:nowrap}
.asi-sel-acc .fine{font-size:12.5px;color:var(--lc-ink-3);line-height:1.5;flex:1;min-width:200px}
@media (max-width:720px){.asi-sel-acc{flex-direction:column;align-items:stretch}.asi-sel-acc .fine{min-width:0;flex:none}.asi-tot .v{font-size:30px}}
""")

i = g.index("function urlPlanesDesdeGuia() {")
j = g.index("\n// Aplicar al cargar\napplyPersonalization();")
g = g[:i] + r'''/** Los planes que el cliente trajo de vuelta del configurador (param `as`), ya validados contra el módulo. */
function planesElegidos() {
  if (!data.as || typeof planAsi !== 'function') return [];
  const vistos = {};
  return String(data.as).split('.').map(id => planAsi(id)).filter(p => p && !vistos[p.id] && (vistos[p.id] = true));
}
/** Hay regreso a la guía (y no WhatsApp) solo si el agente configuró su formulario: sin `fe` nadie le avisaría la elección. */
function conRegreso() { return /^\d+$/.test(data.fe); }
function urlPlanesDesdeGuia() {
  const q = [];
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') q.push(k + '=' + encodeURIComponent(String(v).trim())); };
  add('n', data.n); add('l', data.l); add('w', data.w); add('a', data.a); add('wa', data.wa);
  add('c', data.c); add('v', data.v); add('p', data.p); add('pa', data.pa);
  if (conRegreso()) {
    // r: a dónde vuelve el cliente con su selección (esta misma guía, sin el `as` viejo).
    const u = new URL(location.href); u.searchParams.delete('as'); u.hash = '';
    add('r', u.pathname + u.search);
    add('as', planesElegidos().map(p => p.id).join('.'));
  }
  return '../asistencias/' + (q.length ? '?' + q.join('&') : '');
}
/** El formulario de cita con la elección (y la placa) ya puestas. Solo con `fe` y sobre un enlace http(s). */
function urlAgendaPrellenada(elegidos) {
  const base = safeHttpUrl(data.a);
  if (!base || !conRegreso()) return base;
  const u = new URL(base);
  u.searchParams.set('usp', 'pp_url');
  elegidos.forEach(p => u.searchParams.append('entry.' + data.fe, p.nom));   // casillas: una por plan, con el nombre EXACTO
  if (/^\d+$/.test(data.fpl) && data.p) u.searchParams.set('entry.' + data.fpl, data.p);
  return u.href;
}
function filaAsi(p) {
  return '<div class="asi-row"><div class="icon svc-icon ' + (ASI_TONO[p.tono] || 't-azul') + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ASI_ICONOS[p.id] || ASI_ICONOS.premium) + '</svg></div>' +
    '<div><div class="name">' + esc(p.nom) + '</div><div class="linea">' + esc(p.linea) + '</div></div>' +
    '<div class="qty">' + fmt(p.prima) + '<small>al año + IVA</small></div></div>';
}
function aplicarAsistencias() {
  const sec = document.getElementById('sasi');
  if (!sec || !data.asi || typeof PLANES_ASI === 'undefined' || !PLANES_ASI.length) return;

  // Que nadie los confunda con la asistencia en carretera (coberturas G y M).
  const aclara = document.getElementById('asiAclara');
  if (aclara) {
    const aplica = _seccionesQueAplican(_parseCbMapa(data.cb));
    aclara.innerHTML = (aplica && aplica.asistencia)
      ? '<span><b>Tu asistencia en carretera ya viene incluida</b> en tu seguro (grúa, cerrajería, combustible). Esto es aparte: servicios opcionales para vos, tu casa, tu salud y tu mascota.</span>'
      : '<span>Estos planes <b>no son la asistencia en carretera</b> ni la reemplazan. Son servicios opcionales para vos, tu casa, tu salud y tu mascota.</span>';
  }

  const elegidos = planesElegidos();
  const grid = document.getElementById('asiGrid');
  const sel = document.getElementById('asiSel');
  const ctaWrap = document.getElementById('asiCtaWrap');
  const cta = document.getElementById('asiCta');
  if (cta) {
    cta.href = urlPlanesDesdeGuia();
    if (conRegreso()) { cta.removeAttribute('target'); cta.removeAttribute('rel'); }   // va y vuelve en la misma pestaña
  }

  if (elegidos.length && sel) {
    // El cliente ya eligió: fuera la rejilla, queda SU selección con el total.
    const suma = elegidos.reduce((a, p) => a + asiCosto(p.prima, 'a').anual, 0);      // con IVA, pago anual
    const base = Number(data.pa) > 0 ? Number(data.pa) : 0;
    sel.innerHTML = '<span class="estado">Tu selección</span>' + elegidos.map(filaAsi).join('') +
      '<div class="asi-tot"><div class="l">' + (base ? 'Tu cotización anual quedaría en' : 'Tus asistencias suman') + '</div>' +
        '<div class="v">' + fmt(base + suma) + '</div>' +
        '<div class="d">' + (base ? 'Hoy está en <b>' + fmt(base) + '</b>. Son <b>' + fmt(suma) + '</b> más al año, con IVA. ' : 'Al año, con IVA. ') +
        'Si pagás en cuotas se les suma el recargo por fraccionamiento, igual que al seguro.</div></div>' +
      '<div class="asi-sel-acc"><a class="step-btn prev" href="' + esc(urlPlanesDesdeGuia()) + '">Cambiar mi selección</a>' +
        '<span class="fine">' + (conRegreso() ? 'Cuando agendés tu cita, tu selección ya va escrita en el formulario.' : 'Contale a tu agente cuáles querés cuando agendés tu cita.') + '</span></div>';
    sel.hidden = false;
    if (grid) grid.hidden = true;
    if (ctaWrap) ctaWrap.hidden = true;
    const celebForm = document.getElementById('celebGoForm');
    const pre = urlAgendaPrellenada(elegidos);
    if (celebForm && pre) celebForm.href = pre;
  } else if (grid) {
    grid.innerHTML = PLANES_ASI.map(filaAsi).join('');
  }

  sec.hidden = false;
  // La sección entra al recorrido entre Pagos y la cita.
  const s5next = document.querySelector('#s5 .step-btn.next[data-target="qtcita"]');
  if (s5next) s5next.dataset.target = 'sasi';
  const citaPrev = document.querySelector('#qtcita .step-btn.prev[data-target="s5"]');
  if (citaPrev) { citaPrev.dataset.target = 'sasi'; citaPrev.textContent = '← Asistencias'; }
  // Al volver del configurador, caer en la sección y no arriba de todo. Salto
  // INSTANTÁNEO (la guía tiene scroll suave, que se pierde mientras la página
  // todavía carga) y repetido al terminar de cargar, cuando ya están las fuentes.
  if (elegidos.length) {
    // Tras un salto instantáneo el observador de scroll puede no avisar a tiempo y la
    // sección se quedaría en opacity:0: se marca visible a mano.
    sec.classList.add('in-view');
    const irASeccion = () => window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 70, behavior: 'instant' });
    setTimeout(irASeccion, 80);
    window.addEventListener('load', () => setTimeout(irASeccion, 150));
  }
}
''' + g[j:]
g = rep(g, "#sasi[hidden]{display:none!important}", "#sasi[hidden],#asiGrid[hidden],#asiCtaWrap[hidden]{display:none!important}")

# =====================================================================
# 2. EL CONFIGURADOR
# =====================================================================
c = rd('asistencias/index.html')
c = rep(c, "  var PLACA = param('p', '').toUpperCase();   // para que el agente identifique la póliza\n",
"""  var PLACA = param('p', '').toUpperCase();   // para que el agente identifique la póliza
  // r: la guía de la cotización a la que vuelve el cliente con su selección, en vez
  // de salir a WhatsApp. SOLO rutas de /explicacion/ de este mismo sitio: con
  // cualquier otra cosa se ignora (no es un redirector abierto).
  var RET = (function () {
    try {
      var u = new URL(param('r', ''), location.origin);
      if (u.origin === location.origin && /^\\/explicacion\\//.test(u.pathname)) return u;
    } catch (e) {}
    return null;
  })();
""")
c = rep(c, "  var sel = {}, abierto = {};\n",
"""  var sel = {}, abierto = {};
  // Si el cliente vuelve a cambiar su selección, arranca con lo que ya había elegido.
  param('as', '').split('.').forEach(function (id) { if (planAsi(id)) sel[id] = true; });
""")
c = rep(c, "      h += '<a class=\"btn btn-p\" href=\"' + esc(urlWa(ids)) + '\" target=\"_blank\" rel=\"noopener\">Pedirle estos planes a ' + esc(pila) + '</a>';\n      h += '<p class=\"nota\">Te abre WhatsApp con los planes ya escritos. El agente los agrega a tu póliza y el INS los cobra con el seguro.</p>';",
"""      if (RET && MODO === 'cotizada') {
        // Viene de la guía de una cotización: vuelve a ella con su selección. La
        // elección le llega al agente en el formulario de la cita.
        var vuelta = new URL(RET.href);
        vuelta.searchParams.set('as', ids.map(function (p) { return p.id; }).join('.'));
        h += '<a class="btn btn-p" href="' + esc(vuelta.pathname + vuelta.search) + '">Quiero estas asistencias</a>';
        h += '<p class="nota">Volvés a tu cotización con tu selección y el total. Al agendar tu cita, ya va escrita en el formulario. ¿Dudas? <a href="' + esc(urlWa(ids)) + '" target="_blank" rel="noopener">Escribile a ' + esc(pila) + '</a>.</p>';
      } else {
        h += '<a class="btn btn-p" href="' + esc(urlWa(ids)) + '" target="_blank" rel="noopener">Pedirle estos planes a ' + esc(pila) + '</a>';
        h += '<p class="nota">Te abre WhatsApp con los planes ya escritos. El agente los agrega a tu póliza y el INS los cobra con el seguro.</p>';
      }""")
# barra de movil: si hay regreso, el boton de la barra ES la accion
c = rep(c, "        $('#bm-d').textContent = MODO !== 'sola' ? '+ ' + col(cuotaAsis) + ' ' + UNIDAD : 'con IVA';\n",
"""        $('#bm-d').textContent = MODO !== 'sola' ? '+ ' + col(cuotaAsis) + ' ' + UNIDAD : 'con IVA';
        var bmBtn = $('#barraMov .btn');
        if (bmBtn && RET && MODO === 'cotizada') {
          var v2 = new URL(RET.href); v2.searchParams.set('as', ids.map(function (p) { return p.id; }).join('.'));
          bmBtn.textContent = 'Quiero estas'; bmBtn.setAttribute('href', v2.pathname + v2.search);
        }
""")
# textos: opcionales + no son la asistencia en carretera
c = rep(c, "    <p>Prendé los planes que te sirvan. Nada de esto cambia las coberturas de tu póliza: se suman aparte y se cobran junto con el seguro.</p>",
        "    <p>Prendé las que te sirvan. Son servicios opcionales para vos, tu casa, tu salud y tu mascota. <b>No son la asistencia en carretera de tu seguro ni la reemplazan</b>: esa no cambia.</p>")
c = rep(c, "    el.textContent = (CLIENTE ? CLIENTE + ', armá' : 'Armá') + ' tus asistencias y mirá en cuánto queda tu ' + (MODO === 'cotizada' ? 'cotización' : 'seguro');",
        "    el.textContent = (CLIENTE ? CLIENTE + ', armá' : 'Armá') + ' tus asistencias opcionales y mirá en cuánto queda tu ' + (MODO === 'cotizada' ? 'cotización' : 'seguro');")
c = rep(c, '<div class="prod">Planes de asistencia<small>', '<div class="prod">Asistencias opcionales<small>')
c = rep(c, '<div class="h3">Los seis planes</div>', '<div class="h3">Los seis planes opcionales</div>')
c = rep(c, ".hero p{color:var(--lc-ink-2);font-size:16px;max-width:56ch;margin:0 auto}", ".hero p{color:var(--lc-ink-2);font-size:16px;max-width:58ch;margin:0 auto}\n.hero p b{color:var(--lc-ink);font-weight:600}")

# =====================================================================
# 3. EL MODULO DE DATOS: Autos Plus es el que mas se confunde con la grua
# =====================================================================
m = rd('js/planes-asistencia.js')
LINEA_VIEJA = "linea: 'Cuido estético del carro y traslados al aeropuerto.',"
LINEA_NUEVA = "linea: 'Lavado, pulido y cambio de aceite del carro. No es la asistencia en carretera.',"
assert LINEA_VIEJA in m

if MODO == 'real':
    wr('explicacion/index.html', g)
    wr('asistencias/index.html', c)
    wr('js/planes-asistencia.js', m.replace(LINEA_VIEJA, LINEA_NUEVA, 1))
    print('aplicado a los archivos reales')
else:
    # En el mockup el modulo real no se toca: la linea nueva se pisa en linea.
    pisa = "<script>planAsi('autos').linea = 'Lavado, pulido y cambio de aceite del carro. No es la asistencia en carretera.';</script>\n"
    g = rep(g, '<script src="../js/planes-asistencia.js"></script>\n', '<script src="../js/planes-asistencia.js"></script>\n' + pisa)
    c = rep(c, '<script src="../js/planes-asistencia.js"></script>\n', '<script src="../js/planes-asistencia.js"></script>\n' + pisa)
    # en el mockup la guia abre el configurador de mockup
    g = g.replace("return '../asistencias/' + (q.length", "return '../asistencias/_mockup.html' + (q.length")
    wr('explicacion/_mockup.html', g)
    wr('asistencias/_mockup.html', c)
    print('mockups escritos')
