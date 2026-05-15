# Detalle de coberturas vigentes — Diseño

**Fecha:** 2026-05-14
**Proyecto:** Cotizador SDI (cotizador-segurosdigitalesins-sdi.netlify.app)
**Estado:** Aprobado por Juan Carlos — listo para plan de implementación

---

## Contexto

El cotizador SDI hoy resuelve dos casos:
- **Cotizador (cliente prospecto)** — sube PDF de cotización INS → envía correo con PDF limpio + link al explicador visual
- **Cancelación (cliente que cancela)** — calcula devolución por Cláusula 33 → envía informe HTML al cliente

Falta el caso intermedio: **cliente vigente que pide recordar qué coberturas tiene**. Hoy el agente lo redacta a mano. Esta feature lo automatiza con el mismo patrón visual del explicador, pero con datos digitados por el agente (no extraídos de PDF) y narrativa de "póliza vigente" en lugar de "te ofrecemos".

## Objetivo

Permitir al agente generar y enviar al cliente, en pocos clics, un **resumen visual personalizado de las coberturas vigentes** de su póliza de auto INS, con una página HTML separada estilo explicador y un correo corto con link.

## Alcance

**Incluye:**
- Nueva página `/coberturas/` — formulario interno del agente
- Nueva página `/detalle/?...` — vista pública del cliente
- Botón de entry point 🛡 en el header del cotizador
- Campo nuevo `whatsapp` en el perfil del agente (modal ⚙)
- Reuso del envío Gmail/Outlook ya existente
- Soporte para vehículos eléctricos (sección condicional)

**No incluye:**
- Extracción automática de datos desde PDF de póliza (el agente digita los campos)
- Almacenamiento de pólizas (no hay backend, cada envío es one-shot)
- Edición/reenvío de detalles previamente generados
- Cambios al explicador actual

## Arquitectura

Mismo patrón del explicador: dos páginas separadas con audiencias distintas.

```
┌─────────────────────┐         ┌──────────────────────┐
│  /coberturas/       │         │  /detalle/?n=...&... │
│  (interno: agente)  │ ──link──▶│  (público: cliente)  │
│                     │   por    │                      │
│  Formulario que     │   correo │  Página visual       │
│  genera URL del     │          │  personalizada       │
│  detalle y envía    │          │  estilo explicador   │
│  el correo          │          │                      │
└─────────────────────┘         └──────────────────────┘
```

**Decisión:** `/coberturas/` es el form (verbo "seleccionar coberturas"), `/detalle/` es el output (sustantivo "detalle de coberturas"). Audiencias separadas, URLs separadas — un cliente que recibe el link no puede accidentalmente ver el form, y un agente que abre `/coberturas/` siempre va al form.

## Componentes

### Archivos nuevos

| Path | Propósito | Patrón análogo |
|---|---|---|
| `coberturas/index.html` | Form del agente (single-file, HTML+JS+CSS) | `cancelacion/index.html` |
| `detalle/index.html` | Vista pública del cliente (single-file con secciones condicionales) | `explicacion/index.html` |
| `js/coverage-url.js` | Helper `buildDetalleUrl(formData)` que construye la URL `/detalle/?...` | `_buildGuideUrl()` en `email-template.js` |

### Archivos modificados

| Path | Cambio |
|---|---|
| `index.html` | Botón `<a href="coberturas/">🛡</a>` entre el botón 🧮 y el ⚙, con estilo dorado para diferenciarlo |
| `index.html` (modal ⚙) | Input nuevo "WhatsApp del agente" (con placeholder "8822-1348") |
| `js/agent-profile.js` | Agregar `whatsapp` al objeto perfil + en `applyProfile` setear `CFG.WHATSAPP` |
| `js/config.js` | Agregar `CFG.WHATSAPP` default (vacío o el del agente principal) |
| `js/email-template.js` | Función nueva `buildCoverageEmail({clientName, vehicle, plate, detalleUrl, agentInfo})` — HTML corto |

### Reuso (sin tocar)

