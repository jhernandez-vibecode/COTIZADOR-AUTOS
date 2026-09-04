# Cobertura ASI · Planes de Asistencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Ofrecer los seis planes de asistencia opcionales del INS (cobertura ASI, SVA V32) en el correo de cotización con una tarjeta discreta, y en una página nueva `/asistencias/` donde el cliente los arma y ve el total del año.

**Architecture:** Un solo módulo de datos (`js/planes-asistencia.js`) es la fuente de verdad de los seis planes y sus 93 servicios; lo cargan **tanto el correo como la página**, así no pueden contradecirse — misma regla que las coberturas del PDF (gotcha 27 del SKILL). El bloque del correo vive en `email-marca.js` con los otros bloques de marca. Un portón por fecha (`asiDisponible()`) mantiene el bloque apagado hasta el 28 de setiembre de 2026, y una casilla en la vista 3 permite apagarlo por cotización.

**Tech Stack:** HTML + JS vanilla, sin build, sin npm en el front. Tests Node sin runner (`node tests/test-asistencias.js`). Deploy: push a `main` → Netlify.

**Estado:** APROBADO EL DISEÑO (opción 2 de los mockups del 3 set 2026), **NO IMPLEMENTAR TODAVÍA**. JC sigue dándole forma hasta el 28 de setiembre.

---

## Contexto que el ejecutor necesita

**De dónde salen los datos.** Circular INS N° 0395-2026; Matriz de Cambios de las Condiciones Generales del SVA versión 32 (registro SUGESE G01-01-A01-012, aprobada 26/08/2026, implementación 28/09/2026); dossier "Planes de asistencia en Seguro Voluntario de Automóviles". Las tablas del dossier se verificaron **leyendo cada página como imagen**, no por extracción de texto: el emparejamiento servicio↔límite por coordenadas se equivoca en las filas apretadas de Salud Premium. Si alguien vuelve a tocar los datos, se verifica igual.

**Conteos verificados** (si un test da otro número, el dato está mal, no el test): Mascota 11 servicios · Funeraria 8 incluidos · Salud Bienestar 16 · Salud Premium 30 · Autos Plus 7 · VIP 21.

**Reglas del producto que el código debe respetar:**
- Mínimo hay que suscribir la cobertura **A** (Responsabilidad Civil).
- Se puede llevar **más de un plan**, pero no el mismo dos veces.
- **Sin deducible.**
- La prima **no recibe ningún descuento ni recargo** — ni plan familiar, ni cero kilómetros, ni buena experiencia siniestral. Solo el recargo por fraccionamiento.
- Primas **sin IVA del 13%** (así las publica el INS) y **sin recargo por fraccionamiento**.
- Servicios en especie, dentro del territorio nacional, eventos no acumulables, exceso lo paga el cliente al proveedor.
- Se solicitan al **800-800-8001**, 24/7.

**Trampa de nombres — leer antes de tocar `config.js`:** ya existe `CFG.ASSIST_URL`, que es el **Centro de Asistencia Digital** del correo de Póliza Activa (app aparte, repo `APP-ASISTENCIA-SEGURO-AUTOS`). No es esto. La constante nueva se llama **`CFG.PLANES_URL`**. Confundirlas manda al cliente a la app equivocada.

**Registro del correo:** el correo de cotización usa **vos/tu** ("tu cotización", "estoy para vos"). NO usar "usted" — ese es el registro de `/polizas-activas/` y `/renovaciones/`.

**Mockup aprobado:** `docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html`, opción 2 (JC la escogió el 4 set 2026). La página `/asistencias/` **se transcribe** de ahí, no se vuelve a redactar (regla: integrar módulo existente = transcribir). `netlify.toml` ya devuelve 404 para `/docs/*`, así que el mockup no se sirve en producción.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `js/planes-asistencia.js` **(nuevo)** | Fuente única: los 6 planes, sus servicios, y el portón por fecha `asiDisponible()`. Sin DOM, sin CFG. Exporta por `window` y por `module.exports`. |
| `js/email-marca.js` **(modificar)** | `_bloqueAsistencias()`: la tarjeta gris del correo. Vive con los otros bloques de marca porque los tres correos podrían usarla algún día. |
| `js/email-template.js` **(modificar)** | Llama al bloque después de las formas de pago y arma `_buildPlanesUrl()` con la ficha del agente. |
| `js/config.js` **(modificar)** | `CFG.PLANES_URL`. |
| `index.html` **(modificar)** | Casilla "Incluir planes de asistencia" en la vista 3 + `<script src="js/planes-asistencia.js">` antes de `email-marca.js`. |
| `js/app.js` **(modificar)** | Lee la casilla y la pasa a `buildEmail` en los **dos** sitios (vista previa y envío). |
| `asistencias/index.html` **(nuevo)** | El configurador. Página del cliente, misma línea gráfica que `/explicacion/`. |
| `tests/test-asistencias.js` **(nuevo)** | Datos, portón por fecha, bloque del correo, y que correo y página lean lo mismo. |

