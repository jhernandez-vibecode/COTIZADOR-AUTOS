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
 *   - loadHistory()              -> Array<entry>  (CRUDA: incluye lapidas)
 *   - loadHistoryVivas()         -> Array<entry>  (lo que se le muestra al agente)
 *   - saveHistoryEntry(e)        -> void
 *   - clearHistory()             -> void
 *   - buildWaShareUrl(entry)     -> string URL de WhatsApp con la guia
 *   - buildWaFollowUpUrl(entry)  -> string URL de WhatsApp para escribirle al cliente
 *   - newHistoryId()             -> string id estable para una entrada
 *   - ensureHistoryIds()         -> Array<entry> (migra ids a entradas viejas)
 *   - deleteHistoryEntry(id)     -> bool  (elimina un registro por id)
 *   - historyEntryValue(entry)   -> number (valor asegurado, recuperable del link)
 *   - historyEntryPlate(entry)   -> string (placa, recuperable del link)
 *   - historyClientName(entry)   -> string (nombre COMPLETO para mostrar/buscar)
 *   - historyMatchesSearch(e,q)  -> bool   (coincide por placa / cliente / vehiculo)
 *   - historyDaysSince(e[,now])  -> number dias desde el envio (o null)
 *   - historyTienePoliza(e)      -> bool   (se le emitio la poliza)
 *   - esTombstone(e)             -> bool   (registro ya purgado, sin datos)
 *   - marcarPolizaEmitida(datos) -> {marcada,creada,entry}  (la llama /polizas-activas/)
 *   - purgarHistorial([d][,now]) -> {purgadas,meses}  (borra las sin poliza > 90 dias)
 *   - loadResumen()              -> { "YYYY-MM": {cot,pol} } conteo de lo purgado
 *   - mergeResumenes(a,b)        -> object (PURA; se queda con el mayor de cada mes)
 *   - replaceResumen(res)        -> bool
 *   - computeHistoryStats(arr[,extra]) -> { total, conPoliza, rate }  (pura)
 *   - groupHistoryByMonth(arr)   -> [{ key, label, entries, stats }]
 *   - mergeHistories(a,b[,cap])  -> Array (union sin perdida)
 *   - replaceHistory(arr[,cap])  -> bool
 *
 * 🔴 El 9 set 2026 se retiro el ciclo de estados que el agente marcaba a mano
 * (Pendiente/Agendada/Concretada/Desechada) junto con el seguimiento a 3 dias
 * y las citas. Decision de JC: el unico cierre que cuenta es haberle enviado
 * la POLIZA ACTIVA al cliente. Ya no existen historyEstado, setHistoryEstado,
 * setHistoryConfirmed, historyCitaHoy, historyNeedsFollowUp,
 * historyFollowUpState, setHistoryFollowUp ni dismissFollowUp.
 *
 * Forma de entry:
 *   { id, date: ISO string, client, clientFull, email, plate, vehicle, quote,
 *     valor, polizaAt, poliza, origen, updatedAt, guideUrl, waCliente }
 *   - client     : nombre de PILA. Es el del SALUDO — va dentro de los mensajes
 *                  ("Hola Silvia, ..."), no se toca.
 *   - clientFull : nombre COMPLETO tal cual viene del PDF del INS (apellidos
 *                  incluidos). Sirve para MOSTRAR y BUSCAR en el historial y en
 *                  el 📊: con solo el nombre de pila no se podia buscar por
 *                  apellido. Entradas viejas no lo traen -> cae a `client`.
 *   - valor      : valor asegurado del vehiculo (para filtro de alto valor).
 *                  Entradas viejas no lo traen: se recupera del param `va` del guideUrl.
 *   - polizaAt   : ISO de cuando se le envio la POLIZA ACTIVA. Es lo unico que
 *                  marca una cotizacion como cerrada, y lo pone la app sola.
 *                  Una entrada con polizaAt NO se purga nunca.
 *   - poliza     : numero de poliza, si el PDF lo traia.
 *   - origen     : 'poliza' si el cliente nunca cotizo por la app y entro al
 *                  registro directamente por el envio de la poliza.
 *
 * Forma de una LAPIDA (entrada purgada a los 90 dias, ver purgarHistorial):
 *   { id, date, purged: true, updatedAt }  — cero datos del cliente.
 *   Existe solo para que el borrado se propague al respaldo de Drive.
 */

