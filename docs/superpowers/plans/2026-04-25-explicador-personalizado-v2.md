# Explicador Personalizado v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `/explicacion/index.html` (React+Babel CDN) con una versión vanilla HTML+CSS+JS personalizada por cliente vía 11 URL params, conservando backward compatibility y agregando momento celebración + navegación sticky.

**Architecture:**
- Single HTML file en `explicacion/index.html` con CSS y JS inline (no build step, alineado con el resto del cotizador).
- 11 parámetros URL leídos al cargar y aplicados al DOM (greeting, vehículo, plan asistencia auto-seleccionado, fila repuestos destacada, 3 precios). Fallbacks sensatos si faltan.
- Cotizador construye el URL completo en `js/email-template.js` (función `_buildGuideUrl` ampliada). Test del builder con Node.

**Tech Stack:** HTML5 + CSS custom properties + JS vanilla · Google Fonts (Space Grotesk + Inter + JetBrains Mono) · Sin React, Babel, Tailwind, ni build step.

---

## Mapa de archivos

### Crear
- `explicacion/index-react-old.html` — backup del explicador React+Babel actual antes de reemplazar.
- `tests/test-explicador-url.js` — Node test del builder de URL (sigue patrón de `pdf-test/`).

### Reemplazar
- `explicacion/index.html` — completamente reescrito con la nueva versión vanilla.

### Modificar
- `js/email-template.js` — ampliar `_buildGuideUrl()` para aceptar todos los datos del cliente y construir URL con 11 params. Ampliar firma de `buildEmail()` para recibir `plate`, `year`, `valor`, `vehicleType`.
- `js/app.js` — pasar los 4 campos extra a `buildEmail()` en sus 2 llamadas (`updatePreview` línea 385, `handleSend` línea 426).
- `SKILL_COTIZADOR_SDI.md` — documentar el v2 del explicador.

### NO tocar
- `js/pdf-extract.js` — los datos ya se extraen, solo cambia cómo los usamos.
- `js/agent-profile.js` — los datos del agente ya se gestionan correctamente.
- `index.html`, `cancelacion/index.html` — fuera de alcance.

---

## Task 0: Preparar entorno

**Files:** ninguno

- [ ] **Step 1: Verificar que el clone está al día**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git fetch origin main && git status
```

Expected: `Your branch is up to date with 'origin/main'.` Si hay cambios sin commit, evaluar si guardarlos o descartarlos antes de seguir.

- [ ] **Step 2: Verificar que el prototipo final existe**

Run:
```bash
ls C:/tmp/COTIZADOR-AUTOS/.superpowers/brainstorm/212-1777150018/content/14-final-walkthrough.html
```

Expected: el archivo existe. Es la base visual para `explicacion/index.html`.

- [ ] **Step 3: Crear branch de trabajo (opcional, recomendado)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git checkout -b feat/explicador-v2
```

Expected: `Switched to a new branch 'feat/explicador-v2'`. Si Juan Carlos prefiere trabajar en main directamente, omitir este paso.

---

## Task 1: Test del URL builder (TDD)

**Files:**
- Create: `tests/test-explicador-url.js`

- [ ] **Step 1: Crear el directorio tests si no existe**

Run:
```bash
mkdir -p C:/tmp/COTIZADOR-AUTOS/tests && echo ok
```

Expected: `ok`.

- [ ] **Step 2: Escribir el test que falla**

Crear `tests/test-explicador-url.js`:

```javascript
/**
 * Test del builder de URL del explicador.
 * Pure function tests con Node — sigue el patrón de pdf-test/.
 *
 * Run: node tests/test-explicador-url.js
 */

const path = require('path');
const fs = require('fs');

// Carga email-template.js como texto, lo evalúa en este contexto
// para acceder a _buildGuideUrl. Definimos un CFG mínimo primero.
global.CFG = {
  GUIDE_URL: 'https://example.com/explicacion/',
  FROM_NAME: 'Juan Carlos Hernandez Vargas',
  LICENSE: '08-1318',
  WEBSITE: 'www.segurosdelins.com'
};

const src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'email-template.js'),
  'utf8'
);
eval(src);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}
function assertEq(actual, expected) {
  if (actual !== expected) throw new Error(`expected "${expected}", got "${actual}"`);
}
function assertContains(haystack, needle) {
  if (!haystack.includes(needle)) throw new Error(`expected to contain "${needle}", got "${haystack}"`);
}

// ===== Tests =====

test('agente solo (backward compat: 3 params)', () => {
  const url = _buildGuideUrl();
  assertContains(url, 'n=Juan%20Carlos%20Hernandez%20Vargas');
  assertContains(url, 'l=08-1318');
  assertContains(url, 'w=www.segurosdelins.com');
});

test('agente + cliente full (11 params)', () => {
  const url = _buildGuideUrl({
    clientName: 'Silvia Mariel',
    vehicle: 'Sedan 2019',
    plate: 'BRK454',
    year: '2019',
    vehicleType: 'g',
    valor: '10000000',
    sustReposCode: 'p',
    prices: { anual: '570891', semestral: '308283', trimestral: '158423' }
  });
  assertContains(url, 'c=Silvia%20Mariel');
  assertContains(url, 'v=Sedan%202019');
  assertContains(url, 'p=BRK454');
  assertContains(url, 'y=2019');
  assertContains(url, 'vt=g');
  assertContains(url, 'va=10000000');
  assertContains(url, 'sr=p');
  assertContains(url, 'pa=570891');
  assertContains(url, 'ps=308283');
  assertContains(url, 'pt=158423');
});

test('cliente con tildes encodea bien', () => {
  const url = _buildGuideUrl({ clientName: 'María José' });
  assertContains(url, 'c=Mar%C3%ADa%20Jos%C3%A9');
});

test('extras vacíos NO aparecen en el URL', () => {
  const url = _buildGuideUrl({ clientName: '', vehicle: null });
  if (url.includes('c=') && url.indexOf('c=') > url.indexOf('w=')) {
    throw new Error('clientName vacío no debería agregar c=');
  }
});

test('separador correcto si GUIDE_URL ya tiene ?', () => {
  global.CFG.GUIDE_URL = 'https://example.com/explicacion/?foo=bar';
  const url = _buildGuideUrl({ clientName: 'X' });
  assertContains(url, '?foo=bar&n=');
  assertContains(url, '&c=X');
  global.CFG.GUIDE_URL = 'https://example.com/explicacion/'; // restore
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Ejecutar el test — debería fallar**

Run:
```bash
node C:/tmp/COTIZADOR-AUTOS/tests/test-explicador-url.js
```

Expected: el primer test (`agente solo`) PASA porque la versión actual ya soporta n/l/w. Los demás FALLAN con mensajes como `expected to contain "c=Silvia%20Mariel"`. Esto confirma que `_buildGuideUrl` no acepta extras todavía.

- [ ] **Step 4: Commit del test (rojo, pero es el contrato)**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add tests/test-explicador-url.js && git commit -m "test(explicador): contract test for buildExplicadorURL"
```

