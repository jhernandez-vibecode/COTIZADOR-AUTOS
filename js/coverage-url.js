/**
 * Construye la URL del /detalle/?... a partir de los datos del formulario.
 * Sigue el patron de _buildGuideUrl() del email-template.js pero con
 * mas parametros y normalizacion especifica de WhatsApp.
 *
 * @param {object} d - datos del formulario
 * @param {string} d.base - URL base, ej: "https://cotizador-segurosdigitalesins-sdi.netlify.app/detalle/"
 * @param {object} d.agent  - { name, license, website, whatsapp, email }
 * @param {object} d.client - { name, email }
 * @param {object} d.vehicle - { description, plate, year, valor, electric }
 * @param {object} d.policy  - { from, to, paymentForm, lastPremium } - ISO dates, paymentForm in a/s/t/m
 * @param {string[]} d.coverages - ej: ['A','C','N','D','F','B','H','GM','IDD','REP']
 * @param {object} d.customAmounts - { A?: number, C?: number, B?: number }
 * @param {?number} d.iddAmount - 300000 | 400000 | 500000 | null
 * @param {?string} d.repPlan - 'P'|'G'|'N'|'A' | null
 * @param {string} d.deductible - 'nec'|'f400'|'f500'|'o150'|'o500'
 * @returns {string} URL completa del detalle
 */
function buildDetalleUrl(d) {
  const base = d.base;
  const params = [];

  const add = function (key, val) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      params.push(key + '=' + encodeURIComponent(String(val).trim()));
    }
  };

  // Agente
  add('n', d.agent.name);
  add('l', d.agent.license);
  add('w', d.agent.website);
  add('e', d.agent.email);
  // WhatsApp: normalizar a solo digitos con prefijo 506
  if (d.agent.whatsapp) {
    let wa = String(d.agent.whatsapp).replace(/\D/g, '');
    if (wa && !wa.startsWith('506')) wa = '506' + wa;
    if (wa) params.push('wa=' + wa);
  }

  // Cliente
  add('c', d.client.name);

  // Vehiculo
  add('v',  d.vehicle.description);
  add('p',  d.vehicle.plate);
  add('y',  d.vehicle.year);
  add('va', d.vehicle.valor);
  if (d.vehicle.electric) params.push('vt=e');

  // Poliza
  add('vd', d.policy.from);
  add('vh', d.policy.to);
  add('fp', d.policy.paymentForm);
  add('pp', d.policy.lastPremium);

  // Coberturas (joined con _)
  if (d.coverages && d.coverages.length) {
    add('cobs', d.coverages.join('_'));
  }

  // Montos custom - solo si fueron editados (distintos del default)
  if (d.customAmounts) {
    if (d.customAmounts.A) add('a300', d.customAmounts.A);
    if (d.customAmounts.C) add('c100', d.customAmounts.C);
    if (d.customAmounts.B) add('b15',  d.customAmounts.B);
  }

  // Sub-opciones
  add('idd', d.iddAmount);
  add('rep', d.repPlan);

  // Deducible
  add('ded', d.deductible);

  if (params.length === 0) return base;
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  return base + sep + params.join('&');
}

// Export para Node tests + global para browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDetalleUrl };
}
if (typeof window !== 'undefined') {
  window.buildDetalleUrl = buildDetalleUrl;
}
// Node sandbox vm context
if (typeof globalThis !== 'undefined') {
  globalThis.buildDetalleUrl = buildDetalleUrl;
}
