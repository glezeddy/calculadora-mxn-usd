// Edición de texto decimal, incluida una selección del campo.
export function editAmount(value, key, start = value.length, end = start) {
  if (key === 'clear') return { value: '', caret: 0 };
  let next, caret;
  if (key === 'backspace') {
    const from = start === end ? Math.max(0, start - 1) : start;
    next = value.slice(0, from) + value.slice(end); caret = from;
  } else {
    if (!/^[0-9.]$/.test(key)) return null;
    const insert = key === '.' && start === 0 ? '0.' : key;
    next = value.slice(0, start) + insert + value.slice(end); caret = start + insert.length;
  }
  next = next.replace(',', '.');
  if (!/^\d{0,10}(?:\.\d{0,2})?$/.test(next)) return null;
  return { value: next, caret };
}
export function setupKeypad() {
  const panel = document.getElementById('keypad');
  const targetLabel = document.getElementById('keypad-target');
  let target = null;
  const eligible = input => input instanceof HTMLInputElement && (input.closest('#prices') || ['received-mxn', 'received-usd'].includes(input.id));
  document.addEventListener('focusin', event => {
    if (!eligible(event.target)) return;
    target = event.target;
    const label = document.querySelector(`label[for="${target.id}"]`);
    targetLabel.textContent = `Editando: ${label?.textContent || 'Importe'}`;
    const host = target.closest('.price-row, .received-box');
    if (panel.parentElement !== host) host.append(panel);
    panel.hidden = false;
  });
  panel.addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-key]');
    if (!button || !target?.isConnected || target.closest('[hidden]')) { panel.hidden = true; return; }
    const result = editAmount(target.value, button.dataset.key, target.selectionStart ?? target.value.length, target.selectionEnd ?? target.value.length);
    if (!result) { document.getElementById('keypad-status').textContent = 'Máximo 10 dígitos enteros y 2 decimales. Corrige o limpia el campo.'; return; }
    document.getElementById('keypad-status').textContent = '';
    target.value = result.value;
    target.setSelectionRange(result.caret, result.caret);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.querySelectorAll('input[name=currency]').forEach(input => input.addEventListener('change', () => { panel.hidden = true; target = null; }));
  // Si se elimina el precio que contiene el panel, se recupera para el siguiente campo.
  new MutationObserver(() => { if (!panel.isConnected) { document.querySelector('main').append(panel); panel.hidden = true; target = null; } }).observe(document.getElementById('prices'), {childList:true,subtree:true});
}
