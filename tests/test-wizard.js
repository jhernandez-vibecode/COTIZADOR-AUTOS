/**
 * Test de las piezas compartidas por los tres asistentes (js/wizard.js).
 *
 * El módulo nació el 9 set 2026, en la revisión de calidad: `setStep()` estaba
 * byte a byte idéntico en poliza-app.js y renovacion-app.js, el regex del correo
 * aparecía CINCO veces, y el reintento de token vencido estaba duplicado en dos
 * pantallas y FALTABA en el cotizador.
 *
 * Lo que vigila:
 *   1. 🔴 Que el envío reintente cuando el token se vence a mitad — y una sola
 *      vez, para que un error real no quede escondido en un bucle.
 *   2. Que el correo se valide igual en las tres pantallas.
 *   3. Que el pintado de pasos marque activo/hechos como corresponde.
 *
 * Run: node tests/test-wizard.js
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log('✓', name); pass++; })
    .catch(e => { console.error('✗', name, '\n   ', e.message); fail++; });
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'eq') + `: esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'esperaba verdadero'); }

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'wizard.js'), 'utf8');

/** Monta wizard.js con getToken/sendEmail/clearToken simulados. */
function montar(comportamiento) {
  const g = {
    console: console,
    llamadas: { getToken: 0, sendEmail: 0, clearToken: 0 },
    window: { scrollTo: function () {} }
  };
  g.getToken   = async () => { g.llamadas.getToken++; };
  g.clearToken = () => { g.llamadas.clearToken++; };
  g.sendEmail  = async (raw) => {
    g.llamadas.sendEmail++;
    const r = comportamiento(g.llamadas.sendEmail, raw);
    if (r) throw r;
  };
  const ctx = vm.createContext(g);
  vm.runInContext(SRC, ctx, { filename: 'js/wizard.js' });
  return g;
}