---

## Task 1: El módulo de datos y el portón por fecha

**Files:**
- Create: `js/planes-asistencia.js`
- Test: `tests/test-asistencias.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test-asistencias.js`:

```js
/**
 * Test de los planes de asistencia (cobertura ASI del INS, SVA V32).
 *
 * Lo que vigila:
 *   1. Que los seis planes y sus primas sean los del dossier del INS.
 *   2. Que el conteo de servicios de cada plan calce: un servicio que se
 *      pierde en silencio es una promesa de menos, y uno de mas es una
 *      promesa que la poliza no respalda.
 *   3. Que el bloque NO salga antes del 28 de setiembre de 2026: hasta esa
 *      fecha el INS emite con la version anterior y estos planes no existen
 *      en la solicitud de seguro.
 *
 * Run: node tests/test-asistencias.js
 */
var A = require('../js/planes-asistencia.js');

var pass = 0, fail = 0;
function ok(nombre, cond) {
  if (cond) { pass++; console.log('  ok    ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre); }
}

console.log('\n=== Datos de los seis planes ===');
ok('son exactamente 6 planes', A.PLANES_ASI.length === 6);

var esperado = {
  mascota:   { nom: 'Mascota',              prima: 7200,  serv: 11 },
  funerario: { nom: 'Asistencia Funeraria', prima: 10800, serv: 0  },
  bienestar: { nom: 'Salud Bienestar',      prima: 18000, serv: 16 },
  premium:   { nom: 'Salud Premium',        prima: 42000, serv: 30 },
  autos:     { nom: 'Autos Plus',           prima: 42000, serv: 7  },
  vip:       { nom: 'VIP',                  prima: 42000, serv: 21 }
};

Object.keys(esperado).forEach(function (id) {
  var p = A.planAsi(id);
  var e = esperado[id];
  ok(id + ': existe', !!p);
  if (!p) return;
  ok(id + ': nombre "' + e.nom + '"', p.nom === e.nom);
  ok(id + ': prima ' + e.prima, p.prima === e.prima);
  ok(id + ': ' + e.serv + ' servicios', (p.serv ? p.serv.length : 0) === e.serv);
});

ok('el funerario trae 8 servicios incluidos', A.planAsi('funerario').incluye.length === 8);
ok('el funerario declara su monto maximo', A.planAsi('funerario').monto === '₡500.000');

console.log('\n=== Cada servicio tiene nombre y limite ===');
var huecos = 0;
A.PLANES_ASI.forEach(function (p) {
  (p.serv || []).forEach(function (s) {
    if (!s[0] || !s[2]) huecos++;
  });
});
ok('ningun servicio quedo sin nombre o sin limite', huecos === 0);

console.log('\n=== Porton por fecha (28 set 2026) ===');
ok('el 3 de setiembre 2026 NO esta disponible',  A.asiDisponible(new Date('2026-09-03T12:00:00-06:00')) === false);
ok('el 27 de setiembre 2026 NO esta disponible', A.asiDisponible(new Date('2026-09-27T23:00:00-06:00')) === false);
ok('el 28 de setiembre 2026 SI esta disponible', A.asiDisponible(new Date('2026-09-28T00:30:00-06:00')) === true);
ok('el 15 de octubre 2026 SI esta disponible',   A.asiDisponible(new Date('2026-10-15T12:00:00-06:00')) === true);
ok('sin argumento no revienta', typeof A.asiDisponible() === 'boolean');

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `node tests/test-asistencias.js`
Expected: FAIL — `Cannot find module '../js/planes-asistencia.js'`

- [ ] **Step 3: Escribir el módulo**

Crear `js/planes-asistencia.js`. **Los datos NO se teclean de memoria: se extraen del mockup aprobado**, que ya está verificado contra el dossier página por página. El mockup vive en el repo, en `docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html` (144 líneas, la constante `PLANES` dentro del `<script>`).

Extraer el bloque exacto con esto, y pegar el resultado dentro del archivo nuevo:

```bash
node -e "
var fs=require('fs');
var s=fs.readFileSync('docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html','utf8');
var i=s.indexOf('var PLANES = ['), j=s.indexOf('\n  ];', i)+5;
fs.writeFileSync('/tmp/planes.txt', s.slice(i,j).replace('var PLANES =','var PLANES_ASI ='));
console.log('extraidas', s.slice(i,j).split('\n').length, 'lineas');
"
```

Expected: `extraidas 144 lineas`. El test de la Task 1 es el que confirma que la extracción quedó completa (11 · 8 · 16 · 30 · 7 · 21).

```js
/* ======================================================================
   Planes de asistencia del INS — cobertura "ASI" Servicios de
   Multiasistencia, incorporada en la version 32 del Seguro Voluntario de
   Automoviles (circular 0395-2026, registro SUGESE G01-01-A01-012).

   Este archivo es la UNICA fuente de los seis planes. Lo cargan el correo
   (js/email-marca.js) y la pagina del cliente (/asistencias/). Si alguna
   vez se duplican los datos, el correo y la pagina empiezan a decir cosas
   distintas y las dos van firmadas con la licencia SUGESE del agente.

   Los limites se transcriben TAL CUAL del dossier del INS: "Sin limite" es
   literal del documento y no se traduce a "ilimitado". El detalle completo
   de cada servicio vive en las Condiciones Operativas de Multiasistencia.
   ====================================================================== */

