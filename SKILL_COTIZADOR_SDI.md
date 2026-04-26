---
name: cotizador-sdi
description: >
  Especialista en Cotizador SDI - App web vanilla JS que extrae datos
  de PDFs de cotizacion INS, los limpia, genera correo HTML personalizado
  y lo envia via Gmail API o Outlook (Microsoft Graph). Multi-agente via
  localStorage, sin backend. Stack 100% sin build (HTML + JS vanilla +
  Tailwind CDN). Incluye calculadora de cancelacion anticipada con envio
  de informe al cliente. Usar cuando Juan Carlos pida construir, modificar
  o depurar cualquier modulo de esta app. Leer COMPLETO antes de escribir
  cualquier codigo.
---

# Cotizador SDI - Checkpoint 23 abril 2026

## Estado actual
APP COMPLETA Y FUNCIONAL EN PRODUCCION. 20 commits desde init.
Multi-agente operativo via localStorage. Gmail Y Outlook soportados
(selector de proveedor en modal ⚙). Correo con logo INS y headers
RFC 2047. Probado en produccion con PDF real BRK454 y cotizacion THG170.
**Calculadora de cancelacion anticipada** disponible en `/cancelacion/`.

## Decisiones recientes

### 25 abril 2026 — Explicador v2 personalizado

**Reescrito completo:** `/explicacion/index.html` migrado de React+Babel CDN a vanilla HTML+CSS+JS single-file. Carga ~40x mas liviana (sin compilacion en cliente) — total ~150 KB vs ~6 MB de la version React+Babel+Tailwind. Alineado con el resto del cotizador (sin build step).

**Personalizacion por cliente via 11 URL params** (n, l, w, c, v, p, y, vt, va, sr, pa, ps, pt):
- Greeting: `¡Hola, {nombre}!` con highlight amarillo en el nombre real del cliente
- Vehiculo + placa en el hero (chip del agente + burbuja) y en el header de la seccion 4
- Plan asistencia auto-seleccionado por edad del vehiculo (Plus 0-6 años / Basico 7-15)
- Fila de calidad de repuestos auto-resaltada segun `sr` (Plus/Garantia/Nuevo/Sin extension)
- Seccion 1 (coberturas D/F/H) muestra montos calculados sobre el valor asegurado real
- Seccion 5 (3 opciones de pago) con primas reales del PDF (Trimestral/Semestral/Anual con badge -10%)

**Backward compatible:** si el URL llega sin params, sigue funcionando con defaults (greeting generico "Cliente", agent default a Juan Carlos, seccion 5 muestra mensaje "Consulta a tu agente las opciones de pago").

**Cambios estructurales del recorrido (vs explicador React anterior):**
- Asistencia movida a Seccion 2 (era 4) — "tambien es una cobertura"
- Eliminada la regla del 80% (gasolina y electricos) — pedido explicito JC
- Electricos siempre visible como sub-seccion educativa de la Seccion 4
- 3 opciones de pago ahora son una seccion dedicada al final (antes solo en el correo)
- Removidos emojis como iconos estructurales (excepto algunos puntuales aprobados como ★ y 💡)

**Nuevo: momento celebracion:** al hacer click en "Agende su cita de Aseguramiento", aparece overlay oscuro con check verde animado + 10 confettis cayendo + mensaje personalizado "¡Excelente decision, {nombre}!" + firma del agente con avatar JC. Abre el Google Form en nueva pestaña tras 2.5s. ESC y × cierran. Respeta `prefers-reduced-motion`.

**Nueva paleta verde:** emerald-500/400 (`#10b981`/`#34d399`) reemplaza el teal-600 (`#0d9488`) en CTAs y badges. Mas vivo y alegre — pedido JC.

**Navegacion nueva:**
- Sticky bar superior pill con dots clickeables y labels (mobile ≤720px: solo numeros 1-5)
- Floating ←/→ en esquina inferior derecha con contador "X/5"
- Step buttons "← Anterior · Siguiente →" al final de cada seccion
- Scroll suave + IntersectionObserver para fade-in de secciones
- `scroll-margin-top: 100px` para que el sticky nav no tape titulos al saltar
- Respeta `prefers-reduced-motion` (sin confetti, sin bounce)

**CTA final:** "Agende su cita de Aseguramiento" rectangular puntas redondeadas (radius 10px, no pill), gradient emerald, texto Space Grotesk 700.

**Diferenciador del agente (sutil + consistente):**
- Cinta dorada bajo el header: "Una herramienta diseñada por {Juan Carlos} para acompañar..."
- Firma + mensaje en el cierre: "Esta guia la cree yo personalmente para mis clientes..."
- Footer copyright con propiedad intelectual del agente

**Social proof preservado:** ★★★★★ + "Miles de conductores ya estan protegidos con nuestro proceso digital" en el cierre (debajo de la linea diferenciadora, separados por divisor sutil).

**Modificaciones al cotizador (afuera de /explicacion/):**
- `js/email-template.js`:
  - `_buildGuideUrl(extras)` ampliado para aceptar 8 params nuevos del cliente.
  - Helper `_sustReposToCode(label)` mapea texto del PDF a codigo corto (`p`/`g`/`0`/`n`).
  - Helper `_detectVehicleType(rawType)` detecta gasolina/electrico (default `g`).
  - Helper interno `num(val)` normaliza montos del PDF ("10,000,000.00") a numero limpio ("10000000") antes del URL-encode.
  - `buildEmail()` recibe 4 nuevos params opcionales (`plate`, `year`, `valor`, `vehicleType`).
  - URL del explicador ahora extraido a `const guideUrl` antes del return (legibilidad).
