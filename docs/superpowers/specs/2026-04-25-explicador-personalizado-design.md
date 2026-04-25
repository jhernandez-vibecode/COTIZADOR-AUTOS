# Explicador del Seguro — Rediseño Personalizado v2

**Fecha:** 2026-04-25
**Proyecto:** Cotizador SDI · COTIZADOR-AUTOS
**Alcance:** Rediseño completo de `/explicacion/index.html`
**Scope técnico:** Migración de React+Babel CDN a HTML+CSS+JS vanilla single-file.

---

## 1. Visión y Propósito

El explicador es la página standalone que el cliente recibe en el correo del cotizador.
Hoy es un **documento estándar genérico** sin personalización — el cliente lee información
correcta pero impersonal, y debe abrir el PDF adjunto para ver los precios.

**Objetivo del rediseño:**

1. **Personalización completa** — el cliente entra a una página que lo saluda por nombre,
   muestra los datos de su cotización (vehículo, valor, primas), y resalta automáticamente
   las opciones que le aplican.
2. **Experiencia de "te llevo de la mano"** — recorrido guiado de 5 secciones con navegación
   clara hacia adelante y atrás.
3. **Diferenciación del agente** — sutil y consistentemente, refuerza que esta guía es un
   recurso creado por Juan Carlos, no un documento estándar del INS.
4. **Educación clara con foco en repuestos y eléctricos** — la sección de repuestos y la
   sub-sección de vehículos eléctricos son las "estrellas educativas".
5. **Cierre emocional** — al hacer click en "Agende su cita de Aseguramiento", momento de
   celebración que refuerza que tomó una excelente decisión.

---

## 2. Decisiones técnicas

| Decisión | Estado | Razón |
|---|---|---|
| Reemplazar React+Babel CDN por vanilla JS | ✅ | Carga más rápida en mobile, menos dependencias, alineado con el resto del cotizador. |
| Mantener Tailwind CDN | ❌ | Pasamos a CSS custom con tokens (alineado con paleta SDI). Tailwind se queda solo en `index.html` principal y `cancelacion/`. |
| Single HTML file | ✅ | Sin build step, alineado con el resto del proyecto. |
| Fonts: Space Grotesk + Inter + JetBrains Mono | ✅ | Display + body + datos numéricos. Vía Google Fonts preloaded. |
| Backward compatible con URLs sin params | ✅ | Si alguien abre `/explicacion/` sin params, sigue funcionando con defaults. |

---

## 3. Parámetros URL — del cotizador al explicador

El cotizador genera el link del explicador en `email-template.js` con 11 parámetros.

### 3.1 Tabla de parámetros

| Param | Ejemplo | Fuente cotizador | Usos en explicador |
|---|---|---|---|
| **Agente** (existentes — backward compat) |||
| `n` | `Juan Carlos Hernandez Vargas` | perfil agente (`localStorage`) | Header, footer, chip agente, avatar JC. |
| `l` | `08-1318` | perfil agente | Header (Lic. SUGESE), footer copyright. |
| `w` | `www.segurosdelins.com` | perfil agente | Footer link "Visítenos en…". |
| **Cliente** (nuevo) |||
| `c` | `Silvia Mariel` | form: `m-name` | Hero greeting, cierre, celebración. |
| **Vehículo** (nuevo) |||
| `v` | `Sedan 2019` | form: `m-vehicle` | Hero "tu Sedan 2019", header sección 4. |
| `p` | `BRK454` | PDF: `plate` | Hero "placa BRK454", header sección 4. |
| `y` | `2019` | PDF: `year` | Calcula edad → auto plan asistencia, posición tabla depreciación EV. |
| `vt` | `g` (gasolina) / `e` (eléctrico) | PDF: `vehicleType` + lógica | Sección 4: auto-selecciona tab. |
| **Cotización** (nuevo) |||
| `va` | `10000000` | PDF: `valor` | Sección 1: monto cobertura D, F, H. |
| `sr` | `p` (Plus) / `g` (Garantía) / `0` (nuevo) / `n` (ninguna) | PDF: `sustRepos` | Sección 4: resalta fila tabla calidad. |
| `pa` | `570891` | PDF: `prices.anual` | Sección 5: tarjeta Anual destacada. |
| `ps` | `308283` | PDF: `prices.semestral` | Sección 5: tarjeta Semestral. |
| `pt` | `158423` | PDF: `prices.trimestral` | Sección 5: tarjeta Trimestral. |

