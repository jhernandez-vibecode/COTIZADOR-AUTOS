# Detalle de Coberturas Vigentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al cotizador SDI una nueva feature que permite al agente generar y enviar al cliente un resumen visual personalizado de sus coberturas vigentes. Form en `/coberturas/`, página visual en `/detalle/?...`, link enviado por correo. Patrón espejo del explicador.

**Architecture:**
- Dos páginas single-file nuevas: `coberturas/index.html` (form interno del agente) y `detalle/index.html` (página visual pública del cliente).
- Datos viajan por ~25 query params en el URL del `/detalle/?...` (sin backend, sin almacenamiento).
- Reuso completo del envío Gmail/Outlook ya implementado (`buildMIMESimple`, `gmail-auth.js`, `outlook-sender.js`).
- Campo nuevo `whatsapp` en el perfil del agente (modal ⚙) para botón verde en footer del detalle.
- Botón nuevo 🛡 dorado en header del cotizador, junto al 🧮.

**Tech Stack:** HTML5 + CSS custom properties + JS vanilla · Google Fonts (Sora) · Sin React, Babel, Tailwind, ni build step. Mismo stack que el resto del cotizador.

**Spec:** [docs/superpowers/specs/2026-05-14-detalle-coberturas-vigentes-design.md](../specs/2026-05-14-detalle-coberturas-vigentes-design.md)

---

## Mapa de archivos

### Crear
- `coberturas/index.html` — formulario del agente (single-file, HTML+CSS+JS inline)
- `detalle/index.html` — página visual del cliente (single-file con secciones condicionales)
- `js/coverage-url.js` — helper `buildDetalleUrl(formData)` que construye URL `/detalle/?...`
- `tests/test-coverage-url.js` — Node test del builder de URL (sigue patrón de `pdf-test/`)
- `tests/test-coverage-email.js` — Node test del builder del correo

### Modificar
- `index.html` — agregar botón `<a href="coberturas/">🛡</a>` entre 🧮 y ⚙ del header
- `index.html` — agregar input "WhatsApp del agente" al modal de perfil
- `js/agent-profile.js` — agregar `whatsapp` al objeto perfil + en `applyProfile` setear `CFG.WHATSAPP`
- `js/config.js` — agregar `CFG.WHATSAPP` con valor default
- `js/email-template.js` — agregar función `buildCoverageEmail({clientName, vehicle, plate, detalleUrl})`

### NO tocar
- `js/pdf-extract.js`, `js/pdf-modify.js` — nada que ver con esta feature
- `js/gmail-auth.js`, `js/outlook-auth.js`, `js/outlook-sender.js`, `js/mime-builder.js` — reusados sin cambios
- `explicacion/index.html`, `cancelacion/index.html` — fuera de alcance

---

## Task 0: Preparar entorno

**Files:** ninguno

- [ ] **Step 1: Verificar que el clone está al día**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git fetch origin main && git status
```

Expected: `Your branch is up to date with 'origin/main'.` y `nothing to commit, working tree clean`. Si hay cambios sin commit, evaluar antes de seguir.

- [ ] **Step 2: Crear branch de trabajo**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git checkout -b feat/coberturas-vigentes
```

Expected: `Switched to a new branch 'feat/coberturas-vigentes'`.

- [ ] **Step 3: Verificar que existe el spec aprobado**

Run:
```bash
ls C:/tmp/COTIZADOR-AUTOS/docs/superpowers/specs/2026-05-14-detalle-coberturas-vigentes-design.md
```

Expected: el archivo existe.

---

## Task 1: Campo WhatsApp en perfil del agente

**Files:**
- Modify: `js/config.js`
- Modify: `js/agent-profile.js`
- Modify: `index.html` (modal del agente)

**Por qué primero:** todas las demás piezas (form, página visual, correo) leen `CFG.WHATSAPP`. Sin esto, no se puede probar nada con el agente real.

- [ ] **Step 1: Agregar CFG.WHATSAPP en config.js**

Read `js/config.js` completo. Localizar el bloque CFG. Agregar línea después de `PHONE`:

```javascript
CFG.WHATSAPP = '8822-1348';  // WhatsApp del agente, sin código país (se normaliza al usar)
```

- [ ] **Step 2: Verificar sintaxis**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node --check js/config.js
```

Expected: sin output (success).

- [ ] **Step 3: Modificar agent-profile.js — agregar whatsapp al esquema y storage**

Read `js/agent-profile.js`. Localizar `loadProfile`, `saveProfile`, `applyProfile`. Agregar `whatsapp` en cada uno:

En `loadProfile` y `saveProfile` (estructura del objeto guardado en localStorage):
```javascript
// El objeto guardado en localStorage['cotizador_sdi_agent_v1'] ahora incluye:
// { name, email, phone, license, website, agendaUrl, whatsapp, provider }
```

En `applyProfile`, después del bloque de `CFG.AGENDA_URL`:
```javascript
if (p.whatsapp) CFG.WHATSAPP = p.whatsapp;
```

En `saveProfile` (lectura de inputs):
```javascript
const whatsapp = (document.getElementById('p-whatsapp') || {}).value || '';
```

Y al construir el objeto a guardar:
```javascript
const profile = { name, email, phone, license, website, agendaUrl, whatsapp, provider };
```

En `loadProfile` (poblar inputs al abrir modal):
```javascript
const inWa = document.getElementById('p-whatsapp');
if (inWa) inWa.value = p.whatsapp || CFG.WHATSAPP || '';
```

- [ ] **Step 4: Verificar sintaxis**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node --check js/agent-profile.js
```

Expected: sin output.

- [ ] **Step 5: Agregar input al modal en index.html**

Read `index.html`. Localizar el modal de perfil (sección `<div class="modal-backdrop" id="profileModal">`). Encontrar el input `p-phone` (Teléfono). Agregar nuevo `<div class="form-row">` justo después:

```html
<div class="form-row">
  <label class="form-label" for="p-whatsapp">WhatsApp (para botón verde en página del cliente)</label>
  <input class="form-control" id="p-whatsapp" type="tel" placeholder="8822-1348" />
</div>
```

- [ ] **Step 6: Verificar en navegador**

Manual:
1. Abrir `C:/tmp/COTIZADOR-AUTOS/index.html` en navegador (file://) o servir con `python -m http.server 8000`
2. Click ⚙ → modal abre
3. Verificar que aparece el campo "WhatsApp"
4. Llenar cualquier número, click Guardar
5. Cerrar modal, abrir de nuevo → verificar que el número persistió

- [ ] **Step 7: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/config.js js/agent-profile.js index.html
git commit -m "feat(perfil): agregar campo WhatsApp al perfil del agente"
```

---

## Task 2: Helper `js/coverage-url.js` + test Node

**Files:**
- Create: `js/coverage-url.js`
- Create: `tests/test-coverage-url.js`

- [ ] **Step 1: Escribir el test PRIMERO (TDD)**

Create `C:/tmp/COTIZADOR-AUTOS/tests/test-coverage-url.js`:

```javascript
// Test del builder de URL para /detalle/?...
// Run: node tests/test-coverage-url.js

const fs = require('fs');
const vm = require('vm');

// Cargar el módulo en sandbox
const code = fs.readFileSync(__dirname + '/../js/coverage-url.js', 'utf-8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const { buildDetalleUrl } = sandbox;

let pass = 0, fail = 0;
function assertEq(name, got, want) {
  const ok = got === want;
  console.log(ok ? `  ✓ ${name}` : `  ✗ ${name}\n     got:  ${got}\n     want: ${want}`);
  ok ? pass++ : fail++;
}

console.log('\n[buildDetalleUrl]');

// Test 1: URL básica con datos mínimos
const u1 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent:  { name: 'Juan', license: '08-1318', website: 'segurosdelins.com', whatsapp: '8822-1348', email: 'j@x.com' },
  client: { name: 'María', email: 'm@y.com' },
  vehicle: { description: 'Yaris Sedan', plate: 'BRK454', year: 2019, valor: 10000000, electric: false },
  policy: { from: '2026-01-14', to: '2027-01-14', paymentForm: 't', lastPremium: 158423 },
  coverages: ['A','C','D','F','B','H','GM','IDD'],
  customAmounts: {},
  iddAmount: 400000,
  repPlan: null,
  deductible: 'nec',
});

assertEq('URL contains nombre cliente', u1.includes('c=Mar%C3%ADa'), true);
assertEq('URL contains placa', u1.includes('p=BRK454'), true);
assertEq('URL contains cobs separados por _', u1.includes('cobs=A_C_D_F_B_H_GM_IDD'), true);
assertEq('URL contains deducible', u1.includes('ded=nec'), true);
assertEq('URL contains idd', u1.includes('idd=400000'), true);
assertEq('URL no incluye vt si NO eléctrico', !u1.includes('vt=e'), true);
assertEq('URL no incluye rep si null', !u1.includes('rep='), true);

