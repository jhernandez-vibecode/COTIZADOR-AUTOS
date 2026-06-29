/**
 * Cotizador SDI · Documentos estándar del INS (empaquetados, auto-adjuntos)
 *
 * Estos PDF se adjuntan automáticamente a los correos:
 *   - cotizacion: se suma al PDF de cotización (Deber de Información / Info previa).
 *   - poliza:     se suman a los PDF que sube el agente en "Envío de pólizas".
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CÓMO ACTUALIZAR cuando el INS cambia una versión:                         │
 * │  1) Reemplazá el archivo PDF en la carpeta /documentos-ins/ del repo       │
 * │     (manteniendo el mismo nombre de archivo), o subí el nuevo y cambiá     │
 * │     el "path" de abajo.                                                    │
 * │  2) Si cambió el número de versión, actualizá el "name" (lo que ve el      │
 * │     cliente como nombre del adjunto).                                      │
 * │  3) Guardá y hacé push a main (Netlify auto-despliega en 1-2 min).         │
 * │  Para AGREGAR o QUITAR un documento, editá los arreglos de abajo.          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Rutas absolutas (/documentos-ins/...) para que funcionen igual desde la app
 * principal (raíz) y desde la sub-página /polizas-activas/.
 *
 * NOTA: "deber-de-informacion-autos.pdf" y "perfeccionamiento-sva-v31.pdf" son
 * actualmente EL MISMO documento del INS ("Información previa al perfeccionamiento
 * del contrato"), que es justamente lo que cumple el deber de información
 * precontractual. Se mantienen como archivos separados para poder actualizarlos
 * de forma independiente si en el futuro divergen.
 */
var STD_DOCS = {
  // Correo de COTIZACIÓN (se adjunta junto al PDF de la cotización)
  cotizacion: [
    { path: '/documentos-ins/deber-de-informacion-autos.pdf', name: 'Deber de Informacion Autos.pdf' }
  ],
  // Correo de PÓLIZA ACTIVA (se suman a los PDF que sube el agente)
  poliza: [
    { path: '/documentos-ins/co-multiasistencia-170.pdf',         name: 'C.O. Multiasistencia.pdf' },
    { path: '/documentos-ins/co-pacto-amistoso-v30-170.pdf',      name: 'Pacto Amistoso.pdf' },
    { path: '/documentos-ins/co-dam-v30-170.pdf',                 name: 'C.O. Accidente Menor (DAM).pdf' },
    { path: '/documentos-ins/condiciones-generales-sva-v31-1.pdf', name: 'Condiciones Generales SVA.pdf' },
    { path: '/documentos-ins/perfeccionamiento-sva-v31.pdf',      name: 'Perfeccionamiento del Contrato SVA.pdf' }
  ]
};

/**
 * Descarga los documentos estándar listados y los devuelve listos para adjuntar.
 * Best-effort: si alguno falla (404 / red), se omite y se reporta en `failed`,
 * sin tumbar el envío. cache:'no-cache' para tomar la versión vigente tras un update.
 * @param {Array<{path:string,name:string}>} list
 * @returns {Promise<{docs:Array<{bytes:Uint8Array,filename:string}>, failed:string[]}>}
 */
async function loadStdDocs(list) {
  var docs = [], failed = [];
  var arr = list || [];
  for (var i = 0; i < arr.length; i++) {
    var d = arr[i];
    try {
      var r = await fetch(d.path, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var buf = await r.arrayBuffer();
      docs.push({ bytes: new Uint8Array(buf), filename: d.name });
    } catch (e) {
      console.error('[std-docs] no se pudo cargar', d.path, e);
      failed.push(d.name);
    }
  }
  return { docs: docs, failed: failed };
}

if (typeof window !== 'undefined') { window.STD_DOCS = STD_DOCS; window.loadStdDocs = loadStdDocs; }
if (typeof module !== 'undefined' && module.exports) { module.exports = { STD_DOCS: STD_DOCS, loadStdDocs: loadStdDocs }; }
