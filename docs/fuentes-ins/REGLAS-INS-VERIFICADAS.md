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
- **Matiz no resuelto (el código actual NO se modifica):** la tabla dice "Hasta 1 mes" (inclusivo). En el día de aniversario mensual exacto el código manda el borde al tramo superior (devuelve un poco menos = conservador). Solo afecta el día exacto; el disclaimer dice que el INS confirma el monto. Pendiente de decisión de JC si se ajusta a la letra de la tabla.

## Marcas con recargo (Marcas Alta Siniestralidad.pdf) — 58 entradas

- Deducible único para todas: **20% con mínimo de ₡500.000**.
- La tabla del cotizador coincide con la fuente salvo **SUZUKI** (Eléctrico + Híbrido, "No Aplica"), que faltaba → **agregada 11 jun** (56 → 58 filas).
- Marcas que NO están en la fuente oficial (no agregar sin documento): GWM/HAVAL, JETOUR, OMODA/JAECOO, EXEED.
- 26 marcas, recargo "Aplica" en marcas chinas/alta siniestralidad; "No Aplica" en SUZUKI, BYD gasolina, RENAULT/PEUGEOT gasolina, JAC, MG, FUSO, ZXAUTO, CHANGAN.

## ⚠ CONFLICTO PENDIENTE — Alta gama (deducible)

El cotizador y las circulares de JC **no coinciden**. NO cambiar hasta confirmar cuál circular está vigente.

| | App actual (cita Circular 0186-2025) | Circular 0409-2024 (PDF de JC) |
|---|---|---|
| Umbral | ≥ ₡50.000.000 | ≥ ₡75.000.000 |
| Deducible | escalonado 10% (mín ₡500k) ≤₡6M / 20% >₡6M | **20% fijo, mín ₡700.000** |
| Cobertura N | — | **No se puede contratar** en Daño Directo |
| IDD | — | Sin limitante, según Condiciones Generales |

- Circular 0395-2024 (anterior): ≥₡75M → 20% mín ₡150k; <₡75M → fijo ₡300k. Superada por 0409-2024.
- **Necesario:** ¿está vigente la Circular 0186-2025 (la que cita la app) o la 0409-2024? Si rige 0409-2024, el explicador de alta gama (umbral ₡50M + escalonado) está materialmente desactualizado.