(async () => {

  // ===== 1. El reintento =====
  console.log('\n-- el token que se vence a mitad del envío --');

  await test('🔴 un 401 en el primer intento se reintenta y el correo sale', async () => {
    const g = montar(n => (n === 1 ? new Error('Request failed: 401 Unauthorized') : null));
    await g.enviarConReintento('RAW');
    eq(g.llamadas.sendEmail, 2, 'no reintentó');
    eq(g.llamadas.clearToken, 1, 'reintentó con el token viejo');
    eq(g.llamadas.getToken, 2, 'no pidió un token nuevo');
  });

  await test('también reintenta si el mensaje habla de token expirado', async () => {
    const g = montar(n => (n === 1 ? new Error('token expired') : null));
    await g.enviarConReintento('RAW');
    eq(g.llamadas.sendEmail, 2);
  });

  await test('🔴 un error que NO es de token no se reintenta: se muestra', async () => {
    const g = montar(() => new Error('Attachment too large'));
    let msg = '';
    try { await g.enviarConReintento('RAW'); } catch (e) { msg = e.message; }
    eq(msg, 'Attachment too large', 'se tragó el error real');
    eq(g.llamadas.sendEmail, 1, 'reintentó algo que no era el token');
    eq(g.llamadas.clearToken, 0);
  });

  await test('🔴 reintenta UNA sola vez: si el segundo también falla, propaga', async () => {
    const g = montar(() => new Error('401 Unauthorized'));
    let msg = '';
    try { await g.enviarConReintento('RAW'); } catch (e) { msg = e.message; }
    ok(msg.indexOf('401') !== -1, 'no propagó el error');
    eq(g.llamadas.sendEmail, 2, 'debe intentar exactamente dos veces, no más');
  });

  await test('sin errores, un solo envío y sin limpiar token', async () => {
    const g = montar(() => null);
    await g.enviarConReintento('RAW');
    eq(g.llamadas.sendEmail, 1);
    eq(g.llamadas.clearToken, 0);
  });

  // ===== 2. El correo =====
  console.log('\n-- validación del correo --');
  const W = montar(() => null);

  await test('acepta direcciones normales', async () => {
    ['ana@ejemplo.com', 'a.b+c@sub.dominio.cr', ' con@espacios.com '].forEach(function (v) {
      ok(W.esEmailValido(v), v);
    });
  });

  await test('rechaza lo que no llega a correo', async () => {
    ['', null, undefined, 'sinarroba.com', 'a@b', 'a@ b.com', 'dos@arro@bas.com'].forEach(function (v) {
      ok(!W.esEmailValido(v), String(v));
    });
  });

  await test('correosInvalidos devuelve solo los mal escritos de una lista', async () => {
    const mal = W.correosInvalidos('ana@x.com, roto@, beto@y.cr');
    eq(mal.length, 1);
    eq(mal[0], 'roto@');
  });

  await test('correosInvalidos: lista buena → vacío; vacío → vacío', async () => {
    eq(W.correosInvalidos('ana@x.com, beto@y.cr').length, 0);
    eq(W.correosInvalidos('').length, 0);
    eq(W.correosInvalidos('  ,  ').length, 0, 'una coma suelta no es un correo malo');
  });

  // ===== 3. El pintado de pasos =====
  console.log('\n-- el indicador de pasos --');

  /** DOM mínimo: 4 vistas y 4 pasos, como las tres pantallas. */
  function domFalso() {
    const clase = () => {
      const set = new Set();
      return { toggle: (c, on) => (on ? set.add(c) : set.delete(c)), has: c => set.has(c) };
    };
    const views = [1, 2, 3, 4].map(n => ({ id: 'view' + n, classList: clase() }));
    const steps = [1, 2, 3, 4].map(n => ({
      getAttribute: () => String(n), classList: clase()
    }));
    return {
      views, steps,
      document: {
        querySelectorAll: sel => (sel === '.view' ? views : steps)
      },
      window: { scrollTo: function () {} }
    };
  }

  await test('marca activa solo la vista del paso', async () => {
    const d = domFalso();
    const g = { console: console, document: d.document, window: d.window };
    vm.runInContext(SRC, vm.createContext(g), { filename: 'w' });
    g.wizardSetStep(3);
    eq(d.views.filter(v => v.classList.has('active')).length, 1);
    ok(d.views[2].classList.has('active'), 'no activó view3');
  });

  await test('los pasos anteriores quedan como hechos y el actual como activo', async () => {
    const d = domFalso();
    const g = { console: console, document: d.document, window: d.window };
    vm.runInContext(SRC, vm.createContext(g), { filename: 'w' });
    g.wizardSetStep(3);
    ok(d.steps[0].classList.has('done') && d.steps[1].classList.has('done'), 'faltan los hechos');
    ok(d.steps[2].classList.has('active'), 'el paso 3 no quedó activo');
    ok(!d.steps[3].classList.has('done') && !d.steps[3].classList.has('active'), 'el paso 4 no debería marcarse');
  });

  await test('volver atrás desmarca los que ya no corresponden', async () => {
    const d = domFalso();
    const g = { console: console, document: d.document, window: d.window };
    vm.runInContext(SRC, vm.createContext(g), { filename: 'w' });
    g.wizardSetStep(4);
    g.wizardSetStep(2);
    ok(d.steps[1].classList.has('active'));
    ok(!d.steps[2].classList.has('done'), 'el paso 3 quedó marcado como hecho al retroceder');
    ok(!d.steps[3].classList.has('active'));
  });

  // ===== 4. Ya no quedan copias sueltas =====
  console.log('\n-- una sola copia --');

  await test('🔴 el regex del correo vive en un solo archivo', async () => {
    const dir = path.join(__dirname, '..', 'js');
    const con = fs.readdirSync(dir).filter(function (f) {
      if (f === 'wizard.js' || !f.endsWith('.js')) return false;
      return /\[\^\\s@\]/.test(fs.readFileSync(path.join(dir, f), 'utf8'));
    });
    eq(con.length, 0, 'volvió a copiarse el regex en: ' + con.join(', '));
  });

  await test('🔴 el reintento de token no volvió a duplicarse', async () => {
    const dir = path.join(__dirname, '..', 'js');
    const con = fs.readdirSync(dir).filter(function (f) {
      // gmail-auth.js es el DUEÑO de clearToken: ahí se define, no se copia.
      if (f === 'wizard.js' || f === 'gmail-auth.js' || !f.endsWith('.js')) return false;
      // El patrón del reintento es limpiar el token y volver a pedirlo seguido.
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      return /clearToken\s*\([\s\S]{0,120}getToken\s*\(/.test(src);
    });
    eq(con.length, 0, 'hay un reintento propio en: ' + con.join(', '));
  });

  await test('🔴 setStep ya no está duplicado entre las dos sub-páginas', async () => {
    const dir = path.join(__dirname, '..', 'js');
    const cuerpo = function (f) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const i = s.indexOf('function setStep');
      return i < 0 ? '' : s.slice(i, i + 400).replace(/\s+/g, ' ');
    };
    const a = cuerpo('poliza-app.js'), b = cuerpo('renovacion-app.js');
    ok(a && b, 'no se hallaron los setStep');
    ok(a.indexOf('wizardSetStep') !== -1 && b.indexOf('wizardSetStep') !== -1,
       'alguna volvió a pintar los pasos por su cuenta');
    ok(a.indexOf('querySelectorAll') === -1 && b.indexOf('querySelectorAll') === -1,
       'quedó el DOM de los pasos duplicado');
  });

  console.log(`\nwizard: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
