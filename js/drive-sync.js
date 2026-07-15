/**
 * Cotizador SDI · Respaldo del control en Google Drive (carpeta privada)
 *
 * Guarda el control de cotizaciones (historial + estados 📊 + el perfil del
 * agente) en `appDataFolder`: una carpeta OCULTA y PRIVADA por-app dentro del
 * Google Drive del agente autenticado. Así el control sobrevive aunque el
 * agente limpie el navegador o cambie de computadora.
 *
 * MULTI-AGENTE POR DISEÑO: la carpeta appDataFolder es por-cuenta-Google. Cada
 * agente respalda en SU propio Drive; los datos de un agente jamás tocan los de
 * otro. Un solo deploy y un solo Client ID sirven a todos.
 *
 * SEGURIDAD DEL ENVÍO: usa un token OAuth SEPARADO (scope drive.appdata,
 * S.driveToken), independiente del token de Gmail (S.accessToken). Si el agente
 * no autoriza Drive, el envío de correos sigue funcionando igual — solo falla el
 * respaldo, de forma silenciosa.
 *
 * Flags en localStorage:
 *   - cotizador_sdi_drive_v1       '1' si el agente activó el respaldo.
 *   - cotizador_sdi_drive_last_v1  ISO del último respaldo subido con éxito.
 *
 * API pública (la usa app.js):
 *   - driveBackupEnabled()  -> bool
 *   - driveLastBackup()     -> string ISO (o '')
 *   - driveSync()           -> Promise<{found, merged, restored, profileRestored}>  (interactivo)
 *   - driveRestore([token]) -> Promise<{found, merged, restored, profileRestored}>
 *   - driveBackup([token])  -> Promise<true>
 *   - scheduleDriveBackup() -> void  (auto-respaldo debounced; silencioso)
 *   - driveResetAuto()      -> void  (reactiva el auto-respaldo tras un fallo)
 */

var DRIVE_FLAG_KEY = 'cotizador_sdi_drive_v1';
var DRIVE_LAST_KEY = 'cotizador_sdi_drive_last_v1';

// Si un auto-respaldo falla (p.ej. token caído), se apaga el resto de la sesión
// para no molestar con popups/errores repetidos. Se reactiva al sincronizar.
var _driveAutoOff     = false;
var _driveBackupTimer = null;

// ---------------------------------------------------------------------
// Flags / estado
// ---------------------------------------------------------------------

function driveBackupEnabled() {
  try { return localStorage.getItem(DRIVE_FLAG_KEY) === '1'; } catch (e) { return false; }
}
function driveEnable() {
  try { localStorage.setItem(DRIVE_FLAG_KEY, '1'); } catch (e) { /* noop */ }
}
function driveDisable() {
  try { localStorage.removeItem(DRIVE_FLAG_KEY); localStorage.removeItem(DRIVE_LAST_KEY); } catch (e) { /* noop */ }
}
function driveLastBackup() {
  try { return localStorage.getItem(DRIVE_LAST_KEY) || ''; } catch (e) { return ''; }
}
function _setDriveLastBackup(iso) {
  try { localStorage.setItem(DRIVE_LAST_KEY, iso); } catch (e) { /* noop */ }
}
function driveResetAuto() { _driveAutoOff = false; }

// ---------------------------------------------------------------------
// Token de Drive (SEPARADO del de Gmail)
// ---------------------------------------------------------------------

/**
 * Inicializa el cliente GIS para el scope de Drive. Idempotente.
 * @returns {object} instancia tokenClient
 */
function initDriveTokenClient() {
  if (S.driveTokenClient) return S.driveTokenClient;
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    throw new Error('Google Identity Services no está cargado.');
  }
  S.driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.CLIENT_ID,
    scope:     CFG.DRIVE_SCOPE,
    callback:  function () {}  // se sobreescribe en getDriveToken()
  });
  return S.driveTokenClient;
}

/**
 * Obtiene un access token con scope drive.appdata. Si ya hay uno vigente en
 * S.driveToken lo reusa. La PRIMERA vez abre el popup de consentimiento de
 * Google (pide permiso de Drive); ya concedido, las siguientes son silenciosas.
 * @returns {Promise<string>}
 */
