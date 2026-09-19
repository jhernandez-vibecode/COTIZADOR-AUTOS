# Formulario propio de cita de aseguramiento (`/cita/`) — diseño

**Fecha:** 18 de setiembre de 2026 · **Estado:** diseño aprobado por JC sobre mockup, SIN implementar
**Mockup aprobado:** `2026-09-18-cita-formulario-propio-mockup.html` (misma carpeta) · artefacto privado
https://claude.ai/artifact/EP4TxcngHFCgRm6Ug8AA3f (versión 2)

## 1. Qué es y por qué

Hoy el botón "Agendar mi cita" de la guía (`/explicacion/`) saca al cliente a un Google Form de JC
("Solicitud Cita Aseguramiento- Inspección Virtual de Auto"). Un script atado a ese formulario le manda al
cliente el correo "¡Solicitud Recibida Exitosamente!" y a JC le llega la respuesta.

Tres problemas:

1. **No es multi-agente.** El formulario, el script, la hoja y el pie ("Gestionado por: Juan Carlos… 08-1318")
   son de la cuenta de Google de JC. Otro agente tendría que armar los tres por su cuenta.
2. **El cliente vuelve a escribir lo que la guía ya sabe** (placa) y cambia de cara a mitad del recorrido.
3. **Las asistencias opcionales no viajan.** Para pasarlas a Google hacía falta una pregunta de casillas con
   nombres exactos y un enlace de relleno previo por agente (decisiones G2 y G3 del 18 sep). Con formulario
   propio dejan de hacer falta.

La solución: una página propia `/cita/` con **las mismas 9 preguntas** más el correo del cliente, prellenada
desde la guía, y una Netlify Function que manda dos correos: confirmación al cliente y solicitud al agente
**que envió esa cotización**.

## 2. Decisiones de JC (18 sep 2026) — no cambiar sin consultarlo

| | Decisión |
|---|---|
| **Canal** | Correo al agente + confirmación al cliente (se descartó WhatsApp solo y la bandeja en servidor) |
| **Historial** | El correo ES el registro: cada agente lo guarda en su etiqueta "Citas de aseguramiento". **La plataforma no almacena respuestas.** |
| **Dónde vive** | Página propia `/cita/` (no dentro de la guía) |
| **C1** | Trato de **vos** en la página y en el correo al cliente. **Las preguntas van palabra por palabra** como en el Google Form, aunque estén de usted |
| **C2** | Se dice **"Solicitud recibida"**, nunca "cita agendada/confirmada": el espacio lo confirma el agente |
| **C3** | La fecha solo admite **lunes a viernes**, desde hoy. Sin corte por hora |
| **C4** | Casilla de consentimiento obligatoria: uso exclusivo para tramitar el seguro, **no para publicidad** |
| **C5** | Remitente de plataforma `citas@appsegurosdigitales.com` con el nombre del agente delante; servicio de envío transaccional; DNS en Netlify (JC autorizó a Claude a usar el panel de Netlify) |
| **C6** | G2 y G3 (casillas y relleno previo en Google) quedan **sin efecto**. G1, G4 y G5 siguen abiertas (sección 12) |
| **Ingreso** | "Ingreso Mensual Promedio" pasa de texto libre a **selector por rangos** (pedido de JC: facilita que la gente lo declare) |
| **Aviso** | La pantalla de recibido destaca que si el espacio no se puede, **nos ponemos en contacto para reprogramar** |
| **Piloto** | Solo JC lo activa. Los otros agentes siguen como hoy hasta que cada uno lo prenda |

## 3. Las preguntas (transcritas del Google Form el 18 sep 2026)

Orden, texto y obligatoriedad se copian literal. Única diferencia: el correo (Google lo recogía por fuera de
la lista) y el ingreso por rangos.

