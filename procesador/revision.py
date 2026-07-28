# -*- coding: utf-8 -*-
"""Genera una pagina HTML para que JC revise el seccionado del corpus."""
import json, html, collections

BASE = r"C:/Users/segur/COTIZADOR-AUTOS"

C = json.load(open(r"C:/Users/segur/COTIZADOR-AUTOS/netlify/functions/data/corpus.json", encoding="utf-8"))
S = C["secciones"]
DOCS = {d["id"]: d for d in C["documentos"]}

COL = {"cobertura":"#0d9488","exclusion":"#dc2626","deducible":"#b45309","limite":"#7c3aed",
       "requisito":"#0369a1","procedimiento":"#4338ca","definicion":"#64748b","asistencia":"#059669",
       "obligacion":"#be185d","asegurabilidad":"#c2410c","general":"#94a3b8"}

def chip(c):
    return f'<span class="cat" style="background:{COL.get(c,"#94a3b8")}">{c}</span>'

filas = []
for did, d in DOCS.items():
    subset = [s for s in S if s["documento"] == did]
    if not subset:
        continue
    cats = collections.Counter(s["categoria"] for s in subset)
    filas.append(f'''<section>
      <h2>{html.escape(d["titulo"])}</h2>
      <p class="meta">{d.get("version","")} · {len(subset)} secciones ·
         {sum(1 for s in subset if s["tiene_tabla"])} con tabla ·
         {"NO publico" if not d.get("publico") else "publico"}</p>
      <p class="meta">{" ".join(f"{chip(c)}<small>{n}</small>" for c,n in cats.most_common())}</p>
      <table><thead><tr><th>Pág.</th><th>Sección</th><th>Categoría</th><th>Tam.</th></tr></thead><tbody>''')
    for s in subset:
        n = len(s["texto"])
        alerta = ' class="big"' if n > 8000 else (' class="tiny"' if n < 200 else "")
        tab = ' <span class="tab">tabla</span>' if s["tiene_tabla"] else ""
        ruta = html.escape(s["ruta"])
        if s["titulo_padre"]:
            ruta = f'<small class="padre">{html.escape(s["titulo_padre"])} ›</small><br>{html.escape(s["titulo"])}'
        filas.append(f'''<tr{alerta}><td class="pg">{s["pagina_desde"]}{"-"+str(s["pagina_hasta"]) if s["pagina_hasta"]!=s["pagina_desde"] else ""}</td>
          <td>{ruta}{tab}<div class="res">{html.escape(s["resumen"][:150])}</div></td>
          <td>{chip(s["categoria"])}</td><td class="num">{n:,}</td></tr>''')
    filas.append("</tbody></table></section>")

grandes = sorted([s for s in S if len(s["texto"]) > 8000], key=lambda x: -len(x["texto"]))
aviso = "".join(f'<li><b>{html.escape(s["ruta"][:75])}</b> — {s["documento"]} pág. {s["pagina_desde"]}-{s["pagina_hasta"]}, {len(s["texto"]):,} caracteres</li>' for s in grandes)

HTML = f"""<meta charset="utf-8"><title>Revisión del corpus — Consultor de Autos</title>
<style>
 body{{font:15px/1.55 -apple-system,Segoe UI,sans-serif;margin:0;background:#f8fafc;color:#0f172a}}
 header{{background:#0f172a;color:#fff;padding:26px 32px}}
 header h1{{margin:0 0 6px;font-size:21px}} header p{{margin:0;opacity:.8;font-size:14px}}
 main{{max-width:1150px;margin:0 auto;padding:24px 20px 60px}}
 section{{background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 22px;overflow:hidden}}
 h2{{font-size:16px;margin:0;padding:15px 18px;background:#f1f5f9;border-bottom:1px solid #e2e8f0}}
 .meta{{margin:8px 18px;color:#64748b;font-size:13px}}
 table{{width:100%;border-collapse:collapse;font-size:13.5px}}
 th{{text-align:left;padding:8px 12px;background:#f8fafc;border-bottom:2px solid #e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}}
 td{{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}}
 tr:hover{{background:#fafcff}}
 .pg{{color:#64748b;white-space:nowrap;font-variant-numeric:tabular-nums}}
 .num{{text-align:right;color:#64748b;font-variant-numeric:tabular-nums;white-space:nowrap}}
 .res{{color:#94a3b8;font-size:12.5px;margin-top:3px;max-width:640px}}
 .padre{{color:#94a3b8;font-size:11.5px}}
 .cat{{color:#fff;padding:2px 7px;border-radius:4px;font-size:11px;white-space:nowrap}}
 .tab{{background:#1e293b;color:#fff;padding:1px 6px;border-radius:4px;font-size:10.5px;margin-left:6px}}
 tr.big{{background:#fff7ed}} tr.big .num{{color:#c2410c;font-weight:600}}
 tr.tiny{{background:#f8fafc}} tr.tiny .num{{color:#94a3b8}}
 .aviso{{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin:0 0 22px}}
 .aviso h3{{margin:0 0 8px;font-size:14px;color:#9a3412}} .aviso ul{{margin:0;padding-left:20px;font-size:13px;color:#7c2d12}}
 .aviso li{{margin:3px 0}}
</style>
<header>
 <h1>Revisión del corpus — Consultor de Autos</h1>
 <p>{len(S)} secciones · {sum(1 for s in S if s['tiene_tabla'])} con tabla adjunta · 6 documentos · 279 páginas · 28 jul 2026</p>
</header>
<main>
 <div class="aviso"><h3>Secciones que quedaron grandes ({len(grandes)}) — decidí si te molestan</h3><ul>{aviso}</ul></div>
 {''.join(filas)}
</main>"""

out = f"{BASE}/procesador/revision-corpus.html"
open(out, "w", encoding="utf-8").write(HTML)
print("escrito:", out, len(HTML), "bytes")
