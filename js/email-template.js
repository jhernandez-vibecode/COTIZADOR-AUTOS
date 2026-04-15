/**
 * Cotizador SDI · Plantilla HTML del correo al cliente
 *
 * Genera el HTML del correo de cotizacion que se envia al cliente.
 * Diseno email-friendly:
 *   - Tablas anidadas para layout (Outlook y otros clientes no soportan flex/grid)
 *   - Inline styles en cada celda (los <style> en head se eliminan en muchos clientes)
 *   - Emojis y caracteres unicode en lugar de imagenes externas
 *   - Max-width 600px para legibilidad en escritorio y movil
 *
 * Estructura del correo (12 secciones):
 *   1. Header navy con "COTIZACION AUTOMOVILES"
 *   2. Saludo: ESTIMADO/A + VEHICULO
 *   3. Texto de introduccion
 *   4. CTA azul: "VER EXPLICACION DE MI COTIZACION" -> CFG.GUIDE_URL
 *   5. Beneficios incluidos (lista de 6 items con check)
 *   6. Interes asegurable (condicional, fondo azul claro)
 *   7. Tabla de precios (Trimestral / Semestral / Anual con -10%)
 *   8. Sustitucion de repuestos (texto adaptado al PDF)
 *   9. Nota personal del agente (condicional, fondo naranja claro)
 *  10. CTA verde: "Agendar mi cita ahora" -> CFG.AGENDA_URL
 *  11. Bloque de urgencia + social proof (15 dias + estrellas)
 *  12. Notas importantes (Uber, valor de mercado, sustitucion)
 *  13. Footer navy con datos del agente
 *
 * API publica:
 *   - buildEmail(params) -> string HTML
 */

/**
 * Construye el HTML completo del correo de cotizacion.
 * @param {object} params - parametros del correo
 * @param {string} params.nombre         - nombre del cliente para el saludo
 * @param {string} params.vehiculo       - descripcion del vehiculo
 * @param {object} params.prices         - { trimestral, semestral, anual } como strings ya formateados
 * @param {string} params.sustRepos      - texto exacto de "Sustitucion de repuestos" del PDF
 * @param {string} params.interes        - clave del dropdown (propietario, cero-km, traspaso, compra) o ''
 * @param {string} params.notaAdicional  - texto opcional del agente (linebreaks se preservan)
 * @returns {string} HTML completo del cuerpo del correo
 */
