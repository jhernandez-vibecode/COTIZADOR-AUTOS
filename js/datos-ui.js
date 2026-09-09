/**
 * Cotizador SDI · Administración de los datos del agente (⚙)
 *
 * Dos cosas que van juntas porque tratan del mismo dato:
 *   - el **respaldo en Google Drive** (sincronizar, restaurar, la invitación
 *     inicial a activarlo);
 *   - la **limpieza del registro**, que borra lo que no llegó a póliza.
 *
 * 🔴 El invariante que las une: **nada se borra sin estar respaldado antes**.
 * `limpiarRegistroSinPoliza()` respalda y aborta si el respaldo falla, igual
 * que la purga automática de los 90 días (que vive en drive-sync.js, dentro de
 * driveBackup). Ver la ficha del proyecto.
 *
 * Se separó de app.js el 9 set 2026, en la revisión de calidad.
 *
 * Orden de carga: después de drive-sync.js y history.js, antes de app.js.
 */

/** Refresca la línea de estado del respaldo en el modal ⚙. */
function _refreshDriveStatus() {
  const el = document.getElementById('driveStatus');
  if (!el) return;
  if (typeof driveBackupEnabled !== 'function' || !driveBackupEnabled()) {
    el.textContent = '⚪ Respaldo desactivado. Tocá “Sincronizar ahora” para guardar tu control en tu Google Drive.';
    return;
  }
  const last = driveLastBackup();
  let when = 'aún sin subir';
  if (last) {
    const d = new Date(last);
    if (!isNaN(d.getTime())) {
      when = d.toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  }
  el.textContent = '✅ Respaldo activo en tu Google Drive · Último: ' + when + '.';
}

/** Repinta las listas abiertas (historial / estadísticas) tras cambiar los datos. */
function _refreshOpenLists() {

  const stats = document.getElementById('statsModal');
  if (stats && stats.classList.contains('active') && typeof renderStats === 'function') renderStats();
}

/** Botón "Sincronizar ahora": activa el respaldo y deja Drive ↔ local idénticos. */
async function driveSyncNow() {
  const btn = document.getElementById('btnDriveSync');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
  try {
    const res = await driveSync();

    // Si de paso se recupero el PERFIL del agente (caso "limpie el navegador":
    // driveSync llama a driveRestore, que restaura el perfil cuando el navegador
    // no tiene ninguno), hay que recargar igual que en driveRestoreNow.
    //
    // Sin esto el modal ⚙ se queda abierto con los inputs que se llenaron ANTES
    // desde los defaults de CFG — o sea con el nombre y la licencia SUGESE del
    // dueno de la app — y en primer uso el unico boton disponible es "Guardar":
    // el agente lo pulsa, pisa el perfil que se acaba de recuperar y sube esa
    // suplantacion a SU propio Drive. Terminaria cotizando con una licencia
    // ajena sin enterarse.
    if (res && res.profileRestored) {
      driveEnable();
      driveResetAuto();
      showToast('Recuperé tu configuración y ' + res.merged + ' cotizaciones. Recargando…', 'success');
      setTimeout(function () { location.reload(); }, 1100);
      return;
    }

    _hideDriveInvite();
    _refreshDriveStatus();
    _refreshOpenLists();
    paintRailAgent();
    const n = (res && res.found) ? res.merged : loadHistoryVivas().length;
    showToast('Respaldo activado. Tu control quedó guardado en tu Google Drive (' + n + (n === 1 ? ' cotización' : ' cotizaciones') + ').', 'success');
  } catch (e) {
    console.error('[drive] sync:', e);
    showToast('No se pudo sincronizar con Drive: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

/** Botón "Restaurar de Drive": trae y fusiona el respaldo (y el perfil si falta). */
async function driveRestoreNow() {
  const btn = document.getElementById('btnDriveRestore');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Restaurando…'; }
  try {
    const res = await driveRestore();
    if (!res.found) {
      showToast('No hay respaldo en tu Drive todavía. Usá “Sincronizar ahora” para crearlo.', 'info');
      return;
    }
    driveEnable();
    driveResetAuto();
    if (res.profileRestored) {
      // Se recuperó también el perfil (caso "limpié el navegador"): recargamos
      // para que la app arranque ya configurada y con el historial de vuelta.
      showToast('Recuperé tu configuración y ' + res.merged + ' cotizaciones. Recargando…', 'success');
      setTimeout(function () { location.reload(); }, 1100);
      return;
    }
    _refreshDriveStatus();
    _refreshOpenLists();
    showToast('Recuperé ' + res.merged + ' cotizaciones desde tu Drive.', 'success');
  } catch (e) {
    console.error('[drive] restore:', e);
    showToast('No se pudo restaurar desde Drive: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

// ---- Barra de invitación (una vez) a activar el respaldo en Drive ----
var DRIVE_INVITE_DISMISS_KEY = 'cotizador_sdi_drive_invite_dismissed_v1';

/** Muestra la barra si el agente ya tiene perfil, aún no activó el respaldo y no la descartó. */
function maybeShowDriveInvite() {
  var el = document.getElementById('driveInvite');
  if (!el) return;
  if (!loadProfile()) return;                                             // primer uso: no molestar
  if (typeof driveBackupEnabled === 'function' && driveBackupEnabled()) return;  // ya activo
  try { if (localStorage.getItem(DRIVE_INVITE_DISMISS_KEY) === '1') return; } catch (e) { /* noop */ }
  el.style.display = 'flex';
}

function _hideDriveInvite() {
  var el = document.getElementById('driveInvite');
  if (el) el.style.display = 'none';
}

/** "Ahora no": oculta la barra y no la vuelve a mostrar en este navegador. */
function dismissDriveInvite() {
  try { localStorage.setItem(DRIVE_INVITE_DISMISS_KEY, '1'); } catch (e) { /* noop */ }
  _hideDriveInvite();
}

/**
 * Limpieza manual del registro: borra TODAS las cotizaciones que no llegaron a
 * póliza, de cualquier fecha, y deja solo a los clientes reales.
 *
 * Decisión de JC (9 set 2026). Se le advirtió que también se lleva las
 * cotizaciones recientes —las de esta semana, con su correo y su enlace— y
 * respondió que igual: quiere el registro solo con clientes.
 *
 * 🔴 Respalda ANTES de borrar y **aborta si el respaldo falla**. Es la misma
 * regla que la purga automática: nada se borra sin estar arriba. Como el
 * respaldo de Drive conserva versiones anteriores, esto es recuperable aunque
 * desde la app no haya deshacer.
 */
async function limpiarRegistroSinPoliza() {
  const btn = document.getElementById('btnLimpiarRegistro');
  const vivas = loadHistoryVivas();
  const aBorrar = vivas.filter(function (e) { return !historyTienePoliza(e); });

  if (!aBorrar.length) {
    showToast('No hay nada que limpiar: todas las cotizaciones del registro llegaron a póliza.', 'success');
    return;
  }

  const quedan = vivas.length - aBorrar.length;
  const msg = 'Se van a borrar ' + aBorrar.length +
    (aBorrar.length === 1 ? ' cotización que no llegó' : ' cotizaciones que no llegaron') + ' a póliza.\n\n' +
    'Quedarán ' + quedan + (quedan === 1 ? ' cliente' : ' clientes') + ' en el registro.\n\n' +
    'Incluye las cotizaciones recientes: se pierde su correo, su enlace de la guía y el botón de WhatsApp.\n\n' +
    'Antes de borrar se guarda un respaldo en tu Drive. ¿Continuar?';
  if (!confirm(msg)) return;

  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Respaldando…'; }

  try {
    // Nada se borra sin respaldo: si esto lanza, no se llega al borrado.
    if (typeof driveBackupEnabled === 'function' && driveBackupEnabled()) {
      await driveBackup();
    } else {
      const sinRed = confirm('Todavía no tenés activado el respaldo en Google Drive.\n\n' +
        'Si borrás ahora, esas cotizaciones NO se van a poder recuperar de ninguna parte.\n\n' +
        '¿Borrar igual?');
      if (!sinRed) { showToast('Cancelado. Activá el respaldo con "Sincronizar ahora" y volvé a intentar.', 'error'); return; }
    }

    if (btn) btn.textContent = 'Limpiando…';
    const r = purgarHistorial(0);   // 0 = todas las que no llegaron a póliza

    // Subir las lápidas, para que el borrado no vuelva al restaurar.
    if (typeof scheduleDriveBackup === 'function') scheduleDriveBackup();

    showToast('Registro limpio: se borraron ' + r.purgadas + '. Quedan ' + quedan + '.', 'success');
    if (typeof renderStats === 'function') renderStats();
    if (typeof _refreshDriveStatus === 'function') _refreshDriveStatus();
  } catch (e) {
    console.error('[limpiar] ', e);
    showToast('No se pudo respaldar en Drive, así que NO se borró nada: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}