| # | Campo (`name`) | Texto de la pregunta | Tipo | Oblig. |
|---|---|---|---|---|
| 1 | `nombre` | Nombre Completo | texto | sí |
| 2 | `telefono` | Número de Teléfono | tel | sí |
| — | `correo` | Correo electrónico · ayuda: "Aquí te llega la confirmación y el código QR de las fotos." | email | sí |
| 3 | `direccion` | Dirección Domicilio (Provincia- canton- distrito y señas) | párrafo | sí |
| 4 | `ocupacion` | Ocupación u Oficio | texto | no |
| 5 | `ingreso` | Ingreso Mensual Promedio · ayuda: "Opcional. Un rango aproximado es suficiente." | selector | no |
| 6 | `placa` | Número de Placa o Indique si es Cero Kilómetros | texto, **prellenado** | sí |
| 7 | `formaPago` | Forma de pago que desea contratar → Anual · Semestral · Trimestral | una opción | sí |
| 8 | `fecha` | Por favor, indique la fecha en la que desea programar el aseguramiento de su vehículo · nota: "Tome en cuenta que nuestro horario comercial es de lunes a viernes de 8:00 am a 5:00 pm" | fecha | sí |
| 9 | `franja` | Por favor, seleccione el rango de horas que prefiere para coordinar el aseguramiento. · nota: "Es necesario que a esa hora tenga disponible su vehículo para las fotografías que vamos a necesitar y verificar el estado de conservación mediante una videollamada." → 8:00 am a 10:00 am · 10:00 am a 12:00 md · 01:00 pm a 03:00 pm · 03:00 pm a 05:00 pm | una opción | sí |

**Rangos de ingreso (aprobados):** Menos de ₡500.000 · De ₡500.000 a ₡1.000.000 · De ₡1.000.000 a
₡2.000.000 · De ₡2.000.000 a ₡4.000.000 · Más de ₡4.000.000. Primera opción vacía "Seleccioná un rango".

**Consentimiento (`consent`, obligatorio):** "Autorizo el uso de estos datos únicamente para tramitar mi
seguro de automóviles con el INS. **No se usan para publicidad** ni se comparten con terceros."

**Pie del formulario:** "Si el horario solicitado no está disponible, te contacto de inmediato para
reprogramar al espacio más cercano."

La placa llega vacía cuando la cotización es de 0 km (la guía ya no recibe el relleno `000111`).

## 4. Recorrido

```
Correo de cotización ─► Guía ─► (opcional) Asistencias ─► Guía
                          │
        "Agendar mi cita" (los 4 botones de la guía y el CTA del correo)
                          ▼
   agente en modo "Formulario SDI"  ──►  /cita/?…        (NUEVO)
   agente en modo "Mi enlace propio" ─►  pantalla "Falta un paso" + su enlace   (como hoy)
                          ▼
   POST /cita/enviar ─► Function ─► correo al CLIENTE + correo al AGENTE
                          ▼
   misma página: "Solicitud recibida" + aviso de reprogramación + 4 pasos del día de la cita
   (si el envío falla: botón de WhatsApp al agente con las respuestas ya escritas)
```

En modo SDI la pantalla "Falta un paso" (`#celebBackdrop`) **no se muestra**: el botón navega directo a
`/cita/` en la misma pestaña. En modo propio queda exactamente como se publicó el 18 sep (`67f1f22`).

## 5. Piezas

Cada una con un solo propósito y probada por separado.

### 5.1 `cita/index.html` — la página (cara del cliente)

- INS arriba en azul, SDI al pie, línea clara v1.3; calcada de `/asistencias/` (mismos tokens y barra en dos
  niveles). Sin registro de cambios (es cara del cliente).
- Lee del URL: `n,l,w,wa,tel,ae` (agente) · `c,v,p,y` (cliente y vehículo) · `pa,ps,pt` (primas) ·
  `as` (asistencias, formato `mascota.premium`). Todo lo que se pinta va por `textContent`/`esc()`.
- Carga `../js/planes-asistencia.js` solo para traducir `as` a nombres (única fuente, gotcha 27). Si no carga,
  el renglón de asistencias no sale.
- Hero: "{c}, agendá tu aseguramiento" (sin `c`: "Agendá tu aseguramiento"). **Sin género**: "Estás a un paso
  de proteger tu vehículo" (el mockup decía "protegida"; del PDF no sale el género).
- Validación en el navegador: obligatorios, correo con el regex laxo de `wizard.js` (copiado: la página no
  carga módulos de la consola), teléfono con al menos 8 dígitos, fecha ≥ hoy y **de lunes a viernes** (mensaje
  al elegir sábado o domingo), consentimiento marcado.