const HISTORY_KEY = 'cotizador_sdi_history_v1';

/**
 * Tope de cotizaciones que se guardan EN EL NAVEGADOR.
 *
 * \🔴 ESTE TOPE NO SE APLICA AL RESPALDO DE DRIVE, Y NO PUEDE VOLVER A
 * APLICARSE. Hasta el 21 ago 2026 valia 100 y lo respetaban tambien
 * mergeHistories y driveBackup: al pasar de 100 cotizaciones, el respaldo
 * automatico fusionaba, recortaba la union y SUBIA ESA LISTA RECORTADA a
 * Drive — o sea, la red de seguridad borraba el respaldo. Asi desaparecio
 * julio 2026 y por eso "Restaurar de Drive" no hacia nada: Drive ya traia
 * las mismas 100 que el navegador. El respaldo es ACUMULATIVO y sin tope.
 *
 * 2000 entradas rondan 1,3 MB de los ~5 MB que da localStorage, y a razon
 * de 1-2 cotizaciones por dia son mas de 3 anios. Si aun asi la cuota se
 * llena, _persistHistory recorta lo mas viejo del navegador — nunca de Drive.
 */
const HISTORY_MAX = 2000;

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
 * El historial SIN las lapidas de las cotizaciones ya purgadas. Es lo que ve
 * el agente: loadHistory() cruda se reserva para el respaldo y la fusion, que
 * SI necesitan las lapidas para que un borrado no vuelva desde Drive.
 * @returns {Array<object>}
 */
function loadHistoryVivas() {
  return loadHistory().filter(function (e) { return !esTombstone(e); });
}

/**
 * Agrega una entrada al inicio del historial (mas reciente primero).
 * Nunca lanza — si localStorage falla, el envio del correo no se ve afectado.
 * @param {object} entry
 */
function saveHistoryEntry(entry) {
  try {
    if (entry && !entry.updatedAt) entry.updatedAt = entry.date || _nowIso();
    const arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
    _persistHistory(arr);
    _afterHistoryChange();
  } catch (e) {
    console.warn('[history] no se pudo guardar la entrada:', e);
  }
}

/**
 * Guarda la lista en localStorage aguantando la cuota llena. Si el navegador
 * no acepta el tamanio, recorta las entradas MAS VIEJAS por mitades hasta que
 * entre, en vez de perder la escritura entera en silencio (que era lo que
 * pasaba antes: un envio nuevo simplemente no quedaba registrado).
 *
 * Lo que se recorta aca se pierde SOLO en este navegador: el respaldo de Drive
 * no tiene tope y lo conserva, asi que se recupera con "Restaurar de Drive".
 *
 * @param {Array<object>} list
 * @returns {Array<object>} la lista efectivamente guardada
 */
function _persistHistory(list) {
  const arr = Array.isArray(list) ? list : [];
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    return arr;
  } catch (e) {
    console.warn('[history] localStorage no acepta el tamanio, recortando lo mas viejo:', e);
    let n = arr.length;
    while (n > 1) {
      n = Math.floor(n / 2);
      const corte = arr.slice(0, n);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(corte));
        console.warn('[history] guardadas ' + n + ' de ' + arr.length + ' (el resto sigue en Drive).');
        return corte;
      } catch (e2) { /* sigue sin entrar: probamos con la mitad */ }
    }
    return arr;
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
 * Punto ÚNICO por el que pasan TODAS las mutaciones del historial (crear,
 * cambiar estado, seguimiento, borrar…). Dispara el respaldo en Drive si el
 * módulo drive-sync está cargado y el agente lo activó. En Node (tests) la
 * función no existe → se ignora sin romper. Nunca lanza.
 */
function _afterHistoryChange() {
  try {
    if (typeof scheduleDriveBackup === 'function') scheduleDriveBackup();
  } catch (e) { /* el respaldo jamás debe tumbar una operación del historial */ }
}

