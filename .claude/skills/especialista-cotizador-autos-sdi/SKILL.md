---
name: especialista-cotizador-autos-sdi
description: ESPECIALISTA COTIZADOR AUTOS SDI — App web vanilla JS que extrae datos de PDFs de cotización INS (ASINS-170), limpia el PDF (oculta precio mensual), genera correo HTML personalizado estilo AIDA y lo envía SOLO vía Gmail API (Outlook eliminado 11 jun 2026). Multi-agente por localStorage. Sin npm en el front; UN backend: la Netlify Function del enlace corto de la guía (/g). Sub-páginas: /cancelacion/ (Cláusula 33), /polizas-activas/ (envío de pólizas activas: sube los PDF de la póliza → correo "Póliza Activa" con documentos estándar del INS adjuntos + cross-sell Viaje/Estudiantil), /renovaciones/ (Renovación confirmada: sube el Comprobante de Pago del INS ya PAGADO → correo de confirmación con mini-guía de evento + asistencias + cross-sell, y aviso por WhatsApp; guard que bloquea si el PDF no dice "Estado: Pagado"), /explicacion/ (guía visual de hasta 5 pasos — desde el 27 ago 2026 dinámicos: deducible y repuestos solo si la cotización trae D/F/H — + "¿Qué pasará el día de tu cita?" + celebración), /marcas-recargo/ (tabla 58 marcas INS). El Consultor de Autos fue ELIMINADO el 5 ago 2026 (rollback: tag pre-borrar-consultor-5ago). Respaldo del control de cotizaciones en el Google Drive de cada agente (appDataFolder). Pestaña 📊 estadísticas (tasa de éxito + ciclo de estados + filtro por mes y alto valor ≥₡10M + buscador por placa/nombre/apellido + seguimiento WhatsApp/correo) + seguimiento semi-automático: aviso al abrir la app con las cotizaciones de +3 días sin respuesta y envío del correo de seguimiento (un solo seguimiento por cotización). Repo jhernandez-vibecode/COTIZADOR-AUTOS en local C:/Users/segur/COTIZADOR-AUTOS. Deploy Netlify auto desde main → cotizador.appsegurosdigitales.com. Usar este skill cuando JC pida cualquier cambio, bug o mejora al cotizador de autos, al explicador, al correo, a la calculadora de cancelación, al envío de pólizas activas, a la tabla de marcas, o a cualquier módulo de esta app.
---

# Especialista Cotizador SDI — Seguros Autos INS

