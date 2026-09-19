# -*- coding: utf-8 -*-
"""
Sección 2 de la guía (asistencia en carretera): la tabla de límites cambia según
el PLAN del vehículo (Plus 0-6 / Básico 7-15 / Limitado 16-20) y según la
cotización traiga M (Plan Extendido) o solo G.

  python docs/superpowers/specs/2026-09-19-asistencia-por-plan-mock.py mock
      -> explicacion/_mockup-asistencia.html   (NO commitear)
  python docs/superpowers/specs/2026-09-19-asistencia-por-plan-mock.py real
      -> aplica lo mismo a explicacion/index.html (SOLO con el OK de JC)

Fuente de cada cifra: documentos-ins/co-multiasistencia-170.pdf (INS, 3 feb 2026)
  G  Limitado p.12 · Básico p.12 · Plus p.13
  M  Limitado Extendido p.21 · Plus Extendido p.21
  M  Básico Extendido (particulares, uso personal): NO VIENE en la versión 2026.
     La cifra sale de la versión del 25 feb 2025 (V30), p.20. Decisión de JC (BX).
"""
import io, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(RAIZ, 'explicacion', 'index.html')
MOCK = os.path.join(RAIZ, 'explicacion', '_mockup-asistencia.html')

HTML_VIEJO_INI = '    <div class="plan-toggle">\n'
HTML_VIEJO_FIN = '    <nav class="step-nav-btns">\n      <button class="step-btn prev" data-target="s1">'

HTML_NUEVO = '''    <div class="plan-toggle" id="planTabs">
      <button class="tab" data-plan="plus">Plan Plus (0-6 años)</button>
      <button class="tab active" data-plan="basico">Plan Básico (7-15 años)</button>
      <button class="tab" data-plan="limitado">Plan Limitado (16-20 años)</button>
    </div>

    <div class="svc-grid" id="svcGrid">
      <div class="svc-row"><div class="icon t-oro"><svg class="ico"><use href="#i-truck"/></svg></div><div class="name">Remolque por avería</div><div class="qty" data-svc="averia">4× · $175</div></div>
      <div class="svc-row"><div class="icon t-rosa"><svg class="ico"><use href="#i-car"/></svg></div><div class="name">Remolque por accidente</div><div class="qty" data-svc="accidente">5× · $175</div></div>
      <div class="svc-row"><div class="icon t-viol"><svg class="ico"><use href="#i-key"/></svg></div><div class="name">Cerrajería</div><div class="qty" data-svc="cerrajeria">3× · $125</div></div>
      <div class="svc-row"><div class="icon t-cyan"><svg class="ico"><use href="#i-fuel"/></svg></div><div class="name">Envío combustible</div><div class="qty" data-svc="combustible">3× · costo</div></div>
      <div class="svc-row"><div class="icon t-azul"><svg class="ico"><use href="#i-disc"/></svg></div><div class="name">Cambio de llanta</div><div class="qty" data-svc="llanta">3× · $100</div></div>
      <div class="svc-row"><div class="icon t-verde"><svg class="ico"><use href="#i-battery-charging"/></svg></div><div class="name">Paso de corriente</div><div class="qty" data-svc="corriente">2× · $100</div></div>
      <div class="svc-row"><div class="icon t-oro"><svg class="ico"><use href="#i-life-buoy"/></svg></div><div class="name">Mini-rescate (atoramiento)</div><div class="qty" data-svc="rescate">2× · $100</div></div>
    </div>
    <p class="svc-nota" id="svcNota">Cantidad máxima de servicios por año calendario (1 de enero al 31 de diciembre) y monto máximo por servicio. Si tu póliza incluye la Multiasistencia Extendida (M), la cantidad de servicios es mayor. Fuente: Condiciones Operativas de Multiasistencia del INS.</p>

'''

CSS_MARCA = '.svc-row .qty{font-family:var(--font-mono);font-size:11.5px;color:var(--lc-ink-3)}\n'
CSS_NUEVO = CSS_MARCA + '.svc-nota{margin:14px 2px 0;font-size:12.5px;line-height:1.55;color:var(--lc-ink-3)}\n'