- 🔴 Trampas ya conocidas que aplican: `input[type=date]` en iOS no se encoge (`min-width:0`, columna
  `minmax(0,1fr)`, y **smoke en iPhone real de JC**, Chrome no lo reproduce); `[hidden]{display:none!important}`
  para alternar `#citaForm` ↔ `#citaOk` ↔ `#citaFallo`.
- Envío: `fetch('/cita/enviar', {method:'POST', body: JSON})`. Botón deshabilitado mientras envía (sin doble
  envío). Al responder 200 → `#citaOk`. Cualquier otra cosa o error de red → `#citaFallo`.
- `#citaFallo`: "No pudimos enviar tu solicitud" + botón WhatsApp al agente (`web.whatsapp.com/send/`, nunca
  `wa.me`) con las respuestas redactadas + "Intentar de nuevo". Sin `wa` en el URL: solo reintentar y el
  teléfono del agente.
- Campo trampa `sitio` oculto por CSS (no `type=hidden`): si llega lleno, la Function responde 200 y no envía.
- Pie: "Gestionado por {n}, agente exclusivo del INS · Licencia SUGESE {l}" — **del URL, nunca fijo**.
- Sin `ae` o sin `n` en el URL (enlace armado a mano): la página no muestra el formulario y ofrece volver.

### 5.2 `netlify/functions/cita.mjs` — la Function (`POST /cita/enviar`)

Orquesta y nada más: parsea → valida → limita → arma → envía. La lógica vive en `lib/`.

- **`lib/cita-validacion.mjs`** (pura, sin dependencias, testeable con Node pelado como `validacion.mjs`):
  lista blanca de campos, largos máximos (nombre 120 · dirección 400 · resto 80), opciones cerradas
  (`formaPago`, `franja`, `ingreso` deben ser uno de los textos exactos), correo, fecha `AAAA-MM-DD` ≥ hoy y
  lunes-viernes **en zona `America/Costa_Rica`**, `consent === true`, rechazo de `\r`, `\n` y NUL en todo
  campo de una línea (**el espacio NO**: ver la trampa de `enlace.mjs`), `as` contra los ids de los seis
  planes, `ae` contra `CITA_AGENTES`.
- **`lib/cita-correos.mjs`** (pura): `correoCliente(datos)` y `correoAgente(datos)` → `{asunto, html, texto}`.
  Todo valor del usuario escapado. Transcriben el mockup aprobado.
- **Envío:** API REST del servicio transaccional con `fetch` (sin paquete npm nuevo). Propuesto **Resend**;
  🔴 verificar su documentación vigente (endpoint, campos `from`/`reply_to`, registros DNS) al implementar,
  no de memoria.
- **Variables de entorno (fail-closed: si falta alguna, 503 y el front cae a WhatsApp; nada de valores por
  defecto en el código):** `CITA_API_KEY` (la pega JC en Netlify, nunca en el chat) · `CITA_FROM`
  (`citas@appsegurosdigitales.com`) · `CITA_AGENTES` (correos autorizados, separados por coma).
- **Freno contra abuso:** (1) solo se le escribe a un agente de `CITA_AGENTES`; (2) campo trampa; (3) límite
  por IP y por correo destino en Netlify Blobs — se guarda **solo un hash y un contador por hora**, ningún
  dato del cliente; superado → 429; (4) plantilla fija: el correo al cliente solo repite su nombre, placa,
  fecha, franja, forma de pago y asistencias, todos con tope de largo; (5) mismo origen (sin CORS abierto).
- **Privacidad:** la Function no persiste respuestas y **no las escribe en los logs** (solo placa enmascarada
  y resultado). Los datos van en el cuerpo del POST, nunca en el URL.
- **Orden de envío:** primero el del agente (es el que no se puede perder); si falla → 502 y el front muestra
  `#citaFallo`. Si el del agente sale y el del cliente falla → 200 con `clienteAvisado:false`; la pantalla de
  recibido omite "te envié la confirmación a…" y el correo del agente lleva la nota "No se pudo enviar la
  confirmación al cliente".

### 5.3 Los dos correos