- `js/gmail-auth.js` — autenticación OAuth y `sendEmail`
- `js/outlook-sender.js` — envío Outlook vía Graph API
- `js/mime-builder.js` — `buildMIMESimple` (HTML-only sin PDF, ya usado en /cancelacion/)
- `img/ins-logo.png` — logo del header
- `img/sdi-logo.svg` — branding del footer

## Datos del formulario `/coberturas/`

### Sección 1 — Cliente

| Campo | Tipo | Requerido |
|---|---|---|
| Nombre completo | text | ✓ |
| Correo | email | ✓ |

### Sección 2 — Vehículo y póliza

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Descripción del vehículo | text | ✓ | Ej: "Toyota Yaris Sedan" |
| Placa | text | ✓ | |
| Año | number | ✓ | |
| Valor asegurado (₡) | number | ✓ | Leyenda: "Recordá mantener actualizado tu monto asegurado" |
| ⚡ Vehículo eléctrico | checkbox | – | |
| Vigencia desde | date | ✓ | |
| Vigencia hasta | date | ✓ | |
| Forma de pago | select | ✓ | Anual / Semestral / Trimestral / Mensual |
| Última prima pagada (con IVA) | number | ✓ | |

### Sección 3 — Coberturas vigentes (multi-select)

10 checkboxes:

| Código | Nombre |
|---|---|
| A | Daños a personas (RC corporal) |
| C | Daños a propiedad de terceros |
| N | Exención del deducible (aplica a C) |
| D | Colisión y vuelco |
| F | Robo y/o hurto |
| B | Gastos médicos familiares |
| H | Riesgos adicionales |
| G/M | Asistencia 24/7 |
| IDD | Reintegro del deducible |
| REP | Sustitución de repuestos |

**Sub-opciones condicionales (aparecen al marcar el padre):**

- Si **A** marcada → input editable monto (default ₡300.000.000)
- Si **C** marcada → input editable monto (default ₡100.000.000)
- Si **B** marcada → input editable monto (default ₡15.000.000)
- Si **IDD** marcada → radio: ₡300.000 / ₡400.000 / ₡500.000
- Si **REP** marcada → radio: Garantía Plus / Garantía / Nuevo / Alternativo genérico (Usados)

### Sección 4 — Deducible (radio, una sola)

- N en C
- Fijo ₡400.000
- Fijo ₡500.000
- Ordinario 20% mín ₡150.000
- Ordinario 20% mín ₡500.000

## URL params del `/detalle/?...`

Convención compacta inspirada en el explicador (12 → ~25 params).

| Param | Significado | Origen |
|---|---|---|
| `n` | Nombre del agente | perfil ⚙ |
| `l` | Licencia SUGESE | perfil ⚙ |
| `w` | Website | perfil ⚙ |
| `wa` | WhatsApp normalizado (solo dígitos, con prefijo 506 si falta) | perfil ⚙ (campo nuevo) |
| `e` | Email del agente | perfil ⚙ |
| `c` | Nombre del cliente | form |
| `v` | Vehículo (descripción) | form |
| `p` | Placa | form |
| `y` | Año | form |
| `va` | Valor asegurado | form |
| `vt` | `e` si eléctrico, vacío si no | form |
| `vd` | Vigencia desde (ISO `YYYY-MM-DD`) | form |
| `vh` | Vigencia hasta (ISO) | form |
| `fp` | Forma de pago (`a`=Anual / `s`=Semestral / `t`=Trimestral / `m`=Mensual) | form |
| `pp` | Última prima pagada | form |
| `cobs` | Coberturas concatenadas con `_` (ej: `A_C_N_D_F_B_H_GM_IDD_REP`) | form |
| `a300` | Monto editado de A si distinto del default | form (opcional) |
| `c100` | Monto editado de C si distinto del default | form (opcional) |
| `b15` | Monto editado de B si distinto del default | form (opcional) |
| `idd` | Sub-opción IDD (`300000`/`400000`/`500000`) | form (solo si IDD) |
| `rep` | Sub-opción REP (`P`/`G`/`N`/`A`) | form (solo si REP) |
| `ded` | Deducible (`nec`/`f400`/`f500`/`o150`/`o500`) | form |

