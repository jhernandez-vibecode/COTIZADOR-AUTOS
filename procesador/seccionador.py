# -*- coding: utf-8 -*-
"""
Seccionador v2 del corpus del Consultor de Autos.

Cambios sobre v1:
  - Tablas extraidas con pymupdf4llm (Markdown) y adjuntadas a la seccion que
    las contiene, segun pagina. Sin esto los limites de asistencia por plan
    llegaban con las celdas fusionadas.
  - Sub-seccionado RECURSIVO: se repite hasta que ninguna seccion pase el umbral.
  - Los sub-titulos arrastran el contexto del padre ("Clausula 7 Exclusiones —
    Bajo la cobertura A"), para que el indice del paso 1 no pierda el tema madre.
  - Multiasistencia no exige negrita (todo su cuerpo lo esta).
"""
import fitz, re, json, os, unicodedata, warnings
from collections import Counter
warnings.filterwarnings("ignore")
import pymupdf4llm

BASE = r"C:/Users/segur/COTIZADOR-AUTOS"
UMBRAL = 6000
MIN_SEC = 120

DOCUMENTOS = [
    {"id": "guia-2026", "archivo": f"{BASE}/netlify/functions/data/guia-suscripcion-autos-2026.pdf",
     "titulo": "Guía de Suscripción para Intermediarios Exclusivos — Línea de Automóviles",
     "version": "Abril 2026", "vigencia_desde": "2026-04-01", "publico": False, "regla": "guia"},
    {"id": "cg-sva", "archivo": f"{BASE}/documentos-ins/condiciones-generales-sva-v31-1.pdf",
     "titulo": "Condiciones Generales del Seguro Voluntario de Automóviles",
     "version": "V31.1", "registro": "G01-01-A01-012", "vigencia_desde": "2026-03-28",
     "publico": True, "regla": "clausulas"},
    {"id": "multiasistencia", "archivo": f"{BASE}/documentos-ins/co-multiasistencia-170.pdf",
     "titulo": "Condiciones Operativas — Multiasistencia Automóviles (coberturas G y M)",
     "version": "170", "vigencia_desde": None, "publico": True, "regla": "articulos"},
    {"id": "perfeccionamiento", "archivo": f"{BASE}/documentos-ins/perfeccionamiento-sva-v31.pdf",
     "titulo": "Información previa al perfeccionamiento del contrato",
     "version": "V31", "vigencia_desde": None, "publico": True, "regla": "mayusculas"},
    {"id": "pacto-amistoso", "archivo": f"{BASE}/documentos-ins/co-pacto-amistoso-v30-170.pdf",
     "titulo": "Condiciones Operativas — Pacto Amistoso",
     "version": "V30", "vigencia_desde": None, "publico": True, "regla": "mayusculas"},
    {"id": "dam", "archivo": f"{BASE}/documentos-ins/co-dam-v30-170.pdf",
     "titulo": "Condiciones Operativas en caso de Accidente Menor (DAM)",
     "version": "V30", "vigencia_desde": None, "publico": True, "regla": "mayusculas"},
]

# ------------------------------------------------------------------ lectura

def leer_lineas(path):
    d = fitz.open(path)
    out = []
    for i, pg in enumerate(d, start=1):
        for blk in pg.get_text("dict")["blocks"]:
            for line in blk.get("lines", []):
                spans = [sp for sp in line.get("spans", []) if sp["text"].strip()]
                if not spans:
                    continue
                txt = "".join(sp["text"] for sp in spans).strip()
                if txt:
                    out.append({"pg": i, "txt": txt, "ctx": "",
                                "bold": any("bold" in sp["font"].lower() for sp in spans)})
    return out