| | Al cliente | Al agente |
|---|---|---|
| **De** | `{n} · Seguros del INS <citas@…>` | `Citas · Seguros Digitales SDI <citas@…>` |
| **Responder a** | `ae` (el agente) | el correo del cliente |
| **Asunto** | `Recibimos tu solicitud de cita · {placa}` | `Cita solicitada · {placa} · mar 22 sep · 3-5 pm · {nombre}` |
| **Cuerpo** | Línea clara de los otros correos: header navy + logo INS + filete, HOLA + nombre de pila, sello "Solicitud recibida", tabla (fecha, horario, forma de pago, asistencias si hay), párrafo de revisión y reprogramación, "¿Qué pasará el día de tu cita?" (4 pasos + formas de pago), firma del agente (nombre, teléfono, licencia), pie SDI | Sobrio, sin cabecera de marca: sello, fecha y franja grandes, "Respuestas del cliente" (las 10), "De la cotización" (vehículo, primas, asistencias), botón WhatsApp al cliente, bloque "Para copiar y pegar" |

Reglas heredadas: sin `border-left`, sin emojis, logos como PNG alojados con URL absoluta
(`img/ins-logo.png`, `img/sdi-logo-email.png`), montos con `'de-DE'`, texto plano alternativo incluido
(entregabilidad), nombre de pila = primera palabra de `c` o, si no hay, de `nombre`.
Con 0 km el asunto usa "0 KM" en lugar de la placa.

### 5.4 Consola: interruptor en ⚙ y armado de enlaces

- **Perfil:** campo nuevo `citaModo: 'propio' | 'sdi'`, **por defecto `'propio'`**. `applyProfile` lo asigna
  con guard `!== undefined` → `CFG.CITA_MODO`. Perfiles viejos quedan en `'propio'` sin re-guardar.
- **Modal ⚙:** bloque "Formulario de cita" con las dos opciones del mockup (pestaña 6) y la nota de la lista
  de autorizados. Con `'sdi'` el campo "Enlace de agenda" sigue visible (se usa de respaldo).
- **`_buildGuideUrl`:** con `'sdi'` agrega `fc=1`, `ae` (correo del perfil) y `tel`. Con `'propio'` no agrega
  nada: el enlace queda byte a byte como hoy.
- **`_buildCitaUrl(extras)`** (nuevo, en `email-template.js` junto a `_buildPlanesUrl`): el CTA "Agendar mi
  cita ahora" del correo de cotización apunta a `/cita/` en modo `'sdi'`; en `'propio'`, a `CFG.AGENDA_URL`.
- **Guía:** con `fc=1` **y** `ae`, `urlCitaDesdeGuia()` arma `/cita/?…` con sus propios params (más `as` si
  el cliente volvió del configurador) y `.cta-rect` navega ahí en vez de `openCelebration()`. Sin `fc`: nada
  cambia. La lógica va entre marcadores `[GUIA-CITA-PURO]` para probarla en Node (patrón de `[GUIA-CB-PURO]`).
- **Enlace corto:** `CLAVES` de `/g` acepta `fc`, `ae`, `tel`. 🔴 Lección del 17 sep: una clave fuera de la
  lista blanca hace que el acortador rechace el enlace y caiga al largo **en silencio** — test obligatorio.
  `/cita/` no necesita alias corto propio: nunca se comparte crudo (se llega por botón).

## 6. Otros agentes

| Situación | Qué pasa |
|---|---|
| Piloto | Solo JC pone `'sdi'`. Los otros dos agentes no notan nada |
| Enlaces ya enviados | Sin `fc` → siguen abriendo el Google Form. **El formulario de Google no se borra** |
| Agente que lo activa | Se agrega su correo a `CITA_AGENTES` (una vez) y prende el interruptor. Sin formulario, script ni hoja |
| Agente con `'sdi'` pero fuera de la lista | La Function responde 403 → el cliente ve `#citaFallo` con WhatsApp. El ⚙ lo advierte al guardar |
| Aislamiento | Cada solicitud va solo al `ae` de esa cotización. Ningún agente ve las de otro; nada se almacena |

## 7. Configuración única (reparto)

