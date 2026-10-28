import { decimal, rateFraction, convertToMXN, totalUSD, money } from './money.js';
import { fetchRate } from './rates.js';
const $ = id => document.getElementById(id);
let sequence = 0;
let automatic = null;
let attempted = null;
let successful = null;
let loading = false;
let failure = false;
const currency = () => document.querySelector('input[name=currency]:checked').value;
const manual = () => $('rate-mode').value === 'manual';
const activeRate = () => manual() ? rateFraction($('manual-rate').value) : automatic && rateFraction(automatic.value);
function addPrice(focus = true) {
  const row = document.createElement('div');
  row.className = 'price-row';
  const id = `price-${++sequence}`;
  row.innerHTML = `<label for="${id}">Precio en MXN</label><div class="price-controls"><input id="${id}" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" aria-describedby="price-error"><button class="remove" aria-label="Eliminar precio">×</button></div>`;
  row.querySelector('input').addEventListener('input', render);
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    if (!$('prices').children.length) addPrice(false);
    render();
    $('prices').querySelector('input').focus();
  });
  $('prices').append(row);
  if (focus) row.querySelector('input').focus();
  render();
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
  const usd = currency() === 'USD';
  const rate = activeRate();
  $('usd-total-box').hidden = !usd;
  $('usd-total').textContent = invalid || !rate ? '—' : money(totalUSD(total, rate), 'USD');
  $('received-label').textContent = `Dinero recibido en ${currency()}`;
  const received = decimal($('received').value);
  const badReceived = $('received').value.trim() !== '' && received === null;
  $('received').setAttribute('aria-invalid', String(badReceived));
  $('received-error').textContent = badReceived ? 'Escribe un importe positivo o cero, con hasta 2 decimales y 10 dígitos enteros.' : '';
  const converted = received === null || (usd && !rate) ? null : usd ? convertToMXN(received, rate) : received;
  $('converted').textContent = usd && converted !== null ? `Equivale a ${money(converted)}.` : '';
  const ready = !invalid && hasPrices && converted !== null;
  const difference = ready ? converted - total : null;
  const short = difference !== null && difference < 0n;
  $('change').parentElement.classList.toggle('short', short);
  $('change-label').textContent = short ? 'Falta por recibir en pesos' : 'Cambio en pesos';
  $('change').textContent = difference === null ? '—' : money(short ? -difference : difference);
  $('change-note').textContent = invalid ? 'Corrige los precios para calcular el cambio.' : usd && !rate ? 'Se necesita un tipo de cambio válido para cobrar en USD.' : !ready ? 'Introduce los precios y el dinero recibido.' : short ? 'El dinero recibido no cubre la compra.' : 'Entrega este importe en pesos mexicanos.';
  $('manual-box').hidden = !manual();
  $('manual-rate').setAttribute('aria-invalid', String(manual() && !rate));
  $('rate-badge').textContent = manual() ? 'Manual' : 'Automático';
  $('rate-value').textContent = rate ? `1 USD = $${manual() ? $('manual-rate').value.trim().replace(',', '.') : automatic.value} MXN` : loading && !manual() ? 'Consultando…' : 'Tasa no disponible';
  $('rate-status').textContent = manual() ? rate ? 'Se está usando la tasa de tu negocio.' : 'Introduce una tasa manual válida mayor que cero.' : loading ? 'Consultando la cotización diaria…' : failure ? 'No se pudo obtener una cotización válida. Actualiza o selecciona una tasa manual.' : 'Referencia diaria de Frankfurter. Puede corresponder al último día hábil.';
  $('rate-status').classList.toggle('error', !manual() && failure);
  const formatDate = d => d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' });
  $('rate-dates').textContent = [attempted && `Última consulta: ${formatDate(attempted)} (hora local).`, successful && `Última consulta exitosa: ${formatDate(successful)}.`, automatic && `Fecha de referencia automática: ${automatic.date}.`, manual() && 'La tasa manual no tiene fecha de referencia de mercado.'].filter(Boolean).join('\n');
  $('refresh').disabled = loading;
}
async function refresh() {
  if (loading) return;
  loading = true;
  failure = false;
  automatic = null;
  attempted = new Date();
  render();
  try { automatic = await fetchRate(); successful = new Date(); }
  catch { automatic = null; failure = true; }
  finally { loading = false; render(); }
}
$('add').addEventListener('click', () => addPrice());
$('received').addEventListener('input', render);
$('manual-rate').addEventListener('input', render);
$('rate-mode').addEventListener('change', render);
document.querySelectorAll('input[name=currency]').forEach(input => input.addEventListener('change', () => { $('received').value = ''; render(); }));
$('refresh').addEventListener('click', refresh);
$('reset').addEventListener('click', () => { $('prices').replaceChildren(); $('received').value = ''; addPrice(); });
addPrice(false);
refresh();