function getDriveToken() {
  if (S.driveToken) return Promise.resolve(S.driveToken);
  initDriveTokenClient();
  return new Promise(function (resolve, reject) {
    S.driveTokenClient.callback = function (resp) {
      if (resp.error) {
        reject(new Error('OAuth Drive: ' + resp.error + (resp.error_description ? ' - ' + resp.error_description : '')));
        return;
      }
      S.driveToken = resp.access_token;
      resolve(resp.access_token);
    };
    try {
      S.driveTokenClient.requestAccessToken({ prompt: '' });
    } catch (e) { reject(e); }
  });
}

function clearDriveToken() { S.driveToken = null; }

// ---------------------------------------------------------------------
// REST helpers (fetch directo, sin SDK — mismo estilo que gmail-auth.js)
// ---------------------------------------------------------------------

async function _driveErr(r) {
  let t = '';
  try { t = await r.text(); } catch (e) { /* noop */ }
  if (r.status === 401) { clearDriveToken(); return new Error('El acceso a Drive expiró. Volvé a sincronizar.'); }
  return new Error('Drive API ' + r.status + ': ' + t);
}

/** Busca el archivo de respaldo en appDataFolder. @returns {Promise<string|null>} fileId */
async function _driveFindBackupId(token) {
  const q = "name='" + CFG.DRIVE_BACKUP_NAME + "' and trashed=false";
  const url = CFG.DRIVE_FILES_URL
    + '?spaces=appDataFolder&fields=' + encodeURIComponent('files(id,name,modifiedTime)')
    + '&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) throw await _driveErr(r);
  const j = await r.json();
  return (j.files && j.files.length) ? j.files[0].id : null;
}

/** Lee y parsea el JSON del archivo de respaldo. @returns {Promise<object>} */
async function _driveReadJson(token, fileId) {
  const r = await fetch(CFG.DRIVE_FILES_URL + '/' + fileId + '?alt=media', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!r.ok) throw await _driveErr(r);
  return await r.json();
}

/** Crea (o actualiza) el archivo de respaldo con el objeto dado. @returns {Promise<string>} fileId */
async function _driveWrite(token, payloadObj) {
  const body     = JSON.stringify(payloadObj);
  const existing = await _driveFindBackupId(token);

  if (existing) {
    // Ya existe: solo actualizamos el contenido.
    const r = await fetch(CFG.DRIVE_UPLOAD_URL + '/' + existing + '?uploadType=media', {
      method:  'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    body
    });
    if (!r.ok) throw await _driveErr(r);
    return existing;
  }

  // No existe: lo creamos en appDataFolder (subida multipart: metadata + contenido).
  const boundary  = 'sdi_ins_boundary_x7';
  const meta      = { name: CFG.DRIVE_BACKUP_NAME, parents: ['appDataFolder'] };
  const multipart =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n' +
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + body + '\r\n' +
    '--' + boundary + '--';
  const r = await fetch(CFG.DRIVE_UPLOAD_URL + '?uploadType=multipart&fields=id', {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body:    multipart
  });
  if (!r.ok) throw await _driveErr(r);
  const j = await r.json();
  return j.id;
}

// ---------------------------------------------------------------------
// Respaldo / restauración de alto nivel
// ---------------------------------------------------------------------

/** Arma el objeto que se sube a Drive: metadatos + historial dado + perfil. */
function _drivePayload(historyArr) {
  return {
    app:        'cotizador-sdi',
    v:          1,
    savedAt:    new Date().toISOString(),
    agentEmail: (typeof CFG !== 'undefined' && CFG.FROM_EMAIL) || '',
    agentName:  (typeof CFG !== 'undefined' && CFG.FROM_NAME)  || '',
    history:    Array.isArray(historyArr) ? historyArr : ensureHistoryIds(),
    profile:    (typeof loadProfile === 'function') ? loadProfile() : null
  };
}