Leer COMPLETO antes de tocar código. Estado a **10 septiembre 2026**: **la consola (`index.html`) y el explicador
(`/explicacion/`) estrenan la línea clara SDI**. La consola va por `css/linea-clara-consola.css` (commit `c5cc457`, tag
`pre-consola-linea-clara-10sep`, hoja cargada solo en index.html; las sub-páginas siguen igual) — ver "La consola en
línea clara". El explicador — tipografía v1.3 (Google Sans Flex + Code), barra en dos niveles con el INS en azul, hero centrado, paneles
sobre banda pálida, tintes pálidos que pidió JC y el pago anual siempre resaltado. Solo la cara: el JS es byte a byte el de
antes. Commit `fb95067`, tag `pre-explicador-linea-clara-10sep`, verificado en producción. Ver "El explicador en línea
clara". Los correos y la consola NO cambiaron de letra. Previo (**27 agosto 2026**): **el explicador ya es dinámico** — el paso 2
(asistencia) solo aparece si la cotización trae Multiasistencia (G o M en el param `cb`), y los pasos 3
(deducible) y 4 (repuestos) solo si trae cobertura al propio vehículo (D, F o H; el paso 3 estándar además exige
IDD porque promete su reintegro), con renumeración completa del recorrido (dots, contador, hero, botones) cuando
se esconde alguno. Una cotización con solo A y C queda en 2 pasos (coberturas y pagos). El título de la sección 1
pasó a **"¿Qué incluye tu cobertura?"**. Sin `cb` (enlaces ya enviados) NO se toca nada. Commits `07d0f60` (pasos
3-4, tag `pre-explicador-dinamico-27ago`, aprobado por JC sobre mockups) + `ba294c3` (paso 2, tag
`pre-asistencia-dinamica-27ago`, bug reportado por JC: "si marco solo A y C igual me están saliendo las
asistencias"), ambos verificados en producción. `test-explicador-secciones.js` (32 checks); **suite: 17 archivos /
612 checks en verde**. Ver "Explicador".

Previo (**25 agosto 2026**): los **tres correos estrenan la marca SDI** —
filete de 4 px bajo el encabezado y pie con el **logotipo oficial como IMAGEN** (`img/sdi-logo-email.png`) más la
nota legal de tres líneas. Los bloques compartidos viven en **`js/email-marca.js`**, cargado por las 3 páginas ANTES
del módulo que los usa. El correo de cotización cambió el emoji de carro por **la placa del cliente** dibujada como
matrícula (navy la particular, **roja la CL**), reordenó los pagos a trimestral→semestral→anual con el anual en verde
y sello amarillo "10% Descuento", y se le corrigieron tildes, trato de vos, contraste del botón y de la licencia
SUGESE. Commit `f666ba0`, tag `pre-correo-v2-25ago`. **15 archivos de test en verde** (nuevo `test-email-marca.js`,
45 checks). Y el cuerpo del correo dejó los 3 beneficios genéricos: ahora muestra **las coberturas que trae cada
cotización**, leídas del PDF (`_parseCoberturas`), con su monto y su deducible — nada fijo, porque el juego cambia
entre cotizaciones (`c1721f0`, `test-coberturas.js`, 36 checks). Ver "Jornada 25 ago" y "Las coberturas del PDF".

Previo (**21 agosto 2026**): se corrigió el bug que **borraba el historial viejo**
— el tope de 100 cotizaciones se aplicaba también al respaldo, así que al pasar de 100 el auto-respaldo **subía a Drive la
lista ya recortada** y julio 2026 desapareció del navegador *y* del respaldo (por eso "Restaurar de Drive" no hacía nada).
Ver "🔴 El tope del historial NO se aplica al respaldo". Commit `c3bb472`, tag `pre-tope-historial-21ago`. La pantalla para
**recuperar lo ya perdido** desde las versiones anteriores de Drive quedó en la rama `feat/rescate-versiones`, **sin
mergear**, esperando el OK de JC. Previo (19 ago): `/renovaciones/` ya permite avisarle a un cliente **solo por WhatsApp**, sin enviar el correo (selector de canal en el paso 3 — ver "Canal del aviso"). Ese mismo día, el enlace corto que el cliente ve en WhatsApp sale ahora de **`guia.appsegurosdigitales.com`** (antes mostraba el dominio del cotizador — ver "Enlaces cortos"). Previo (10 ago): tests **14/14 en verde (437 checks)**. Lo último: **módulo "Renovación confirmada" (`/renovaciones/`)** — el TERCER envío de la consola, para mandarle al cliente el **Comprobante de Pago del INS de una renovación YA PAGADA**: correo de confirmación (no de cobro) con el comprobante adjunto, mini-guía de qué hacer ante un evento, asistencias vigentes y cross-sell, más el aviso por WhatsApp con enlace corto. Mockups aprobados por JC con 7 decisiones cerradas; ver "Módulo Renovación confirmada" y la spec `docs/superpowers/specs/2026-08-10-renovacion-confirmada-design.md`. **🔴 Su regla dura (D7): sin `Estado: Pagado` en el PDF, la app no deja enviar.** De paso, `gmail-auth.js` estrenó **`error_callback`** (antes: popup cerrado = promesa colgada para siempre y pantalla "Enviando…" hasta recargar) — beneficia a las 3 pantallas de envío. — Previo (7 ago): **el menú lateral "Consola"** (`8ecb819`) — los 6 accesos que vivían como emojis sueltos en la esquina del header pasaron a una barra navy a la izquierda con **nombre + icono**, agrupados en Enviar / Mi control / Consulta / Cuenta. **Solo en `index.html`**; ver "Menú lateral". Antes ese mismo día: **el aviso de póliza lista por WhatsApp ya manda el enlace corto** — el acortador estrenó la ruta `/a/:id` para la guía de emergencias (la de la cotización sigue en `/g/:id`), el mensaje bajó de 710 a 581 caracteres y la lógica de acortar vive ahora en `js/shortlink.js`, compartida por las dos pantallas. En esa jornada se destapó además una trampa que hay que conocer: **el `enlace.mjs` de producción tenía un byte NUL crudo dentro de un regex, que se lee igualito a un espacio** (ver "Jornada 7 ago"). — Previo (6 ago), **dos cambios de pantalla que pidió JC** (ver la sección "Jornada 6 ago"): (1) **guía del deducible** — desplegable `details.card.ded-guide` en la vista 1 del cotizador, **CERRADA por defecto**, con los tramos de Cobertura C con exención "N" y de D, F y H con IDD; los montos son **EJEMPLOS**, no reglas fijas. (2) **fondo tenue que separa las dos pantallas gemelas**: `body.page-cotizar` verde `#edf6f0` en `index.html`, `body.page-poliza` azul `#ebf2fc` en `/polizas-activas/` — se parecían tanto que JC se perdía entre una y otra. — Previo (5 ago): **/polizas-activas/ ya avisa por WhatsApp** — al terminar el envío aparece el botón con el mensaje redactado y el NÚMERO DE PÓLIZA adentro (`buildPolizaWaUrl` en `poliza-email.js`); nunca lo había tenido. Antes, ese mismo día, tres cosas: (1) **vista 4 pareja** — los dos botones de "¡Cotización enviada!" quedaron ambos en **380×48 px** (`.success-actions` + `.btn-step`; el azul heredaba las medidas chicas de `.btn`, 156×40) y llevan el numerito 1 y 2 (`.btn-step-num`); el ORDEN no cambió (verde arriba, azul abajo) porque es el del flujo real. (2) **el historial guarda `clientFull`**, el nombre completo del PDF — antes solo guardaba el del saludo y buscar por apellido en el 📊 daba cero; `historyClientName(e) = clientFull || client` para mostrar y buscar; `client` sigue siendo el saludo de los mensajes y NO se toca. (3) **Consultor de Autos ELIMINADO** por decisión de JC (ver esa sección). Además estrenó el **pie con el registro de cambios** (`footer.app-foot`). **El repo NO es cero-dependencias**: `package.json` con `@netlify/blobs` para la Function del enlace corto — pero SIN `"type": "module"`, que rompe los 10 tests CommonJS. — Previo (28 jul): **enlace corto `/g/:id`** que arregló el link de WhatsApp de la cotización (sigue vivo; era del mismo día que el Consultor pero NO es del Consultor). — Previo (15 jul): **respaldo del control de cotizaciones en Google Drive** (`js/drive-sync.js`, carpeta privada `appDataFolder` de cada agente, token OAuth separado del de Gmail) — EN PROD, verificado por JC, commit `0a468c5`. Nació porque JC limpió el navegador y el historial + estados 📊 + perfil, que vivían SOLO en `localStorage`, se perdieron. — Previo (13 jul): el **PDF INS cambió** — la tabla FORMA DE PAGO (página 2) pasó de 1 columna a una **MATRIZ de 5 columnas por tipo de repuesto** (Vehículo en Garantía · Original · Extensión Garantía · Extensión Garantía Plus · Alternativo/Genérico/Usados). `pdf-extract.js` ahora **selecciona la columna del repuesto elegido** (`_parsePaymentMatrix` + `selectPriceColumn`); `email-template.js` clasifica las 5 variantes con `_reposKind`. El correo/explicador muestran solo la opción elegida; el PDF adjunto queda con las 5 columnas (solo oculta Mensual/Deducción). Commits `acfa5db` + `84aca0d`. — Previo (29 jun): NUEVO módulo **/polizas-activas/** + **documentos estándar auto-adjuntos** (`documentos-ins/`); **ELIMINADO** el módulo de coberturas vigentes (botón amarillo 🛡, /coberturas/, /detalle/, coverage-url.js, buildCoverageEmail). Previo (17 jun): pestaña 📊 con ciclo Pendiente→Agendada→Concretada/Desechada + seguimiento a 3 días + citas de hoy; base E2E + solo Gmail del 11 jun.

## Qué es

App interna del agente INS Juan Carlos Hernández (licencia SUGESE 08-1318) para automatizar el envío de cotizaciones de autos. Flujo de 4 pasos:

1. **Subir PDF** — cotización oficial INS (form ASINS-170-XXXXX)
2. **Revisar datos** — extrae nombre cliente, vehículo, precios (TODOS los campos editables); agente ingresa email del cliente + flags opcionales
3. **Redactar correo** — prefill subject/saludo/nota personal + preview en vivo
4. **Enviar** — Gmail API, con PDF limpio adjunto (sin precio mensual). Tras enviar: botón compartir guía por WhatsApp + registro en historial.

## Estado actual

**125 commits (contados en git el 22 jul 2026). EN PRODUCCIÓN.** Todos los módulos activos y probados. Para el número al día: `git log --oneline | wc -l` en el clon local.

> **11 jun 2026 — Outlook ELIMINADO por completo.** La app envía SOLO por Gmail. No existen `outlook-auth.js`, `outlook-sender.js`, MSAL, `S.provider`, `CFG.MSAL_*`/`OUTLOOK_*`, ni selector de proveedor. Si una tarea pide "agregar Outlook" o menciona Microsoft Graph, confirmar con JC antes — fue eliminado intencionalmente.

- Producción: [cotizador.appsegurosdigitales.com](https://cotizador.appsegurosdigitales.com)
- Netlify default: `cotizador-segurosdigitalesins-sdi.netlify.app`
- Repo local: `C:/Users/segur/COTIZADOR-AUTOS`
- GitHub: `jhernandez-vibecode/COTIZADOR-AUTOS`
- Deploy: push a `main` → Netlify auto-deploy en 1-2 min

## Recursos y accesos

**OAuth Google (migrado 8 may 2026).** El Client ID vive en `js/config.js` como `CFG.CLIENT_ID` — leerlo de ahí, no memorizarlo.
- **Proyecto Google Cloud: "Cotizador Autos SDI", número `255791314248`.** Es un proyecto INDEPENDIENTE (no comparte con SASINS). Tipo de público: **Externo** (permite correos fuera de segurosdelins.com). Modo Testing.
- ⚠️ **NO confundir de proyecto:** existe un cliente OAuth homónimo en el proyecto **"Sistema-Seguros-Vencimientos" (`446215450096`)** que la app **NO usa** — es el Client ID viejo, deprecado desde el 8 may 2026. Todo cambio de scopes/APIs/usuarios va en el proyecto `255791314248`.
- **Scopes:** `https://www.googleapis.com/auth/gmail.send` (envío, restringido) + `drive.appdata` (respaldo, no sensible).
- **Orígenes autorizados:** `https://cotizador-segurosdigitalesins-sdi.netlify.app` **y** `https://cotizador.appsegurosdigitales.com`. Cualquier dominio nuevo hay que agregarlo ahí o el login se rechaza.
- **Agentes autorizados (Test Users, 8 may 2026):** jhernandez@segurosdelins.com · chernandez@seguros-ins.com · tramites@segurosdelins.com.
- **Para invitar a un agente nuevo:** Google Cloud Console → proyecto Cotizador Autos SDI → Google Auth Platform → Público → *Add users*. Después el agente configura su perfil en ⚙.

**Rutas y datos locales**
- Repo local (clon vivo, push directo desde acá): `C:/Users/segur/COTIZADOR-AUTOS`
- **Las 3 ubicaciones de la documentación (mantenerlas sincronizadas):**
  1. **Este archivo** — `C:/Users/segur/.claude/skills/especialista-cotizador-autos-sdi/SKILL.md`. Router vigente: estado, reglas, gotchas, pendientes. **Manda para lo vigente.**
  2. **Checkpoint extendido** — `C:/Users/segur/COTIZADOR-AUTOS/SKILL_COTIZADOR_SDI.md` (raíz del repo). Histórico largo: decisiones viejas, commits, root causes. **Manda para el detalle histórico.**
  3. **Espejo** — `C:/Users/segur/Downloads/SKILL_COTIZADOR_SDI.md`, copia exacta del #2 (⚠️ Downloads lo barren los limpiadores de disco; si desaparece se recupera copiando el del repo).
  Si tocás un hecho que vive en más de una, corregilo **en todas** — la deriva entre copias ya causó datos contradictorios (conteo de marcas, commits "sin push").
- Reglas INS verificadas contra fuente: `C:/Users/segur/COTIZADOR-AUTOS/docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md` (contrastado el 11 jun 2026 con 5 PDF oficiales del INS que JC guarda en `OneDrive\ARCHIVO DIGITAL\Automóviles\`).
- PDF de muestra para pruebas: `C:/Users/segur/Downloads/INFORME-ASINS-170-92637.pdf` (⚠️ Downloads lo barren los limpiadores de disco — si no está, pedirle a JC otro PDF de cotización).

  **Dataset validado de ese PDF** (contra esto se contrasta cualquier refactor del parser):

  | Campo | Valor |
  |---|---|
  | `quoteNum` | ASINS-170-92637 |
  | `cotizDate` | 14/04/2026 |
  | `clientName` | DELGADO ARGUELLO SILVIA MARIEL |
  | `plate` / `year` / `vehicleType` | BRK454 · 2019 · Sedan/Coupe |
  | `valor` | 10,000,000.00 |
  | `sustRepos` | Extensión de garantía Plus |
  | `formaAseg` | Valor declarado (VD) |
  | `prices` | mensual **53.738,00** · trimestral **158.423,00** · semestral **308.283,00** · anual **570.891,00** · deducción **51.360,00** |
  | `deductibles` | **2 líneas** (Cobertura C · Cobertura D,F Y H) |
  | `pageWidth` | 612 (Letter US) |

  Mensual y Deducción son justamente las 2 filas que `pdf-modify.js` tapa. La prima anual 570.891 es la misma del caso de control de la Cláusula 33 (ver esa sección).
- ~~Mockup de rediseño del explicador (parking): `C:/Users/segur/mockup-c-final.html`~~ — **SUPERADO el 10 sep 2026**: el explicador ya se rediseñó con la línea clara SDI (skill `imagen-de-marca-sdi`). Ese archivo viejo ya no es referencia.
- Git: usuario `jhernandez-vibecode` / jhernandez@segurosdelins.com, credenciales cacheadas. **Commit + push lo hace Claude**, no se le pasan comandos a JC.
- **Leer PDFs: el lector nativo (pdftoppm/poppler) está ROTO** → usar Python (`pypdf` / `PyMuPDF` / `pdfplumber`, instalados). Tablas que son imagen: rasterizar con `fitz.get_pixmap()` y leer con Read.

**Claves de almacenamiento del navegador**
| Clave | Dónde | Qué guarda |
|-------|-------|-----------|
| `cotizador_sdi_agent_v1` | localStorage | Perfil del agente: name, email, phone, license (+ website, agendaUrl, whatsapp, assistUrl, xsellViajeUrl, xsellEstudiantilUrl) |
| `cotizador_sdi_history_v1` | localStorage | Historial de envíos + estados 📊 |
| `cotizador_sdi_drive_v1` | localStorage | '1' si el agente activó el respaldo en Drive |
| `cotizador_sdi_drive_last_v1` | localStorage | ISO del último respaldo subido con éxito |
| `cotizador_sdi_aviso_snooze` | sessionStorage | Snooze por hoy del aviso de seguimiento |

**Datos por defecto del agente (config.js):** Juan Carlos Hernández Vargas · jhernandez@segurosdelins.com · 8822-1348 · **licencia SUGESE 08-1318**. Nunca inventar otra licencia ni otro número.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + vanilla JS + CSS3 (sin Tailwind — se quitó el CDN sin uso 11 jun) |
| PDF extracción | PDF.js 3.11.174 (texto + coordenadas Y) |
| PDF modificación | pdf-lib 1.17.1 (rectángulos blancos) |
| Email | MIME RFC 2047 multipart/mixed + base64 |
| OAuth Gmail | Google Identity Services (GIS) |
| Envío Gmail | Gmail API v1 `/gmail/v1/users/me/messages/send` |
| Persistencia | localStorage (perfil del agente + historial de envíos) |
| Tipografía | **Consola y explicador (10 sep 2026): Google Sans Flex + Google Sans Code v1.3**, Inter solo presta el ₡. Sub-páginas (`/polizas-activas/`, `/renovaciones/`, `/cancelacion/`, `/marcas-recargo/`): todavía Poppins + Inter. Correos: Space Grotesk/Arial |

**Zero build, zero npm.** CDN para todo. **Solo Gmail** — sin Outlook/MSAL/Graph.

## Archivos clave (desktop)

```
index.html              `<body class="page-cotizar">` (fondo verde) + header (marca · pasos · iniciales del agente) + **menú lateral `nav.side-rail` dentro de `div.app-shell`** + 4 vistas + guía del deducible (`details.ded-guide`, vista 1) + modal ⚙ + modal 🕘 historial + modal 📊 estadísticas + pie `footer.app-foot` con el registro de cambios
404.html                Página 404 con marca SDI
netlify.toml            404 para docs internos + headers de seguridad
img/favicon.svg         Favicon: carrito rojo estilo emoji (commit `d9c9adc`, 20 abr 2026). Enlazado con <link rel="icon" type="image/svg+xml"> en las 5 páginas HTML: index, explicacion, cancelacion, marcas-recargo, polizas-activas. Página nueva = agregarle el link (relativo `../img/favicon.svg` en sub-páginas)
img/                    ins-logo.png (header del correo) · **sdi-logo-email.png (pie de los TRES correos, 384×163, rasterizado del kit)** · sdi-logo.svg (footer del explicador) · og-explicacion.png (preview Open Graph para WhatsApp)
js/email-marca.js       **Bloques de marca compartidos por los 3 correos** (25 ago 2026): `_fileteSDI`, `_analizarPlaca`, `_placaEsRelleno`, `_tarjetaVehiculo`, `_bloqueSobrio`, `_pieSDI`, `_ahorroAnual`, `_bloquePagos`, `_bloqueCoberturas`, `_filasCoberturas`, `_deduciblePorCobertura`, `_notaDeducibles`, `_cuadrosDeducibles`. Se carga ANTES del módulo de correo que lo usa
css/styles.css          Variables CSS + temas + toasts + historial + estadísticas
js/toast.js             showToast(msg, type) — notificaciones (reemplaza alert)
js/config.js            CFG object (Client ID Gmail, URLs, defaults del agente)
js/state.js             Singleton S (step, data, modPDF, accessToken, tokenClient, prevTimer)
js/agent-profile.js     loadProfile / saveProfile / applyProfile / isFirstTime / clearProfile
js/history.js           historial + estadísticas: loadHistory/saveHistoryEntry + computeHistoryStats/groupHistoryByMonth/historyEntryValue/setHistoryConfirmed/buildWaShareUrl/buildWaFollowUpUrl + mergeHistories/replaceHistory/_afterHistoryChange (choke-point que dispara el respaldo a Drive)
js/shortlink.js         acortarEnlace(url, tipo) — alias corto para WhatsApp: 'g' guía de la cotización, 'a' guía de emergencias. Compartido por index.html y /polizas-activas/. Si falla, devuelve el link largo
js/drive-sync.js        Respaldo del control en la carpeta privada appDataFolder del Drive del agente (token OAuth propio)
js/router.js            Navegación entre vistas + step indicator
js/pdf-extract.js       PDF.js → texto+coords(x,y,w) → campos + _parseDeducibleDFH (dedDFH) + _parsePaymentMatrix (matriz FORMA DE PAGO 5col → columna del repuesto) + selectPriceColumn/pricesForColumn/priceColumnConfident
js/pdf-modify.js        pdf-lib → rectangulos blancos sobre filas mensuales
js/email-template.js    buildEmail() + buildFollowUpEmail() + _buildGuideUrl()
js/gmail-auth.js        initTokenClient / getToken / sendEmail (Gmail API)
js/mime-builder.js      buildMIME() (1 PDF) + buildMIMEMulti() (varios PDF) + buildMIMESimple() (sin adjunto) RFC 2047 + base64
js/standard-docs.js     STD_DOCS {cotizacion, poliza} (manifiesto editable) + loadStdDocs() — PDFs INS auto-adjuntos
js/poliza-extract.js    PolizaParse: extrae de Condiciones Particulares (póliza#, titular, vehículo, placa, correo)
js/poliza-email.js      buildPolizaActivaEmail() — correo "Póliza Activa" + cross-sell, personalizable por agente
js/poliza-app.js        Orquestación de /polizas-activas/ (cargar → revisar → redactar → enviar)
js/renovacion-extract.js RenovacionParse: lee el Comprobante de Pago del INS (INS-F-1011060) — nº comprobante, asegurado, estado, póliza, placa (con relleno de ancho fijo), período PAGADO, fecha de pago, monto. estaPagado() = guard D7. Reusa helpers de PolizaParse
js/renovacion-email.js  buildRenovacionEmail() + buildRenovacionWaUrl() — correo "Renovación confirmada" (NO de cobro) + aviso WA. Reusa polizaAsistenciaUrl/polizaWaIntl
js/renovacion-app.js    Orquestación de /renovaciones/ (cargar → revisar → redactar → enviar → WhatsApp) + triple barrera del guard D7
js/stats-ui.js          Pestaña 📊 (render + handlers). Extraído de app.js el 9 set 2026; solo depende de history.js
js/app.js               Orquestación + historial + estadísticas (📊) + sugerencia alta gama + sync vista 2
```

### Sub-páginas
```
cancelacion/index.html   Cláusula 33 — calculadora de reintegro anticipado
polizas-activas/index.html  Envío de pólizas activas (wizard 4 pasos, look "Nativo")
renovaciones/index.html  Renovación confirmada: envío del comprobante de pago ya pagado (wizard 4 pasos)
explicacion/index.html   Guía visual 5 secciones (13 URL params, incl. dd)
marcas-recargo/index.html  Tabla 58 marcas INS con deducibles diferenciados
documentos-ins/          PDFs estándar INS auto-adjuntos (Deber/Perfeccionamiento, Multiasistencia, Pacto Amistoso, DAM, Cond. Generales SVA)
```

## Orden de carga de JS (OBLIGATORIO)

Este orden es estricto — no alterar:
```html
toast.js → config.js → state.js → agent-profile.js → shortlink.js → history.js → router.js →
pdf-extract.js → pdf-modify.js → email-marca.js → email-template.js →
gmail-auth.js → mime-builder.js → standard-docs.js → drive-sync.js → app.js

(**`stats-ui.js` va entre `history.js` y `router.js`** — ver "El 📊 salió de app.js".)
```
`toast.js` es autónomo (inyecta su CSS), va primero. `shortlink.js` va antes de `history.js` (su `acortarGuia` delega ahí). `history.js` requiere nada más que localStorage. `standard-docs.js` va antes de `app.js` (lo usa para adjuntar el Deber). `drive-sync.js` va después de `history.js`/`config.js` y antes de `app.js`.

🔴 **`email-marca.js` va SIEMPRE antes del módulo de correo que lo usa**, en las 3 páginas. Tiene los bloques de
marca compartidos (filete, placa, pie, coberturas, pagos). Si falta, el correo se arma sin ellos o lanza.

**Sub-página /polizas-activas/** (orden propio): toast → config → state → agent-profile → **shortlink** →
**email-marca** → poliza-extract → poliza-email → mime-builder → gmail-auth → standard-docs → poliza-app
(+ PDF.js + GIS). NO carga pdf-lib (la póliza no se modifica, se adjunta tal cual) ni history.js.

**Sub-página /renovaciones/** (orden propio): toast → config → state → agent-profile → **shortlink** →
**email-marca** → **poliza-extract → poliza-email** → renovacion-extract → renovacion-email → mime-builder →
gmail-auth → renovacion-app (+ PDF.js + GIS). Los dos módulos de póliza se cargan porque el de renovaciones **reusa** sus piezas probadas (helpers de nombre y `readPdfText` vía `RenovacionParse`; `polizaAsistenciaUrl`/`polizaWaIntl` para la ficha del agente) — mover renovacion-* antes de ellos rompe el módulo. NO carga pdf-lib, ni history.js, ni standard-docs (no adjunta documentos estándar).

## CFG y multi-agente

`js/config.js` define defaults del agente (FROM_NAME, FROM_EMAIL, LICENSE, WEBSITE, AGENDA_URL, GUIDE_URL, LOGO_URL, CLIENT_ID de Gmail). **Ya no hay MSAL_CLIENT_ID ni OUTLOOK_*.**

`agent-profile.js` sobreescribe CFG con lo que hay en localStorage. Así un mismo deploy Netlify sirve a múltiples agentes — cada uno con su propio browser y perfil. El modal ⚙ guarda el perfil (nombre, email, teléfono, licencia, website, agendaUrl + **assistUrl / xsellViajeUrl / xsellEstudiantilUrl** para el correo de Póliza Activa) y tiene botón **"Borrar mis datos"** (clearProfile + reload, oculto en primera configuración).

**Campos nuevos de póliza (29 jun):** `CFG.ASSIST_URL` (Centro de Asistencia Digital, default `appasistenciaseguroautos.netlify.app/`; el correo le añade automáticamente la ficha del agente por parámetros — ver abajo), `CFG.XSELL_VIAJE_URL` (default cotizador viajero), `CFG.XSELL_ESTUDIANTIL_URL` (vacío por default → el botón cae al sitio del agente). `applyProfile` los asigna con guard `!== undefined`, así perfiles viejos (sin estos campos) conservan el default de config.js hasta que el agente re-guarde su perfil.

**isFirstTime()** → si no hay perfil, el modal se abre automáticamente al cargar y bloquea hasta llenarlo.

## PDF extraction

`pdf-extract.js` usa PDF.js. Extrae texto con coordenadas (x, y, **w**). Agrupa por Y ±2px para reconstruir filas. Datos en página 1: quote#, cliente, vehículo, placa, año, valor asegurado, tipo seguro, sustitución de repuestos. Datos en página 2: precios, deducción mensual, lista de deducibles, dimensiones de página.

**FORMA DE PAGO = matriz de 5 columnas por repuesto (13 jul 2026).** `_parsePaymentMatrix(rows2, data.sustRepos)` detecta las columnas por posición X (`_clusterCenters`), lee el encabezado de cada una y **elige la del repuesto de la página 1** (`selectPriceColumn`: `_labelMatch` por tokens + fallback `_reposFixedIndex` al orden fijo de 5 columnas). Guarda `data.priceMatrix = {centers, labels, values}` (re-seleccionable) y `data.reposColumn = {index, label, confident, count}`. Expone `selectPriceColumn`/`pricesForColumn`/`priceColumnConfident` (globales; `app.js` re-selecciona en `_syncDataFromView2` si el agente corrige el repuesto, y muestra la nota "📋 Precios según…"). **Backward-compatible** con 1 columna. `module.exports` (guard) para `tests/test-payment-matrix.js`. **NO hardcodear coordenadas Y** — todo por clustering dinámico.

**DETALLE DE COBERTURAS (25 ago 2026).** `_parseCoberturas(rows1, rows2)` → `data.coberturas`, un array de
`{cod, desc, prima, montos:[{etiqueta,valor}]}` con lo que trae ESE PDF y nada más. 🔴 **Recibe las DOS páginas
porque el bloque las cruza** (N e IDD quedan arriba de la 2), y 🔴 **el terminador corta en `Detalle de Deduc`
porque el formulario del INS trae la errata "Detalle de Deduciles"**, sin la b. Ver "Las coberturas del PDF".

`pdf-modify.js` dibuja rectángulos blancos **a lo ancho** (`x=28 → pageWidth-28`) en las filas "Mensual" y "Deducción Mensual" → tapa las 5 columnas de esas filas. Las demás filas quedan con las 5 columnas visibles (decisión de JC).

## Email HTML (buildEmail)

Estructura en bloques (tablas anidadas + inline styles — Gmail bloquea SVG). **Rehecho el 25 ago 2026**, ver
"Jornada 25 ago" y "Las coberturas del PDF":

1. Header navy + logo INS + "Tu cotización está lista" + **filete de marca SDI** (`_fileteSDI`)
2. Saludo + **tarjeta del vehículo con la placa** (`_tarjetaVehiculo`, sin emoji ni caja de color)
3. Intro + CTA al explicador
4. **Lista de coberturas del PDF** (`_bloqueCoberturas`) + **los deducibles en dos cuadros**
   (`_cuadrosDeducibles`). Si el PDF no las trae, caen los 3 benefit cards de siempre.
5. **Formas de pago** (`_bloquePagos`): trimestral → semestral → anual, el anual en verde con sello amarillo
6. (cond) Interés asegurable
7. Sustitución de repuestos (texto según tipo extraído del PDF)
8. CTA "Agendar mi cita ahora" → CFG.AGENDA_URL
9. Prueba social ★★★★★
10. (cond) Nota personal del agente
11. Firma humana "Cualquier duda, hablemos. — JC"
12. Disclaimer Uber/DiDi (NO cubre)
13. Footer SDI (logo recreado en HTML+tablas)

**Logo SDI en el correo**: recreado con HTML+tablas (texto "SDI" + barras blancas). Gmail bloquea SVG e imágenes de dominios nuevos — nunca usar `<img>` para el logo en emails.

## Flags de vehículo (Vista 2)

| Toggle | Param URL | Regla INS |
|--------|-----------|-----------|
| ⚡ Eléctrico | `vt=e` | Subsección batería en explicador (sec B de s4) |
| 🌏 Origen asiático | `og=1` | Deducible 20% min ¢500k (Circular 0324-2025) |
| 💎 Alta gama | `ag=1` | ≥¢50M, deducible escalonado 10%/20% (Circular 0186-2025) |

Los flags `og` y `ag` **sustituyen** la sección 3 (deducible estándar) del explicador, no se suman. Si ninguno activo, la sección 3 estándar se muestra normal.

**IDD2 (¢500.000)**: JC cotiza SIEMPRE con IDD2 — bloque siempre visible. En asiático/alta gama el diferencial por encima de ¢500k corre por cuenta del asegurado. Por eso el correo ya NO dice "Cero deducible" en esos casos — el texto del benefit 2 cambia dinámicamente según los flags.

## Explicador (/explicacion/)

URL params: `n` (agente), `l` (licencia), `w` (website), `a` (agendaUrl), `c` (cliente), `v` (vehículo), `p` (placa), `y` (año), `vt` (tipo: `g`/`e`), `va` (valor asegurado), `sr` (repuesto), `dd` (deducible D,F,H real del PDF), `pa`/`ps`/`pt` (precios), `og` (asiático), `ag` (alta gama), **`cb` (las coberturas de la cotización — 25 ago 2026)**.

🔴 **`cb` es el que evita que la guía y el correo se contradigan.** Formato `A-300000000.B-15000000.C.G.M`.
Sin él, la guía muestra sus seis tarjetas fijas y sus 5 pasos — que es lo correcto para los enlaces enviados
antes, y un desastre para los nuevos. Ver "El correo y la guía tienen que decir LO MISMO".

### Pasos 2, 3 y 4 dinámicos (27 ago 2026, `07d0f60` + `ba294c3`) — EN PROD

Con `cb` presente, **los pasos de asistencia, deducible y repuestos solo aparecen si le aplican a la cotización**
(cerró el pendiente del 25 ago). Tags de rollback `pre-explicador-dinamico-27ago` (pasos 3-4) y
`pre-asistencia-dinamica-27ago` (paso 2 — mismo día, más tarde: JC reportó que con solo A y C igual salía la
asistencia). La regla, en `_seccionesQueAplican(mapa)`:

| Paso | Aparece si `cb` trae |
|---|---|
| `s2` asistencia | **G o M** — el paso promete la Multiasistencia en carretera |
| `s3` estándar (IDD) | alguna de **D/F/H** **y además IDD** — el paso promete el reintegro de la IDD |
| `s3a`/`s3b` (asiático/alta gama) | alguna de **D/F/H** (describen el esquema, que aplica con o sin IDD) |
| `s4` repuestos | alguna de **D/F/H** (repuestos = daño al propio vehículo) |

- **Sin `cb` no se toca nada** — la guía queda con sus 5 pasos byte a byte (enlaces ya enviados).
- **`renumerarGuia()`** corre solo si algo se escondió: renumera "Sección N" y los dots (esconde los huérfanos),
  re-encadena los botones anterior/siguiente entre pasos visibles (el "Avanzar" de `s5`→`qtcita` no se toca) y
  ajusta el hero ("Tu recorrido en N pasos", puntos, "Paso 1 de N") y el contador flotante. Deja
  `window._pasosGuia`/`window._dotsGuia`, que el script de navegación toma en lugar de las listas estáticas —
  **el aviso viejo de "5 dots fijos" ya no aplica cuando hay `cb`**.
- 🔴 La lógica pura (parser `_parseCbMapa` + regla) vive entre los marcadores **`[GUIA-CB-PURO]`** en
  `explicacion/index.html`; `tests/test-explicador-secciones.js` (32 checks) la extrae por los marcadores y la
  evalúa en Node, más el circuito completo correo → `cb` → decisión. **Si movés el bloque, mové los marcadores.**
- `aplicarSecciones` corre **al final** de `applyPersonalization`, después del bloque og/ag — decide sobre la
  variante del deducible que quedó activa.
- El título de `s1` quedó genérico: **"¿Qué incluye tu cobertura?"** (antes "…tu Cobertura Total", que sonaba a
  nombre de paquete). Es estático: lo ven también los enlaces viejos, y les calza igual.

🔴 **La placa no viaja si es un relleno de cero kilómetros.** `_buildGuideUrl` recibe `plate: ''` cuando
`_placaEsRelleno` da true, para que la guía no le muestre `000111` al cliente como si fuera su matrícula.

**XSS — todos los params se escapan.** `applyPersonalization()` usa `esc()` en cada inserción `innerHTML` (n, l, c, v, p) y `safeHttpUrl()` para el link de agenda (`a`) — solo acepta http/https, rechaza `javascript:`. Si agregás un param nuevo que se inyecte al DOM, escapalo igual (verificado E2E 11 jun con payloads `<img onerror>`, `<svg onload>`, `javascript:`).

**Param `dd`**: la sección 3 estándar (deducible) muestra el monto real extraído del PDF (`.dd-amt` spans). Si `dd` no viene (correos viejos), queda el ₡400.000 histórico. Se formatea con `fmt()` (es-CR), mismo estilo que los precios.

5 secciones numeradas (base; con `cb` pueden quedar de 2 a 4 — ver "Pasos 2, 3 y 4 dinámicos"): Coberturas (`s1`, título "¿Qué incluye tu cobertura?") → Asistencia (`s2`, Plan Plus 0-6 años / Plan Básico 7-15, solo con G o M) → Deducible (`s3`, o `s3a`/`s3b` con los flags og/ag) → Repuestos (`s4`) → 3 opciones de pago (`s5`).

### Sección "📅 ¿Qué pasará el día de tu cita?" (`<section id="qtcita">`) — EN PROD desde 27 may 2026, commit `31ec130`

Sexta sección, **entre `s5` (Pagos) y el cierre**. La pidió JC para bajar la fricción del CTA: anticipa los 4 pasos del aseguramiento virtual para que el cliente sepa qué le espera al agendar.

- Pill cyan "📅 ¿Qué pasará el día de tu cita?" + título "Tu aseguramiento es 100% virtual".
- **4 pasos numerados** en timeline vertical (`.cita-steps` › `.cita-step` › `.num-circle` gradient azul + `.step-body`): 1 🚗 **Prepárate** (vehículo a mano, lugar iluminado y limpio, fotos del exterior antes de activar) · 2 📸 **Sube tus fotos** (QR al correo, se escanea con el celular, sin instalar apps) · 3 📲 **Aceptación digital** (llega la póliza, se acepta con Token de seguridad, sin papeles ni firma presencial) · 4 💳 **Pago y listo** (asegurado al instante, póliza al correo).
- **Bloque de métodos de pago** (`.cita-pay-methods`): 💳 tarjeta con link de pago seguro · 📱 SINPE Móvil · 🏦 transferencia a cuentas del INS · 🌐 link a `insenlinea.grupoins.com`.
- **Navegación:** el botón "next" de `s5` pasó de "Agendar mi cita ✓" a **"Avanzar →"** (`data-target="qtcita"`); el pie de `qtcita` lleva "← Pagos" + "Agendar mi cita ✓" (hace scroll al `.cta-rect` del cierre, no abre el form directo).
- Estilos reusan los tokens existentes (`--azul`, `--azul-deep`, `--cyan-bg`, Space Grotesk + Inter) — no introdujo paleta nueva.
- **NO se tocó** header, ribbon, sticky-nav ni floatNav: la sticky-nav arranca con **5 dots** (s1…s5) y el contador flotante con **"1 / 5"** — desde el 27 ago 2026 `renumerarGuia()` los ajusta cuando `cb` esconde pasos. `qtcita` es intencionalmente una sección *sin* dot (tampoco entra a `window._pasosGuia`). Si algún día se le quiere dar dot propio, es decisión de diseño — no asumir que es un bug.

**Sección 4 (repuestos)**: desde 28 may 2026 muestra SOLO la fila que le corresponde al cliente según `sr`. Las otras 3 filas se ocultan. Commits `6a6502e` (solo la fila del cliente) + `446c116` (etiqueta oficial INS) + `4c16d79` (docs/checkpoint 28 may — es el commit al que apunta el tag `pre-e2e-11jun`). Códigos `sr`:

| Código | Tipo | Badge visible |
|--------|------|--------------|
| `p` | Garantía Plus (≤8 años / ≤80,000 km) | Repuesto Original |
| `g` | Garantía (≤5 años / ≤60,000 km) | Repuesto Original |
| `0` | Carro nuevo (≤3 años / ≤36,000 km) | Repuesto Original |
| `n` | Sin extensión (>3 años o >36,000 km) | Alternativo / Genérico o usado |

Si `sr` no viene en el URL (correos viejos), se muestran las 4 filas con Plus resaltado por defecto.

**Momento celebración**: al hacer clic en "Agendar mi cita" → overlay verde + confetti + mensaje personalizado → abre Google Form del agente (param `a`). Fallback: link hardcoded de JC para URLs sin `a`.

## Sustitución de repuestos — email

`_sustitucionText(label)` en `email-template.js` convierte el texto del PDF a un párrafo descriptivo de una sola línea. No muestra opciones — siempre describe solo la del cliente.

**Clasificador `_reposKind(label)` (13 jul 2026):** mapea el campo "Sustitución de repuestos" a 1 de 5 tipos (orden importa: `plus` → `alternativo` → `vehiculo` → `garantia` → `original` → `''`). `_sustitucionText` y `_sustReposToCode` delegan en él (antes cada uno tenía su propio `includes`). Correspondencia con `sr` del explicador: plus→`p`, garantia→`g`, vehiculo/original→`0`, alternativo→`n`, desconocido→`n`. **Casos reales del campo:** `"Extensión de garantía Plus"` (plus), `"Alternativo genérico / Usados"` (alternativo — antes caía al texto genérico). El acento se quita por charCode `0x300-0x36f` (NO literal Unicode — regla de Unicode invisible).

## Calculadora de cancelación (/cancelacion/)

Implementa Cláusula 33 de las Condiciones Generales SVA INS (Cond. Generales págs 58-59).

### 🔴 EL FACTOR VA SOBRE LA PRIMA ANUAL — no sobre la cuota del período

Esta es la regla más importante del módulo y la que más veces se ha documentado mal. **La norma dice "Factor de tarifa a corto plazo SOBRE PRIMA ANUAL".** Bug grande corregido el 11 jun 2026 y **confirmado por dos auditores actuariales**. Antes el factor se aplicaba a la cuota del período (trimestral/semestral/mensual) y solo acertaba en pago Anual; en fraccionado prometía devoluciones que no existen.

```
≤ 5 días naturales desde emisión  → devolución = 100% de lo pagado
> 5 días:
    idx            = Math.min(monthsComplete(emision, cancelacion), 11)
    factorBase     = TABLA[idx]                       // 40% … 100%
    factorEfectivo = meses < 6 ? factorBase * 0.5 : factorBase
    prima_devengada (INS retiene) = factorEfectivo × PRIMA ANUAL   ← NO × cuota del período
    prima_no_devengada            = prima_anual − prima_devengada
    devolución_neta               = max(0, TOTAL PAGADO − prima_devengada)
```

**Caso real de control (verificar cualquier refactor contra este):** prima anual ₡570.891, pago trimestral con ₡428.166 pagados, cancela a los 8 meses → el código viejo devolvía ₡15.700; **la norma da ₡0**. Se verificaron 4 casos contra la norma.

- **Tabla de 12 factores:** Hasta 1 mes 40% · 1-2 48% · 2-3 55% · 3-4 62% · 4-5 68% · 5-6 75% · 6-7 79% · 7-8 84% · 8-9 89% · 9-10 93% · 10-11 96% · 11-12 100%.
- `monthsComplete(a, b)`: meses calendario completos — si `b.getDate() < a.getDate()` se resta 1.
- **El formulario pide DOS montos:** **prima anual** (base del factor) + **total pagado por el cliente** (base de la devolución neta; se autocompleta = prima anual cuando el pago es anual). La **forma de pago quedó solo informativa** — NO multiplica ni divide nada.
- Los recargos por fraccionamiento (Sem 8%, Trim 11%, Men 13%, GUÍA SUSCRIPCIÓN 2025 pág. 9) ya vienen dentro de lo que el cliente pagó — no descontarlos del total pagado.
- **Correo:** etiquetas "Factor efectivo (sobre prima anual)", "Prima anual (base del factor)", "Prima devengada (INS retiene)", "Prima no devengada del contrato". `LAST_CALC.factorEft` (factor efectivo) reemplaza al difunto `c.isAnnual`. Header de la fila del factor = "% de la prima anual". Si la prima devengada iguala o supera lo pagado, el correo muestra la nota de que la devolución es ₡0 y puede quedar prima devengada pendiente de cobro.
- Envío vía Gmail (`buildMIMESimple` — sin adjunto PDF).
- **Matiz menor pendiente (NO modificado, es conservador — decisión de JC):** la tabla oficial dice "Hasta 1 mes" (inclusivo), pero en el día de aniversario mensual exacto el código manda el borde al tramo superior → retiene un poco más / devuelve un poco menos. Solo afecta ese día exacto; cualquier otra fecha da el índice correcto. El disclaimer del informe ya aclara que el monto final lo confirma el INS.
- **Fuente verificada:** `docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md` en el repo (sección "Cláusula 33"). Ese archivo y esta sección son la referencia; si algún otro documento dice "factor × prima pagada", está desactualizado y hay que corregirlo.

## Envío de pólizas activas (/polizas-activas/) — NUEVO 29 jun 2026

Módulo para enviar la póliza al cliente cuando YA está emitida y activa (espejo del módulo de la consola de Viajero). Look **"Nativo"** (mismo header/cards/step-nav que la app, reusa `css/styles.css`). Botón **📨** en el header (reemplazó al amarillo 🛡 de coberturas). Sub-página propia tipo /cancelacion/.

Flujo 4 pasos: **Cargar póliza** (drag&drop multi-PDF) → **Revisar datos** (editables) → **Redactar correo** (preview en vivo en iframe) → **Enviar** (Gmail con TODOS los PDF adjuntos).

- `poliza-extract.js` (`window.PolizaParse`): extrae de las **Condiciones Particulares** del INS (form `_017_170_`): Nº póliza (`0101AUT…`/`0121AUT…`), titular (sección DATOS TOMADOR), Marca/Modelo/Año → vehículo, placa, correo del cliente (prefiere el que NO sea segurosdelins), forma de pago, vigencia. `titleCase` es **Unicode-safe** (NO usar `\b`: en JS es ASCII y parte mal los acentos → usar `/(^|[\s\-])(\p{L})/gu`). `sugerirNombrePila` = tokens tras los 2 apellidos. **NO inventa acentos** que no estén en el PDF.
- `poliza-email.js` (`buildPolizaActivaEmail`): correo "✅ Póliza Activa" navy — saludo + confirmación (verde) + **Centro de Asistencia Digital** (`CFG.ASSIST_URL` + tip "Añadir a pantalla de inicio") + documentación adjunta + contactos de emergencia (800-800-8000/911/8001) + nota de terceros (ámbar) + **cross-sell Viaje + Estudiantil** (links de CFG, fallback al sitio del agente) + firma. TODO por CFG (multi-agente). `e`/`_safe` son **locales** a la función (no contaminar globals).
- **Guía de emergencia personalizada por agente (1 jul 2026):** el link "Abrir mi guía" (`assistUrl`) ya no es la URL pelada — `buildPolizaActivaEmail` le **embebe la ficha del agente** por parámetros: `?n,tel,wa,em,lic,web` (WhatsApp normalizado a intl CR con `_waIntl`; `web` usa el valor CRUDO del perfil, NO el fallback a la web de JC). Así la app de asistencia (repo aparte `APP-ASISTENCIA-SEGURO-AUTOS`, su `getAgent()` los lee y sanea) muestra al agente correcto y no a JC por default. Respeta cualquier query previa (`?a=<id>`). **Cambio coordinado: ambos repos deben desplegar juntos.** Cubierto por los checks `asistencia-agente` + `multiagente-*` en `test-poliza-email.js`.
- `poliza-app.js`: orquesta; adjunta los PDF del agente + `STD_DOCS.poliza`. Reusa agent-profile/gmail-auth/mime-builder/state.

**Aviso por WhatsApp en la vista 4 (5 ago 2026, commits `5557cde` + `f582c4d`).** Antes el módulo terminaba en "¡Póliza enviada!" y punto — el aviso al cliente lo escribía JC a mano. Ahora la vista 4 lleva `#waShareWrap` (label + input opcional del WhatsApp del cliente + nota) y los dos botones con `.btn-step` dentro de `.success-actions`.

⚠️ **El ORDEN es al revés que en el cotizador, y es a propósito** (`f582c4d`, lo pidió JC): acá **1 = "Enviar otra póliza"** (azul) y **2 = "Avisar al cliente por WhatsApp"** (verde); en la vista 4 del cotizador es 1 = WhatsApp y 2 = "Enviar otra cotización", también por decisión suya. **No unificarlos.** Consecuencia conocida y avisada a JC: el azul dispara `resetAll()`, así que si lo toca antes del WhatsApp pierde el aviso de esa póliza (habría que escribirlo a mano). No se le puso confirmación porque no la pidió.
- **`buildPolizaWaUrl({nombrePila, poliza, vehiculo, placa, telCliente})`** (en `poliza-email.js`): el mensaje que redactó JC + la línea **"Su número de póliza es X (vehículo, placa)"** — sin número de póliza, esa línea entera desaparece en vez de quedar colgando.
- **`polizaAsistenciaUrl()`**: la URL del Centro de Asistencia con la ficha del agente (`?n,tel,wa,em,lic,web`), **cruda** (el correo la escapa por su cuenta, WhatsApp la necesita tal cual). El `_assistUrl` local de `buildPolizaActivaEmail` **delega en ella**: si el correo y el WhatsApp mandaran fichas distintas, el cliente vería un agente en un lado y otro en el otro.
- **El enlace del WhatsApp va CORTO desde el 7 ago 2026** (`/a/:id`, 54 chars en vez de 183). El clic en el botón lo resuelve con `acortarEnlace(polizaAsistenciaUrl(), 'a')` (`shareWa` en `poliza-app.js`) y recién ahí abre el chat; el `href` del `<a>` queda con el LARGO como red de seguridad (JS caído, "abrir en pestaña nueva"). `buildPolizaWaUrl` recibe el corto por `urlGuia` y, si no viene, cae solo a la URL larga. **En el CORREO sigue yendo la larga a propósito**: ahí el botón la esconde igual y no queremos que armar el correo dependa de una llamada de red.
- **`polizaWaIntl(v)`**: 8 dígitos → `506XXXXXXXX`. Endpoint `web.whatsapp.com/send/`, NUNCA `wa.me`.
- `refreshWaBtn()` en `poliza-app.js` arma el link con **`currentEmailParams()`**, los mismos datos del correo — así el saludo del mensaje no se contradice con el del correo. Se revela al enviar (dentro de `try/catch`: el correo ya salió, esto no puede tumbar el flujo) y se esconde en `resetAll()`.
- **El saludo NO lleva "Estimado/Estimada":** del PDF sale el nombre, no el género. Quedó "¡Natanael, su póliza de automóvil está lista!". Equivocarse de género con un cliente es peor que sonar menos formal. El registro es **usted** de punta a punta (el borrador de JC mezclaba "su póliza" con "facilitarte" y "conduce").
- El mensaje mide ~710 caracteres con el link de la ficha (~180). Si alguna vez WhatsApp lo corta con "Leer más", lo primero a mirar es ese link.
- Tests: 16 checks en `test-poliza-email.js` (endpoint, teléfono, número de póliza, sin póliza, sin teléfono, multi-agente, sin género).
- Multi-agente: el correo sale del Gmail del agente autenticado; firma/asistencia/cross-sell del perfil ⚙. Sin perfil → defaults de CFG (JC).
- Tests: `test-poliza-extract.js` (con texto real de una Cond. Particulares), `test-poliza-email.js` (contenido + XSS + fallback cross-sell).

## Módulo "Renovación confirmada" (/renovaciones/) — NUEVO 10 ago 2026

Tercer envío de la consola: el agente carga el **Comprobante de Pago del INS** (form `INS-F-1011060`) de una renovación **ya pagada** y le manda al cliente la confirmación por correo + el aviso por WhatsApp. Wizard de 4 pasos, espejo de /polizas-activas/. Fondo crema `body.page-renovacion` (`#fdf6ec`).

### 🔴 El concepto: es un correo de CONFIANZA, no de cobro

JC corrigió el enfoque a mitad de los mockups: *"es un recibo de renovación ya pagado, entonces es más bien un correo para transmitir confianza y seguridad en la renovación, brindar información valiosa de qué hacer en caso de reclamos y coberturas de asistencia"*. **Nada de "pague antes de", montos pendientes ni formas de pago** — la fecha límite que trae el PDF ni se menciona. El correo confirma el pago, adjunta el comprobante y dedica el centro a la **mini-guía de evento** (911 → inspector 800-800-8000 → asistencia 800-800-8001 + no acordar con terceros) y a las asistencias que la renovación mantiene vivas. Cierra con "Gracias por renovar su confianza". Los tests lo vigilan (`NO-pague-antes`, `NO-formas-pago`, `NO-monto-pendiente`, `NO-vigencia-anual`).

### 🔴 D7 — guard de estado: SOLO recibos ya pagados

El correo afirma que el pago fue aplicado; enviarlo sobre un comprobante no pagado sería confirmar un pago inexistente, y responde el agente con su licencia. **Triple barrera** en `renovacion-app.js`: el botón Continuar se deshabilita (`renderNext2`), `btnNext2` revalida y `send()` revalida otra vez. El estado **no es editable**: sale del PDF.
- dice "Pagado" → se envía · dice **otra cosa** → bloqueo sin escape · **no se pudo leer** → casilla "Confirmo que este recibo ya está pagado" (el flujo no muere por un PDF raro).

### El formulario del INS — dos trampas verificadas contra 2 comprobantes reales

- **A4 595×842, 1 página, 100% texto** (no Letter como la cotización; sin tablas-imagen).
- **La placa viene con relleno de ancho fijo y NO siempre son ceros:** muestras reales `(00000BXY123)` y `(PQR00ZWT456)` — 11 chars, placa al final. Se reconoce el sufijo `AAA999`; otro formato (placas numéricas viejas, CL, motos) → **crudo con `placaIncierta=true`** + aviso. No se inventa un recorte.
- **El período es el PAGADO, no el año-póliza:** las muestras traían un trimestre y un semestre. La **3ª fecha de la fila es la fecha límite** y NO se usa. Por eso el correo dice "período pagado" y nunca "vigencia anual".
- El PDF **no trae** marca/modelo ni correo del cliente → vehículo opcional manual, correo digitado por el agente.
- Montos en formato US (`92,555.00`) → se formatean con **'de-DE'** (es-CR separa miles con espacio) → `₡92.555`.
- Si el comprobante trae **más de una póliza**, se avisa y el agente revisa: no se adivina cuál es.

### 🔴 VARIOS RECIBOS EN UN CORREO — plan familiar (10 ago 2026, tras el smoke)

Un cliente puede tener dos pólizas y un plan familiar llega a **cinco o más**. Se cargan todos los comprobantes juntos y sale **UN correo** con la tabla de recibos y el **total pagado**. (Antes la app leía solo el primero: adjuntaba los 5 PDF pero el correo hablaba de una póliza y mostraba su monto — ₡92.555 de un total de ₡316.755.)

- **Con UN recibo el correo y la pantalla quedan EXACTAMENTE como los aprobó JC**: la tabla y el total aparecen a partir del segundo. `buildRenovacionEmail` sigue aceptando los campos sueltos (`poliza`, `placa`, `montoTexto`…) además de `recibos:[]`, así que lo viejo no se rompe.
- **Varios destinatarios (D1):** el campo "Para" acepta correos separados por coma — esposo y esposa reciben el mismo correo con todos los recibos. Se **sanean CR/LF** antes de armar el MIME (inyección de cabeceras).
- **Todos pagados o no se envía (D2):** JC fue literal — *"el envío de los recibos es solo cuando todos están pagados, no existe esa opción"*. El guard exige que **TODOS** digan Pagado; el que no, se nombra y hay que quitarlo con la ✕. **No hay forma de forzar el envío.**
- **Titulares distintos = plan familiar, NO un error (D3):** los recibos vienen a nombre de esposo, esposa, hijos. **No se bloquea ni se separa.** El agente pone el nombre del **dueño del plan** (a quien se dirige el correo) y la tabla lleva columna **"Asegurado"** para saber cuál póliza es de quién. Esa columna aparece **solo** si los titulares difieren.
- **Quitar un recibo saca también su PDF** de los adjuntos: mandar un comprobante que el correo no menciona confunde al cliente. Y al revés: quitar el PDF del adjunto borra su renglón.
- **El total se recalcula** al corregir un monto a mano (`parseMonto` sobre lo que escriba el agente).
- **Vista 4, tres botones (D4):** 1 = *Enviar otro recibo — mismo cliente* (conserva correo y saludo, para el recibo que llega a destiempo) · 2 = WhatsApp · y aparte, en gris, *Enviar a otro cliente* (reinicia todo). Los dos de salida **preguntan si todavía no se avisó por WhatsApp**, con opción de continuar igual — eso pidió JC.

### Decisiones de JC (10 ago 2026) — no cambiar sin consultarlo

**D1** extracción directa, campos editables · **D2** vista 4: **1 = Enviar otro comprobante, 2 = WhatsApp** (como Pólizas Activas; al revés que el cotizador, a propósito) · **D3** fondo propio con el estándar de la casa · **D4** **cross-sell SIEMPRE** (Viaje + Estudiantil): *"a veces solo le enviamos algo una vez al año o dos"* · **D5** nombre "Renovación confirmada" · **D6** "Nota de **su** agente" · **D7** el guard de arriba. Ajustes suyos: "Adjunto encontrará…" en **párrafo aparte con aire**, y logotipo SDI del pie en la variante **actualizada** (kit v1.2, barra de 4 colores).

### 🔴 Dos lecciones que dejó la revisión adversarial (con los tests ya en verde)

1. **Si una pantalla sostiene un guard, el guard muere con el dato que lo justificaba.** `onFiles` apilaba archivos y `extractFromBest` se quedaba con el primero que calificara: el agente que cargaba un comprobante Pagado, volvía atrás y cargaba uno Pendiente **seguía viendo el verde del primero y el guard lo dejaba pasar**. Ahora **cargar por el paso 1 empieza de cero** (`limpiarCarga()`), "← Volver" limpia, y quitar el PDF fuente de la lista borra los datos que salieron de él (`state.srcName`).
2. **Nada de datos de clientes reales en el código, ni en comentarios.** Netlify sirve el JS **tal cual, sin build ni minificación**: un nombre o una placa real en un comentario es dato de cliente publicado. Quedaron por error en 6 archivos y se reemplazaron por los inventados de los tests. Los comprobantes reales se usan para verificar **fuera del repo**.

También salieron de ahí: el monto ahora sale de `bloqueDetalle()` (con 2 pólizas, `TOTAL A PAGAR` es la suma y no corresponde a la póliza que se nombra); `fillCompose` respeta lo que el agente editó (`dataset.touched`); y **las sub-páginas ganaron guard de perfil** — sin perfil, CFG conserva los defaults del dueño y el correo salía con SU licencia SUGESE (corregido en `/renovaciones/` **y en `/polizas-activas/`**, que tenía el mismo hueco).

### Canal del aviso: "Solo WhatsApp" (19 ago 2026) — opción A aprobada por JC

Hay clientes que no tienen correo o no lo usan. Antes el botón de WhatsApp
**solo aparecía después de enviar el correo**, así que no había forma de avisar
sin enviarlo. Ahora el paso 3 abre con un selector de canal
(`.canal-sw` → `[data-canal-op]`): **Correo + WhatsApp** (default) o
**Solo WhatsApp**. Commit `bdd3fdb`, tag `pre-solo-wa-19ago`.

- Los campos se marcan por **`data-canal`**: `"correo"` (Para, Asunto, Nota,
  adjuntos, iframe de vista previa) y `"wa"` (aviso ámbar + descargar, teléfono,
  vista previa del mensaje). `setCanal()` los muestra/oculta con `hidden`.
  El saludo NO lleva `data-canal`: lo usan los dos caminos.
- 🔴 **`[hidden] { display: none !important; }`** es obligatorio y está puesto:
  `.wa-nota` es `display:flex` y el display le gana al atributo. Es la trampa
  `[hidden]` vs display CSS de siempre — verificado con `getComputedStyle`.
- 🔴 **`limpiarCarga()` vuelve el canal a `'ambos'`.** Un modo pegado dejaría
  al siguiente cliente —que SÍ tiene correo— sin recibir nada, y el flujo
  terminaría igual en la pantalla de éxito: el agente no se enteraría.
- **El guard D7 no se debilitó**: `send()` valida `estadoOk()` ANTES de bifurcar,
  así que el camino sin correo pasa por el mismo control. Verificado con clic
  real: sin recibos pagados rebota al paso 2, igual que el camino largo.
- **El mensaje cambia una línea** (`buildRenovacionWaTexto`, parámetro
  `sinCorreo`): sin correo NO dice "Le acabo de enviar a su correo el
  comprobante" —ese correo no existe y el cliente lo esperaría con su
  comprobante adentro— sino "Aquí mismo le comparto el comprobante…", y la
  póliza pasa ANTES (lo que confirma la renovación es la póliza activa, no el
  envío). Con correo el texto quedó **idéntico** al aprobado el 10 ago.
- **El PDF lo arrastra el agente al chat**: WhatsApp no deja adjuntar archivos
  desde un enlace, así que sin correo el comprobante no llega por ningún lado.
  Por eso el botón **Descargar comprobante** (`bajarComprobantes`, descargas
  escalonadas 400 ms — varias en el mismo tick las bloquea el navegador).
- **El texto y la URL salen de la misma fuente**: `buildRenovacionWaUrl` ahora
  envuelve a `buildRenovacionWaTexto`. La vista previa del paso 3 usa el texto;
  dos copias derivarían.
- **El alias corto se pide UNA vez por sesión** (`state.urlGuiaCorta`): el
  enlace `/a` depende solo de la ficha del agente, no del cliente. Sin eso la
  vista previa mostraba la URL larga y el mensaje salía con la corta — el
  agente veía una cosa y el cliente recibía otra.
- El teléfono se digita en el paso 3 (`m-wa-pre`) y se vuelca a `m-wa-cliente`;
  la vista 4 esconde su propio campo (`#waTelWrap`) para no pedirlo dos veces, y
  las dos salidas lo restauran.
- **Solo se implementó en `/renovaciones/`.** `/polizas-activas/` y el cotizador
  tienen el MISMO problema — sus mensajes también afirman que se mandó un correo
  ("Le acabamos de enviar todos los documentos…", "Te acabo de enviar por correo
  la cotización…") — pero JC pidió empezar por una sola pantalla y replicar
  después si le sirve. Tests: 11 checks en `test-renovacion-email.js`.

### Reuso (economía de código, lo pidió JC)

~1.100 líneas, **0 dependencias nuevas**, **0 cambios en la Netlify Function** (el tipo `/a` ya existía). Reusa `poliza-extract.js` (normalize/titleCase/sugerirNombrePila/readPdfText) y `poliza-email.js` (`polizaAsistenciaUrl`/`polizaWaIntl`) — así la ficha del agente y el saludo no derivan en dos copias. El correo lleva la URL **larga** de la guía (armar el correo no depende de la red); el WhatsApp la **corta** con `acortarEnlace(..., 'a')` y fallback al largo. Mensaje WA: **616 → 487 caracteres**.

**Tests:** `test-renovacion-extract.js` (51) + `test-renovacion-email.js` (78). Fixtures con la estructura real y **datos inventados**: los comprobantes reales traen nombres y cédulas de clientes y **NO entran al repo** (la verificación contra los PDF reales se corre aparte).

## Documentos estándar auto-adjuntos (documentos-ins/ + standard-docs.js) — NUEVO 29 jun 2026

Carpeta `documentos-ins/` con PDFs oficiales del INS, **servida en prod** (netlify.toml solo 404ea `/docs/*`, `/tests/*`, `.md`). `js/standard-docs.js` = manifiesto `STD_DOCS = { cotizacion:[…], poliza:[…] }` + `loadStdDocs(list)` (fetch best-effort, `cache:'no-cache'`, devuelve `{docs, failed}` — un 404 avisa con toast pero NO bloquea el envío).

- **Cotización**: adjunta el **Deber de Información Autos** además del PDF de cotización (`app.js` pasó de `buildMIME` a **`buildMIMEMulti`**).
- **Póliza**: adjunta los **5 estándar** (C.O. Multiasistencia, Pacto Amistoso, C.O. Accidente Menor/DAM, Condiciones Generales SVA, Perfeccionamiento) además de los PDF que sube el agente.
- **CÓMO ACTUALIZAR versiones** (lo pidió JC): reemplazar el PDF en `documentos-ins/` (mismo nombre) o cambiar `path`/`name` en el manifiesto → commit + push. `test-standard-docs.js` verifica manifiesto↔archivos existen + nombres ASCII.
- **Ojo**: `deber-de-informacion-autos.pdf` y `perfeccionamiento-sva-v31.pdf` son el **MISMO documento** del INS (información previa al perfeccionamiento = cumple el deber de información). Se guardan como archivos separados por módulo para poder divergir a futuro.

## (ELIMINADO 29 jun 2026) Coberturas vigentes /coberturas/ + /detalle/

Se eliminó por completo el módulo de "detalle de coberturas vigentes": botón amarillo 🛡, carpetas `/coberturas/` y `/detalle/`, `js/coverage-url.js`, `buildCoverageEmail()` (en email-template.js) y los tests `test-coverage-url`/`test-coverage-email`. Reemplazado por el botón 📨 → /polizas-activas/. **No reintroducir sin pedido explícito de JC.**

**Rastro para recuperarlo si JC alguna vez lo pide de vuelta** (el código sigue vivo en el historial de git, no hay que reescribirlo):
- **Tag de rollback `pre-coberturas-vigentes-14may`** (existe en el repo). ⚠️ Verificado en git: **apunta a `e031693`**, o sea al **último commit de la rama `feat/coberturas-vigentes`**, NO al punto de main anterior al merge. El punto de main previo al merge es `ee8e3c9`; el merge es `945871e`. (Documentos viejos que dicen "apunta al HEAD pre-merge" están imprecisos — este es el dato real.)
- **Spec:** `docs/superpowers/specs/2026-05-14-detalle-coberturas-vigentes-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-14-detalle-coberturas-vigentes.md`
- Los dos siguen versionados en el repo (commit `ee8e3c9`); `netlify.toml` 404ea `/docs/*`, así que no se sirven en prod.
- Commits de la feature: `be38baf` (campo whatsapp) · `503fc27` · `9f8946b` · `448d32d` · `3515472` · `be7a960` · `e031693` · merge `945871e` · `c4d3a0c` (docs/skill).
- De ahí salió el **campo `whatsapp` del perfil ⚙**, que SÍ sigue vivo y en uso.

## Marcas con recargo (/marcas-recargo/)

**58 entradas** literales (marca × combustible) del Excel oficial INS "Marcas Alta Siniestralidad.pdf" — verificado en el `DATA` de `marcas-recargo/index.html`. Fuentes citadas al pie: Circular 0186-2025 (alta gama) y Circular 0324-2025 (asiáticas). Columnas: Marca · Combustible · ¿Recargo? · Deducible aplicable. Deducible único para todas: **20% con mínimo de ₡500.000**. Solo para consulta del agente — NO mostrar al cliente. Botón **📋** en el header del cotizador, abre en pestaña nueva.

**Layout de la página (no romperlo al editar):**
- **2 reglas resumen ARRIBA de la tabla** (`.rules-grid` con 2 `.rule-card`), porque son reglas distintas y confundirlas es el error clásico:
  - 🌏 **Regla por marca / origen** ("Aplica según la tabla de abajo"): deducible **único 20% del daño, mínimo ₡500.000 / $830** en daño directo. Que la marca esté en la tabla es lo que decide si el agente activa el toggle **🌏 origen asiático** en el cotizador.
  - 💎 **Regla por alta gama** ("Independiente de la marca"): aplica cuando la **suma asegurada ≥ ₡50.000.000**, deducible **escalonado 10% mín ₡500k** en pérdidas ≤ ₡6M y **20%** en pérdidas mayores. El toggle 💎 se activa **según la suma, no según la marca**.
- **Filtros:** buscador de texto por marca (`#search`, placeholder "🔍 Buscar marca (ej. BYD, Mercedes, MG)") + **3 chips** (`#chips`, `data-filter`): **Todas** (`all`, activo por defecto) · **Recargo aplica** (`si`, chip rosado) · **No aplica** (`no`, chip gris). Búsqueda y chip se combinan (AND) y el contador `#resultCount` muestra cuántas filas quedan.

- **NO corregir la ortografía de los datos** (MASERATTI, CHERRY, DONG-FENG) — son literales del documento INS. Para búsqueda con grafía comercial correcta hay un objeto `ALIAS` (Maserati→MASERATTI, Chery→CHERRY, etc.).
- **Ojo recargo ≠ marca asiática**: varias marcas chinas tienen filas "No Aplica" (MG, JAC, CHANGAN, BYD gasolina, ZXAUTO, FUSO, RENAULT/PEUGEOT gasolina, SUZUKI). El toggle 🌏 del cotizador debe marcarse SOLO si la fila marca×combustible aparece como "Sí aplica". El hint del toggle ya refiere a esta tabla (corregido 11 jun — antes listaba MG/JAC/CHANGAN como ejemplos de "aplica", lo cual era falso).
- **Cotejada contra la fuente oficial el 11 jun 2026:** faltaba **SUZUKI** (Eléctrico + Híbrido, "No Aplica") → se agregó, la tabla pasó de 56 a **58 filas** y ahora coincide con el PDF del INS. **NO están en la fuente oficial** (no agregarlas sin documento nuevo): GWM/HAVAL, JETOUR, OMODA/JAECOO, EXEED.

## Pestaña de estadísticas (📊) — ⚠️ HISTÓRICO: rehecha el 9 set 2026

> 🔴 Lo que sigue describe el 📊 **anterior** (ciclo de estados a mano, seguimiento a 3 días, citas).
> Todo eso se retiró: ver "El 📊 se simplificó" arriba. Se conserva por el detalle de `clientFull`,
> del buscador y de la recuperación de valor legacy, que siguen vigentes.


Botón **📊** en el header → modal ancho `statsModal`. **EN PROD 16 jun 2026** (commit `e71f82d`). **100% aditiva**: reutiliza el historial `localStorage` (`cotizador_sdi_history_v1`); no toca envío, correo ni PDF.

- **KPIs (embudo):** Enviadas · Agendadas · Concretadas · Desechadas · **Conversión** (= concretadas/enviadas; "—" solo si no hay cotizaciones). *(17 jun: era "tasa de cierre" resueltas-only — JC la cambió a conversión porque con muchas pendientes el % engañaba.)*
- **Ciclo de estados por fila (17 jun):** `<select>` con **Pendiente → Agendada → Concretada / Desechada** (reemplazó la casilla `.stat-check`). Al elegir Agendada aparece la **fecha de cita** (`<input type=date>` con etiqueta "Cita:", recibe foco). `setHistoryEstado(id,estado[,citaFecha])` sincroniza `confirmed` y limpia `citaFecha` al salir de agendada. `historyEstado(e)` migra legacy `confirmed:true`→`'concretada'`. Color de fila por estado; `_onStatsListChange` restaura foco/scroll tras el re-render. **Orden de embudo** (`_estadoOrden` + sort estable en `_applyStatsFilters`): **Concretadas → Agendadas** (cita más próxima primero) **→ Pendientes → Desechadas**.
- **Buscador por placa / cliente (commit `95d90db`):** input ESTÁTICO `#statsSearch` (NO se repinta en `renderStats` → no pierde el foco al teclear; ese es el motivo de que viva en el HTML y no en innerHTML) + botón ✕ `#statsSearchClear` + contador `#statsSearchCount`. Filtra la lista por **placa, nombre del cliente (completo o de pila) o vehículo**, tolerante a tildes/mayúsculas/separadores (`BCS-123`≈`bcs123`, `hernandez`≈`Hernández`). **5 ago 2026:** busca también por APELLIDO — ver `clientFull` abajo. Se combina con mes/alto-valor/seguir (AND). Estado `_statsSearch`; `_onStatsSearch`/`_clearStatsSearch` (Escape limpia); `openStatsModal` resetea y pone el foco en el buscador. Caso de uso: cliente confirma → encontrarla al instante para marcar Concretada.
- **Por mes:** barras CSS puras (sin libs); clic en un mes filtra todo. **Filtro ⭐ Alto valor ≥₡10M** (`STATS_HIGH_THRESHOLD` en app.js) → estrella + monto en la fila.
- **Contador + filtro ⏳ Para seguir (16 jun, commit `ba0daab`):** cada fila muestra "hace N días" (`.stat-ago`); insignia `⏳ seguir` (`.history-badge.fu`) + chip de filtro para enviadas hace **+3 días, SIN confirmar y aún vigentes (≤15d)**. Lógica en `historyDaysSince`/`historyNeedsFollowUp` (history.js). El estado de chip es **`_statsFilter`** ('all'|'high'|'followup') — reemplazó al viejo booleano `_statsHighOnly`.
- **Seguimiento por fila:** 💬 WhatsApp (`buildWaFollowUpUrl`, mensaje DISTINTO al de compartir guía) + ✉️ correo de seguimiento (`buildFollowUpEmail`, texto+colores SIN imágenes; `buildMIMESimple` MIME sin adjunto; `getToken`→`sendEmail`).
- **Eliminar registro (16 jun, commit `8b9ef21`):** botón 🗑 (`.history-btn.danger`) por fila → `deleteHistoryEntry(id)` con `confirm()`. Para borrar pruebas/duplicados; PERMANENTE (no hay papelera). Re-render con `renderStats()`. El historial es compartido → desaparece también del modal 🕘.

**Capa de datos (history.js, PURAS y testeables):** `historyEstado`, `setHistoryEstado(id,estado[,cita])`, `historyCitaHoy`, `newHistoryId`, `ensureHistoryIds`, `setHistoryConfirmed` (wrapper→concretada/pendiente), `historyEntryValue`, `historyEntryPlate` (placa, con fallback al param `p=` del guideUrl para legacy), **`historyClientName`** (`clientFull || client`), `historyMatchesSearch`/`_normHistorySearch` (búsqueda tolerante a tildes/separadores), `historyMonthKey`, `computeHistoryStats` (rate = concretadas/(concretadas+desechadas)), `groupHistoryByMonth`. Cada entry lleva `id`, `estado`, `citaFecha`, `confirmed` (sync back-compat), `valor`, `plate`, `clientFull`.

### 🔑 `client` vs `clientFull` — los DOS nombres del cliente (5 ago 2026, commit `0089472`)

Regla corta: **`client` es para hablarle al cliente; `clientFull` es para que el agente lo encuentre.**

| Campo | Qué guarda | De dónde sale | Quién lo usa |
|---|---|---|---|
| `client` | Nombre de PILA ("Silvia") | `#m-name` (vista 3, el saludo) | El texto DENTRO de los mensajes: `buildWaShareUrl`, `buildWaFollowUpUrl`, `buildFollowUpEmail({nombre})` |
| `clientFull` | Nombre COMPLETO ("DELGADO ARGUELLO SILVIA MARIEL") | `S.data.clientName` (vista 2, lo que trae el PDF del INS) | Mostrar y BUSCAR: 🕘 historial, 📊, aviso de citas, confirmación de borrado |

**Por qué existe:** el registro guardaba solo el nombre del saludo, así que JC no podía buscar por apellido — que es como uno se acuerda de un cliente. **Nunca cambiar `client` al nombre completo**: el WhatsApp le llegaría al cliente diciendo "Hola DELGADO ARGUELLO SILVIA MARIEL". Para mostrar, siempre `historyClientName(e)`, nunca `e.client` pelado.

**Sin backfill posible:** las entradas anteriores al 5 ago 2026 no tienen el apellido en ninguna parte — el param `c=` del `guideUrl` también es el saludo. Caen al nombre de pila y se siguen encontrando por placa. No inventar una migración que "recupere" el apellido: no hay de dónde.

**Render/handlers (app.js):** `openStatsModal`/`closeStatsModal`, `renderStats` (también actualiza `#statsSearchCount`), `_applyStatsFilters` (mes → alto-valor/seguir → **búsqueda** → orden de embudo), `_statsKpisHtml`/`_statsMonthsHtml`/`_statsFiltersHtml`/`_statsListHtml`, handlers DELEGADOS (`_onStatsMonthClick`/`_onStatsFilterClick`/`_onStatsListChange`/`_onStatsListClick`) + `_onStatsSearch`/`_clearStatsSearch` (input directo, no delegado), `sendFollowUpEmail`, `_fmtRate`/`_fmtMillones`.

**Recuperación de valor (clave):** para cotizaciones previas a la feature (sin campo `valor`), `historyEntryValue` lo recupera del param `va=` embebido en `guideUrl`. Así ⭐ y filtro ≥₡10M funcionan con TODO el historial.

**Decisiones (JC):** **17 jun SUPERSEDE la casilla simple** → ciclo de estados (Pendiente/Agendada/Concretada/Desechada) con **Conversión** = concretadas/enviadas (probamos "tasa de cierre" resueltas-only pero confundía → quedó conversión). **Descartar sugerencia de seguimiento:** botón ✕ en el aviso "Para seguir" → `dismissFollowUp` (flag `followUpDismissed`; saca del aviso/badge sin enviar, sigue pendiente). Página dedicada (no dentro del modal 🕘). Ambos canales de seguimiento (WA + correo).

## Seguimiento semi-automático (correo a 3 días)

**EN PROD (commit `2f6967f`).** Semi-automático SIN backend: se dispara cuando el agente abre la app.
- **Aviso al inicio** (`#avisoModal`, `maybeShowAviso()` vía `setTimeout(…,400)`): **2 secciones** (17 jun) → 📅 **Citas de hoy** (`_citasHoy`→`historyCitaHoy`; botones Concretada/Desechada por fila vía `_onAvisoCitasClick`→`setHistoryEstado`) + ⏳ **Para seguir** (`_pendingFollowUps` = `ensureHistoryIds` [migra ids legacy, **CRÍTICO**] + `historyNeedsFollowUp` + orden por antigüedad). `_refreshAviso` repinta y cierra cuando no queda nada.
- **Un solo seguimiento:** al enviar se marca `followUpAt` (`setHistoryFollowUp`); no vuelve al aviso. `historyNeedsFollowUp`/`historyFollowUpState` (→`'seguir'|'seguido'|null`) **solo aplican a estado 'pendiente'** (agendada/concretada/desechada salen del flujo). La antigua auto-"desestimada" se quitó: ahora el agente desecha manualmente.
- **Envío:** `sendAllFollowUps()` (todas; un `getToken` + reintento si el token cae a mitad del lote) o ✉️ por fila. `_sendOneFollowUp(entry)` valida el correo (fail-closed), arma con `buildFollowUpEmail` + `buildMIMESimple`, envía y marca followUpAt.
- **Snooze:** "Ahora no"/cerrar pospone por hoy vía `sessionStorage['cotizador_sdi_aviso_snooze']` (no molesta en cada recarga; reaparece al día siguiente / nuevo navegador).
- **Plantilla** (`buildFollowUpEmail`): lead **"El aseguramiento es muy sencillo"** + recordatorio fotos/token/pago (100% en línea) + botón **Agendar** (`CFG.AGENDA_URL` del agente) + enlace a la guía. Texto+colores SIN imágenes. `contacto` usa **`CFG.PHONE` primero** (obligatorio) — NUNCA WHATSAPP primero (filtraría el de JC). `href` saneados con `_safeUrl` (solo http/s, escapados).
- **Multi-agente:** todo por CFG/perfil; cada agente envía desde SU Gmail. `agent-profile.js` asigna WhatsApp siempre (incl. vacío, para que limpie el default).
- **Guards anti-legacy:** `setHistoryConfirmed`/`setHistoryFollowUp`/`deleteHistoryEntry` hacen `if (!id) return false` — un id falsy matchearía una entrada legacy equivocada vía `find(undefined)`.

## Respaldo del control en Google Drive (js/drive-sync.js) — 15 jul 2026, EN PROD

**Por qué existe:** el control de cotizaciones (historial + estados 📊 + perfil del agente) vivía SOLO en `localStorage` y se perdió cuando JC limpió el navegador. Ahora se respalda en la carpeta **`appDataFolder`** — carpeta oculta y privada por-app dentro del Drive de cada agente. Commit `0a468c5`, verificado por JC en producción.

- **Token OAuth SEPARADO, no compartido con Gmail:** `S.driveToken` (scope `drive.appdata`, cliente propio `S.driveTokenClient`) es independiente de `S.accessToken` (scope `gmail.send`). **Si un agente no autoriza Drive, el envío de correos sigue funcionando igual.** No fusionar los dos tokens.
- **Multi-agente por diseño** ([[cotizadores multi-agente]]): `appDataFolder` es por-cuenta-Google, así que cada agente respalda en SU Drive, aislado. Nada hardcodeado a JC.
- **API:** `driveBackup` (merge-antes-de-escribir, nunca pisa a ciegas), `driveRestore` (fusiona con lo local), `scheduleDriveBackup()` (auto-respaldo **debounced 2.5 s**, silencioso), `driveBackupEnabled()`, `clearDriveToken()`.
- **`history.js`:** `mergeHistories(a,b)` = unión sin pérdida, gana el `updatedAt` más nuevo; `replaceHistory(arr)`; sello `updatedAt` en cada entry; **choke-point `_afterHistoryChange()`** — toda mutación del historial pasa por ahí y dispara el respaldo. Si agregás una función que escriba el historial, llamala.
- **UI:** sección **☁️** en el modal ⚙ con "Sincronizar ahora" / "Restaurar de Drive" + estado; botón de restaurar también en el historial vacío. El perfil se restaura **solo si el navegador no tiene uno** (caso post-limpieza) → recarga.
- **Flags localStorage:** `cotizador_sdi_drive_v1` ('1' = activado) y `cotizador_sdi_drive_last_v1` (ISO del último respaldo con éxito).
- **Cada agente nuevo, una vez:** ⚙ → "Sincronizar ahora" → aceptar el popup de Drive. Para recuperar tras limpiar el navegador: abrir la app → historial vacío o ⚙ → "Restaurar de Drive".
- **Tests:** `tests/test-history-merge.js` (11, verde).
- **Verificado en prod:** "Sincronizar ahora" → ✅ "Respaldo activado… (4 cotizaciones)".

**⚙️ OPERATIVO Google Cloud (pasos que hizo JC — clave para reproducir en otro proyecto):** en el proyecto **"Cotizador Autos SDI"** (ver "Recursos y accesos"): (1) habilitar la **Google Drive API**; (2) Pantalla de consentimiento (Google Auth Platform) → **Acceso a los datos** → agregar el scope `drive.appdata` → Guardar. Google marca `drive.appdata` como **NO SENSIBLE**, así que **no requiere trámite de verificación**. `gmail.send` ya estaba (es restringido).

## Menú lateral "Consola" (7 ago 2026, `8ecb819`) — SOLO en index.html

Los 6 accesos vivían como emojis sueltos (`🧮 📋 📨 📊 🕘 ⚙`) apretados en la esquina
derecha del header: sin nombre, sin orden, había que acordarse de cuál era cuál. JC
eligió esta opción entre dos mockups ("Consola por mucho"). Barra navy de **238px** a
la izquierda, icono SVG de trazo + **nombre**, agrupados:

| Grupo | Accesos |
|---|---|
| **Enviar** | Cotización nueva (indicador) · Póliza activa → `polizas-activas/` · **Renovación confirmada → `renovaciones/` (10 ago 2026)** |
| **Mi control** | Estadísticas (`#btnStats`) · Historial (`#btnHistory`) |
| **Consulta** | Cancelación anticipada → `cancelacion/` · Marcas con recargo → `marcas-recargo/` (pestaña nueva) |
| **Cuenta** | Configuración (`#btnSettings`) |

Al pie del rail, nombre + licencia del agente; en el header, sus iniciales
(`#hdrAgentIni`). Los pinta **`paintRailAgent()`** desde CFG (multi-agente), y se
vuelve a llamar en `handleProfileSave`.

- 🔴 **Los ids `btnStats` / `btnHistory` / `btnSettings` NO se renombran.** `app.js`
  los engancha por `getElementById` en el `DOMContentLoaded`; si uno falta, ese
  `addEventListener` lanza y **revienta el resto del arranque** — la app queda a medias
  (es el "render cascade failure" del proyecto). Se comprobó con clic real en producción:
  los 3 modales abren.
- **Va SOLO en `index.html`.** Las 3 sub-páginas **nunca tuvieron** esos botones: cada
  una tiene su propio "← Cotizador" (`/cancelacion/` usa `.btn.btn-secondary`, las otras
  `.back-link`). No meterles el rail sin que JC lo pida.
- **Todo el CSS cuelga de `.app-shell` / `.side-rail`**, clases que solo existen en
  index.html — las sub-páginas cargan la MISMA hoja. Misma precaución que `.ded-guide`
  y los fondos `page-cotizar`/`page-poliza`.
- **`--header-h` se MIDE, no se hardcodea** (`_syncHeaderHeight`, también en `resize`):
  el header envuelve sus filas en pantallas angostas y pasa de 64 a 112px. El rail es
  `position:sticky; top:var(--header-h)`.
- **"Cotización nueva" es un `<div>`, no un botón**: es indicador de posición
  (`aria-current="page"`). Hacerlo clickeable reiniciaría el flujo y perdería la
  cotización a medio cargar; para eso ya está el botón de la vista 4.
- `.app-shell` lleva un `linear-gradient` que mantiene la franja navy hasta abajo: el
  rail mide una pantalla y en las vistas 2 y 3 (largas) se vería el fondo verde asomando.
- **Bajo 900px** el rail pasa a fila horizontal arriba del contenido; se ocultan los
  rótulos de grupo y la ficha del agente.
- 🔴 **El rail lleva `height: calc(100vh - var(--header-h))` + `overflow-y:auto`. NO
  quitar el overflow.** Con `min-height` la franja llegaba abajo pero el CONTENIDO
  (542px: 7 accesos + 4 rótulos + ficha) no cabía en ventanas bajas, y al ser `sticky`
  tampoco subía con el scroll: **Configuración quedaba fuera de pantalla e inclicable**,
  y desde el rediseño ese botón es la ÚNICA entrada al perfil. Disparador real: portátil
  1366×768 con zoom al 150% → 911×470 CSS px, y 911 > 900 así que la media query no
  rescata. Corregido el 7 ago (`057f734`), verificado en producción a 1000×470.
- **Contraste sobre el navy: mínimo `#94a3b8` (6.16:1).** Los grises más oscuros no
  llegan al 4.5:1 de AA a 9–11px. En el pie del rail va la **licencia SUGESE**, que es
  dato regulatorio y estuvo en 2.91:1 hasta el 7 ago. El nombre del agente va `#e2e8f0`.

## Identidad de marca SDI (7 ago 2026) — EN PROD

**La regla que ordena todo, del README del Brand Kit: son DOS marcas.** *Seguros
Digitales SDI* es la empresa de software; *Seguros del INS* es la actividad de agente
de JC. Ratificado por él: **"el logo del INS y que diga INS arriba es importante, la
sección del cliente siempre debe ir el INS arriba visible y SDI en las secciones mías
y del agente"**.

| Superficie | Marca | Dónde |
|---|---|---|
| **Consola del agente** | 100% SDI, **cero INS** | `index.html`, `/polizas-activas/`, `/cancelacion/`, `/marcas-recargo/` |
| **Cara al cliente** | **INS ARRIBA y visible** + SDI al pie como plataforma | los 2 correos y `/explicacion/` |

- **Kit central: `C:\Users\segur\SDI-BRAND-KIT`** (logos v1.1 + `sdi-tokens.css`). Todos
  los proyectos copian de ahí. El generador de los SVG está en el scratchpad de la
  sesión (`gen-logo.cjs`); si se pierde, se regenera con las medidas de abajo.
- El header lleva el **logotipo oficial PEGADO en el HTML** (`.brand-mark`), no `<img>`.
  El fondo se queda **navy**: se probó el azul institucional #0369A1 y **JC lo descartó
  por verse demasiado claro**. El azul manda en botones, foco y en el 60% del filete.
- **Filete de marca** bajo el header (`.app-header::after`): 60/25/10/5 azul·verde·
  naranja·dorado. Es lo único que mete el **dorado #C9A227**, la firma SDI.
- **Logo v1.1 — las medidas, todas medidas en el navegador, no a ojo:** mayúsculas de
  Space Grotesk 500 a font-size 82 = **59** de alto (baseline 74, tope 15); trazo de la
  "I" = **9**; ancho del wordmark = 112.1; ancho del tagline = **201.8**. De ahí: barra
  de **4 franjas de 9 con huecos de 7.67** (= 59 exacto, alineada al tope y a la base),
  en **x=140** (18 de aire; antes 62.9 y 36 de alto, un 39% más baja).
- 🔴 **DOS anchos de viewBox, y confundirlos rompe el logo:** sin tagline **180**; con
  tagline **222**, porque el tagline es MÁS ANCHO que el bloque wordmark+barra y con 180
  el SVG le comía la S inicial y la final ("EGUROS DIGITALE"). Lo cazó JC en producción.
- Se corrigió que `img/sdi-logo.svg` decía **"SEGUROS DIGITALES INS"** (fusionaba las dos
  marcas en un logotipo, en la única página que ve el cliente) y que los `<title>` de
  `index.html` y `/cancelacion/` decían lo mismo.
- **El mismo logo v1.1 se replicó** a `cotizador-plenisalud`, `APP-ASISTENCIA-SEGURO-AUTOS`
  y `Desktop/sdi-portal`. ~~El portal NO se pudo pushear~~ — **resuelto**: verificado el 19 ago 2026 que
  `jhernandez-vibecode/sdi-portal` existe (privado) y su commit `7a9fc5f` está sincronizado con origin.
- ~~PENDIENTE — vectorizar el wordmark.~~ **HECHO el 7 ago** (commit `dac97d1`, kit v1.2): verificado el
  19 ago que los SVG de Plenisalud, Asistencia Autos y Cotizador ya son `<path>` y no `<text>`. Lo que
  sigue abajo queda como registro del problema que resolvió. Los SVG dibujan "SDI" con `<text>` pidiendo
  Space Grotesk por nombre; insertados con `<img src>` (Plenisalud, Asistencia Autos,
  Portal) el navegador no puede cargar la fuente y el wordmark cae a la del sistema, ~9%
  más ancho. Ya está `fonttools`+`brotli` instalados y el path generado
  (`vectorizar.py` en el scratchpad); su caja da 110.9×59.7 contra 112.1×59 medido — la
  diferencia es el **overshoot** normal de la "S", no un error.

## Jornada 7 ago 2026 — enlace corto en el aviso de póliza + el byte NUL

Lo pidió JC: *"podemos acortar el link que enviamos por WA cuando la póliza está
lista, como hicimos en otros proyectos"*. El acortador ya existía en el repo, pero
solo sabía redirigir a `/explicacion/` del mismo sitio con los parámetros del
explicador; el de la póliza apunta a **otro sitio** con **otros parámetros**, así
que hubo que ampliarlo (ver la sección de enlaces cortos).

**Lo que cambió:** ruta `/a/:id` en la Function; `js/shortlink.js` nuevo con
`acortarEnlace(url, tipo)` (cargado en las dos páginas, `acortarGuia` quedó de
wrapper); `buildPolizaWaUrl` acepta `urlGuia`; el clic del botón de WhatsApp de
`/polizas-activas/` acorta antes de abrir; validadores movidos a
`netlify/functions/lib/validacion.mjs` para poder testearlos con Node pelado.
**El texto del mensaje NO se tocó** — cambia solo el enlace: 710 → 581 caracteres.

### 🔴 El byte NUL que se lee como un espacio

Al reescribir `enlace.mjs` se rompió (y se cazó a tiempo) el acortador de la guía
que YA funcionaba en producción. Causa: la línea

```js
if (/[\r\n<NUL>]/.test(v)) return false;
```

tenía el **byte NUL crudo** dentro de la clase de caracteres. Al leer el archivo se
ve `/[\r\n ]/` — **idéntico a un espacio**. Reescribirlo pone un espacio de verdad,
y ahí el acortador empieza a rechazar todo nombre con espacios (o sea, todos).

- El archivo **de producción** cargaba 1 byte NUL desde el 28 jul; quedó **limpio**
  el 7 ago — el NUL se escribe ahora con su secuencia de escape (barra invertida
  + `u0000`), visible en el fuente, y la validación se mudó a `lib/validacion.mjs`.
- **Cómo se detectó:** un test que usaba `n=Juan%20Carlos` falló; se contrastó
  contra producción con `curl -X POST /g` (que respondió 200) y se ubicó el byte con
  `Buffer.indexOf(0)`. Sin ese contraste, la conclusión natural — "el guard rechaza
  espacios, siempre estuvo roto" — era **falsa**.
- Git lo delataba y nadie lo miró: el archivo aparecía como **`Bin` en `git diff
  --stat`**. Un `.mjs` que git considera binario = tiene un byte de control.
- Misma familia que la regla de los acentos por charCode en `email-template.js`:
  **nada de caracteres invisibles en el fuente**.

## Jornada 6 ago 2026 — guía del deducible + fondo por pantalla (EN PROD)

Dos pedidos de JC, los dos puramente visuales y **100% aditivos**: no tocan extracción de PDF, correo, envío ni historial. Los 10 archivos de test siguen en verde.

### 1. Guía del deducible en la vista 1 (commit `d9ab693`)

`<details class="card ded-guide">` **dentro de `#view1`, debajo de la tarjeta de cargar el PDF**. Es material de **consulta interna del agente**, NO del cliente: por eso vive en la consola y no en `/explicacion/`.

- **Cerrada siempre** (sin atributo `open`): en reposo ocupa una línea de 64 px. JC lo pidió así explícitamente — "cerrada y el que lo necesite consulta".
- Dos bloques de 3 tramos cada uno, más leyenda de 3 colores:
  - **Cobertura C con exención "N"** (deducible ordinario 20% mín ₡150.000): `<₡150.000` sin indemnización · `₡150.000–₡750.000` el cliente paga ₡150.000 (la "N" **no** cubre el mínimo) · `>₡750.000` el INS paga 100% (opera el 20% y la "N" lo exime). El corte de ₡750.000 **no es arbitrario**: es `150.000 ÷ 0,20`, el punto donde el porcentual supera al mínimo. Si alguna vez se cambian los montos del ejemplo, ese quiebre se recalcula.
  - **D, F y H con IDD** (deducible fijo ₡400.000, IDD contratada por ₡400.000): `<₡400.000` sin indemnización · `>₡400.000` eventos **1 y 2** el INS paga 100% · `>₡400.000` **evento 3** el cliente paga el deducible (se agotó el límite anual). Los 2 eventos son los de **IDD2**.
- **Los montos son EJEMPLOS.** Arriba del bloque va una nota gris: *"Ejemplos de referencia para consulta interna. En cada caso mandan los montos que trae el PDF de la cotización o la póliza del INS."* **No quitarla**: JC es agente SUGESE y esos números leídos como fijos serían una promesa que la póliza no respalda.
- ⚠️ **Ojo con el monto de la IDD**: el ejemplo usa **₡400.000** (tal como lo mandó JC), pero él cotiza siempre con **IDD2 de ₡500.000**. Es un caso válido (IDD contratada justo por el deducible), pero se le avisó. Si alguna vez pide alinearlo a su estándar, hay que cambiar los tres tramos del segundo bloque **y** el subtítulo.
- **CSS anidado bajo `.ded-guide`** en `css/styles.css` — obligatorio, porque `/polizas-activas/` carga la misma hoja y no debe heredar nada. Filas oscuras (`#5b1a1f` rojo · `#63400b` ámbar · `#10493f` verde) con texto blanco; bajo 620 px las dos mitades se apilan con un separador translúcido.

### 2. Fondo tenue que distingue las dos pantallas (commit `73e37f0`)

JC: *"la pantalla de cotizar y envío de póliza son casi iguales"*. Comparten header navy, tarjetas blancas y step-nav, así que de reojo se confunden.

- `body.page-cotizar` → **verde `#edf6f0`** (`index.html`)
- `body.page-poliza` → **azul `#ebf2fc`** (`polizas-activas/index.html`)
- **Solo el `<body>`.** Las tarjetas siguen `#fff`, así que ningún texto cambió de contraste. Las páginas sin clase (`/cancelacion/`, `404.html`) conservan el `--gray-50` de siempre.
- **Página nueva que cargue `css/styles.css`**: arranca con el gris. Si es otra pantalla del mismo flujo, ponerle su clase; **no** mover el tinte a la regla global de `body`, que borraría la distinción.

## 🔴 El tope del historial NO se aplica al respaldo (incidente del 21 ago 2026)

**Lo que reportó JC:** *"otra vez se borró parte del historial y al restaurar el respaldo no hace nada, se borró el
historial de julio"*. En 📊 se veía **Enviadas: 100** y **un solo mes en "POR MES": Ago 2026**. Junio y julio no estaban
recortados: habían desaparecido enteros.

**La cadena, tal cual era.** `HISTORY_MAX = 100` no era solo el tope del navegador: lo respetaban las tres capas.
1. `saveHistoryEntry` recortaba local y soltaba la más vieja.
2. `mergeHistories` recortaba **la unión** local+Drive.
3. `driveBackup` subía **esa lista recortada** a Drive, pisando el respaldo que sí tenía julio.

De ahí los dos síntomas a la vez: se pierde lo viejo **y** restaurar no devuelve nada, porque Drive ya trae exactamente
las mismas 100 que el navegador. **La red de seguridad era la que borraba la red.** El test de entonces
(`'tope HISTORY_MAX (100) se respeta al fusionar'`) daba verde: codificaba el comportamiento destructivo como correcto.

**Cómo quedó:**
- `HISTORY_MAX = 2000` y es el tope **SOLO del navegador** (~1,3 MB de los ~5 MB de localStorage).
- `mergeHistories(a, b, cap)` y `replaceHistory(arr, cap)` reciben el tope; **a Drive se fusiona con `Infinity`**.
  El respaldo es **ACUMULATIVO**: guarda todo lo que existió, aunque el navegador muestre menos.
- `_persistHistory(list)`: si localStorage no acepta el tamaño, recorta lo más viejo por mitades en vez de perder la
  escritura entera en silencio (antes un envío nuevo podía simplemente no quedar registrado).
- `driveBackup` **no reescribe si Drive ya tiene exactamente lo mismo** (`_mismoContenido`). Cada escritura crea una
  versión del archivo y Google conserva un número limitado: escribir de gusto empuja al borrado las versiones viejas,
  que son las únicas que permiten rescatar algo perdido.
- `driveRestore` devuelve `merged` (lo que quedó en el navegador) **y** `total` (lo que hay en el respaldo).
- Tests: el que faltaba es **`mergeHistories con Infinity NO recorta`** + `el respaldo conserva lo que el navegador ya
  soltó`. El test lee `HISTORY_MAX` **del fuente** (una `const` dentro de un `eval` directo no se filtra al scope del
  test; las `function` sí — por eso `mergeHistories` se veía y `HISTORY_MAX` no).

🔴 **La regla, que vale para cualquier app con historial + respaldo:** un tope de almacenamiento **local** jamás puede
viajar al respaldo. En el momento en que el backup sube una lista podada por el límite del navegador, deja de ser un
respaldo y se vuelve un destructor con retardo. **Los otros cotizadores con historial en localStorage no se revisaron:
si alguno respalda con merge + cap, tiene este mismo bug.**

### Recuperar lo que ya se perdió — rama `feat/rescate-versiones` (SIN MERGEAR)

El arreglo detiene la pérdida hacia adelante pero **no devuelve** lo que el respaldo ya pisó. Eso solo vive en las
**versiones anteriores** del archivo en Drive (`files/{id}/revisions`, accesibles con el scope `drive.appdata` que la
app ya tiene). `driveListRevisions` / `driveReadRevision` **ya están en main** (`c3bb472`) y hoy no las llama nadie.

La pantalla `/rescate/` + `js/rescate.js` están en la rama: lee todas las versiones, fusiona lo que falte (conservando
los estados agendada/concretada), es idempotente y aguanta los 3 casos de fallo. Verificada en navegador con datos
inventados. **JC decidió publicar primero solo el arreglo y revisarla aparte** — no mergear sin su OK.

⏳ **El reloj corre:** Google purga las versiones viejas con el tiempo y con cada escritura nueva. Cuanto más tarde en
publicarse la pantalla, menos probable es rescatar julio. Plan B si ya no hay versiones: reconstruir el registro desde
los **correos enviados** del Gmail del agente (fecha, cliente, correo, vehículo); los estados de seguimiento no se
recuperan por ahí.

## Jornada 25 ago 2026 — la marca SDI en los tres correos (EN PROD, `f666ba0`)

Empezó con "agregá las líneas de colores SDI al borde del encabezado" y terminó tocando los tres correos.
Tag de rollback: **`pre-correo-v2-25ago`**.

### 🔴 El logotipo del pie va como IMAGEN, y no es negociable

Los tres correos recreaban el logo con tablas (texto "SDI" + barras). **Eso nunca fue el logo.** El logotipo del kit
tiene la tipografía **vectorizada** (`04-sdi-logo-negativo.svg`: 2 paths + 4 rects, cero `<text>`), y además **en
correo las fuentes web no cargan** — Gmail ignora el `<link>` a Google Fonts. O sea, el "SDI" hecho con texto se veía
en **Arial** para casi todos los clientes. Ahora va `img/sdi-logo-email.png` (384×163, 8,6 KB, RGBA), rasterizado del
SVG oficial, con `alt="Seguros Digitales SDI"` para cuando se bloqueen las imágenes. Hay precedente: el logo del INS
del encabezado ya iba como `<img>` desde el mismo dominio.

**Para regenerarlo:** rasterizar `SDI-BRAND-KIT/logos/04-sdi-logo-negativo.svg` con Chrome headless
(`--default-background-color=00000000` para la transparencia), recortar al contenido y guardar en `img/`.

### `js/email-marca.js` — el módulo compartido

Los bloques que los TRES correos comparten: `_fileteSDI`, `_analizarPlaca`, `_placaEsRelleno`, `_chapaHtml`,
`_tarjetaVehiculo`, `_bloqueSobrio`, `_pieSDI`, `_ahorroAnual`, `_bloquePagos`. Existe para que la marca **no derive
en tres copias**. Tiene su propio `_escMarca` para no depender de nadie.

- 🔴 **Se carga ANTES** de `email-template.js` / `poliza-email.js` / `renovacion-email.js` en las 3 páginas.
- 🔴 **`buildEmail` NO usa las constantes `SDI_*` de este módulo.** Las `const` a nivel de script se comparten entre
  `<script>` en el navegador, pero es frágil (si alguien envuelve el archivo en un IIFE, el envío revienta) y no se
  puede testear con `eval`. Los colores van **literales** en `email-template.js`. Ya pasó una vez: `SDI_VERDE is not
  defined`.
- Exporta con `module.exports` para los tests. Los tests de póliza y renovación lo vuelcan al `global` antes de
  requerir su módulo.

### La placa del cliente en la tarjeta del vehículo

El emoji de carro (`&#128663;`) y la caja azul con barra a la izquierda salieron. En su lugar, **la placa dibujada
como matrícula**: banda "COSTA RICA" arriba y el número separado como se lee en voz alta.

| Tipo | Detección | Color |
|---|---|---|
| Particular | `AAA999` | navy `#0c2340` |
| **Carga liviana** | **`Clase Placa: CL-CARGA LIVIANA`** del PDF (9 set 2026), o el prefijo `CL` escrito a mano | **rojo `#b91c1c`** (6,47:1 en los dos sentidos) |
| Motos, taxis, viejas de 6 números | cualquier otro | tal cual, en navy — **no se les inventa color** |

🔴 **El cero kilómetros y el relleno `000111`.** Un 0 km no tiene placa: el INS lo identifica con "SIN" + los últimos
seis del chasis, que al cotizar no se conocen, así que JC teclea `000111` para poder seguir. Ese relleno **no puede
imprimirse como si fuera la matrícula del cliente**. `_placaEsRelleno` lo detecta (vacío, solo ceros, o solo dígitos
con ≤2 caracteres distintos) y la chapa pasa a decir **0 KM** con la línea que explica cuándo se asigna.
**Tampoco viaja al explicador**: `_buildGuideUrl` recibe `plate: ''` cuando es relleno, porque si no la guía se lo
mostraba al cliente como su placa. El historial sigue guardando lo que el agente escribió, así que se puede buscar.

### Formas de pago y contraste

Orden natural **trimestral → semestral → anual**, el anual siempre en verde con sello amarillo **"10% Descuento"**
(sin `text-transform`, JC lo pidió tal cual) y abajo la línea que aclara que es por pronto pago **con el ahorro real
del año** (`_ahorroAnual`: trimestral×4 − anual; devuelve `''` si los números no se leen, mejor sin línea que con un
dato falso). Se fue el anclaje invertido con el anual al centro.

**Contrastes medidos, no a ojo:**
- Botón de agendar: era `#10b981` con letra blanca = **2,54:1**. Pasa a `#047857` = **5,48:1**.
- Licencia SUGESE del pie: era `#64748b` sobre navy = **3,32:1**. Pasa a `#94a3b8` = **6,16:1**. Es dato regulatorio.
  (El mismo problema que se corrigió en el rail el 7 ago y que había quedado vivo en el correo.)
- Chips de cobertura con el color PURO del manual: azul + letra blanca 5,93:1; teal, naranja y dorado + letra oscura
  `#1a1204` 4,95 / 5,21 / 7,67:1. **Con letra blanca el dorado cae a 2,42:1** — por eso no todos llevan la misma.

### 🔴 Sin barras de color a la izquierda

`border-left:4px solid` aparecía **10 veces entre los tres correos**. Es el tic más reconocible de plantilla
automática y JC pidió sacarlo. Criterio: **el color se queda donde tiene trabajo que hacer**.
- Tarjeta, interés asegurable y repuestos → `_bloqueSobrio`: rótulo en versalitas sobre una regla de 1 px.
- Nota del agente → se va la barra, queda el fondo tenue.
- **Aviso de Uber → conserva la señal** (es la única advertencia del correo) pero como `border-top:3px`, no a la izquierda.

### Tildes: no era un descuido, era el archivo entero

`email-template.js` evitaba las tildes **a propósito** — "cotizacion", "8 anos", "vehiculo", "poliza", "segun",
"genericos", "estandar". Se revisó si había razón técnica y **no la hay**: el MIME cierra con
`btoa(unescape(encodeURIComponent(...)))`, que codifica UTF-8 bien, y los nombres de clientes con tilde ya viajaban
correctamente. Corregidas todas, incluidas las del `<title>` y el titular. Hay un script de barrido en el scratchpad
(`tildes.cjs`) que lee el texto que ve el cliente y avisa; **ojo con los falsos positivos**: "lesiones" en plural no
lleva tilde.

### Tipografía

Los tres correos usan ahora **Space Grotesk + Inter**. `renovacion-email.js` usaba **Poppins**, que no es fuente de
SDI; el correo de seguimiento no tenía Space Grotesk en ningún lado. **No se puso JetBrains Mono en los montos**: en
correo no carga y cae a Courier, que se ve peor que lo que hay.

🔴 **Hallazgo sin resolver: la CONSOLA usa Poppins.** Las tres páginas cargan `family=Poppins` y `css/styles.css` pide
`'Poppins','Inter'`. O sea, la consola y los correos usan tipografías distintas, y la documentación decía Space
Grotesk para todo. **No se tocó**: cambiarlo altera visualmente toda la app y hay que consultarlo con JC.

### Emojis fuera

Los tres correos tenían emojis como entidad HTML (`&#128197;` calendario, `&#128663;` carro, `&#127891;` birrete,
`&#128222;` teléfono, `&#128680;` sirena, `&#128241;` móvil, `&#128193;` carpeta). Cada programa de correo los dibuja
distinto. Salieron todos. **El `&#9888;` (⚠) del aviso de Uber se queda**: es un símbolo tipográfico, no un emoji.

## 🔴 El 📊 se simplificó: la póliza es el único cierre (9 set 2026) — EN PROD

JC: *"Cambiamos la zona de estadisticas a algo más simple, vamos a llevar solo el conteo de las cotizadas y las
concretadas se cuentan con el envio de póliza activa, sino vamos a hacer una lista infinita de personas que ni si
quiera llegan a ser cliente"*. Mockup aprobado antes de escribir código.

### Lo que se fue

El ciclo de estados que el agente marcaba a mano (**Pendiente / Agendada / Concretada / Desechada**), la **fecha
de cita**, el **aviso "Para atender hoy"** del arranque y **todo el seguimiento a 3 días** (filtro ⏳, correo por
fila, "Enviar todos"). Eran trabajo manual que no se hacía.

- `history.js`: fuera `historyEstado`, `setHistoryEstado`, `setHistoryConfirmed`, `historyCitaHoy`,
  `historyNeedsFollowUp`, `historyFollowUpState`, `setHistoryFollowUp`, `dismissFollowUp`.
- `app.js`: fuera 14 funciones (`maybeShowAviso`, `_refreshAviso`, `sendAllFollowUps`, `sendFollowUpEmail`,
  `_pendingFollowUps`, `_citasHoy`, `_onStatsListChange`, `_estadoOrden`…) y el modal `#avisoModal`.
- `email-template.js`: **`buildFollowUpEmail` eliminada** (83 líneas), ya no la llamaba nadie.
- `css/styles.css`: fuera `.estado-select`, `.cita-wrap/.cita-date`, todo `.aviso-*` y las insignias
  `.fu/.seguido/.desest/.cita`.

🔴 **Al mover accesos o quitar ids, comprobar con un clic real que los 3 modales abren.** Un
`addEventListener` sobre un id inexistente lanza y se lleva el resto del `DOMContentLoaded` (el render cascade
failure del proyecto). Se verificó que ningún id enganchado en `app.js` quedó huérfano en `index.html`.

### Lo que quedó

Tres números — **Cotizadas · Con póliza emitida · Conversión** — barras por mes, buscador por placa/apellido y
tres chips (Todas · ⭐ Alto valor · ✓ Con póliza). Por fila: la marca **✓ Póliza emitida**, 💬 WhatsApp y 🗑.

### 🔴 Regresión del mismo día: los cierres viejos dejaron de contar

JC, minutos después de publicar: *"borro el porcentaje de las concretadas, ahora sale en cero"*. **Era un
reporte de bug, no una orden** — se leyó primero como "borrá el porcentaje" y se llegó a quitar la conversión;
se revirtió y se fue a la causa.

`historyTienePoliza()` miraba **solo `polizaAt`**, que es un campo NUEVO. Todos los cierres que JC ya tenía
marcados a mano (`estado: 'concretada'`, o el `confirmed: true` más viejo) dejaron de contar: el 📊 mostró
**0 con póliza y 0% de conversión** con el registro intacto.

🔴 **Y era peor que un número mal:** `purgarHistorial()` usa la misma función, así que tomaba esos cierres por
cotizaciones sin póliza y **se los podía llevar a los 90 días**. Clientes reales.

```js
return !!(e.polizaAt || e.estado === 'concretada' || e.confirmed === true);
```

**La lección:** al retirar un ciclo de estados no basta con borrar el código que lo escribía — hay que decidir
qué pasa con los datos que ese ciclo YA dejó en el navegador de cada agente. O se migran (escribirles `polizaAt`)
o se siguen leyendo. Se optó por leerlos, que no toca datos de nadie. Cubierto por 6 checks en
`test-history-stats.js`, verificados por reversión: sin el fix, 4 fallan.

### El cierre lo pone la póliza, cruzando por placa

**`marcarPolizaEmitida(datos)`** (history.js) la llama `poliza-app.js` al terminar el envío:

| Caso | Qué hace |
|---|---|
| La placa está en el historial | Marca `polizaAt` en ESA cotización |
| No está (nunca cotizó por la app, o ya se purgó) | **Crea** una entrada con `origen: 'poliza'` — es un cliente real y tiene que contar |
| Se reenvía la misma póliza | No hace nada: es idempotente, no cuenta doble |
| Llega sin placa | Crea, **nunca adivina** cuál cerrar |

La placa se compara con `_normHistorySearch`, así que `BCS-123` ≈ `bcs123`.

🔴 **`/polizas-activas/` ahora carga `history.js` y `drive-sync.js`** (antes no cargaba ninguno). `history.js`
va después de `shortlink.js` y antes de `poliza-app.js`.

### La purga a los 90 días

**`purgarHistorial([dias][,now])`**, que corre sola y en silencio al arrancar la app (no es algo que el agente
tenga que atender). Borra las cotizaciones **sin póliza** de más de `PURGA_DIAS = 90`.

- 🔴 **Lo que llegó a póliza NO se purga nunca**, tenga la edad que tenga: es el cliente real y es lo que
  sostiene la conversión.
- 🔴 **De cada borrada queda una LÁPIDA** — `{id, date, purged:true, updatedAt}`, **cero datos del cliente**
  (se van nombre, correo, teléfono, placa, vehículo y `guideUrl`). Sin ella, `mergeHistories` las traería de
  vuelta desde Drive en el siguiente respaldo y el borrado sería una ilusión. **No hizo falta tocar el merge**:
  la lápida tiene el `updatedAt` más nuevo, así que ya gana. Esto cierra de paso el pendiente viejo de que el
  botón 🗑 no borraba de Drive.
- **`loadHistoryVivas()`** es lo que ve el agente; **`loadHistory()` cruda** (con lápidas) se reserva para el
  respaldo y la fusión. El 📊 y el 🕘 usan la primera.

### 🔴 La purga vive en `driveBackup()`, NO en el arranque

Salió de la revisión thermo-nuclear del mismo día. En su primera versión `purgarHistorial()` se llamaba desde el
`DOMContentLoaded` de `app.js`, y el orden era: **borrar primero, respaldar 2,5 s después** — y solo si el agente
tenía Drive activado, porque `scheduleDriveBackup()` retorna de inmediato cuando no lo está. O sea: **un agente
sin respaldo perdía datos sin ninguna red**, y cualquier bug del predicado se convertía en pérdida irreversible.
Ese mismo día pasó: `historyTienePoliza()` no reconocía los cierres legacy y la purga se los podía llevar.

Ahora la purga es **consecuencia del respaldo**: `driveBackup()` la llama en `_purgarLoYaRespaldado()`, después de
confirmar la escritura (y también cuando Drive ya tenía exactamente lo mismo). Si `_driveWrite` lanza, no se llega
a la línea. La garantía es estructural, no depende de un timer.

```js
await _driveWrite(t, _drivePayload(paraDrive));   // los datos COMPLETOS
_setDriveLastBackup(new Date().toISOString());
_purgarLoYaRespaldado();                          // recién ahora se borra
```

- 🔴 **El orden importa**: lo que se sube lleva las cotizaciones enteras. Purgar antes mandaría las lápidas a
  Drive y los datos no quedarían en ninguna parte.
- 🔴 **`purgarHistorial()` ya NO llama `_afterHistoryChange()`**: la invoca el respaldo, dispararlo ahí
  encadenaría un respaldo dentro de otro.
- **Consecuencia querida y aceptada:** el agente que no activó Drive **no purga nunca**. Su registro crece y lo
  contiene `HISTORY_MAX`. Perder datos de clientes es peor que una lista larga.
- La purga corre en el flujo natural: cada envío dispara respaldo, y "Sincronizar ahora" también.
  `driveRestore()` **no** purga.

`tests/test-purga-respaldo.js` (**6 checks**) monta history.js + drive-sync.js en un contexto `vm` con `fetch` y
`localStorage` simulados. Verificado por **mutación**: se probaron los 4 caminos de vuelta al diseño peligroso
(purgar antes de escribir, purgar en un catch, que app.js vuelva a purgar, que la purga encadene respaldo) y el
test caza los 4. Smoke sin Drive activado: 0 borradas, la de 200 días intacta.

### Limpieza manual: `purgarHistorial(0)` desde el ⚙

JC, 9 set 2026: *"podemos borrar de una vez ese historial sólo dejar las concretadas"*. Se le advirtió que eso
**también se lleva las cotizaciones recientes** —su correo, su enlace de la guía y su botón de WhatsApp— y
eligió igual la opción total. **Decisión tomada con el efecto a la vista; no reproponerla.**

**No hay función nueva.** `purgarHistorial(dias)` ya hacía exactamente esto con otro umbral; solo se permitió el
**0** (`dias >= 0` en vez de `> 0`), que significa "todas las que no llegaron a póliza, sin importar la edad".
Sin `dias`, sigue siendo la automática de 90.

Botón **"Dejar solo las que llegaron a póliza"** en el ⚙, bajo el respaldo. `limpiarRegistroSinPoliza()` en
app.js:

1. Cuenta y **confirma con el número exacto** de lo que se va a borrar y de lo que queda.
2. 🔴 **Respalda ANTES y aborta si el respaldo falla** — misma regla que la purga automática.
3. Si el agente **no tiene Drive**, avisa que no habrá forma de recuperarlas y pide una segunda confirmación.
4. Purga, sube las lápidas y repinta.

🔴 **Ahora hay DOS llamadores legítimos de `purgarHistorial`**: `driveBackup()` (automática, después de
respaldar) y este botón (manual, que respalda antes). Lo que no puede volver es una llamada suelta en el
arranque. El test lo vigila así: **toda llamada en app.js tiene que estar dentro de `limpiarRegistroSinPoliza`, y
ahí `driveBackup` tiene que aparecer ANTES que `purgarHistorial`**. Verificado por mutación: mover la purga
antes del respaldo hace fallar el test.

4 checks en `test-history-stats.js` + el de `test-purga-respaldo.js`. Smoke con los 3 caminos: sin Drive y
cancela (no borra), con Drive y **el respaldo fallando** (no borra), y respaldo OK (borra y deja los clientes,
incluido uno con el `estado: 'concretada'` legacy).

### El conteo por mes: por qué existe

Lo levantó el propio mockup: si se borran las cotizaciones viejas sin póliza y un cliente cotiza en enero pero
compra en junio, **esa venta ya no se puede cruzar por placa** y la conversión histórica se desdibuja. Por eso
al purgar se guarda **solo el conteo del mes** en `cotizador_sdi_resumen_v1`:
`{ "2026-07": { cot: 48, pol: 10 } }` — dos números, ningún dato personal.

- `computeHistoryStats(entries, extra)` recibe ese conteo y lo suma; `groupHistoryByMonth` lo aplica por mes y
  **muestra los meses de los que ya no queda ninguna cotización viva**.
- **`mergeResumenes(a,b)` se queda con el MAYOR de cada mes, nunca con la suma**: dos equipos respaldando el
  mismo mes ya purgado lo contarían doble.
- El resumen viaja en el payload de Drive (`resumen`) y `_mismoContenido` lo compara, para no reescribir de
  gusto (cada escritura empuja las versiones viejas de Drive hacia el borrado).

### Verificación

`tests/test-history-stats.js` **reescrito: 42 checks** (los 27 viejos probaban lo que se eliminó). Vigila que la
purga no se lleve un cliente con póliza, que la lápida no conserve **ningún** dato, que un borrado no vuelva del
respaldo, y que la conversión histórica siga cuadrando después de purgar.

Smoke en localhost con datos inventados: purga automática al arrancar (se fue la vieja sin póliza, se quedó la
vieja con póliza), cruce por placa con guion y minúsculas, cliente directo, reenvío sin duplicar, los tres
chips, buscador por apellido, filtro por mes, el 🕘, móvil a 375 px y `/polizas-activas/` arrancando con los
módulos nuevos. Cero errores de consola. **Suite: 21 archivos / 712 checks.**

🔴 **La caché del navegador sirvió los `.js` viejos durante el smoke** y las funciones nuevas salían
`undefined`. No era un bug: `fetch(url, {cache:'reload'})` sobre cada `<script src>` y recargar. Comprobar
`typeof` de una función nueva ANTES de diagnosticar nada.

---
## 🔴 El 🕘 y el 📊 son UNA sola pantalla (9 set 2026)

JC: *"punto 6 dejá solo uno"*. Eran dos listas de la misma cotización con **modelos distintos** — el 🕘 decía
"Vigente · 5d / Vencida" (los 15 días que vale una cotización del INS) y el 📊 "Con póliza / Sin póliza" — y cada
una tenía la mitad de las acciones. **`js/history-ui.js` se eliminó**; `stats-ui.js` absorbió todo.

### Qué se transcribió del 🕘 (no se rehízo: se copió)

| Del 🕘 | Cómo quedó |
|---|---|
| 🔗 abrir la guía | igual, y **solo si la entrada tiene `guideUrl`** |
| 📄 copiar el enlace | igual, con el acortado y el `prompt` de respaldo si el navegador niega el portapapeles |
| Badge "Vigente · Nd / Vencida" | **fundido en la marca**: "Sin póliza · vence en 9 d" / "Cotización vencida" |
| El correo del cliente | en **su propia línea** (`.stat-mail`): metido en la meta empujaba placa y vehículo fuera del ancho |
| "Restaurar de Drive" del vacío | igual, pero **solo con el registro vacío de verdad** — no cuando un filtro no da resultados |

🔴 **Lo único que NO se llevó, y por qué:**
- El **💬 de compartir la guía** (`buildWaShareUrl`, *"Te acabo de enviar por correo…"*). Ese mensaje pertenece
  al momento del envío y **sigue existiendo en la vista 4**. En un registro histórico sería falso: la lista
  conserva el 💬 de seguimiento, que además solo sale en las cotizaciones sin póliza.
- El botón **"Borrar historial"** (borraba todo con `clearHistory()`, **sin dejar lápidas**, así que volvía desde
  Drive al restaurar). Lo cubre el botón del ⚙, que respalda antes y sí deja lápidas.

### Nombres

El acceso del rail pasó de **"Estadísticas"** a **"Cotizaciones"** y el título del modal a **"📊 Cotizaciones
enviadas"**: la pantalla ya no son solo métricas. El rail quedó con **6 accesos**.

🔴 Los ids **`btnStats` / `statsModal` / `statsList` NO cambiaron** aunque el nombre visible sí — `app.js` los
engancha por id y un id inexistente se lleva el `DOMContentLoaded` entero.

### Verificación

11 checks nuevos en `test-stats-ui.js` (**32 en total**), uno por cada cosa heredada, más uno que falla si
`history-ui.js`, `historyModal` o `btnHistory` **reaparecen**. Un check viejo que esperaba "6 d" se actualizó a
"vence en 9 d": quedó obsoleto por el cambio de diseño, no por un bug. Smoke en pestaña limpia: el rail con 6
accesos, las 3 filas con sus botones (la cerrada sin 💬), y las tres marcas — emitida, vence en 9 d, vencida.
Cero errores de consola.

---

## `app.js` bajó de 1410 a 968 líneas (9 set 2026)

Cierre de la revisión thermo-nuclear. `app.js` tenía **seis responsabilidades** sin relación entre sí; quedó con
una: **el flujo de la cotización**. Los cuatro módulos nuevos salieron en el orden en que se pudo cortar limpio:

| Módulo | Líneas | Qué se llevó |
|---|---|---|
| `js/stats-ui.js` | 292 | la pestaña 📊 |
| `js/datos-ui.js` | 202 | respaldo en Drive + limpieza del registro |
| `js/history-ui.js` | 119 | el modal 🕘 |
| `js/wizard.js` | 113 | lo común de los tres asistentes |
| **`js/app.js`** | **968** | el flujo de la cotización, y nada más |

### Por qué Drive y la limpieza van juntos

No es un cajón de sastre: los une un invariante. **Nada se borra sin estar respaldado antes** —
`limpiarRegistroSinPoliza()` respalda y aborta si el respaldo falla, y la purga automática vive dentro de
`driveBackup()`. Separarlos volvería a dejar el borrado lejos de su red de seguridad, que es justo el bug del
que salió todo esto.

### Cada módulo lleva su propio escape

`history-ui.js` usaba el `_escapeHtml` de app.js, que **se carga después**. Se le puso `_escHist` propio, igual
que `stats-ui.js` con `_esc` y `email-marca.js` con `_escMarca`. Son cinco líneas repetidas; a cambio ningún
módulo depende del orden de carga y todos se pueden probar en Node sin montar la app. **Es el patrón del
proyecto, no un descuido** — antes de "unificarlo" en un helper compartido, tener en cuenta que eso reintroduce
la dependencia de orden.

### Orden de carga en `index.html`

```
toast → config → state → agent-profile → shortlink → history →
stats-ui → history-ui → router → pdf-extract → pdf-modify → email-marca →
email-template → gmail-auth → wizard → mime-builder → standard-docs →
drive-sync → datos-ui → app
```

Regla: **cada UI va después del módulo de datos del que depende, y todas antes de `app.js`**, que engancha los
botones del rail en el `DOMContentLoaded`. Ahí está la trampa conocida: un id inexistente hace que ese
`addEventListener` lance y **se lleve el resto del arranque**. Tras mover accesos, comprobar con clic real que
los 3 modales abren.

### Verificación

Smoke en pestaña limpia: los 3 modales abren, el historial pinta sus 2 filas con sus botones de copiar y
WhatsApp, el 📊 sus filas, el ⚙ el estado de Drive y el botón de limpieza. Y el **flujo completo del cotizador**
con un PDF real: cargar → vista 2 (`plateClass: CL-CARGA LIVIANA`) → vista 3 con la chapa roja en el correo.
**Cero errores de consola.** Suite: 21 archivos / 712 checks.

🔴 Al mover la limpieza a `datos-ui.js`, el test `test-purga-respaldo.js` empezó a fallar porque buscaba
`purgarHistorial` en app.js. **No era un falso positivo: el test hacía bien su trabajo** — se le apuntó al
archivo nuevo conservando el invariante (app.js: cero llamadas; datos-ui.js: todas dentro de la limpieza, con
`driveBackup` antes).

**Lo único que queda de la revisión:** decidir si 🕘 y 📊 siguen siendo dos pantallas. Describen la misma
cotización con dos modelos — "Vigente · Nd / Vencida" (los 15 días del INS) contra "Con póliza / Sin póliza" —
y ahora que son dos archivos hermanos la duplicación se ve de frente. Es decisión de JC.

---

## `js/wizard.js` — lo común de los tres asistentes (9 set 2026)

Punto 3 de la revisión thermo-nuclear. Las tres pantallas de envío son el mismo asistente de 4 pasos con
distinto contenido, y compartían código **por copia**:

| Qué | Estaba |
|---|---|
| `setStep()` | **byte a byte idéntico** en `poliza-app.js` y `renovacion-app.js` |
| El regex del correo | **5 veces** (app.js ×3, póliza, renovación) |
| El reintento de token vencido | duplicado literal en dos… **y faltaba en el cotizador** |

🔴 **Ese último era un bug real, no solo duplicación.** Si el token de Google caducaba con la pantalla abierta,
póliza y renovación reintentaban solas, pero **el cotizador no**: el envío moría y había que volver a subir el
PDF. Ahora los tres usan `enviarConReintento()`.

- **`esEmailValido(v)`** — la única copia del regex. Laxo a propósito (`algo@algo.algo`): no valida existencia,
  solo ataja el dedazo antes de que el agente crea que el correo salió.
- **`correosInvalidos(v)`** — para el campo "Para" con varios correos por coma (plan familiar en renovaciones).
- **`enviarConReintento(raw)`** — `getToken` → `sendEmail`, y si el error habla de 401/token/expirado,
  `clearToken` + reintento. **Una sola vez**: si el segundo también falla, el problema no es el token y el
  agente tiene que ver el error.
- **`wizardSetStep(n)`** — el pintado de pasos. **No toca el estado del llamador**: cada pantalla guarda su
  propio `state.step` y después llama acá, así que `setStep` queda como dos líneas en cada módulo.

**Orden de carga: después de `gmail-auth.js`** (usa getToken/sendEmail/clearToken) y antes del `*-app.js`.
Va en las **tres** páginas.

`tests/test-wizard.js` (**15 checks**), con el DOM de los pasos simulado. Tres de esos checks son de guardia:
recorren `js/` y fallan si el regex del correo, el reintento o el `setStep` **vuelven a copiarse** — que es
exactamente como se llegó hasta acá. Smoke en las 3 páginas: cero errores de consola.

---

## El 📊 salió de app.js: `js/stats-ui.js` (9 set 2026)

De la revisión thermo-nuclear. `app.js` tenía **1410 líneas y seis responsabilidades** sin relación entre sí
(respaldo en Drive, historial 🕘, estadísticas 📊, flujo del wizard, render y helpers). El 📊 era el corte más
limpio: no depende del flujo de cotización.

**`app.js` 1410 → 1170 líneas; `js/stats-ui.js` 292.**

- Sus únicas dependencias son `history.js` y `showToast`. **Nada de app.js** — se verificó enumerando las
  llamadas externas del módulo.
- 🔴 **Lleva su propio `_esc`** en vez de usar el `_escapeHtml` de app.js. Mismo criterio que `email-marca.js`
  con `_escMarca`: el módulo no depende de quién se cargue antes y se puede probar en Node sin montar la app.
- **Orden de carga: después de `history.js`, antes de `app.js`.** app.js sigue enganchando los botones del rail
  (`btnStats`, `statsFilters`, `statsList`…) sobre funciones que ahora viven acá; funciona porque el enganche
  ocurre en `DOMContentLoaded`, no en tiempo de carga.
- `tests/test-stats-ui.js` (**22 checks**) lo monta en un contexto `vm`. Antes este render no tenía test: estaba
  enterrado en app.js.

**La revisión quedó cerrada:** `app.js` en 968 líneas, `js/wizard.js` hecho, y el 🕘 fusionado con el 📊 (ver
arriba).

### El 💬 no se le ofrece a quien ya compró

`buildWaFollowUpUrl` redacta un seguimiento de cotización: *"¿Tuvo chance de revisarla?"*. El botón salía en
**todas** las filas — defecto preexistente, no de la simplificación del 📊, pero que quedó junto a la marca
"✓ Póliza emitida". Ahora `_statsListHtml` lo omite cuando la cotización está cerrada. No se inventó un mensaje
de postventa: eso es texto de cara al cliente y lo aprueba JC.

### Campos que se guardaban y no se leían

`marcarPolizaEmitida` devolvía `{marcada, creada, entry}` con **`marcada: true` en los dos `return`** — un dato
que no informaba nada — y el único llamador de producción ignora el retorno completo. Quedó `{creada, entry}`.

Los campos `poliza` (número) y `origen` se escribían y no los leía nadie. En vez de borrarlos se les
dio uso en la fila: el número de póliza se muestra, y las entradas de un cliente que llegó directo dicen
**"sin cotización previa"** para que su fecha no se lea como fecha de cotización.

🔴 **DECIDIDO por JC (9 set 2026): igual suma. NO reproponerlo.** Una entrada creada por el envío de una póliza
cuenta como **"Cotizada"** en los KPIs aunque ese cliente nunca haya cotizado por la app. Se le planteó que eso
infla el número y respondió *"Igual suma"*. No es un descuido: es una decisión tomada con el efecto a la vista.
La fila igual se distingue en pantalla con "sin cotización previa".

---

## 🔴 La clase de placa la declara el INS (9 set 2026) — EN PROD

JC: *"habiamos aprobado un mockup para cuando se cotizaban carga liviana, este no jalo la placa"*
(cotizacion `ASINS-170-142661`, MITSUBISHI L200, placa 306735 — salio en navy).

**No era un caso aislado: las 40 cotizaciones de carga liviana de los ultimos meses salieron en navy.
La chapa roja nunca funciono.** `_analizarPlaca` exigia que la placa llegara como `CL306735`, pero el INS
escribe el numero PELADO y pone la clase en **un campo aparte que el cotizador nunca leyo**:

```
Clase Placa: CL-CARGA LIVIANA
Numero de placa: 306735
```

**Medido sobre 370 cotizaciones reales** (los PDF de `Downloads`): el campo viene en el **100%** y toma tres
valores — `PART-PARTICULAR` (282), `SIN - PLACA TEMPORAL` (48), `CL-CARGA LIVIANA` (40).

### 🔴 Por que NO se puede inferir del formato

Entre esas 370 hay **tres particulares con placa numerica pura** (`654615`, `845340`, `742786`), identicas en
forma a una carga liviana. La regla "6 digitos = CL" les pintaria la chapa roja a **clientes particulares**.
La clase del PDF es el unico dato que desambigua; el tipo de vehiculo ("Pick Up") tampoco alcanza.

### Como quedo

- `pdf-extract.js` → **`data.plateClass`**. El regex corta antes del campo siguiente por si dos caen en la
  misma fila: `/Clase Placa:\s*(.+?)(?:\s+(?:N[uú]mero|Tipo|A[ñn]o)\b|$)/i`.
- `email-marca.js` → **`_claseEsCL`** y **`_claseEsTemporal`**. `_analizarPlaca(placa, clase)` y
  `_placaEsRelleno(placa, clase)` reciben la clase; **el segundo argumento es opcional y sin el se comportan
  exactamente como antes** (los correos ya enviados no cambian).
- Con clase CL, la chapa **antepone el `CL`** que el INS omite, para que el cliente vea SU matricula real
  (`CL␉␉306735`, con los dos thin spaces del mockup). Si la placa no es numerica pura, va roja pero **sin
  inventarle prefijo**.
- `email-template.js` y `app.js` pasan `plateClass`. `_syncDataFromView2` no lo toca: es dato del INS, no
  editable.

### El cero kilometros dejo de adivinarse

`SIN - PLACA TEMPORAL` es el valor oficial del 0 km. Antes se adivinaba por la forma del relleno (solo ceros,
≤2 digitos distintos) y **se le escapaban 3 de 48**: `702145`, `6VD702`, `690309` — a esos clientes el correo
les mostro como matricula un numero que el agente tecleo para poder cotizar. La heuristica **queda de
respaldo** para cuando el correo se arma sin el dato.

**Hallazgo de paso, corregido:** `_guideExtras()` (app.js) mandaba la placa **sin filtrar el relleno** al
enlace del historial y del WhatsApp, mientras el correo ya mostraba "0 KM". Ahora filtra igual que `buildEmail`.

### Verificacion

| | antes | ahora |
|---|---|---|
| carga liviana en rojo | **0 / 40** | **40 / 40** |
| particulares pintadas de rojo | 0 | **0** |
| 0 km detectados | 45 / 48 | **48 / 48** |
| placas reales tomadas por 0 km | 0 | **0** |

`tests/test-placa-clase.js` (**45 checks**) — con **prueba de mutacion**: se rompieron las 5 piezas de la
logica una por una y el test caza las 5. Smoke con **PDF.js real** en localhost sobre los tres tipos de PDF, y
flujo completo en la app (cargar → vista 2 → vista 3): `S.data.plateClass` sobrevive el sync y el correo sale
con la chapa roja. **Suite: 18 archivos / 657 checks.**

🔴 **Los PDF de prueba tienen datos de clientes reales y NO entran al repo** — el smoke se corrio desde
`.netlify/smoke/` (ruta ya ignorada) y la carpeta se borro al terminar.

---
## Las coberturas del PDF (25 ago 2026, `c1721f0`) — EN PROD

El cuerpo del correo dejó las tres frases genéricas ("Full Cobertura / Cero deducible / Asistencia 24/7") y pasó a
mostrar **las coberturas que trae esa cotización**, con el monto y el deducible de cada una.

### 🔴 Nada es fijo, y esa es toda la razón de ser del parser

Medido sobre **25 cotizaciones reales**: aparecen **tres juegos distintos** — `A-B-C-D-F-G-H-IDD-M-N` (el corriente,
23 de 25), uno **con K** (transporte alternativo) y uno **sin H**. Y el deducible de D/F/H va de **₡400.000 a
₡500.000** según la cotización. Con una lista fija, a un cliente sin D ni H el correo le prometería colisión y vuelco
que no contrató, **firmado con la licencia SUGESE del agente**.

### Las dos trampas del PDF

1. 🔴 **El bloque cruza de la página 1 a la 2.** `DETALLE DE COBERTURAS` arranca en la 1 y las últimas coberturas
   (N e IDD) quedan arriba de la 2. Un parser que lea solo la página 1 se las pierde **en silencio** — me pasó, y el
   primer análisis concluyó que "las cotizaciones no traen IDD", que era falso.
2. 🔴 **El formulario del INS trae una errata: "Detalle de Deduciles"**, sin la b. Es el título del bloque siguiente
   y sirve de terminador. Escrito bien no coincide con ningún PDF real, y sin el corte el título se cuela dentro de
   la descripción de la IDD. Por eso `RE_FIN` corta en `Detalle\s+de\s+Deduc` y no en la palabra completa.

### Cómo está repartido

- **`pdf-extract.js` → `_parseCoberturas(rows1, rows2)`**: devuelve `[{cod, desc, prima, montos:[{etiqueta,valor}]}]`
  con lo que trae el PDF y nada más. Vacío si el PDF no lo trae (no es motivo para fallar).
  Se asigna a `data.coberturas`.
- **`email-marca.js` → `_filasCoberturas(coberturas, deducibles)`**: traduce a las filas del correo. `SDI_COBERTURAS`
  tiene el nombre en lenguaje llano, el grupo y el tono de cada código; un código sin ficha usa la descripción del
  PDF, nunca un invento. `_deduciblePorCobertura` reparte las líneas del PDF ("Cobertura D,F Y H: ...") entre las
  coberturas que nombran.
- **`_bloqueCoberturas`**: pinta la tabla. Devuelve `''` si no hay filas.
- **`app.js`** pasa `coberturas` y `deducibles` a `buildEmail`, en los dos llamados (vista previa y envío).

### Detalles que costaron

- **`G`+`M` y `N`+`IDD` se funden en una sola fila** si vienen los dos (`SDI_PARES`). En la fusión **manda la ficha
  del que trae el monto**: sin eso, N+IDD decía "Incluida" y se perdía cuánto reintegra el INS.
- **Degradación:** si `p.coberturas` no viene, el correo conserva los tres beneficios de siempre. Los envíos
  anteriores no se rompen.
- 🔴 **El smoke con PDF.js real es obligatorio.** La primera verificación se hizo con las filas convertidas desde
  `pdfplumber` y pasaba; al probar en el navegador, `data.coberturas` salía vacío. **Era caché del navegador** (la
  función ni existía en la página cargada), no un bug — pero solo se supo porque se comprobó `typeof
  _parseCoberturas` antes de "arreglar" nada. Verificar siempre con un `?cb=` o recargando los scripts a mano.

## 🔴 El correo y la guía tienen que decir LO MISMO (25 ago 2026, `04c69d9`)

**Lo que pasó, con una cotización real de JC:** el correo mostraba cinco coberturas (A, B, C, G·M y N) y
`/explicacion/` mostraba **seis**, incluidas **colisión, robo y riesgos adicionales que ese cliente no había
cotizado** — y con montos calculados sobre su valor asegurado, que se leen como reales. La guía tenía sus seis
tarjetas escritas a mano y las mostraba siempre. El correo ya se cuidaba; la guía lo contradecía. Las dos van
firmadas con la licencia SUGESE del agente.

**Cómo quedó:** el correo le pasa las coberturas a la guía por el enlace.
- **Param `cb`**, formato `A-300000000.B-15000000.C.G.M` — código y, tras un guion, el monto cuando el PDF lo trae.
  El punto y el guion no se escapan en un URL. Lo arma `_codificarCoberturas` (email-template.js).
- **`aplicarCoberturas(cb)`** en el explicador: borra las tarjetas que no vengan, pone el monto real en las que sí,
  y **corrige la mención del monto DENTRO del detalle** de cada tarjeta — el detalle lo repite con palabras
  ("hasta ₡300 millones") y si solo se cambia la cifra de arriba, queda mintiendo.
- 🔴 **Sin el parámetro no se toca nada.** Los correos ya enviados no lo llevan y esos clientes tienen que seguir
  viendo la guía igual. Un `cb` ilegible tampoco la deja en blanco.
- El test `test-coberturas.js` compara **lo que muestra el correo contra lo que recibe la guía**. Es la garantía de
  que no se vuelvan a separar.

**De paso:** la guía formateaba con `toLocaleString('es-CR')`, que separa los miles con **espacio**
(`₡18 000 000`), mientras los montos escritos a mano usaban coma. Todo unificado a punto, como el correo.

## La consola en línea clara (10 sep 2026, `c5cc457`) — EN PROD

JC pidió ver un mockup antes de decidir (*"la consola me gustaría ver un mock up"*) y aprobó las seis pantallas con
*"Dale, implementalo igual que el explicador"*. Tag de rollback **`pre-consola-linea-clara-10sep`**.

- **Hoja de sobreescritura, no reescritura:** `css/linea-clara-consola.css`, enlazada DESPUÉS de `styles.css` y
  **SOLO en `index.html`**. `styles.css` no se tocó: las sub-páginas la cargan sin la hoja nueva y siguen con su
  cabecera navy (verificado en el smoke: `/polizas-activas/` da `rgb(12,35,64)` y no enlaza la hoja).
- **HTML que cambió (solo el header):** dos niveles — `.lc-top` (logo `img/sdi-logo-compacto.svg` a color,
  `#lcAgentName`, `#lcAgentLic`, `#hdrAgentIni`) y `.header-inner` (producto + `#stepNav` con los mismos `.step[data-step]`).
  El SVG del logo pegado en el HTML se fue: el compacto a color como `<img>`. Emojis estáticos fuera (📄 del drop-zone
  → SVG de trazo, ✓, 📎, 📊, 📨, ☁️, 🧹, 🔎 → SVG). **Los que escribe `stats-ui.js`** (🔗 📄 💬 🗑, "⭐ Alto valor",
  "✓ Con póliza") **siguen**: son JS y JC no pidió tocarlo.
- 🔴 **El único cambio de JS:** `paintRailAgent()` pinta también `#lcAgentName` / `#lcAgentLic` desde `CFG`. Los dos
  van **vacíos en el HTML a propósito** — el mockup los traía con el nombre de JC escrito a mano y eso se lo habría
  mostrado a otro agente. Regla multi-agente: nada del agente escrito en el HTML.
- **Lo que reescribe la hoja:** rail sobre `#F8F9FA` con el activo en píldora azul (mismos ids `btnStats`/`btnSettings`),
  columna de contenido `#F2F7F4` (conserva la distinción verde de "cotizar" del 6 ago), tarjetas r24 con regla 28×3,
  formularios con borde `#8A939C`, botones píldora de un solo azul (`.btn-send` también: el verde se fue), precios con
  `::after` "No va en el PDF" (gris, en vez del sello rojo ELIMINADO) y el anual en verde pálido, guía del deducible con
  los tintes `--t-*` del explicador, modales con cabecera blanca y cierre redondo, 📊 con cifras en tinta.
- **`!important` solo contra estilos en línea**, cada uno anotado: `#driveInvite` (navy en línea), `#priceTable>div[style]`
  (la nota del repuesto), los `<p style>` de las secciones del modal ⚙, `.card>p[style]`, `#waShareWrap span[style]`.
- 🔴 **Hallazgo de paso (móvil):** `.side-rail` conserva `height:calc(100vh - var(--header-h))` en la media query de
  ≤900 px de `styles.css`, y como pasa a `flex-wrap`, las filas se repartían todo el alto y el ítem activo se estiraba.
  La hoja nueva lo corrige (`height:auto; align-content:flex-start`) **solo para index.html**; en `styles.css` sigue así
  para las sub-páginas que no tienen rail (no les afecta).
- `--header-h` se sigue midiendo (`_syncHeaderHeight`): con dos niveles + filete da **120 px** en escritorio y 114 en móvil.
- **Smoke:** arnés en `.netlify/smoke/` (ignorado, borrado) con un **perfil inventado** en localStorage para probar el
  multi-agente: nombre y licencia del nivel 1 salieron del perfil; `btnStats` y `btnSettings` abren y cierran por clic
  real; `scrollWidth == clientWidth` a 1280 y 360; fuentes cargadas. Suite: 21 archivos en verde.

## El explicador en línea clara (10 sep 2026, `fb95067`) — EN PROD

JC: *"vamos a actualizar la imagen solamente del explicador de autos"*. Se aplicó con el skill `imagen-de-marca-sdi`
(v1.3) siguiendo su procedimiento: mockup local con capturas → artefacto para que lo viera → **6 ajustes de JC**
(chips de cobertura con color, iconos de trazo de SASINS en asistencias, título del deducible en azul, tintes en
repuestos y pasos, anual siempre resaltado) + **logo del INS en azul** → "dale" → localhost → prod. Tag de rollback
**`pre-explicador-linea-clara-10sep`**. Los correos y la consola **no** se tocaron.

- 🔴 **Solo la cara.** El `<script>` de `explicacion/index.html` es **byte a byte** el de antes (se comparó contra
  `HEAD` al implementar). Todo va en el bloque **LÍNEA CLARA al final del `<style>`**, que gana por orden de fuente;
  los `!important` son solo contra estilos en línea del HTML y cada uno dice por qué. Regla para el futuro: **si un
  cambio de imagen necesita tocar el JS, no es un cambio de imagen.**
- **HTML que sí cambió:** header en dos niveles (`.lc-top` + `.lc-nav`, conservando `.ins-logo`, `.pill-100`,
  `.agent-info` y `.brand-text`), `.hero-cta` con dos píldoras, pie con `<img class="sdi-logo"
  src="../img/sdi-logo-compacto.svg">` en lugar del SVG negativo pegado, sprite Lucide (trazo 1,5, el set de SASINS)
  con `<use>` en las 7 asistencias, `data-cifra` en los 3 precios y **los emojis fuera del HTML estático** (los que
  escribe el JS, como el 🎉 de la celebración, siguen ahí).
- 🔴 **Dos enganches que dependen de un truco de CSS:** (1) `.agent-info` — el JS escribe `<b>nombre</b><br/>licencia`;
  el CSS esconde el `<br>` y pone " · " con `b::after`. (2) `.bento-tile .letter::before{content:"Cobertura"}` — el JS
  lee `textContent` de `.letter` (solo la letra) y el pseudo-elemento no lo contamina. Si alguien pasa ese texto al
  HTML, `aplicarCoberturas` deja de encontrar la letra.
- **Tipografía v1.3:** Google Sans Flex (500 titulares · 600 nombres · 400 texto) + Google Sans Code (cifras
  secundarias). **Inter queda en el `<link>` solo para prestar el ₡** — verificado con zoom 2× en el mono chico, la
  protagonista y los precios. El `div[style*="Space Grotesk"]` del bloque eléctrico se sobreescribe con `!important`.
- **Logo del INS en azul:** `img/ins-logo-azul.png` (1200×284, 29 KB), generado del blanco con PIL conservando el
  alpha, a pedido de JC ("si podés poner el logo del INS en azul o verde mejor"). El blanco `ins-logo.png` sigue para
  los correos. Si lo quiere verde: recolorear y regenerar, no filtros CSS.
- **`img/sdi-logo-compacto.svg` era el NEGATIVO blanco mal nombrado** (título "Compacto negativo") y nadie lo usaba;
  ahora es el `02-sdi-logo-compacto.svg` del kit. `js/linea-clara-cifras.js` es copia literal de
  `SDI-BRAND-KIT/linea-clara/`.
- **Color:** producto navy `#0C2340` (regla 28×3, avatar) más seis tintes pálidos `--t-azul/verde/rosa/viol/oro/cyan`
  con tinta ≥4,5:1, que pidió JC para dar vida. Van en chips, iconos y fondos; **ninguna cifra lleva color** (regla 6
  de la línea clara se mantiene). El anual de pagos va en verde pálido con la etiqueta sólida
  "Recomendado · 10 % de descuento".
- **Copy:** el botón final pasó de "Agende su cita de Aseguramiento" a "Agendar mi cita de aseguramiento" (vos, como
  el resto). La cinta dorada quedó `display:none` (el elemento sigue por el hook). "Tu plan" y "Tuyo" en repuestos
  quedaron los dos.
- **Smoke:** el Browser pane devolvía `innerWidth 0` (pane oculto: entorno, no bug — ver memoria "Pane: rAF
  throttled"). Se verificó con un arnés de 4 iframes (1280, 375, `og=1&vt=e` con solo A y C, y enlace viejo sin
  `cb`) servido desde `.netlify/smoke/` (ruta ignorada, borrada al terminar) y leído con `chrome --dump-dom`:
  consola 0, fuentes cargadas, `scrollWidth == clientWidth`, pasos dinámicos correctos. 🔴 En headless con
  `--virtual-time-budget` **las transiciones no avanzan** (`max-height` computado 0 en la tarjeta expandida): se
  confirmó con captura, no con `getComputedStyle`.
- `python -m http.server` del launch.json sirve sin `Cache-Control`; el explicador es un solo HTML con CSS/JS en
  línea, así que alcanzó con `?_v=` en la URL. Para módulos `.js` externos usar `http-server -c-1`.

## Gotchas críticos

0. **FORMA DE PAGO = matriz de 5 columnas (13 jul 2026)** — el PDF INS trae precios por tipo de repuesto. El parser DEBE elegir la columna del repuesto de la página 1 (`_parsePaymentMatrix`/`selectPriceColumn`); agarrar el primer número de cada fila (parser viejo) manda el precio equivocado. `_pageItems` necesita `w: i.width` para calcular el centro X de cada item. Verificar SIEMPRE con PDF.js real (no el preview congelado, gotcha #16): items reales → `_parsePaymentMatrix`. Si el agente edita el repuesto en vista 2, `_syncDataFromView2` re-selecciona la columna.
1. **Orden JS estricto** — ver sección "Orden de carga". Cualquier módulo que llame CFG antes de que `config.js` cargue rompe en silencio.
2. **applyProfile() ANTES de usar CFG** — en sub-páginas (`/cancelacion/`, `/polizas-activas/`) llamar `applyProfile(loadProfile())` al inicio para que CFG refleje al agente correcto.
2b. **El perfil en localStorage GANA sobre los defaults de config.js** — `agent-profile.js` hace `if (p.agendaUrl) CFG.AGENDA_URL = p.agendaUrl;` y equivalentes. Por eso **cambiar un default de CFG que también viva en el perfil (AGENDA_URL, WEBSITE, FROM_*, PHONE, LICENSE) NO le llega a los agentes con el push**: cada agente tiene que abrir ⚙ y volver a guardar su perfil. Avisarle a JC cuando un cambio caiga en este caso.
3. **Solo Gmail** — flujo único: initTokenClient → getToken → buildMIME → sendEmail. NO reintroducir bifurcación de proveedor sin pedido explícito de JC.
4. **Logo en emails = HTML+tablas** — nunca `<img>` con SVG o PNG de dominios nuevos. Gmail los bloquea.
5. **IDD2 siempre visible** — no condicionar el bloque IDD2 a un checkbox. Si en el futuro se agrega opción de NO incluir IDD2, volver condicional.
6. **sr=n badge** — el label correcto es "Alternativo / Genérico o usado" (no "Repuesto Genérico"). Actualizado 28 may 2026.
7. **Params de URL del explicador** — `num()` normaliza montos del PDF ("10,000,000.00" → "10000000") antes de encodear. Sin eso `parseInt` da 10, Number da NaN.
8. **base64 en chunks** — `_uint8ToBase64` parte en chunks de 8192 bytes para evitar `Maximum call stack size exceeded` en PDFs grandes.
9. **CFG.GUIDE_URL apunta al dominio Netlify** — el custom domain `cotizador.appsegurosdigitales.com` también está en los orígenes autorizados de OAuth, así que ambos funcionan; pero si aparece un dominio NUEVO hay que agregarlo primero en Google Cloud Console o el login se rechaza. (Fue el caso del sitio Netlify duplicado `cotizador-autos-sdi.netlify.app`, que rechaza login porque no está autorizado — ver Pendientes.)
10. **Tests** — `tests/*` son Node sin runner, **17 archivos / 612 checks** (contados el 27 ago 2026). El más
    nuevo: **`test-explicador-secciones.js`** (32 — la lógica pura del explicador dinámico, incluida la regla de
    asistencia G/M, extraída de `explicacion/index.html` por los marcadores `[GUIA-CB-PURO]`, + el circuito
    correo → `cb` → guía). Del 25 ago:
    **`test-email-marca.js`** (45 — la placa, el relleno del cero km, el pie, los pagos) y
    **`test-coberturas.js`** (76 — el parser, las filas, la nota de deducibles y, sobre todo, **que el correo y la
    guía no se contradigan**). Los demás: test-explicador-url, test-deducible-dfh, test-payment-matrix,
    test-history-wa, test-history-stats, test-history-search, test-history-merge, test-poliza-extract,
    test-poliza-email, test-renovacion-extract, test-renovacion-email, test-standard-docs, test-shortlink,
    test-enlace-validacion.mjs. Correr con `node tests/test-xxx.js`.
    🔴 **Los tests de `poliza-email` y `renovacion-email` cargan `email-marca.js` al `global` antes de requerir su
    módulo** (en el navegador lo hace el `<script>`). Si se agrega otro correo, hay que hacer lo mismo. Ninguno necesita `npm install`: por eso los validadores de la Function viven en `netlify/functions/lib/validacion.mjs` (importar `enlace.mjs` exige `@netlify/blobs`, que localmente NO está instalado). Los módulos nuevos (poliza-extract, poliza-email, standard-docs) exportan vía `module.exports` con guard `typeof window/module` → se requieren directo. `poliza-email` necesita `global.CFG` antes de requerir. (Eliminados test-coverage-url / test-coverage-email junto con el módulo de coberturas.)
11. **Vista 2 editable** — todos los campos menos Nº cotización son editables. `_syncDataFromView2()` vuelca las correcciones a `S.data` al pulsar Continuar — si agregás un campo nuevo, sumalo al sync o se pierde.
12. **CSP comentada en netlify.toml** — la línea Content-Security-Policy está documentada pero comentada. Antes de activarla, validar en deploy preview que el flujo OAuth de Google y los CDNs no se rompan (envío real de un correo).
12b. **El tope del historial es SOLO del navegador** (21 ago 2026) — `HISTORY_MAX` (2000) lo aplican
    `saveHistoryEntry`, `replaceHistory` y `mergeHistories` **por defecto**; lo que va a Drive se fusiona con
    `Infinity`. Si volvés a poner un tope en el camino a Drive, el respaldo empieza a borrar el historial viejo
    otra vez (fue lo que se comió julio 2026). El test `mergeHistories con Infinity NO recorta` lo vigila.
13. **Historial sin PDF** — `js/history.js` guarda metadatos + URL del explicador, NUNCA el PDF (excedería la cuota localStorage). Reenviar = volver a subir el PDF.
14. **Stats: valor legacy desde `va=`** — no asumir que toda entry trae `valor`; usar siempre `historyEntryValue(e)` (cae al param `va=` del guideUrl para entradas viejas). Umbral alto valor = `STATS_HIGH_THRESHOLD` (₡10M) en app.js.
15. **Correo de seguimiento** — `buildFollowUpEmail` es texto+colores SIN `<img>` (regla Gmail); se envía con `buildMIMESimple` (sin adjunto) por el MISMO pipeline Gmail (`getToken`→`sendEmail`), así que pide OAuth en la pestaña 📊 si no hay token cacheado.
16. **Preview de sesión congelado** — el `preview_start` del entorno sirve el HEAD commiteado del INICIO de sesión y NO refleja ediciones del working-tree ni commits nuevos (comprobado: `git show HEAD:` coincidía byte-a-byte con lo servido). Verificar con `node tests/` y curl a producción (`cotizador.appsegurosdigitales.com`), no por el preview local.
17. **El PDF de cotización debe tener 2 páginas exactas** — es el formato estándar del INS (ASINS-170). Si trae 1 sola página, la extracción lanza error a propósito. No "arreglarlo" tolerando 1 página.
18. **Coordenadas Y: PDF.js y pdf-lib usan bottom-up** — son compatibles directamente, NO hay que convertir. Cualquier "fix" que invierta la Y rompe el tapado de filas.
19. **Primer nombre del saludo (cotización)** — el PDF del INS trae "APELLIDO APELLIDO NOMBRE [NOMBRE2]": se toma el **tercer token** y se capitaliza. Ojo: en formularios donde el agente digita en orden normal el primer nombre es `parts[0]` — confundir las dos lógicas ya causó un bug real.
20. **Comparar "Sustitución de repuestos" sin acentos y en minúscula** — el PDF a veces escribe "garantia plus" y a veces "Garantía Plus". La comparación es case-insensitive y sin acentos (por charCode `0x300-0x36f`, nunca literales Unicode invisibles).
21. **"Anual −10%" ya viene calculado en el PDF** — el badge del correo solo lo muestra; no recalcular ni aplicar el descuento otra vez.
22b. **Dos nombres del cliente: `client` (saludo) y `clientFull` (completo)** — para MOSTRAR o BUSCAR usar siempre `historyClientName(e)`, nunca `e.client` pelado; para el texto DENTRO de un mensaje al cliente, siempre `client`. Ver la tabla en la sección de estadísticas. Cambiarlos de lugar manda "Hola DELGADO ARGUELLO SILVIA MARIEL" por WhatsApp.
22c. **Todo cambio se anota en el pie de la app** (`footer.app-foot` en `index.html`, regla del 5 ago 2026): entrada nueva ARRIBA, fecha real y qué cambió **para quien usa la app** — sin nombres de archivos ni jerga. Y actualizar el `<summary>` con la fecha y el resumen de una línea.
22. **Correos viejos sin el param `a`** — los enviados antes del 8 may 2026 no llevan `agendaUrl` en el URL del explicador y el botón "Agendar mi cita" cae al formulario de JC. Si un agente necesita que un cliente viejo llegue a SU formulario, hay que reenviar la cotización.
23. **El fondo de cada pantalla lo pone una CLASE del `<body>`** (6 ago 2026) — `page-cotizar` (verde) y `page-poliza` (azul) en `css/styles.css`. La regla global de `body` sigue en `--gray-50` y **así debe quedarse**: si el tinte se mueve ahí, las dos pantallas vuelven a ser iguales, que es justo lo que JC pidió arreglar. Página nueva del mismo flujo = agregarle su clase a mano.
25. **Los 6 accesos ya NO están en el header: viven en `nav.side-rail`** (7 ago 2026).
    Si `app.js` engancha un id que ya no existe, el `addEventListener` lanza y **se cae el
    resto del `DOMContentLoaded`**. Al mover o renombrar cualquier acceso, verificar con un
    clic real que los 3 modales sigan abriendo. Las sub-páginas NO llevan rail.
26. **El comprobante de renovación NO es la cotización: A4 y período variable** (10 ago 2026) — `INS-F-1011060` es A4 595×842 (la cotización es Letter 612) y de **1 página**; su período es el **PAGADO** (puede ser trimestral o semestral), y la 3ª fecha de la fila es la **fecha límite**, que NO se usa. La placa viene con relleno de ancho fijo que **no siempre son ceros** (`PQR00ZWT456` → `ZWT456`). Y el guard D7: sin `Estado: Pagado` no se envía — no debilitarlo.
27. 🔴 **Lo que muestra el correo y lo que muestra la guía tienen que ser lo MISMO** (25 ago 2026) — las dos van
    firmadas con la licencia SUGESE del agente. Si se toca la lista de coberturas de un lado, se toca del otro.
    El correo se lo pasa a la guía por el param `cb`; el test `test-coberturas.js` compara los dos. **Sin `cb` la
    guía muestra sus seis fijas** — correcto para los enlaces ya enviados, desastre si se rompe el paso del dato.
28. 🔴 **Nada de listas fijas de coberturas** — el juego cambia entre cotizaciones (tres distintos en 25 PDF
    reales) y el deducible de D/F/H va de ₡400.000 a ₡500.000. Todo sale del PDF o no se muestra.
29. **`email-marca.js` es de los TRES correos** — un cambio ahí los toca a los tres. Y `buildEmail` **no** debe
    usar sus constantes `SDI_*`: los colores van literales en `email-template.js` (ver "Jornada 25 ago").
31. 🔴 **La clase de placa sale del campo `Clase Placa` del PDF, NUNCA del formato** (9 set 2026) — el INS
    escribe `306735` sin el `CL`, y hay particulares con placa numerica pura identicas en forma. Inferir por
    el formato pinta de rojo la chapa de un cliente particular. Lo mismo el 0 km: `SIN - PLACA TEMPORAL` es
    el dato oficial, la heuristica del relleno es solo respaldo.
30. **Verificar SIEMPRE con PDF.js real y saltándose la caché** — el smoke del parser dio coberturas vacías y
    parecía un bug: era el navegador sirviendo el archivo viejo. Comprobar `typeof` la función antes de concluir.
24. **Los montos de la guía del deducible son EJEMPLOS, no reglas** — ₡150.000/₡750.000 (Cobertura C con "N") y ₡400.000 (D, F y H con IDD) salen de un caso concreto. La nota gris que lo aclara **no se quita**, y esos números no se citan como universales en ningún correo ni en el explicador: el deducible real lo trae el PDF de cada cotización (param `dd`).

## Decisiones de diseño NO cambiar sin consultar

- **Solo Gmail** (11 jun): Outlook eliminado por decisión de JC. No reintroducir MSAL/Graph. *(Contexto: se había implementado en abr 2026 porque el hermano de JC usa Outlook en su oficina y no quería abrir una cuenta Gmail dedicada; existe un registro de app en Azure llamado **"Cotizados SDI Outlook"** — SPA, cuentas organizativas + personales, scope `Mail.Send` de Microsoft Graph — que quedó **sin uso**. Los IDs de esa app se sacan del portal de Azure si algún día se retoma; no hace falta tenerlos acá. Solo reevaluar si aparecen 3+ agentes que no quieran cuenta Gmail.)*
- **Multi-agente por localStorage**: mismo deploy, distintos browsers, distintos perfiles. No agregar auth server-side.
- **Sin mensual en PDF entregado al cliente**: los rectángulos blancos de pdf-lib son la única eliminación. El texto sigue searchable — es intencional (cumplimiento).
- **IDD2 en correo siempre**: JC tiene predefinido IDD2 en todas las cotizaciones. Si el cliente no lo tiene, el agente no usaría esta app.
- **Toggles asiático/alta gama manuales**: no autodetectar por marca. Así una marca nueva no listada también puede activar el flag. La sugerencia de alta gama (valor ≥₡50M) es solo visual — NO auto-activa el toggle.

## Auditoría E2E 11 jun 2026 — TODO EN PROD (tag de rollback `pre-e2e-11jun`, HEAD de la tanda `e08fa75`)

**14 commits pusheados a main** — contados en git el 22 jul 2026 (`git rev-list --count pre-e2e-11jun..e08fa75` = 14; todos con fecha 11 jun 2026). El tag **`pre-e2e-11jun` apunta a `4c16d79`** (el docs/checkpoint del 28 may). Documentos viejos que dicen "8 commits sin push, esperando autorización" están **desactualizados**: se pushearon todos y están en producción. JC pidió "todo E2E, elimina Outlook (solo Gmail)" y luego "dejemos todo listo hoy". Contenido:
1. `feat(email)` — eliminación total de Outlook (rm 2 archivos, sin MSAL, sin selector). De paso arregló el envío roto por Outlook.
2. `fix(security)` — XSS explicador (esc + safeHttpUrl), netlify.toml (404 para SKILL/README/docs/tests + headers XFO/nosniff/HSTS, CSP comentada), 404.html, sandbox en iframes de preview.
3. `fix(marcas)` — hint toggle 🌏 corregido, alias de búsqueda, correo de cancelación, param `dd`.
4. `fix(ux)` — vista 2 totalmente editable + sync, sugerencia alta gama (≥₡50M), validación destinatario/REP/email, toasts.
5. `feat(visual)` — Space Grotesk + Inter (adiós Sora), badge SDI en headers.
6. `feat(ux)` — historial de envíos (modal 🕘) + WhatsApp en vista 4 (campo opcional del nº del cliente → `web.whatsapp.com/send/?phone=506…&text=`; sin nº abre el selector). El link va embebido porque WhatsApp no enmascara URLs. + `test-history-wa.js`.
7. `chore(cleanup)` — rm index-react-old, rm Tailwind CDN, botón "Borrar mis datos" en ⚙.
8. docs + verificación contra 5 PDF oficiales del INS (ver "Reglas INS verificadas").

## Reglas INS verificadas contra fuente (11 jun 2026)

Contrastadas con 5 PDF oficiales que entregó JC (viven en `OneDrive\ARCHIVO DIGITAL\Automóviles\`). Resultados en `docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md`. **Estas ya NO son dudas — están confirmadas:**

- **Batería de vehículo eléctrico:** la tabla de depreciación 100 / 80 / 60 / 50 % para 0-24 / 25-48 / 49-72 / 73-96 meses **coincide con la fuente ✓**. Pero el corte real de cobertura **NO es a los 96 meses**: las Condiciones Generales (pág 34 punto v + pág 54) excluyen la batería de alta tensión desde los **nueve (9) años = 108 meses**. El aviso ya está en el explicador. Además, tras pagar la sustitución total de la batería la póliza se cancela automáticamente y la prima se tiene por devengada (pág 59, punto 7).
- **Etiquetas de coberturas — el formulario estaba MAL:** decía `G = Asistencia legal`. Lo oficial es **G = MULTIASISTENCIA (carretera)**, **M = Multiasistencia Extendida** y **E = Gastos Legales** (la "legal" de verdad, que NO está en el cotizador). Ya se corrigieron las etiquetas.
- **Alta gama:** rige la **Circular 0186-2025** (JC lo confirmó): suma asegurada ≥ ₡50M con deducible escalonado 10% mín ₡500k (≤₡6M) / 20% (>₡6M). La app está correcta. Las circulares **0395/0409-2024** (≥₡75M, 20% fijo) quedaron **superadas** — no volver a ellas.
- **Marcas:** la lista oficial son **58 filas**; faltaba SUZUKI. GWM/HAVAL, JETOUR, OMODA/JAECOO y EXEED **NO** están en la fuente.
- **Cláusula 33:** ver la sección de la calculadora — el factor va **sobre prima anual**.

## Pendientes

- 🔴 **SVA V32 del INS — dos frentes con fecha límite: 28 de setiembre de 2026.** La circular 0395-2026
  (registro SUGESE G01-01-A01-012 V32, aprobada 26/08/2026) cambia dos cosas que tocan esta app:
  1. **Cobertura ASI — Servicios de Multiasistencia (NUEVA).** Seis planes opcionales con prima adicional que el
     cliente elige en la Solicitud de Seguro: Mascota ₡7.200 · Funeraria ₡10.800 · Salud Bienestar ₡18.000 ·
     Salud Premium ₡42.000 · Autos Plus ₡42.000 · VIP ₡42.000 (anuales, **sin IVA 13% ni fraccionamiento**).
     Sin deducible; no reciben NINGÚN descuento (ni plan familiar, ni 0 km, ni buena experiencia); mínimo cobertura
     A; se puede llevar más de uno pero no repetido; territorio nacional; se piden al 800-800-8001.
     **JC escogió el diseño el 4 set 2026** (opción 2: tarjeta discreta en el correo después de las formas de pago
     + página `/asistencias/` con configurador y total en vivo) y pidió **NO implementar todavía** — sigue
     dándole forma hasta el 28. Plan por tareas con el código real:
     `docs/superpowers/plans/2026-09-04-cobertura-asi-asistencias.md`; mockups aprobados:
     `docs/superpowers/specs/2026-09-03-cobertura-asi-mockups.html` (commit `e01bc41`).
     🔴 **Trampa de nombres: la constante nueva es `CFG.PLANES_URL`, NO `CFG.ASSIST_URL`** — esa última es el
     Centro de Asistencia Digital de la póliza activa, otra app y otro repo.
  2. **Nuevo esquema de Sustitución de Repuestos (SIN PLAN AÚN).** Quedan cuatro opciones: Vehículo en Garantía,
     Extensión de Garantía **Plus**, **Original Multimarca** y Alternativo Genérico/Usado. **Desaparece "Extensión
     de Garantía" a secas** y los topes de años/km se mudan de las Condiciones Generales a la Solicitud de Seguro.
     🔴 **MEDIDO el 9 set 2026: el riesgo es MENOR de lo que decía esta ficha.** Se simuló el esquema V32 de 4
     columnas contra el código real: **las 4 etiquetas nuevas caen en su columna correcta** y se declaran
     confiables. `_reposKind` también las clasifica bien ("Original Multimarca" cae en `original`). Y cuando el
     emparejamiento falla, la app **NO se rompe en silencio**: `_reposNote()` pinta un aviso ámbar pidiendo
     verificar el tipo de repuesto. La afirmación anterior ("se rompe en silencio") era incorrecta.

     **El único hueco real** es un PDF de transición: 4 columnas nuevas con el repuesto RETIRADO ("Extensión de
     Garantía" a secas) en la página 1 — cae en la columna de "Plus" con score alto, o sea SIN aviso. Cubierto
     en `tests/test-payment-matrix.js` (5 checks "V32"), que es el sitio a tocar si aparece un PDF así.

     Queda por revisar el texto fijo de la sección 4 del explicador ("hasta 5 años o 60.000 km"), que es literal
     y no depende del parser. `_reposFixedIndex` se apaga solo con 4 columnas, así que manda `_labelMatch`.
  🔴 **Los datos del dossier se verifican leyendo cada página COMO IMAGEN.** El emparejamiento
  servicio↔límite por coordenadas se equivoca en las filas apretadas (Salud Premium). Conteos correctos:
  11 · 8 · 16 · 30 · 7 · 21.

- ~~Las secciones 3 y 4 del explicador todavía no miran las coberturas~~ — **HECHO el 27 ago 2026** (`07d0f60`,
  aprobado por JC y verificado en prod). Ver "Pasos 3 y 4 dinámicos" en la sección del explicador.
- ~~Decidir la tipografía de la CONSOLA~~ — **RESUELTO el 10 sep 2026**: `index.html` y el explicador van en v1.3. **Quedan las sub-páginas** (`/polizas-activas/`, `/renovaciones/`, `/cancelacion/`, `/marcas-recargo/`), que cargan `styles.css` sin la hoja nueva: si JC quiere la línea clara ahí, es enlazar `css/linea-clara-consola.css` en cada una, con mockup, y revisar su cabecera (no tienen rail ni `.lc-top`). Las 3 páginas cargan Poppins y `css/styles.css` pide `'Poppins','Inter'`,
  mientras los correos y la documentación usan Space Grotesk. No se tocó porque cambia visualmente toda la app.
- **El nombre del agente va sin tilde** (`CFG.FROM_NAME = 'Juan Carlos Hernandez Vargas'`); el logotipo dice
  *Hernández*. 🔴 Corregir el default **NO le llega a JC**: su perfil en localStorage gana (gotcha 2b). Tendría que
  abrir ⚙ y volver a guardar. A un agente nuevo sí le llegaría.
- 🔴 **Publicar la pantalla de rescate** (rama `feat/rescate-versiones`) si JC la aprueba — y **cuanto antes**: cada día
  que pasa Google purga versiones viejas de Drive y baja la chance de recuperar julio 2026. Ver la sección del incidente.
- **Revisar si otros cotizadores tienen el mismo bug del tope**: cualquiera que guarde historial en localStorage y lo
  respalde con `merge + cap` está borrando lo viejo del respaldo sin avisar.
- **El botón 🗑 de la 📊 no borra de Drive** (comportamiento viejo, no lo introdujo el arreglo): `mergeHistories` es
  unión, así que una entrada borrada a mano vuelve al restaurar. Para borrarla de verdad haría falta marcarla como
  eliminada en el respaldo, no solo sacarla del navegador. No urgente; se usa para borrar pruebas.
- **Replicar el modo "Solo WhatsApp"** a `/polizas-activas/` y al cotizador, si a JC le sirve en
  Renovaciones (19 ago 2026: se implementó en una sola pantalla a pedido suyo). 🔴 Las dos afirman en su
  mensaje de WhatsApp que ya se mandó un correo — *"Le acabamos de enviar todos los documentos del seguro a
  su correo electrónico"* (`buildPolizaWaUrl`) y *"Te acabo de enviar por correo la cotización de tu…"*
  (`buildWaShareUrl`) —, así que el texto hay que corregirlo igual que en renovaciones. En el cotizador hay
  algo más que decidir: el envio alimenta el historial y el 📊, y habría que definir si un aviso sin correo
  se registra como cotización enviada.
- **Pie con el registro de cambios en el explicador** (`/explicacion/`): la regla del
  5 ago dice que en apps con dos caras va también en la del cliente, escrito como
  beneficio visible. En esta app se puso solo en la consola del agente; falta
  proponerle a JC el del explicador — lo ve el asegurado, así que se pregunta antes.
- **Cláusula 33, borde de mes exacto** (decisión de JC, NO urgente): la tabla dice "Hasta 1 mes" inclusivo pero el código manda el aniversario exacto al tramo superior. Conservador. Solo afecta ese día.
- ~~Borrar el sitio Netlify duplicado `cotizador-autos-sdi.netlify.app`~~ — **HECHO** (verificado el 19 ago 2026: responde 404, ya no existe). Los hosts oficiales son `cotizador.appsegurosdigitales.com`, `cotizador-segurosdigitalesins-sdi.netlify.app` y, desde el 19 ago, `guia.appsegurosdigitales.com` (alias solo para los enlaces cortos).
- **Entregabilidad de `segurosdelins.com`** — medido el 19 ago 2026: el **SPF existe** pero termina en
  `?all` (neutral: no le pide al receptor que haga nada con un remitente no autorizado; lo recomendable es
  `~all`). **No hay DKIM** con el selector `google` ni registro **DMARC**. Los tres se arreglan agregando
  registros TXT en el DNS del dominio — JC debe indicar dónde está hosteado; DKIM además se activa desde
  el panel de Google Workspace, que genera la clave.
- **Publicar la app en Google Cloud** (salir de modo Testing) si llegan **5+ agentes** — quitaría el límite de Test Users y la advertencia "App no verificada".
- **Prueba de fuego del respaldo Drive** (opcional): restaurar en una ventana de incógnito.
- **Recordatorio de cita por correo a las 7am — DESCARTADO por ahora (17 jun 2026).** La app no tiene backend, así que no puede disparar sola a una hora fija; JC aprobó el camino de **evento de Google Calendar**, pero **no se implementó** porque exigía agregar el scope `calendar.events` al OAuth + habilitar la Calendar API (paso manual de JC) y él dijo "descartamos por ahora". Si se retoma: scope nuevo, evento en el calendario de CADA agente, recordatorio por correo a las 7am y guardar el `eventId` para actualizarlo/borrarlo cuando la cita cambie o se cierre.

## Historial detallado

Para decisiones anteriores, commits específicos, bugs resueltos y gotchas extendidos: leer `SKILL_COTIZADOR_SDI.md` en la raíz del repo (checkpoint extendido) — ahí está el detalle del arranque, del explicador v2, de la plantilla de correo v2, de la Cláusula 33 y de la feature de coberturas ya eliminada. Ver "Recursos y accesos" → las 3 ubicaciones de la documentación.

## (ELIMINADO 5 ago 2026) Consultor de Autos /consultor/

Vivió 8 días. JC pidió borrarlo **por completo** el 5 ago 2026 y así se hizo, commit
`0089472`. Se fueron: `consultor/` (index, admin, `consultor.js`, `admin.js`),
`netlify/functions/consultar.mjs` y `corpus-admin.mjs`, `netlify/functions/data/`
(corpus de 428 secciones + el PDF de la Guía de Suscripción), `procesador/`
(`seccionador.py`, `revision.py`, `detectar_tablas_imagen.py`, `tablas-imagen.json`),
`tests/banco-reglas-ins.mjs`, `tests/busqueda-literal.mjs`, la spec
`docs/superpowers/specs/2026-07-28-consultor-autos-design.md` y el botón 🔎 del header.
Limpiadas las referencias en `netlify.toml` (el `included_files` del corpus y el 404 de
`/procesador/*`) y en `package.json`. **No reintroducir sin pedido explícito de JC.**

**Rastro para revivirlo** (el código sigue vivo en git — no hay que reescribirlo):
- **Tag `pre-borrar-consultor-5ago`** → `59f3c4d`, el estado justo ANTES del borrado,
  con todo el Consultor en pie. Pusheado a origin.
- Commits de la feature: `cd2134e` (merge fases 1-4), `7a165eb`, `9233c07`, `0d52ee5`
  (merge), `eef7735`, `510e32e`, `6d03959`, `59f3c4d`. Tags viejos que siguen ahí:
  `pre-consultor-28jul`, `pre-fase5-6-28jul`.
- Si alguna vez se retoma, el diseño completo está en la spec borrada (recuperable del
  tag) y el detalle en los dos checkpoints del 28 jul de `SKILL_COTIZADOR_SDI.md`.

**Del lado de Netlify — ✅ HECHO por JC el 6 ago 2026.** Borró las 4 variables
(`CONSULTOR_COTIZADOR_AUTOS_AKEY`, `CONSULTOR_EMAILS`, `CONSULTOR_CLIENT_ID`,
`CONSULTOR_TOPE_DIARIO`) y **revocó la clave de Anthropic** en `console.anthropic.com/settings/keys`.
No queda ni rastro del Consultor en infraestructura. **Si alguna vez se revive** (tag
`pre-borrar-consultor-5ago`), hay que crear una clave NUEVA y volver a cargar las 4
variables: la vieja ya no sirve.

**Lo que SÍ sobrevive y NO hay que tocar** al limpiar restos del Consultor:
`netlify/functions/enlace.mjs` (enlace corto de la guía — es del mismo 28 jul pero es
otra cosa), `package.json` + `@netlify/blobs` (los necesita esa Function), el 404
forzado de `/netlify/*`, y `docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md` (las reglas del
INS que verificó JC a mano en junio: son fuente del proyecto, no del Consultor).

## Enlaces cortos · `/g/:id` (guía de la cotización) y `/a/:id` (guía de emergencias)

### 🔴 El host lo pone `SHORTLINK_HOST`, NO `location.origin` (19 ago 2026)

El cliente ve la URL cruda en WhatsApp. Hasta el 19 ago el alias se armaba con
`location.origin`, o sea con **el dominio por el que hubiera entrado el
agente**: a un cliente que acababa de renovar le llegaba
`cotizador-segurosdigitalesins-sdi.netlify.app/a/...` dentro del mensaje que
le explica qué hacer ante un accidente. Lo reportó JC ("no me gusta que diga
cotizador"). Ahora el host va **fijo** en `SHORTLINK_HOST`
(`js/shortlink.js`): **`https://guia.appsegurosdigitales.com`**. Sirve las dos
rutas, por eso se llama "guia" y no "asistencia". El enlace bajó de **66 a 49
caracteres**. Commit `4dab2c3`, tag de rollback `pre-host-guia-19ago`.

- **Es un ALIAS del mismo sitio de Netlify**, no otro sitio. De eso dependen el
  POST relativo (mismo origen, sin CORS) y que los ids ya emitidos resuelvan
  desde cualquiera de los tres hosts. Los enlaces enviados antes **no se
  rompieron** (verificado con el de un cliente real: 302 correcto en los tres).
- `cotizador.appsegurosdigitales.com` sigue siendo el **primary domain** y no
  se tocó. El certificado no hubo que renovarlo: es **wildcard**
  `*.appsegurosdigitales.com`. El alias sirve **directo**, sin 301 al primario.
- **Para cambiar el host** hay que agregar antes el dominio en Netlify
  (Domain management → Add domain alias) y **comprobar que responde**. Si se
  publica el código primero, los enlaces salen muertos y el fallback NO lo
  cubre: para entonces la Function ya respondió 200 y el link parece bueno.

### 🔴 Un alias recién creado NO tiene enganchada la Function hasta que se redespliega

Trampa que costó un susto y que **se repite en cualquier proyecto con Netlify
Functions**: apenas agregado el alias, la raíz respondía **200** (los estáticos
se sirven al toque) pero `/a/:id` y `/g/:id` daban **500**, mientras los dos
hosts viejos daban 302 normal. La pista estaba en los logs: **las peticiones
al host nuevo ni aparecían** (el edge las cortaba antes de llegar a la
Function) y la ficha de la Function listaba sus *Endpoints* solo bajo el
dominio primario. **Se arregla con un redeploy** (Deploys → Trigger deploy →
Deploy project) del mismo commit; no hace falta cambiar código.

→ Moraleja: **"la página carga" no prueba que la Function esté enganchada.**
Al agregar un dominio, probar la RUTA de la Function, no la raíz.


`netlify/functions/enlace.mjs` + `netlify/functions/lib/validacion.mjs`. Los dos
enlaces que el cliente ve CRUDOS en WhatsApp son largos y WhatsApp los partía con
"Leer más"; ahora miden 54 caracteres.

| Ruta | Qué acorta | Destino | Lista blanca |
|---|---|---|---|
| `/g/:id` | Guía de la cotización (hasta 13 params, ~280 chars) | `/explicacion/` **del mismo sitio**, armado en el servidor | `CLAVES` (params del explicador) |
| `/a/:id` | Guía de emergencias de la póliza (ficha del agente, ~183 chars) | **otro sitio** (app de asistencia) → `DESTINOS_A` | `CLAVES_A` (`a,n,tel,wa,em,lic,web`) |

Se acorta **solo** donde el cliente ve la URL cruda: WhatsApp (vista 4 e historial
💬 del cotizador, vista 4 de pólizas) y Copiar 📄. El correo y el historial guardan
el LARGO a propósito, porque `historyEntryValue`/`historyEntryPlate` parsean `va` y
`p` del guideUrl. Si falla, se comparte el largo. `window.open('')` ANTES del await
o el navegador bloquea la pestaña.

- **El front vive en `js/shortlink.js`** (`acortarEnlace(url, tipo)`), compartido por
  las dos pantallas. `acortarGuia` de history.js quedó como wrapper delgado que
  llama con `'g'` — es el nombre que usa `app.js` en 3 lugares.
- **`/a` es el único que redirige fuera del sitio, y por eso el host va contra
  `DESTINOS_A`** (comparación EXACTA de origin, no por prefijo — si no,
  `…netlify.app.malo.com` pasaría). Un host fuera de la lista da 400 y el front cae
  al largo. Se revalida también AL SERVIR, no solo al crear. **No convertir esto en
  un redirector abierto**: nunca aceptar el host que mande el cliente sin lista.
- **En `/a` todos los avisos de un mismo agente comparten id, y está bien**: ese
  query es solo su ficha, sin un dato del cliente. NO es el bug de la huella
  truncada (abajo) y no hay que hacerlo único por cliente.

**La huella es sha256 del query completo, y no se toca.** La primera versión
truncaba a 90 bytes; como `_buildGuideUrl` pone siempre primero los datos del
agente (116 bytes), todas las cotizaciones compartían huella y el segundo cliente
veía la guía del primero. Lo cazó una revisión adversarial, no las pruebas
manuales — probar idempotencia con el mismo query string no detecta esto.

### 🔴 El espacio NO va en el regex de caracteres prohibidos

`esNuestro` rechaza valores con `\r`, `\n` y NUL porque reventarían la cabecera
`Location` del 302. **El espacio NO se rechaza y no se puede agregar**:
`URLSearchParams` **decodifica** los valores, así que `n=Juan%20Carlos` llega como
`"Juan Carlos"`. Con el espacio en la clase, el acortador rechazaría toda
cotización real (ningún agente ni cliente se llama con una sola palabra) y caería
al link largo **en silencio** — solo un `console.warn`. Cubierto por
`g-acepta-espacios` / `a-acepta-espacios` en `test-enlace-validacion.mjs`.

## Trampas transversales que dejó la jornada del 28 jul (siguen aplicando)

Sobrevivieron al borrado del Consultor porque no son suyas — valen para cualquier
cosa que se haga en este repo:

- `package.json` **sin** `"type": "module"`: declararlo rompe los tests CommonJS.
  Las Functions ya son ESM por su extensión `.mjs`, que manda sobre ese campo.
- **Un archivo de código que git marca `Bin` en `git diff --stat` tiene un byte de
  control adentro.** Pasó con `enlace.mjs` (un NUL crudo dentro de un regex, que se
  lee igual que un espacio y sobrevivió 10 días en producción). Si aparece un `Bin`
  en un `.js`/`.mjs`, buscar el byte con `Buffer.indexOf(0)` ANTES de reescribir el
  archivo — al reescribirlo el carácter invisible se pierde y cambia el
  comportamiento sin que se vea en el diff.
- **Antes de "arreglar" algo que parece roto en el fuente, probar producción.** El
  guard de `enlace.mjs` parecía rechazar todo nombre con espacios; un
  `curl -X POST https://cotizador.appsegurosdigitales.com/g` respondió 200 y probó
  que la lectura del archivo era lo que estaba mal, no el código.
- Toda página que arme un correo debe cargar `agent-profile.js`, o sale con la
  licencia SUGESE de JC aunque lo mande otro agente.
- Tokens de Google por cabecera `Authorization`, nunca en la URL (quedan en logs).
- GIS necesita `error_callback`: si el navegador bloquea el popup y no está, la
  Promise se cuelga para siempre y la pantalla queda "pensando".
- `window.open('')` ANTES del `await`, o el navegador bloquea la pestaña.
- Búsqueda en español: comparar **por raíz de ~6 caracteres**, no por palabra
  exacta. JC escribe "cilindradas" y el INS dice "cilindraje".
- Hay tablas del INS **incrustadas como imagen**: el texto no las trae y el dato
  desaparece en silencio. Si un PDF del INS "no tiene" un dato que debería tener,
  rasterizar la página y leerla como imagen antes de concluir nada.

---

> **Ubicaciones canon (desde el 6 sep 2026, decisión 10-C):** `jhernandez-vibecode/COTIZADOR-AUTOS` → `.claude/skills/especialista-cotizador-autos-sdi/SKILL.md` y `C:\Users\segur\.claude\skills\especialista-cotizador-autos-sdi\SKILL.md`, byte-idénticas. Se edita en el repo, se commitea y se copia al user-level (o al revés, pero siempre las dos en el mismo día).