/** Sello de tiempo ISO para marcar la última modificación de una entrada. */
function _nowIso() {
  try { return new Date().toISOString(); } catch (e) { return ''; }
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
function buildWaShareUrl(entry, phoneOverride, urlGuia) {
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
    + (urlGuia || entry.guideUrl)
    + ' — cualquier consulta, quedo a la orden.';
  const raw = String(phoneOverride != null ? phoneOverride : (entry.waCliente || '')).replace(/\D/g, '');
  let phone = '';
  if (raw) phone = raw.startsWith('506') ? raw : '506' + raw;
  return 'https://web.whatsapp.com/send/?'
    + (phone ? 'phone=' + phone + '&' : '')
    + 'text=' + encodeURIComponent(msg);
}

/**
 * Cambia el link largo de la guia de la cotizacion por un alias corto
 * (/g/XXXXXXXXXX). La implementacion vive en js/shortlink.js, compartida con
 * el aviso de poliza activa (que acorta su propia guia de emergencias); aca
 * queda el nombre que usa app.js en la vista 4 y en el historial 💬.
 *
 * @param {string} urlLarga
 * @returns {Promise<string>}
 */
async function acortarGuia(urlLarga) {
  return acortarEnlace(urlLarga, 'g');
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
      arr[0].updatedAt = _nowIso();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      _afterHistoryChange();
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
 * Placa del vehiculo de una entrada.
 *   1. Entradas nuevas: campo e.plate.
 *   2. Entradas viejas sin e.plate: se recupera del parametro `p` del link de la
 *      guia (e.guideUrl), igual que historyEntryValue hace con `va`.
 * @param {object} e
 * @returns {string} '' si no se puede determinar
 */
function historyEntryPlate(e) {
  if (!e) return '';
  if (e.plate !== undefined && e.plate !== null && String(e.plate).trim() !== '') {
    return String(e.plate).trim();
  }
  if (e.guideUrl) {
    const m = String(e.guideUrl).match(/[?&]p=([^&]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]).trim(); } catch (_) { return String(m[1]).trim(); }
    }
  }
  return '';
}

/**
 * Normaliza un texto para busqueda tolerante: sin tildes, en minusculas y sin
 * separadores (espacios, guiones, puntos, guion bajo). Asi "BCS-123" ≈ "bcs123"
 * y "Hernández" ≈ "hernandez".
 * @param {string} s
 * @returns {string}
 */
function _normHistorySearch(s) {
  const t = String(s == null ? '' : s).normalize('NFD');
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const code = t.charCodeAt(i);
    if (code >= 0x0300 && code <= 0x036f) continue;  // descarta tildes combinantes (sin literal Unicode)
    out += t.charAt(i);
  }
  return out.toLowerCase().replace(/[\s\-._]/g, '');
}

/**
 * Nombre del cliente para MOSTRAR y BUSCAR: el completo si la entrada lo tiene,
 * si no el de pila. Las entradas anteriores al 5 ago 2026 solo guardaban el
 * nombre del saludo, asi que el fallback no es opcional.
 * @param {object} e
 * @returns {string}
 */
function historyClientName(e) {
  if (!e) return '';
  return String(e.clientFull || e.client || '').trim();
}

/**
 * ¿La cotizacion coincide con el texto buscado? Busca por PLACA (lo principal)
 * y tambien por nombre del cliente (completo y de pila) y vehiculo, de forma
 * tolerante (sin tildes ni separadores). Query vacia → siempre coincide.
 * @param {object} e
 * @param {string} query
 * @returns {boolean}
 */
function historyMatchesSearch(e, query) {
  const q = _normHistorySearch(query);
  if (!q) return true;
  if (!e) return false;
  return _normHistorySearch(historyEntryPlate(e)).indexOf(q) !== -1
      || _normHistorySearch(e.client).indexOf(q) !== -1
      || _normHistorySearch(e.clientFull).indexOf(q) !== -1
      || _normHistorySearch(e.vehicle).indexOf(q) !== -1;
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
    _afterHistoryChange();
    return true;
  } catch (e) {
    console.warn('[history] no se pudo eliminar la entrada:', e);
    return false;
  }
}

/**
 * Metricas de un conjunto de cotizaciones. PURA: no toca localStorage —
 * recibe el array y devuelve los numeros (asi es testeable en Node).
 * @param {Array<object>} entries
 * @returns {{total, agendada, concretada, desechada, rate:(number|null)}}
 *          rate = CONVERSIÓN: concretada / total (enviadas), con 1 decimal, o
 *          null solo si no hay cotizaciones (para mostrar "—").
 */
