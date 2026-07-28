# Consultor de Autos — Diseño

**Fecha:** 2026-07-28
**Proyecto:** Cotizador SDI (cotizador.appsegurosdigitales.com)
**Estado:** Aprobado por Juan Carlos — pendiente aprobación de interfaz antes de construir el frontend

---

## Contexto

El agente necesita responder preguntas concretas de suscripción, cobertura y asistencia
consultando 279 páginas repartidas en seis documentos del INS. Hoy eso se hace abriendo
PDF y buscando con Ctrl+F, que falla cuando el documento usa una palabra distinta a la de
la pregunta ("grúa" vs "remolque" vs "traslado del vehículo") y cuando la respuesta vive
repartida en dos documentos que se contradicen.

Ya existe un precedente manual: `docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md`, donde en
junio 2026 se verificaron reglas contra los PDF oficiales. Ese trabajo detectó un error
real en producción (el formulario decía «G = Asistencia legal» cuando G es Multiasistencia
y la asistencia legal es la cobertura E). Ese archivo demuestra a la vez el valor de la
verificación y lo caro que es hacerla a mano.

Este documento diseña la automatización de esa consulta, **con la misma exigencia de
verificación**: ninguna afirmación sin cita, ninguna cita sin comprobar contra la fuente.

## Objetivo

Que el agente escriba una pregunta en lenguaje normal y reciba una respuesta correcta,
con la cita exacta (documento, versión, página, cláusula) y el texto literal, verificado
carácter por carácter contra el documento fuente — y que pueda mandarla por correo o
WhatsApp.

## Alcance

**Incluye:**

- Nueva sub-página `/consultor/` — interfaz de consulta (interna, del agente)
- Nueva carpeta `netlify/functions/` — primer backend del cotizador
- `consultor/corpus.json` — índice curado de los seis documentos, versionado en el repo
- Recuperación en dos pasos (Haiku para encontrar, Opus 5 para responder)
- Verificación literal de citas, por código
- Whitelist en el servidor + tope diario + contador
- Envío de la respuesta por correo (Gmail API) y WhatsApp
- Pantalla de administración con reproceso, diff y versionado de documentos
- Banco de pruebas derivado de `REGLAS-INS-VERIFICADAS.md`
- Enlace de entrada en el header del cotizador

**No incluye:**

- Embeddings ni base vectorial (ver «Por qué no RAG clásico»)
- OCR — los seis documentos tienen texto extraíble
- Subir PDF en cada consulta — el corpus es fijo
- Condiciones Particulares de clientes concretos — el consultor responde sobre el
  reglamento del producto, nunca sobre la póliza de una persona
- La tabla comparadora tema × documento — queda como corrida aparte si se pide
- Cambios a ninguna funcionalidad existente del cotizador

## Corpus

Cinco de los seis ya vivían en `documentos-ins/`, donde el cotizador los tenía para
adjuntarlos a los correos — y cuatro resultaron **idénticos byte a byte** a los que
entregó JC el 28 jul. La Guía se agregó ese día, en `netlify/functions/data/` por ser
material interno (ver «Qué es público y qué no»).

| Archivo | Documento | Págs | Caracteres |
|---|---|---:|---:|
| `guia-suscripcion-autos-2026.pdf` | Guía de Suscripción Intermediarios Exclusivos · Abril 2026 | 135 | 185.394 |
| `condiciones-generales-sva-v31-1.pdf` | Condiciones Generales SVA · **V31.1 del 28 mar 2026** | 63 | 215.842 |
| `co-multiasistencia-170.pdf` | C.O. Multiasistencia (coberturas G y M) | 43 | 119.088 |
| `perfeccionamiento-sva-v31.pdf` | Información previa al perfeccionamiento del contrato | 32 | 73.909 |
| `co-pacto-amistoso-v30-170.pdf` | C.O. Pacto Amistoso V.30 | 3 | 9.935 |
| `co-dam-v30-170.pdf` | C.O. Accidente Menor (DAM) V.30 | 3 | 11.220 |
| | **Total** | **279** | **615.388** |