# En Multiasistencia los planes se repiten para cada combinacion de ambito x
# categoria de vehiculo x uso, con limites DISTINTOS: el Plan Basico da 3
# eventos de remolque a un particular de uso personal y 2 a una motocicleta.
# Esos encabezados no abren una seccion — califican a las que vienen despues.
# Sin arrastrarlos, tres secciones se llaman igual y el consultor puede
# contestar el limite de otra categoria, que es una respuesta equivocada.
# Los encabezados son rotulos cortos ("ASISTENCIA NACIONAL"); las definiciones
# del Articulo 1 empiezan igual pero siguen con una oracion ("ASISTENCIA
# INTERNACIONAL: Servicio complementario del seguro..."). El $ y el largo los
# separan — sin eso una definicion contamina el contexto de las paginas siguientes.
CONTEXTO = {
    "ambito":    re.compile(r"^ASISTENCIA\s+(NACIONAL|INTERNACIONAL)\s*$", re.I),
    "categoria": re.compile(r"^(PARTICULARES\s+Y\s+CARGA\s+LIVIANA|MOTOCICLETAS[^\n]*|CARGA\s+PESADA[^\n]*|AUTOBUSES[^\n]*)$", re.I),
    "uso":       re.compile(r"^USO\s+(PERSONAL|COMERCIAL)\b", re.I),
    "antig":     re.compile(r"^Veh[ií]culos?\s+(?:de\s+)?\d+\s*a\s*\d+\s*a[nñ]os", re.I),
}

def anotar_contexto(lineas):
    """Marca cada linea con el ambito/categoria/uso vigente en ese punto."""
    vig = {"ambito": "", "categoria": "", "uso": ""}
    for L in lineas:
        t = L["txt"].strip()
        for clave in ("ambito", "categoria", "uso"):
            m = CONTEXTO[clave].match(t)
            if m:
                vig[clave] = re.sub(r"\s+", " ", t).strip().title()
                if clave == "ambito":       # un ambito nuevo reinicia lo de abajo
                    vig["categoria"] = vig["uso"] = ""
                elif clave == "categoria":
                    vig["uso"] = ""
                break
        L["ctx"] = " · ".join(v for v in (vig["ambito"], vig["categoria"], vig["uso"]) if v)
    return lineas


def tablas_de_imagen(doc_id):
    """
    Tablas que viven como IMAGEN en el PDF y ninguna herramienta de texto ve.

    La de depreciacion de la bateria (CG pag 54) dejaba el corpus con "conforme
    a la siguiente tabla:" y nada detras: el consultor citaba la clausula sin
    poder decir el porcentaje. Estan transcritas a mano en tablas-imagen.json
    tras LEER la imagen; ver procesador/detectar_tablas_imagen.py para
    encontrar mas.
    """
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tablas-imagen.json")
    try:
        with open(ruta, encoding="utf-8") as f:
            datos = json.load(f)
    except FileNotFoundError:
        return {}
    out = {}
    for t in datos.get("tablas", []):
        if t["documento"] != doc_id:
            continue
        bloque = f"**{t['titulo']}**\n" + "\n".join(t["markdown"])
        out.setdefault(t["pagina"], []).append(bloque)
    return out


def extraer_tablas(path):
    """{pagina: [tabla en markdown, ...]} usando pymupdf4llm."""
    d = fitz.open(path)
    tablas = {}
    for i in range(d.page_count):
        try:
            if not d[i].find_tables().tables:
                continue
            md = pymupdf4llm.to_markdown(d, pages=[i], table_strategy="lines")
        except Exception:
            continue
        bloques, actual = [], []
        for ln in md.split("\n"):
            if ln.strip().startswith("|"):
                actual.append(ln.rstrip())
            elif actual:
                if len(actual) >= 3:
                    bloques.append("\n".join(actual))
                actual = []
        if len(actual) >= 3:
            bloques.append("\n".join(actual))
        if bloques:
            tablas[i + 1] = bloques
    return tablas


# --------------------------------------------------------------- semantica

def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