- `js/app.js`: las 2 llamadas a `buildEmail()` (preview + send) pasan ahora `plate, year, valor, vehicleType` desde `S.data.*`.

**Tests:** `tests/test-explicador-url.js` (Node, sin runner) — 11 casos cubren:
- URL builder con 3, 11 y 13 params
- Encoding de tildes
- Manejo de extras vacios
- Separador `?`/`&` cuando GUIDE_URL ya tiene query
- Mapeo `_sustReposToCode` (Plus/Garantia/Original/Alternativo/default)
- Normalizacion de montos del PDF (`"10,000,000.00"` → `"10000000"`)

Wrapper E2E: `C:/tmp/pdf-test/test-e2e-explicador-url.js` — pipeline completo con PDF real (Silvia BRK454).

**Backup del React+Babel anterior:** `explicacion/index-react-old.html` (no se sirve, queda como referencia).

**Bug critico encontrado durante e2e (fixed antes de deploy):** `pdf-extract.js` devuelve montos con formato CR ("10,000,000.00"). Sin normalizacion, `parseInt('10,000,000.00')` → `10` y `Number('570,891.00')` → `NaN`, mostrando ₡10 y ₡NaN en produccion. Fix: `num()` helper en `_buildGuideUrl` strip-ea comas y `.00` antes del encode.

**Commits del checkpoint** (rango con `feat(explicador):`, `test(explicador):`, `style(explicador):`, `refactor(explicador):`, `fix(explicador):`):
- `13085d4` test(explicador): contract test for buildExplicadorURL
- `ac9561c` feat(explicador): _buildGuideUrl accepts client+cotizacion data (11 params)
- `f0850b7` feat(explicador): _sustReposToCode helper for sr param
- `bcd9c78` style(explicador): _sustReposToCode regex matches sister _sustitucionText (escape form)
- `62a9d32` feat(explicador): buildEmail passes client+cotizacion data to guide URL
- `cb83d88` refactor(explicador): extract guideUrl const + NFD normalize in _detectVehicleType
- `8aceb4f` feat(explicador): pass plate/year/valor/vehicleType from app.js to buildEmail
- `4bfef48` feat(explicador): scaffold v2 vanilla HTML+CSS+JS (replaces React+Babel)
- `a9af7a3` feat(explicador): URL params drive personalization (greeting/vehicle/plan/sr/prices)
- `b31c89a` feat(explicador): restaurar social proof (★★★★★ + miles de conductores) en cierre
- `7b899be` refactor(explicador): bubble-vehicle span replaces fragile string-replace
- `0692317` fix(explicador): normalizar montos del PDF (10,000,000.00 → 10000000) en URL params

**Pendiente fase 2 (no en este plan):** modernizacion visual del correo (`email-template.js` HTML del cuerpo). Este plan solo extendio el URL del CTA.

### 23 abril 2026 — Calculadora de cancelacion anticipada (`/cancelacion/`)
Nueva pagina standalone en `cancelacion/index.html` que implementa la Clausula 33 de las
Condiciones Generales del Seguro Voluntario de Automoviles del INS.

**Campos del formulario:**
- Nombre del cliente, Correo del cliente (para envio), Numero de poliza, Placa
- **Fecha de emision** (fin de vigencia se calcula automatico = emision + 1 año)
- Fecha de cancelacion
- Prima pagada (₡) — lo que el cliente pago en su periodo (semestral, trimestral, etc.)
- Forma de pago (solo informativo, NO multiplica), Motivo/nota opcional

**Dos escenarios de calculo (Clausula 33):**

1. **≤ 5 dias naturales desde emision:** 100% devolucion, sin cargos.
2. **> 5 dias:** tabla de factores Clausula 33, aplicada sobre la **prima pagada**.
   - `idx = Math.min(monthsComplete(emission, cancel), 11)`
   - Si meses < 6: `factor_efectivo = factor_tabla × 50%`
   - Si meses ≥ 6: `factor_efectivo = factor_tabla`
   - `prima_devengada = prima_pagada × factor_efectivo`
   - `devuelta = prima_pagada - prima_devengada`

**REGLA CLAVE — prima pagada, NO prima anual:**
El campo prima = lo que el cliente efectivamente pago en su periodo de pago.
Para un cliente semestral en el primer semestre: ingresa 175.525 (no 351.050).
El calculo se hace sobre ese monto. Si el cliente pagara el segundo semestre en
septiembre, ese es un pago futuro que aun no realizo — no entra al calculo.
NO se multiplica por el numero de periodos (esto era el bug anterior).

**Recargos por fraccionamiento (GUIA SUSCRIPCION 2025, pag. 9):**
SVA Colones: Semestral 8%, Trimestral 11%, Mensual 13%.
Estos recargos estan incluidos en la prima que pago el cliente. La Clausula 33
no hace distincion explicita — se aplica el factor sobre el monto total pagado
(prima neta + recargo). Si en el futuro se requiere separar el recargo, agregar
campo opcional para descontarlo antes de aplicar el factor.