---

## Task 2: Ampliar `_buildGuideUrl` para aceptar 11 params

**Files:**
- Modify: `js/email-template.js:323-333`

- [ ] **Step 1: Reemplazar `_buildGuideUrl` con la versión ampliada**

Editar `js/email-template.js`. Reemplazar el bloque actual de líneas 323-333 con:

```javascript
/**
 * Construye el URL del explicador con datos del agente Y del cliente.
 *
 * Hasta v1: solo 3 params (n, l, w) del agente. Backward compatible.
 * Desde v2: agrega 8 params del cliente y la cotización si se proveen.
 *
 * Formato completo:
 *   <CFG.GUIDE_URL>?n=...&l=...&w=...&c=...&v=...&p=...&y=...&vt=...&va=...&sr=...&pa=...&ps=...&pt=...
 *
 * El cliente abre ese URL desde su correo; no tiene localStorage con los
 * datos del agente. Los query params son la única forma de personalizar.
 *
 * @param {object} [extras] - datos opcionales del cliente y la cotización
 * @param {string} [extras.clientName]    - saludo del cliente (e.g. "Silvia Mariel")
 * @param {string} [extras.vehicle]       - descripción del vehículo (e.g. "Sedan 2019")
 * @param {string} [extras.plate]         - placa
 * @param {string|number} [extras.year]   - año del vehículo
 * @param {string} [extras.vehicleType]   - 'g' (gasolina) | 'e' (eléctrico)
 * @param {string|number} [extras.valor]  - valor asegurado en colones
 * @param {string} [extras.sustReposCode] - 'p' (Plus) | 'g' (Garantía) | '0' (nuevo) | 'n' (ninguno)
 * @param {object} [extras.prices]        - { anual, semestral, trimestral } strings ya extraídos del PDF
 * @returns {string} URL del explicador con query params
 */
function _buildGuideUrl(extras) {
  const base = CFG.GUIDE_URL;
  const params = [];

  // Agente (backward compat)
  if (CFG.FROM_NAME) params.push('n=' + encodeURIComponent(CFG.FROM_NAME));
  if (CFG.LICENSE)   params.push('l=' + encodeURIComponent(CFG.LICENSE));
  if (CFG.WEBSITE)   params.push('w=' + encodeURIComponent(CFG.WEBSITE));

  // Cliente + cotización (v2)
  const x = extras || {};
  const add = function (key, val) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      params.push(key + '=' + encodeURIComponent(String(val).trim()));
    }
  };
  add('c',  x.clientName);
  add('v',  x.vehicle);
  add('p',  x.plate);
  add('y',  x.year);
  add('vt', x.vehicleType);
  add('va', x.valor);
  add('sr', x.sustReposCode);
  if (x.prices) {
    add('pa', x.prices.anual);
    add('ps', x.prices.semestral);
    add('pt', x.prices.trimestral);
  }

  if (params.length === 0) return base;
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  return base + sep + params.join('&');
}
```

- [ ] **Step 2: Ejecutar el test — todos deberían pasar**

Run:
```bash
node C:/tmp/COTIZADOR-AUTOS/tests/test-explicador-url.js
```

Expected: `5 pass, 0 fail`.

- [ ] **Step 3: Commit verde**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/email-template.js && git commit -m "feat(explicador): _buildGuideUrl accepts client+cotizacion data (11 params)"
```

---

## Task 3: Helper `_sustReposToCode` para mapear PDF → código de letra

**Files:**
- Modify: `js/email-template.js` (agregar helper junto a `_sustitucionText`)

- [ ] **Step 1: Agregar test al archivo de tests**

Editar `tests/test-explicador-url.js`. Agregar al final, antes del `console.log(...)`:

```javascript
test('sustReposToCode mapea Plus correctamente', () => {
  assertEq(_sustReposToCode('Extension de garantia Plus'), 'p');
  assertEq(_sustReposToCode('extensión de Garantía PLUS'), 'p');
});
test('sustReposToCode mapea Garantía simple', () => {
  assertEq(_sustReposToCode('Extension de garantia'), 'g');
});
test('sustReposToCode mapea Repuesto Original sin extensión', () => {
  assertEq(_sustReposToCode('repuesto original'), '0');
});
test('sustReposToCode mapea Repuesto Alternativo', () => {
  assertEq(_sustReposToCode('repuesto alternativo'), 'n');
});
test('sustReposToCode default a "n" si vacío', () => {
  assertEq(_sustReposToCode(''), 'n');
  assertEq(_sustReposToCode(null), 'n');
});
```

- [ ] **Step 2: Ejecutar tests — los nuevos fallan**

Run:
```bash
node C:/tmp/COTIZADOR-AUTOS/tests/test-explicador-url.js
```

Expected: 5 nuevos tests fallan con `_sustReposToCode is not defined`.

- [ ] **Step 3: Implementar el helper**

Editar `js/email-template.js`. Después de la función `_sustitucionText` (línea ~293), agregar:

```javascript
/**
 * Mapea el texto de sustitución de repuestos del PDF al código corto
 * que usa el explicador como URL param `sr`.
 *
 *   "Extension de garantia Plus" → 'p'
 *   "Extension de garantia"      → 'g'
 *   "repuesto original"          → '0'  (carro nuevo)
 *   "repuesto alternativo"       → 'n'  (sin extensión, fila genérica)
 *   vacío / desconocido          → 'n'  (default seguro)
 *
 * @param {string} label - texto del PDF
 * @returns {string} código de una letra: 'p' | 'g' | '0' | 'n'
 */
