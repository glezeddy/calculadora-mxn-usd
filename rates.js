import { rateFraction } from './money.js';
export const ENDPOINT = 'https://api.frankfurter.dev/v2/rate/USD/MXN';
export async function fetchRate(fetcher = fetch, now = new Date()) {
  const response = await fetcher(ENDPOINT, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Respuesta de red inválida');
  const data = await response.json();
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? new Date(`${data.date}T00:00:00Z`) : null;
  const age = date ? now - date : NaN;
  if (!data || data.base !== 'USD' || data.quote !== 'MXN' || typeof data.rate !== 'number' || !rateFraction(data.rate) || !date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== data.date || data.date > now.toISOString().slice(0, 10) || age > 7 * 86400000) {
    throw new Error('Cotización inválida o con más de siete días de antigüedad');
  }
  return { value: String(data.rate), date: data.date };
}
