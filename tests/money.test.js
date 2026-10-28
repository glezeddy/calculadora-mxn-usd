import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimal, rateFraction, convertToMXN, totalUSD, money } from '../money.js';
import { fetchRate } from '../rates.js';
test('sumas y cambio exactos en centavos', () => {
  assert.equal(decimal('0.10') + decimal('0.20'), 30n);
  const total = decimal('125.50') + decimal('74.49');
  assert.equal(total, 19999n);
  assert.equal(decimal('200') - total, 1n);
  assert.equal(decimal('100') - total, -9999n);
  assert.equal(money(total), '$199.99 MXN');
});
test('validación estricta de importes y tasas', () => {
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '12.345', 'abc', '.', '1,000.00', '99999999999']) assert.equal(decimal(value), null, value);
  assert.equal(decimal('12,50'), 1250n);
  for (const value of ['', '0', '-1', 'NaN', 'Infinity', '1e-8']) assert.equal(rateFraction(value), null, value);
  assert.equal(convertToMXN(100n, null), null);
  assert.equal(totalUSD(100n, null), null);
});
test('USD, redondeo al centavo y faltantes', () => {
  const rate = rateFraction('17.50');
  assert.equal(totalUSD(35000n, rate), 2000n);
  assert.equal(convertToMXN(2500n, rate) - 35000n, 8750n);
  assert.equal(convertToMXN(1000n, rate) - 35000n, -17500n);
  assert.equal(convertToMXN(1n, rateFraction('17.505')), 18n);
  assert.equal(totalUSD(10000n, rateFraction('18.6347')), 537n);
  assert.ok(convertToMXN(537n, rateFraction('18.6347')) >= 10000n);
});
test('importes grandes y tasas con 10 decimales sin pérdida de precisión', () => {
  const cents = decimal('9999999999.99');
  assert.equal(cents, 999999999999n);
  assert.equal(convertToMXN(cents, rateFraction('1.0000000001')), 1000000000099n);
});
const now = new Date('2026-10-28T12:00:00Z');
const valid = { date: '2026-10-27', base: 'USD', quote: 'MXN', rate: 18.6347 };
const mock = data => async () => ({ ok: true, json: async () => data });
test('API: acepta datos válidos y rechaza respuestas incompletas, antiguas o inválidas', async () => {
  assert.deepEqual(await fetchRate(mock(valid), now), { date: valid.date, value: '18.6347' });
  for (const patch of [{rate: 0}, {rate: -1}, {rate: '18'}, {quote: 'EUR'}, {base: 'MXN'}, {date: '2026-10-01'}, {date: '2026-02-30'}, {date: '2027-01-01'}, {date: null}]) await assert.rejects(fetchRate(mock({...valid, ...patch}), now));
  await assert.rejects(fetchRate(async () => { throw new Error('Sin red'); }, now));
  await assert.rejects(fetchRate(async () => ({ok: false}), now));
  await assert.rejects(fetchRate(async () => ({ok: true, json: async () => {throw new Error('JSON');}}), now));
});