function _sustReposToCode(label) {
  const norm = (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (norm.includes('garantia plus'))   return 'p';
  if (norm.includes('garantia'))        return 'g';
  if (norm.includes('repuesto original')) return '0';
  if (norm.includes('repuesto alternativo')) return 'n';
  return 'n';
}
```

- [ ] **Step 4: Ejecutar tests — todos pasan**

Run:
```bash
node C:/tmp/COTIZADOR-AUTOS/tests/test-explicador-url.js
```

Expected: `10 pass, 0 fail`.

- [ ] **Step 5: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/email-template.js tests/test-explicador-url.js && git commit -m "feat(explicador): _sustReposToCode helper for sr param"
```

---

## Task 4: Ampliar `buildEmail()` para recibir y pasar datos extras

**Files:**
- Modify: `js/email-template.js:31-48` (signature de buildEmail)
- Modify: `js/email-template.js:114` (call site de `_buildGuideUrl`)

- [ ] **Step 1: Ampliar la firma JSDoc y el destructuring**

Editar `js/email-template.js`. Reemplazar las líneas 31-48 (JSDoc + apertura de buildEmail + extracción de variables) con:

```javascript
/**
 * Construye el HTML completo del correo de cotizacion.
 * @param {object} params - parametros del correo
 * @param {string} params.nombre         - nombre del cliente para el saludo (también va a explicador como `c`)
 * @param {string} params.vehiculo       - descripcion del vehiculo (también va a explicador como `v`)
 * @param {object} params.prices         - { trimestral, semestral, anual } como strings ya formateados
 * @param {string} params.sustRepos      - texto exacto de "Sustitucion de repuestos" del PDF
 * @param {string} params.interes        - clave del dropdown (propietario, cero-km, traspaso, compra) o ''
 * @param {string} params.notaAdicional  - texto opcional del agente (linebreaks se preservan)
 * @param {string} [params.plate]        - placa del vehículo (para explicador)
 * @param {string|number} [params.year]  - año del vehículo (para explicador)
 * @param {string|number} [params.valor] - valor asegurado (para explicador)
 * @param {string} [params.vehicleType]  - tipo crudo del PDF; se mapea a 'g' (gasolina) por default
 * @returns {string} HTML completo del cuerpo del correo
 */
function buildEmail(params) {
  const p = params || {};
  const nombre   = (p.nombre   || '').trim();
  const vehiculo = (p.vehiculo || '').trim();
  const prices   = p.prices    || {};
  const sustText = _sustitucionText(p.sustRepos || '');
  const interesText = _interestText(p.interes || '');
  const notaTrim = (p.notaAdicional || '').trim();
```

- [ ] **Step 2: Pasar los datos extras a `_buildGuideUrl` en el CTA**

Editar `js/email-template.js`. Reemplazar la línea 114 (única referencia a `_buildGuideUrl()`) con:

```javascript
          <a href="${_buildGuideUrl({ clientName: nombre, vehicle: vehiculo, plate: p.plate, year: p.year, vehicleType: _detectVehicleType(p.vehicleType), valor: p.valor, sustReposCode: _sustReposToCode(p.sustRepos), prices: prices })}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:0.5px;">
```

- [ ] **Step 3: Agregar helper `_detectVehicleType`**

En `js/email-template.js`, después de `_sustReposToCode`, agregar:

```javascript
/**
 * Detecta si el vehículo es eléctrico o gasolina/diésel a partir del
 * texto del campo `vehicleType` del PDF. Por ahora el PDF estándar no
 * distingue eléctricos explícitamente — devolvemos 'g' por default.
 * Si en el futuro se agrega un campo o checkbox al cotizador, este
 * helper centraliza la lógica.
 *
 * @param {string} rawType - texto del campo vehicleType del PDF
 * @returns {string} 'g' (gasolina/diésel) | 'e' (eléctrico)
 */
function _detectVehicleType(rawType) {
  const norm = (rawType || '').toLowerCase();
  if (norm.includes('electric') || norm.includes('eléctric') || norm.includes('ev')) return 'e';
  return 'g';
}
```

- [ ] **Step 4: Probar manualmente que `buildEmail` no se rompe**

Run:
```bash
node -e "global.CFG={GUIDE_URL:'https://x/',FROM_NAME:'JC',LICENSE:'08-1318',WEBSITE:'w.com',LOGO_URL:'',PHONE:'',FROM_EMAIL:''}; require('fs').readFileSync; eval(require('fs').readFileSync('C:/tmp/COTIZADOR-AUTOS/js/email-template.js','utf8')); const html = buildEmail({nombre:'Silvia',vehiculo:'Sedan 2019',plate:'BRK454',year:2019,valor:10000000,vehicleType:'Sedan/Coupe',prices:{anual:'570,891',semestral:'308,283',trimestral:'158,423'},sustRepos:'Extension de garantia Plus'}); const m=html.match(/href=\"([^\"]+\/explicacion\/[^\"]*)\"/); console.log(m ? m[1] : 'NO MATCH');"
```

Expected: imprime un URL completo con todos los params:
`https://x/?n=JC&l=08-1318&w=w.com&c=Silvia&v=Sedan%202019&p=BRK454&y=2019&vt=g&va=10000000&sr=p&pa=570%2C891&ps=308%2C283&pt=158%2C423`

- [ ] **Step 5: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/email-template.js && git commit -m "feat(explicador): buildEmail passes client+cotizacion data to guide URL"
```

---

## Task 5: Pasar datos extras desde `app.js` a `buildEmail`

**Files:**
- Modify: `js/app.js:385-392` y `js/app.js:426-433`

- [ ] **Step 1: Actualizar la llamada en `updatePreview()`**

Editar `js/app.js`. Reemplazar las líneas 385-392 (el bloque de `const html = buildEmail({...})` dentro de `updatePreview`) con:

```javascript
  const html = buildEmail({
    nombre:        document.getElementById('m-name').value,
    vehiculo:      document.getElementById('m-vehicle').value,
    prices:        S.data.prices,
    sustRepos:     S.data.sustRepos,
    interes:       S.formData ? S.formData.interes : '',
    notaAdicional: document.getElementById('m-note').value,
    plate:         S.data.plate,
    year:          S.data.year,
    valor:         S.data.valor,
    vehicleType:   S.data.vehicleType
  });
```

- [ ] **Step 2: Actualizar la llamada en `handleSend()`**

Editar `js/app.js`. Buscar la segunda llamada a `buildEmail({...})` (cerca de línea 426 dentro de `handleSend`) y aplicar el mismo cambio: agregar `plate, year, valor, vehicleType` después de `notaAdicional`.

```javascript
    const html = buildEmail({
      nombre:        document.getElementById('m-name').value,
      vehiculo:      document.getElementById('m-vehicle').value,
      prices:        S.data.prices,
      sustRepos:     S.data.sustRepos,
      interes:       S.formData ? S.formData.interes : '',
      notaAdicional: document.getElementById('m-note').value,
      plate:         S.data.plate,
      year:          S.data.year,
      valor:         S.data.valor,
      vehicleType:   S.data.vehicleType
    });
```

- [ ] **Step 3: Verificar sintaxis**

Run:
```bash
node --check C:/tmp/COTIZADOR-AUTOS/js/app.js && echo "syntax OK"
```

Expected: `syntax OK`. Si falla, revisar coma faltante o llave mal cerrada.

- [ ] **Step 4: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add js/app.js && git commit -m "feat(explicador): pass plate/year/valor/vehicleType from app.js to buildEmail"
```

---

## Task 6: Backup del explicador React + crear scaffold del v2

**Files:**
- Create: `explicacion/index-react-old.html` (backup)
- Replace: `explicacion/index.html`

- [ ] **Step 1: Backup del actual**

Run:
```bash
cp C:/tmp/COTIZADOR-AUTOS/explicacion/index.html C:/tmp/COTIZADOR-AUTOS/explicacion/index-react-old.html && echo "backup ok"
```

Expected: `backup ok`. Este archivo queda en disco como referencia, pero NO se servirá (Netlify sirve `index.html` por default).

- [ ] **Step 2: Copiar el prototipo final como base del nuevo `explicacion/index.html`**

Run:
```bash
cp C:/tmp/COTIZADOR-AUTOS/.superpowers/brainstorm/212-1777150018/content/14-final-walkthrough.html C:/tmp/COTIZADOR-AUTOS/explicacion/index.html && wc -l C:/tmp/COTIZADOR-AUTOS/explicacion/index.html
```

Expected: ~1670 líneas. El archivo ahora es una copia del prototipo aprobado.

- [ ] **Step 3: Cambiar el `<title>` para producción**

Editar `explicacion/index.html`. Reemplazar:
```html
<title>Explicador SDI — Recorrido Final</title>
```
por:
```html
<title>Guía de tu Cotización — Seguros Digitales SDI</title>
```

- [ ] **Step 4: Agregar favicon (consistente con el cotizador)**

Editar `explicacion/index.html`. Después del `<title>` agregar:

```html
<link rel="icon" type="image/svg+xml" href="../img/favicon.svg" />
```

- [ ] **Step 5: Verificar HTML válido**

Run:
```bash
grep -c "<!DOCTYPE html>" C:/tmp/COTIZADOR-AUTOS/explicacion/index.html
```

Expected: `1`.

- [ ] **Step 6: Commit del scaffold**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add explicacion/index.html explicacion/index-react-old.html && git commit -m "feat(explicador): scaffold v2 vanilla HTML+CSS+JS (replaces React+Babel)"
```

---

## Task 7: Wire URL params al DOM (personalización)

**Files:**
- Modify: `explicacion/index.html` (script tag al final del body)

- [ ] **Step 1: Reemplazar el `<script>` final con la versión que lee URL params**

Editar `explicacion/index.html`. Buscar el bloque `<script>...</script>` justo antes de `</body>` (contiene la lógica de sticky nav, IO, celebration). Reemplazar TODO el contenido del `<script>` con:

```javascript
// ============ URL PARAMS ============
const _params = new URLSearchParams(location.search);
const data = {
  // Agente
  n:  _params.get('n')  || 'Juan Carlos Hernandez Vargas',
  l:  _params.get('l')  || '08-1318',
  w:  _params.get('w')  || 'www.segurosdelins.com',
  // Cliente
  c:  _params.get('c')  || '',
  // Vehículo
  v:  _params.get('v')  || '',
  p:  _params.get('p')  || '',
  y:  parseInt(_params.get('y'), 10) || null,
  vt: _params.get('vt') || 'g',
  // Cotización
  va: parseInt(_params.get('va'), 10) || null,
  sr: _params.get('sr') || null,
  pa: _params.get('pa') || null,
  ps: _params.get('ps') || null,
  pt: _params.get('pt') || null
};

const fmt = (n) => '₡' + Number(n).toLocaleString('es-CR');
const initials = (name) => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'JC';

// ============ APLICAR PERSONALIZACIÓN AL DOM ============
function applyPersonalization() {
  // Agente: header info
  const agentInfo = document.querySelector('.agent-info');
  if (agentInfo) agentInfo.innerHTML = `Agente: <b>${data.n}</b><br/>Lic. SUGESE ${data.l}`;
  // Avatar JC del header → iniciales
  document.querySelectorAll('.avatar, .celeb-avatar').forEach(el => el.textContent = initials(data.n));
  // Chip del agente
  const chipName = document.querySelector('.agent-chip-name');
  if (chipName) chipName.textContent = data.n;
  // Cinta dorada
  const ribbon = document.querySelector('.gold-ribbon b');
  if (ribbon) ribbon.textContent = data.n;
  // Footer
  document.querySelectorAll('.footer .copyright').forEach(el => {
    el.innerHTML = `© ${new Date().getFullYear()} Propiedad Intelectual de ${data.n}. Todos los derechos reservados. Esta plataforma es una herramienta de uso exclusivo para los clientes vinculados a la Licencia Sugese ${data.l}. Queda prohibida su reproducción o uso por terceros sin autorización expresa del titular.`;
  });
  const webLink = document.querySelector('.footer a[href*="seguros"]');
  if (webLink) {
    webLink.href = 'https://' + data.w;
    webLink.textContent = data.w;
  }

  // Cliente: greeting
  const greetName = document.querySelector('.bubble .greet .name');
  if (greetName) greetName.textContent = data.c || 'Cliente';
  // Bubble — vehículo+placa
  const bubble = document.querySelector('.bubble');
  if (bubble && (data.v || data.p)) {
    const veh = data.v || 'tu vehículo';
    const plt = data.p ? `, placa ${data.p}` : '';
    // Reemplazar el texto de personalización
    bubble.innerHTML = bubble.innerHTML.replace(/Sedan 2019, placa BRK454/g, `${veh}${plt}`);
  }
  // Cierre — saludo personalizado
  const closingMsg = document.querySelector('.closing .msg');
  if (closingMsg && data.c) {
    closingMsg.innerHTML = `${data.c}, espero que esta guía te haya ayudado a entender tu cotización con claridad. Si tenés cualquier duda, hablemos.`;
  }
  const closingSig = document.querySelector('.closing .signature');
  if (closingSig) {
    closingSig.innerHTML = `— ${data.n}<span class="lic">Tu agente · Lic. SUGESE ${data.l}</span>`;
  }
  // Celebración — título
  const celebTitle = document.querySelector('.celeb-title');
  if (celebTitle) {
    celebTitle.innerHTML = `¡Excelente decisión,<br/><span class="name">${data.c || 'Cliente'}</span>! 🎉`;
  }
  const celebSub = document.querySelector('.celeb-sub');
  if (celebSub && data.v) {
    celebSub.innerHTML = `Acabas de dar el primer paso para <b>proteger tu ${data.v}</b> con una de las mejores coberturas del mercado.`;
  }

  // Sección 1 — montos D, F, H usan valor asegurado
  if (data.va) {
    const valFmt = fmt(data.va);
    document.querySelectorAll('.bento-tile.green .amount, .bento-tile.purple .amount').forEach(el => {
      el.textContent = valFmt;
    });
    // Subtitle de sección 1
    const s1Sub = document.querySelector('#s1 .section-sub');
    if (s1Sub) s1Sub.innerHTML = `Toca cada tarjeta para ver el detalle. Los montos se calculan sobre tu valor asegurado de <b>${valFmt}</b>.`;
  }

  // Sección 2 — auto-seleccionar plan según edad
  if (data.y) {
    const edad = new Date().getFullYear() - data.y;
    const isPlus = edad <= 6;
    const tabs = document.querySelectorAll('.plan-toggle .tab');
    if (tabs.length === 2) {
      tabs[0].classList.toggle('active', isPlus);
      tabs[1].classList.toggle('active', !isPlus);
    }
    // Personalizar el copy del banner
    const bannerSmall = document.querySelector('.tip-banner .small');
    if (bannerSmall) {
      bannerSmall.innerHTML = `El alcance del plan se ajusta a la antigüedad de tu vehículo. Para tu ${data.v || 'vehículo'} (${edad} años) te toca el <b>Plan ${isPlus ? 'Plus' : 'Básico'}</b>.`;
    }
  }

  // Sección 4 — auto-resaltar fila según sr
  if (data.sr) {
    const map = { '0': 0, 'g': 1, 'p': 2, 'n': 3 };
    const rows = document.querySelectorAll('#s4 .qrow');
    if (rows.length === 4 && map[data.sr] !== undefined) {
      // Quitar match de la fila default (Plus está hardcoded como match en el HTML)
      rows.forEach(r => r.classList.remove('match'));
      rows[map[data.sr]].classList.add('match');
    }
  }
  // Header sección 4: vehículo+placa
  const s4perso = document.querySelector('.s4-header .perso');
  if (s4perso && (data.v || data.p)) {
    const veh = data.v || 'tu vehículo';
    const plt = data.p ? `, placa ${data.p}` : '';
    s4perso.innerHTML = `Para tu <b>${veh}${plt}</b>, esto es lo que el INS te garantiza.`;
  }

  // Sección 5 — 3 precios reales
  const priceCards = document.querySelectorAll('.pricing-grid .price-card .price');
  if (priceCards.length === 3) {
    if (data.pt) priceCards[0].textContent = '₡' + Number(data.pt).toLocaleString('es-CR');
    if (data.ps) priceCards[1].textContent = '₡' + Number(data.ps).toLocaleString('es-CR');
    if (data.pa) priceCards[2].textContent = '₡' + Number(data.pa).toLocaleString('es-CR');
    // Si todos faltan, mostrar mensaje
    if (!data.pt && !data.ps && !data.pa) {
      const grid = document.querySelector('.pricing-grid');
      if (grid) grid.innerHTML = '<p style="text-align:center;color:#64748b;font-size:14px;padding:20px;">Consulta a tu agente las opciones de pago disponibles.</p>';
    }
  }
}

// Aplicar al cargar
applyPersonalization();

// ============ STICKY NAV + INTERSECTION OBSERVER ============
const sections = document.querySelectorAll('.section');
const stickyDots = document.querySelectorAll('.sticky-dot');
const stickyNav = document.getElementById('stickyNav');
const floatNav = document.getElementById('floatNav');
const floatCtr = document.getElementById('floatCtr');
const floatPrev = document.getElementById('floatPrev');
const floatNext = document.getElementById('floatNext');

let currentSection = 0;
const sectionIds = ['s1', 's2', 's3', 's4', 's5'];

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 200;
  stickyNav.classList.toggle('visible', scrolled);
  floatNav.classList.toggle('visible', scrolled);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      const idx = sectionIds.indexOf(entry.target.id);
      if (idx !== -1) {
        currentSection = idx;
        updateActiveStates();
      }
    }
  });
}, { threshold: 0.3 });
sections.forEach(s => observer.observe(s));