/* Fecha desde la que el INS emite con la V32. Antes de esto los planes no
   existen en la solicitud de seguro: ofrecerlos seria prometer algo que el
   cliente no puede contratar. Formato ISO, hora de Costa Rica (UTC-6). */
var ASI_DESDE = new Date('2026-09-28T00:00:00-06:00');

/* IVA que el INS NO incluye en las primas publicadas. */
var ASI_IVA = 0.13;

var PLANES_ASI = [ /* ← transcribir aqui la constante PLANES del mockup,
                       en el mismo orden (por prima ascendente) y con los
                       mismos campos: id, nom, prima, tono, icono, linea,
                       desc, nota, serv[] / incluye[] + monto + eventos. */ ];

/**
 * ¿Ya se pueden ofrecer? Recibe una fecha para poder testearlo; sin
 * argumento usa la de hoy.
 */
function asiDisponible(hoy) {
  var d = hoy instanceof Date ? hoy : new Date();
  return d.getTime() >= ASI_DESDE.getTime();
}

/** Devuelve un plan por id, o null. */
function planAsi(id) {
  for (var i = 0; i < PLANES_ASI.length; i++) {
    if (PLANES_ASI[i].id === id) return PLANES_ASI[i];
  }
  return null;
}

/** Prima mas barata, para el "desde ₡X" del correo y de la pagina. */
function asiDesde() {
  return PLANES_ASI.reduce(function (m, p) { return Math.min(m, p.prima); }, Infinity);
}

/** ₡18.000 — separador de miles con punto ('de-DE'; es-CR usa espacio). */
function asiColones(n) {
  return '₡' + Number(n).toLocaleString('de-DE');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLANES_ASI: PLANES_ASI, ASI_DESDE: ASI_DESDE, ASI_IVA: ASI_IVA,
    asiDisponible: asiDisponible, planAsi: planAsi,
    asiDesde: asiDesde, asiColones: asiColones
  };
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `node tests/test-asistencias.js`
Expected: PASS — todos los `ok`, `0 fallas`

- [ ] **Step 5: Commit**

```bash
git add js/planes-asistencia.js tests/test-asistencias.js
git commit -m "feat(asistencias): los seis planes ASI del INS en un solo modulo, con porton por fecha"
```

---

## Task 2: El bloque de la tarjeta en el correo

**Files:**
- Modify: `js/email-marca.js` (agregar función y sumarla a `module.exports`, líneas 635-645)
- Test: `tests/test-asistencias.js` (agregar sección)

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/test-asistencias.js`, **antes** de la línea del resumen final:

```js
console.log('\n=== La tarjeta del correo ===');
global.PLANES_ASI = A.PLANES_ASI;   // en el navegador lo pone el <script>
global.planAsi = A.planAsi;
global.asiColones = A.asiColones;
global.asiDesde = A.asiDesde;
var M = require('../js/email-marca.js');

var htmlAsi = M._bloqueAsistencias({ url: 'https://ejemplo.test/asistencias/?n=Agente', fontFam: "'Space Grotesk',Arial,sans-serif" });