**Tabla de factores Clausula 33 (12 filas):**
```
Hasta 1 mes             → 40%   (idx 0)
Mas de 1 a 2 meses      → 48%   (idx 1)
Mas de 2 a 3 meses      → 55%   (idx 2)
Mas de 3 a 4 meses      → 62%   (idx 3)
Mas de 4 a 5 meses      → 68%   (idx 4)
Mas de 5 a 6 meses      → 75%   (idx 5)
Mas de 6 a 7 meses      → 79%   (idx 6)
Mas de 7 a 8 meses      → 84%   (idx 7)
Mas de 8 a 9 meses      → 89%   (idx 8)
Mas de 9 a 10 meses     → 93%   (idx 9)
Mas de 10 a 11 meses    → 96%   (idx 10)
Mas de 11 a 12 meses    → 100%  (idx 11)
```
Seleccion: `idx = Math.min(monthsComplete(start, cancel), 11)`.
`monthsComplete(a, b)`: meses calendario completos; si `b.getDate() < a.getDate()`, se resta 1.

**Envio de informe al cliente (Gmail):**
- La pagina importa `../js/config.js`, `state.js`, `agent-profile.js`, `gmail-auth.js`, `mime-builder.js`
- Llama `applyProfile(loadProfile())` al inicio para usar los datos del agente de localStorage
- `buildMIMESimple({to, from, subject, html})` — version HTML-only de buildMIME (sin adjunto PDF)
- `buildCancelEmail(calc)` — genera el HTML del informe: header navy+logo INS, datos poliza,
  monto destacado en verde, tabla de detalle, disclaimer, footer con datos del agente
- `handleSend()` usa `getToken()` + `sendEmail(raw)` (mismo flujo que cotizador principal)
- Boton "Enviar informe" aparece en el resultado SOLO si se ingreso correo del cliente

**Bug critico resuelto: parsePremium y locale es-CR**
El blur handler formatea el campo prima a formato es-CR ("570.891,00" = 570,891 colones).
Si `parsePremium` usaba solo `parseFloat(s.replace(/[^\d.]/g,''))`, el comma se strippeaba
convirtiendo "570.891,00" en "57089100" (×100). Solucion con parser inteligente:
```javascript
function parsePremium(s) {
  let v = s.replace(/[^\d.,]/g, '');
  const lastDot = v.lastIndexOf('.');
  const lastComma = v.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // ambos: el posterior es decimal
    if (lastComma > lastDot) v = v.replace(/\./g,'').replace(',','.');  // es-CR
    else                     v = v.replace(/,/g,'');                    // English
  } else if (lastComma >= 0) {
    const after = v.slice(lastComma + 1);
    v = after.length !== 3 ? v.replace(',','.') : v.replace(/,/g,'');
  } else if (lastDot >= 0) {
    const after = v.slice(lastDot + 1);
    if (after.length === 3) v = v.replace(/\./g,'');
  }
  return parseFloat(v) || 0;
}
```

**Link desde el cotizador principal:**
`index.html` header: boton 🧮 (`.header-btn` como `<a>`) apunta a `cancelacion/`.

**Commits:**
- `69001c9` feat(cancelacion): nueva pagina calculadora de cancelacion anticipada Clausula 33 + link header
- `4b0d381` fix(cancelacion): label dinamico por forma de pago + tabla Clausula 33 siempre visible
- `d09e637` style(cancelacion): tabla Clausula 33 en correo con fondo navy oscuro igual que la app
- `3185ebe` fix(cancelacion): fecha emision unica + calculo sobre prima pagada sin multiplicar

### 20 abril 2026 — Fix link del formulario de cita (dos botones) + override localStorage
- **Juan Carlos reporto** que el boton "Agendar mi cita ahora" del correo
  apuntaba al formulario viejo. Hay DOS botones con ese texto: (1) en la
  plantilla del correo (via `CFG.AGENDA_URL`) y (2) en `/explicacion/` (hardcoded).
- **Link viejo:** `https://forms.gle/NJB5s3zRQ7Hdv1xe7`
- **Link nuevo:** `https://forms.gle/tqSaZBDcZfNgNktC7`
- **Archivos modificados:**
  - `js/config.js:15` — `AGENDA_URL`
  - `explicacion/index.html:395` — `href` del CTA verde
- **Commit:** `6a024e3` fix(agenda): actualizar link del formulario de cita
- **GOTCHA importante:** `agent-profile.js:87` hace `if (p.agendaUrl) CFG.AGENDA_URL = p.agendaUrl;`
  Es decir, si el agente ya tiene guardado un `agendaUrl` en `localStorage['cotizador_sdi_agent_v1']`,
  ese valor **sobrescribe** el del `config.js` al cargar la app. Por eso JC seguia viendo el link
  viejo en el correo aunque el commit ya estaba desplegado.
- **Fix para el agente:** abrir la app → ⚙ → actualizar campo "Link del formulario de cita"
  → Guardar. Esto actualiza el localStorage.
- **IMPLICACION futura:** cualquier cambio a un default en `config.js` que el perfil tambien sobrescriba
  (FROM_NAME, WEBSITE, AGENDA_URL) requiere que cada agente actualice SU perfil manualmente.
  El codigo del repo no puede forzar el cambio.

### 20 abril 2026 — Sitio duplicado en Netlify (pendiente borrar)
- Juan Carlos creo por error un segundo sitio Netlify: `cotizador-autos-sdi.netlify.app`
- **NO esta en la lista de origenes autorizados de OAuth Google** → login rechazado con
  `Error 400: redirect_uri_mismatch` si se intenta usar.
- **Accion:** JC debe borrar el sitio duplicado desde app.netlify.com → Site configuration
  → General → Danger zone → Delete this site.
- **URL oficial unica:** `https://cotizador-segurosdigitalesins-sdi.netlify.app`