function updateActiveStates() {
  stickyDots.forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i < currentSection) dot.classList.add('done');
    if (i === currentSection) dot.classList.add('active');
  });
  floatCtr.textContent = currentSection + 1;
  floatPrev.disabled = currentSection === 0;
  floatNext.disabled = currentSection === sectionIds.length - 1;
}

stickyDots.forEach(dot => {
  dot.addEventListener('click', () => {
    document.getElementById(dot.dataset.target).scrollIntoView({ behavior: 'smooth' });
  });
});

document.querySelectorAll('.step-btn[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.target).scrollIntoView({ behavior: 'smooth' });
  });
});

floatPrev.addEventListener('click', () => {
  if (currentSection > 0) document.getElementById(sectionIds[currentSection - 1]).scrollIntoView({ behavior: 'smooth' });
});
floatNext.addEventListener('click', () => {
  if (currentSection < sectionIds.length - 1) document.getElementById(sectionIds[currentSection + 1]).scrollIntoView({ behavior: 'smooth' });
});

// ============ CELEBRATION OVERLAY ============
const AGENDA_URL = 'https://forms.gle/tqSaZBDcZfNgNktC7';

function openCelebration() {
  document.getElementById('celebBackdrop').classList.add('active');
  // Abrir Google Form en nueva pestaña tras 2.5s
  setTimeout(() => window.open(AGENDA_URL, '_blank', 'noopener'), 2500);
}
function closeCelebration() {
  document.getElementById('celebBackdrop').classList.remove('active');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCelebration();
});
```

- [ ] **Step 2: Eliminar el comentario de prototipo del openCelebration anterior**

El bloque `// En producción: abrir Google Form...` debería ya no estar (lo reemplazamos arriba con el `setTimeout` activo).