ok('devuelve HTML', typeof htmlAsi === 'string' && htmlAsi.length > 200);
A.PLANES_ASI.forEach(function (p) {
  ok('nombra a ' + p.nom, htmlAsi.indexOf(p.nom) !== -1);
  ok('trae la prima de ' + p.nom, htmlAsi.indexOf(A.asiColones(p.prima)) !== -1);
});
ok('lleva el enlace a la pagina', htmlAsi.indexOf('https://ejemplo.test/asistencias/?n=Agente') !== -1);
ok('avisa que el precio no lleva IVA', /sin IVA|m&aacute;s IVA|mas IVA/i.test(htmlAsi));
ok('dice que es opcional', /opcional/i.test(htmlAsi));

console.log('\n=== Reglas de correo (Gmail) ===');
ok('sin <svg> (Gmail lo bloquea)', htmlAsi.indexOf('<svg') === -1);
ok('sin <img>', htmlAsi.indexOf('<img') === -1);
ok('sin emojis', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(htmlAsi));
ok('sin barra de color a la izquierda', htmlAsi.indexOf('border-left:4px') === -1);
ok('sin flexbox ni grid', !/display:\s*(flex|grid)/.test(htmlAsi));
ok('sin url vacia el bloque no sale', M._bloqueAsistencias({ url: '' }) === '');
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `node tests/test-asistencias.js`
Expected: FAIL — `M._bloqueAsistencias is not a function`

- [ ] **Step 3: Escribir la función**

En `js/email-marca.js`, **después** de `_bloquePagos` (termina en la línea 227) y antes de `SDI_LOGO_POR_DEFECTO` (línea 229):

```js
/* ----------------------------------------------------------------------
   TARJETA DE LOS PLANES DE ASISTENCIA (cobertura ASI del INS).

   Discreta a proposito: fondo gris plano, sin boton de color, sin foto y
   sin barra lateral. Va DESPUES de las formas de pago — el cliente ya vio
   lo que le importa. Los seis nombres con su precio para que se entienda
   de un vistazo de que se trata; el detalle esta en la pagina.

   Devuelve '' si no hay a donde mandar al cliente: una tarjeta que nombra
   planes y no dice donde verlos es peor que no ponerla.
   ---------------------------------------------------------------------- */
function _bloqueAsistencias(o) {
  var op = o || {};
  var url = String(op.url || '').trim();
  if (!url) return '';
  if (typeof PLANES_ASI === 'undefined' || !PLANES_ASI.length) return '';
  var fontFam = op.fontFam || "'Space Grotesk',Arial,sans-serif";

  // Dos por fila, en el orden del modulo (de la prima mas baja a la mas alta).
  var filas = '';
  for (var i = 0; i < PLANES_ASI.length; i += 2) {
    filas += '<tr>';
    for (var k = 0; k < 2; k++) {
      var p = PLANES_ASI[i + k];
      filas += '<td width="50%" style="padding:5px 10px 5px 0;vertical-align:top;font-size:13px;">' +
        (p ? '<span style="color:' + SDI_NAVY + ';font-weight:bold;">' + _escMarca(p.nom) + '</span>' +
             '<span style="color:' + SDI_GRIS + ';"> &middot; ' + asiColones(p.prima) + '</span>' : '') +
        '</td>';
    }
    filas += '</tr>';
  }

  return '\n        <tr><td style="padding:26px 32px 0;">\n' +
    '          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid ' + SDI_LINEA + ';border-radius:10px;">\n' +
    '            <tr><td style="padding:18px 20px;">\n' +
    '              <p style="margin:0 0 3px;font-size:10px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:#8a6d1f;">Opcional &middot; nuevo del INS</p>\n' +
    '              <p style="margin:0 0 4px;font-family:' + fontFam + ';font-size:16px;font-weight:bold;color:' + SDI_NAVY + ';">Asistencias que le pod&eacute;s sumar a la p&oacute;liza</p>\n' +
    '              <p style="margin:0 0 14px;font-size:13px;color:' + SDI_GRIS + ';line-height:1.5;">Se contratan aparte de la cotizaci&oacute;n y se cobran junto con el seguro. Precios al a&ntilde;o, sin IVA.</p>\n' +
    '              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' + filas + '</table>\n' +
    '              <p style="margin:16px 0 0;"><a href="' + _escMarca(url) + '" style="display:inline-block;border:1px solid #cbd5e1;border-radius:8px;padding:9px 16px;color:#0c4a6e;font-weight:bold;font-size:13px;text-decoration:none;">Ver qu&eacute; trae cada plan &rarr;</a></p>\n' +
    '            </td></tr>\n' +
    '          </table>\n' +
    '        </td></tr>\n';
}
```

Y agregarla al `module.exports` de la línea 636, en la lista de bloques:

```js
    _ahorroAnual: _ahorroAnual, _bloquePagos: _bloquePagos, _bloqueAsistencias: _bloqueAsistencias,
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `node tests/test-asistencias.js`
Expected: PASS

- [ ] **Step 5: Correr la suite completa — no se rompió nada más**

Run: `for f in tests/test-*.js; do node "$f" >/dev/null || echo "ROTO: $f"; done`
Expected: sin salida (los 17 archivos siguen en verde)

- [ ] **Step 6: Commit**

```bash
git add js/email-marca.js tests/test-asistencias.js
git commit -m "feat(asistencias): tarjeta discreta de los planes ASI en el correo de cotizacion"
```

---

## Task 3: Enchufar la tarjeta al correo

**Files:**
- Modify: `js/config.js` (agregar `PLANES_URL`)
- Modify: `js/email-template.js` (nuevo `_buildPlanesUrl`, y la llamada en `buildEmail`)
- Test: `tests/test-asistencias.js`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/test-asistencias.js`, antes del resumen:

```js
console.log('\n=== El correo completo ===');
global.CFG = {
  FROM_NAME: 'Agente Prueba', LICENSE: '00-0000', WEBSITE: 'https://ejemplo.test',
  AGENDA_URL: 'https://ejemplo.test/agenda', WHATSAPP: '88880000',
  GUIDE_URL: 'https://ejemplo.test/explicacion/',
  PLANES_URL: 'https://ejemplo.test/asistencias/',
  LOGO_URL: 'https://ejemplo.test/img/ins-logo.png'
};
var T = require('../js/email-template.js');

var base = { clientName: 'Ana', vehicle: 'Toyota Yaris', plate: 'BBB111',
             prices: { anual: '570891', semestral: '308283', trimestral: '158423' } };

var conAsi = T.buildEmail(Object.assign({}, base, { incluirAsistencias: true }));
var sinAsi = T.buildEmail(Object.assign({}, base, { incluirAsistencias: false }));

ok('con la casilla prendida, la tarjeta sale', conAsi.indexOf('Asistencias que le pod&eacute;s sumar') !== -1);
ok('con la casilla apagada, no sale', sinAsi.indexOf('Asistencias que le pod&eacute;s sumar') === -1);
ok('la tarjeta va DESPUES de las formas de pago',
   conAsi.indexOf('Asistencias que le pod&eacute;s sumar') > conAsi.indexOf('FORMAS DE PAGO'));
ok('el enlace lleva la ficha del agente', /asistencias\/\?[^"]*n=Agente(%20|\+)Prueba/.test(conAsi));
ok('el enlace lleva la licencia', conAsi.indexOf('l=00-0000') !== -1);

console.log('\n=== El correo y la pagina dicen lo mismo ===');
A.PLANES_ASI.forEach(function (p) {
  ok('el correo trae ' + p.nom + ' con su prima del modulo',
     conAsi.indexOf(A.asiColones(p.prima)) !== -1 && conAsi.indexOf(p.nom) !== -1);
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `node tests/test-asistencias.js`
Expected: FAIL — `con la casilla prendida, la tarjeta sale`

- [ ] **Step 3: Agregar `CFG.PLANES_URL`**

En `js/config.js`, junto a `GUIDE_URL`:

```js
  // Pagina de los planes de asistencia (cobertura ASI del INS). OJO: NO es
  // ASSIST_URL — ese es el Centro de Asistencia Digital de la poliza activa,
  // que es otra app y otro repo.
  PLANES_URL: 'https://cotizador.appsegurosdigitales.com/asistencias/',
```

- [ ] **Step 4: Armar el URL de la página con la ficha del agente**

En `js/email-template.js`, después de `_buildGuideUrl` (termina cerca de la línea 570):

```js
/**
 * URL de /asistencias/ con la ficha del agente, para que la pagina muestre
 * al agente correcto y su WhatsApp — igual que hace _buildGuideUrl con la
 * guia. Sin esto la pagina caeria a los defaults de config.js, o sea a JC,
 * aunque el correo lo mande otro agente.
 */