// Test 2: con eléctrico, REP, y custom amounts
const u2 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent:  { name: 'Juan', license: '08-1318', website: '', whatsapp: '8822-1348', email: 'j@x.com' },
  client: { name: 'Pepe', email: 'p@y.com' },
  vehicle: { description: 'Tesla', plate: 'EV001', year: 2023, valor: 25000000, electric: true },
  policy: { from: '2026-03-01', to: '2027-03-01', paymentForm: 'a', lastPremium: 600000 },
  coverages: ['A','C','D','F','B','H','REP'],
  customAmounts: { A: 500000000, B: 25000000 },
  iddAmount: null,
  repPlan: 'P',
  deductible: 'f400',
});

assertEq('URL incluye vt=e si eléctrico', u2.includes('vt=e'), true);
assertEq('URL incluye rep=P', u2.includes('rep=P'), true);
assertEq('URL incluye a300 (monto custom de A)', u2.includes('a300=500000000'), true);
assertEq('URL incluye b15 (monto custom de B)', u2.includes('b15=25000000'), true);
assertEq('URL no incluye c100 si NO se editó', !u2.includes('c100='), true);

// Test 3: WhatsApp normalization
const u3 = buildDetalleUrl({
  base: 'https://x.com/detalle/',
  agent: { name: 'X', license: '', website: '', whatsapp: '+506 8822-1348', email: '' },
  client: { name: 'Y', email: '' },
  vehicle: { description: '', plate: '', year: 0, valor: 0, electric: false },
  policy: { from: '', to: '', paymentForm: '', lastPremium: 0 },
  coverages: [],
  customAmounts: {}, iddAmount: null, repPlan: null, deductible: '',
});
assertEq('WhatsApp se normaliza a solo dígitos con 506', u3.includes('wa=50688221348'), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el test (debe fallar — el módulo no existe)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node tests/test-coverage-url.js
```

Expected: error porque `js/coverage-url.js` no existe todavía.

- [ ] **Step 3: Crear `js/coverage-url.js`**

Create `C:/tmp/COTIZADOR-AUTOS/js/coverage-url.js`:

```javascript
/**
 * Construye la URL del /detalle/?... a partir de los datos del formulario.
 * Sigue el patrón de _buildGuideUrl() del email-template.js pero con
 * más parámetros y normalización específica de WhatsApp.
 *
 * @param {object} d - datos del formulario
 * @param {string} d.base - URL base, ej: "https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/"
 * @param {object} d.agent  - { name, license, website, whatsapp, email }
 * @param {object} d.client - { name, email }
 * @param {object} d.vehicle - { description, plate, year, valor, electric }
 * @param {object} d.policy  - { from, to, paymentForm, lastPremium } — ISO dates, paymentForm ∈ a/s/t/m
 * @param {string[]} d.coverages - ej: ['A','C','N','D','F','B','H','GM','IDD','REP']
 * @param {object} d.customAmounts - { A?: number, C?: number, B?: number }
 * @param {?number} d.iddAmount - 300000 | 400000 | 500000 | null
 * @param {?string} d.repPlan - 'P'|'G'|'N'|'A' | null
 * @param {string} d.deductible - 'nec'|'f400'|'f500'|'o150'|'o500'
 * @returns {string} URL completa del detalle
 */
function buildDetalleUrl(d) {
  const base = d.base;
  const params = [];

  const add = function(key, val) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      params.push(key + '=' + encodeURIComponent(String(val).trim()));
    }
  };

  // Agente
  add('n',  d.agent.name);
  add('l',  d.agent.license);
  add('w',  d.agent.website);
  add('e',  d.agent.email);
  // WhatsApp: normalizar a solo dígitos con prefijo 506
  if (d.agent.whatsapp) {
    let wa = String(d.agent.whatsapp).replace(/\D/g, '');
    if (wa && !wa.startsWith('506')) wa = '506' + wa;
    if (wa) params.push('wa=' + wa);
  }

  // Cliente
  add('c', d.client.name);

  // Vehículo
  add('v',  d.vehicle.description);
  add('p',  d.vehicle.plate);
  add('y',  d.vehicle.year);
  add('va', d.vehicle.valor);
  if (d.vehicle.electric) params.push('vt=e');

  // Póliza
  add('vd', d.policy.from);
  add('vh', d.policy.to);
  add('fp', d.policy.paymentForm);
  add('pp', d.policy.lastPremium);

  // Coberturas (joined con _)
  if (d.coverages && d.coverages.length) {
    add('cobs', d.coverages.join('_'));
  }

  // Montos custom — solo si fueron editados
  if (d.customAmounts) {
    if (d.customAmounts.A) add('a300', d.customAmounts.A);
    if (d.customAmounts.C) add('c100', d.customAmounts.C);
    if (d.customAmounts.B) add('b15',  d.customAmounts.B);
  }

  // Sub-opciones
  add('idd', d.iddAmount);
  add('rep', d.repPlan);

  // Deducible
  add('ded', d.deductible);

  if (params.length === 0) return base;
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  return base + sep + params.join('&');
}