### 15 abril 2026 — Soporte Outlook completo
- **Hermano de Juan Carlos** usa Outlook en su oficina (no quiere abrir Gmail).
- Se implemento MSAL.js 2.x + Microsoft Graph API para envio desde Outlook.
- Selector de proveedor (radio Gmail/Outlook) en modal ⚙ del agente.
- Azure App registrada: "Cotizados SDI Outlook"
  - Application (client) ID: `70998ed5-2c92-4aba-b7e7-fb53b083f472`
  - Directory (tenant) ID:   `93b104e6-35e1-476f-a6a9-6ca8ef7f1928`
  - Redirect URI: SPA → https://cotizador-segurosdigitalesins-sdi.netlify.app
  - Tipos de cuenta: organizativas + personales Microsoft (opcion 3)
- Nuevos archivos: `outlook-auth.js`, `outlook-sender.js`
- Proveedor guardado en localStorage junto al perfil del agente.

### 15 abril 2026 — Fix mojibake + ajustes de contenido
- **Fix critico RFC 2047 en From:** `_encodeFromHeader()` en mime-builder.js
  codifica el nombre del agente como `=?UTF-8?B?...?=` si tiene no-ASCII.
  Sin esto "Hernández" aparecia como "HernÃƒÂ¡ndez" en Gmail.
- **Beneficios:** "Multiasistencia extendida" → "10% de descuento en pago anual".
- **Notas:** Uber/DiDi ahora dice "NO cubre actividades de UBER o similares".
- **Logo INS** en header del correo (URL externa Netlify, no base64).

### 14 abril 2026 — Multi-agente
- localStorage + misma URL Netlify (sin backend, sin multiples deploys).
- Cada agente configura una vez en su navegador via ⚙.
- `agent-profile.js`: `saveProfile / loadProfile / applyProfile / clearProfile / isFirstTime`.

## Proposito
App web interna que automatiza el envio de cotizaciones de automoviles
INS a clientes. Flujo de 3 clicks: subir PDF → revisar → enviar.

## Infraestructura
- **URL produccion:** https://cotizador-segurosdigitalesins-sdi.netlify.app
- **Explicador integrado:** https://cotizador-segurosdigitalesins-sdi.netlify.app/explicacion/
- **Repo:** jhernandez-vibecode/COTIZADOR-AUTOS (GitHub, PRIVADO, branch main)
- **Deploy:** automatico GitHub → Netlify (1-2 min)
- **Owner email:** jhernandez@segurosdelins.com (Juan Carlos Hernandez Vargas, licencia SUGESE 08-1318)
- **Owner phone:** 8822-1348

## Stack (sin npm, sin build)
```
PDF.js  3.11.174  → https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
                     worker: pdf.worker.min.js (mismo CDN)
pdf-lib 1.17.1   → https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js
Google Identity  → https://accounts.google.com/gsi/client  (async defer)
MSAL.js 2.38.3   → https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js  (async defer)
Tailwind CDN     → https://cdn.tailwindcss.com
Google Fonts     → Sora (display + cuerpo)
```

## OAuth Google (proyecto compartido con SASINS)
- **Client ID:** `446215450096-6edmqnq4u9dg8hr9nd620mgcl6rv182m.apps.googleusercontent.com`
- **Nombre Google Cloud:** "Cotizador Autos SDI"
- **Proyecto:** Sistema-Seguros Vencimientos
- **Origin autorizado:** `https://cotizador-segurosdigitalesins-sdi.netlify.app`
- **Scope:** `https://www.googleapis.com/auth/gmail.send`
- **Pantalla consentimiento:** modo Testing → invitar agentes nuevos
  agregando su correo Gmail como Test User en
  https://console.cloud.google.com/apis/credentials/consent

## OAuth Microsoft (Azure)
- **Application (client) ID:** `70998ed5-2c92-4aba-b7e7-fb53b083f472`
- **Directory (tenant) ID:**   `93b104e6-35e1-476f-a6a9-6ca8ef7f1928`
- **Authority:** `https://login.microsoftonline.com/common` (personal + organizativo)
- **Redirect URI:** SPA → `https://cotizador-segurosdigitalesins-sdi.netlify.app`
- **Scope:** `https://graph.microsoft.com/Mail.Send`
- **Lib:** MSAL.js 2.x via CDN (`window.msal.PublicClientApplication`)

## Arquitectura de archivos
```
COTIZADOR-AUTOS/
├── README.md
├── .gitignore
├── index.html              ← Shell: header sticky + step-nav 4 pasos + 4 vistas + modal config
├── css/
│   └── styles.css          ← Variables marca, drop-zone, step-dots, precios, modal, btn, radio-group
├── img/
│   └── ins-logo.png        ← Logo INS para el header del correo
├── js/
│   ├── config.js           ← CFG: client_id, MSAL_CLIENT_ID, FROM_NAME/EMAIL/PHONE/LICENSE/WEBSITE, URLs
│   ├── state.js            ← S: { step, data, modPDF, accessToken, tokenClient, msalInstance, outlookToken, provider, prevTimer }
│   ├── agent-profile.js    ← localStorage: load/save/apply/clear/isFirstTime + campo provider
│   ├── router.js           ← showView(n), updateStepNav(n)
│   ├── pdf-extract.js      ← extractData(arrayBuffer) → objeto con todos los campos
│   ├── pdf-modify.js       ← modifyPDF(ab, rowsToRemove, pageWidth) → Uint8Array
│   ├── email-template.js   ← buildEmail(params) → string HTML del correo
│   ├── gmail-auth.js       ← initTokenClient, getToken, clearToken, sendEmail (Gmail API)
│   ├── mime-builder.js     ← buildMIME({to,from,subject,html,pdfBytes,filename}) → base64url
│   ├── outlook-auth.js     ← initMSAL, getOutlookToken, clearOutlookToken (MSAL)
│   ├── outlook-sender.js   ← sendOutlookEmail({to,subject,html,pdfBytes,filename}) (Graph API)
│   └── app.js              ← Eventos UI, orquestacion, populate, modal handlers, provider bifurcacion
├── cancelacion/            ← Calculadora de cancelacion anticipada (standalone)
│   └── index.html          ← HTML+JS autocontenido, importa ../js/* para envio Gmail
└── explicacion/            ← Explicador visual integrado (link del correo)
    ├── index.html          ← React standalone (Babel CDN)
    └── INS BLANCO.png
```