function _buildPlanesUrl() {
  const base = (typeof CFG !== 'undefined' && CFG.PLANES_URL) || '';
  if (!base) return '';
  const params = [];
  if (CFG.FROM_NAME)  params.push('n='  + encodeURIComponent(CFG.FROM_NAME));
  if (CFG.LICENSE)    params.push('l='  + encodeURIComponent(CFG.LICENSE));
  if (CFG.WEBSITE)    params.push('w='  + encodeURIComponent(CFG.WEBSITE));
  if (CFG.AGENDA_URL) params.push('a='  + encodeURIComponent(CFG.AGENDA_URL));
  if (CFG.WHATSAPP)   params.push('wa=' + encodeURIComponent(CFG.WHATSAPP));
  return params.length ? base + (base.indexOf('?') === -1 ? '?' : '&') + params.join('&') : base;
}
```

- [ ] **Step 5: Llamar al bloque desde `buildEmail`**

En `js/email-template.js`, junto al bloque `coberturasHtml` (línea 162), agregar:

```js
  // Planes de asistencia (cobertura ASI). Solo si el agente dejo la casilla
  // prendida Y el INS ya los emite: antes del 28 de setiembre de 2026 no
  // existen en la solicitud de seguro y ofrecerlos seria prometer algo que
  // el cliente no puede contratar.
  const asistenciasHtml = (p.incluirAsistencias &&
      typeof asiDisponible === 'function' && asiDisponible() &&
      typeof _bloqueAsistencias === 'function')
    ? _bloqueAsistencias({ url: _buildPlanesUrl(), fontFam: fontFam })
    : '';
```

Y en la composición, **inmediatamente después** de la línea 268 (`${_bloquePagos({ prices: prices, fontFam: fontFam })}`) y antes de `${interesHtml}`:

```js
        <!-- 6b. PLANES DE ASISTENCIA (opcional, cobertura ASI) -->
        ${asistenciasHtml}
```

- [ ] **Step 6: Correr los tests**

Run: `node tests/test-asistencias.js && for f in tests/test-*.js; do node "$f" >/dev/null || echo "ROTO: $f"; done`
Expected: PASS y sin `ROTO:`

- [ ] **Step 7: Commit**

```bash
git add js/config.js js/email-template.js tests/test-asistencias.js
git commit -m "feat(asistencias): el correo enchufa la tarjeta y le pasa la ficha del agente a la pagina"
```

---

## Task 4: La casilla en la consola

**Files:**
- Modify: `index.html` (script nuevo + casilla en la vista 3)
- Modify: `js/app.js:1374-1392` y `js/app.js:1429-1447`

- [ ] **Step 1: Cargar el módulo nuevo**

En `index.html`, entre las líneas 737 y 738 — **antes** de `email-marca.js`, que lo usa:

```html
  <script src="js/planes-asistencia.js"></script>
```

- [ ] **Step 2: Poner la casilla en la vista 3**

En `index.html`, después del bloque de la nota personal (termina en la línea 603) y antes del `<div class="form-row">` del adjunto (línea 605). Se reutiliza el patrón `toggle-row / toggle-label / toggle-switch` que ya existe en la vista 2 (`index.html:497-508`), **sin** `.toggle-icon`: ese emoji tiene sentido en la tira de tres banderas del vehículo, y acá el interruptor va solo.

```html
          <div class="toggle-row" id="asiRow" hidden>
            <label class="toggle-label" for="m-asistencias">
              <span>Incluir los planes de asistencia del INS</span>
              <span class="toggle-hint">Agrega una tarjeta al final del correo con los seis planes y su precio, más el enlace a la página donde el cliente los arma. Apagalo si en esta cotización no querés ofrecerlos.</span>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="m-asistencias" checked />
              <span class="toggle-slider"></span>
            </label>
          </div>
```

> Sin clases nuevas: `.form-hint` **no existe** en `css/styles.css`; la clase de ayuda bajo un control es `.toggle-hint`, y solo funciona dentro de un `.toggle-label`.

- [ ] **Step 3: Mostrar la fila solo cuando ya se pueden ofrecer**

En `js/app.js`, dentro del `DOMContentLoaded` (junto a los otros `getElementById`):

```js
  // La casilla de asistencias solo aparece cuando el INS ya emite con la
  // V32. Antes del 28 de setiembre de 2026 no hay nada que ofrecer, y una
  // casilla prendida que no hace nada confunde.
  var asiRow = document.getElementById('asiRow');
  if (asiRow && typeof asiDisponible === 'function' && asiDisponible()) asiRow.hidden = false;
```

- [ ] **Step 4: Pasar el valor a `buildEmail` en los DOS sitios**

En `js/app.js`, dentro del objeto que se le pasa a `buildEmail` en la **línea 1374** (vista previa) y otra vez en la **línea 1429** (envío), agregar junto a `coberturas`/`deducibles`:

```js
    incluirAsistencias: !!(document.getElementById('m-asistencias') || {}).checked,
