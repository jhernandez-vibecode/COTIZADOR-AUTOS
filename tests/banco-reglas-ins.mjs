/**
 * Banco de pruebas del Consultor — derivado de docs/fuentes-ins/REGLAS-INS-VERIFICADAS.md
 *
 * Esas reglas las verifico JC a mano en junio 2026 contra los PDF oficiales, y ese
 * trabajo detecto un error real en produccion (el formulario decia "G = Asistencia
 * legal" cuando G es Multiasistencia y la legal es la E). Aca quedan como test
 * automatico para que un reprocesado del corpus no las rompa en silencio.
 *
 * QUE COMPRUEBA: que la respuesta correcta EXISTE en el corpus y que el buscador
 * literal la alcanza. Es la mitad verificable sin sesion de Google.
 * QUE NO COMPRUEBA: la redaccion final del modelo — eso lo valida JC usando la app.
 *
 *   node tests/banco-reglas-ins.mjs
 */
process.chdir(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
import { readFile } from "node:fs/promises";
const { buscarLiteral } = await import("../netlify/functions/consultar.mjs");

const c = JSON.parse(await readFile("netlify/functions/data/corpus.json", "utf-8"));
c._porId = new Map(c.secciones.map((s) => [s.id, s]));

/**
 * pregunta  — como la escribiria JC
 * espera    — texto que DEBE aparecer en alguna seccion recuperada (la respuesta real)
 * ruta      — patron que debe matchear la ruta de alguna seccion recuperada
 * fuente    — de donde sale la regla, para poder auditarla a mano
 */
const BANCO = [
  {
    pregunta: "¿Qué cubre la cobertura E?",
    espera: /gastos\s+legales/i,
    ruta: /cobertura\s*["“']?E/i,
    fuente: "CG págs 14-24 · E = Gastos Legales, NO 'asistencia legal' genérica",
  },
  {
    pregunta: "¿Qué cubre la cobertura G?",
    espera: /multiasistencia/i,
    ruta: /cobertura\s*["“']?G/i,
    fuente: "CG págs 14-24 · G = Multiasistencia (carretera), NO legal",
  },
  {
    pregunta: "¿Hasta qué antigüedad cubre la batería de alta tensión de un vehículo eléctrico?",
    espera: /nueve\s*\(?9\)?\s*años|9\s*años/i,
    ruta: /bater|el[eé]ctric/i,
    fuente: "CG pág 34 punto v · sin cobertura desde los 9 años (108 meses)",
  },
  {
    pregunta: "¿Qué porcentaje de aseguramiento tiene la batería a los 60 meses?",
    espera: /60\s*%|49\s*a\s*72/i,
    ruta: /bater|depreciaci|el[eé]ctric/i,
    fuente: "CG pág 54 · 49-72 meses = 60%",
  },
  {
    pregunta: "¿Cuánto me devuelven si cancelo la póliza a los 3 días?",
    espera: /100\s*%|cinco\s*\(?5\)?\s*d[ií]as/i,
    ruta: /cancelaci|cl[aá]usula\s*33/i,
    fuente: "CG págs 58-59 Cláusula 33 · ≤5 días naturales = 100%",
  },
  {
    pregunta: "¿Cuánto me devuelven si cancelo la póliza a los 4 meses?",
    espera: /50\s*%/i,
    ruta: /cancelaci|cl[aá]usula\s*33/i,
    fuente: "CG págs 58-59 Cláusula 33 · >5 días y <6 meses = factor × 50%",
  },
  {
    pregunta: "¿Cuántos eventos de grúa cubre el plan básico?",
    espera: /m[aá]ximo\s*\d+\s*eventos/i,
    ruta: /plan\s*b[aá]sico/i,
    fuente: "C.O. Multiasistencia · varía por categoría de vehículo (3 particular, 2 moto)",
  },
  {
    pregunta: "¿Cuáles son los requisitos para asegurar un vehículo diplomático?",
    espera: /cuerpo\s+diplom[aá]tico|misi[oó]n\s+diplom[aá]tica/i,
    ruta: /./,
    fuente: "Guía pág 86 · placas MI/MD/CD — el caso que el índice solo no encontraba",
  },
];

let fallos = 0;
console.log(`Banco de reglas INS · ${BANCO.length} casos · corpus ${c.version_corpus}\n`);

for (const caso of BANCO) {
  const ids = buscarLiteral(caso.pregunta, c, 12);
  const secs = ids.map((id) => c._porId.get(id));

  const conTexto = secs.filter((s) => caso.espera.test(s.texto));
  const conRuta = secs.filter((s) => caso.ruta.test(s.ruta));
  const ok = conTexto.length > 0 && conRuta.length > 0;
  if (!ok) fallos++;

  console.log(`${ok ? "OK  " : "MAL "} ${caso.pregunta}`);
  console.log(`     ${caso.fuente}`);
  if (ok) {
    const s = conTexto.find((x) => caso.ruta.test(x.ruta)) || conTexto[0];
    console.log(`     → ${s.documento} pág ${s.pagina_desde} · ${s.ruta.slice(0, 66)}`);
  } else {
    console.log(`     → recuperó ${secs.length} secciones; con la respuesta: ${conTexto.length}, con la ruta: ${conRuta.length}`);
    for (const s of secs.slice(0, 3)) console.log(`       (${s.documento} p${s.pagina_desde} ${s.ruta.slice(0, 52)})`);
  }
  console.log();
}

console.log("=".repeat(70));
console.log(fallos ? `${fallos} de ${BANCO.length} FALLARON` : `Los ${BANCO.length} casos pasan`);
process.exit(fallos ? 1 : 0);