| Paso | Quién |
|---|---|
| Crear la cuenta del servicio de envío y agregar el dominio | JC (crear cuentas no lo hace Claude) |
| Agregar los registros DNS (SPF/DKIM del servicio, en subdominio de envío; DMARC `p=none` para empezar) | Claude en el panel de Netlify con JC mirando; se muestra cada valor antes de guardar. Hoy el dominio no tiene MX ni SPF: no hay nada previo que romper |
| `CITA_API_KEY` en Netlify → Environment variables | JC (la clave nunca pasa por el chat) |
| `CITA_FROM` y `CITA_AGENTES` | Claude, con OK de JC |
| Filtro de Gmail "asunto: Cita solicitada" → etiqueta "Citas de aseguramiento" | JC, con el filtro que se le entrega listo |

## 8. Errores y bordes

- Doble clic / doble envío: botón deshabilitado + la Function ignora un segundo POST idéntico en 60 s (mismo
  hash de correo+placa+fecha).
- Cliente elige sábado o domingo: mensaje inmediato bajo el campo; el servidor revalida.
- Feriados: no se bloquean (no hay calendario de feriados); los cubre el aviso de reprogramación.
- Variables de entorno ausentes o servicio caído: `#citaFallo` con WhatsApp. El cliente nunca queda sin salida.
- `as` con un id desconocido: se descarta ese id, no toda la solicitud.
- Antes del 28 sep `as` no llega (la sección de asistencias está apagada por `asiDisponible()`).

## 9. Pruebas

- `tests/test-cita-validacion.mjs` — obligatorios, opciones cerradas, fin de semana, fecha pasada, zona CR,
  CR/LF, **acepta espacios**, agente fuera de lista, campo trampa, largos.
- `tests/test-cita-correos.mjs` — los dos correos: contenido, escape (`<img onerror>`), sin `border-left`, sin
  emojis, ficha del agente del POST y no la del dueño, 0 km, con y sin asistencias, nota de cliente no avisado.
- `tests/test-cita-url.js` — `_buildGuideUrl` con `'sdi'` y `'propio'` (este último **idéntico a hoy**),
  `_buildCitaUrl`, lógica `[GUIA-CITA-PURO]`, `CLAVES` acepta `fc/ae/tel`, la página usa la misma fuente de planes.
- Cada test del arreglo se verifica por reversión (¿falla si quito el código?).
- Smoke en localhost (`http-server -c-1`, perfil inventado, Function con `netlify dev` o simulada): ida completa
  guía → `/cita/` → recibido; fallo forzado → WhatsApp; 375 px sin desborde; modo `'propio'` byte a byte como hoy.
- Prueba real de JC en producción: correo de prueba a `segurosjhernandez@outlook.com`, **nunca al corporativo**;
  revisar que caiga en Principal y no en Spam; iPhone real para el campo de fecha.

## 10. Publicación

Tag `pre-cita-formulario-propio`. Orden: mockup (hecho) → localhost → producción con el interruptor en
`'propio'` para todos → JC lo prende en su perfil → semana de piloto → se ofrece a los otros agentes.
Aviso "Qué hay de nuevo" + entrada en el pie de la consola al publicar. Actualizar SKILL (las dos ubicaciones
canon) y el checkpoint extendido.

## 11. Fuera de alcance

- Bandeja de citas en la consola y la marca automática "Cita solicitada" en Cotizaciones (**segunda etapa**,
  ya conversada: cruce por placa con dato mínimo sin información personal).
- Evento en Google Calendar / recordatorios.
- Reemplazar el script de Google de JC: sigue vivo para los enlaces viejos.
- Hoja de cálculo con las respuestas.

## 12. Preguntas abiertas de asistencias (no bloquean este diseño)

- **G1 (replanteada):** el regreso del configurador a la guía ("Quiero estas asistencias") ya no depende de
  Google. Propuesta: existe cuando el agente está en modo `'sdi'`; en `'propio'` sigue el WhatsApp de hoy.
- **G4:** textos que separan las asistencias opcionales de la asistencia en carretera.
- **G5:** en la guía el total con asistencias es anual, con la nota del recargo.

El script `2026-09-18-flujo-asistencias-mock-flujo.py` (regreso a la guía) queda **dependiente** de este
diseño: su parte de `entry.<fe>`/`entry.<fpl>` se descarta; la de `as` y `r` se conserva.