PURO = r'''
// ===== [GUIA-ASIST-PURO] — lógica pura, sin DOM. Límites de la Multiasistencia
// en carretera para PARTICULARES Y CARGA LIVIANA de USO PERSONAL.
// Fuente: documentos-ins/co-multiasistencia-170.pdf (INS, 3 feb 2026), leída
// página por página COMO IMAGEN. G: p.12-13 · M (Plan Extendido): p.21.
// Pág. 10: G y M NO se suman; con M rigen SOLO los límites del Plan Extendido.
// Cada fila: [eventos por año calendario, monto en USD por evento | 'costo'].
var ASIST_ORDEN = ['averia', 'accidente', 'cerrajeria', 'combustible', 'llanta', 'corriente', 'rescate'];
var ASIST_LIMITES = {
  plus:     { G: [[5,200],[5,200],[4,150],[4,'costo'],[5,125],[3,125],[3,125]],     // p.13
              M: [[7,200],[7,200],[6,150],[6,'costo'],[6,125],[4,125],[4,125]] },   // p.21
  basico:   { G: [[4,175],[5,175],[3,125],[3,'costo'],[3,100],[2,100],[2,100]],     // p.12
              // M Básico Extendido: __BASICO_NOTA__
              M: __BASICO_M__ },
  limitado: { G: [[3,175],[5,175],[2,125],[2,'costo'],[2,100],[2,100],[1,100]],     // p.12
              M: [[4,175],[6,175],[3,125],[3,'costo'],[3,100],[3,100],[2,100]] }    // p.21
};
/** Plan según la antigüedad. Más de 20 años: la Multiasistencia no se suscribe (p.7). */
function _planAsistencia(edad) {
  if (!(edad >= 0)) return null;
  if (edad <= 6) return 'plus';
  if (edad <= 15) return 'basico';
  if (edad <= 20) return 'limitado';
  return null;
}
/**
 * Filas a pintar. conM: true (la cotización trae M), false (solo G) o null (no se
 * sabe: enlace viejo sin cb -> se muestra G, que es el piso, y la nota lo aclara).
 * Si trae M pero el plan no tiene tabla Extendida, cae a G con extendidoSinTabla.
 */
function _limitesAsistencia(plan, conM) {
  var p = ASIST_LIMITES[plan];
  if (!p) return null;
  var usaM = conM === true && !!p.M;
  var filas = {};
  (usaM ? p.M : p.G).forEach(function (f, i) {
    filas[ASIST_ORDEN[i]] = f[0] + '× · ' + (f[1] === 'costo' ? 'costo' : '$' + f[1]);
  });
  return { filas: filas, extendido: usaM, extendidoSinTabla: conM === true && !p.M };
}
// ===== [/GUIA-ASIST-PURO] =====
'''

# BX-A: la cifra de la versión 2025 (la tabla que el INS omitió en la de 2026).
BASICO_M_A = "[[6,175],[7,175],[4,125],[4,'costo'],[4,100],[3,100],[3,100]]"
NOTA_A = "versión V30 del INS (25 feb 2025) p.20 — la versión 2026 NO trae esta tabla"
# BX-B: sin cifra; se muestra el piso de G y una nota cualitativa.
BASICO_M_B = "null"
NOTA_B = "el INS no la publica en la versión 2026 -> piso de G + nota cualitativa"

JS_VIEJO_INI = "  // Sección 2 — auto-seleccionar plan según edad\n"
JS_VIEJO_FIN = "  // Sección 4 — mostrar solo la fila del cliente según sr\n"