- [ ] **Step 3: Verificar sintaxis JS del HTML**

Run:
```bash
grep -c "function applyPersonalization" C:/tmp/COTIZADOR-AUTOS/explicacion/index.html && grep -c "AGENDA_URL" C:/tmp/COTIZADOR-AUTOS/explicacion/index.html
```

Expected: `1` y `2` (constante + uso).

- [ ] **Step 4: Commit**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add explicacion/index.html && git commit -m "feat(explicador): URL params drive personalization (greeting/vehicle/plan/sr/prices)"
```

---

## Task 8: Smoke test local con URL params

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Servir el archivo localmente**

Run en background:
```bash
cd C:/tmp/COTIZADOR-AUTOS && python3 -m http.server 8765
```

(O `python -m http.server 8765` si solo está python disponible.)

- [ ] **Step 2: Abrir en el navegador con datos de Silvia**

Abrir manualmente:
```
http://localhost:8765/explicacion/?n=Juan%20Carlos%20Hernandez%20Vargas&l=08-1318&w=www.segurosdelins.com&c=Silvia%20Mariel&v=Sedan%202019&p=BRK454&y=2019&vt=g&va=10000000&sr=p&pa=570891&ps=308283&pt=158423
```

Verificar:
- ✅ Header dice "Agente: Juan Carlos Hernández" + "Lic. SUGESE 08-1318"
- ✅ Cinta dorada dice "Una herramienta diseñada por **Juan Carlos Hernandez Vargas**..."
- ✅ Greeting dice "¡Hola, **Silvia Mariel**!"
- ✅ Bubble menciona "Sedan 2019, placa BRK454"
- ✅ Sección 1: tarjetas D, F, H muestran ₡10,000,000
- ✅ Sección 2: el toggle muestra "Plan Básico" activo (porque 2019 → 7 años → Básico)
- ✅ Sección 4 header dice "Para tu Sedan 2019, placa BRK454..."
- ✅ Sección 4: la fila "Garantía Plus" tiene borde dorado
- ✅ Sección 5: precios son ₡158,423 / ₡308,283 / ₡570,891 (no los del prototipo)
- ✅ Cierre dice "Silvia Mariel, espero que esta guía..."
- ✅ Click en "Agende su cita" → aparece celebración con "¡Excelente decisión, Silvia Mariel! 🎉" y abre forms.gle en nueva pestaña a los 2.5s

- [ ] **Step 3: Probar fallback (sin params)**

Abrir manualmente:
```
http://localhost:8765/explicacion/
```

Verificar:
- ✅ La página carga sin errores en consola
- ✅ Greeting dice "¡Hola, Cliente!" (default)
- ✅ Sección 5 muestra los precios del prototipo (mantiene los hardcoded del HTML)
- ✅ Sección 2 muestra el plan default (Básico, según el HTML)
- ✅ No hay datos rotos visualmente

- [ ] **Step 4: Detener el servidor local**

Si el server está corriendo, detenerlo (Ctrl+C en el terminal donde se lanzó). O dejarlo correr para los siguientes tests.

- [ ] **Step 5: Si todo OK, commit (no hay cambios — solo verificación)**

No hay cambios para commit. Anotar en notas: "smoke test local OK".

---

## Task 9: Mobile responsive verification

**Files:** posiblemente `explicacion/index.html` (si se descubren issues)

- [ ] **Step 1: Abrir en DevTools modo mobile**

Con el server corriendo en `localhost:8765`, abrir el URL de Silvia en el navegador. Abrir DevTools (F12) → Toggle Device Toolbar (Ctrl+Shift+M) → seleccionar "iPhone SE" (375×667) o similar.

- [ ] **Step 2: Verificar layout en mobile**

Verificar:
- ✅ Header navy: `INS · Guía de tu Cotización` en la parte superior, info del agente abajo (o wrap correcto)
- ✅ Cinta dorada: legible, no se rompe
- ✅ Sticky nav: aparece después del hero, muestra solo números (sin labels), centrado
- ✅ Hero bubble: cabe en pantalla, no overflow horizontal
- ✅ Bento sección 1: 1 columna en mobile (no 2)
- ✅ Sección 2: lista de servicios en 1 columna, legible
- ✅ Sección 3 (IDD): el comparativo sin/con IDD se ve bien
- ✅ Sección 4 quality table: filas legibles, badge "★ Tuyo" no se rompe
- ✅ Eléctricos depr-grid: 2 columnas (no 4)
- ✅ Sección 5 pricing: cards en 1 columna, anual destacada
- ✅ CTA "Agende su cita": ancho razonable, tap-target ≥44px
- ✅ Step buttons al final de cada sección: 50/50, no overflow
- ✅ Float nav (←/→): visible en esquina inferior derecha, no estorba

- [ ] **Step 3: Verificar interacciones**

- ✅ Click en sticky dot → scroll suave al section, NO queda tapado por el sticky nav (el `scroll-margin-top: 100px` debe funcionar)
- ✅ Click en step-btn "Siguiente" → scroll suave
- ✅ Click en CTA → modal celebración cubre toda la pantalla mobile, × cierra
- ✅ Test ESC para cerrar modal (en desktop, no aplica mobile)

- [ ] **Step 4: Si hay issues, fix inline**

Anotar los issues encontrados. Cualquier fix es un commit independiente con mensaje descriptivo.

- [ ] **Step 5: Si todo OK, commit (no hay cambios)**

Anotar: "mobile smoke test OK".

---

## Task 10: End-to-end test desde el cotizador

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Abrir el cotizador principal en local**

Si el server `localhost:8765` sigue corriendo:
```
http://localhost:8765/
```

- [ ] **Step 2: Cargar el PDF de muestra**

Subir el PDF de prueba: `C:/Users/segur/Downloads/INFORME-ASINS-170-92637.pdf` (Silvia Mariel, BRK454).

- [ ] **Step 3: Avanzar al paso 3 (Redactar correo)**

En el paso 2 revisar los datos. En el paso 3 ver la vista previa del correo.

- [ ] **Step 4: Inspeccionar el link del CTA "VER EXPLICACION DE MI COTIZACION"**

En el iframe de preview, click derecho en el botón → Inspeccionar. Copiar el `href`. Debe ser un URL completo con los 11 params:
```
https://cotizador-segurosdigitalesins-sdi.netlify.app/explicacion/?n=...&l=...&w=...&c=Silvia%20Mariel&v=...&p=BRK454&y=2019&vt=g&va=10000000&sr=p&pa=...&ps=...&pt=...
```

- [ ] **Step 5: Reemplazar el dominio Netlify por localhost y abrir**

Cambiar `https://cotizador-segurosdigitalesins-sdi.netlify.app` por `http://localhost:8765` y abrir. Verificar que TODA la personalización es correcta (igual que Task 8 paso 2).