CATEGORIAS = [
    ("exclusion",     ["no amparado", "no ampara", "exclusion", "excluid", "no cubre", "riesgos excluidos", "no aplica"]),
    ("deducible",     ["deducible"]),
    ("asistencia",    ["multiasistencia", "asistencia", "grua", "remolque", "cerrajer", "auto sustituto", "chofer ins"]),
    ("limite",        ["limite", "suma asegurada", "monto maximo", "maximo eventos", "por evento"]),
    ("cobertura",     ["cobertura", "ampara", "indemniza"]),
    ("requisito",     ["requisito", "documentos requeridos", "debera presentar", "se requiere"]),
    ("procedimiento", ["procedimiento", "tramite", "proceso", "aviso de accidente", "reclamo", "como reportar"]),
    ("obligacion",    ["obligacion", "deber del asegurado", "esta obligado"]),
    ("definicion",    ["definicion", "se entiende por", "significa", "se refiere a"]),
    ("asegurabilidad",["asegurable", "suscripcion", "aceptacion del riesgo", "antiguedad", "clase tarifaria"]),
]

def categorizar(titulo, texto, padre=""):
    ti = sin_tildes((titulo + " " + (padre or "")).lower())
    cu = sin_tildes(texto[:1200].lower())
    p = Counter()
    for cat, claves in CATEGORIAS:
        for k in claves:
            kk = sin_tildes(k)
            p[cat] += ti.count(kk) * 5 + cu.count(kk)
    return p.most_common(1)[0][0] if p and max(p.values()) > 0 else "general"

TERMINOS = ["grua","remolque","traslado","cerrajeria","bateria","combustible","auto sustituto","chofer",
    "robo","hurto","colision","vuelco","incendio","deducible","prima","suma asegurada","valor declarado",
    "responsabilidad civil","gastos legales","gastos medicos","funerarios","ocupantes","terceros","ambulancia",
    "cancelacion","devolucion","renovacion","vigencia","perfeccionamiento","siniestro","reclamo","indemnizacion",
    "perdida total","exencion","extraterritorialidad","electrico","hibrido","alta tension","taller","repuesto",
    "depreciacion","antiguedad","placa","carga liviana","motocicleta","autobus","uso comercial","uso personal",
    "licencia","alcohol","dolo","culpa grave","pacto amistoso","accidente menor","transito","bonificacion",
    "recargo","plan limitado","plan basico","plan plus","llanta","paso de corriente","vidrieria"]

def palabras_clave(titulo, texto, tope=14):
    t = sin_tildes((titulo + " " + texto).lower())
    hits = sorted(((k, t.count(sin_tildes(k))) for k in TERMINOS), key=lambda x: -x[1])
    claves = [k for k, n in hits if n > 0][:tope]
    for w in re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}", titulo.lower()):
        if w not in claves:
            claves.insert(0, w)
    return claves[:tope]

def resumen(texto, limite=170):
    c = re.sub(r"\s+", " ", re.sub(r"\|[^\n]*\|", " ", texto)).strip()
    m = re.search(r"(?<=[a-zá-úñ0-9\)])\.\s+", c[:600])
    f = c[:m.end()].strip() if m else c[:limite]
    return (f[:limite].rsplit(" ", 1)[0] + "…") if len(f) > limite else f

# --------------------------------------------------------------- detectores

R = {
 "clausula": re.compile(r"^CL[AÁ]USULA\s+N?[ºo°]?\s*(\d+)[\.\-:\s]*(.*)$", re.I),
 "articulo": re.compile(r"^ART[IÍ]CULO\s+N?[ºo°]?\s*(\d+)[\.\-:\s]*(.*)$", re.I),
 "num1":     re.compile(r"^(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑ][^\n]{4,90})$"),
 "num2":     re.compile(r"^(\d{1,2}\.\d{1,2})\.?\s+(\S.{3,90})$"),
 "num3":     re.compile(r"^(\d{1,2}\.\d{1,2}\.\d{1,2})\.?\s+(\S.{3,90})$"),
 "cobert":   re.compile(r'^(\d{1,2})\)\s*COBERTURA\s+["“”\'‘’]?([A-Z]{1,3})["“”\'‘’]?\s*(.*)$', re.I),
 "bajo":     re.compile(r'^(\d{1,2})\.\s+(BAJO\s+(?:LA|LAS|TODAS|EL)\s+.*)$', re.I),
 "defin":    re.compile(r"^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-/\(\)0-9]{2,60}):\s*(.*)$"),
 "mayus":    re.compile(r"^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-,\.º°/0-9\(\)]{8,80})$"),
 "letra":    re.compile(r"^([a-zA-Z])[\)\.]\s+([A-ZÁÉÍÓÚÑ].{4,80})$"),
 "plan":     re.compile(r"^(PLAN\s+(?:LIMITADO|B[AÁ]SICO|PLUS|EXTENDIDO).*)$", re.I),
}
RUIDO = re.compile(r"^(p[aá]gina\s+\d+|\d+|documento de uso controlado.*|direcci[oó]n oficinas.*|l[ií]nea gratuita.*|apdo\.?\s*postal.*)$", re.I)