### 3.2 URL ejemplo

```
https://cotizador-segurosdigitalesins-sdi.netlify.app/explicacion/
?n=Juan%20Carlos%20Hernandez%20Vargas&l=08-1318&w=www.segurosdelins.com
&c=Silvia%20Mariel
&v=Sedan%202019&p=BRK454&y=2019&vt=g
&va=10000000&sr=p
&pa=570891&ps=308283&pt=158423
```

~280 caracteres. Compatible con clientes de correo sin truncado.

### 3.3 Fallbacks (si falta un param)

| Param faltante | Comportamiento |
|---|---|
| `c` | Saluda con "Hola" sin nombre. |
| `v, p, y` | Omite la línea de personalización del header sección 4. |
| `vt` | Muestra los 2 tabs Gasolina/Eléctrico (manual, como hoy). |
| `sr` | No resalta ninguna fila de la tabla de calidad. |
| `va, pa, ps, pt` | Sección 5 muestra "Consulta a tu agente las opciones de pago". |
| `n, l, w` | Defaults a Juan Carlos (como hoy). |

**Garantía:** si el link llega sin params, sigue siendo una guía útil — solo pierde personalización.

---

## 4. Estructura de la página

```
┌──────────────────────────────────────────────────────────┐
│  HEADER (sticky en scroll)                                │
│   INS │ Guía de tu Cotización · SDI    100%Digital · JC  │
├──────────────────────────────────────────────────────────┤
│  CINTA DORADA — diferencial sutil                         │
│   ✦ Una herramienta diseñada por Juan Carlos…             │
├──────────────────────────────────────────────────────────┤
│  STICKY NAV (aparece al hacer scroll)                     │
│   Recorrido  ●—●—○—○—○  1.Cubre  2.Asist  3.Ded  4.Rep…   │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  HERO                                                      │
│   [JC] Juan Carlos Hernández · Tu agente                  │
│   ╭─────────────────────────────────────────╮             │
│   │ ¡Hola, Silvia Mariel! 👋                │             │
│   │ Te preparé esta guía visual…            │             │
│   │ ┌─────────────────────────────────┐    │             │
│   │ │ Tu recorrido en 5 pasos:        │    │             │
│   │ │ qué cubre · asistencia · …      │    │             │
│   │ └─────────────────────────────────┘    │             │
│   ╰─────────────────────────────────────────╯             │
│   Tu recorrido: ●○○○○ Paso 1 de 5                         │
│   [▶ Empezar la guía]                                     │
│                                                            │
├──────────────────────────────────────────────────────────┤
│  SECCIÓN 1 — Qué cubre tu cotización                      │
│   Bento 2-col · letras A·B·C·D·F·H·G·M con montos         │
│                                                            │
│  SECCIÓN 2 — Tu asistencia 24/7 en carretera              │
│   💡 Buena noticia: tienes asistencia incluida…           │
│   Plan auto-seleccionado por edad (Plus 0-6 / Básico 7-15)│
│                                                            │
│  SECCIÓN 3 — Tu protección al deducible (IDD + N en C)    │
│   Tarjeta navy: ₡400.000 (tachado) → ₡0                   │
│   2 reglas: daño > ₡400k → IDD activa                     │
│             daño < ₡400k → corre por cuenta del asegurado │
│                                                            │
│  SECCIÓN 4 — ¿Qué pasa con los repuestos? (estrella)      │
│   Header oscuro: "Para tu Sedan 2019, BRK454…"            │
│   A. Tabla calidad repuesto (4 niveles, fila destacada)   │
│   B. Eléctricos (siempre visible) — 40% batería + tabla   │
│   C. ¿Quién elige el repuesto? (info INS · 20 días)       │
│                                                            │
│  SECCIÓN 5 — Tus 3 opciones de pago                       │
│   3 pricing cards: Trimestral · Semestral · Anual ★       │
│                                                            │
├──────────────────────────────────────────────────────────┤
│  CIERRE                                                    │
│   "Silvia Mariel, espero que esta guía te haya ayudado…"  │
│   — Juan Carlos Hernández (firma)                         │
│   [📅 Agende su cita de Aseguramiento]                    │
│   ✦ Esta guía la creé yo personalmente para mis clientes…│
├──────────────────────────────────────────────────────────┤
│  FOOTER                                                    │
│   © 2026 Propiedad Intelectual de Juan Carlos H. V.       │
│   Visítenos en www.segurosdelins.com                      │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Hero

### 5.1 Header (sticky)
- **Background:** navy `#0c2340`
- **Izquierda:** logo INS (azul `#0369a1`, 56×36, "INS" texto blanco) + título "Guía de tu Cotización" + subtítulo "Explicador personalizado · Seguros Digitales SDI"
- **Derecha:** pill verde "✓ Proceso 100% Digital" + info agente (`n` y `l`)

