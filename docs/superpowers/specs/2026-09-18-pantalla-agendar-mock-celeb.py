# La pantalla que abre "Agendar mi cita": que no parezca que la cita YA quedó agendada.
# Uso: python mock-celeb.py mock | real
import sys
R = 'C:/Users/segur/COTIZADOR-AUTOS/'
MODO = sys.argv[1] if len(sys.argv) > 1 else 'mock'
p = R + 'explicacion/index.html'
s = open(p, encoding='utf-8', newline='').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

# Titular: decía "¡Muy bien, X! 🎉" con confeti → se leía como cita ya hecha (JC, 18 set 2026).
rep('    <h2 class="celeb-title">¡Muy bien,<br/><span class="name">Jonathan</span>! 🎉</h2>\n    <p class="celeb-sub">Completaste el paso 1 de 2. Tu cita aún está pendiente.</p>',
    '    <h2 class="celeb-title">Falta un paso,<br/><span class="name">Jonathan</span></h2>\n    <p class="celeb-sub">Ya revisaste tu cotización. <b>Tu cita todavía no está agendada</b>: se agenda en el formulario que abre el botón de abajo.</p>')
rep("    celebTitle.innerHTML = `¡Muy bien,<br/><span class=\"name\">${esc(data.c || 'Cliente')}</span>! 🎉`;",
    "    // Sin \"¡Muy bien!\" ni confeti: se leía como cita ya agendada (JC, 18 set 2026).\n    celebTitle.innerHTML = `Falta un paso,<br/><span class=\"name\">${esc(data.c || 'Cliente')}</span>`;")
# Paso pendiente, en vos y con la insignia que dice lo que falta
rep('          <b>Agenda tu cita</b>\n          <span id="celebStepConfirm">Confirma con Juan Carlos</span>\n        </div>\n        <div class="celeb-step-badge pend">Pendiente</div>',
    '          <b>Agendá tu cita</b>\n          <span id="celebStepConfirm">Llená el formulario de Juan Carlos</span>\n        </div>\n        <div class="celeb-step-badge pend">Falta</div>')
rep("  if (celebStepConfirm) celebStepConfirm.textContent = `Confirma con ${data.n}`;",
    "  if (celebStepConfirm) celebStepConfirm.textContent = `Llená el formulario de ${String(data.n).split(' ')[0]}`;")
# Botón y pie
rep('      <span>Completar — Agendar mi cita</span>', '      <span>Abrir el formulario y agendar</span>')
rep('    <p class="celeb-cta-hint">Solo toma 1 minuto · Recibirás confirmación por correo</p>',
    '    <p class="celeb-cta-hint">Toma 1 minuto. Tu cita queda agendada cuando enviás el formulario.</p>')
# Confeti fuera: todavía no hay nada que celebrar. Se esconde por CSS (los nodos quedan, por si algún día vuelve).
rep("#sasi[hidden],#asiGrid[hidden],#asiCtaWrap[hidden]{display:none!important}" if "#sasi[hidden],#asiGrid[hidden]" in s else "#sasi[hidden]{display:none!important}",
    ("#sasi[hidden],#asiGrid[hidden],#asiCtaWrap[hidden]{display:none!important}" if "#sasi[hidden],#asiGrid[hidden]" in s else "#sasi[hidden]{display:none!important}") +
    "\n/* La pantalla de \"Agendar\" ya no celebra: la cita todavía no está hecha (18 set 2026). */\n.celeb-modal .confetti{display:none!important}\n.celeb-sub b{color:var(--lc-ink);font-weight:600}")

dest = p if MODO == 'real' else R + 'explicacion/_mockup.html'
open(dest, 'w', encoding='utf-8', newline='').write(s)
print('escrito', dest)