### Orden de carga JS en index.html (CRITICO — no cambiar)
```
config.js → state.js → agent-profile.js → router.js → pdf-extract.js →
pdf-modify.js → email-template.js → gmail-auth.js → mime-builder.js →
outlook-auth.js → outlook-sender.js → app.js
```

## Flujo de 4 pasos (UX)

### Paso 1 - Cargar PDF
- Drop zone + file input (acepta solo PDF)
- Al seleccionar: progress bar 4 fases (10%→35%→65%→100%)
- handleFileSelect: extractData() → modifyPDF() → populate() → showView(2)

### Paso 2 - Revisar datos (layout 2 columnas)
**Columna izquierda - Formulario (9 campos):**
- N° Cotizacion (readonly)
- Nombre del cliente (readonly, extraido del PDF)
- **Correo del cliente** (REQUERIDO, manual - no esta en el PDF)
- Descripcion del vehiculo (editable, pre-llenado tipo+año)
- Placa, Año, Valor Asegurado (readonly)
- Forma de Aseguramiento (readonly)
- Sustitucion de Repuestos (readonly)
- **Interes Asegurable** (desplegable opcional):
  - Propietario Registral
  - Vehiculo Cero Kilometros (en proceso de compra)
  - En proceso de traspaso
  - En proceso de compra

**Columna derecha - Precios y PDF:**
- Tabla 5 filas con visual de eliminados:
  - ~~Mensual~~ → fondo rojo, tachado, badge "ELIMINADO"
  - Trimestral → visible
  - Semestral → visible
  - Anual → fondo verde con badge "(-10%)"
  - ~~Deduccion Mensual~~ → eliminado igual que mensual
- Deducibles extraidos del PDF (lista)
- Boton "Descargar" del PDF modificado (Blob + objectURL)

### Paso 3 - Redactar correo (layout 2 columnas)
**Columna izquierda - Configuracion:**
- Para (correo cliente, editable)
- Asunto (pre-llenado: "Oferta Seguro Automoviles - Placa XXXX")
- Nombre en saludo (primer nombre capitalizado)
- Vehiculo
- Nota personal opcional (textarea)
- Pill con nombre del PDF adjunto
- Boton "Autorizar Gmail y Enviar" o "Autorizar Outlook y Enviar" (dinamico)

**Columna derecha - Vista previa LIVE:**
- Iframe con srcdoc del HTML del correo
- Se actualiza al escribir (debounce 300ms)

### Paso 4 - Exito
- Checkmark verde, mensaje confirmacion con correo destino
- Boton "Enviar otra cotizacion" → resetAll() → showView(1)

## Modal de Configuracion del agente (⚙)
Boton ⚙ en el header. Form con 6 campos:
- Nombre completo (required, min 2 palabras)
- Correo (required, regex email — label cambia segun proveedor seleccionado)
- Telefono (required)
- Licencia SUGESE (required)
- **Sitio web (opcional)** — si vacio, se omite del footer del correo
- **Link formulario de cita** (required, Google Forms u otro)
- **Proveedor de correo** (radio): 📧 Gmail (Google) | 📨 Outlook / Microsoft 365

Modo "primer uso": modal aparece automaticamente, hint amarillo de bienvenida,
botones cerrar/cancelar OCULTOS (obligatorio configurar antes de usar).

## Proveedor de correo (Gmail vs Outlook)

### Flujo Gmail
1. `getToken()` → popup Google si no hay token → S.accessToken (cache 1h)
2. `buildMIME({...})` → string base64url multipart/mixed
3. `sendEmail(raw)` → POST `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`

### Flujo Outlook
1. `getOutlookToken()` → acquireTokenSilent; si falla → acquireTokenPopup → S.outlookToken
2. No se construye MIME. El cuerpo es JSON puro:
   ```json
   {
     "message": {
       "subject": "...",
       "body": { "contentType": "HTML", "content": "..." },
       "toRecipients": [{ "emailAddress": { "address": "..." } }],
       "attachments": [{
         "@odata.type": "#microsoft.graph.fileAttachment",
         "name": "COTIZACION-XXX.pdf",
         "contentType": "application/pdf",
         "contentBytes": "<base64 del PDF>"
       }]
     },
     "saveToSentItems": true
   }
   ```
3. `sendOutlookEmail({...})` → POST `https://graph.microsoft.com/v1.0/me/sendMail` (devuelve 202)

### Conversion Uint8Array → base64 (outlook-sender.js)
```javascript
// Chunks de 8192 para no saturar el call stack con PDFs grandes
let binary = '';
const CHUNK = 8192;
for (let i = 0; i < bytes.length; i += CHUNK) {
  binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
}
const pdfBase64 = btoa(binary);
```