- [ ] **Step 6: Si todo OK, anotar end-to-end OK**

No hay commit. Solo verificación.

---

## Task 11: Actualizar el SKILL doc + commits finales

**Files:**
- Modify: `SKILL_COTIZADOR_SDI.md`

- [ ] **Step 1: Agregar checkpoint del v2 al SKILL**

Editar `SKILL_COTIZADOR_SDI.md`. Buscar la sección de checkpoints (al final) y agregar uno nuevo:

```markdown
### Checkpoint 25 abril 2026 — Explicador v2 personalizado

**Reescrito completo:** `/explicacion/index.html` migrado de React+Babel CDN a vanilla HTML+CSS+JS single-file. Carga más rápida (sin compilación en cliente), alineado con el resto del cotizador.

**Personalización por cliente vía 11 URL params** (n, l, w, c, v, p, y, vt, va, sr, pa, ps, pt):
- Greeting: `¡Hola, {nombre}!` con nombre real del cliente
- Vehículo + placa en hero y header de sección 4
- Plan asistencia auto-seleccionado por edad del vehículo (Plus 0-6 años / Básico 7-15)
- Fila de calidad de repuestos auto-resaltada según `sr` (Plus/Garantía/Nuevo/Sin extensión)
- 3 opciones de pago al final con primas reales del PDF (Trimestral/Semestral/Anual con -10%)

**Backward compatible:** si el URL llega sin params, sigue funcionando con defaults (greeting genérico, prima placeholder).

**Cambios estructurales:**
- Asistencia movida a Sección 2 (era 4) — "también es una cobertura"
- Eliminada la regla del 80% (gasolina y eléctricos)
- Eléctricos siempre visible como sub-sección educativa de la Sección 4
- Removidos emojis como íconos estructurales (excepto algunos puntuales aprobados)

**Nuevo: momento celebración:** al hacer click en "Agende su cita de Aseguramiento", aparece overlay con check verde + confetti + mensaje personalizado "¡Excelente decisión, {nombre}!", y abre el Google Form en nueva pestaña tras 2.5s.

**Nueva paleta verde:** emerald-500/400 (`#10b981`/`#34d399`) reemplaza el teal-600 (`#0d9488`) en CTAs y badges. Más vivo y alegre.