## Página `/detalle/?...` — secciones

Estructura visual mirror del explicador, sólo con secciones condicionales.

| # | Sección | Condición | Contenido |
|---|---|---|---|
| Header | Título + cliente + vehículo + leyenda | siempre | Logo INS, "Hola, [c]", subtítulo con vehículo, leyenda "breve resumen / consultar condiciones generales" |
| Banda | Datos de póliza | siempre | Vigencia desde/hasta (formateadas), forma de pago en español, prima con `c/IVA`, recordatorio del valor asegurado |
| 1 | Coberturas | siempre (al menos 1 marcada) | Bento de cards (2 columnas), cada una con descripción del explicador + monto a la derecha. Orden A, C, D, F, B, H. N va al final con fondo ámbar (banner) si está marcada |
| 2 | Asistencia 24/7 | si `cobs` incluye `GM` | Plan según año (`y` 0-6 = Plus, 7-15 = Básico, >15 = mensaje). Grid de 7 servicios con iconos emoji idénticos al explicador |
| 3 | IDD | si `cobs` incluye `IDD` | Comparativa "Sin IDD ₡X / Con IDD ₡0" usando el monto del param `idd` |
| 4 | Deducible | siempre | Tarjeta ámbar con texto humano según `ded` |
| 5 | Repuestos | si `cobs` incluye `REP` | Card simple con el plan elegido (Plus / Garantía / Nuevo / Alternativo) y descripción de 1-2 líneas. NO replica la tabla compleja del explicador — versión simplificada |
| Eléctrico | Cobertura especial batería | si `vt=e` | Calcado del explicador, calcula monto de batería en función de `va` |
| Footer | Firma del agente + CTAs + branding SDI | siempre | Nombre, licencia, teléfono, botón verde WhatsApp (`web.whatsapp.com/send/?phone=506[wa]&text=...`), botón outline website, logo SDI renderizado del SVG |

## Flujo del envío

```
1. Agente abre /coberturas/ desde botón 🛡 del cotizador
2. Llena formulario (sec 1, 2, 3, 4)
3. (opcional) Click "Vista previa del correo" → modal con HTML del correo
4. Click "Enviar al cliente"
   ↓
5. buildDetalleUrl(formData) → URL /detalle/?n=...&...
6. buildCoverageEmail({clientName, vehicle, plate, detalleUrl}) → HTML corto
7. buildMIMESimple({to: clienteEmail, from: agente, subject, html}) → MIME base64url
8. S.provider === 'gmail' ? sendEmail(raw) : graphSendMail(...)
   ↓
9. Modal de éxito → "Otro detalle" o "Volver al cotizador"
```

## Correo del cliente

**Subject:** `Detalle de tus coberturas vigentes — [vehículo] ([placa])`

**Body (HTML):**
- Header con logo INS sobre fondo navy
- Saludo "Hola [nombre cliente],"
- Párrafo intro: "Te comparto el resumen de las coberturas vigentes en tu póliza de seguro de auto del INS para tu [vehículo] ([placa])."
- Párrafo CTA: "Hacé click en el botón para ver el detalle completo — coberturas, asistencia, deducible y datos de tu póliza."
- Botón grande navy: **VER DETALLE DE MIS COBERTURAS →**
- Leyenda al pie: "Este es un breve resumen de tu cobertura. Para más información consultar las condiciones generales de tu póliza."
- Footer: nombre agente, licencia, teléfono, email, website

Sin PDF adjunto. Más corto y directo que el correo de cotización.

## Edge cases