function buildEmail(params) {
  const p = params || {};
  const nombre   = (p.nombre   || '').trim();
  const vehiculo = (p.vehiculo || '').trim();
  const prices   = p.prices    || {};
  const sustText = _sustitucionText(p.sustRepos || '');
  const interesText = _interestText(p.interes || '');
  const notaTrim = (p.notaAdicional || '').trim();

  // Bloque de Interes Asegurable (solo si hay valor)
  const interesHtml = interesText ? `
        <tr><td style="padding:0 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#dbeafe;border-radius:6px;margin-top:20px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1e3a8a;">INTERES ASEGURABLE</p>
              <p style="margin:0;font-size:14px;color:#1e40af;">${_escape(interesText)}</p>
            </td></tr>
          </table>
        </td></tr>` : '';

  // Bloque de Nota Personal (solo si hay valor)
  // Preservamos saltos de linea convirtiendo \n a <br>
  const notaHtml = notaTrim ? `
        <tr><td style="padding:0 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffedd5;border-left:4px solid #d97706;border-radius:6px;margin-top:20px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#9a3412;">NOTA DE SU AGENTE</p>
              <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.5;">${_escape(notaTrim).replace(/\n/g, '<br>')}</p>
            </td></tr>
          </table>
        </td></tr>` : '';

  // ============ HTML COMPLETO ============
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cotizacion Automoviles INS</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">

        <!-- 1. HEADER -->
        <tr><td style="background:#0c2340;color:#ffffff;padding:28px 40px;text-align:center;">
          <img src="${CFG.LOGO_URL}" alt="INS" height="52" style="display:block;margin:0 auto 14px;border:0;outline:none;text-decoration:none;max-height:52px;" />
          <h1 style="margin:0;font-size:22px;letter-spacing:1px;font-weight:700;">COTIZACION AUTOMOVILES</h1>
          <p style="margin:8px 0 0;font-size:13px;opacity:0.85;">Seguros del INS &middot; Su proteccion al volante</p>
          <p style="margin:8px 0 0;font-size:12px;opacity:0.75;">Agente ${_escape(CFG.FROM_NAME)} &middot; Licencia SUGESE ${_escape(CFG.LICENSE)}</p>
        </td></tr>

        <!-- 2. SALUDO -->
        <tr><td style="padding:28px 40px 0;">
          <p style="margin:0;font-size:12px;color:#6b7280;letter-spacing:1px;">ESTIMADO/A:</p>
          <p style="margin:4px 0 16px;font-size:18px;font-weight:bold;color:#0c2340;">${_escape(nombre)}</p>
          <p style="margin:0;font-size:12px;color:#6b7280;letter-spacing:1px;">VEHICULO:</p>
          <p style="margin:4px 0 0;font-size:16px;color:#0c2340;">${_escape(vehiculo)}</p>
        </td></tr>

        <!-- 3. INTRO -->
        <tr><td style="padding:20px 40px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
            Le presentamos la cotizacion personalizada para el aseguramiento de su vehiculo
            con el Instituto Nacional de Seguros. Hemos preparado una explicacion visual
            detallada para que conozca cada beneficio incluido en su poliza.
          </p>
        </td></tr>

        <!-- 4. CTA EXPLICADOR -->
        <tr><td style="padding:0 40px 8px;text-align:center;">
          <a href="${CFG.GUIDE_URL}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:0.5px;">
            VER EXPLICACION DE MI COTIZACION &rarr;
          </a>
        </td></tr>

        <!-- 5. BENEFICIOS -->
        <tr><td style="padding:24px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#0c2340;border-bottom:2px solid #0369a1;padding-bottom:8px;letter-spacing:0.5px;">
            BENEFICIOS INCLUIDOS
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" style="padding:6px 8px 6px 0;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> Cobertura Total (A,B,C,D,F,H)
              </td>
              <td width="50%" style="padding:6px 0 6px 8px;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> Indemnizacion del Deducible (IDD)
              </td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> Asistencia 24/7 en carretera
              </td>
              <td style="padding:6px 0 6px 8px;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> 10% de descuento en pago anual
              </td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> Contratacion 100% en linea
              </td>
              <td style="padding:6px 0 6px 8px;font-size:13px;color:#374151;vertical-align:top;">
                <span style="color:#16a34a;font-weight:bold;">&#10003;</span> Exencion de Deducible (Cobertura C)
              </td>
            </tr>
          </table>
        </td></tr>
${interesHtml}
        <!-- 7. PRECIOS -->
        <tr><td style="padding:24px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#0c2340;border-bottom:2px solid #0369a1;padding-bottom:8px;letter-spacing:0.5px;">
            FORMAS DE PAGO
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:bold;letter-spacing:1px;border-bottom:1px solid #e5e7eb;">FRECUENCIA</td>
              <td style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:bold;letter-spacing:1px;text-align:right;border-bottom:1px solid #e5e7eb;">MONTO</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">Trimestral</td>
              <td style="padding:14px 16px;font-size:14px;color:#0c2340;font-weight:bold;text-align:right;border-bottom:1px solid #e5e7eb;">&#8353; ${_escape(prices.trimestral || '')}</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">Semestral</td>
              <td style="padding:14px 16px;font-size:14px;color:#0c2340;font-weight:bold;text-align:right;border-bottom:1px solid #e5e7eb;">&#8353; ${_escape(prices.semestral || '')}</td>
            </tr>
            <tr style="background:#dcfce7;">
              <td style="padding:14px 16px;font-size:14px;color:#166534;font-weight:bold;">
                Anual
                <span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:6px;letter-spacing:0.5px;">-10%</span>
              </td>
              <td style="padding:14px 16px;font-size:15px;color:#166534;font-weight:bold;text-align:right;">&#8353; ${_escape(prices.anual || '')}</td>
            </tr>
          </table>
        </td></tr>

        <!-- 8. SUSTITUCION DE REPUESTOS -->
        <tr><td style="padding:20px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eff6ff;border-left:4px solid #0369a1;border-radius:6px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#0c2340;letter-spacing:0.5px;">SUSTITUCION DE REPUESTOS</p>
              <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5;">${_escape(sustText)}</p>
            </td></tr>
          </table>
        </td></tr>
${notaHtml}
        <!-- 10. CTA AGENDAR -->
        <tr><td style="padding:28px 40px 8px;text-align:center;">
          <a href="${CFG.AGENDA_URL}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:16px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.5px;">
            &#161;Agendar mi cita ahora! &rarr;
          </a>
        </td></tr>

        <!-- 11. URGENCIA + SOCIAL PROOF (espacio generoso para que el boton respire) -->
        <tr><td style="padding:36px 40px 32px;text-align:center;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:bold;color:#0c2340;line-height:1.5;">
            Esta cotizaci&oacute;n est&aacute; disponible por los pr&oacute;ximos 15 d&iacute;as.<br/>
            &iexcl;No deje pasar esta oportunidad de proteger su veh&iacute;culo!
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#0369a1;font-weight:600;letter-spacing:0.3px;">
            Es f&aacute;cil, es r&aacute;pido, es seguro.
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
            <span style="color:#f59e0b;font-size:14px;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span><br/>
            Miles de conductores ya est&aacute;n protegidos con nuestro proceso digital
          </p>
        </td></tr>

        <!-- 12. NOTAS IMPORTANTES -->
        <tr><td style="padding:20px 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef3c7;border-radius:6px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#78350f;letter-spacing:0.5px;">NOTAS IMPORTANTES</p>
              <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350f;line-height:1.6;">
                <li>Este seguro NO cubre actividades de UBER o similares.</li>
                <li>El valor asegurado debe corresponder al valor de mercado del vehiculo. En caso de diferencia, podria aplicarse el principio de proporcion.</li>
                <li>La sustitucion de repuestos depende de la disponibilidad y antiguedad del vehiculo segun la modalidad contratada.</li>
              </ul>
            </td></tr>
          </table>
        </td></tr>

        <!-- 13. FOOTER -->
        <tr><td style="background:#0c2340;color:#ffffff;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#cbd5e1;">${_escape(CFG.FROM_NAME)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Agente de Seguros INS &middot; Licencia SUGESE ${_escape(CFG.LICENSE)}</p>
          <p style="margin:12px 0 4px;font-size:12px;color:#64748b;">Tel: <span style="color:#cbd5e1;">${_escape(CFG.PHONE)}</span></p>
          <p style="margin:6px 0 2px;font-size:14px;">
            <a href="mailto:${_escape(CFG.FROM_EMAIL)}" style="color:#7dd3fc;text-decoration:underline;font-weight:bold;">${_escape(CFG.FROM_EMAIL)}</a>
          </p>
          ${CFG.WEBSITE ? `<p style="margin:4px 0 0;font-size:14px;">
            <a href="https://${_escape(CFG.WEBSITE)}" style="color:#7dd3fc;text-decoration:underline;font-weight:bold;">${_escape(CFG.WEBSITE)}</a>
          </p>` : ''}
        </td></tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// =====================================================================
// HELPERS INTERNOS
// =====================================================================

/**
 * Mapea la clave del dropdown de Interes Asegurable al texto que va al correo.
 * @param {string} key - valor del select (propietario, cero-km, traspaso, compra)
 * @returns {string} texto a mostrar, o '' si no hay seleccion
 */
function _interestText(key) {
  const map = {
    'propietario': 'Propietario Registral',
    'cero-km':     'Vehiculo Cero Kilometros (en proceso de compra)',
    'traspaso':    'En proceso de traspaso',
    'compra':      'En proceso de compra'
  };
  return map[key] || '';
}

/**
 * Devuelve el parrafo descriptivo de la sustitucion de repuestos
 * segun el texto exacto que viene en el PDF del INS.
 * Compara case-insensitive y sin acentos para tolerar variaciones
 * (ej: PDF dice "garantia" minuscula, SKILL menciona "Garantia" mayuscula).
 * @param {string} label - texto del campo "Sustitucion de repuestos" del PDF
 * @returns {string} parrafo descriptivo para el correo
 */
function _sustitucionText(label) {
  const norm = (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita acentos

  // Orden importante: "plus" debe ir antes que "garantia" sola
  if (norm.includes('garantia plus')) {
    return 'Su vehiculo aplica a repuestos originales de agencia (cobertura hasta 8 anos / 80,000 km segun la Extension de Garantia Plus).';
  }
  if (norm.includes('garantia')) {
    return 'Su vehiculo aplica a repuestos originales de agencia (cobertura hasta 5 anos / 60,000 km segun la Extension de Garantia).';
  }
  if (norm.includes('repuesto original')) {
    return 'Su poliza incluye repuestos originales en taller multimarca o especializado.';
  }
  if (norm.includes('repuesto alternativo')) {
    return 'Su poliza utiliza repuestos genericos y/o usados segun disponibilidad del mercado.';
  }
  return 'Su poliza aplica las condiciones estandar de sustitucion de repuestos del INS.';
}

/**
 * Escapa caracteres HTML peligrosos para evitar XSS si el agente
 * pega contenido inesperado en los campos del formulario.
 * @param {string} s - texto a escapar
 * @returns {string} texto seguro para insertar en HTML
 */
function _escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
