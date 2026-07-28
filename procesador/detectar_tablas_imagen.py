# -*- coding: utf-8 -*-
"""
Detecta tablas que viven como IMAGEN dentro de los PDF del INS.

Por que existe: la tabla de depreciacion de la bateria de alta tension (CG pag
54) esta incrustada como imagen. Ni find_tables ni pymupdf4llm la ven, asi que
el corpus quedaba con "se aplicara el porcentaje conforme a la siguiente
tabla:" y NADA detras. El consultor citaba la clausula sin poder decir el
porcentaje — el peor modo de falla: una respuesta incompleta que no se nota.

Este script NO adivina el contenido: solo senala DONDE hay que mirar. Las
tablas se transcriben leyendo la imagen y se guardan en tablas-imagen.json,
que el seccionador inyecta en la seccion correspondiente.

    python procesador/detectar_tablas_imagen.py

Salida: paginas sospechosas, ordenadas por probabilidad de contener una tabla
perdida. "PROMETE" = el texto anuncia una tabla que no aparece extraida.
"""
import fitz
import re
import warnings

warnings.filterwarnings("ignore")

BASE = r"C:/Users/segur/COTIZADOR-AUTOS"
DOCS = [
    ("guia-2026", f"{BASE}/netlify/functions/data/guia-suscripcion-autos-2026.pdf"),
    ("cg-sva", f"{BASE}/documentos-ins/condiciones-generales-sva-v31-1.pdf"),
    ("multiasistencia", f"{BASE}/documentos-ins/co-multiasistencia-170.pdf"),
    ("perfeccionamiento", f"{BASE}/documentos-ins/perfeccionamiento-sva-v31.pdf"),
    ("pacto-amistoso", f"{BASE}/documentos-ins/co-pacto-amistoso-v30-170.pdf"),
    ("dam", f"{BASE}/documentos-ins/co-dam-v30-170.pdf"),
]

# El encabezado, el pie y el fondo decorativo del INS son imagenes grandes que
# se repiten en casi todas las paginas. Filtrar por margen NO alcanza (el fondo
# ocupa la hoja entera): lo que las delata es que se REPITEN. Una imagen que
# aparece en mas de un tercio del documento es plantilla, no contenido.
REPETICION = 0.33

PROMESA = re.compile(
    r"siguiente tabla|siguiente cuadro|tabla siguiente|cuadro siguiente|"
    r"se detalla a continuaci|conforme a la siguiente|segun la siguiente",
    re.I,
)


def plantilla(d):
    """xrefs de las imagenes que se repiten en el documento: son decoracion."""
    veces = {}
    for pg in d:
        for xref in {i[0] for i in pg.get_images(full=True)}:
            veces[xref] = veces.get(xref, 0) + 1
    tope = max(2, d.page_count * REPETICION)
    return {x for x, n in veces.items() if n >= tope}


def imagenes_de_contenido(pg, decorativas):
    """Imagenes propias de esta pagina, sin la plantilla del INS ni iconitos."""
    out = []
    for info in pg.get_images(full=True):
        if info[0] in decorativas:
            continue
        for r in pg.get_image_rects(info[0]):
            if r.width * r.height >= 12000:
                out.append(r)
    return out


def main():
    total = 0
    for did, path in DOCS:
        d = fitz.open(path)
        decorativas = plantilla(d)
        hallazgos = []
        for i, pg in enumerate(d, start=1):
            imgs = imagenes_de_contenido(pg, decorativas)
            if not imgs:
                continue
            texto = pg.get_text()
            tablas = len(pg.find_tables().tables)
            # La promesa puede estar en esta pagina o al final de la anterior.
            previa = d[i - 2].get_text() if i > 1 else ""
            promete = bool(PROMESA.search(texto) or PROMESA.search(previa[-400:]))
            if tablas and not promete:
                continue          # la tabla ya se extrajo como texto
            hallazgos.append((i, len(imgs), round(max(r.width * r.height for r in imgs)), promete, tablas))

        if not hallazgos:
            continue
        print(f"\n{did}  ({len(hallazgos)} paginas con imagen de contenido)")
        for pag, n, area, promete, tablas in sorted(hallazgos, key=lambda x: (not x[3], -x[2])):
            marca = "  <-- PROMETE UNA TABLA" if promete else ""
            print(f"   p{pag:>3} | {n} img | area {area:>7} | tablas extraidas={tablas}{marca}")
            total += 1

    print(f"\n{'=' * 66}")
    print(f"{total} paginas a revisar a ojo.")
    print("Las marcadas PROMETE son las que casi seguro tienen una tabla perdida.")
    print("Rasterizar con:  pg.get_pixmap(matrix=fitz.Matrix(2.2, 2.2))")
    print("y transcribir a mano en procesador/tablas-imagen.json.")


if __name__ == "__main__":
    main()