def cortes(lineas, det, bold=None):
    out = []
    for i, L in enumerate(lineas):
        if bold is True and not L["bold"]:
            continue
        if bold is False and L["bold"]:
            continue
        t = det(L["txt"])
        if t:
            out.append((i, re.sub(r"\s+", " ", t).strip(" .:-—_")))
    return out

def partir(lineas, cts):
    blo = []
    for j, (idx, tit) in enumerate(cts):
        fin = cts[j + 1][0] if j + 1 < len(cts) else len(lineas)
        tro = lineas[idx:fin]
        if not tro:
            continue
        blo.append({"titulo": tit, "p1": tro[0]["pg"], "p2": tro[-1]["pg"], "lineas": tro})
    return blo

def texto_de(lineas):
    return re.sub(r"\s+", " ", " ".join(l["txt"] for l in lineas if not RUIDO.match(l["txt"]))).strip()

# candidatos de sub-corte, en orden de preferencia
SUBS = [
 (lambda t: (lambda m: f'Cobertura "{m.group(2).upper()}" {m.group(3).strip()}'.strip() if m else None)(R["cobert"].match(t)), True),
 (lambda t: (lambda m: m.group(2).strip() if m else None)(R["bajo"].match(t)), True),
 (lambda t: (lambda m: m.group(1).strip() if m else None)(R["defin"].match(t)), True),
 (lambda t: (lambda m: m.group(1).strip() if m else None)(R["plan"].match(t)), None),
 (lambda t: (lambda m: f"{m.group(1)} {m.group(2).strip()}" if m else None)(R["num3"].match(t)), None),
 (lambda t: (lambda m: f"{m.group(1)} {m.group(2).strip()}" if m else None)(R["num2"].match(t)), None),
 (lambda t: (lambda m: m.group(2).strip() if m else None)(R["num1"].match(t)), None),
 (lambda t: (lambda m: m.group(2).strip() if m else None)(R["letra"].match(t)), None),
 (lambda t: (lambda m: m.group(1).strip().title() if m and not RUIDO.match(t) else None)(R["mayus"].match(t)), None),
]

def explotar(bloque, padre, prof=0):
    """Devuelve lista de bloques hoja, sub-seccionando recursivamente."""
    txt = texto_de(bloque["lineas"])
    if len(txt) <= UMBRAL or prof >= 3:
        return [(bloque, padre)]
    cuerpo = bloque["lineas"][1:]
    for det, bold in SUBS:
        cts = cortes(cuerpo, det, bold)
        # sirve si parte en >=3 y no deja un pedazo con casi todo
        if len(cts) >= 3:
            subs = partir(cuerpo, cts)
            mayor = max(len(texto_de(s["lineas"])) for s in subs)
            if mayor < len(txt) * 0.75:
                nuevo_padre = f"{padre} — {bloque['titulo']}" if padre else bloque["titulo"]
                salida = []
                pre = cuerpo[:cts[0][0]]
                if len(texto_de(pre)) > 400:
                    salida.append(({"titulo": bloque["titulo"], "p1": bloque["p1"],
                                    "p2": pre[-1]["pg"], "lineas": pre}, padre))
                for s in subs:
                    salida.extend(explotar(s, nuevo_padre, prof + 1))
                return salida
    return [(bloque, padre)]

# ---------------------------------------------------------------- pipeline