### 5.2 Cinta dorada (diferencial)
- **Background:** gradient `#fef3c7` → `#fefce8` → `#fef3c7`
- **Texto:** "Una herramienta diseñada por **{n}** para acompañar a sus clientes en cada decisión de seguro"
- Tono crema sutil, no estridente. Reemplaza el banner amarillo gritón actual.

### 5.3 Body
- **Chip agente:** avatar JC (gradient azul) + nombre + rol "Tu agente · Te acompaña paso a paso"
- **Burbuja conversacional** (radius 16/16/16/4):
  - Saludo grande: "¡Hola, **{c}**! 👋" — con highlight amarillo en `{c}`
  - Texto: "Te preparé esta guía visual personalizada para que entendamos juntos tu cotización del **{v}, placa {p}**."
  - Roadmap dentro de la burbuja: "**Tu recorrido en 5 pasos:** qué cubre tu cotización · cómo te protege ante un choque · qué pasa con los repuestos · asistencia 24/7 · y al final, las **3 opciones de pago** para que elijas la que más te conviene."
- **Progress dots:** "Tu recorrido: ●○○○○ Paso 1 de 5"
- **CTA:** "▶ Empezar la guía" (gradient emerald, pill 999px)

### 5.4 Sin precio en el hero
**Decisión explícita de JC:** el precio NO va en el hero. Va al final (Sección 5).

---

## 6. Sección 1 — Qué cubre tu cotización

### Layout
- **Header:** "¿Qué incluye tu Cobertura Total?" + subtítulo "Toca cada tarjeta para ver el detalle"
- **Bento grid 2-col × 3-rows** (1-col mobile) con 6 tarjetas — una por cada letra de cobertura *patrimonial*. G y M (Asistencia) NO van en este bento — viven en la Sección 2 dedicada.

| Letra | Nombre | Monto |
|---|---|---|
| A | Daños a Personas | ₡300M (estándar) |
| C | Daños a Propiedad | ₡100M (estándar) |
| D | Colisión y Vuelco | = `va` |
| F | Robo | = `va` |
| B | Gastos Médicos | ₡15M (estándar) |
| H | Riesgos Naturales | = `va` |

### Interacción
- Tap en una tarjeta → expande para mostrar detalle (usar `<details>` nativo)
- Sin tabs, todo visible

### Personalización
- Si `va` está presente, muestra los montos calculados.
- Si no, omite los montos.

---

## 7. Sección 2 — Tu asistencia 24/7

### Layout
- **Banner verde fresco** con bombilla 💡 (no ⚠):
  - Background: gradient verde claro `#f0fdfa` → `#ecfdf5`
  - Border: `var(--green-light)`
  - Icono: bombilla blanca sobre círculo verde fresco con sombra
  - Texto: "**Buena noticia:** tienes asistencia 24/7 incluida. *El alcance del plan se ajusta a la antigüedad de tu vehículo — más adelante te muestro el que te toca.*"
- **Plan toggle** (solo visual — el plan correcto ya viene seleccionado):
  - Plus (0-6 años) | **Básico (7-15 años) ★ tu plan**
- **Lista de eventos** del plan correcto, como tarjetas con icono:
  - Remolque por avería, Cerrajería, Envío combustible, Cambio llanta, Mini-rescate, etc.

### Personalización
- `edad = añoActual - y` (donde `añoActual` se calcula al cargar)
- Si `edad ≤ 6` → Plan Plus auto-seleccionado
- Si `edad ≥ 7` (y ≤15) → Plan Básico auto-seleccionado

### Tabla actual de servicios
Se mantienen los datos del archivo actual (`asistenciasPlus` y `asistenciasBasico` arrays).

---

## 8. Sección 3 — Tu protección al deducible (IDD + N en C)