| Caso | Comportamiento |
|---|---|
| `/detalle/` abierto sin params | Mensaje "Esta página debe abrirse desde el link enviado por tu agente" |
| Valor asegurado vacío en URL | Omitir leyenda recordatorio, no romper |
| Vigencia desde/hasta inválida | Mostrar valor crudo del param sin formatear |
| WhatsApp no configurado en perfil | Ocultar botón verde, dejar solo botón website |
| Año > 15 con `GM` marcado | Mensaje "Tu vehículo no califica para asistencia 24/7" en sección 2 |
| Año vacío con `GM` marcado | Mostrar Plan Básico como fallback (más conservador) |
| `cobs` sin ninguna cobertura | Sección 1 vacía con mensaje "No se especificaron coberturas" |
| Cliente con email inválido | Validación en form antes de enviar (regex básico) |
| `idd` no especificado pero IDD marcado | Default ₡400.000 (más común) |
| `rep` no especificado pero REP marcado | Default "Garantía Plus" |
| Deducible no especificado | Default `f400` (más común) |

## Validaciones del formulario

- Todos los campos marcados con `*` son requeridos
- Email del cliente: regex básico `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Año: número entre 1990 y año actual + 1
- Valor asegurado, prima, montos custom: numéricos positivos
- Vigencia desde < vigencia hasta
- Al menos 1 cobertura marcada
- Si IDD marcado → sub-opción seleccionada
- Si REP marcado → sub-opción seleccionada
- Deducible siempre seleccionado (default = N en C)

## Testing manual (smoke test)

1. **Form básico:** abrir `/coberturas/` → llenar con datos demo → "Vista previa" → verificar HTML correo
2. **URL generada:** copiar URL del detalle → abrir en otra pestaña → verificar render
3. **Combinatoria:**
   - Solo coberturas básicas (A, C, D, F, B, H)
   - Con eléctrico ON → verificar sección eléctrica visible
   - Sin G/M → sección asistencia oculta
   - Con IDD ₡300K, REP Plus, deducible 20% mín 500K → verificar todos los textos
   - A/C/B con montos editados (200M, 80M, 10M) → verificar montos custom en página
4. **Logos:** verificar INS arriba y SDI abajo cargan correctamente
5. **WhatsApp:** click en botón verde → debe abrir `web.whatsapp.com/send/?phone=...&text=...` (NO `wa.me`)
6. **Envío real:** enviar correo a uno mismo → click botón "VER DETALLE" → verificar abre correctamente
7. **Multi-agente:** cambiar perfil ⚙ a otro agente con WA distinto → enviar → verificar que el WhatsApp del correo es el del nuevo agente
8. **Sin params:** abrir `/detalle/` directo → verificar mensaje informativo

## Riesgos y consideraciones

- **URL larga (~25 params)** — algunos clientes de correo recortan URLs muy largas. Mitigación: probar en Gmail/Outlook real antes de declarar listo.
- **Cambios al perfil ⚙** — agregar campo `whatsapp` rompe compatibilidad con perfiles guardados antes. Mitigación: leer con default vacío, no fallar si no existe.
- **Logo SDI inline SVG** — si se cambia el logo en el repo (`img/sdi-logo.svg`), la página renderiza el SVG inline desde el archivo (no inline en código). Mantener consistencia.
- **Endpoint WhatsApp** — usar SIEMPRE `web.whatsapp.com/send/?phone=...` (NO `wa.me` que corrompe emojis).
- **Multi-agente:** cada agente debe configurar su WhatsApp en ⚙. Default vacío oculta el botón.

## Decisiones explícitas (no revisitar sin causa)

- Dos páginas separadas (`/coberturas/` form, `/detalle/` visual) — descartado el approach de "una sola página con 2 modos por params"
- Coberturas: solo las 10 acordadas, sin "otra" texto libre
- Sin almacenamiento — cada envío es one-shot
- Sin edición posterior — el agente reenvía si necesita corregir
- Sin PDF adjunto — solo correo HTML con link
- IDD: 3 montos fijos (300/400/500), no input numérico libre
- Asistencia: deriva del año (no input)
- Eléctrico: toggle (no auto-detectado del modelo)
- Branding visual heredado del explicador (paleta, fuentes, componentes)