**Navegación nueva:**
- Sticky bar superior con dots clickeables y labels (mobile: solo números)
- Floating ←/→ en esquina inferior derecha
- Step buttons "← Anterior · Siguiente →" al final de cada sección
- Scroll suave + IntersectionObserver para fade-in de secciones
- Respeta `prefers-reduced-motion`

**Modificaciones al cotizador (afuera de /explicacion/):**
- `js/email-template.js`: `_buildGuideUrl()` ampliado para aceptar 8 params nuevos del cliente. Helpers `_sustReposToCode()` y `_detectVehicleType()` agregados.
- `js/app.js`: las 2 llamadas a `buildEmail()` (preview + send) pasan ahora `plate, year, valor, vehicleType`.

**Tests:** `tests/test-explicador-url.js` (Node) — 10 casos cubren el URL builder y el sustReposToCode mapper.

**Backup del React+Babel anterior:** `explicacion/index-react-old.html`.

**Commits del checkpoint:** ver últimos commits en `git log` (rango con `feat(explicador):` y `test(explicador):`).
```

- [ ] **Step 2: Commit del SKILL**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git add SKILL_COTIZADOR_SDI.md && git commit -m "docs(skill): checkpoint 25 abr - explicador v2 personalizado"
```

- [ ] **Step 3: (Opcional) sincronizar el SKILL en Downloads**