### Layout
- **Header:** "Tu protección al deducible (IDD + N en C)"
- **Tarjeta navy** central:
  - Top: "Tu deducible en cualquier choque"
  - Comparativa visual:
    - **Sin IDD:** ₡400.000 (tachado, rojo claro)
    - → arrow dorado
    - **Con IDD:** ₡0 (emerald-light, font-size 38px, font-weight 800)
  - Etiqueta lateral: "★ Beneficio exclusivo IDD + N en C"
  - Footer: "★ hasta 2 choques al año · sin pagar de tu bolsillo"
- **2 reglas en cards** (debajo de la comparativa, dentro de la misma tarjeta):
  - Verde con ✓: "**Daño mayor a ₡400.000** — La IDD se activa: tú no pagas el deducible, te lo reintegramos. *Hasta 2 choques al año*"
  - Amarillo con !: "**Daño menor a ₡400.000** — Corre por cuenta del **asegurado**. La IDD se activa solo cuando el daño supera el deducible."

### Personalización
- **No personalizado.** El ₡400.000 es valor estándar de cotización (decisión explícita de JC, ver brainstorming).

---

## 9. Sección 4 — Repuestos + Eléctricos (estrella educativa)

### 9.1 Header oscuro
- Background: gradient `#1e293b` → `#0f172a` con halo verde radial
- Badge: "📦 Sección 4 · Tu recorrido"
- Título: "¿Qué pasa con los repuestos si chocás?"
- Línea de personalización: "Para tu **{v}, placa {p}**, esto es lo que el INS te garantiza."

### 9.2 Intro
- Banner azul claro: "ⓘ El tipo de repuesto que recibes **depende de la antigüedad de tu vehículo** y de la opción que cotizaste. Te muestro la tuya destacada."

### 9.3 Sub-sección A — Calidad del repuesto según tu carro
4 filas en tabla vertical:

| Icono | Categoría | Lugar | Tipo | Match? |
|---|---|---|---|---|
| ✦ verde | Carro nuevo (≤3 años, ≤36k km) | Agencia oficial | Original | si `sr=0` |
| ★ azul | Extensión Garantía (≤5a, ≤60k km) | Agencia / taller autorizado | Original | si `sr=g` |
| ★ ámbar | **Extensión Plus (≤8a, ≤80k km)** | Agencia / taller autorizado | Original | si `sr=p` |
| ○ rojo | Más de 3 años sin extensión | Taller multimarca | Genérico | si `sr=n` |

La fila que matchea con `sr` se resalta con:
- Background: gradient ámbar
- Border: `2px solid #fbbf24`
- Box-shadow doble (anillo + lift)
- `transform: scale(1.01)`
- Badge "★ Tuyo" + you-tag "Tu plan"

### 9.4 Sub-sección B — Si tu vehículo es eléctrico
**Siempre visible** (decisión explícita: educativo + diferencial, aunque el vehículo del cliente sea gasolina).

- Background: gradient `#f0f9ff` → `#ecfeff`
- Border: `2px solid #67e8f9`
- Icono ⚡ flotante arriba a la izquierda
- Tag "★ Siempre visible · educativo" arriba a la derecha
- Título: "Si tu vehículo es eléctrico — o estás pensando en uno"
- **Battery card:**
  - Label: "COBERTURA ESPECIAL DE BATERÍA"
  - Key: "Hasta **40%** del valor de tu vehículo"
  - Texto explicativo
  - Ejemplo: "Vehículo eléctrico de ₡15M → cobertura batería máxima = **₡6,000,000** (40%)..."
- **Tabla depreciación** — 4 tiles (responsive: 4-col desktop, 2-col mobile):
  - 100% · 0-24 meses (verde)
  - 80% · 25-48 meses (cyan)
  - 60% · 49-72 meses (ámbar)
  - 50% · 73-96 meses (naranja)

### 9.5 Sub-sección C — ¿Quién elige dónde comprar el repuesto?
- Card simple con icono i azul
- Texto: "El INS selecciona el proveedor y puede pagar directamente al distribuidor. El plazo de entrega puede ser de **hasta 20 días hábiles**. Si el repuesto no está disponible en Costa Rica, el INS calcula el costo con base en **importación + flete + impuestos**."

### 9.6 Eliminado explícitamente
- ❌ **NO** incluir la "Regla del 80% — pérdida por costos" (ni en gasolina ni en eléctricos). Decisión explícita de JC.