def procesar(doc):
    lineas = leer_lineas(doc["archivo"])
    tablas = extraer_tablas(doc["archivo"])
    # Las que viven como imagen: transcritas a mano, se suman a las extraidas.
    for pg, bloques in tablas_de_imagen(doc["id"]).items():
        tablas.setdefault(pg, []).extend(bloques)
    regla = doc["regla"]

    if regla == "clausulas":
        det = lambda t: (lambda m: f"Cláusula {m.group(1)} — {m.group(2).strip().title()}" if m else None)(R["clausula"].match(t))
        cts = cortes(lineas, det, bold=True)
    elif regla == "articulos":
        anotar_contexto(lineas)   # ambito / categoria de vehiculo / uso
        det = lambda t: (lambda m: f"Artículo {m.group(1)} — {m.group(2).strip().title()}" if m else None)(R["articulo"].match(t))
        cts = cortes(lineas, det)
    elif regla == "guia":
        def det(t):
            m = R["num2"].match(t)
            if m: return f"{m.group(1)} {m.group(2).strip()}"
            m = R["num1"].match(t)
            if m: return f"{m.group(1)}. {m.group(2).strip().title()}"
            return None
        cts = cortes(lineas, det)
    else:
        det = lambda t: (lambda m: m.group(1).strip().title() if m and not RUIDO.match(t) else None)(R["mayus"].match(t))
        cts = cortes(lineas, det)

    hojas = []
    for b in partir(lineas, cts):
        hojas.extend(explotar(b, None))

    secciones, n = [], 0
    for b, padre in hojas:
        txt = texto_de(b["lineas"])
        if len(txt) < MIN_SEC:
            continue
        # adjuntar las tablas de las paginas que abarca la seccion
        adj = []
        for pg in range(b["p1"], b["p2"] + 1):
            adj.extend(tablas.get(pg, []))
        if adj:
            txt = txt + "\n\n" + "\n\n".join(dict.fromkeys(adj))
        n += 1
        tit = b["titulo"]
        # Si la seccion nace bajo un encabezado calificador (ambito / categoria
        # de vehiculo / uso), va en el titulo: sin eso tres "PLAN BASICO" con
        # limites distintos se llaman igual y son indistinguibles en el indice.
        ctx = b["lineas"][0].get("ctx", "") if b["lineas"] else ""
        if ctx and ctx.lower() not in tit.lower():
            tit = f"{ctx} · {tit}"
        secciones.append({
            "id": f"{doc['id']}-s{n:03d}",
            "documento": doc["id"],
            "version": doc["version"],
            "titulo": tit,
            "titulo_padre": padre,
            "contexto": ctx or None,
            "ruta": f"{padre} › {tit}" if padre else tit,
            "pagina_desde": b["p1"],
            "pagina_hasta": b["p2"],
            "categoria": categorizar(tit, txt, padre),
            "resumen": resumen(txt),
            "palabras_clave": palabras_clave((padre or "") + " " + tit, txt),
            "tiene_tabla": bool(adj),
            "texto": txt,
        })
    return secciones


if __name__ == "__main__":
    corpus = {"version_corpus": "2026-07-28", "documentos": [], "secciones": []}
    for doc in DOCUMENTOS:
        secs = procesar(doc)
        meta = {k: v for k, v in doc.items() if k not in ("archivo", "regla")}
        meta["archivo"] = doc["archivo"].replace(BASE, "")
        meta["estado"] = "vigente"
        meta["secciones"] = len(secs)
        corpus["documentos"].append(meta)
        corpus["secciones"].extend(secs)
        tam = sorted(len(s["texto"]) for s in secs) or [0]
        con_tabla = sum(1 for s in secs if s["tiene_tabla"])
        print(f"{doc['id']:18} {len(secs):4} secc | mediana {tam[len(tam)//2]:5} | max {tam[-1]:6} | >8k: {sum(1 for t in tam if t>8000)} | con tabla: {con_tabla}")

    out = f"{BASE}/netlify/functions/data/corpus.json"
    json.dump(corpus, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    S = corpus["secciones"]
    idx = sum(len(s["ruta"]) + len(s["resumen"]) + len(" ".join(s["palabras_clave"])) for s in S)
    print(f"\nTOTAL {len(S)} secciones | indice ~{idx//4} tokens | texto total {sum(len(s['texto']) for s in S)} chars")
