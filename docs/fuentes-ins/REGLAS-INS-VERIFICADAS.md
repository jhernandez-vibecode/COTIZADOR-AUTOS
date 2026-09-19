# Reglas de negocio INS — verificadas contra fuente oficial

> Verificación 11 jun 2026 contra los PDF oficiales que entregó JC.
> Fuentes (no versionadas en el repo, viven en `OneDrive\ARCHIVO DIGITAL\Automóviles\`):
> - `CONDICIONES GENERALES SEGURO AUTOMÓVILES.pdf` (63 págs)
> - `CONDICIONES OPERATIVAS MULTIASISTENCIA DE AUTOMÓVILES.pdf`
> - `Marcas Alta Siniestralidad.pdf`
> - `Circular N° 0395-2024` y `Circular N° 0409-2024` (alta gama)

## Coberturas — nombres oficiales (Condiciones Generales, págs 14-24)

| Letra | Nombre oficial | Notas |
|-------|----------------|-------|
| A | RC Extracontractual por Lesión/Muerte de Personas | sin deducible |
| B | Servicios Médicos Familiares | sin deducible |
| C | RC Extracontractual por Daños a la Propiedad de Terceros | |
| D | Colisión y/o Vuelco | aplica deducible |
| **E** | **GASTOS LEGALES** | reintegro de gastos legales — **es la "asistencia legal"** |
| F | Robo y/o Hurto | aplica deducible |
| **G** | **MULTIASISTENCIA AUTOMÓVILES** | **asistencia en viaje/carretera** (grúa, etc.), NO legal |
| H | Riesgos Adicionales | aplica deducible |
| K | Indemnización para Transporte Alternativo | |
| **M** | **MULTIASISTENCIA EXTENDIDA** | asistencia ampliada |
| N | Exención de Deducible | aplica a C |
| P | Gastos Médicos y Funerarios de Ocupantes | |
| Y | Extraterritorialidad | |
| Z | Riesgos Particulares | |
| IDD | Indemnización del Deducible | |

**Implicancia (corregido 11 jun):** el form de `/coberturas/` decía `G = Asistencia legal` — **error**. G es Multiasistencia (carretera). La "asistencia legal" real es la cobertura **E (Gastos Legales)**, que hoy NO está en el cotizador. `/detalle/` y el explicador ya tratan G/M como asistencia de carretera → correctos. **Pendiente opcional:** agregar cobertura E al form + /detalle/.

## Batería de vehículos eléctricos (Condiciones Generales págs 34, 53-54)

- Indemnización por sustitución total de batería de alta tensión = **hasta 40%** del Valor Declarado o VRE (el menor). Si la factura es menor, se toma la factura.
- Tabla de depreciación por antigüedad (pág 54) — **coincide con el explicador**:
  | Antigüedad | % Aseguramiento |
  |---|---|
  | 0-24 meses | 100% |
  | 25-48 meses | 80% |
  | 49-72 meses | 60% |
  | 73-96 meses | 50% |
- **EXCLUSIÓN (pág 34, punto v):** *"Los vehículos eléctricos con una antigüedad igual o superior a **nueve (9) años** no tendrán cobertura para la batería de alta tensión."* → corte real **9 años (108 meses)**, no 96. Aviso agregado al explicador + /detalle/ (commit 11 jun).
- Tras pagar la sustitución total de batería, la póliza se cancela automáticamente y la prima se tiene por devengada (pág 59, punto 7).

## Cláusula 33 — Cancelación (Condiciones Generales págs 58-59)

- **≤5 días naturales** desde emisión: devolución 100%.
- **>5 días, dentro de los primeros 6 meses:** factor de la tabla **× 50%**.
- **>6 meses:** factor completo.
- Tabla oficial (factor de tarifa a corto plazo sobre prima anual):
  `Hasta 1 mes 40% · Más de 1 a 2 meses 48% · 2-3 55% · 3-4 62% · 4-5 68% · 5-6 75% · 6-7 79% · 7-8 84% · 8-9 89% · 9-10 93% · 10-11 96% · 11-12 100%`
- Devolución dentro de 10 días hábiles de la solicitud.

### BUG CORREGIDO 11 jun — el factor iba sobre la cuota, no sobre la prima anual

La calculadora aplicaba el factor de la tabla a **la cuota del período** (lo que el
cliente paga trimestral/semestral/mensual), pero la norma dice "Factor… **sobre prima
anual**". Solo acertaba en pago Anual. En fraccionado prometía devoluciones erróneas
(ej.: prima anual ₡570.891, trimestral con ₡428.166 pagados, cancela a 8 meses →
el código decía devolver ₡15.700 cuando la norma da **₡0**).

**Cálculo correcto (implementado):**
- `prima_devengada (retiene INS) = factor_efectivo × PRIMA ANUAL`
- `prima_no_devengada = prima_anual − prima_devengada`
- `devolución_neta = max(0, total_pagado − prima_devengada)`
- Escenario ≤5 días: devolución = total pagado (100%).

El form ahora pide **prima anual** (base del factor) + **total pagado por el cliente**
(para la devolución neta; se autocompleta = prima anual en pago anual). La forma de
pago quedó solo como dato informativo. Verificado con 4 casos contra la norma.

- **Matiz menor pendiente (NO modificado, conservador):** la tabla dice "Hasta 1 mes"
  (inclusivo). En el día de aniversario mensual exacto el código manda el borde al
  tramo superior (retiene un poco más = devuelve un poco menos). Solo afecta ese día
  exacto; para cualquier otra fecha el índice es correcto. El disclaimer dice que el
  INS confirma el monto. Pendiente de decisión de JC si se ajusta a la letra.

## Marcas con recargo (Marcas Alta Siniestralidad.pdf) — 58 entradas

- Deducible único para todas: **20% con mínimo de ₡500.000**.
- La tabla del cotizador coincide con la fuente salvo **SUZUKI** (Eléctrico + Híbrido, "No Aplica"), que faltaba → **agregada 11 jun** (56 → 58 filas).
- Marcas que NO están en la fuente oficial (no agregar sin documento): GWM/HAVAL, JETOUR, OMODA/JAECOO, EXEED.
- 26 marcas, recargo "Aplica" en marcas chinas/alta siniestralidad; "No Aplica" en SUZUKI, BYD gasolina, RENAULT/PEUGEOT gasolina, JAC, MG, FUSO, ZXAUTO, CHANGAN.

## Alta gama (deducible) — RESUELTO: rige Circular 0186-2025

JC confirmó (11 jun 2026) que **la circular vigente es la 0186-2025**, no las 2024.
Por lo tanto el contenido actual del explicador es **correcto** y NO se cambia:

- Umbral alta gama: **≥ ₡50.000.000**.
- Deducible escalonado: **10% (mín ₡500.000)** en pérdidas ≤ ₡6M · **20%** en pérdidas > ₡6M.

Las circulares 0395-2024 y 0409-2024 (≥₡75M, 20% fijo mín ₡700k) quedaron
**superadas** por la 0186-2025. Conservar solo como histórico. La 0324-2025
(marcas asiáticas, 20% mín ₡500k) sigue vigente y coincide con la tabla de marcas.

## Multiasistencia G y M — límites por plan (verificado 19 sep 2026)

**Fuente:** `documentos-ins/co-multiasistencia-170.pdf` (INS, creado 3 feb 2026, 43 págs; sha256 `516696ed7dcc13ee…`, idéntico al que el INS adjunta a las pólizas de jun 2026). Cada página se rasterizó con PyMuPDF y se leyó **como imagen**, fila por fila. Tablas de **PARTICULARES Y CARGA LIVIANA · USO PERSONAL · asistencia nacional**.

**Reglas (texto):**
- Pág. 7: G y M exigen antigüedad máxima **20 años**, peso ≤ 5.000 kg, ≤ 15 pasajeros. M exige tener G.
- Pág. 10: los límites son **por año calendario (1 ene – 31 dic), no acumulativos**. G tiene 3 planes nacionales: Limitado (16-20 años), Básico (7-15), Plus (0-6).
- 🔴 Pág. 10: **G y M NO se suman.** "Si un cliente contrata la cobertura M gozará únicamente de los servicios y límites definidos para el Plan Extendido". O sea: con G+M **manda la tabla Extendida de M**; con solo G, la de G.

**Límites (eventos por año × monto por evento, USD):**

| Servicio | Plus G (p.13) | Plus Ext. M (p.21) | Básico G (p.12) | Básico Ext. M | Limitado G (p.12) | Limitado Ext. M (p.21) |
|---|---|---|---|---|---|---|
| Remolque por avería | 5 × $200 | 7 × $200 | 4 × $175 | ⚠ 6 × $175 | 3 × $175 | 4 × $175 |
| Remolque por accidente / traslado a valoración | 5 × $200 | 7 × $200 | 5 × $175 | ⚠ 7 × $175 | 5 × $175 | 6 × $175 |
| Cerrajería | 4 × $150 | 6 × $150 | 3 × $125 | ⚠ 4 × $125 | 2 × $125 | 3 × $125 |
| Envío de combustible (7,6 l) | 4 × costo | 6 × costo | 3 × costo | ⚠ 4 × costo | 2 × costo | 3 × costo |
| Cambio de llanta | 5 × $125 | 6 × $125 | 3 × $100 | ⚠ 4 × $100 | 2 × $100 | 3 × $100 |
| Paso de corriente | 3 × $125 | 4 × $125 | 2 × $100 | ⚠ 3 × $100 | 2 × $100 | 3 × $100 |
| Mini-rescate (atoramiento) | 3 × $125 | 4 × $125 | 2 × $100 | ⚠ 3 × $100 | 1 × $100 | 2 × $100 |

🔴 **⚠ La tabla "Plan Básico Extendido 7-15 años" de particulares/uso personal NO VIENE en la versión 2026 del INS**: la pág. 21 trae Limitado Extendido y Plus Extendido, y la 22 ya es motocicletas. (El "Básico Extendido" de la pág. 24 es de **uso comercial**, 0-15 años: 4/7/4/4/4/4/3 — no aplica.) Las cifras ⚠ salen de la **versión anterior** (V30, creada 25 feb 2025, 41 págs, pág. 20; copia en `OneDrive\ARCHIVO DIGITAL\Automóviles\CONDICIONES OPERATIVAS MULTIASISTENCIA DE AUTOMÓVILES.pdf`). Limitado Extendido y Plus Extendido son **idénticos** entre las dos versiones, lo que sugiere un error de compaginación del INS y no un cambio de límites — pero **no está confirmado**. Pendiente: que JC lo consulte al INS.

**Lo que mostraba la guía (`explicacion/index.html` `#s2`) hasta hoy:** 6×$175 · 7×$175 · 4×$125 · 4×costo · 4×$100 · 3×$100 · 3×$100, fijo para todo vehículo. **Es exactamente el Básico Extendido de la versión 2025.** Correcto solo para 7-15 años con G+M. Errores:
- 0-6 años con G+M (Plus Extendido): la guía **promete de menos** en todo (montos $175/$125/$100 vs $200/$150/$125; eventos 6/7/4/4/4/3/3 vs 7/7/6/6/6/4/4).
- 0-6 años solo G (Plus): **promete de más** en avería (6 vs 5) y accidente (7 vs 5); de menos en montos y llanta.
- 7-15 años solo G (Básico): **promete de más en las 7 filas** (6/7/4/4/4/3/3 vs 4/5/3/3/3/2/2).
- 16-20 años (Limitado): la guía los rotula "Plan Básico" y promete de más en todo.
- Más de 20 años: el INS no suscribe la Multiasistencia; la guía no lo contempla.

**Propuesta (mockup, SIN publicar, pendiente del OK de JC):** `docs/superpowers/specs/2026-09-19-asistencia-por-plan-mock.py` (`mock a|b` genera `explicacion/_mockup-asistencia*.html`; `real a|b` lo aplica). Tres pestañas clicables, tabla según plan × (M en `cb` → Extendido; solo G → G; sin `cb` → G como piso + nota), >20 años sin cifras. Decisión abierta **BX**: Básico con M → (A) cifras de la versión 2025, o (B) piso de G + nota cualitativa.