```

> Los dos sitios, siempre. Si solo se toca uno, la vista previa y el correo que sale se separan — y el agente aprueba una cosa y manda otra.

- [ ] **Step 5: Smoke en localhost**

```bash
python -m http.server 8080
```

Abrir `http://localhost:8080/`, cargar el PDF de muestra, llegar a la vista 3 y comprobar:
- Hoy (antes del 28 set): la fila de la casilla **no aparece** y la vista previa no muestra la tarjeta.
- Con el reloj de la máquina puesto en el 29 de setiembre de 2026: la fila aparece, la vista previa muestra la tarjeta después de las formas de pago, y al desmarcarla desaparece.

- [ ] **Step 6: Commit**

```bash
git add index.html js/app.js
git commit -m "feat(asistencias): casilla en la vista 3, visible solo desde el 28 de setiembre"
```

---

## Task 5: La página `/asistencias/`

**Files:**
- Create: `asistencias/index.html`

**Fuente:** la opción 2 del mockup aprobado, `docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html`. **Se transcribe**, no se vuelve a diseñar. Concretamente se levantan de ahí:
- El bloque `<style>` completo **menos** las reglas con prefijo `.sc-` y `.em-` (son el escaparate de los mockups, no la página) y menos las reglas de la opción 1 (`.lista`, `.fila*`, `.barra`, `.pick`) y de la opción 3 (`.preg`, `.chip`, `.reco*`, `.otros`).
- El markup de `#op2-pagina` completo: `.pg-head`, `.pg-hero`, `.pg-reglas`, el `.cfg`, `.det` y las secciones de pasos y condiciones.
- Del `<script>`: `ICONOS`, `svgIco`, `estiloTono`, `htmlDetalle`, `tablaServ`, `pintaReglas`, `pintaPasos`, `pintaSaber`, `urlWa`, `montaConfigurador`.

**Lo que cambia respecto del mockup** (y es todo lo que hay que escribir de nuevo):

- [ ] **Step 1: Cabecera de la página**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planes de asistencia · Seguros del INS</title>
<link rel="icon" type="image/svg+xml" href="../img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
</head>
```

- [ ] **Step 2: Los datos vienen del módulo, no copiados**

Antes del script de la página:

```html
<script src="../js/planes-asistencia.js"></script>
```

Y en el script de la página, borrar la constante `PLANES` del mockup y usar `PLANES_ASI`:

```js
  var PLANES = PLANES_ASI;   // fuente unica: js/planes-asistencia.js
  var IVA = ASI_IVA;
```

> Esta es la razón de ser del módulo. Si la página se queda con su propia copia, el día que el INS cambie una prima el correo dirá una cosa y la página otra.

- [ ] **Step 3: Leer la ficha del agente del URL**

Reemplazar la constante `WA_AGENTE` del mockup por:

```js
  /* La ficha del agente llega por el URL que arma _buildPlanesUrl() en el
     correo. Sin parametros cae a los datos de la casa. Todo se escapa antes
     de tocar el DOM: son valores que viajan por la barra de direcciones.  */
  var Q = new URLSearchParams(location.search);
  function param(k, def) {
    var v = (Q.get(k) || '').trim();
    return v || def;
  }
  var AGENTE = {
    nombre: param('n', 'Juan Carlos Hernández Vargas'),
    licencia: param('l', '08-1318'),
    web: param('w', ''),
    agenda: param('a', ''),
    wa: (param('wa', '8822 1348').replace(/\D/g, ''))
  };
  function waIntl(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    return d.length === 8 ? '506' + d : d;
  }
  var WA_AGENTE = waIntl(AGENTE.wa);
```

Y `urlWa()` pasa a usar el nombre real del agente:

```js
  function urlWa(ids) {
    var nombres = ids.map(function (id) { return plan(id).nom; });
    var t = 'Hola ' + AGENTE.nombre.split(' ')[0] + ', revisé los planes de asistencia y me interesan: ' + nombres.join(', ') + '.';
    return 'https://web.whatsapp.com/send/?phone=' + WA_AGENTE + '&text=' + encodeURIComponent(t);
  }
```

> Endpoint `web.whatsapp.com/send/`, **nunca** `wa.me` — regla del proyecto.

- [ ] **Step 4: Firmar la página con el agente**

En el `.pg-head`, el mockup trae `<small>SEGUROS DEL INS</small>` fijo. Reemplazarlo por un nodo con id, **y crear el elemento antes de escribirle**:

```html
        <small id="pieAgente">SEGUROS DEL INS</small>
```

Y al final del script de la página:

```js
  /* El elemento tiene que existir antes de escribirle. Si falta, esta linea
     lanza y se lleva puesto todo lo que venga despues en el arranque — es el
     fallo en cascada que ya mordio a este proyecto (menu lateral, 7 ago) y a
     los mockups de esta misma feature. Por eso el guard. */
  var pie = document.getElementById('pieAgente');
  if (pie) pie.textContent = AGENTE.nombre + ' · Lic. SUGESE ' + AGENTE.licencia;