### handleSend bifurcacion (app.js)
```javascript
const isOutlook = (S.provider === 'outlook');
if (isOutlook) {
  await getOutlookToken();
  await sendOutlookEmail({ to, subject, html, pdfBytes, filename });
} else {
  await getToken();
  const raw = buildMIME({ to, from, subject, html, pdfBytes, filename });
  await sendEmail(raw);
}
```

## PDF: Extraccion de datos (pdf-extract.js)

### Estrategia
1. PDF.js extrae items con coordenadas (x, y) bottom-up
2. `_groupByY(items, 2)` agrupa items con Y similar (±2px) → reconstruye filas visuales
3. `_findField(rows, regex)` busca patron en cada fila concatenada

### Campos pagina 1
```javascript
quoteNum     ← /(ASINS-\d+-\d+)/i
cotizDate    ← /Fecha de cotizaci[oó]n:\s*(.+?)(?:\s|$)/i
clientName   ← /Nombre completo:\s*(.+)/i
plate        ← /N[uú]mero de placa:\s*([A-Z0-9-]+)/i
year         ← /A[ñn]o veh[ií]culo:\s*(\d+)/i
vehicleType  ← /Tipo de veh[ií]culo:\s*(.+)/i
valor        ← /Valor Asegurado:\s*([\d,]+\.?\d*)/i
sustRepos    ← /Sustituci[oó]n de repuestos:\s*(.+)/i
formaAseg    ← /Forma de Aseguramiento:\s*(.+)/i
```

### Campos pagina 2
```javascript
prices.mensual     ← fila /^Mensual$/i + valor /^[\d,]+\.\d{2}$/
prices.trimestral  ← /^Trimestral$/i + valor
prices.semestral   ← /^Semestral$/i + valor
prices.anual       ← /^Anual$/i + valor
prices.deduccion   ← /^Deducci[oó]n Mensual$/i + valor
deductibles[]      ← lineas que empiezan con /^Cobertura\s/i
rowsToRemove[]     ← [{ y: float, label: string }] para mensual y deduccion
pageWidth          ← p2.view[2] (siempre 612 = Letter US)
pageHeight         ← p2.view[3] (siempre 792)
```

### Validaciones obligatorias (lanzan Error)
- PDF debe tener ≥ 2 paginas
- Debe encontrarse quoteNum, plate y prices.anual

### Normalizacion vehicleType (app.js)
```javascript
// _cleanVehicleType: INS reporta "Rural/Jeep" pero el agente usa solo "Rural"
if (/^Rural\s*\/\s*Jeep$/i.test(t)) return 'Rural';
```

## PDF: Modificacion (pdf-modify.js)

### Tecnica: rectangulos blancos
```javascript
p2.drawRectangle({
  x:           28,                  // X_MARGIN
  y:           row.y - 5,           // Y del item de texto - 5
  width:       pageWidth - 56,      // ancho util
  height:      21,                  // ROW_HEIGHT
  color:       rgb(1, 1, 1),        // blanco
  borderWidth: 0
})
```

### Filas SIEMPRE eliminadas (rowsToRemove de extractData)
1. Mensual + su monto
2. Deduccion Mensual + su monto

### Importante (decision tecnica)
- Los rectangulos solo cubren VISUALMENTE el texto. El texto sigue en el PDF
  subyacente (Ctrl+F lo encuentra). Tecnica aprobada por Juan Carlos para
  envio al cliente.

## Template del correo (email-template.js)

### Estructura HTML (12 secciones)
1. Header navy con **logo INS** + "COTIZACION AUTOMOVILES" + agente + licencia SUGESE
2. Saludo: "ESTIMADO/A: [NOMBRE]" + "VEHICULO: [VEHICULO]"
3. Texto introduccion (fijo)
4. CTA azul: "VER EXPLICACION DE MI COTIZACION" → CFG.GUIDE_URL
5. BENEFICIOS INCLUIDOS (6 items con check verde):
   - Cobertura Total (A,B,C,D,F,H)
   - Indemnizacion del Deducible (IDD)
   - Asistencia 24/7 en carretera
   - 10% de descuento en pago anual
   - Contratacion 100% en linea
   - Exencion de Deducible (Cobertura C)
6. Interes Asegurable (CONDICIONAL, fondo azul claro)
7. Tabla precios (Trim/Sem/Anual con badge -10%)
8. Bloque Sustitucion de Repuestos (texto adaptado, fondo azul claro)
9. Nota agente (CONDICIONAL, fondo naranja)
10. CTA verde: "Agendar mi cita ahora" → CFG.AGENDA_URL
11. Notas importantes (UBER no cubre, valor mercado, sustitucion - fondo amarillo)
12. Footer navy con datos del agente + correo y website (CONDICIONAL website)

### Footer estilos
- Nombre agente: gris claro #cbd5e1 semibold
- Agente/Licencia: gris medio #64748b tenue
- Tel: gris medio (numero en gris claro)
- Correo y Website: celeste brillante #7dd3fc bold + underline (DESTACAN)
- Envueltos en `<a mailto:>` y `<a https://>` para evitar reformateo Gmail

### Mapeos
```javascript
interestMap = {
  propietario: 'Propietario Registral',
  'cero-km':   'Vehiculo Cero Kilometros (en proceso de compra)',
  traspaso:    'En proceso de traspaso',
  compra:      'En proceso de compra'
}

// _sustitucionText(label) - case-insensitive y sin acentos
// "garantia plus"        → "8 anos / 80,000 km"  ← antes que "garantia"
// "garantia"             → "5 anos / 60,000 km"
// "repuesto original"    → "originales en taller multimarca o especializado"
// "repuesto alternativo" → "genericos y/o usados segun disponibilidad"
// default                → "condiciones estandar de sustitucion del INS"
```