/**
 * Sube el estado a Drive de forma SEGURA: primero lee lo que ya hay en Drive y
 * lo FUSIONA con lo local (mergeHistories), luego escribe la unión. Así un
 * respaldo desde una computadora NUNCA pisa cotizaciones hechas en otra —
 * siempre gana la unión, con el estado más reciente por cotización. La unión
 * también se guarda en local para que ambos lados queden idénticos.
 * @param {string} [token] - reusa un token ya obtenido (evita 2º popup)
 * @returns {Promise<true>}
 */
async function driveBackup(token) {
  const t  = token || await getDriveToken();
  let hist = ensureHistoryIds();
  const id = await _driveFindBackupId(t);
  if (id) {
    try {
      const remote = await _driveReadJson(t, id);
      if (remote && Array.isArray(remote.history)) {
        hist = mergeHistories(hist, remote.history);
        replaceHistory(hist);  // local queda con la unión también
      }
    } catch (e) {
      console.warn('[drive] no se pudo leer el respaldo previo, se sube lo local:', e);
    }
  }
  await _driveWrite(t, _drivePayload(hist));
  _setDriveLastBackup(new Date().toISOString());
  return true;
}

/**
 * Trae el respaldo de Drive y lo FUSIONA con lo local (sin perder nada). Si el
 * respaldo trae perfil y el navegador no tiene uno (caso "limpié el navegador"),
 * también restaura el perfil del agente.
 * @param {string} [token]
 * @returns {Promise<{found:boolean, restored:number, merged:number, profileRestored:boolean}>}
 */
async function driveRestore(token) {
  const t  = token || await getDriveToken();
  const id = await _driveFindBackupId(t);
  if (!id) return { found: false, restored: 0, merged: loadHistory().length, profileRestored: false };

  const data     = await _driveReadJson(t, id);
  const incoming = (data && Array.isArray(data.history)) ? data.history : [];
  const merged   = mergeHistories(loadHistory(), incoming);
  replaceHistory(merged);

  // Perfil: solo se restaura si el navegador NO tiene uno (no piso al agente actual).
  let profileRestored = false;
  try {
    if (data && data.profile && data.profile.name && data.profile.email
        && typeof loadProfile === 'function' && loadProfile() === null
        && typeof saveProfile === 'function') {
      saveProfile(data.profile);
      if (typeof applyProfile === 'function') applyProfile(data.profile);
      profileRestored = true;
    }
  } catch (e) { console.warn('[drive] no se pudo restaurar el perfil:', e); }

  return { found: true, restored: incoming.length, merged: merged.length, profileRestored: profileRestored };
}

/**
 * Sincronización COMPLETA e interactiva (botón "Sincronizar ahora"):
 *   1. Pide token de Drive (popup la 1ª vez).
 *   2. Restaura+fusiona lo que haya en Drive hacia local.
 *   3. Sube la unión → ambos lados quedan idénticos.
 *   4. Deja el respaldo ACTIVADO y reactiva el auto-respaldo.
 * @returns {Promise<{found, restored, merged, profileRestored}>}
 */
async function driveSync() {
  const t   = await getDriveToken();
  const res = await driveRestore(t);
  await driveBackup(t);
  driveEnable();
  _driveAutoOff = false;
  return res;
}

/**
 * Auto-respaldo debounced. Lo llama history.js tras CUALQUIER cambio del
 * historial. Silencioso: si el respaldo no está activado, ya falló esta sesión,
 * o el token no está disponible sin interacción, no hace nada visible.
 */
function scheduleDriveBackup() {
  if (!driveBackupEnabled() || _driveAutoOff) return;
  if (_driveBackupTimer) clearTimeout(_driveBackupTimer);
  _driveBackupTimer = setTimeout(function () {
    _driveBackupTimer = null;
    driveBackup().then(function () {
      if (typeof _refreshDriveStatus === 'function') _refreshDriveStatus();
    }).catch(function (err) {
      console.warn('[drive] auto-respaldo falló (se pausa esta sesión):', err);
      _driveAutoOff = true;  // no reintentar en bucle; se reactiva al sincronizar
    });
  }, 2500);
}
