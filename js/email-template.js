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
 * Construye el HTML completo del correo de cotizacion (v2 — neuromarketing).
 *
 * Estructura nueva (AIDA + neuromarketing digital):
 *   1. Header navy con logo INS + "Tu cotizacion esta lista"
 *   2. Saludo personalizado + tarjeta del vehiculo (anclaje emocional)
 *   3. Intro + CTA primario al explicador
 *   4. 3 outcome benefits (Full Cobertura · Cero deducible · Asistencia 24/7)
 *   5. Precios con anclaje invertido (Anual destacado al centro, -10%)
 *   6. Sustitucion de repuestos
 *   7. CTA "Agendar mi cita ahora" (camino limpio sin barreras)
 *   8. Prueba social (estrellas + miles de conductores) — momentum tras CTA
 *   9. (cond) Interes asegurable
 *  10. (cond) Nota personal del agente
 *  11. Firma humana ("Cualquier duda, hablemos. — JC")
 *  12. Nota Uber al puro final (disclaimer legal)
 *  13. Footer con marca SDI + datos del agente
 *
 * Email-friendly: tablas anidadas + inline styles. Outlook-safe con
 * fallback de fuentes (Space Grotesk → Helvetica → Arial).
 *
 * @param {object} params - parametros del correo
 * @param {string} params.nombre         - nombre del cliente para el saludo (también va a explicador como `c`)
 * @param {string} params.vehiculo       - descripcion del vehiculo (también va a explicador como `v`)
 * @param {object} params.prices         - { trimestral, semestral, anual } como strings ya formateados
 * @param {string} params.sustRepos      - texto exacto de "Sustitucion de repuestos" del PDF
 * @param {string} params.interes        - clave del dropdown (propietario, cero-km, traspaso, compra) o ''
 * @param {string} params.notaAdicional  - texto opcional del agente (linebreaks se preservan)
 * @param {string} [params.plate]        - placa del vehículo (para explicador y tarjeta)
 * @param {string|number} [params.year]  - año del vehículo (para explicador)
 * @param {string|number} [params.valor] - valor asegurado (para tarjeta vehiculo y explicador)
 * @param {string} [params.vehicleType]  - tipo crudo del PDF; se mapea a 'g' (gasolina) por default
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
  const valorFmt = _formatValor(p.valor);
  const plate    = (p.plate || '').trim();

  // ============ BLOQUES CONDICIONALES ============

  // Bloque "Interes Asegurable" (solo si el agente selecciono uno)
  const interesHtml = interesText ? `
        <tr><td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#dbeafe;border-radius:8px;border-left:4px solid #0369a1;margin-top:18px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#0c4a6e;letter-spacing:0.06em;text-transform:uppercase;">Interes Asegurable</p>
              <p style="margin:0;font-size:14px;color:#0c4a6e;">${_escape(interesText)}</p>
            </td></tr>
          </table>
        </td></tr>` : '';

  // Bloque "Nota personal del agente" (solo si el agente escribio algo)
  const notaHtml = notaTrim ? `
        <tr><td style="padding:18px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:4px solid #ea580c;border-radius:8px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#9a3412;letter-spacing:0.06em;text-transform:uppercase;">Nota de tu agente</p>
              <p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.55;">${_escape(notaTrim).replace(/\n/g, '<br>')}</p>
            </td></tr>
          </table>
        </td></tr>` : '';

  // Tarjeta del vehiculo: solo si hay datos para mostrar
  const vehicleCardHtml = (vehiculo || plate || valorFmt) ? `
        <tr><td style="padding:0 32px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0369a1;border-radius:10px;">
            <tr>
              <td style="padding:14px 16px;width:60px;vertical-align:middle;">
                <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#ffffff;border-radius:8px;width:48px;height:48px;text-align:center;font-size:24px;line-height:48px;">&#128663;</td></tr></table>
              </td>
              <td style="padding:14px 16px 14px 0;vertical-align:middle;">
                <p style="margin:0;font-size:10px;color:#0369a1;letter-spacing:0.08em;text-transform:uppercase;font-weight:bold;">Tu vehiculo cotizado</p>
                <p style="margin:3px 0 0;font-size:16px;font-weight:bold;color:#0c4a6e;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;">${_escape(vehiculo || plate || 'Tu vehiculo')}${plate && vehiculo ? ' &middot; ' + _escape(plate) : ''}</p>
                ${valorFmt ? `<p style="margin:2px 0 0;font-size:12px;color:#475569;">Valor asegurado: <b style="color:#0c4a6e;">&#8353;${_escape(valorFmt)}</b></p>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>` : '';

  // URL del explicador con todos los datos personalizados
  const guideUrl = _buildGuideUrl({
    clientName:    nombre,
    vehicle:       vehiculo,
    plate:         p.plate,
    year:          p.year,
    vehicleType:   _detectVehicleType(p.vehicleType),
    valor:         p.valor,
    sustReposCode: _sustReposToCode(p.sustRepos),
    prices:        prices
  });

  // Familia de fuentes con fallback (Outlook ignora Google Fonts → cae a Helvetica)
  const fontFam = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
  const fontBody = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

  // ============ HTML COMPLETO ============
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tu cotizacion esta lista &middot; Seguros Digitales SDI</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:${fontBody};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,0.08);">

        <!-- 1. HEADER -->
        <tr><td bgcolor="#0c2340" style="background:#0c2340;color:#ffffff;padding:28px 32px;text-align:center;">
          <img src="${CFG.LOGO_URL}" alt="INS" height="46" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;height:46px;" />
          <h1 style="margin:0;font-family:${fontFam};font-size:22px;font-weight:700;letter-spacing:-0.01em;">Tu cotizacion esta lista</h1>
          <p style="margin:6px 0 0;font-size:12px;opacity:0.75;">Seguros del INS &middot; Tu proteccion al volante</p>
        </td></tr>

        <!-- 2. SALUDO -->
        <tr><td style="padding:28px 32px 14px;">
          <p style="margin:0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Estimado/a</p>
          <p style="margin:4px 0 16px;font-family:${fontFam};font-size:24px;font-weight:700;color:#0c4a6e;letter-spacing:-0.01em;">${_escape(nombre)},</p>
        </td></tr>

        <!-- 3. TARJETA VEHICULO -->
        ${vehicleCardHtml}

        <!-- 4. INTRO + CTA EXPLICADOR -->
        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
            Te prepar&eacute; una <b style="color:#0c4a6e;">gu&iacute;a visual personalizada</b> con todos los detalles de tu cotizaci&oacute;n &mdash; qu&eacute; cubre cada letra, c&oacute;mo funciona el deducible, las opciones de pago y cu&aacute;ndo aplica cada beneficio.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center">
              <a href="${guideUrl}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 28px;font-family:${fontFam};font-weight:700;font-size:15px;">Ver mi cotizaci&oacute;n explicada &rarr;</a>
              <p style="margin:8px 0 0;font-size:11px;color:#64748b;font-style:italic;">~3 minutos de lectura &middot; dise&ntilde;ada solo para vos</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- 5. BENEFICIOS OUTCOME (Full → Cero deducible → Asistencia) -->
        <tr><td style="padding:26px 32px 0;">
          <h2 style="margin:0 0 14px;font-family:${fontFam};font-size:14px;font-weight:700;color:#0c4a6e;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #0369a1;padding-bottom:8px;">3 beneficios clave de tu cobertura</h2>

          <!-- Benefit 1: Full Cobertura -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e0e7ef;border-radius:10px;margin-bottom:8px;">
            <tr>
              <td width="48" valign="top" style="padding:14px 0 14px 16px;">
                <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0369a1;color:#ffffff;width:36px;height:36px;border-radius:50%;text-align:center;font-size:18px;font-weight:bold;line-height:36px;">+</td></tr></table>
              </td>
              <td valign="top" style="padding:14px 16px 14px 12px;">
                <p style="margin:0 0 2px;font-family:${fontFam};font-weight:700;color:#0c4a6e;font-size:14px;">Full Cobertura</p>
                <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">Da&ntilde;os a personas, propiedad, colisi&oacute;n, robo, gastos m&eacute;dicos y riesgos naturales &mdash; todas las letras del INS protegi&eacute;ndote.</p>
              </td>
            </tr>
          </table>

          <!-- Benefit 2: Cero deducible -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e0e7ef;border-radius:10px;margin-bottom:8px;">
            <tr>
              <td width="48" valign="top" style="padding:14px 0 14px 16px;">
                <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#10b981;color:#ffffff;width:36px;height:36px;border-radius:50%;text-align:center;font-size:18px;font-weight:bold;line-height:36px;">&#10003;</td></tr></table>
              </td>
              <td valign="top" style="padding:14px 16px 14px 12px;">
                <p style="margin:0 0 2px;font-family:${fontFam};font-weight:700;color:#0c4a6e;font-size:14px;">Cero deducible en tus choques</p>
                <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">Con la cobertura IDD, el INS te reintegra el deducible hasta 2 veces al a&ntilde;o. No sac&aacute;s un col&oacute;n.</p>
              </td>
            </tr>
          </table>

          <!-- Benefit 3: Asistencia -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e0e7ef;border-radius:10px;">
            <tr>
              <td width="48" valign="top" style="padding:14px 0 14px 16px;">
                <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f59e0b;color:#ffffff;width:36px;height:36px;border-radius:50%;text-align:center;font-size:18px;font-weight:bold;line-height:36px;">&#9733;</td></tr></table>
              </td>
              <td valign="top" style="padding:14px 16px 14px 12px;">
                <p style="margin:0 0 2px;font-family:${fontFam};font-weight:700;color:#0c4a6e;font-size:14px;">Asistencia 24/7 en carretera</p>
                <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">Gr&uacute;a, cerrajero, paso de corriente, combustible, llanta &mdash; desde cualquier lugar, a cualquier hora.</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- 6. PRECIOS — anclaje invertido (Anual destacado al centro) -->
        <tr><td style="padding:26px 32px 0;">
          <h2 style="margin:0 0 6px;font-family:${fontFam};font-size:14px;font-weight:700;color:#0c4a6e;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #0369a1;padding-bottom:8px;">Tus 3 opciones de pago</h2>
          <p style="margin:10px 0 14px;font-size:12px;color:#64748b;font-style:italic;text-align:center;">Eleg&iacute; la que mejor se ajuste a tu bolsillo</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px 0;">
            <tr>
              <!-- Trimestral -->
              <td width="33%" align="center" style="background:#ffffff;border:1px solid #e0e7ef;border-radius:10px;padding:14px 8px;vertical-align:middle;">
                <p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Trimestral</p>
                <p style="margin:6px 0 2px;font-family:${fontFam};font-size:17px;font-weight:800;color:#0c4a6e;">&#8353;${_escape(prices.trimestral || '—')}</p>
                <p style="margin:0;font-size:10px;color:#64748b;">cada 3 meses</p>
              </td>
              <!-- Anual (destacado) -->
              <td width="34%" align="center" bgcolor="#10b981" style="background:#10b981;color:#ffffff;border-radius:10px;padding:16px 8px;vertical-align:middle;position:relative;">
                <p style="margin:0 0 4px;background:#fbbf24;color:#422006;font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;display:inline-block;text-transform:uppercase;letter-spacing:0.05em;">&#9733; Recomendado &middot; -10%</p>
                <p style="margin:6px 0 0;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Anual</p>
                <p style="margin:6px 0 2px;font-family:${fontFam};font-size:21px;font-weight:800;color:#ffffff;">&#8353;${_escape(prices.anual || '—')}</p>
                <p style="margin:0;font-size:10px;color:#ffffff;opacity:0.9;">1 sola vez</p>
              </td>
              <!-- Semestral -->
              <td width="33%" align="center" style="background:#ffffff;border:1px solid #e0e7ef;border-radius:10px;padding:14px 8px;vertical-align:middle;">
                <p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Semestral</p>
                <p style="margin:6px 0 2px;font-family:${fontFam};font-size:17px;font-weight:800;color:#0c4a6e;">&#8353;${_escape(prices.semestral || '—')}</p>
                <p style="margin:0;font-size:10px;color:#64748b;">cada 6 meses</p>
              </td>
            </tr>
          </table>
        </td></tr>

        ${interesHtml}

        <!-- 7. SUSTITUCION DE REPUESTOS -->
        <tr><td style="padding:22px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border-left:4px solid #0369a1;border-radius:8px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#0c4a6e;letter-spacing:0.06em;text-transform:uppercase;">Sustituci&oacute;n de repuestos</p>
              <p style="margin:0;font-size:13px;color:#0c4a6e;line-height:1.55;">${_escape(sustText)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- 8. CTA AGENDAR (camino limpio sin barreras) -->
        <tr><td style="padding:30px 32px 0;text-align:center;">
          <a href="${CFG.AGENDA_URL}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;border-radius:10px;padding:16px 32px;font-family:${fontFam};font-weight:700;font-size:16px;">&#128197; Agendar mi cita ahora &rarr;</a>
          <p style="margin:14px 0 0;font-size:12px;color:#475569;font-weight:500;"><b style="color:#0c4a6e;">Cotizaci&oacute;n v&aacute;lida 15 d&iacute;as</b> &middot; Es f&aacute;cil, es r&aacute;pido, es seguro</p>
        </td></tr>

        <!-- 9. PRUEBA SOCIAL (momentum tras CTA) -->
        <tr><td style="padding:24px 32px 0;text-align:center;">
          <p style="margin:0 0 4px;color:#f59e0b;font-size:18px;letter-spacing:4px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
          <p style="margin:0;font-size:12px;color:#64748b;font-style:italic;">Miles de conductores ya est&aacute;n protegidos con nuestro proceso 100% digital</p>
        </td></tr>

        ${notaHtml}

        <!-- 10. FIRMA HUMANA -->
        <tr><td style="padding:28px 32px 0;text-align:center;border-top:1px solid #e0e7ef;margin-top:28px;">
          <p style="margin:24px 0 6px;font-family:${fontFam};font-style:italic;color:#475569;font-size:14px;">"Cualquier duda que tengas, hablemos. Estoy para vos."</p>
          <p style="margin:0;font-family:${fontFam};font-weight:700;color:#0c4a6e;font-size:14px;">&mdash; ${_escape(CFG.FROM_NAME)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Tu agente &middot; Lic. SUGESE ${_escape(CFG.LICENSE)}</p>
        </td></tr>

        <!-- 11. NOTA UBER (al puro final, disclaimer legal) -->
        <tr><td style="padding:22px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;">
            <tr>
              <td width="32" valign="top" style="padding:12px 0 12px 14px;color:#f59e0b;font-size:16px;line-height:1.2;">&#9888;</td>
              <td valign="top" style="padding:12px 14px 12px 4px;">
                <p style="margin:0 0 2px;font-size:10px;font-weight:bold;color:#92400e;letter-spacing:0.08em;text-transform:uppercase;">Importante</p>
                <p style="margin:0;font-size:12px;color:#78350f;line-height:1.55;">Esta p&oacute;liza <b style="color:#422006;">NO cubre</b> actividades de UBER, DiDi, Indriver o similares.</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- 12. FOOTER con marca SDI -->
        <tr><td bgcolor="#0c2340" style="background:#0c2340;color:#cbd5e1;padding:28px 32px 24px;text-align:center;margin-top:24px;">
          <!-- SDI logo (recreado en HTML para compatibilidad email) -->
          <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
            <tr>
              <td valign="middle" style="font-family:${fontFam};font-weight:500;font-size:32px;letter-spacing:-1px;color:#ffffff;line-height:1;">SDI</td>
              <td valign="middle" style="padding-left:10px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:22px;line-height:4px;font-size:0;">&nbsp;</td></tr>
                  <tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
                  <tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:22px;line-height:4px;font-size:0;">&nbsp;</td></tr>
                  <tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
                  <tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:22px;line-height:4px;font-size:0;">&nbsp;</td></tr>
                  <tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
                  <tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;width:22px;line-height:4px;font-size:0;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#cbd5e1;">Esta cotizaci&oacute;n pertenece a <b style="color:#ffffff;">Seguros Digitales SDI&reg;</b></p>
          <p style="margin:8px 0 4px;font-size:12px;">
            <a href="mailto:${_escape(CFG.FROM_EMAIL)}" style="color:#7dd3fc;text-decoration:none;font-weight:600;">${_escape(CFG.FROM_EMAIL)}</a>
            ${CFG.WEBSITE ? ` &middot; <a href="https://${_escape(CFG.WEBSITE)}" style="color:#7dd3fc;text-decoration:none;font-weight:600;">${_escape(CFG.WEBSITE)}</a>` : ''}
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#64748b;">Tel: ${_escape(CFG.PHONE)} &middot; Lic. SUGESE ${_escape(CFG.LICENSE)}</p>
          <p style="margin:10px 0 0;font-size:10px;color:#64748b;">&copy; 2026 Propiedad Intelectual de ${_escape(CFG.FROM_NAME)}</p>
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
 * Mapea el texto de sustitucion de repuestos del PDF al codigo corto
 * que usa el explicador como URL param `sr`.
 *
 *   "Extension de garantia Plus" -> 'p'
 *   "Extension de garantia"      -> 'g'
 *   "repuesto original"          -> '0'  (carro nuevo)
 *   "repuesto alternativo"       -> 'n'  (sin extension, fila generica)
 *   vacio / desconocido          -> 'n'  (default seguro)
 *
 * @param {string} label - texto del PDF
 * @returns {string} codigo de una letra: 'p' | 'g' | '0' | 'n'
 */
function _sustReposToCode(label) {
  const norm = (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('garantia plus'))       return 'p';
  if (norm.includes('garantia'))            return 'g';
  if (norm.includes('repuesto original'))   return '0';
  if (norm.includes('repuesto alternativo')) return 'n';
  return 'n';
}

/**
 * Detecta si el veh\u00edculo es el\u00e9ctrico o gasolina/di\u00e9sel a partir del
 * texto del campo `vehicleType` del PDF. Por ahora el PDF est\u00e1ndar no
 * distingue el\u00e9ctricos expl\u00edcitamente \u2014 devolvemos 'g' por default.
 * Si en el futuro se agrega un campo o checkbox al cotizador, este
 * helper centraliza la l\u00f3gica.
 *
 * @param {string} rawType - texto del campo vehicleType del PDF
 * @returns {string} 'g' (gasolina/di\u00e9sel) | 'e' (el\u00e9ctrico)
 */
function _detectVehicleType(rawType) {
  // Mismo patron que _sustReposToCode: NFD + strip de combining marks
  // tolera 'el\u00e9ctrico' (NFC) y 'el\u00e9ctrico' (NFD) por igual.
  const norm = (rawType || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('electric') || norm.includes('ev')) return 'e';
  return 'g';
}

/**
 * Formatea el valor asegurado del PDF para mostrarlo en la tarjeta del
 * correo. Strip del ".00" final pero conserva las comas como separador de
 * miles.
 *   "10,000,000.00" → "10,000,000"
 *   "570,891.00"    → "570,891"
 *   undefined/null  → ""
 * @param {string|number} val
 * @returns {string}
 */
function _formatValor(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\.00$/, '');
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

/**
 * Construye el URL del explicador con datos del agente Y del cliente.
 *
 * Hasta v1: solo 3 params (n, l, w) del agente. Backward compatible.
 * Desde v2: agrega 8 params del cliente y la cotización si se proveen.
 *
 * Formato completo:
 *   <CFG.GUIDE_URL>?n=...&l=...&w=...&c=...&v=...&p=...&y=...&vt=...&va=...&sr=...&pa=...&ps=...&pt=...
 *
 * El cliente abre ese URL desde su correo; no tiene localStorage con los
 * datos del agente. Los query params son la única forma de personalizar.
 *
 * @param {object} [extras] - datos opcionales del cliente y la cotización
 * @param {string} [extras.clientName]    - saludo del cliente (e.g. "Silvia Mariel")
 * @param {string} [extras.vehicle]       - descripción del vehículo (e.g. "Sedan 2019")
 * @param {string} [extras.plate]         - placa
 * @param {string|number} [extras.year]   - año del vehículo
 * @param {string} [extras.vehicleType]   - 'g' (gasolina) | 'e' (eléctrico)
 * @param {string|number} [extras.valor]  - valor asegurado en colones
 * @param {string} [extras.sustReposCode] - 'p' (Plus) | 'g' (Garantía) | '0' (nuevo) | 'n' (ninguno)
 * @param {object} [extras.prices]        - { anual, semestral, trimestral } strings ya extraídos del PDF
 * @returns {string} URL del explicador con query params
 */
function _buildGuideUrl(extras) {
  const base = CFG.GUIDE_URL;
  const params = [];

  // Agente (backward compat)
  if (CFG.FROM_NAME) params.push('n=' + encodeURIComponent(CFG.FROM_NAME));
  if (CFG.LICENSE)   params.push('l=' + encodeURIComponent(CFG.LICENSE));
  if (CFG.WEBSITE)   params.push('w=' + encodeURIComponent(CFG.WEBSITE));

  // Cliente + cotización (v2)
  const x = extras || {};
  const add = function (key, val) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      params.push(key + '=' + encodeURIComponent(String(val).trim()));
    }
  };
  // Normaliza montos del PDF ("10,000,000.00") → "10000000" para que el
  // explicador los pueda parsear con parseInt/Number sin romperse.
  const num = function (val) {
    if (val === undefined || val === null) return val;
    return String(val).replace(/,/g, '').replace(/\.00$/, '');
  };
  add('c',  x.clientName);
  add('v',  x.vehicle);
  add('p',  x.plate);
  add('y',  x.year);
  add('vt', x.vehicleType);
  add('va', num(x.valor));
  add('sr', x.sustReposCode);
  if (x.prices) {
    add('pa', num(x.prices.anual));
    add('ps', num(x.prices.semestral));
    add('pt', num(x.prices.trimestral));
  }

  if (params.length === 0) return base;
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  return base + sep + params.join('&');
}