Si Juan Carlos mantiene la copia maestra del SKILL en `C:/Users/segur/Downloads/SKILL_COTIZADOR_SDI.md`, copiarla:

```bash
cp C:/tmp/COTIZADOR-AUTOS/SKILL_COTIZADOR_SDI.md C:/Users/segur/Downloads/SKILL_COTIZADOR_SDI.md && echo "synced"
```

Expected: `synced`. Esto NO se commitea (Downloads no es git).

---

## Task 12: Push a producción + smoke test

**Files:** ninguno

- [ ] **Step 1: Si trabajamos en branch, mergear a main**

Si seguimos las instrucciones del Task 0 step 3 y creamos `feat/explicador-v2`:

```bash
cd C:/tmp/COTIZADOR-AUTOS && git checkout main && git merge feat/explicador-v2 --no-ff -m "Merge: explicador v2 personalizado"
```

Si trabajamos directamente en main, omitir.

- [ ] **Step 2: Verificar el log de commits**

Run:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git log --oneline -10
```

Expected: ver los commits recientes con prefijos `feat(explicador):`, `test(explicador):`, `docs(skill):`.

- [ ] **Step 3: Confirmar con Juan Carlos antes de pushear**

⚠ El push hace deploy automático en Netlify (1-2 min). Confirmar con Juan Carlos que está OK proceder con el deploy.

- [ ] **Step 4: Push a origin/main**

```bash
cd C:/tmp/COTIZADOR-AUTOS && git push origin main
```

Expected: `To github.com:jhernandez-vibecode/COTIZADOR-AUTOS.git ...`. Esperar 1-2 min para que Netlify deployé.

- [ ] **Step 5: Smoke test en producción**

Esperar 2 minutos. Abrir en navegador:
```
https://cotizador-segurosdigitalesins-sdi.netlify.app/explicacion/?n=Juan%20Carlos%20Hernandez%20Vargas&l=08-1318&w=www.segurosdelins.com&c=Silvia%20Mariel&v=Sedan%202019&p=BRK454&y=2019&vt=g&va=10000000&sr=p&pa=570891&ps=308283&pt=158423
```

Verificar todos los puntos del Task 8 step 2 contra el deploy real.

- [ ] **Step 6: Smoke test del flujo completo desde el cotizador en producción**

Abrir `https://cotizador-segurosdigitalesins-sdi.netlify.app/`, subir el PDF de muestra, llegar al paso 3, hacer click en el botón "VER EXPLICACION DE MI COTIZACION" del preview. Verificar que abre el explicador v2 con todos los datos personalizados.

- [ ] **Step 7: Limpiar branch local (si aplica)**

Si creamos `feat/explicador-v2`:
```bash
cd C:/tmp/COTIZADOR-AUTOS && git branch -d feat/explicador-v2
```

---

## Self-Review Pendiente (al ejecutor)

Antes de marcar el plan completo, verificar contra el spec:

1. **Cobertura del spec:**
   - ✅ Hero v2 (encabezado A + cuerpo C, sin precio, cinta dorada) → Task 6 + Task 7
   - ✅ 5 secciones con personalización → Task 7 (apply...)
   - ✅ Asistencia en posición 2 con 💡 → ya en el prototipo, conservado en Task 6
   - ✅ IDD ₡400.000 fijo + 2 reglas (asegurado) → ya en el prototipo
   - ✅ Sección 4 sin regla 80% → ya en el prototipo
   - ✅ Eléctricos siempre visibles → ya en el prototipo
   - ✅ 5 opciones de pago al final → Task 7 (priceCards)
   - ✅ CTA rectangular puntas redondeadas → ya en el prototipo
   - ✅ Momento celebración con confetti + check + signature → ya en el prototipo, activado en Task 7 (`setTimeout` para abrir Google Form)
   - ✅ Sticky nav + floating + step buttons + smooth scroll + IO + scroll-margin-top → ya en el prototipo (mobile fix incluido)
   - ✅ Verde emerald vivo → ya en el prototipo (CSS vars)
   - ✅ 11 URL params + backward compat → Task 1, 2, 4, 5
   - ✅ Cambios al cotizador (email-template + app) → Task 4, 5
   - ✅ Documentación SKILL → Task 11

2. **Placeholders / TODOs en este plan:** ninguno detectado.

3. **Consistency:** los nombres de funciones (`_buildGuideUrl`, `_sustReposToCode`, `_detectVehicleType`, `applyPersonalization`, `openCelebration`, `closeCelebration`) coinciden entre tasks.

4. **Ambigüedades resueltas:**
   - El backup del React queda como `index-react-old.html` (no se sirve, no rompe nada).
   - Los precios faltantes muestran un mensaje de fallback en lugar de cards vacías.
   - El campo `va` (valor) faltante NO oculta los montos A, B, C estándar (siguen visibles).
