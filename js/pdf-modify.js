/**
 * Cotizador SDI · Modificacion del PDF (limpieza de filas)
 *
 * Toma el PDF original de cotizacion INS y dibuja rectangulos blancos
 * sobre las filas que NO queremos enviar al cliente: la fila "Mensual"
 * y la fila "Deduccion Mensual" en la pagina 2 (tabla FORMA DE PAGO).
 *
 * Tecnica:
 *   - pdf-lib permite dibujar primitivas sobre paginas existentes.
 *   - Un rectangulo blanco (rgb(1,1,1)) cubre el contenido visualmente
 *     sin alterar el texto subyacente del PDF.
 *   - Las coordenadas Y vienen de pdf-extract.js (sistema bottom-up,
 *     compatible directamente con pdf-lib).
 *   - El ancho del rectangulo cubre casi toda la pagina horizontalmente
 *     (margen 28pt a cada lado), suficiente para tapar etiqueta + valor.
 *
 * API publica:
 *   - modifyPDF(arrayBuffer, rowsToRemove, pageWidth) -> Promise<Uint8Array>
 *
 * Donde:
 *   - arrayBuffer:   bytes del PDF original
 *   - rowsToRemove:  array [{y: number, label: string}, ...] de extractData()
 *   - pageWidth:     ancho de la pagina 2 en puntos PDF (de extractData())
 */

/**
 * Devuelve un nuevo PDF con las filas indicadas cubiertas por rectangulos blancos.
 * @param {ArrayBuffer} arrayBuffer - bytes del PDF original
 * @param {Array<{y:number, label:string}>} rowsToRemove - filas a tapar
 * @param {number} pageWidth - ancho de la pagina 2 en puntos
 * @returns {Promise<Uint8Array>} bytes del PDF modificado, listo para descargar o adjuntar
 */
async function modifyPDF(arrayBuffer, rowsToRemove, pageWidth) {
  if (!window.PDFLib) {
    throw new Error('pdf-lib no esta cargado. Verifica la conexion a la CDN.');
  }
  const { PDFDocument, rgb } = window.PDFLib;

  // Cargar el PDF (clonando el ArrayBuffer porque pdf-lib lo consume y luego no podemos reusarlo)
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  if (pdfDoc.getPageCount() < 2) {
    throw new Error('El PDF tiene menos de 2 paginas, no se puede modificar la tabla de precios.');
  }

  // Pagina 2 (indice 1) contiene la tabla FORMA DE PAGO con las filas a eliminar
  const p2 = pdfDoc.getPage(1);

  // Margen lateral: 28pt a cada lado (cubre el ancho util de la tabla)
  const X_MARGIN = 28;
  // Altura del rectangulo: 21pt es suficiente para cubrir una fila completa
  // (incluyendo padding tipico de las celdas del PDF generado por el INS)
  const ROW_HEIGHT = 21;
  // Offset Y: -5 baja el rectangulo lo suficiente para tapar el texto centrado de la fila
  const Y_OFFSET = -5;

  for (const row of rowsToRemove) {
    p2.drawRectangle({
      x:           X_MARGIN,
      y:           row.y + Y_OFFSET,
      width:       pageWidth - 2 * X_MARGIN,
      height:      ROW_HEIGHT,
      color:       rgb(1, 1, 1),  // blanco puro
      borderWidth: 0
    });
  }

  // .save() devuelve Uint8Array listo para Blob, descarga o base64
  return await pdfDoc.save();
}