## Gmail: Autenticacion (gmail-auth.js)

### Token Model de Google Identity Services
- `initTokenClient()` idempotente, reintenta cada 300ms hasta que GIS cargue
- `getToken()` Promise<string>, popup solo si no hay token cacheado en S.accessToken
- `clearToken()` para forzar nuevo popup (token expirado)
- `sendEmail(raw)` POST a Gmail API. Si 401 → clearToken + error claro

## Outlook: Autenticacion (outlook-auth.js)

### MSAL PublicClientApplication (Token popup model)
- `initMSAL()` idempotente — crea instancia en S.msalInstance
  - clientId: CFG.MSAL_CLIENT_ID
  - authority: `https://login.microsoftonline.com/common`
  - cacheLocation: sessionStorage
- `getOutlookToken()` — intenta silent con cuentas de sessionStorage; si falla → `acquireTokenPopup`
- `clearOutlookToken()` — limpia S.outlookToken

## MIME (mime-builder.js) — solo Gmail

### Estructura multipart/mixed
```
From: "Nombre" <correo>        ← _encodeFromHeader() RFC 2047 si tiene no-ASCII
To: cliente@destinatario.com
Subject: [RFC 2047 si tiene no-ASCII]
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="__cotizador_sdi_<ts>_<rand>"

--<boundary>
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

[HTML del correo]

--<boundary>
Content-Type: application/pdf
Content-Disposition: attachment; filename="COTIZACION-PLACA.pdf"
Content-Transfer-Encoding: base64

[PDF en base64 wrapped a 76 chars/linea]

--<boundary>--
```

### Detalles tecnicos criticos
- Boundary: `__cotizador_sdi_<Date.now()>_<Math.random().toString(36).slice(2)>`
- CRLF como separador (NO solo LF)
- _uint8ToBase64: chunks de 32KB para no saturar el call stack
- _base64UrlEncode: `unescape(encodeURIComponent(...))` para UTF-8 + replace `+/=` por `-_<vacio>`
- **_encodeFromHeader:** parsea `"Nombre" <email>` y codifica SOLO el nombre
  en `=?UTF-8?B?...?=` si tiene caracteres no-ASCII.

## Multi-agente (agent-profile.js)

### Datos en localStorage (`cotizador_sdi_agent_v1`)
```javascript
{
  name:      string,   // required
  email:     string,   // required, debe coincidir con cuenta del proveedor elegido
  phone:     string,   // required
  license:   string,   // required
  website:   string,   // opcional — '' omite el bloque del footer
  agendaUrl: string,   // required — link Google Forms, Calendly, etc.
  provider:  string    // 'gmail' (default) | 'outlook'
}
```

### applyProfile(p) sobrescribe CFG y S
- CFG.FROM_NAME  ← p.name
- CFG.FROM_EMAIL ← p.email
- CFG.PHONE      ← p.phone
- CFG.LICENSE    ← p.license
- CFG.WEBSITE    ← p.website (puede ser '' para ocultar)
- CFG.AGENDA_URL ← p.agendaUrl (solo si no vacio)
- S.provider     ← p.provider || 'gmail'

### Para invitar a un nuevo agente (Gmail)
1. Agregar su correo como Test User en
   https://console.cloud.google.com/apis/credentials/consent
2. El agente abre la URL Netlify → modal de bienvenida → llenar perfil → seleccionar Gmail → guardar

### Para un agente con Outlook
1. El agente abre la URL Netlify → modal de bienvenida
2. Llena su nombre, correo Outlook, telefono, licencia
3. Selecciona "📨 Outlook / Microsoft 365"
4. Guarda → ya puede enviar desde su cuenta Microsoft (popup la primera vez)

## CONFIG (config.js)
```javascript
const CFG = {
  // Gmail
  CLIENT_ID:      '446215450096-6edmqnq4u9dg8hr9nd620mgcl6rv182m.apps.googleusercontent.com',
  GMAIL_SCOPE:    'https://www.googleapis.com/auth/gmail.send',
  GMAIL_SEND_URL: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',

  // Outlook / Microsoft
  MSAL_CLIENT_ID:   '70998ed5-2c92-4aba-b7e7-fb53b083f472',
  OUTLOOK_SCOPE:    'https://graph.microsoft.com/Mail.Send',
  OUTLOOK_SEND_URL: 'https://graph.microsoft.com/v1.0/me/sendMail',

  // Identidad del remitente (sobrescribible por perfil)
  FROM_NAME:   'Juan Carlos Hernandez Vargas',
  FROM_EMAIL:  'jhernandez@segurosdelins.com',
  PHONE:       '8822-1348',
  LICENSE:     '08-1318',
  WEBSITE:     'www.segurosdelins.com',  // opcional

  // URLs usadas en el correo
  GUIDE_URL:   'https://cotizador-segurosdigitalesins-sdi.netlify.app/explicacion/',
  AGENDA_URL:  'https://forms.gle/tqSaZBDcZfNgNktC7',
  LOGO_URL:    'https://cotizador-segurosdigitalesins-sdi.netlify.app/img/ins-logo.png',

  // Worker PDF.js
  PDFJS_WORKER: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};
```