Estimado 154.000–205.000 tokens. Se medirá con `count_tokens` contra `claude-opus-5`
antes de cerrar los números de costo.

> **Nota de versión.** El archivo que JC tenía archivado en OneDrive es la **V31**
> (registro `G01-01-A01-012-V31`), cuatro meses más viejo que la V31.1 del repo, y
> arrastra una errata («culpa grabe» por «culpa grave», pág. 61). Se usa la del repo.
> Este caso es la justificación práctica del versionado descrito más abajo: sin él,
> el consultor habría respondido con la versión equivocada sin avisar.
>
> `REGLAS-INS-VERIFICADAS.md` se verificó en junio contra la V31, no la V31.1.

## Arquitectura

### Dónde vive

Todo dentro de `COTIZADOR-AUTOS`. De lo existente se toca **una línea**: el enlace de
entrada en el header de `index.html`. Ningún JS actual se modifica.

```
COTIZADOR-AUTOS/
├── index.html                     ← +1 línea (enlace al consultor)
├── netlify.toml                   ← +regla 404 para /netlify/*
│
├── documentos-ins/                ← PÚBLICO (el navegador los adjunta a los correos)
│   ├── condiciones-generales-sva-v31-1.pdf
│   ├── co-multiasistencia-170.pdf
│   ├── co-pacto-amistoso-v30-170.pdf
│   ├── co-dam-v30-170.pdf
│   └── perfeccionamiento-sva-v31.pdf
│
├── consultor/                     ← PÚBLICO (solo interfaz, sin datos)
│   ├── index.html                 ← pendiente de aprobación visual
│   ├── consultor.js
│   └── admin.html                 ← reproceso y versionado
│
└── netlify/                       ← PRIVADO (404 forzado + fuera del publish)
    └── functions/
        ├── consultar.mjs          ← backend: clave, whitelist, los dos pasos
        └── data/
            ├── corpus.json        ← índice curado — NUNCA servido al navegador
            └── guia-suscripcion-autos-2026.pdf
```

### Qué es público y qué no

`netlify.toml` publica la raíz del repo. Los cinco PDF de `documentos-ins/` **tienen
que** ser públicos: [standard-docs.js](../../../js/standard-docs.js) los descarga desde
el navegador para adjuntarlos a los correos, y además van dirigidos al cliente.

La **Guía de Suscripción no**. Es material interno del INS para intermediarios
exclusivos — reglas de suscripción y recargos por marca — y no debe ser descargable
escribiendo la URL. Vive en `netlify/functions/data/`, fuera del directorio publicado,
con una regla 404 explícita para `/netlify/*` siguiendo el patrón que el repo ya usa
para `docs/` y `tests/`.

`corpus.json` sigue la misma regla, porque contiene el **texto completo** de la Guía.
Esto no cuesta nada arquitectónicamente: los dos pasos de la consulta ocurren en la
función, así que el navegador nunca necesita el corpus — solo recibe la respuesta ya
armada.

**Consecuencia para el botón «ver el PDF»:** para los cinco documentos públicos abre el
PDF directo en la página citada. Para la Guía, el PDF se sirve **a través de la función
autenticada**, que verifica la whitelist antes de entregarlo.

### Flujo de una consulta

```
  Pregunta del agente
         │
         ▼
  ┌──────────────────────────────────────────┐
  │ PASO 1 — ENCONTRAR      (Haiku 4.5)      │
  │ pregunta + índice completo de las         │
  │ 279 páginas (títulos + resúmenes +        │
  │ palabras clave, ~14k tokens, cacheado)    │
  │ → devuelve IDs de secciones relevantes    │
  └──────────────────────────────────────────┘
         │  máx. 12 secciones
         ▼
  ┌──────────────────────────────────────────┐
  │ PASO 2 — RESPONDER      (Opus 5)         │
  │ pregunta + TEXTO ÍNTEGRO de esas          │
  │ secciones + reglas de citación            │
  │ → respuesta JSON con citas                │
  └──────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────┐
  │ PASO 3 — VERIFICAR      (código, no IA)  │
  │ cada cita textual se compara carácter     │
  │ por carácter contra corpus.json           │
  │ → verificada ✅ / no encontrada ⚠️        │
  └──────────────────────────────────────────┘
         │
         ▼
  Respuesta en pantalla → correo / WhatsApp
```