JS_NUEVO = r'''  // Sección 2 — la tabla de límites cambia con el plan del vehículo y con G / G+M.
  (function () {
    var tabs = document.querySelectorAll('#planTabs .tab');
    var nota = document.getElementById('svcNota');
    var sub = document.querySelector('#s2 .section-sub');
    var mapa = _parseCbMapa(data.cb);
    var conM = mapa ? ('M' in mapa) : null;
    var edad = data.y ? (new Date().getFullYear() - data.y) : null;
    var miPlan = _planAsistencia(edad);

    function pintar(plan) {
      var r = _limitesAsistencia(plan, conM);
      if (!r) return;
      tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-plan') === plan); });
      Object.keys(r.filas).forEach(function (k) {
        var el = document.querySelector('#svcGrid [data-svc="' + k + '"]');
        if (el) el.textContent = r.filas[k];
      });
      if (!nota) return;
      var base = 'Cantidad máxima de servicios por año calendario (1 de enero al 31 de diciembre) y monto máximo por servicio. ';
      var cola = ' Fuente: Condiciones Operativas de Multiasistencia del INS.';
      if (r.extendido) nota.textContent = base + 'Límites del Plan Extendido: tu cotización incluye la Multiasistencia Extendida (cobertura M).' + cola;
      else if (r.extendidoSinTabla) nota.textContent = base + 'Tu cotización incluye además la Multiasistencia Extendida (cobertura M), que amplía la cantidad de servicios de este plan; tu agente te confirma el detalle.' + cola;
      else if (conM === false) nota.textContent = base + 'Límites de la cobertura G (Multiasistencia Automóviles).' + cola;
      else nota.textContent = base + 'Si tu póliza incluye la Multiasistencia Extendida (M), la cantidad de servicios es mayor.' + cola;
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { pintar(t.getAttribute('data-plan')); }); });

    if (sub && conM !== null) {
      sub.textContent = (conM ? 'Coberturas G y M' : 'Cobertura G') + ' — siempre que necesites ayuda en la calle, te respaldamos.';
    }
    var bannerSmall = document.querySelector('.tip-banner .small');
    if (edad !== null && miPlan) {
      var nombre = { plus: 'Plus', basico: 'Básico', limitado: 'Limitado' }[miPlan];
      tabs.forEach(function (t) { if (t.getAttribute('data-plan') === miPlan) t.textContent += ' · Tu plan'; });
      if (bannerSmall) bannerSmall.innerHTML = 'El alcance del plan se ajusta a la antigüedad de tu vehículo. Para tu ' + esc(data.v || 'vehículo') + ' (' + edad + ' años) te toca el <b>Plan ' + nombre + (conM ? ' Extendido' : '') + '</b>.';
      pintar(miPlan);
    } else if (edad !== null) {
      // Más de 20 años: el INS no suscribe la Multiasistencia (p.7). Sin cifras.
      var pt = document.getElementById('planTabs'), sg = document.getElementById('svcGrid');
      if (pt) pt.style.display = 'none';
      if (sg) sg.style.display = 'none';
      if (nota) nota.style.display = 'none';
      if (bannerSmall) bannerSmall.textContent = 'El alcance de la asistencia depende de la antigüedad del vehículo. Tu agente te confirma qué servicios aplican al tuyo.';
    } else {
      pintar('basico');
    }
  })();

'''


def aplicar(txt, bx):
    a = txt.index(HTML_VIEJO_INI); b = txt.index(HTML_VIEJO_FIN)
    txt = txt[:a] + HTML_NUEVO + txt[b:]
    assert txt.count(CSS_MARCA) == 1
    txt = txt.replace(CSS_MARCA, CSS_NUEVO)
    fin = '// ===== [/GUIA-CB-PURO] =====\n'
    assert txt.count(fin) == 1
    puro = PURO.replace('__BASICO_M__', BASICO_M_A if bx == 'a' else BASICO_M_B).replace('__BASICO_NOTA__', NOTA_A if bx == 'a' else NOTA_B)
    txt = txt.replace(fin, fin + puro)
    a = txt.index(JS_VIEJO_INI); b = txt.index(JS_VIEJO_FIN)
    txt = txt[:a] + JS_NUEVO + txt[b:]
    return txt


if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'mock'
    bx = (sys.argv[2] if len(sys.argv) > 2 else 'a').lower()
    with io.open(SRC, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    crlf = '\r\n' in src
    out = aplicar(src.replace('\r\n', '\n'), bx)
    if modo == 'mock':
        # arnés: ?solo=s2 deja a la vista solo la sección 2 (para las capturas)
        out = out.replace('</body>', "<script>if(/[?&]solo=s2/.test(location.search)){document.querySelectorAll('main > *, body > header, body > footer, .hero, .sticky-nav, .float-nav, section').forEach(function(e){if(e.id!=='s2'&&!e.contains(document.getElementById('s2')))e.style.display='none'});var s=document.getElementById('s2');s.classList.add('in-view');s.style.opacity=1;s.style.transform='none';}</script>\n</body>")
    if crlf:
        out = out.replace('\n', '\r\n')
    dest = MOCK if modo == 'mock' else SRC
    if modo == 'mock' and bx == 'b':
        dest = MOCK.replace('.html', '-b.html')
    with io.open(dest, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('escrito', dest, '| BX =', bx)