---

## 10. Sección 5 — Tus 3 opciones de pago

### Layout
- Header: "Tus 3 opciones de pago"
- 3 pricing cards en grid (responsive):

| Card | Badge | Label | Precio | Frecuencia |
|---|---|---|---|---|
| 1 | — | TRIMESTRAL | `pt` | cada 3 meses |
| 2 | — | SEMESTRAL | `ps` | cada 6 meses |
| 3 | ★ Recomendado · -10% | ANUAL | `pa` | 1 sola vez |

- La card Anual: gradient emerald, `transform: scale(1.05)`, badge dorado posicionado arriba.
- Otras cards: blancas con border gris.

### Personalización
- Si `pa, ps, pt` faltan, mostrar mensaje "Consulta a tu agente las opciones de pago" (fallback).

---

## 11. Cierre + Momento Celebración

### 11.1 Cierre
- Background: gradient `#f0f9ff` → `#fff`
- Mensaje: "{c}, espero que esta guía te haya ayudado a entender tu cotización con claridad."
- Firma: "— **Juan Carlos Hernández** · Tu agente · Lic. SUGESE {l}" (italic, Space Grotesk)
- **CTA rectangular puntas redondeadas:**
  - Texto: "📅 Agende su cita de Aseguramiento"
  - Background: gradient emerald-fresh → emerald-deep
  - `padding: 16px 32px`
  - `border-radius: 10px` (NO pill 999px)
  - Box-shadow: `0 6px 20px rgba(16, 185, 129, .35)`
  - Font: Space Grotesk 700, 16px
- Footer pequeño cierre: "✦ Esta guía la creé yo personalmente para mis clientes — un recurso exclusivo de mi oficina, no del INS." (italic, dorado tenue)

### 11.2 Momento Celebración (modal/overlay)
**Trigger:** click en el CTA "Agende su cita de Aseguramiento".
**Duración:** ~2.5 segundos antes de abrir el Google Form en nueva pestaña.

#### Visual
- **Overlay backdrop:** `rgba(12, 35, 64, .88)` con `backdrop-filter: blur(8px)`
- **Confetti:** 10 partículas (verde, amarillo, azul, rosa) cayendo desde arriba con `confetti-fall` animation
- **Check circle:** 88×88px, gradient emerald, con triple sombra glow, animación bounce + draw del check SVG
- **Título:** "¡Excelente decisión, **{c}**! 🎉" — Space Grotesk 32px 800, highlight amarillo en `{c}`
- **Subtítulo:** "Acabas de dar el primer paso para **proteger tu {v}** con una de las mejores coberturas del mercado."
- **Loader:** "Abriendo tu agenda..." con 3 dots pulsando
- **Firma:** avatar JC + "Juan Carlos te acompaña desde este momento hasta la activación de tu póliza"

#### Comportamiento
- Aparece on-click del CTA con fade-up secuencial de cada elemento (delay escalonado 0.3s, 0.5s, 0.7s, 0.9s)
- Después de ~2.5s, abre `https://forms.gle/tqSaZBDcZfNgNktC7` (URL del agente, leída de `agent-profile.js`) en nueva pestaña con `target="_blank"`
- **Cierre del overlay:**
  - Botón × en esquina superior derecha del modal (siempre presente)
  - Tecla ESC también cierra
  - El overlay NO se cierra automáticamente al abrir el form — queda visible hasta que el cliente cierre manualmente (le da tiempo de absorber el mensaje)
- **Respeta `prefers-reduced-motion`:** sin confetti, sin bounce — solo check estático y mensaje

#### Bonus recomendación
Customizar el mensaje de confirmación del Google Form (en la configuración del Form) con texto similar para reforzar al cliente cuando envía el formulario. JC lo configura manualmente.

---

## 12. Navegación + Transiciones

### 12.1 Sticky bar superior
- Aparece al hacer scroll fuera del hero
- Background: `rgba(255, 255, 255, .92)` con `backdrop-filter: blur(12px)`
- Border-radius pill, sombra suave, padding 8/14
- Contenido:
  - Label "Recorrido"
  - 5 dots clickeables: número en círculo + label corto ("Cubre", "Asistencia", "Deducible", "Repuestos", "Pagos")
  - Estados: pending (gris), active (azul + scale), done (verde)
