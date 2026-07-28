/** Prueba la busqueda literal contra el corpus real, sin llamar a la API. */
process.chdir("C:/Users/segur/COTIZADOR-AUTOS");
import { readFile } from "node:fs/promises";
const { buscarLiteral } = await import("file:///C:/Users/segur/COTIZADOR-AUTOS/netlify/functions/consultar.mjs");

const c = JSON.parse(await readFile("netlify/functions/data/corpus.json", "utf-8"));
c._porId = new Map(c.secciones.map((s) => [s.id, s]));

const CASOS = [
  ["cuales son los requisitos para asegurar un vehiculo diplomatico", ["guia-2026", "cg-sva"]],
  ["¿Qué cubre la cobertura E?", ["cg-sva"]],
  ["¿Cuántos eventos de grúa cubre el plan básico?", ["multiasistencia"]],
  ["Devolución si cancelo a los 4 meses", ["cg-sva"]],
  ["¿Un pick-up del 2008 es asegurable con cobertura D?", ["guia-2026", "cg-sva"]],
  ["batería de alta tensión de un vehículo eléctrico", ["cg-sva"]],
  ["cuál es la capital de Francia", []],
];

let ok = 0;
for (const [pregunta, esperados] of CASOS) {
  const ids = buscarLiteral(pregunta, c, 8);
  const docs = [...new Set(ids.map((id) => c._porId.get(id).documento))];
  const acierta = esperados.length === 0 ? ids.length <= 2 : esperados.some((d) => docs.includes(d));
  if (acierta) ok++;
  console.log(`\n${acierta ? "OK  " : "MAL "} ${pregunta}`);
  console.log(`     ${ids.length} candidatos · docs: ${docs.join(", ") || "(ninguno)"}`);
  for (const id of ids.slice(0, 3)) {
    const s = c._porId.get(id);
    console.log(`       p${s.pagina_desde} ${s.documento} | ${s.ruta.slice(0, 62)}`);
  }
}
console.log(`\n${"=".repeat(66)}\n${ok} de ${CASOS.length} casos bien`);
