/**
 * Cotizador SDI · Estado global
 *
 * Singleton mutable que comparten todos los módulos.
 * No se persiste — al recargar la página arranca en blanco.
 */
const S = {
  step:         1,        // paso actual (1..4)
  data:         null,     // objeto devuelto por extractData() del PDF
  modPDF:       null,     // Uint8Array del PDF ya limpiado (sin filas Mensual/Deducción)
  accessToken:  null,     // token OAuth Gmail vigente (dura 1h)
  tokenClient:  null,     // instancia de Google Identity Services
  msalInstance: null,     // instancia de MSAL (Outlook)
  outlookToken: null,     // token OAuth Microsoft vigente
  provider:     'gmail',  // 'gmail' | 'outlook' — se carga del perfil guardado
  prevTimer:    null      // debounce de la vista previa del correo
};