- Click en un dot → scroll suave a esa sección

### 12.2 Floating control (esquina inferior derecha)
- Pill blanco con: ← · "X / 5" · →
- Permite navegar prev/next sin tener que ir arriba

### 12.3 Step buttons al final de cada sección (★ agregado en walkthrough final)
- Cada sección tiene al cierre dos botones prominentes:
  - **`← Anterior`** (excepto en s1) — link a la sección previa
  - **`Siguiente: [nombre] →`** — link a la siguiente sección, gradient azul, destacado
- En s5 el "Siguiente" lleva al CTA "Agendar mi cita" (scroll al cierre)
- Refuerza el flujo lineal y da claridad sobre "qué viene"
- Mobile: `flex: 1` para que ocupen 50/50 cada uno
- Scroll suave usando `scrollIntoView({behavior:'smooth'})`

### 12.4 Responsive sticky nav
- En `≤720px`: oculta los labels textuales, muestra solo los círculos numerados (1-5)
- Reduce padding y gap para no ocupar tanto espacio
- Posición sticky se mantiene, solo se compacta visualmente

### 12.5 Animaciones
- **Scroll suave global:** `html { scroll-behavior: smooth; }`
- **Scroll-margin-top:** las secciones tienen `scroll-margin-top: 100px` para que el sticky nav no tape el título al saltar a una sección.
- **Entrada de secciones:** Intersection Observer detecta cuando una sección entra al viewport. Aplica fade-in + `translate-Y(12px → 0)` con duración 400ms ease-out.
- **Highlight automático sticky bar:** la sección actual (en el viewport) se marca como `.active` en la sticky bar.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` desactiva todas las animaciones.

---

## 13. Sistema Visual

### 13.1 Paleta

```css
/* Identidad SDI */
--navy:           #0c2340  /* top bar, headers oscuros */
--azul-primary:   #0369a1  /* primary, links, sticky active */
--azul-deep:      #0c4a6e  /* texto principal, headings */

/* Verde — actualizado a emerald vivo (decisión JC) */
--green-fresh:    #10b981  /* CTA, ✓ activo, success */
--green-light:    #34d399  /* highlights, ₡0 IDD */
--green-deep:     #059669  /* gradientes CTA */
--green-text:     #047857  /* texto verde accesible */
--green-bg:       #d1fae5  /* fondos sutiles, badges */

/* Dorado — diferencial sutil */
--gold-light:     #fef3c7  /* cinta dorada hero */
--gold-mid:       #fbbf24  /* threshold, "Tuyo" badge */
--gold-deep:      #f59e0b  /* highlights críticos */
--gold-text:      #78350f  /* texto sobre dorado */

/* Cyan — sección eléctricos */
--cyan-light:     #67e8f9
--cyan-mid:       #06b6d4
--cyan-deep:      #0e7490
--cyan-bg:        #ecfeff

/* Neutros */
--bg-base:        #f8fafc
--bg-card:        #fff
--border:         #e0e7ef
--text-muted:     #64748b
--text-strong:    #1e293b
```

### 13.2 Tipografía

```css
/* Display — Space Grotesk */
font-family: 'Space Grotesk', system-ui, sans-serif;
/* Pesos: 700, 800. letter-spacing: -0.01 a -0.02em */
/* Usos: H1, H2, H3, números grandes, nombre del cliente, CTA */

/* Body — Inter */
font-family: 'Inter', system-ui, sans-serif;
/* Pesos: 400, 500, 600, 700 */
/* Usos: párrafos, labels, UI */

/* Datos — JetBrains Mono */
font-family: 'JetBrains Mono', monospace;
/* Pesos: 500, 700 */
/* Usos: montos en cálculos (ej. ejemplo regla 80%), códigos, datos tabulares */
```

Carga via Google Fonts con preconnect:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

### 13.3 Radius

| Tamaño | Uso |
|---|---|
| 4-6px | Inputs, badges pequeños |
| 8-10px | Cards pequeñas, botones |
| 10-14px | Sub-cards, secciones |
| 16-22px | Modal celebración, hero |
| 999px | Pills, badges grandes, dots |

### 13.4 Sombras

```css
/* Card básica */
box-shadow: 0 2px 8px rgba(12, 35, 64, .04);

/* Card destacada / hover */
box-shadow: 0 4px 20px rgba(12, 35, 64, .08);

