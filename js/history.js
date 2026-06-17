/**
 * Cotizador SDI · Historial de cotizaciones enviadas
 *
 * Guarda en localStorage los metadatos de cada cotizacion enviada
 * (cliente, placa, correo, URL del explicador) para que el agente pueda
 * dar seguimiento — la cotizacion del INS vence a los 15 dias.
 *
 * NO guarda el PDF (excederia la cuota de localStorage). Reenviar una
 * cotizacion requiere volver a subir el PDF original.
 *
 * API publica:
 *   - loadHistory()              -> Array<entry>
 *   - saveHistoryEntry(e)        -> void   (unshift + cap 100)
 *   - clearHistory()             -> void
 *   - buildWaShareUrl(entry)     -> string URL de WhatsApp con la guia
 *   - buildWaFollowUpUrl(entry)  -> string URL de WhatsApp de seguimiento
 *   - newHistoryId()             -> string id estable para una entrada
 *   - ensureHistoryIds()         -> Array<entry> (migra ids a entradas viejas)
 *   - historyEstado(e)           -> 'pendiente'|'agendada'|'concretada'|'desechada'
 *   - setHistoryEstado(id,e[,cita])-> bool (cambia el estado del ciclo de vida)
 *   - setHistoryConfirmed(id,b)  -> bool  (back-compat → concretada/pendiente)
 *   - historyCitaHoy(e)          -> bool  (agendada con citaFecha = hoy)
 *   - deleteHistoryEntry(id)     -> bool  (elimina un registro por id)
 *   - historyEntryValue(entry)   -> number (valor asegurado, recuperable del link)
 *   - computeHistoryStats(arr)   -> { total, agendada, concretada, desechada, rate }  (pura)
 *   - groupHistoryByMonth(arr)   -> [{ key, label, entries, stats }]  (pura)
 *   - historyDaysSince(e[,now])  -> number dias desde el envio (o null)
 *   - historyNeedsFollowUp(e)    -> bool  (pendiente, >3d, sin follow-up, vigente)
 *   - setHistoryFollowUp(id[,iso])-> bool (marca que se envio el seguimiento)
 *   - historyFollowUpState(e)    -> 'seguir'|'seguido'|null (solo pendientes)
 *
 * Forma de entry:
 *   { id, date: ISO string, client, email, plate, vehicle, quote,
 *     valor, estado, citaFecha, confirmed, followUpAt, guideUrl, waCliente }
 *   - valor      : valor asegurado del vehiculo (para filtro de alto valor).
 *                  Entradas viejas no lo traen: se recupera del param `va` del guideUrl.
 *   - estado     : ciclo de vida 'pendiente'|'agendada'|'concretada'|'desechada'
 *                  (default 'pendiente'). Entradas legacy con confirmed:true → 'concretada'.
 *   - citaFecha  : YYYY-MM-DD de la cita (solo cuando estado === 'agendada').
 *   - confirmed  : back-compat; se mantiene en sync (true sii estado === 'concretada').
 *   - followUpAt : ISO de cuando se envio el (unico) correo de seguimiento.
 *                  Una vez puesto, la cotizacion no vuelve a aparecer en el aviso.
 */

const HISTORY_KEY = 'cotizador_sdi_history_v1';
const HISTORY_MAX = 100;

/**
 * Lee el historial guardado. Devuelve [] ante cualquier problema.
 * @returns {Array<object>}
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[history] error leyendo localStorage:', e);
    return [];
  }
}

/**
 * Agrega una entrada al inicio del historial (mas reciente primero).
 * Nunca lanza — si localStorage falla, el envio del correo no se ve afectado.
 * @param {object} entry
 */
function saveHistoryEntry(entry) {
  try {
    const arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('[history] no se pudo guardar la entrada:', e);
  }
}

/**
 * Borra todo el historial.
 */
function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn('[history] error borrando localStorage:', e);
  }
}

/**
 * URL para compartir la guia explicada por WhatsApp.
 * SIEMPRE web.whatsapp.com/send/ — wa.me corrompe los emojis del mensaje.
 * Si hay telefono (phoneOverride o entry.waCliente): abre el chat directo
 * del cliente. Sin telefono: WhatsApp abre el selector de chat del agente.
 * @param {object} entry - entrada del historial
 * @param {string} [phoneOverride] - WhatsApp del cliente; pisa entry.waCliente
 * @returns {string}
 */