```

> Regla que sale de esos dos incidentes y aplica a toda la página: **el enganche de los interruptores del configurador va primero**, antes de pintar nada, y cada pintor sale solo si su destino no existe. Al transcribir `montaConfigurador` del mockup, conservar ese orden.

- [ ] **Step 5: Registro de cambios al pie**

Copiar el `<footer class="app-foot">` de `index.html` y estrenar la entrada del día. Regla del 5 ago 2026: en apps con dos caras, la cara del cliente también lo lleva, escrito como beneficio.

- [ ] **Step 6: Smoke en localhost**

Abrir `http://localhost:8080/asistencias/?n=Fernando%20Prueba&l=08-1319&wa=88887777` y comprobar:
- El pie dice "Fernando Prueba · Lic. SUGESE 08-1319" y **no** los datos de JC.
- Prender tres planes: el resumen suma la prima, el IVA del 13% y el total.
- El botón de WhatsApp abre `web.whatsapp.com/send/` con el 50688887777 y los tres nombres en el texto.
- Sin ningún plan prendido, el resumen muestra el estado vacío, no un total en cero.
- A 375 px de ancho el resumen se pone debajo y nada se sale de la pantalla.
- Con `?n=<img src=x onerror=alert(1)>` no salta ningún alert.

- [ ] **Step 7: Commit**

```bash
git add asistencias/index.html
git commit -m "feat(asistencias): pagina del cliente con el configurador y el total del ano"
```

---

## Task 6: Documentación y cierre

**Files:**
- Modify: `index.html` (footer `app.app-foot`)
- Modify: `C:/Users/segur/.claude/skills/especialista-cotizador-autos-sdi/SKILL.md`
- Modify: `SKILL_COTIZADOR_SDI.md` (raíz del repo) y su espejo en `Downloads/`

- [ ] **Step 1: Registro de cambios de la consola**

Entrada nueva **arriba** en el `<footer class="app-foot">` de `index.html`, con la fecha real y escrita para quien usa la app, sin nombres de archivos.

- [ ] **Step 2: Actualizar las 3 ubicaciones de la documentación**

Sección nueva en el SKILL: qué es la cobertura ASI, los seis planes con su prima, el portón por fecha, la trampa `PLANES_URL` vs `ASSIST_URL`, y que los datos se verifican leyendo el dossier **como imagen**.

- [ ] **Step 3: Correr la suite completa una última vez**

Run: `for f in tests/test-*.js; do node "$f" >/dev/null || echo "ROTO: $f"; done`
Expected: sin salida — 18 archivos en verde

- [ ] **Step 4: Commit y push**

```bash
git add index.html SKILL_COTIZADOR_SDI.md docs/
git commit -m "docs(asistencias): registro de cambios y sincronizacion de las 3 ubicaciones"
git push origin main
```

- [ ] **Step 5: Smoke en producción**

Esperar el deploy de Netlify (1-2 min) y comprobar en `https://cotizador.appsegurosdigitales.com/asistencias/` que la página carga, que los seis planes están, y que el correo de una cotización real trae la tarjeta.

---

## Lo que este plan NO hace

- **No toca el esquema de repuestos.** La V32 también rehace la Sustitución de Repuestos: quedan Vehículo en Garantía, Extensión de Garantía **Plus**, **Original Multimarca** y Alternativo Genérico/Usado; desaparece "Extensión de Garantía" a secas y los topes de años y kilómetros se mudan de las Condiciones Generales a la Solicitud de Seguro. Eso afecta a `_reposKind` en `email-template.js`, a `_parsePaymentMatrix` en `pdf-extract.js` y al texto fijo de la sección 4 del explicador. **Es un plan aparte y tiene la misma fecha límite: 28 de setiembre de 2026.**
- **No registra en el historial** cuáles planes marcó el cliente. Hoy el botón de WhatsApp solo manda el mensaje.
- **No agrega los planes al PDF adjunto** ni a los documentos estándar.
- **No replica la tarjeta** en los correos de póliza activa ni de renovación. `_bloqueAsistencias` queda en `email-marca.js` por si algún día se quiere, pero nadie más la llama.

## Decisión pendiente de JC

El IVA. Hoy el plan muestra la prima **sin IVA** en el correo (como la publica el INS) y el configurador suma el 13% aparte hasta el total. Si JC prefiere que el cliente vea siempre el número final, cambia `_bloqueAsistencias` y el resumen de la página — no cambia el módulo de datos.
