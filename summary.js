import { money } from './money.js';
export function buildSummary({ ready, total, currency, mxn, usd, rateDescription, converted }) {
  if (!ready || total === null || converted === null) return null;
  const difference = converted - total;
  const rows = [['Total de compra', money(total)]];
  if (currency !== 'USD') rows.push(['Recibido en MXN', money(mxn)]);
  if (currency !== 'MXN') rows.push(['Recibido en USD', money(usd, 'USD')], ['Tipo de cambio utilizado', rateDescription]);
  rows.push(['Total recibido equivalente', money(converted)], [difference < 0n ? 'Cantidad faltante' : 'Cambio a entregar', money(difference < 0n ? -difference : difference)], ['Estado', difference < 0n ? 'Pago insuficiente' : 'Pago completo']);
  return { rows, text: ['Resumen del cobro', ...rows.map(([label,value]) => `${label}: ${value}`), 'Información de la operación actual. No es un comprobante fiscal.'].join('\n') };
}
export function renderSummary(summary) {
  const container = document.getElementById('summary-values');
  container.replaceChildren();
  for (const [label, value] of summary?.rows || []) {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    container.append(dt,dd);
  }
  document.getElementById('summary-empty').hidden = Boolean(summary);
  document.getElementById('copy-summary').disabled = !summary;
  document.getElementById('copy-status').textContent = '';
  document.getElementById('copy-fallback').hidden = true;
}