El paso 1 lee el **mapa completo** de los seis documentos, no un fragmento. Por eso no
puede «no encontrar» una cláusula por un problema de búsqueda, y resuelve solo que
*grúa*, *remolque* y *traslado del vehículo* son el mismo tema.

El paso 2 recibe **cláusulas enteras**, nunca fragmentos cortados por conteo de palabras.

### Por qué no RAG clásico

El plan original contemplaba embeddings y base vectorial. Se descarta por tres razones:

1. **El corpus es fijo.** Seis documentos que cambian una o dos veces al año no
   justifican infraestructura de búsqueda dinámica.
2. **El recuperador sería el techo de precisión.** Si el vector no trae la cláusula
   correcta, el modelo responde con lo que le llegó y suena igual de seguro. El índice
   curado, en cambio, expone el mapa completo en cada consulta.
3. **Piezas que pueden fallar.** Un proveedor de embeddings y una base vectorial más
   que mantener, en una app que hoy no tiene ni backend.

### Por qué no el corpus completo en cada consulta

Cabe en la ventana de 1M de Opus 5, y da el máximo recall teórico. Se descarta por costo
y latencia: la caché expira (5 min o 1 hora) y cada expiración cuesta la reescritura de
~180k tokens. Con uso disperso a lo largo del día —que es como consulta un agente— eso
son varios dólares diarios y unos 10 segundos por respuesta.

## Modelo de datos — `corpus.json`

Cada sección es una **cláusula o artículo completo**, nunca un corte por número de
palabras.

```jsonc
{
  "version_corpus": "2026-07-28",
  "documentos": [
    {
      "id": "cg-sva",
      "titulo": "Condiciones Generales del Seguro Voluntario de Automóviles",
      "archivo": "/documentos-ins/condiciones-generales-sva-v31-1.pdf",
      "version": "V31.1",
      "registro": "G01-01-A01-012",
      "vigencia_desde": "2026-03-28",
      "estado": "vigente"          // vigente | archivada
    }
  ],
  "secciones": [
    {
      "id": "cg-sva-v31.1-s084",
      "documento": "cg-sva",
      "version": "V31.1",
      "titulo": "Cobertura E — Gastos Legales",
      "pagina_desde": 19,
      "pagina_hasta": 20,
      "categoria": "cobertura",
      "resumen": "Reintegro de gastos legales derivados de un accidente de tránsito.",
      "palabras_clave": ["gastos legales", "abogado", "defensa", "juicio", "cobertura E"],
      "texto": "…texto íntegro de la cláusula, tal cual el PDF…"
    }
  ]
}
```

**Categorías:** cobertura · exclusión · deducible · límite · requisito · procedimiento ·
definición · asistencia · obligación del asegurado · asegurabilidad.

El índice que viaja en el paso 1 son los campos `titulo`, `categoria`, `resumen` y
`palabras_clave`. El campo `texto` solo viaja en el paso 2, y solo el de las secciones
seleccionadas.

## Precisión — cómo se garantiza

Tres mecanismos, ninguno de los cuales es «confiar en el modelo».

### 1. Verificación literal de citas

Cada cita textual que devuelve el modelo se busca **carácter por carácter** en el campo
`texto` de la sección citada. Si no aparece literalmente, la cita se marca en rojo como
*no verificada* y la respuesta queda bloqueada para envío.

Esto no promete que el modelo no invente. Comprueba mecánicamente que no inventó.

### 2. Regla de abstención

Si la respuesta no está en los seis documentos, el consultor responde **«no encontré
esto en los documentos»**. Eso es una respuesta correcta, no una falla. El prompt
prohíbe completar con conocimiento general de seguros.