## Estado global (state.js)
```javascript
const S = {
  step:         1,        // 1..4
  data:         null,     // resultado de extractData()
  modPDF:       null,     // Uint8Array del PDF limpiado
  accessToken:  null,     // token OAuth Gmail (1h)
  tokenClient:  null,     // instancia GIS
  msalInstance: null,     // instancia MSAL (Outlook)
  outlookToken: null,     // token OAuth Microsoft
  provider:     'gmail',  // 'gmail' | 'outlook' — se carga del perfil
  prevTimer:    null      // debounce de vista previa
};
```

## Diseno Visual (styles.css)
```css
--navy:       #0c2340   /* Header, footer, textos principales */
--blue:       #0369a1   /* Botones, acentos */
--blue-light: #0ea5e9   /* Progress, highlights */
--green:      #16a34a   /* Boton enviar, precio anual */
--amber:      #d97706   /* Notas */
--red:        #dc2626   /* Filas eliminadas */
font-family:  'Sora', sans-serif

/* Radio group para selector de proveedor */
.radio-group    → flex, gap 12px, flex-wrap
.radio-option   → flex, padding 10px 16px, border 2px solid gray-200, cursor pointer
.radio-option:has(input:checked) → border blue, background #eff6ff, color blue
```

## Reglas de desarrollo

### Flujo obligatorio
1. Codigo en `C:/tmp/COTIZADOR-AUTOS/` (clone temporal)
2. **Paths absolutos `C:/...` SIEMPRE** (Bash y Write resuelven `/tmp` distinto en Windows)
3. `node --check archivo.js` antes de cualquier commit
4. Commit con mensaje descriptivo + Co-Authored-By Claude
5. Push con autorizacion explicita de Juan Carlos
6. Netlify deploya en 1-2 min

### Errores a evitar
- NO usar `\n` dentro de template literals con onclick → rompe JS
- NO hardcodear coordenadas Y del PDF → usar extraccion dinamica via _groupByY
- NO olvidar `pdfjsLib.GlobalWorkerOptions.workerSrc` al inicializar PDF.js
- El PDF de cotizacion INS siempre tiene 2 paginas; verificar antes de operar pagina 2
- MIME multipart: el boundary NO puede aparecer dentro del contenido base64
- El token de Gmail dura 1 hora; si expira al enviar, limpiar con clearToken()
- MSAL: acquireTokenSilent falla si no hay cuenta en sessionStorage → caer a acquireTokenPopup
- Comparar sustitucion de repuestos case-insensitive (PDF dice "garantia plus" minuscula)
- Mantener orden estricto de carga JS en index.html (ver seccion "Orden de carga")

### Testing en Node
Wrapper en `C:/tmp/pdf-test/` con pdfjs-dist + pdf-lib instalados.
Usa `vm.runInContext` con sandbox que polyfilla:
- window.pdfjsLib, window.PDFLib (libs como globals + propiedad de window)
- btoa/atob (Buffer.from)
- localStorage (objeto en memoria con get/set/remove)

## Historial completo de commits (18 commits)

```
b301934  init: estructura base + shell visual + explicador integrado
b23a166  fix(config): usar Client ID OAuth real
1b03190  feat(router): showView + updateStepNav
c0e0ca7  feat(pdf-extract): extraccion del PDF INS                ⭐ TESTEADO
df788b3  feat(pdf-modify): tapar Mensual + Deduccion Mensual      ⭐ TESTEADO
f623768  feat(email-template): HTML del correo                    ⭐ APROBADO
06e92e7  feat(gmail+mime): OAuth + MIME multipart                 ⭐ TESTEADO
a0a800e  feat(app): orquestacion completa end-to-end              ⭐ FINAL
9db55e6  style(email): footer mas tenue (correo y web destacan)
25c4bd4  feat(profile): perfil multi-agente via localStorage      ⭐ MULTI-AGENTE
4921120  feat(profile): sitio web tambien editable por agente
0c1437f  feat(email): logo INS en el header del correo            ⭐ BRANDING
46c7ab4  fix(email): mojibake en From + ajustes de contenido      ⭐ ANTI-SPAM
0117a57  feat(profile): link agenda editable + rural/jeep fix     ⭐ AJUSTE CAMPO
71de232  feat(outlook): soporte Outlook/Microsoft 365 via MSAL    ⭐ OUTLOOK
6a024e3  fix(agenda): actualizar link del formulario de cita      ⭐ LINK NUEVO
[checkpoint 20 abr 2026]
[pendiente]  feat(cancelacion): calculadora Clausula 33 + boton en header  ⭐ NUEVA FEATURE
[pendiente]  docs(skill): sync SKILL_COTIZADOR_SDI.md checkpoint 23 abr
[checkpoint 23 abr 2026]
```

## Pendientes
1. **Probar Outlook end-to-end:** hermano de Juan Carlos configura perfil con su correo
   Microsoft, selecciona "Outlook", envia primera cotizacion → verificar que llega con PDF.
2. **Configurar SPF/DKIM en segurosdelins.com** (pendiente): si Juan Carlos comparte
   donde esta hosteado el dominio, configurar para mejorar entregabilidad Gmail.
3. **Considerar publicar la app** en Google Cloud (sale del modo Testing) si el numero
   de agentes crece a 5+ — elimina limite de 100 Test Users y el "App no verificada".

## Contexto del agente
- Juan Carlos Hernandez Vargas, agente INS, licencia SUGESE 08-1318
- Solo agente, oficina pequeña, no programador
- Necesita codigo completo y listo para copiar, sin snippets parciales
- Stack: HTML/JS puro, Tailwind CDN, sin frameworks ni npm
- Prefiere respuestas directas sin rodeos
- Email: jhernandez@segurosdelins.com · Tel: 8822-1348
