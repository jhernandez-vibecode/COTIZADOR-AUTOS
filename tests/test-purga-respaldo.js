/**
 * Test del invariante que protege los datos del agente:
 *
 *   🔴 NUNCA se borra una cotización que no esté respaldada en Drive.
 *
 * La limpieza a los 90 días vivió un solo día (9 set 2026) en el arranque de la
 * app, y ese día quedó claro por qué era mal sitio: borraba primero y respaldaba
 * 2,5 segundos después — si el agente tenía Drive activado; si no, borraba sin
 * ninguna red. Un bug en historyTienePoliza() bastó para que se llevara cierres
 * reales de clientes.
 *
 * Ahora la purga es CONSECUENCIA del respaldo: la llama driveBackup() después de
 * confirmar la escritura. Este test fija esa garantía con un `fetch` simulado,
 * porque es la clase de invariante que se rompe en silencio.
 *
 * Run: node tests/test-purga-respaldo.js
 */

const path = require('path');
const fs = require('fs');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log('✓', name); pass++; })
    .catch(e => { console.error('✗', name, '\n   ', e.message); fail++; });
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'eq') + `: esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'esperaba verdadero'); }

const DIA = 86400000;
const haceDias = n => new Date(Date.now() - n * DIA).toISOString();

/**
 * Monta history.js + drive-sync.js en Node con localStorage y fetch simulados.
 * @param {object} opts
 * @param {boolean} opts.driveOn      - el agente activó el respaldo
 * @param {boolean} opts.escrituraOk  - la subida a Drive funciona
 * @param {Array}   opts.historial    - lo que hay en el navegador
 */
function montar(opts) {
  const store = {};
  const g = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    console: console,
    CFG: {
      DRIVE_FILES_URL:  'https://drive.test/files',
      DRIVE_UPLOAD_URL: 'https://drive.test/upload',
      CLIENT_ID: 'x'
    },
    escrituras: 0
  };

  store['cotizador_sdi_history_v1'] = JSON.stringify(opts.historial);
  if (opts.driveOn) store['cotizador_sdi_drive_v1'] = '1';

  // fetch simulado: listar (vacío) / subir (según escrituraOk)
  g.fetch = async function (url, init) {
    const m = String(init && init.method || 'GET').toUpperCase();
    if (m === 'GET') {
      // no hay respaldo previo → driveBackup irá directo a escribir
      return { ok: true, status: 200, json: async () => ({ files: [] }), text: async () => '{}' };
    }
    g.escrituras++;
    if (!opts.escrituraOk) {
      return { ok: false, status: 500, text: async () => 'fallo simulado de Drive' };
    }
    return { ok: true, status: 200, json: async () => ({ id: 'file-1' }), text: async () => '{}' };
  };

  const ctx = require('vm').createContext(g);
  g.window = g;   // los guards `typeof window` de los módulos

  for (const f of ['js/history.js', 'js/drive-sync.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    require('vm').runInContext(src, ctx, { filename: f });
  }
  g.getDriveToken = async () => 'token-de-prueba';   // sin OAuth real
  return g;
}

const VIEJAS = [
  { id: 'vieja1', date: haceDias(200), plate: 'AAA111', client: 'Sin poliza uno' },
  { id: 'vieja2', date: haceDias(300), plate: 'BBB222', client: 'Sin poliza dos' },
  { id: 'nueva',  date: haceDias(3),   plate: 'CCC333', client: 'Reciente' }
];

(async () => {

  await test('🔴 si la escritura en Drive FALLA, no se borra nada', async () => {
    const g = montar({ driveOn: true, escrituraOk: false, historial: VIEJAS });
    let lanzo = false;
    try { await g.driveBackup('t'); } catch (e) { lanzo = true; }
    ok(lanzo, 'driveBackup debería propagar el fallo');
    ok(g.escrituras > 0, 'ni siquiera intentó escribir');
    const vivas = g.loadHistoryVivas();
    eq(vivas.length, 3, 'BORRÓ cotizaciones sin haberlas respaldado');
    eq(Object.keys(g.loadResumen()).length, 0, 'contaminó el resumen sin respaldo');
  });

  await test('con la escritura confirmada, sí se borran las viejas sin póliza', async () => {
    const g = montar({ driveOn: true, escrituraOk: true, historial: VIEJAS });
    await g.driveBackup('t');
    const vivas = g.loadHistoryVivas();
    eq(vivas.length, 1, 'no purgó lo que ya estaba a salvo');
    eq(vivas[0].id, 'nueva');
    eq(g.loadHistory().filter(g.esTombstone).length, 2, 'faltan las lápidas');
  });

  await test('🔴 lo que se sube a Drive lleva los datos COMPLETOS, no las lápidas', async () => {
    // El orden importa: si se purgara antes de escribir, Drive recibiría las
    // lápidas y los datos no quedarían en ninguna parte.
    const g = montar({ driveOn: true, escrituraOk: true, historial: VIEJAS });
    let subido = null;
    const fetchOrig = g.fetch;
    g.fetch = async function (url, init) {
      const m = String(init && init.method || 'GET').toUpperCase();
      if (m !== 'GET' && init && typeof init.body === 'string' && init.body.indexOf('vieja1') !== -1) {
        subido = init.body;
      }
      return fetchOrig(url, init);
    };
    await g.driveBackup('t');
    ok(subido, 'no se encontró el cuerpo subido a Drive');
    ok(subido.indexOf('Sin poliza uno') !== -1, 'Drive recibió una lápida en vez de los datos');
    ok(subido.indexOf('AAA111') !== -1, 'se subió sin la placa');
  });

  await test('🔴 la purga NO corre desde el arranque de la app', async () => {
    // Hay exactamente DOS llamadores legítimos: driveBackup (automática, tras
    // respaldar) y el botón del ⚙ (manual, que respalda antes). Lo que no puede
    // volver es una llamada suelta en el arranque — fue la que perdió datos.
    const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    // toda llamada en app.js tiene que estar dentro de limpiarRegistroSinPoliza
    const ini = app.indexOf('async function limpiarRegistroSinPoliza');
    ok(ini > 0, 'no está la limpieza manual');
    const fin = app.indexOf('\n}', ini);
    const dentro = app.slice(ini, fin);
    const total = (app.match(/purgarHistorial\s*\(/g) || []).length;
    const enLimpieza = (dentro.match(/purgarHistorial\s*\(/g) || []).length;
    eq(total, enLimpieza, 'hay una llamada a purgarHistorial fuera de la limpieza manual');
    eq(enLimpieza, 1, 'la limpieza manual debería purgar una sola vez');

    // y la limpieza manual respalda ANTES de purgar
    const iBackup = dentro.indexOf('driveBackup(');
    const iPurga  = dentro.indexOf('purgarHistorial(');
    ok(iBackup > 0 && iBackup < iPurga, 'la limpieza manual borra antes de respaldar');

    const drive = fs.readFileSync(path.join(__dirname, '..', 'js', 'drive-sync.js'), 'utf8');
    ok(/purgarHistorial\s*\(/.test(drive), 'nadie llama a la purga automática');
  });

  await test('la purga no encadena un respaldo dentro del respaldo', async () => {
    const g = montar({ driveOn: true, escrituraOk: true, historial: VIEJAS });
    let programados = 0;
    g.scheduleDriveBackup = function () { programados++; };
    const r = g.purgarHistorial();
    eq(r.purgadas, 2, 'no purgó lo que debía');
    eq(programados, 0, 'purgar disparó otro respaldo: se encadenarían sin fin');
  });

  await test('purgar es idempotente dentro del mismo respaldo', async () => {
    const g = montar({ driveOn: true, escrituraOk: true, historial: VIEJAS });
    await g.driveBackup('t');
    const resumen1 = JSON.stringify(g.loadResumen());
    await g.driveBackup('t');
    eq(JSON.stringify(g.loadResumen()), resumen1, 'contó dos veces el mismo mes');
    eq(g.loadHistoryVivas().length, 1);
  });

  console.log(`\npurga-respaldo: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
