# Spec aprobada — Módulo "Renovación Confirmada" (/renovaciones/)

**Estado: APROBADO PARA PRODUCCIÓN por JC el 10 ago 2026** ("Aprobado para producción con estos ajustes"), tras dossier de mockups presentado y revisado (regla del 6 ago: mockups ANTES de push — cumplida). Los textos de esta spec están aprobados **palabra por palabra**: no cambiarlos sin OK de JC.

## Qué es

Tercer módulo de envío del cotizador (cotización → póliza activa → **renovación confirmada**). El agente carga el **Comprobante de Pago del INS ya PAGADO** (form `INS-F-1011060`), la app extrae los datos, y envía al cliente un correo de **confianza y servicio** (no de cobro): confirmación del pago con el comprobante adjunto, mini-guía de qué hacer ante un evento, asistencias vigentes, enlace a la guía de emergencias, cross-sell. Después, aviso por WhatsApp con enlace corto.

Espejo arquitectónico de `/polizas-activas/`: wizard 4 pasos (Cargar comprobante → Revisar datos → Redactar → Enviado + WhatsApp), multi-agente por perfil ⚙, Gmail API.

## Las 7 decisiones cerradas por JC (10 ago 2026)

| # | Decisión | Resolución de JC |
|---|---|---|
| D1 | Extracción del PDF | **SÍ, extracción directa** con campos siempre editables por si el parser lee mal |
| D2 | Orden vista 4 | Primero correo con el recibo, después WA → botones **1 = Enviar otro comprobante, 2 = Avisar por WhatsApp** (como Pólizas Activas) |
| D3 | Fondo de pantalla | **Mantener el estándar del cotizador**: clase propia `body.page-renovacion` con tinte crema tenue `#FDF6EC` (verde=cotizar, azul=póliza, crema=renovación). Solo el body; tarjetas blancas |
| D4 | Cross-sell | **SÍ, siempre** (Viaje + Estudiantil): "aunque es de confianza, a veces solo le enviamos algo una o dos veces al año". Mismo bloque del correo de póliza activa (por CFG, fallback al sitio del agente) |
| D5 | Nombre | **"Renovación confirmada"** (rail y título) |
| D6 | Textos | Aprobados, incluido el asunto. Recuadro naranja: **"Nota de su agente"** (usted). *(Pendiente menor aparte: unificar "Nota de tu agente"→"su" en email-template.js:93 y poliza-email.js:171 — preguntar a JC antes)* |
| D7 | Estado ≠ Pagado | **BLOQUEO**: este módulo es SOLO para recibos ya pagados. Sin `Estado: Pagado` en el PDF, la app lo dice y no deja enviar. La insignia PAGADO jamás se pinta sobre otro estado |

## Ajustes de JC sobre el mockup (ya incorporados a los textos de abajo)

1. **El párrafo "Adjunto encontrará…" va en renglón aparte** dentro del bloque verde, con espacio — no un solo bloque de texto (`<p style="margin:10px 0 0;">`).
2. **Logo SDI: usar el último actualizado (v1.1, 7 ago 2026)** — en el footer del correo, el wordmark "SDI" + **4 franjas** blancas (no 3) recreadas en HTML+tablas (Gmail bloquea SVG). En la página del módulo, el `.brand-mark` SVG oficial que ya usa `polizas-activas/index.html`.
3. **Cross-sell siempre** (ver D4).

## Textos aprobados

**Asunto (prellenado, editable en vista 3):**
`✅ Su renovación está confirmada · Póliza {POLIZA}`

**Correo — estructura de bloques** (mismo esqueleto de tablas anidadas + estilos inline de `buildPolizaActivaEmail`; INS arriba, SDI al pie; registro usted, sin "Estimado/a"):