/* CTA verde con glow */
box-shadow: 0 6px 20px rgba(16, 185, 129, .35);

/* Match dorado (fila tabla calidad) */
box-shadow: 0 0 0 4px rgba(251, 191, 36, .15),
            0 6px 16px rgba(251, 191, 36, .12);
```

---

## 14. Reglas de personalización (lógica)

### 14.1 Edad del vehículo
```
edadVehiculo = (new Date().getFullYear()) - parseInt(y, 10)
```

### 14.2 Plan asistencia (Sección 2)
```
if (edadVehiculo <= 6) → Plan Plus
if (edadVehiculo >= 7 && edadVehiculo <= 15) → Plan Básico
if (edadVehiculo > 15) → Plan Básico (cap)
if (y missing) → mostrar ambos tabs (default Plus)
```

### 14.3 Highlight fila calidad repuesto (Sección 4)
```
sr === '0' → highlight fila "Carro nuevo"
sr === 'g' → highlight fila "Extensión Garantía"
sr === 'p' → highlight fila "Extensión Garantía Plus"
sr === 'n' → highlight fila "Más de 3 años sin extensión"
sr missing → no highlight
```

### 14.4 Tipo vehículo (Sección 4)
```
vt === 'g' → mostrar SOLO contenido gasolina (oculta tabs, oculta tab eléctrico)
vt === 'e' → mostrar SOLO contenido eléctrico
vt missing → mostrar tabs (manual, como hoy)

NOTA: la sub-sección B "Eléctricos siempre visible" se renderiza independiente de vt
      (es educativa, debajo del bloque gasolina/eléctrico)
```

### 14.5 Coberturas amounts (Sección 1)
```
A: ₡300,000,000 (estándar)
B: ₡15,000,000 (estándar)
C: ₡100,000,000 (estándar)
D: parseInt(va) — colisión = valor asegurado
F: parseInt(va) — robo = valor asegurado
H: parseInt(va) — riesgos naturales = valor asegurado

(G y M no van en este bento — Sección 2 dedicada)

