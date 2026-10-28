import { rateFraction } from './money.js';
export const RATE_KEY = 'cuenta-clara:last-valid-rate:v1';
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validSavedRate(value, now = new Date()) {
  if (!value || value.source !== 'Frankfurter' || typeof value.value !== 'string' || !rateFraction(value.value) || !validDate(value.date)) return false;
  const fetched = typeof value.fetchedAt === 'string' ? Date.parse(value.fetchedAt) : NaN;
  return Number.isFinite(fetched) && fetched <= now.getTime() && value.date <= new Date(fetched).toISOString().slice(0, 10);
}
export function loadRate(storage, now = new Date()) {
  try {
    const value = JSON.parse(storage.getItem(RATE_KEY));
    return validSavedRate(value, now) ? value : null;
  } catch { return null; }
}
export function saveRate(storage, rate) {
  if (!validSavedRate(rate)) return false;
  try { storage.setItem(RATE_KEY, JSON.stringify(rate)); return true; }
  catch { return false; }
}