/**
 * Metricas de un conjunto de cotizaciones. PURA: no toca localStorage.
 *
 * Desde el 9 set 2026 el agente no marca nada a mano: una cotizacion cuenta
 * como cerrada cuando se le envio la POLIZA ACTIVA (ver marcarPolizaEmitida).
 * @param {Array<object>} entries
 * @param {{cot:number,pol:number}} [extra] - conteo de lo ya purgado (ver loadResumen)
 * @returns {{total:number, conPoliza:number, rate:(number|null)}}
 *          rate = conversion: conPoliza / total, con 1 decimal; null si no hay nada.
 */
function computeHistoryStats(entries, extra) {
  const list = (Array.isArray(entries) ? entries : []).filter(function (e) { return !esTombstone(e); });
  const ex = extra || { cot: 0, pol: 0 };
  let conPoliza = 0;
  list.forEach(function (e) { if (historyTienePoliza(e)) conPoliza++; });
  const total = list.length + (ex.cot || 0);
  conPoliza += (ex.pol || 0);
  const rate = total > 0 ? Math.round((conPoliza / total) * 1000) / 10 : null;
  return { total: total, conPoliza: conPoliza, rate: rate };
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
  const list = (Array.isArray(entries) ? entries : []).filter(function (e) { return !esTombstone(e); });
  const res  = loadResumen();
  const map  = {};
  // Un mes del que ya se purgo todo igual tiene que aparecer en las barras.
  Object.keys(res).forEach(function (k) { map[k] = map[k] || []; });
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
    // A las cotizaciones vivas del mes se les suma lo que ya se purgo de ese
    // mismo mes: si no, el historico de conversion se iria distorsionando a
    // medida que se borran las viejas sin poliza.
    return { key: key, label: label, entries: map[key], stats: computeHistoryStats(map[key], res[key]) };
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

// =====================================================================
// FUSIÓN / RESPALDO (para sincronización con Google Drive — drive-sync.js)
// Todo PURO y testeable: recibe/devuelve arrays, no toca la red.
// =====================================================================

/**
 * Clave de identidad de una entrada para deduplicar al fusionar. Prefiere el id
 * estable; si una entrada legacy no lo tiene, cae a una firma de sus datos.
 * @param {object} e
 * @returns {string}
 */
/**
 * ¿Esta cotizacion llego a poliza? Lo pone marcarPolizaEmitida() cuando el
 * agente envia la poliza activa desde /polizas-activas/. El agente no marca
 * nada a mano: si mando la poliza, el negocio se cerro.
 * @param {object} e
 * @returns {boolean}
 */
function historyTienePoliza(e) {
  return !!(e && e.polizaAt);
}

/**
 * Una entrada PURGADA: se le borraron todos los datos del cliente y solo queda
 * la marca de que existio. Sirve para que el borrado se propague al respaldo:
 * mergeHistories la prefiere sobre la entrada original (su updatedAt es mas
 * nuevo), asi que restaurar de Drive NO la resucita.
 * @param {object} e
 * @returns {boolean}
 */
function esTombstone(e) {
  return !!(e && e.purged);
}

/**
 * Marca que a esta placa se le emitio la poliza. La llama /polizas-activas/ al
 * terminar el envio.
 *
 * Si la placa esta en el historial, esa cotizacion queda cerrada. Si NO esta
 * (el cliente nunca cotizo por la app, o su cotizacion ya se purgo), se crea
 * una entrada propia: es un cliente real y tiene que contar igual.
 *
 * Idempotente: reenviar la misma poliza no cuenta dos veces.
 *
 * @param {{plate:string, client?:string, clientFull?:string, email?:string,
 *          vehicle?:string, poliza?:string}} datos
 * @returns {{marcada:boolean, creada:boolean, entry:(object|null)}}
 */
function marcarPolizaEmitida(datos) {
  const d = datos || {};
  const placa = _normHistorySearch(historyEntryPlate({ plate: d.plate || d.placa || '' }));
  const ahora = _nowIso();
  const list  = ensureHistoryIds();

  if (placa) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (esTombstone(e)) continue;
      if (_normHistorySearch(historyEntryPlate(e)) !== placa) continue;
      if (!e.polizaAt) {
        e.polizaAt  = ahora;
        e.updatedAt = ahora;
        if (d.poliza) e.poliza = String(d.poliza);
        _persistHistory(list);
        _afterHistoryChange();
      }
      return { marcada: true, creada: false, entry: e };
    }
  }

  // Sin cotizacion previa: entra como cliente que llego directo.
  const nueva = {
    id:         newHistoryId(),
    date:       ahora,
    updatedAt:  ahora,
    polizaAt:   ahora,
    origen:     'poliza',
    client:     d.client || '',
    clientFull: d.clientFull || d.client || '',
    email:      d.email || '',
    plate:      d.plate || d.placa || '',
    vehicle:    d.vehicle || '',
    poliza:     d.poliza ? String(d.poliza) : ''
  };
  list.unshift(nueva);
  _persistHistory(list);
  _afterHistoryChange();
  return { marcada: true, creada: true, entry: nueva };
}

