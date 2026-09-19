/** Tests del limite de envios. Store simulado en memoria. node tests/test-cita-limite.mjs */
import { huella, cubeta, permitir, esDuplicado } from '../netlify/functions/lib/cita-limite.mjs';

let pass = 0, fail = 0;
function ok(n, c) { if (c) pass++; else { fail++; console.error('FAIL ' + n); } }
const mem = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? m.get(k) : null), set: async (k, v) => { m.set(k, v); }, _m: m }; };

ok('la huella no contiene el dato', huella('mariela@ejemplo.test').indexOf('mariela') === -1 && huella('a').length === 22);
ok('misma entrada, misma huella', huella('x') === huella('x') && huella('x') !== huella('y'));
ok('la cubeta es por hora', cubeta(new Date('2026-09-18T16:59:59Z')) === '2026-09-18T16' && cubeta(new Date('2026-09-18T17:00:00Z')) === '2026-09-18T17');

const s = mem();
ok('deja pasar hasta el tope', (await permitir(s, 'k', 2)) && (await permitir(s, 'k', 2)));
ok('corta al pasar el tope', (await permitir(s, 'k', 2)) === false);
ok('otra clave no se ve afectada', await permitir(s, 'k2', 2));
ok('el store nunca guarda datos del cliente', [...s._m.keys()].every((k) => !/@|ejemplo/.test(k)));

const s2 = mem(); const t0 = new Date('2026-09-18T16:00:00Z');
ok('primera vez no es duplicado', (await esDuplicado(s2, 'h1', t0)) === false);
ok('a los 30 s SI es duplicado', (await esDuplicado(s2, 'h1', new Date(t0.getTime() + 30000))) === true);
ok('a los 61 s ya no', (await esDuplicado(s2, 'h1', new Date(t0.getTime() + 61000))) === false);

console.log(pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