function buildWaShareUrl(entry, phoneOverride) {
  // Nombre del agente: de la entrada, o del CFG global (mismo navegador), o genérico.
  const agente = entry.agentName || (typeof CFG !== 'undefined' && CFG.FROM_NAME) || '';
  const intro  = agente
    ? 'te escribe ' + agente + ', agente de seguros del INS. '
    : 'te escribe tu agente de seguros del INS. ';
  // El link va EMBEBIDO en la frase (texto antes y después). WhatsApp no
  // permite enmascarar URLs en mensajes de texto, así que se muestra completa
  // pero queda dentro del cuerpo, no suelta al final.
  const msg = 'Hola ' + (entry.client || '') + ', ' + intro
    + 'Te acabo de enviar por correo la cotización de tu '
    + (entry.vehicle || 'vehículo')
    + (entry.plate ? ' (placa ' + entry.plate + ')' : '')
    + '. Para que la veás con todo el detalle, te preparé una guía explicada paso a paso que podés abrir en este enlace: '
    + entry.guideUrl
    + ' — cualquier consulta, quedo a la orden.';
  const raw = String(phoneOverride != null ? phoneOverride : (entry.waCliente || '')).replace(/\D/g, '');
  let phone = '';
  if (raw) phone = raw.startsWith('506') ? raw : '506' + raw;
  return 'https://web.whatsapp.com/send/?'
    + (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(msg);
}

/**
 * Guarda el WhatsApp del cliente en la entrada mas reciente del historial,
 * para que el boton 💬 del modal 🕘 tambien abra el chat directo.
 * Se llama una sola vez (al compartir), no en cada tecla.
 * @param {string} waCliente - numero tal cual lo escribio el agente
 */
function setLatestHistoryWa(waCliente) {
  try {
    const arr = loadHistory();
    if (arr.length && waCliente) {
      arr[0].waCliente = waCliente;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    }
  } catch (e) {
    console.warn('[history] no se pudo actualizar waCliente:', e);
  }
}

// =====================================================================
// ESTADISTICAS (pestaña 📊): id estable, estado confirmada, valor, metricas
// =====================================================================

/**
 * Genera un id estable para una entrada del historial. Sirve para marcar
 * una cotizacion como confirmada sin depender del indice del array (que se
 * corre cuando entra una cotizacion nueva con unshift).
 * @returns {string}
 */
function newHistoryId() {
  return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Convierte a numero un valor que puede venir como "10,000,000.00" (formato
 * del PDF del INS) o "10000000" (param `va` ya normalizado). Las comas son
 * separador de miles y el punto el decimal — se quitan las comas y se parsea.
 * @param {string|number} v
 * @returns {number} 0 si no es parseable
 */
function _toNumber(v) {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : 0;
}

/**
 * Valor asegurado (colones) de una entrada.
 *   1. Entradas nuevas: campo e.valor.
 *   2. Entradas viejas (sin e.valor): se recupera del parametro `va` que el
 *      link de la guia (e.guideUrl) ya guardo al momento de enviar.
 * @param {object} e
 * @returns {number} 0 si no se puede determinar
 */
function historyEntryValue(e) {
  if (!e) return 0;
  if (e.valor !== undefined && e.valor !== null && String(e.valor).trim() !== '') {
    const n = _toNumber(e.valor);
    if (n > 0) return n;
  }
  if (e.guideUrl) {
    const m = String(e.guideUrl).match(/[?&]va=([^&]+)/);
    if (m) {
      const n = _toNumber(decodeURIComponent(m[1]));
      if (n > 0) return n;
    }
  }
  return 0;
}

/**
 * Asegura que toda entrada tenga un id estable. Migracion perezosa: las
 * entradas nuevas ya nacen con id; esto cubre el historial previo a la
 * feature. Persiste solo si hubo cambios.
 * @returns {Array<object>} el historial (con ids garantizados)
 */
function ensureHistoryIds() {
  try {
    const arr = loadHistory();
    let changed = false;
    arr.forEach(function (e) {
      if (e && !e.id) { e.id = newHistoryId(); changed = true; }
    });
    if (changed) localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    return arr;
  } catch (e) {
    console.warn('[history] no se pudieron asignar ids:', e);
    return loadHistory();
  }
}

/**
 * Marca/desmarca una cotizacion como confirmada (el cliente compro la poliza).
 * @param {string} id        - id estable de la entrada
 * @param {boolean} confirmed
 * @returns {boolean} true si se encontro y guardo
 */
/**
 * Cambia el estado del ciclo de vida de una cotización.
 * @param {string} id
 * @param {string} estado - 'pendiente' | 'agendada' | 'concretada' | 'desechada'
 * @param {string} [citaFecha] - YYYY-MM-DD; solo se guarda cuando estado === 'agendada'.
 * @returns {boolean} true si se encontró y guardó
 */
function setHistoryEstado(id, estado, citaFecha) {
  if (!id) return false;  // sin id, find(undefined) matchearía una entrada legacy equivocada
  try {
    const arr = loadHistory();
    const e = arr.find(function (x) { return x && x.id === id; });
    if (!e) return false;
    e.estado = estado;
    e.confirmed = (estado === 'concretada');  // back-compat con lecturas viejas
    if (estado === 'agendada') {
      if (citaFecha) e.citaFecha = citaFecha;
    } else {
      delete e.citaFecha;  // al salir de 'agendada' no queda fecha de cita vieja latente
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    return true;
  } catch (err) {
    console.warn('[history] no se pudo actualizar el estado:', err);
    return false;
  }
}

/** Back-compat: marca concretada/pendiente. Para el resto usar setHistoryEstado. */
function setHistoryConfirmed(id, confirmed) {
  return setHistoryEstado(id, confirmed ? 'concretada' : 'pendiente');
}

/**
 * Elimina una cotización del historial por su id estable. Útil para borrar
 * registros de prueba / duplicados desde la pestaña 📊. Permanente (no hay
 * papelera) — la UI pide confirmación antes de llamar.
 * @param {string} id
 * @returns {boolean} true si se encontró y eliminó
 */
function deleteHistoryEntry(id) {
  if (!id) return false;  // sin id, findIndex(undefined) borraría una entrada legacy equivocada
  try {
    const arr = loadHistory();
    const idx = arr.findIndex(function (x) { return x && x.id === id; });
    if (idx === -1) return false;
    arr.splice(idx, 1);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.warn('[history] no se pudo eliminar la entrada:', e);
    return false;
  }
}

/**
 * Marca que se envió el correo de seguimiento de una cotización (el único).
 * A partir de aquí ya no aparece en el aviso de seguimientos pendientes.
 * @param {string} id
 * @param {string} [iso] - timestamp ISO; default ahora.
 * @returns {boolean} true si se encontró y guardó
 */
function setHistoryFollowUp(id, iso) {
  if (!id) return false;  // sin id, find(undefined) marcaría una entrada legacy equivocada
  try {
    const arr = loadHistory();
    const e = arr.find(function (x) { return x && x.id === id; });
    if (!e) return false;
    e.followUpAt = iso || new Date().toISOString();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    return true;
  } catch (err) {
    console.warn('[history] no se pudo marcar el seguimiento:', err);
    return false;
  }
}

/**
 * Estado del ciclo de vida de una cotización: 'pendiente' | 'agendada' |
 * 'concretada' | 'desechada'. Migración tolerante de entradas legacy: las que
 * solo tienen confirmed:true se leen como 'concretada'; el resto, 'pendiente'.
 * @param {object} e
 * @returns {string}
 */
function historyEstado(e) {
  if (!e) return 'pendiente';
  if (e.estado) return e.estado;
  return e.confirmed ? 'concretada' : 'pendiente';
}

/**
 * Metricas de un conjunto de cotizaciones. PURA: no toca localStorage —
 * recibe el array y devuelve los numeros (asi es testeable en Node).
 * @param {Array<object>} entries
 * @returns {{total, agendada, concretada, desechada, rate:(number|null)}}
 *          rate = tasa de CIERRE: concretada / (concretada + desechada), con 1
 *          decimal, o null si aún no hay resueltas (para mostrar "—"). Las
 *          pendientes y agendadas NO cuentan (siguen en juego).
 */
function computeHistoryStats(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let agendada = 0, concretada = 0, desechada = 0;
  list.forEach(function (e) {
    const st = historyEstado(e);
    if (st === 'agendada') agendada++;
    else if (st === 'concretada') concretada++;
    else if (st === 'desechada') desechada++;
  });
  const den = concretada + desechada;
  const rate = den > 0 ? Math.round((concretada / den) * 1000) / 10 : null;
  return { total: list.length, agendada: agendada, concretada: concretada, desechada: desechada, rate: rate };
}

/**
 * Clave de mes (YYYY-MM) de una entrada segun entry.date. 'sin-fecha' si falta.
 * @param {object} e
 * @returns {string}
 */
function historyMonthKey(e) {
  const d = (e && e.date) ? new Date(e.date) : null;
  if (!d || isNaN(d.getTime())) return 'sin-fecha';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * Agrupa cotizaciones por mes, del mas reciente al mas viejo. PURA.
 * @param {Array<object>} entries
 * @returns {Array<{key:string,label:string,entries:Array,stats:object}>}
 */
function groupHistoryByMonth(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const map = {};
  list.forEach(function (e) {
    const key = historyMonthKey(e);
    (map[key] = map[key] || []).push(e);
  });
  return Object.keys(map).sort().reverse().map(function (key) {
    let label = 'Sin fecha';
    if (key !== 'sin-fecha') {
      const d = new Date(key + '-01T12:00:00');
      label = d.toLocaleDateString('es-CR', { month: 'short', year: 'numeric' });
    }
    return { key: key, label: label, entries: map[key], stats: computeHistoryStats(map[key]) };
  });
}

/**
 * Días transcurridos desde el envío de una cotización (entero, hacia abajo).
 * @param {object} e
 * @param {number} [nowMs] - timestamp de referencia (default Date.now()); para tests.
 * @returns {number|null} null si la entrada no tiene fecha válida.
 */
function historyDaysSince(e, nowMs) {
  const sent = (e && e.date) ? new Date(e.date) : null;
  if (!sent || isNaN(sent.getTime())) return null;
  const now = (nowMs != null) ? nowMs : Date.now();
  return Math.floor((now - sent.getTime()) / 86400000);
}

/**
 * ¿La cotización necesita seguimiento? = enviada hace MÁS de 3 días, SIN
 * confirmar y todavía vigente (dentro de los 15 días que vale la cotización
 * INS). Las recién enviadas (≤3d), las confirmadas y las vencidas quedan fuera.
 * @param {object} e
 * @param {number} [nowMs]
 * @returns {boolean}
 */
function historyNeedsFollowUp(e, nowMs) {
  if (historyEstado(e) !== 'pendiente') return false;  // agendada/concretada/desechada salen del flujo
  const d = historyDaysSince(e, nowMs);
  if (d == null) return false;
  return d > 3 && d < 15 && !(e && e.followUpAt);
}

/**
 * Estado de seguimiento de una cotización PENDIENTE (para la insignia en 📊):
 *   'seguir'  → +3d, aún vigente y SIN seguimiento previo.
 *   'seguido' → ya se envió el (único) seguimiento.
 *   null      → no es pendiente, recién enviada, o sin fecha.
 * (Las agendadas/concretadas/desechadas no tienen flujo de seguimiento.)
 * @param {object} e
 * @param {number} [nowMs]
 * @returns {string|null}
 */
function historyFollowUpState(e, nowMs) {
  if (historyEstado(e) !== 'pendiente') return null;
  if (historyNeedsFollowUp(e, nowMs)) return 'seguir';
  if (e && e.followUpAt) return 'seguido';
  return null;
}

/**
 * ¿La cotización tiene cita agendada para HOY? (estado 'agendada' + citaFecha = hoy local).
 * @param {object} e
 * @param {number} [nowMs] - referencia para "hoy" (default Date.now()); para tests.
 * @returns {boolean}
 */
function historyCitaHoy(e, nowMs) {
  if (!e || historyEstado(e) !== 'agendada' || !e.citaFecha) return false;
  const now = (nowMs != null) ? new Date(nowMs) : new Date();
  const hoy = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return String(e.citaFecha).slice(0, 10) === hoy;
}

/**
 * URL de WhatsApp para un mensaje de SEGUIMIENTO (distinto al de compartir la
 * guia): pregunta al cliente si pudo revisar la cotizacion. Mismo endpoint
 * web.whatsapp.com/send/ — wa.me corrompe los emojis.
 * @param {object} entry
 * @param {string} [phoneOverride] - pisa entry.waCliente
 * @returns {string}
 */
function buildWaFollowUpUrl(entry, phoneOverride) {
  const agente = entry.agentName || (typeof CFG !== 'undefined' && CFG.FROM_NAME) || '';
  const firma  = agente ? ' ' + agente + ', su agente de seguros del INS.' : ' su agente de seguros del INS.';
  const msg = 'Hola ' + (entry.client || '') + ', le saluda' + firma
    + ' Días atrás le envié por correo la cotización de su '
    + (entry.vehicle || 'vehículo')
    + '. ¿Tuvo chance de revisarla? Con gusto le aclaro cualquier duda o le ayudo a avanzar con la póliza cuando lo desee. Quedo atento. 🙂';
  const raw = String(phoneOverride != null ? phoneOverride : (entry.waCliente || '')).replace(/\D/g, '');
  let phone = '';
  if (raw) phone = raw.startsWith('506') ? raw : '506' + raw;
  return 'https://web.whatsapp.com/send/?'
    + (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(msg);
}