// Export para Node tests + global para browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDetalleUrl };
}
if (typeof window !== 'undefined') {
  window.buildDetalleUrl = buildDetalleUrl;
}
// Node sandbox vm context
if (typeof globalThis !== 'undefined') {
  globalThis.buildDetalleUrl = buildDetalleUrl;
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node tests/test-coverage-url.js
```

Expected: `11 passed, 0 failed` (o el número correcto de assertions).

- [ ] **Step 5: Verificar sintaxis**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node --check js/coverage-url.js
```

Expected: sin output.

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/coverage-url.js tests/test-coverage-url.js
git commit -m "feat(coberturas): helper buildDetalleUrl + tests Node"
```

---

## Task 3: Función `buildCoverageEmail()` en email-template.js + test Node

**Files:**
- Modify: `js/email-template.js`
- Create: `tests/test-coverage-email.js`

- [ ] **Step 1: Escribir el test PRIMERO**

Create `C:/tmp/COTIZADOR-AUTOS/tests/test-coverage-email.js`:

```javascript
// Test del builder del correo "Detalle de coberturas vigentes"
// Run: node tests/test-coverage-email.js

const fs = require('fs');
const vm = require('vm');

// Cargar config + email-template en sandbox
const cfgCode = fs.readFileSync(__dirname + '/../js/config.js', 'utf-8');
const tmplCode = fs.readFileSync(__dirname + '/../js/email-template.js', 'utf-8');

const sandbox = { console, window: {}, document: { getElementById: () => null } };
vm.createContext(sandbox);
vm.runInContext(cfgCode, sandbox);
vm.runInContext(tmplCode, sandbox);
const { buildCoverageEmail, CFG } = sandbox;

let pass = 0, fail = 0;
function assertContains(name, hay, needle) {
  const ok = hay.indexOf(needle) !== -1;
  console.log(ok ? `  ✓ ${name}` : `  ✗ ${name}\n     no contiene: ${needle}`);
  ok ? pass++ : fail++;
}

console.log('\n[buildCoverageEmail]');

const html = buildCoverageEmail({
  clientName: 'María Rodríguez',
  vehicle: 'Toyota Yaris Sedan',
  plate: 'BRK454',
  detalleUrl: 'https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/?n=Juan&c=Mar%C3%ADa',
});

assertContains('Saludo al cliente', html, 'Hola María Rodríguez');
assertContains('Vehículo aparece', html, 'Toyota Yaris Sedan');
assertContains('Placa aparece', html, 'BRK454');
assertContains('Botón con URL', html, 'href="https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/?n=Juan&c=Mar%C3%ADa"');
assertContains('Texto del botón', html, 'VER DETALLE DE MIS COBERTURAS');
assertContains('Leyenda condiciones generales', html, 'condiciones generales');
assertContains('Logo INS en header', html, 'ins-logo.png');
assertContains('Footer con nombre del agente (CFG.FROM_NAME)', html, CFG.FROM_NAME || 'Juan Carlos');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el test (debe fallar — la función no existe)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node tests/test-coverage-email.js
```

Expected: `TypeError: buildCoverageEmail is not a function`.

- [ ] **Step 3: Agregar buildCoverageEmail() a email-template.js**

Read `js/email-template.js`. Al final del archivo (después de `_buildGuideUrl`), agregar:

```javascript
/**
 * Construye el HTML del correo "Detalle de coberturas vigentes".
 * Mucho más corto que buildEmail() — solo intro + botón al detalle.
 *
 * @param {object} p
 * @param {string} p.clientName  - nombre completo del cliente
 * @param {string} p.vehicle     - descripción del vehículo (ej: "Toyota Yaris Sedan")
 * @param {string} p.plate       - placa
 * @param {string} p.detalleUrl  - URL del detalle (de buildDetalleUrl)
 * @returns {string} HTML del correo
 */
function buildCoverageEmail(p) {
  const fromName = CFG.FROM_NAME || 'Juan Carlos Hernández';
  const license  = CFG.LICENSE   || '08-1318';
  const phone    = CFG.PHONE     || '8822-1348';
  const email    = CFG.FROM_EMAIL || 'jhernandez@segurosdelins.com';
  const website  = CFG.WEBSITE   || 'segurosdelins.com';
  const logoUrl  = (CFG.SITE_BASE || 'https://cotizador-segurosdigitalesins-sdi.netlify.app') + '/img/ins-logo.png';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Detalle de coberturas vigentes</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#0b1d3a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:white;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#0b1d3a;padding:24px;text-align:center;">
              <img src="${logoUrl}" alt="INS" style="height:40px;display:inline-block;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 16px;font-size:16px;color:#0b1d3a;"><strong>Hola ${escHtml(p.clientName)},</strong></p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
                Te comparto el resumen de las coberturas vigentes en tu póliza de seguro de auto del INS para tu <strong>${escHtml(p.vehicle)} (${escHtml(p.plate)})</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                Hacé click en el botón para ver el detalle completo — coberturas, asistencia, deducible y datos de tu póliza.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${p.detalleUrl}" style="display:inline-block;background:#0b1d3a;color:white;padding:14px 28px;border-radius:6px;font-weight:bold;text-decoration:none;font-size:15px;">VER DETALLE DE MIS COBERTURAS &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;font-style:italic;text-align:center;line-height:1.5;">
                Este es un breve resumen de tu cobertura. Para más información consultar las condiciones generales de tu póliza.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#0b1d3a;padding:18px 24px;text-align:center;color:white;">
              <div style="font-size:14px;font-weight:bold;color:white;">${escHtml(fromName)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Agente · Lic. SUGESE ${escHtml(license)} · ${escHtml(phone)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:8px;">${escHtml(email)} · ${escHtml(website)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// Helper de escape (si no existe ya en el archivo, agregarlo cerca del top)
function escHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

**NOTA IMPORTANTE:** verificar si `escHtml` ya existe en `email-template.js`. Si existe, NO duplicar — solo usar la existente. Si no existe, agregarla cerca del top del archivo.

- [ ] **Step 4: Correr el test (debe pasar)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node tests/test-coverage-email.js
```

Expected: `8 passed, 0 failed`.

- [ ] **Step 5: Verificar sintaxis**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node --check js/email-template.js
```

Expected: sin output.

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/email-template.js tests/test-coverage-email.js
git commit -m "feat(coberturas): buildCoverageEmail con HTML corto + tests"
```

---

## Task 4: Página `coberturas/index.html` — formulario completo

**Files:**
- Create: `coberturas/index.html`

**Por qué un solo task grande:** la página es single-file y la lógica del form está acoplada al HTML. Patrón idéntico a `cancelacion/index.html`.

- [ ] **Step 1: Crear archivo con estructura HTML completa**

Create `C:/tmp/COTIZADOR-AUTOS/coberturas/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Detalle de coberturas vigentes — Cotizador SDI</title>
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../css/styles.css" />
  <style>
    body { font-family: 'Sora', sans-serif; background: #f8fafc; color: #0b1d3a; margin: 0; }
    .container { max-width: 900px; margin: 24px auto; padding: 0 20px; }
    .header { background: #0b1d3a; color: white; padding: 18px 24px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .header a { color: white; text-decoration: none; font-size: 13px; opacity: 0.7; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .card h2 { color: #0b1d3a; margin: 0 0 16px; font-size: 17px; font-weight: 700; border-bottom: 2px solid #0b1d3a; padding-bottom: 8px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .row-3 { grid-template-columns: 2fr 1fr 1fr; }
    .row-4 { grid-template-columns: repeat(4, 1fr); }
    label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
    input:focus, select:focus { outline: 2px solid #fbbf24; outline-offset: -1px; }
    .req::after { content: ' *'; color: #dc2626; }
    .hint { font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 4px; }
    .cob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 14px; }
    .cob-grid label { display: flex; align-items: center; gap: 8px; padding: 6px; cursor: pointer; font-weight: 500; color: #0b1d3a; }
    .cob-grid input[type=checkbox] { width: 16px; height: 16px; margin: 0; }
    .sub-opt { margin-top: 12px; padding: 12px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; display: none; }
    .sub-opt.visible { display: block; }
    .sub-opt label { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 4px; cursor: pointer; }
    .sub-opt input[type=number] { max-width: 200px; }
    .ded-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ded-grid label { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .ded-grid label:has(input:checked) { border-color: #f59e0b; background: #fffbeb; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
    .btn { padding: 12px 20px; border: none; border-radius: 6px; font-family: inherit; font-weight: 700; font-size: 14px; cursor: pointer; }
    .btn-primary { background: #0b1d3a; color: white; }
    .btn-secondary { background: #64748b; color: white; }
    .btn:hover { opacity: 0.9; }
    .error { background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
    .modal-bg { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000; }
    .modal-bg.visible { display: flex; }
    .modal { background: white; border-radius: 8px; max-width: 700px; width: 90%; max-height: 90vh; overflow: auto; padding: 0; }
    .modal-head { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .modal-head h3 { margin: 0; font-size: 16px; }
    .modal-body { padding: 20px; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; }
  </style>
</head>
<body>

  <div class="container">

    <header class="header">
      <h1>🛡 Detalle de coberturas vigentes</h1>
      <a href="../">← Volver al cotizador</a>
    </header>

    <form id="formCoberturas">

      <div class="card">
        <h2>1 · Datos del cliente</h2>
        <div class="row">
          <div>
            <label class="req" for="c-name">Nombre completo</label>
            <input id="c-name" type="text" placeholder="Ej: María Rodríguez Solís" required />
          </div>
          <div>
            <label class="req" for="c-email">Correo</label>
            <input id="c-email" type="email" placeholder="cliente@correo.com" required />
          </div>
        </div>
      </div>

      <div class="card">
        <h2>2 · Vehículo y póliza</h2>
        <div class="row row-3">
          <div>
            <label class="req" for="v-desc">Descripción del vehículo</label>
            <input id="v-desc" type="text" placeholder="Toyota Yaris Sedan" required />
          </div>
          <div>
            <label class="req" for="v-plate">Placa</label>
            <input id="v-plate" type="text" placeholder="BRK454" required />
          </div>
          <div>
            <label class="req" for="v-year">Año</label>
            <input id="v-year" type="number" min="1990" max="2030" placeholder="2019" required />
          </div>
        </div>
        <div class="row">
          <div>
            <label class="req" for="v-valor">Valor asegurado (₡)</label>
            <input id="v-valor" type="number" min="0" placeholder="10000000" required />
            <div class="hint">⚠ Recordá mantener actualizado tu monto asegurado</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding-top:24px;">
            <input id="v-elec" type="checkbox" style="width:18px;height:18px;" />
            <label for="v-elec" style="margin:0;font-weight:600;font-size:14px;">⚡ Vehículo eléctrico</label>
          </div>
        </div>
        <div class="row row-4" style="margin-top:8px;">
          <div>
            <label class="req" for="v-vd">Vigencia desde</label>
            <input id="v-vd" type="date" required />
          </div>
          <div>
            <label class="req" for="v-vh">Vigencia hasta</label>
            <input id="v-vh" type="date" required />
          </div>
          <div>
            <label class="req" for="v-fp">Forma de pago</label>
            <select id="v-fp" required>
              <option value="">— Elegir —</option>
              <option value="a">Anual</option>
              <option value="s">Semestral</option>
              <option value="t">Trimestral</option>
              <option value="m">Mensual</option>
            </select>
          </div>
          <div>
            <label class="req" for="v-pp">Última prima pagada (₡, c/IVA)</label>
            <input id="v-pp" type="number" min="0" placeholder="158423" required />
          </div>
        </div>
      </div>

      <div class="card">
        <h2>3 · Coberturas vigentes</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 12px;">Marcá las que el cliente tiene contratadas. Algunas tienen sub-opciones que aparecen al marcar.</p>
        <div class="cob-grid">
          <label><input type="checkbox" name="cob" value="A" /> <strong>A</strong> · Daños a personas</label>
          <label><input type="checkbox" name="cob" value="C" /> <strong>C</strong> · Daños a propiedad</label>
          <label><input type="checkbox" name="cob" value="N" /> <strong>N</strong> · Exención del deducible (aplica a C)</label>
          <label><input type="checkbox" name="cob" value="D" /> <strong>D</strong> · Colisión y vuelco</label>
          <label><input type="checkbox" name="cob" value="F" /> <strong>F</strong> · Robo y/o hurto</label>
          <label><input type="checkbox" name="cob" value="B" /> <strong>B</strong> · Gastos médicos familiares</label>
          <label><input type="checkbox" name="cob" value="H" /> <strong>H</strong> · Riesgos adicionales</label>
          <label><input type="checkbox" name="cob" value="GM" /> <strong>G/M</strong> · Asistencia 24/7 <span style="color:#94a3b8;font-size:11px;">(plan auto del año)</span></label>
          <label><input type="checkbox" name="cob" value="IDD" /> <strong>IDD</strong> · Reintegro del deducible</label>
          <label><input type="checkbox" name="cob" value="REP" /> <strong>REP</strong> · Sustitución de repuestos</label>
        </div>

        <div class="sub-opt" id="sub-A">
          <label>Monto de A — Daños a personas (₡)</label>
          <input id="amt-A" type="number" min="0" placeholder="300000000" value="300000000" />
        </div>
        <div class="sub-opt" id="sub-C">
          <label>Monto de C — Daños a propiedad (₡)</label>
          <input id="amt-C" type="number" min="0" placeholder="100000000" value="100000000" />
        </div>
        <div class="sub-opt" id="sub-B">
          <label>Monto de B — Gastos médicos (₡)</label>
          <input id="amt-B" type="number" min="0" placeholder="15000000" value="15000000" />
        </div>
        <div class="sub-opt" id="sub-IDD">
          <label>Si IDD, ¿qué monto?</label>
          <label><input type="radio" name="idd" value="300000" /> ₡300.000</label>
          <label><input type="radio" name="idd" value="400000" checked /> ₡400.000 (más común)</label>
          <label><input type="radio" name="idd" value="500000" /> ₡500.000</label>
        </div>
        <div class="sub-opt" id="sub-REP">
          <label>Si REP, ¿qué plan?</label>
          <label><input type="radio" name="rep" value="P" /> Garantía Plus</label>
          <label><input type="radio" name="rep" value="G" /> Garantía</label>
          <label><input type="radio" name="rep" value="N" /> Nuevo</label>
          <label><input type="radio" name="rep" value="A" /> Alternativo genérico (Usados)</label>
        </div>
      </div>

      <div class="card">
        <h2>4 · Deducible</h2>
        <div class="ded-grid">
          <label><input type="radio" name="ded" value="nec" checked /> <strong>N en C</strong></label>
          <label><input type="radio" name="ded" value="f400" /> Fijo <strong>₡400.000</strong></label>
          <label><input type="radio" name="ded" value="f500" /> Fijo <strong>₡500.000</strong></label>
          <label><input type="radio" name="ded" value="o150" /> Ordinario <strong>20%</strong> · mín ₡150.000</label>
          <label><input type="radio" name="ded" value="o500" /> Ordinario <strong>20%</strong> · mín ₡500.000</label>
        </div>
      </div>

      <div id="error-box"></div>

      <div class="actions">
        <button type="button" id="btnPreview" class="btn btn-secondary">Vista previa del correo</button>
        <button type="submit" id="btnSend" class="btn btn-primary">Enviar al cliente</button>
      </div>

    </form>

  </div>

  <!-- Modal de vista previa -->
  <div class="modal-bg" id="previewModal">
    <div class="modal">
      <div class="modal-head">
        <h3>Vista previa del correo</h3>
        <button type="button" class="modal-close" id="btnClosePreview">&times;</button>
      </div>
      <div class="modal-body">
        <iframe id="previewFrame" style="width:100%;height:600px;border:1px solid #e5e7eb;border-radius:6px;"></iframe>
        <div style="margin-top:12px;font-size:12px;color:#94a3b8;">
          URL del detalle: <a id="previewUrl" target="_blank" style="word-break:break-all;"></a>
        </div>
      </div>
    </div>
  </div>

  <!-- Scripts en orden de dependencia -->
  <script src="../js/config.js"></script>
  <script src="../js/state.js"></script>
  <script src="../js/agent-profile.js"></script>
  <script src="../js/coverage-url.js"></script>
  <script src="../js/email-template.js"></script>
  <script src="../js/mime-builder.js"></script>
  <script src="../js/gmail-auth.js"></script>
  <script src="../js/outlook-auth.js"></script>
  <script src="../js/outlook-sender.js"></script>

  <script>
    // === Inicialización ===
    document.addEventListener('DOMContentLoaded', function() {
      // Cargar perfil del agente
      if (typeof loadProfile === 'function') {
        const p = loadProfile();
        if (typeof applyProfile === 'function' && p) applyProfile(p);
      }

      // Wire sub-opciones condicionales
      ['A', 'C', 'B', 'IDD', 'REP'].forEach(function(code) {
        const cb = document.querySelector('input[name=cob][value=' + code + ']');
        const sub = document.getElementById('sub-' + code);
        if (cb && sub) {
          cb.addEventListener('change', function() {
            sub.classList.toggle('visible', cb.checked);
          });
        }
      });

      // Wire vista previa
      document.getElementById('btnPreview').addEventListener('click', handlePreview);
      document.getElementById('btnClosePreview').addEventListener('click', function() {
        document.getElementById('previewModal').classList.remove('visible');
      });

      // Wire envío
      document.getElementById('formCoberturas').addEventListener('submit', handleSubmit);
    });

    // === Recolectar datos del form ===
    function collectFormData() {
      const cobs = Array.from(document.querySelectorAll('input[name=cob]:checked')).map(function(i) { return i.value; });
      const customAmounts = {};
      if (cobs.includes('A')) {
        const v = parseInt(document.getElementById('amt-A').value, 10);
        if (v && v !== 300000000) customAmounts.A = v;
      }
      if (cobs.includes('C')) {
        const v = parseInt(document.getElementById('amt-C').value, 10);
        if (v && v !== 100000000) customAmounts.C = v;
      }
      if (cobs.includes('B')) {
        const v = parseInt(document.getElementById('amt-B').value, 10);
        if (v && v !== 15000000) customAmounts.B = v;
      }

      const iddRadio = document.querySelector('input[name=idd]:checked');
      const repRadio = document.querySelector('input[name=rep]:checked');
      const dedRadio = document.querySelector('input[name=ded]:checked');

      return {
        agent: {
          name:     CFG.FROM_NAME  || '',
          license:  CFG.LICENSE    || '',
          website:  CFG.WEBSITE    || '',
          whatsapp: CFG.WHATSAPP   || '',
          email:    CFG.FROM_EMAIL || '',
        },
        client: {
          name:  document.getElementById('c-name').value.trim(),
          email: document.getElementById('c-email').value.trim(),
        },
        vehicle: {
          description: document.getElementById('v-desc').value.trim(),
          plate:       document.getElementById('v-plate').value.trim().toUpperCase(),
          year:        parseInt(document.getElementById('v-year').value, 10),
          valor:       parseInt(document.getElementById('v-valor').value, 10),
          electric:    document.getElementById('v-elec').checked,
        },
        policy: {
          from:        document.getElementById('v-vd').value,
          to:          document.getElementById('v-vh').value,
          paymentForm: document.getElementById('v-fp').value,
          lastPremium: parseInt(document.getElementById('v-pp').value, 10),
        },
        coverages:     cobs,
        customAmounts: customAmounts,
        iddAmount:     cobs.includes('IDD') && iddRadio ? parseInt(iddRadio.value, 10) : null,
        repPlan:       cobs.includes('REP') && repRadio ? repRadio.value : null,
        deductible:    dedRadio ? dedRadio.value : 'nec',
      };
    }

    // === Validación ===
    function validate(data) {
      const errors = [];
      if (!data.client.name) errors.push('Falta el nombre del cliente.');
      if (!data.client.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client.email)) errors.push('Correo del cliente inválido.');
      if (!data.vehicle.description) errors.push('Falta la descripción del vehículo.');
      if (!data.vehicle.plate) errors.push('Falta la placa.');
      if (!data.vehicle.year || data.vehicle.year < 1990 || data.vehicle.year > 2030) errors.push('Año del vehículo inválido.');
      if (!data.vehicle.valor || data.vehicle.valor <= 0) errors.push('Valor asegurado inválido.');
      if (!data.policy.from || !data.policy.to) errors.push('Faltan fechas de vigencia.');
      if (data.policy.from && data.policy.to && data.policy.from >= data.policy.to) errors.push('Vigencia desde debe ser anterior a vigencia hasta.');
      if (!data.policy.paymentForm) errors.push('Falta forma de pago.');
      if (!data.policy.lastPremium || data.policy.lastPremium <= 0) errors.push('Última prima pagada inválida.');
      if (!data.coverages.length) errors.push('Marcá al menos una cobertura.');
      return errors;
    }

    function showErrors(errors) {
      const box = document.getElementById('error-box');
      if (!errors.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="error"><strong>Revisá:</strong><ul style="margin:6px 0 0 20px;padding:0;">' +
        errors.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ul></div>';
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // === Vista previa ===
    function handlePreview() {
      const data = collectFormData();
      const errors = validate(data);
      if (errors.length) { showErrors(errors); return; }
      showErrors([]);

      const detalleUrl = buildDetalleUrl(Object.assign({
        base: location.origin + '/detalle/'
      }, data));

      const html = buildCoverageEmail({
        clientName: data.client.name,
        vehicle:    data.vehicle.description,
        plate:      data.vehicle.plate,
        detalleUrl: detalleUrl,
      });

      const iframe = document.getElementById('previewFrame');
      iframe.srcdoc = html;
      const link = document.getElementById('previewUrl');
      link.textContent = detalleUrl;
      link.href = detalleUrl;
      document.getElementById('previewModal').classList.add('visible');
    }

    // === Envío real ===
    async function handleSubmit(e) {
      e.preventDefault();
      const data = collectFormData();
      const errors = validate(data);
      if (errors.length) { showErrors(errors); return; }
      showErrors([]);

      const btn = document.getElementById('btnSend');
      btn.disabled = true;
      btn.textContent = 'Enviando…';

      try {
        const detalleUrl = buildDetalleUrl(Object.assign({
          base: location.origin + '/detalle/'
        }, data));

        const html = buildCoverageEmail({
          clientName: data.client.name,
          vehicle:    data.vehicle.description,
          plate:      data.vehicle.plate,
          detalleUrl: detalleUrl,
        });

        const subject = 'Detalle de tus coberturas vigentes — ' + data.vehicle.description + ' (' + data.vehicle.plate + ')';
        const fromHeader = (CFG.FROM_NAME ? '"' + CFG.FROM_NAME + '" <' + CFG.FROM_EMAIL + '>' : CFG.FROM_EMAIL);

        const provider = (S && S.provider) || 'gmail';

        if (provider === 'outlook') {
          await outlookSendMail({
            to: data.client.email,
            subject: subject,
            html: html,
          });
        } else {
          const raw = buildMIMESimple({
            to: data.client.email,
            from: fromHeader,
            subject: subject,
            html: html,
          });
          const token = await getToken();
          await sendEmail(raw, token);
        }

        alert('✅ Correo enviado a ' + data.client.email);
        document.getElementById('formCoberturas').reset();
      } catch (err) {
        console.error(err);
        alert('❌ Error al enviar: ' + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar al cliente';
      }
    }
  </script>

</body>
</html>
```

- [ ] **Step 2: Verificar que el archivo no tiene errores de sintaxis HTML**

Manual: abrir `C:/tmp/COTIZADOR-AUTOS/coberturas/index.html` en Chrome.
- Verificar que la página carga sin errores en consola
- Llenar todos los campos requeridos
- Marcar IDD → debe aparecer la sub-opción con 3 radios
- Marcar REP → debe aparecer la sub-opción con 4 radios
- Marcar A → debe aparecer input de monto con default 300000000
- Click "Vista previa del correo" → debe abrir modal con iframe que muestra el correo

- [ ] **Step 3: Verificar que mimeBuilder tiene buildMIMESimple**

Read `js/mime-builder.js` y verificar que existe la función `buildMIMESimple({to, from, subject, html})`. Si no existe (solo existe `buildMIME` con PDF), copiar el patrón de cómo `cancelacion/index.html` envía sin PDF y agregarla:

```javascript
// Si NO existe buildMIMESimple en mime-builder.js, agregar:
function buildMIMESimple(p) {
  const boundary = 'sdi_simple_' + Date.now();
  const subject = _encodeSubject(p.subject);
  const fromHeader = _encodeFromHeader(p.from);
  const headers = [
    'From: ' + fromHeader,
    'To: ' + p.to,
    'Subject: ' + subject,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    _b64utf8(p.html),
  ].join('\r\n');
  return _b64url(headers);
}
// Asegurar que _encodeFromHeader, _encodeSubject, _b64utf8, _b64url están exportadas también.
```

Si ya existe (probablemente sí, porque `cancelacion/` la usa), saltar este step.

- [ ] **Step 4: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add coberturas/index.html
git commit -m "feat(coberturas): formulario del agente con validación + vista previa + envío"
```

---

## Task 5: Página `detalle/index.html` — vista del cliente (single-file)

**Files:**
- Create: `detalle/index.html`

**Por qué un solo task grande:** misma razón que Task 4 — single-file, todas las secciones comparten CSS y dependen del mismo bloque de lectura de URL params.

- [ ] **Step 1: Crear archivo con estructura completa**

Create `C:/tmp/COTIZADOR-AUTOS/detalle/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title id="pageTitle">Detalle de coberturas vigentes</title>
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --navy: #0b1d3a;
      --navy-2: #1e3a8a;
      --gold: #fbbf24;
      --gold-dark: #f59e0b;
      --bg: #f8fafc;
      --text: #475569;
      --muted: #94a3b8;
      --border: #e5e7eb;
      --card-bg: #ffffff;
      --green: #22c55e;
      --green-text: #16a34a;
      --red: #dc2626;
      --blue: #2563eb;
      --purple: #9333ea;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Sora', sans-serif; background: var(--bg); color: var(--text); }
    .container { max-width: 800px; margin: 0 auto; }
    .empty { padding: 60px 20px; text-align: center; }
    .empty h2 { color: var(--navy); }
    .empty p { color: var(--muted); }

    .head {
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .head img.logo-ins { height: 48px; margin-bottom: 16px; display: inline-block; }
    .head .tag { font-size: 11px; letter-spacing: 2px; opacity: 0.7; margin-bottom: 8px; }
    .head h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .head .sub { opacity: 0.9; margin-top: 8px; font-size: 15px; }
    .head .leyenda {
      margin: 14px auto 0; max-width: 600px;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid var(--gold);
      border-radius: 8px; padding: 10px 14px;
      font-size: 12px; color: #fef3c7;
    }

    .banda {
      background: white; padding: 18px 24px; border-bottom: 1px solid var(--border);
    }
    .banda-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; font-size: 12px; }
    .banda-grid .k { color: var(--muted); }
    .banda-grid .v { font-weight: 600; color: var(--navy); }
    .banda-recordatorio { margin-top: 10px; font-size: 11px; color: var(--muted); text-align: center; font-style: italic; }

    .section { padding: 24px; }
    .section .num { font-size: 11px; letter-spacing: 2px; color: var(--text); margin-bottom: 8px; }
    .section h2 { color: var(--navy); margin: 0 0 14px; font-size: 18px; }
    .section h2.sub { font-size: 14px; font-weight: 600; color: var(--muted); margin-top: 4px; }

    .cob-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; }
    .cob-card {
      padding: 14px; background: var(--card-bg); border-radius: 8px;
      border-left: 3px solid var(--blue);
    }
    .cob-card.green  { border-left-color: var(--green-text); }
    .cob-card.red    { border-left-color: var(--red); }
    .cob-card.purple { border-left-color: var(--purple); }
    .cob-card.gold   {
      grid-column: span 2;
      background: #fffbeb; border-left-color: var(--gold-dark);
    }
    .cob-head { display: flex; justify-content: space-between; align-items: baseline; }
    .cob-title { font-weight: 700; font-size: 14px; color: var(--blue); }
    .cob-card.green .cob-title  { color: var(--green-text); }
    .cob-card.red .cob-title    { color: var(--red); }
    .cob-card.purple .cob-title { color: var(--purple); }
    .cob-card.gold .cob-title   { color: var(--gold-dark); }
    .cob-amount { font-weight: 700; color: var(--navy); }
    .cob-desc { color: var(--text); margin: 6px 0 0; line-height: 1.4; }

    .svc-grid {
      background: white; border-radius: 8px; padding: 14px;
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
    }
    .svc-row { display: flex; align-items: center; gap: 10px; padding: 6px; }
    .svc-row .ic { font-size: 22px; }
    .svc-row .nm { flex: 1; font-size: 13px; color: var(--navy); }
    .svc-row .qy { font-size: 11px; color: var(--text); }

    .idd-card {
      background: white; border-radius: 8px; padding: 18px; text-align: center;
    }
    .idd-row { display: flex; align-items: center; gap: 18px; justify-content: center; }
    .idd-col .lbl { font-size: 11px; color: var(--muted); }
    .idd-col .val { font-size: 22px; font-weight: 700; }
    .idd-col.from .val { color: var(--red); }
    .idd-col.to .val   { color: var(--green-text); }
    .idd-arrow { font-size: 24px; color: var(--muted); }
    .idd-meta { margin-top: 10px; font-size: 11px; color: var(--muted); }

    .ded-card {
      background: #fffbeb; border-left: 3px solid var(--gold-dark);
      border-radius: 8px; padding: 14px;
    }
    .ded-card .lbl { font-weight: 700; color: var(--navy); }
    .ded-card .desc { font-size: 12px; color: var(--text); margin-top: 4px; }

    .rep-card {
      background: white; border-radius: 8px; padding: 14px;
    }
    .rep-card .lbl { font-weight: 700; color: var(--navy); font-size: 14px; }
    .rep-card .desc { font-size: 12px; color: var(--text); margin-top: 6px; line-height: 1.5; }

    .elec-card {
      background: linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%);
      border-radius: 8px; padding: 18px;
    }
    .elec-card h3 { margin: 0 0 8px; color: #155e75; font-size: 16px; }
    .elec-card .lead { color: #155e75; font-size: 13px; line-height: 1.5; margin: 0 0 10px; }
    .elec-card .lead b { color: #164e63; }
    .elec-card .bat-box { background: white; border-radius: 6px; padding: 12px; }
    .elec-card .bat-label { font-size: 11px; color: #94a3b8; }
    .elec-card .bat-amount { font-size: 22px; font-weight: 700; color: #155e75; }

    footer.foot {
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%);
      color: white; text-align: center; padding: 24px;
    }
    .foot .preg { font-size: 13px; opacity: 0.9; margin-bottom: 14px; }
    .foot .name { font-size: 18px; font-weight: 700; }
    .foot .meta { font-size: 12px; opacity: 0.7; }
    .foot .ctas { margin-top: 16px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .foot .btn { padding: 12px 18px; border-radius: 6px; font-size: 13px; font-weight: 700; text-decoration: none; }
    .foot .btn-wa { background: var(--green); color: white; }
    .foot .btn-web { background: transparent; color: white; border: 1px solid white; font-weight: 600; }
    .foot .sdi-wrap {
      margin-top: 24px; padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px;
    }
    .foot .sdi-wrap svg { height: 48px; }

    @media (max-width: 600px) {
      .banda-grid { grid-template-columns: repeat(2, 1fr); }
      .cob-grid, .svc-grid { grid-template-columns: 1fr; }
      .cob-card.gold { grid-column: span 1; }
    }
  </style>
</head>
<body>

  <div class="container" id="root">
    <!-- Renderizado por JS según URL params -->
  </div>

  <script>
    // === Lectura y normalización de params ===
    const P = new URLSearchParams(location.search);
    function get(k, def) { const v = P.get(k); return (v === null || v === '') ? (def === undefined ? '' : def) : v; }
    function getInt(k, def) { const v = parseInt(P.get(k), 10); return isNaN(v) ? (def || 0) : v; }

    const data = {
      agent: {
        name:    get('n'),
        license: get('l'),
        website: get('w'),
        whatsapp: get('wa'),
        email:   get('e'),
      },
      client: { name: get('c') },
      vehicle: {
        description: get('v'),
        plate:       get('p'),
        year:        getInt('y'),
        valor:       getInt('va'),
        electric:    get('vt') === 'e',
      },
      policy: {
        from:        get('vd'),
        to:          get('vh'),
        paymentForm: get('fp'),
        lastPremium: getInt('pp'),
      },
      coverages: get('cobs') ? get('cobs').split('_') : [],
      customAmounts: {
        A: getInt('a300', 300000000),
        C: getInt('c100', 100000000),
        B: getInt('b15',  15000000),
      },
      iddAmount: getInt('idd', 400000),
      repPlan:   get('rep'),
      deductible: get('ded', 'nec'),
    };

    // === Si no hay params, mostrar mensaje informativo ===
    if (!data.client.name && !data.coverages.length) {
      document.getElementById('root').innerHTML = `
        <div class="empty">
          <h2>📋 Esta página debe abrirse desde el link enviado por tu agente.</h2>
          <p>Si recibiste un correo con detalle de tus coberturas, hacé click en el botón del correo.</p>
        </div>`;
    } else {
      render();
    }

    // === Helpers de formato ===
    function fmtMoney(n) {
      if (!n || isNaN(n)) return '';
      return '₡' + n.toLocaleString('es-CR');
    }
    function fmtMoneyShort(n) {
      if (!n || isNaN(n)) return '';
      if (n >= 1000000) return '₡' + (n / 1000000).toFixed(0) + 'M';
      if (n >= 1000)    return '₡' + (n / 1000).toFixed(0) + 'K';
      return '₡' + n;
    }
    function fmtFecha(iso) {
      if (!iso) return '';
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (!m) return iso;
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return parseInt(m[3], 10) + ' ' + meses[parseInt(m[2], 10) - 1] + ' ' + m[1];
    }
    function fmtFp(code) {
      return { a: 'Anual', s: 'Semestral', t: 'Trimestral', m: 'Mensual' }[code] || code;
    }
    function escHtml(s) {
      if (s === undefined || s === null) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function firstName(full) {
      if (!full) return '';
      const parts = full.trim().split(/\s+/);
      return parts.length >= 3 ? parts[2] : parts[0];
    }
    function planAsistencia(year) {
      if (!year) return { plan: 'Plan Básico', rango: '7-15 años', tipo: 'basico' };
      const ahora = new Date().getFullYear();
      const edad = ahora - year;
      if (edad <= 6)  return { plan: 'Plan Plus',   rango: '0-6 años',   tipo: 'plus' };
      if (edad <= 15) return { plan: 'Plan Básico', rango: '7-15 años',  tipo: 'basico' };
      return { plan: null, mensaje: 'Tu vehículo no califica para asistencia 24/7 (más de 15 años).' };
    }
    function dedTexto(code) {
      return {
        nec:  { lbl: 'N en C',                                            desc: 'Si daño a tercero menor a ₡750.000 → solo pagás ₡150.000. Si mayor → sin deducible. Para D/F/H aplica el deducible regular.' },
        f400: { lbl: 'Fijo ₡400.000',                                     desc: 'Aplica a colisión, robo y riesgos adicionales (D, F, H).' },
        f500: { lbl: 'Fijo ₡500.000',                                     desc: 'Aplica a colisión, robo y riesgos adicionales (D, F, H).' },
        o150: { lbl: 'Ordinario 20% del daño · mín ₡150.000',             desc: 'Aplica a colisión, robo y riesgos adicionales (D, F, H). Pagás 20% del costo del daño con un mínimo de ₡150.000.' },
        o500: { lbl: 'Ordinario 20% del daño · mín ₡500.000',             desc: 'Aplica a colisión, robo y riesgos adicionales (D, F, H). Pagás 20% del costo del daño con un mínimo de ₡500.000.' },
      }[code] || { lbl: code, desc: '' };
    }
    function repTexto(code) {
      return {
        P: { lbl: 'Garantía Plus',           desc: 'Repuestos originales nuevos del fabricante.' },
        G: { lbl: 'Garantía',                desc: 'Repuestos originales con garantía del fabricante.' },
        N: { lbl: 'Nuevo',                   desc: 'Repuestos nuevos no necesariamente originales.' },
        A: { lbl: 'Alternativo (genéricos)', desc: 'Repuestos alternativos de mercado, también llamados de uso.' },
      }[code] || { lbl: 'No especificado', desc: '' };
    }

    function whatsappUrl(wa, clientName, agentName) {
      if (!wa) return null;
      const phone = String(wa).replace(/\D/g, '');
      const fullPhone = phone.startsWith('506') ? phone : '506' + phone;
      const text = encodeURIComponent('Hola ' + (agentName || '') + ', soy ' + (clientName || '') + '. Vi el detalle de mis coberturas y tengo una consulta.');
      return 'https://web.whatsapp.com/send/?phone=' + fullPhone + '&text=' + text;
    }

    // === Render principal ===
    function render() {
      document.getElementById('pageTitle').textContent = 'Coberturas vigentes — ' + (data.client.name || '') + ' (' + (data.vehicle.plate || '') + ')';
      const root = document.getElementById('root');
      root.innerHTML = renderHead() + renderBanda() + renderCoberturas() + renderAsistencia() + renderIDD() + renderDeducible() + renderRepuestos() + renderElectric() + renderFooter();
    }

    function renderHead() {
      const greeting = firstName(data.client.name) || data.client.name;
      const vehLine = (data.vehicle.description || '') + (data.vehicle.year ? ' ' + data.vehicle.year : '') + (data.vehicle.plate ? ' (' + data.vehicle.plate + ')' : '');
      return `
        <div class="head">
          <img class="logo-ins" src="../img/ins-logo.png" alt="INS" />
          <div class="tag">DETALLE DE COBERTURAS VIGENTES</div>
          <h1>Hola, ${escHtml(greeting)}</h1>
          ${vehLine.trim() ? '<p class="sub">Resumen de las coberturas con las que cuenta tu ' + escHtml(vehLine) + '.</p>' : ''}
          <div class="leyenda">ℹ Este es un breve resumen de tu cobertura. Para más información consultar las condiciones generales.</div>
        </div>`;
    }

    function renderBanda() {
      const valor = data.vehicle.valor;
      return `
        <div class="banda">
          <div class="banda-grid">
            <div><div class="k">VIGENCIA DESDE</div><div class="v">${escHtml(fmtFecha(data.policy.from))}</div></div>
            <div><div class="k">VIGENCIA HASTA</div><div class="v">${escHtml(fmtFecha(data.policy.to))}</div></div>
            <div><div class="k">FORMA DE PAGO</div><div class="v">${escHtml(fmtFp(data.policy.paymentForm))}</div></div>
            <div><div class="k">ÚLT. PRIMA PAGADA</div><div class="v">${escHtml(fmtMoney(data.policy.lastPremium))} c/IVA</div></div>
          </div>
          ${valor ? '<div class="banda-recordatorio">Recordá mantener actualizado tu monto asegurado actual: ' + fmtMoney(valor) + '</div>' : ''}
        </div>`;
    }

    function renderCoberturas() {
      if (!data.coverages.length) return '';
      const coverDefs = {
        A: { color: '',       title: 'A · Daños a personas',           desc: 'Responsabilidad civil si causás un accidente con lesiones o muerte de terceros.', amount: data.customAmounts.A, suffix: '· sin deducible' },
        C: { color: '',       title: 'C · Daños a propiedad',          desc: 'Daños a otros vehículos, postes, muros, casas o cualquier propiedad ajena.',       amount: data.customAmounts.C, suffix: '' },
        D: { color: 'green',  title: 'D · Colisión y vuelco',          desc: 'Pérdidas directas, súbitas y accidentales de tu vehículo por choque o vuelco.',     amount: data.vehicle.valor,   suffix: '' },
        F: { color: 'green',  title: 'F · Robo y/o hurto',             desc: 'Pérdidas accidentales por robo o hurto total o parcial del vehículo.',             amount: data.vehicle.valor,   suffix: '' },
        B: { color: 'red',    title: 'B · Gastos médicos familiares',  desc: 'Atención médica para vos y tu familia si resultan lesionados en un accidente.',    amount: data.customAmounts.B, suffix: '· sin deducible' },
        H: { color: 'purple', title: 'H · Riesgos adicionales',        desc: 'Naturaleza, vandalismo, incendio, animales y otros riesgos al vehículo.',          amount: data.vehicle.valor,   suffix: '' },
      };

      const order = ['A', 'C', 'D', 'F', 'B', 'H'];
      const cards = order.filter(function(k) { return data.coverages.includes(k); }).map(function(k) {
        const c = coverDefs[k];
        return `
          <div class="cob-card ${c.color}">
            <div class="cob-head">
              <div class="cob-title">${escHtml(c.title)}</div>
              <div class="cob-amount">${fmtMoneyShort(c.amount)}</div>
            </div>
            <p class="cob-desc">${escHtml(c.desc)} ${c.suffix ? '<em>' + escHtml(c.suffix) + '</em>' : ''}</p>
          </div>`;
      }).join('');

      const nCard = data.coverages.includes('N') ? `
        <div class="cob-card gold">
          <div class="cob-title">N · Exención del deducible (aplica a C)</div>
          <p class="cob-desc">Si daño a tercero menor a ₡750.000 → solo pagás ₡150.000. Si mayor → sin deducible.</p>
        </div>` : '';

      return `
        <div class="section">
          <div class="num">📋 SECCIÓN 1</div>
          <h2>Coberturas que tenés contratadas</h2>
          <div class="cob-grid">${cards}${nCard}</div>
        </div>`;
    }

    function renderAsistencia() {
      if (!data.coverages.includes('GM')) return '';
      const ai = planAsistencia(data.vehicle.year);
      if (!ai.plan) {
        return `
          <div class="section">
            <div class="num">🛠 SECCIÓN 2</div>
            <h2>Tu asistencia 24/7</h2>
            <div class="svc-grid" style="grid-template-columns:1fr;"><div style="padding:14px;color:var(--text);font-size:13px;">${escHtml(ai.mensaje)}</div></div>
          </div>`;
      }
      // Servicios y cantidades según el plan
      const svcs = ai.tipo === 'plus' ? [
        { ic: '🚛', nm: 'Remolque por avería',   qy: '8× · $200' },
        { ic: '🚗', nm: 'Remolque por accidente', qy: '10× · $200' },
        { ic: '🔑', nm: 'Cerrajería',             qy: '6× · $150' },
        { ic: '⛽', nm: 'Envío de combustible',   qy: '6× · costo' },
        { ic: '🛞', nm: 'Cambio de llanta',       qy: '6× · $125' },
        { ic: '🔋', nm: 'Paso de corriente',      qy: '5× · $125' },
        { ic: '🚧', nm: 'Mini-rescate (atoramiento)', qy: '5× · $125' },
      ] : [
        { ic: '🚛', nm: 'Remolque por avería',   qy: '6× · $175' },
        { ic: '🚗', nm: 'Remolque por accidente', qy: '7× · $175' },
        { ic: '🔑', nm: 'Cerrajería',             qy: '4× · $125' },
        { ic: '⛽', nm: 'Envío de combustible',   qy: '4× · costo' },
        { ic: '🛞', nm: 'Cambio de llanta',       qy: '4× · $100' },
        { ic: '🔋', nm: 'Paso de corriente',      qy: '3× · $100' },
        { ic: '🚧', nm: 'Mini-rescate (atoramiento)', qy: '3× · $100' },
      ];

      return `
        <div class="section">
          <div class="num">🛠 SECCIÓN 2</div>
          <h2>Tu asistencia 24/7 en carretera</h2>
          <h2 class="sub">Cobertura G y M — ${ai.plan} (${ai.rango})</h2>
          <div class="svc-grid">
            ${svcs.map(function(s) { return '<div class="svc-row"><span class="ic">' + s.ic + '</span><div class="nm">' + s.nm + '</div><div class="qy">' + s.qy + '</div></div>'; }).join('')}
          </div>
        </div>`;
    }

    function renderIDD() {
      if (!data.coverages.includes('IDD')) return '';
      const ded = data.iddAmount;
      return `
        <div class="section">
          <div class="num">🛡 SECCIÓN 3</div>
          <h2>IDD — Tu protección al deducible</h2>
          <div class="idd-card">
            <div class="idd-row">
              <div class="idd-col from"><div class="lbl">SIN IDD</div><div class="val">${fmtMoney(ded)}</div></div>
              <div class="idd-arrow">→</div>
              <div class="idd-col to"><div class="lbl">CON IDD</div><div class="val">₡0</div></div>
            </div>
            <div class="idd-meta">Hasta 2 eventos al año cuando el daño supera tu deducible (${fmtMoney(ded)})</div>
          </div>
        </div>`;
    }

    function renderDeducible() {
      const d = dedTexto(data.deductible);
      return `
        <div class="section">
          <div class="num">⚙ SECCIÓN 4</div>
          <h2>Tu deducible (en coberturas D, F, H)</h2>
          <div class="ded-card">
            <div class="lbl">${escHtml(d.lbl)}</div>
            <div class="desc">${escHtml(d.desc)}</div>
          </div>
        </div>`;
    }

    function renderRepuestos() {
      if (!data.coverages.includes('REP')) return '';
      const r = repTexto(data.repPlan);
      return `
        <div class="section">
          <div class="num">🔧 SECCIÓN 5</div>
          <h2>Tu plan de sustitución de repuestos</h2>
          <div class="rep-card">
            <div class="lbl">Plan: ${escHtml(r.lbl)}</div>
            <div class="desc">${escHtml(r.desc)}</div>
          </div>
        </div>`;
    }

    function renderElectric() {
      if (!data.vehicle.electric) return '';
      const valor = data.vehicle.valor || 0;
      const batMax = Math.round(valor * 0.4);
      return `
        <div class="section">
          <div class="num">⚡ COBERTURA ESPECIAL ELÉCTRICOS</div>
          <h2>Tu cobertura de batería</h2>
          <div class="elec-card">
            <p class="lead">Las baterías son el componente <b>más caro</b> de un vehículo eléctrico. El INS tiene una <b>cobertura especial</b> para protegerte ante un siniestro que afecte la batería.</p>
            <div class="bat-box">
              <div class="bat-label">Cobertura especial de batería (40% del valor asegurado)</div>
              <div class="bat-amount">${fmtMoney(batMax)}</div>
            </div>
          </div>
        </div>`;
    }

    function renderFooter() {
      const waUrl = whatsappUrl(data.agent.whatsapp, data.client.name, firstName(data.agent.name));
      const waBtn = waUrl ? '<a class="btn btn-wa" href="' + waUrl + '" target="_blank">Hablemos por WhatsApp</a>' : '';
      const webBtn = data.agent.website ? '<a class="btn btn-web" href="https://' + escHtml(data.agent.website) + '" target="_blank">' + escHtml(data.agent.website) + '</a>' : '';
      return `
        <footer class="foot">
          <div class="preg">¿Preguntas? Estoy a la orden.</div>
          <div class="name">${escHtml(data.agent.name || 'Tu agente SDI')}</div>
          <div class="meta">Agente · Lic. SUGESE ${escHtml(data.agent.license)} · ${escHtml(data.agent.whatsapp || data.agent.email)}</div>
          <div class="ctas">${waBtn}${webBtn}</div>
          <div class="sdi-wrap">
            <svg viewBox="0 0 320 140" aria-label="Seguros Digitales SDI">
              <text x="10" y="78" font-family="Sora, Inter, sans-serif" font-weight="500" font-size="82" letter-spacing="-2.5" fill="#FFFFFF">SDI</text>
              <g transform="translate(185, 22)">
                <rect x="0" y="0" width="30" height="6" rx="1.5" fill="#FFFFFF"/>
                <rect x="0" y="10" width="30" height="6" rx="1.5" fill="#FFFFFF"/>
                <rect x="0" y="20" width="30" height="6" rx="1.5" fill="#FFFFFF"/>
                <rect x="0" y="30" width="30" height="6" rx="1.5" fill="#FFFFFF"/>
              </g>
              <text x="160" y="120" text-anchor="middle" font-family="Inter, sans-serif" font-weight="500" font-size="14" letter-spacing="3.5" fill="#FFFFFF">SEGUROS DIGITALES</text>
            </svg>
          </div>
        </footer>`;
    }
  </script>

</body>
</html>
```

- [ ] **Step 2: Smoke test sin params**

Manual: abrir `C:/tmp/COTIZADOR-AUTOS/detalle/index.html` en Chrome sin query params.
- Verificar que muestra el mensaje "Esta página debe abrirse desde el link enviado por tu agente."
- Sin errores en consola

- [ ] **Step 3: Smoke test con params completos**

Manual: abrir esta URL en Chrome (en una sola línea):
```
file:///C:/tmp/COTIZADOR-AUTOS/detalle/index.html?n=Juan%20Carlos%20Hern%C3%A1ndez&l=08-1318&w=segurosdelins.com&wa=50688221348&e=jhernandez%40segurosdelins.com&c=Mar%C3%ADa%20Rodr%C3%ADguez%20Sol%C3%ADs&v=Toyota%20Yaris%20Sedan&p=BRK454&y=2019&va=10000000&vd=2026-01-14&vh=2027-01-14&fp=t&pp=158423&cobs=A_C_N_D_F_B_H_GM_IDD&idd=400000&ded=nec
```

Esperado:
- Header con logo INS, "Hola, María"
- Banda con vigencia, forma de pago, prima
- 6 cards de coberturas + N en banner ámbar
- Sección asistencia con grid de 7 servicios + iconos
- Sección IDD con comparativa ₡400.000 → ₡0
- Sección deducible "N en C"
- Footer con botón verde "Hablemos por WhatsApp" + branding SDI
- Sin errores en consola

- [ ] **Step 4: Smoke test con eléctrico + REP**

Cambiar la URL anterior agregando `&vt=e&cobs=A_C_D_F_B_H_REP&rep=P`. Verificar que aparece sección eléctrica con batería al 40% del valor + sección 5 con plan "Garantía Plus".

- [ ] **Step 5: Verificar enlace WhatsApp**

En la página renderizada, click derecho sobre "Hablemos por WhatsApp" → Copiar URL. Verificar que es `https://web.whatsapp.com/send/?phone=50688221348&text=...` (NO `wa.me`).

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add detalle/index.html
git commit -m "feat(coberturas): pagina /detalle/ con todas las secciones condicionales"
```

---

## Task 6: Botón 🛡 en header del cotizador principal

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Agregar botón al header**

Read `index.html`. Localizar la línea con el botón 🧮:

```html
<a href="cancelacion/" class="header-btn" title="Calculadora de cancelación" aria-label="Calculadora de cancelación" style="text-decoration:none;font-size:16px;">🧮</a>
```

Agregar inmediatamente después:

```html
<a href="coberturas/" class="header-btn" title="Detalle de coberturas vigentes" aria-label="Detalle de coberturas vigentes" style="text-decoration:none;font-size:16px;background:#fbbf24;color:#0b1d3a;font-weight:900;">🛡</a>
```

(El estilo dorado con texto navy lo distingue del 🧮 y del ⚙ que son blancos sobre fondo oscuro.)

- [ ] **Step 2: Verificar en navegador**

Manual: abrir `C:/tmp/COTIZADOR-AUTOS/index.html`. Verificar:
- Aparece botón dorado 🛡 entre 🧮 y ⚙
- Click navega a `coberturas/index.html`

- [ ] **Step 3: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add index.html
git commit -m "feat(cotizador): boton 🛡 en header para detalle de coberturas"
```

---

## Task 7: Smoke test end-to-end + ajustes

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Servir el sitio localmente**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && python -m http.server 8000
```

Abrir en navegador: `http://localhost:8000/`

- [ ] **Step 2: Walkthrough completo**

Manual checklist:
1. Abrir cotizador `http://localhost:8000/` → verificar botón 🛡 dorado en header
2. Click ⚙ → verificar campo "WhatsApp" en modal → guardar con `8822-1348`
3. Click 🛡 → debe ir a `/coberturas/`
4. Llenar form completo (cliente, vehículo, todas las coberturas, deducible)
5. Click "Vista previa del correo" → debe abrir modal con HTML del correo + URL del detalle
6. Copiar la URL del detalle → abrir en otra pestaña → verificar página completa
7. Probar marcar IDD → seleccionar ₡500.000 → vista previa → verificar que la URL incluye `idd=500000`
8. Probar marcar REP → "Alternativo" → verificar param `rep=A` y página muestra "Plan: Alternativo"
9. Probar marcar eléctrico → vista previa → verificar URL incluye `vt=e` y página muestra sección batería
10. Probar editar monto de A a 500000000 → verificar URL incluye `a300=500000000` y página muestra ₡500M
11. En la página /detalle/, click "Hablemos por WhatsApp" → verificar URL `web.whatsapp.com/send/?phone=506...`

- [ ] **Step 3: Smoke test del envío real (opcional, requiere OAuth)**

Solo si Juan Carlos lo aprueba — enviar correo real a `jhernandez@segurosdelins.com` con datos de prueba. Verificar que llega el correo y el botón "VER DETALLE DE MIS COBERTURAS" abre la página correcta.

- [ ] **Step 4: Verificar consola limpia**

Manual: abrir DevTools en el cotizador, en /coberturas/ y en /detalle/. Verificar que no hay errores JavaScript ni warnings críticos.

- [ ] **Step 5: Verificar todos los tests Node**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node tests/test-coverage-url.js && node tests/test-coverage-email.js
```

Expected: todos pasan.

- [ ] **Step 6: node --check global**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && node --check js/coverage-url.js && node --check js/agent-profile.js && node --check js/email-template.js && node --check js/config.js
```

Expected: sin output (todo válido).

---

## Task 8: Push a main + monitor deploy Netlify

**Files:** ninguno

**REQUIERE APROBACIÓN EXPLÍCITA DE JUAN CARLOS antes de pushear.**

- [ ] **Step 1: Verificar git log de la rama**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git log --oneline main..feat/coberturas-vigentes
```

Expected: ver los 6-7 commits del trabajo, en orden cronológico claro.

- [ ] **Step 2: Tag de rollback antes del merge (best practice del proyecto)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git tag pre-coberturas-vigentes-14may
```

- [ ] **Step 3: Merge a main (sin fast-forward para preservar el historial)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git checkout main && git merge --no-ff feat/coberturas-vigentes -m "Merge: feat/coberturas-vigentes — detalle de coberturas vigentes"
```

- [ ] **Step 4: Push (deploy automático Netlify)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git push origin main && git push origin pre-coberturas-vigentes-14may
```

Expected: push exitoso. Netlify detecta el push y comienza deploy en 1-2 min.

- [ ] **Step 5: Verificar deploy en producción**

Esperar 2 minutos. Abrir `https://cotizador-segurosdigitalesins-sdi.netlify.app/` y verificar:
- Botón 🛡 aparece
- Click 🛡 → carga /coberturas/
- Form funciona
- Vista previa abre
- /detalle/ con params demo renderiza correctamente

- [ ] **Step 6: Actualizar SKILL_COTIZADOR_SDI.md (DESPUÉS del deploy verificado)**

Read `SKILL_COTIZADOR_SDI.md` y agregar sección al final:

```markdown
### Checkpoint 14 mayo 2026 — Detalle de coberturas vigentes
- **Nueva feature** `/coberturas/` (form interno) + `/detalle/?...` (vista pública del cliente)
- **Botón 🛡 dorado** en header del cotizador, junto al 🧮
- **Campo `whatsapp` nuevo** en perfil del agente (modal ⚙)
- **Helper** `js/coverage-url.js` con `buildDetalleUrl(formData)`
- **Email** corto vía `buildCoverageEmail()` en `js/email-template.js` — solo HTML + link, sin PDF adjunto
- **10 coberturas seleccionables:** A, C, N, D, F, B, H, G/M, IDD, REP
- **5 deducibles:** N en C, Fijo 400K, Fijo 500K, 20% mín 150K, 20% mín 500K
- **3 montos editables:** A (default 300M), C (100M), B (15M)
- **Tests Node:** `tests/test-coverage-url.js` + `tests/test-coverage-email.js`
- **Spec:** `docs/superpowers/specs/2026-05-14-detalle-coberturas-vigentes-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-14-detalle-coberturas-vigentes.md`
```

Commit y push:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add SKILL_COTIZADOR_SDI.md && git commit -m "docs(skill): checkpoint 14 may detalle de coberturas vigentes" && git push origin main
```

---

## Anti-checklist (cosas que NO se hicieron por diseño)

- ❌ NO se almacena ninguna póliza generada (cada envío es one-shot)
- ❌ NO se modifica el explicador existente
- ❌ NO se extrae info automáticamente de PDF de póliza (el agente digita)
- ❌ NO se agregó "Otra cobertura" texto libre — catálogo cerrado
- ❌ NO se atachó PDF al correo — solo HTML con link
- ❌ NO se hizo edición posterior — el agente reenvía si necesita corregir

## Si algo sale mal

- Rollback rápido: `git reset --hard pre-coberturas-vigentes-14may && git push origin main --force-with-lease` (avisar a JC primero)
- Si solo el form falla: revertir solo el archivo `coberturas/index.html` y mantener el resto
- Si Netlify no deploya: revisar Deploy log en `app.netlify.com`