Cuando un tema aparece en un documento pero no en otro, o los dos dicen cosas distintas,
se declara explícitamente en vez de elegir uno.

### 3. Banco de pruebas verificado

`docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md` se convierte en casos de prueba con
respuesta esperada. Mínimo:

| Pregunta | Respuesta esperada | Fuente |
|---|---|---|
| ¿Qué es la cobertura E? | Gastos Legales (no «asistencia legal» genérica) | CG págs 14-24 |
| ¿Qué cubre la cobertura G? | Multiasistencia Automóviles — carretera, no legal | CG + C.O. Multiasistencia |
| ¿Hasta qué antigüedad cubre la batería de un eléctrico? | Menos de 9 años (108 meses) | CG pág 34, punto v |
| Devolución si cancelo a los 3 días | 100 % | CG págs 58-59, Cláusula 33 |
| Devolución a los 4 meses | Factor de tabla × 50 % | CG págs 58-59 |
| % de aseguramiento de batería a los 60 meses | 60 % | CG pág 54 |

El consultor debe acertar todos con la cita correcta. Si falla alguno, se corrige el
pipeline antes de publicar. Este banco se corre de nuevo cada vez que se reprocesa un
documento.

## Seguridad

El cotizador es hoy 100 % estático y **no tiene control de acceso**: el OAuth de
`gmail-auth.js` pide solo `gmail.send`, que autoriza a la persona a enviar desde su
propia cuenta y no verifica permisos de uso. Eso hoy es sano — no hay secreto compartido
y a JC no le cuesta nada que un desconocido abra la URL.

El consultor invierte eso: la función lleva **la clave de Anthropic de JC** y la URL es
pública y adivinable. Por lo tanto:

| Control | Implementación |
|---|---|
| Clave de Anthropic | Variable de entorno en Netlify. Si falta, la función devuelve error. **Sin valor por defecto, sin fallback.** |
| Quién puede consultar | La función valida el token de Google **en el servidor** y compara el correo contra `CONSULTOR_EMAILS` (variable de entorno). Hoy: un correo. Abrir a más agentes = editar la variable, no el código. |
| Tope de uso | `CONSULTOR_TOPE_DIARIO` por correo. Aviso al acercarse, bloqueo al llegar. |
| Trazabilidad | Contador de consultas del mes por correo, visible para JC. |

La lista **no puede vivir en el JavaScript del navegador**: se salta abriendo las
herramientas de desarrollo. Va en la función.

## Versionado de documentos

Cuando el INS publica una versión nueva:

1. JC sube el PDF desde `/consultor/admin.html`.
2. La app reprocesa y muestra un **diff**: qué secciones cambiaron respecto de la
   versión anterior. JC revisa solo esas, no las 279 páginas.
3. Al aprobar, la versión anterior pasa a `estado: "archivada"` — **no se borra**.
4. Las respuestas citan siempre con qué versión están contestando.

Una póliza emitida bajo la V31 se rige por la V31 aunque exista la V31.1. Si el
consultor pisara la versión vieja, dejaría de servir justo en el caso donde más importa:
un reclamo sobre una póliza antigua. Cuando un tema cambió entre versiones, la respuesta
lo advierte.

También se puede editar una sección suelta a mano, para cuando el seccionado automático
quede mal.

## Salida — correo y WhatsApp

Reutiliza la infraestructura existente: `gmail-auth.js`, `mime-builder.js` y el pie de
firma SDI de `email-template.js`.

**Dos versiones de la misma respuesta**, elegidas al enviar:

- **Interna** (para JC o un colega): completa, con documento, versión, página, cláusula
  y el texto literal.
- **Para cliente**: lenguaje llano, sin jerga de artículos, y con una nota obligatoria —
  *«esto refleja las Condiciones Generales del producto; su póliza puede tener
  condiciones particulares distintas»*. La nota no es formalidad: el consultor no lee la
  póliza del cliente, así que afirmar cobertura sin verla sería afirmar de más.

