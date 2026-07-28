# Procesador del corpus — Consultor de Autos

Genera `netlify/functions/data/corpus.json` a partir de los PDF del INS.
**Se corre a mano, en la maquina del agente — no en Netlify.**

## Requisitos

    pip install pymupdf pymupdf4llm

## Uso

    python procesador/seccionador.py     # regenera corpus.json
    python procesador/revision.py        # genera revision-corpus.html para revisar

## Como funciona

Cada documento del INS tiene su propia estructura, asi que cada uno tiene su
propia regla de corte (ver `DOCUMENTOS` en seccionador.py):

| Documento          | Se corta por                              |
|--------------------|-------------------------------------------|
| Condiciones Grales | `CLAUSULA N` en negrita (el indice no lo esta) |
| Multiasistencia    | `ARTICULO N` (todo el cuerpo esta en negrita)  |
| Guia 2026          | jerarquia numerada `1.` / `2.1`            |
| Perfeccionamiento  | titulos en MAYUSCULAS                      |
| Pacto Amistoso     | titulos en MAYUSCULAS                      |
| DAM                | titulos en MAYUSCULAS                      |

Las secciones que pasan 6.000 caracteres se sub-seccionan de forma recursiva
con el patron interno que corresponda (coberturas, exclusiones por cobertura,
definiciones, planes de asistencia), y el sub-titulo arrastra el contexto del
padre para que el indice no pierda el tema madre.

## Tablas

Los limites de asistencia por plan viven en tablas. Extraidas como texto plano
las celdas se fusionan y los limites salen mal — que es peor que no tenerlos.
Se extraen con `pymupdf4llm` en Markdown y se adjuntan a la seccion que las
contiene segun la pagina. **No cambiar esto por `page.get_text()` sin volver a
verificar los limites de los planes Limitado, Basico y Plus.**

## Al actualizar un documento del INS

1. Reemplazar el PDF (en `documentos-ins/`, o en `netlify/functions/data/` si
   es la Guia, que es interna).
2. Correr `seccionador.py` y despues `revision.py`.
3. Revisar `procesador/revision-corpus.html` y comparar contra la version
   anterior antes de commitear el nuevo `corpus.json`.
4. Correr el banco de pruebas de `docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md`.