1. **Header navy** + logo INS (CFG.LOGO_URL) + H1 "Su renovación está confirmada" + sub "Seguros del INS · Su protección al volante".
2. **Saludo** "Hola {NOMBRE_PILA}," + **bloque verde**: "Es un gusto saludarle. Le confirmo que el pago de la renovación de su póliza No. **{POLIZA}** fue aplicado correctamente y su vehículo placa **{PLACA}** continúa protegido, sin interrupciones." + párrafo aparte: "Adjunto encontrará el comprobante de pago oficial del INS. ✅"
3. **Tarjeta navy del comprobante** (borde inferior dorado #C9A227): insignia verde "PAGADO", "MONTO PAGADO" + monto grande formato es-CR, "Incluye IVA · Comprobante Nº {NUM_COMPROBANTE}", y 4 datos: Póliza · Placa · **Período pagado** {DESDE} → {HASTA} · Fecha de pago. ⚠️ Decir siempre "período pagado", NUNCA "vigencia anual" (el comprobante puede ser trimestral/semestral).
4. **"🚨 ¿Qué hacer si ocurre un evento?"** — 3 pasos numerados:
   - **01 Primero, las personas** — "Si hay personas lesionadas, llame de inmediato al **911**."
   - **02 Reporte el accidente de una vez** — "Llame a Colisiones del INS al **800-800-8000** para que le envíen un inspector. Y muy importante: **nunca haga acuerdos con terceros** sin la autorización previa del INS — eso protege la validez de su cobertura."
   - **03 ¿Avería en carretera?** — "Su asistencia 24/7 está al **800-800-8001**: grúa, cerrajería, cambio de llanta, paso de corriente y envío de combustible. El alcance de su plan, según la antigüedad de su vehículo, está en su guía." (SIN cantidades por plan — dependen de la antigüedad.)
5. **Bloque cyan CTA**: "Todo esto, paso a paso y a un clic" + "Guarde su guía de emergencias: en el momento del evento le dice qué hacer y le conecta con el contacto correcto al instante." + botón "📱 Abrir mi guía de emergencias →" (URL **LARGA** de `polizaAsistenciaUrl()` — el correo nunca depende del acortador) + tip "Añadir a pantalla de inicio".
6. **Nota de su agente** (ámbar naranja, opcional — solo si el agente escribe algo).
7. **Cross-sell** "Otros seguros que le pueden interesar": Viaje ✈️ + Estudiantil 🎓 — clonar el bloque de `buildPolizaActivaEmail` (CFG.XSELL_*, fallback al sitio del agente, botón oculto si no hay URL).
8. **Firma**: "Gracias por renovar su confianza. Quedo a su disposición para cualquier consulta. Atentamente," + agente/licencia/tel/correo/web por CFG.
9. **Footer SDI navy**: wordmark "SDI" + **4 franjas blancas** (v1.1) en tablas + "Plataforma de Seguros Digitales SDI®" + copyright.

Sin bloque de pago, sin fecha límite, sin métodos de pago — el cliente ya pagó.

**WhatsApp** (endpoint `web.whatsapp.com/send/`, NUNCA wa.me; ~480 chars con enlace corto):

```
¡{NOMBRE_PILA}, su renovación está confirmada! ✅🚗

Le acabo de enviar a su correo el comprobante de pago oficial del INS. Su póliza {POLIZA} (placa {PLACA}) continúa activa y su vehículo protegido, sin trámites pendientes.

Recuerde: ante un accidente o avería, repórtelo de inmediato. En esta guía tiene los pasos a seguir y los números de asistencia 24/7 a un clic:

👉 {ENLACE_CORTO_/a/}

Gracias por renovar su confianza. Estoy para servirle. 🛡️
```

Sin póliza o sin placa, la línea/paréntesis se adapta (nada queda colgando — patrón `buildPolizaWaUrl`). Enlace: `acortarEnlace(polizaAsistenciaUrl(), 'a')` al hacer clic, `window.open('')` ANTES del await, href con la URL larga como red de seguridad. El tipo `/a` ya existe — **cero cambios en la Netlify Function**.

## Parser (js/renovacion-extract.js)

Comprobante de Pago INS, form `INS-F-1011060`: **1 página exacta, A4 595×842 pt** (NO Letter — no copiar el guard de la cotización), texto 100% extraíble con PDF.js (mismo pipeline de coordenadas de la casa).

Anclas verificadas contra 2 comprobantes reales (10 ago 2026):
- `Comprobante de Pago Nº` → nº (formato `R` + fecha + secuencia)
- `Nombre del asegurado:` → cliente en orden **APELLIDO APELLIDO NOMBRE(S)** → saludo = tercer token capitalizado (gotcha #19)
- `Estado:` → **guard BLOQUEANTE**: si ≠ "Pagado", mensaje claro y no se permite enviar (D7)
- Póliza: `/0(101|121)AUT\d+/`
- **Placa**: entre paréntesis bajo el nº de póliza, con relleno variable (muestras reales: `00000BRJ665` → BRJ665; `PAR00ZZS111` → ZZS111). Limpiar relleno y tomar sufijo `[A-Z]{3}\d{3}`; si el formato es otro (placas numéricas viejas, CL, motos) → campo vacío para digitar, sin bloquear
- Vigencia `Desde`/`Hasta` → **período pagado** (puede ser trimestral/semestral)
- `Fecha de Pago:` → fecha
- `TOTAL A PAGAR:` → monto (el PDF lo trae formato US `₡92,555.00`; mostrar en es-CR con el `fmt` de la casa)
- El PDF NO trae marca/modelo ni correo/teléfono del cliente → vehículo opcional manual; correo obligatorio digitado; teléfono WA opcional en vista 4

**Validación**: los 2 PDF reales están en `C:\Users\segur\Downloads\*ComprobanteDePago.pdf` (⚠️ Downloads lo barren los limpiadores — pedir a JC otros si faltan). **NO commitearlos ni copiar datos reales de clientes al repo** — los tests usan fixture sintética con la misma estructura + casos placa no estándar y estado ≠ Pagado.

## Arquitectura (≈1.030 líneas, 0 dependencias nuevas)

| Archivo | Contenido | ≈líneas |
|---|---|---|
| `renovaciones/index.html` | Pantalla: wizard 4 pasos, favicon `../img/favicon.svg`, `body.page-renovacion`, `.brand-mark` v1.1, "← Cotizador" | 320 |
| `js/renovacion-extract.js` | Parser según arriba | 160 |
| `js/renovacion-email.js` | `buildRenovacionEmail()` + `buildRenovacionWaUrl()`; **reusa** `polizaAsistenciaUrl()` y `polizaWaIntl()` (globales de poliza-email.js, cargado antes) | 270 |
| `js/renovacion-app.js` | Orquestación; envío con **`buildMIMEMulti({to,from,subject,html,attachments})`** (el estándar vivo — `buildMIME` de 1 PDF no tiene callers); patrón `shareWa` replicado (es privada en poliza-app.js) | 260 |
| `tests/test-renovacion-extract.js` + `tests/test-renovacion-email.js` | ≈30 checks (patrón test-poliza-*: Node sin runner, `module.exports` con guard, `global.CFG` antes de requerir) | — |
| `index.html` + `css/styles.css` | Acceso en rail grupo **Enviar** ("Renovación confirmada", icono SVG de trazo, NO renombrar ids existentes — gotcha #25) + entrada footer registro de cambios + `body.page-renovacion{background:#fdf6ec}` | 12 |

**Orden de carga JS**: toast → config → state → agent-profile → shortlink → **poliza-email** → renovacion-extract → renovacion-email → mime-builder → gmail-auth → renovacion-app (+ PDF.js + GIS por CDN; SIN pdf-lib — el comprobante va tal cual; SIN history.js — v1 sin historial, igual que Pólizas Activas).

**Mejora incluida (hallazgo 10 ago)**: `gmail-auth.js` NO tiene `error_callback` — popup de Google cerrado = promesa colgada para siempre. Agregar `error_callback` en `initTokenClient` (~5 líneas aditivas, rechaza la promesa pendiente) — beneficia a las 3 pantallas de envío.

## Gotchas obligatorios

- `applyProfile(loadProfile())` (con guard, patrón poliza-app.js:350) al arranque — si no, sale la licencia de JC en correos de otro agente.
- Adjunto: SOLO el comprobante subido, sin documentos estándar (el cliente ya tiene su documentación). `STD_DOCS` no se toca.
- El fondo crema va en clase propia, NUNCA en la regla global de `body` (gotcha #23).
- Emojis solo DENTRO de correo/WA (contenido); el rail y la consola usan SVG de trazo.
- Sin caracteres invisibles en el fuente (regla del byte NUL); acentos por charCode si hace falta comparar.
- Al cerrar: entrada ARRIBA en el footer registro de cambios (lenguaje de usuario), actualizar SKILL router + checkpoint + espejo Downloads, y smoke con JC antes de declarar sellado.