Si va missing → omite los montos D, F, H. A, B, C se muestran con el monto estándar.
```

### 14.6 Mapeo `sustRepos` del PDF a `sr` (en cotizador)
```
sustRepos contiene "Plus" → sr=p
sustRepos contiene "Garantia" o "Garantía" → sr=g
sustRepos contiene "Carro nuevo" o similar → sr=0
otherwise → sr=n
```

### 14.7 Detección `vt` (en cotizador)
Por ahora `vt=g` por defecto (no hay campo eléctrico en el PDF estándar). Se puede agregar
manualmente una checkbox en el form si JC lo requiere. **Decisión deferida** — implementar
con `vt=g` hardcoded en v1.

---

## 15. Cambios al cotizador (afuera de `/explicacion/`)

Para que el cotizador genere el URL con todos los params, se modifica:

- `js/email-template.js` — la función `buildEmail` actualmente recibe params del agente.
  Se extiende para recibir todos los datos del cliente y construye el link del explicador
  con todos los URL params.
- `js/app.js` — al llamar `buildEmail`, pasa también: `clientName`, `vehicle`, `plate`,
  `year`, `valor`, `sustReposCode` (mapeado), `prices`.

No se requiere cambio en `pdf-extract.js` (los datos ya se extraen).
No se requiere cambio en `agent-profile.js` (los datos del agente ya se gestionan).

---

## 16. Migración (alto nivel)

1. **Crear `/explicacion/index-v2.html`** (single file vanilla JS, nuevo diseño completo).
2. **Probar en local** abriendo el archivo con URL params de prueba (datos de Silvia).
3. **Validar visualmente** en mobile (375px) y desktop (1024px+).
4. **Validar accesibilidad:** contraste 4.5:1, keyboard nav, prefers-reduced-motion.
5. **Cuando esté validado**, reemplazar `/explicacion/index.html` con el v2.
6. **Actualizar `email-template.js`** para construir el URL con los nuevos params.
7. **Mantener `INS BLANCO.png`** (lo usa el header — pero el nuevo diseño usa el cuadro INS azul, no el PNG; si se confirma, eliminar el PNG y simplificar).
8. **Test end-to-end** desde el cotizador real con un PDF de prueba.
9. **Push a GitHub** → auto-deploy Netlify (1-2 min).

---

## 17. Criterios de éxito

- [ ] Página carga en menos de 2s en mobile (sin React/Babel compile delay).
- [ ] Personalización funciona end-to-end con datos del PDF de Silvia (nombre, vehículo,
      placa, año, valor, primas, sustRepos auto-detectada).
- [ ] Si abres `/explicacion/` sin params, sigue siendo una guía útil (backward compat).
- [ ] El cliente entiende qué cobertura tiene sin tener que abrir el PDF adjunto.
- [ ] Mobile-first responsive (375px, 768px, 1024px+).
- [ ] Accesibilidad: contraste 4.5:1 mínimo, keyboard nav completo, `prefers-reduced-motion`.
- [ ] Sticky nav permite saltar a cualquier sección y devolverse.
- [ ] Momento celebración aparece al hacer click en CTA y abre el Google Form.
- [ ] Diferencial "creado por mí" presente en hero (cinta dorada), cierre (firma),
      footer (copyright) — sutil pero consistente.

---

## 18. Decisiones explícitas (registro de brainstorming)

| Decisión | Justificación |
|---|---|
| Combinar B + C (facelift + reorden + rediseño) | Pedido explícito de JC. |
| Hero: encabezado A + cuerpo C | "C con el encabezado A y logo del INS a la izquierda". |
| Sin precio en el hero | "el precio es mejor darlo al final del recorrido con las 3 opciones". |
| Diferenciador sutil + consistente | "siempre de alguna forma sutil y profesional decir que este es un recurso creado por mí". |
| Asistencia movida a posición 2 | "los beneficios de asistencia inmediatamente después de las coberturas, al final también es una cobertura". |
| Aclarar regla antigüedad en asistencia | "aclara que aplica en función de la antigüedad del vehículo". |
| IDD: ₡400.000 fijo (no personalizado) | "El deducible es siempre el mismo que cotizó 400.000 colones". |
| CTA rectangular puntas redondeadas con texto "Agende su cita de Aseguramiento" | Pedido explícito de JC. |
| Asistencia: 💡 en vez de ⚠ | "el signo da imagen de que fuera un error, agregale algo más llamativo pero tranquilizador". |
| IDD con regla daño < ₡400.000 corre por cuenta del **asegurado** | Wording correcto pedido por JC. |
| Verde emerald vivo (`#10b981`/`#34d399`) en lugar de teal oscuro | "el color de los verdes un poco más claro y vivo". |
| Sticky nav + floating prev/next + scroll suave | "Que las transiciones sean sutiles, que inviten a continuar con un efecto relajante en el desplazamiento y que permita devolverse". |
| Momento celebración con confetti + check + mensaje + signature | "al final después de que el cliente haga la cita, un efecto o mensaje que refuerce que tomo una excelente decisión". |
| Sección 4 sin regla del 80% (gasolina ni eléctrica) | "Eliminemos esa sección completamente · Quitamos completamente la regla del 80 también en la sección de eléctrico". |
| Eléctricos siempre visible (educativo) | "En la explicación es fundamental hablar con claridad de los repuestos y los vehículos eléctricos". |

---

## 19. Mockups (referencia)

Todos los mockups del proceso brainstorming están en
`.superpowers/brainstorm/212-1777150018/content/`:

- `04-hero-final.html` — hero v1
- `05-hero-v2.html` — hero v2 (sin precio + cinta dorada)
- `07-recorrido-v2.html` — flujo completo de 5 secciones
- `08-correcciones-v3.html` — 4 correcciones (asistencia, IDD, verde, nav)
- `09-celebracion.html` — momento celebración
- `11-seccion-4-v2.html` — sección 4 final sin regla 80%
- `12-url-params.html` — esquema URL params

---

## 20. Próximo paso

Después de la revisión de este spec por JC, invocar `writing-plans` para generar el
plan de implementación con pasos concretos:

1. Crear `/explicacion/index-v2.html` (single file con todo el HTML+CSS+JS).
2. Modificar `js/email-template.js` para generar el nuevo URL con todos los params.
3. Modificar `js/app.js` si es necesario para pasar los datos extra a `buildEmail`.
4. Test en local con URL params de prueba.
5. Validación responsive + accesibilidad.
6. Reemplazar `/explicacion/index.html` con la v2.
7. Commit + push → auto-deploy Netlify.
8. Actualizar SKILL_COTIZADOR_SDI.md con el cambio.