| Canal | Formato |
|---|---|
| Correo | Gmail API con la firma SDI. HTML de texto y color, **sin imágenes** (Gmail bloquea SVG y base64). |
| WhatsApp | Texto plano, versión corta, vía `web.whatsapp.com/send/`. **Nunca `wa.me`.** |
| Copiar | Al portapapeles con tipo HTML real. **No `writeText` con el HTML**, que pega el código crudo. |

**Regla de bloqueo:** si alguna cita quedó marcada como no verificada, los botones de
envío quedan deshabilitados hasta que JC revise. Sin esto, el envío sería justamente el
mecanismo que convierte un error interno en un problema con un cliente.

## Frontend

**Pendiente de aprobación explícita de JC antes de construirse.** Se presentará una
propuesta visual que cubra: la caja de pregunta, la respuesta con sus citas, el marcado
visual de citas no verificadas, el selector interna/cliente y los botones de correo y
WhatsApp — siguiendo la identidad SDI ya establecida en el cotizador.

## Costos

Estimados sobre 154–205k tokens de corpus; se confirman al medir.

| Concepto | Costo |
|---|---|
| Procesamiento inicial de los 6 documentos | < $5, una sola vez |
| Consulta (paso 1 + paso 2 + salida) | ~$0,10 |
| Uso realista, 10–15 consultas/día | $30–45 al mes |
| Techo con tope de 30 consultas/día | ~$90 al mes |

Precios verificados: Opus 5 $5/$25 por millón de tokens; Haiku 4.5 $1/$5; lectura de
caché 0,1×; escritura 1,25× (5 min) o 2× (1 hora).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La función tumba el deploy del cotizador | Deploy preview antes de `main`; tag `pre-consultor-<fecha>`; aislamiento en `/consultor/` — si la función cae, el cotizador sigue cotizando y enviando correos |
| El seccionado automático queda mal | JC revisa el índice antes de publicar; puede editar cualquier sección; el banco de pruebas lo detecta |
| Respuesta incorrecta enviada a un cliente | Verificación literal + bloqueo de envío + nota de condiciones particulares |
| Costo se dispara | Tope diario + contador + whitelist en el servidor |
| Documento desactualizado | Versionado con archivo, diff al actualizar, versión citada en cada respuesta |

## Plan por fases

1. Procesar los 6 documentos en `corpus.json` — JC revisa el índice
2. Backend: función serverless con clave, whitelist y tope
3. **Aprobación de la interfaz con JC** ← punto de control
4. Frontend `/consultor/`
5. Envío por correo y WhatsApp
6. Pantalla de administración con versionado y diff
7. Correr el banco de pruebas — corregir lo que falle
8. Deploy preview, tag de rollback, push a `main`

## Decisiones tomadas

| Decisión | Razón |
|---|---|
| Q&A con citas, no comparador de documentos | Es el uso diario; el comparador es un entregable de una sola corrida |
| Integrar al cotizador, no app aparte | Los documentos ya viven ahí y se adjuntan a los correos. Apps separadas se desincronizarían |
| Índice curado en dos pasos, no RAG ni corpus completo | Mejor relación precisión / costo / latencia para un corpus fijo de 279 páginas |
| Solo JC en la whitelist al arrancar | Validar con casos reales antes de exponer a otros agentes y de escalar el costo |
| Whitelist como variable de entorno, no `if` con el correo | Abrir a más agentes debe ser configuración, no reescritura |
| Sin condiciones particulares de clientes | Obligaría a subir PDF por consulta y a afirmar cobertura de una póliza concreta |
| Versiones viejas se archivan, no se borran | Un reclamo se rige por las condiciones vigentes al emitirse la póliza |
| La Guía y el corpus fuera del directorio público | La Guía es material interno del INS para intermediarios; `documentos-ins/` es público por necesidad y no sirve para guardarla |
| El corpus lo lee la función, no el navegador | Mantiene el texto de la Guía fuera del alcance público sin costo arquitectónico: los dos pasos ya ocurren en el servidor |
