/**
 * Horario de oficina y siguiente dia habil (lib/horario.mjs, 5 nov 2026).
 * Lunes a viernes de 8:00 am a 5:00 pm, hora de Costa Rica (UTC-6), sin feriados obligatorios.
 * Run: node tests/test-horario.mjs
 */
import { siguienteHabil, esFeriado } from '../netlify/functions/lib/horario.mjs';

let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok    ' + n); } else { fail++; console.log('  FALLA ' + n); } }
// Hora de Costa Rica → instante (UTC = CR + 6 h)
const cr = (s) => new Date(new Date(s + 'Z').getTime() + 6 * 3600e3);
const t = (s) => siguienteHabil(cr(s));

console.log('-- en horario --');
ok('martes 10:15 am → hoy', t('2026-11-10T10:15').enHorario && t('2026-11-10T10:15').cuando === 'hoy');
ok('lunes 8:00 am en punto → en horario', t('2026-11-09T08:00').enHorario);
ok('viernes 4:59 pm → en horario', t('2026-11-06T16:59').enHorario);

console.log('-- fuera de horario --');
ok('viernes 5:00 pm → el lunes', !t('2026-11-06T17:00').enHorario && t('2026-11-06T17:00').cuando === 'el lunes 9 de noviembre');
ok('sabado 7:40 pm → el lunes', t('2026-11-07T19:40').cuando === 'el lunes 9 de noviembre');
ok('domingo → mañana lunes', t('2026-11-08T11:00').cuando === 'mañana lunes 9 de noviembre');
ok('jueves 9:30 pm → mañana viernes', t('2026-11-05T21:30').cuando === 'mañana viernes 6 de noviembre');
ok('martes 6:10 am → hoy a partir de las 8', !t('2026-11-10T06:10').enHorario && t('2026-11-10T06:10').cuando === 'hoy martes 10 de noviembre, a partir de las 8:00 am');
ok('la hora es la de Costa Rica, no la UTC (jueves 4:30 pm CR = 22:30 UTC)', siguienteHabil(new Date('2026-11-05T22:30:00Z')).enHorario);

console.log('-- feriados obligatorios --');
ok('30 nov 6 pm → se salta el 1 dic (feriado) → el miercoles 2', t('2026-11-30T18:00').cuando === 'el miércoles 2 de diciembre');
ok('25 dic en horario → fuera (feriado)', !t('2026-12-25T10:00').enHorario);
ok('Jueves y Viernes Santo 2027 (25 y 26 mar)', esFeriado(new Date(Date.UTC(2027, 2, 25))) && esFeriado(new Date(Date.UTC(2027, 2, 26))) && !esFeriado(new Date(Date.UTC(2027, 2, 24))));
ok('miercoles santo 2027 6 pm → el lunes 29 mar', t('2027-03-24T18:00').cuando === 'el lunes 29 de marzo');
ok('2 ago y 12 oct no son obligatorios → habiles', !esFeriado(new Date(Date.UTC(2027, 7, 2))) && !esFeriado(new Date(Date.UTC(2027, 9, 12))));

console.log('\n' + pass + ' ok, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