// ===================================================================
// RESUMEN MENSUAL DE LO PURGADO
// ===================================================================

/**
 * Cuando una cotizacion vieja se borra, sus DATOS se van pero su CONTEO se
 * queda aca: { "2026-07": { cot: 48, pol: 10 } }. Son dos numeros por mes.
 *
 * Sin esto, borrar las viejas distorsionaria el historico: un cliente que
 * cotizo en enero y compro en junio dejaria una poliza sin su cotizacion, y la
 * conversion de los meses viejos se iria desdibujando sola.
 */
const RESUMEN_KEY = 'cotizador_sdi_resumen_v1';

/**
 * @returns {Object<string,{cot:number,pol:number}>} por clave de mes YYYY-MM
 */
function loadResumen() {
  try {
    const raw = localStorage.getItem(RESUMEN_KEY);
    const o   = raw ? JSON.parse(raw) : {};
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  } catch (e) {
    console.warn('[history] resumen ilegible:', e);
    return {};
  }
}

function _persistResumen(res) {
  try { localStorage.setItem(RESUMEN_KEY, JSON.stringify(res || {})); return true; }
  catch (e) { console.warn('[history] no se pudo guardar el resumen:', e); return false; }
}

/**
 * Fusiona dos resumenes. Se queda con el MAYOR de cada mes, no con la suma:
 * si dos equipos respaldan el mismo mes ya purgado, sumar lo contaria doble.
 * PURA.
 * @param {object} a
 * @param {object} b
 * @returns {object}
 */
function mergeResumenes(a, b) {
  const out = {};
  [a || {}, b || {}].forEach(function (src) {
    Object.keys(src).forEach(function (k) {
      const v = src[k] || {};
      const p = out[k] || { cot: 0, pol: 0 };
      out[k] = {
        cot: Math.max(p.cot || 0, Number(v.cot) || 0),
        pol: Math.max(p.pol || 0, Number(v.pol) || 0)
      };
    });
  });
  return out;
}

/** Reemplaza el resumen guardado (lo usa la restauracion desde Drive). */
function replaceResumen(res) {
  return _persistResumen(res || {});
}

/**
 * Dias que una cotizacion SIN poliza sobrevive en el registro.
 * Decision de JC (9 set 2026): si no llego a cliente en 90 dias, se borra —
 * "sino vamos a hacer una lista infinita de personas que ni siquiera llegan a
 * ser cliente".
 */
const PURGA_DIAS = 90;

/**
 * Borra las cotizaciones SIN poliza mas viejas que `dias`, dejando solo el
 * conteo del mes en el resumen.
 *
 * 🔴 Lo que llego a poliza NO se toca nunca: es el cliente real y es el dato
 *    que sostiene la conversion.
 * 🔴 De cada borrada queda un tombstone (id + fecha, CERO datos del cliente)
 *    para que el borrado se propague al respaldo. Sin el, mergeHistories las
 *    volveria a traer desde Drive en el siguiente respaldo.
 *
 * @param {number} [dias=PURGA_DIAS]
 * @param {number} [nowMs] - para poder testearlo
 * @returns {{purgadas:number, meses:number}}
 */
