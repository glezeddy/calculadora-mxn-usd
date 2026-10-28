// Las cantidades nunca pasan por coma flotante durante el cálculo.
export function decimal(value, places = 2) {
  const text = String(value).trim().replace(',', '.');
  if (!new RegExp(`^\\d{1,10}(?:\\.\\d{1,${places}})?$`).test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
}
export function rateFraction(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^\d{1,6}(?:\.\d{1,10})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const numerator = BigInt(whole + fraction);
  return numerator > 0n ? { numerator, denominator: 10n ** BigInt(fraction.length) } : null;
}
export function convertToMXN(cents, rate) {
  if (!rate || rate.numerator <= 0n || rate.denominator <= 0n) return null;
  return (cents * rate.numerator + rate.denominator / 2n) / rate.denominator;
}
export function totalUSD(cents, rate) {
  if (!rate || rate.numerator <= 0n || rate.denominator <= 0n) return null;
  return (cents * rate.denominator + rate.numerator - 1n) / rate.numerator;
}
export function money(cents, currency = 'MXN') {
  if (cents === null) return '—';
  const sign = cents < 0n ? '−' : '';
  const absolute = cents < 0n ? -cents : cents;
  const whole = (absolute / 100n).toLocaleString('es-MX');
  return `${sign}$${whole}.${String(absolute % 100n).padStart(2, '0')} ${currency}`;
}

export function amountText(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export function addBill(value, denomination) {
  const current = String(value).trim() === '' ? 0n : decimal(value);
  const bill = decimal(denomination);
  if (current === null || bill === null) return null;
  const result = amountText(current + bill);
  return decimal(result) === null ? null : result;
}
export function receivedMXN(mode, mxnText, usdText, rate) {
  const combined = mode === 'combined';
  const mxn = mode === 'USD' ? 0n : combined && !mxnText.trim() ? 0n : decimal(mxnText);
  const usd = mode === 'MXN' ? 0n : combined && !usdText.trim() ? 0n : decimal(usdText);
  if (!['MXN', 'USD', 'combined'].includes(mode) || mxn === null || usd === null) return null;
  if (combined && !mxnText.trim() && !usdText.trim()) return null;
  // Cualquier modalidad que incluya USD necesita una tasa válida, incluso con USD vacío.
  const converted = mode === 'MXN' ? 0n : convertToMXN(usd, rate);
  return converted === null ? null : mxn + converted;
}
