import { decimal, rateFraction, totalUSD, money, addBill, receivedMXN } from './money.js';
import { fetchRate } from './rates.js';
import { loadRate, saveRate } from './rate-store.js';
import { setupKeypad } from './keypad.js';
import { buildSummary, renderSummary } from './summary.js';
import { createCashUI } from './cash-ui.js';
import { icon } from './icons.js';
import { setupUI, presentState } from './ui.js';
let summary = null;
let cashUI = null;
let restoringCash = false;
const $ = id => document.getElementById(id);
let sequence = 0;
let automatic = null;
let saved = null;
let selectedSaved = null;
let attempted = null;
let loading = false;
let failure = '';
let requestId = 0;
let storageIssue = '';
try { saved = loadRate(localStorage); } catch { storageIssue = 'El almacenamiento local no está disponible.'; }
const currency = () => document.querySelector('input[name=currency]:checked').value;
const mode = () => $('rate-mode').value;
const online = () => navigator.onLine;
const currentRecord = () => cashUI?.lockContext() && cashUI.lockContext().form.currency !== 'MXN' && mode() !== 'manual' ? cashUI.lockContext().record : mode() === 'saved' ? selectedSaved : automatic;
const activeRate = () => mode() === 'manual' ? rateFraction($('manual-rate').value) : currentRecord() && rateFraction(currentRecord().value);
const formatDate = value => new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' });
function addPrice(focus = true) {
  const row = document.createElement('div');
  row.className = 'price-row';
  const id = `price-${++sequence}`;
  row.innerHTML = `<label for="${id}">Precio en MXN</label><div class="price-controls"><div class="amount-control"><input id="${id}" type="text" inputmode="none" placeholder="0.00" autocomplete="off" aria-describedby="price-error"><button class="keypad-toggle" data-input="${id}" aria-label="Abrir teclado para precio en MXN" aria-controls="keypad" aria-expanded="false">${icon('keyboard')}</button></div><button class="remove" aria-label="Eliminar precio">${icon('trash')}</button></div>`;
  row.querySelector('input').addEventListener('input', render);
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
    if (!$('prices').children.length) addPrice(false);
    render();
    $('prices').querySelector('input').focus();
  });
  $('prices').append(row);
  if (focus) row.querySelector('input').focus();
  render();
}
function clearReceived() {
  for (const name of ['mxn', 'usd']) { $(`received-${name}`).value = ''; $(`${name}-error`).textContent = ''; }
}
function render() {
  let total = 0n;
  let invalid = false;
  let hasPrices = false;
  for (const input of $('prices').querySelectorAll('input')) {
    const blank = !input.value.trim();
    const cents = decimal(input.value);
    input.setAttribute('aria-invalid', String(!blank && cents === null));
    if (!blank && cents === null) invalid = true;
    if (cents !== null) { total += cents; hasPrices = true; }
  }
  $('price-error').textContent = invalid ? 'Revisa los precios: usa importes positivos o cero, con hasta 2 decimales y 10 dígitos enteros.' : '';
  $('total').textContent = invalid ? '—' : money(total);
  const usd = currency() !== 'MXN';
  const rate = activeRate();
  $('mxn-box').hidden = currency() === 'USD';
  $('usd-box').hidden = !usd;
  $('usd-total-box').hidden = currency() !== 'USD';
  $('usd-total').textContent = invalid || !rate ? '—' : money(totalUSD(total, rate), 'USD');
  for (const name of ['mxn', 'usd']) {
    const input = $(`received-${name}`);
    const bad = input.value.trim() !== '' && decimal(input.value) === null;
    input.setAttribute('aria-invalid', String(bad));
    $(`${name}-error`).textContent = bad ? 'Escribe un importe positivo o cero, con hasta 2 decimales y 10 dígitos enteros.' : '';
  }
  const baseConverted = receivedMXN(currency(), $('received-mxn').value, $('received-usd').value, rate);
  const extra = cashUI?.extra() || 0n;
  const converted = baseConverted === null ? null : baseConverted + extra;
  $('converted').textContent = usd && converted !== null ? `${currency() === 'combined' ? 'Total recibido' : 'Equivale a'}: ${money(converted)}.` : '';
  const ready = !invalid && hasPrices && converted !== null;
  const difference = ready ? converted - total : null;
  const short = difference !== null && difference < 0n;
  $('change').parentElement.classList.toggle('short', short);
  $('change-label').textContent = short ? 'Falta por recibir en pesos' : 'Cambio en pesos';
  $('change').textContent = difference === null ? '—' : money(short ? -difference : difference);
  $('change-note').textContent = invalid ? 'Corrige los precios para calcular el cambio.' : usd && !rate ? 'Se necesita un tipo de cambio válido para cobrar en USD.' : !ready ? 'Introduce los precios y el dinero recibido.' : short ? 'El dinero recibido no cubre la compra.' : 'Entrega este importe en pesos mexicanos.';
  $('manual-box').hidden = mode() !== 'manual';
  $('manual-rate').setAttribute('aria-invalid', String(mode() === 'manual' && !rate));
  const frozen = !!cashUI?.locked() && currency() !== 'MXN' && mode() !== 'manual';
  const badge = frozen ? (mode() === 'saved' ? 'Fijada · Referencia anterior' : 'Fijada · Automática original') : mode() === 'manual' ? 'Manual' : mode() === 'saved' ? 'Referencia anterior' : 'Automático';
  $('rate-badge').textContent = badge;
  presentState({ ready, short, record: currentRecord(), manual: mode() === 'manual' });
  const value = mode() === 'manual' ? $('manual-rate').value.trim().replace(',', '.') : currentRecord()?.value;
  summary = buildSummary({ ready, total: invalid ? null : total, currency: currency() === 'USD' && extra > 0n ? 'combined' : currency(), mxn: (currency() === 'USD' ? 0n : decimal($('received-mxn').value) ?? 0n) + extra, usd: decimal($('received-usd').value) ?? 0n, converted, rateDescription: `${badge} · 1 USD = $${value} MXN${currentRecord() && mode() !== 'manual' ? ` · referencia ${currentRecord().date} · consulta ${formatDate(currentRecord().fetchedAt)}` : ''}` });
  renderSummary(summary);
  $('rate-value').textContent = rate ? `1 USD = $${value} MXN` : loading && mode() === 'auto' ? 'Consultando…' : 'Tasa no disponible';
  $('rate-status').textContent = mode() === 'manual' ? rate ? 'Se está usando la tasa de tu negocio.' : 'Introduce una tasa manual válida mayor que cero.' : mode() === 'saved' ? rate ? 'Usas explícitamente una referencia anterior. No es una cotización actual.' : 'No hay una referencia anterior válida seleccionada.' : loading ? 'Consultando la cotización diaria…' : failure || (automatic ? 'Referencia diaria de Frankfurter. Puede corresponder al último día hábil.' : 'Actualiza la cotización o selecciona una tasa manual o anterior.');
  $('rate-status').classList.toggle('error', mode() === 'auto' && Boolean(failure));
  if (frozen) {
    $('rate-status').textContent = 'Tasa fijada al confirmar el efectivo de esta cuenta. No es una nueva consulta. Se conserva su fecha original hasta finalizar o descartar el movimiento.';
    $('rate-status').classList.remove('error');
  }
  $('rate-dates').textContent = [attempted && `Última consulta: ${formatDate(attempted)} (hora local).`, currentRecord() && `Consulta de esta tasa: ${formatDate(currentRecord().fetchedAt)}.\nFecha de referencia: ${currentRecord().date}.`, mode() === 'manual' && 'La tasa manual no tiene fecha de referencia de mercado.'].filter(Boolean).join('\n');
  $('payment-rate').hidden = !usd;
  $('payment-rate').textContent = `Tasa utilizada: ${badge}${rate ? ` · $${value} MXN por USD` : ' · no disponible'}${mode() === 'saved' && rate ? ` · referencia ${selectedSaved.date}, consultada ${formatDate(selectedSaved.fetchedAt)}` : ''}.`;
  $('saved-option').disabled = !saved;
  $('saved-info').textContent = saved ? `Referencia anterior guardada: $${saved.value} MXN por USD. Fecha de referencia: ${saved.date}. Consulta: ${formatDate(saved.fetchedAt)}. Para usarla, selecciona «Referencia anterior».` : 'No hay una referencia anterior guardada.';
  $('storage-status').textContent = storageIssue;
  $('refresh').disabled = loading || !online() || !!cashUI?.locked();
  $('connection').textContent = online() ? 'Con conexión' : 'Sin conexión · Cotizaciones automáticas no disponibles';
  $('connection').classList.toggle('offline', !online());
  if (!restoringCash) cashUI?.update(readForm(), currentRecord());
}
async function refresh() {
  if (loading || !online() || cashUI?.locked()) return;
  const id = ++requestId;
  loading = true;
  failure = '';
  automatic = null;
  attempted = new Date();
  render();
  try {
    const data = await fetchRate();
    if (id !== requestId || !online()) return;
    automatic = { ...data, fetchedAt: new Date().toISOString(), source: 'Frankfurter' };
    saved = { ...automatic };
    try { storageIssue = saveRate(localStorage, saved) ? '' : 'No se pudo guardar la tasa en este dispositivo. Está disponible solo en esta sesión.'; }
    catch { storageIssue = 'No se pudo guardar la tasa en este dispositivo. Está disponible solo en esta sesión.'; }
  } catch {
    if (id === requestId) { automatic = null; failure = 'No se pudo obtener una cotización válida. Revisa la conexión, actualiza o selecciona una tasa manual o referencia anterior.'; }
  } finally { if (id === requestId) { loading = false; render(); } }
}
for (const [name, bills] of [['mxn', [20, 50, 100, 200, 500, 1000]], ['usd', [1, 5, 10, 20, 50, 100]]]) {
  const input = $(`received-${name}`);
  for (const bill of bills) {
    const button = document.createElement('button');
    button.textContent = `+$${bill.toLocaleString('es-MX')}`;
    button.setAttribute('aria-label', `Agregar ${bill} ${name.toUpperCase()}`);
    button.addEventListener('click', () => {
      const result = addBill(input.value, String(bill));
      if (result === null) { $(`${name}-error`).textContent = 'Corrige o limpia el importe antes de sumar; no puede superar 10 dígitos enteros.'; return; }
      input.value = result;
      render();
    });
    $(`${name}-bills`).append(button);
  }
  input.addEventListener('input', render);
  $(`clear-${name}`).addEventListener('click', () => { input.value = ''; render(); input.focus(); });
}
$('add').addEventListener('click', () => addPrice());
$('manual-rate').addEventListener('input', render);
$('rate-mode').addEventListener('change', () => { selectedSaved = mode() === 'saved' && saved ? { ...saved } : null; render(); });
document.querySelectorAll('input[name=currency]').forEach(input => input.addEventListener('change', () => { clearReceived(); render(); }));
$('refresh').addEventListener('click', refresh);
$('reset').addEventListener('click', () => cashUI.newAccount());
window.addEventListener('offline', () => {
  ++requestId; loading = false; automatic = null;
  failure = 'Sin conexión. Selecciona explícitamente una referencia anterior o introduce una tasa manual.';
  render();
});
window.addEventListener('online', () => { failure = ''; render(); refresh(); });
setupUI();
setupKeypad();
$('copy-summary').addEventListener('click', async () => {
  if (!summary) return;
  const text = summary.text;
  try {
    await navigator.clipboard.writeText(text);
    $('copy-status').textContent = summary?.text === text ? 'Resumen copiado.' : 'La operación cambió. Copia nuevamente el resumen actualizado.';
  } catch {
    if (summary?.text !== text) return;
    $('copy-fallback').hidden = false;
    $('copy-text').value = text;
    $('copy-text').focus(); $('copy-text').select();
    $('copy-status').textContent = 'El navegador no permitió copiar. Puedes copiar manualmente el texto seleccionado.';
  }
});
function readForm() {
  return { prices: [...$('prices').querySelectorAll('input')].map(input => input.value), mxn: $('received-mxn').value, usd: $('received-usd').value, currency: currency(), rateMode: mode(), manualRate: $('manual-rate').value };
}
function clearAccount() { $('prices').replaceChildren(); clearReceived(); addPrice(); }
function restoreAccount(form) {
  restoringCash = true; $('prices').replaceChildren();
  for (const value of form.prices) { addPrice(false); $('prices').lastElementChild.querySelector('input').value = value; }
  $('received-mxn').value = form.mxn; $('received-usd').value = form.usd;
  document.querySelector('input[name=currency][value="'+form.currency+'"]').checked = true;
  $('rate-mode').value = form.rateMode; $('manual-rate').value = form.manualRate;
  if (form.rateMode === 'saved') selectedSaved = cashUI.lockContext()?.record || saved;
}
cashUI = createCashUI({ clear: clearAccount, render, restore: restoreAccount });
restoringCash = true; addPrice(false); cashUI.restore(); restoringCash = false; render();
if (online()) refresh();
else { failure = 'Sin conexión. Selecciona explícitamente una referencia anterior o introduce una tasa manual.'; render(); }