function purgarHistorial(dias, nowMs) {
  const limite = (typeof dias === 'number' && dias > 0) ? dias : PURGA_DIAS;
  const ahora  = (typeof nowMs === 'number') ? nowMs : Date.now();
  const iso    = new Date(ahora).toISOString();
  const list   = ensureHistoryIds();
  const res    = loadResumen();
  let purgadas = 0;
  const meses  = {};

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (esTombstone(e) || historyTienePoliza(e)) continue;
    const d = historyDaysSince(e, ahora);
    if (d == null || d < limite) continue;

    const k = historyMonthKey(e);
    meses[k] = (meses[k] || 0) + 1;
    // El registro se reemplaza por su lapida: no queda nombre, correo,
    // telefono, placa ni vehiculo.
    list[i] = { id: e.id, date: e.date, purged: true, updatedAt: iso };
    purgadas++;
  }

  if (!purgadas) return { purgadas: 0, meses: 0 };

  Object.keys(meses).forEach(function (k) {
    const p = res[k] || { cot: 0, pol: 0 };
    res[k] = { cot: (p.cot || 0) + meses[k], pol: p.pol || 0 };
  });

  _persistResumen(res);
  _persistHistory(list);
  _afterHistoryChange();
  return { purgadas: purgadas, meses: Object.keys(meses).length };
}

function _entryKey(e) {
  if (e && e.id) return 'id:' + e.id;
  return 'k:' + [
    (e && e.date) || '',
    historyEntryPlate(e),
    (e && e.email) || '',
    (e && e.client) || ''
  ].join('|');
}

/** Sello de última MODIFICACIÓN (ms) para resolver conflictos: gana el más nuevo. */
function _entryStamp(e) {
  const t = Date.parse((e && (e.updatedAt || e.date)) || '');
  return isFinite(t) ? t : 0;
}

/** Sello de ENVÍO (ms) para ordenar la lista: la cotización más reciente primero. */
function _dateStamp(e) {
  const t = Date.parse((e && e.date) || '');
  return isFinite(t) ? t : 0;
}

/**
 * Fusiona dos historiales SIN perder datos. Unión por identidad de entrada; si
 * la misma entrada aparece en ambos lados, gana la de `updatedAt` más reciente
 * (así el estado agendada/concretada más nuevo prevalece). El resultado queda
 * ordenado por fecha de envío (más reciente primero).
 *
 * Casos que cubre:
 *   - Restaurar tras limpiar el navegador: local vacío + Drive lleno → Drive.
 *   - Dos computadoras: unión de ambas, conservando el estado más avanzado.
 *
 * 🔴 El tope `cap` es OPCIONAL y sirve solo para lo que se guarda en el
 * NAVEGADOR. Lo que va a Drive se fusiona con `Infinity` (ver driveBackup):
 * recortar la unión antes de subirla fue lo que borró julio 2026.
 *
 * @param {Array<object>} a
 * @param {Array<object>} b
 * @param {number} [cap=HISTORY_MAX] - tope del resultado; Infinity = sin tope
 * @returns {Array<object>}
 */
function mergeHistories(a, b, cap) {
  const map = {};
  const add = function (e) {
    if (!e) return;
    const k = _entryKey(e);
    const prev = map[k];
    if (!prev || _entryStamp(e) >= _entryStamp(prev)) map[k] = e;
  };
  (Array.isArray(a) ? a : []).forEach(add);
  (Array.isArray(b) ? b : []).forEach(add);
  const out = Object.keys(map).map(function (k) { return map[k]; });
  out.sort(function (x, y) { return _dateStamp(y) - _dateStamp(x); });
  const tope = (cap === undefined) ? HISTORY_MAX : cap;
  if (tope && out.length > tope) out.length = tope;
  return out;
}

/**
 * Reemplaza TODO el historial guardado por el array dado (ya fusionado).
 * Lo usa la restauración desde Drive. Recorta a `cap` (por defecto
 * HISTORY_MAX) porque es lo que va al NAVEGADOR. Nunca lanza.
 * NO dispara respaldo (evita un bucle: se restaura, no se vuelve a subir aquí).
 * @param {Array<object>} arr
 * @param {number} [cap=HISTORY_MAX] - tope; Infinity = guardar todo
 * @returns {boolean} true si se guardó
 */
function replaceHistory(arr, cap) {
  try {
    const tope = (cap === undefined) ? HISTORY_MAX : cap;
    const list = (Array.isArray(arr) ? arr : []).slice(0, tope);
    _persistHistory(list);
    return true;
  } catch (e) {
    console.warn('[history] no se pudo reemplazar el historial:', e);
    return false;
  }
}
